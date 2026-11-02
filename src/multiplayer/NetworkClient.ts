/**
 * Project Apex — NetworkClient
 * Robust client-side network manager supporting:
 * 1. WebRTC Peer-to-Peer DataChannels via PeerJS (default for online play & HTTPS deployments like Vercel)
 * 2. Standard WebSocket client for local offline LAN server setups (port 5050)
 */

import { Peer, DataConnection } from 'peerjs';
import {
  APEX_LAN_PROTOCOL_VERSION,
  ClientMessage,
  ServerMessage,
  RoomConfig,
  LobbyPlayer,
  WorldSnapshotMessage,
  MultiplayerRacerResult,
  ServerInfo,
} from './MultiplayerTypes';
import { InputState } from '../input/InputManager';

export type NetworkConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type NetworkTransportMode = 'p2p' | 'websocket';

export interface NetworkClientEvents {
  stateChanged: (state: NetworkConnectionState, error?: string) => void;
  roomCreated: (config: RoomConfig, player: LobbyPlayer, serverInfo: ServerInfo) => void;
  roomJoined: (config: RoomConfig, players: LobbyPlayer[], selfId: string, serverInfo: ServerInfo) => void;
  lobbyUpdated: (config: RoomConfig, players: LobbyPlayer[]) => void;
  raceStarting: (data: Extract<ServerMessage, { type: 'RACE_STARTING' }>) => void;
  worldSnapshot: (snapshot: WorldSnapshotMessage) => void;
  clientInputReceived: (inputMsg: Extract<ClientMessage, { type: 'CLIENT_INPUT_FRAME' }> & { playerId: string }) => void;
  raceFinished: (standings: MultiplayerRacerResult[]) => void;
  playerDisconnected: (playerId: string, playerName: string) => void;
  hostDisconnected: (message: string) => void;
  error: (message: string) => void;
  pingUpdated: (pingMs: number) => void;
}

export class NetworkClient {
  public transportMode: NetworkTransportMode = 'p2p';
  public state: NetworkConnectionState = 'disconnected';
  public selfId: string | null = null;
  public isHost: boolean = false;
  public pingMs: number = 0;

  // WebSocket Transport
  private ws: WebSocket | null = null;
  private pingIntervalId: number | null = null;
  private lastPingSentTime: number = 0;

  // PeerJS WebRTC Transport
  private peer: Peer | null = null;
  private hostDataConnections: Map<string, DataConnection> = new Map();
  private clientConnection: DataConnection | null = null;
  private p2pActiveRoom: { config: RoomConfig; players: LobbyPlayer[] } | null = null;
  private nextP2PPlayerNum: number = 2;

  private listeners: { [K in keyof NetworkClientEvents]?: Array<NetworkClientEvents[K]> } = {};

  constructor() {}

  public on<K extends keyof NetworkClientEvents>(event: K, handler: NetworkClientEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  public off<K extends keyof NetworkClientEvents>(event: K, handler: NetworkClientEvents[K]): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = (this.listeners[event]! as any[]).filter((h) => h !== handler);
  }

  private emit<K extends keyof NetworkClientEvents>(event: K, ...args: Parameters<NetworkClientEvents[K]>): void {
    const handlers = this.listeners[event];
    if (handlers) {
      for (const h of handlers) {
        try {
          (h as any)(...args);
        } catch (err) {
          console.error(`[NetworkClient] Error in ${event} handler:`, err);
        }
      }
    }
  }

  /**
   * Connects to a multiplayer race host.
   * If address is a Room Code (or starts with 'APX-' or 'p2p:' or doesn't have ':5050'/IP format),
   * uses WebRTC Peer-to-Peer DataChannels (works anywhere online including Vercel HTTPS).
   * Otherwise uses direct WebSocket to connect to local offline Node server.
   */
  public async connect(hostAddress: string): Promise<void> {
    this.disconnect();
    this.setState('connecting');

    const clean = hostAddress.trim();
    const isWebSocket =
      clean.startsWith('ws://') ||
      clean.startsWith('wss://') ||
      clean.includes(':5050') ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(clean);

    if (isWebSocket) {
      this.transportMode = 'websocket';
      return this.connectWebSocket(clean);
    } else {
      this.transportMode = 'p2p';
      return this.connectP2P(clean);
    }
  }

  // =========================================================================
  // WEBSOCKET IMPLEMENTATION (LOCAL LAN SERVER)
  // =========================================================================

  private async connectWebSocket(hostAddress: string): Promise<void> {
    let cleanAddr = hostAddress.trim();
    if (!cleanAddr.includes('://')) {
      cleanAddr = `ws://${cleanAddr}`;
    }
    if (!cleanAddr.includes(':', 6)) {
      cleanAddr = `${cleanAddr}:5050`;
    }

    return new Promise((resolve, reject) => {
      try {
        let hasErrorOccurred = false;
        const socket = new WebSocket(cleanAddr);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (this.state === 'connecting') {
            hasErrorOccurred = true;
            socket.close();
            const err = `Connection to ${cleanAddr} timed out. Ensure the host LAN server is running (port 5050).`;
            this.setState('error', err);
            reject(new Error(err));
          }
        }, 6000);

        socket.onopen = () => {
          clearTimeout(timeout);
          hasErrorOccurred = false;
          this.setState('connected');
          this.startPingLoop();
          resolve();
        };

        socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        socket.onclose = () => {
          clearTimeout(timeout);
          this.stopPingLoop();
          if (!hasErrorOccurred) {
            this.setState('disconnected');
          }
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          this.stopPingLoop();
          hasErrorOccurred = true;
          const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
          const err = isHttps
            ? `Cannot connect to insecure ${cleanAddr} from secure HTTPS website. Switch to 'Online P2P (Room Code)' mode for web multiplayer!`
            : `Cannot reach LAN Server at ${cleanAddr}. Start server in terminal with 'npm run server' or 'node scripts/lan_server.cjs'.`;
          this.setState('error', err);
          reject(new Error(err));
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Invalid connection address';
        this.setState('error', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  }

  // =========================================================================
  // WEBRTC PEER-TO-PEER IMPLEMENTATION (PEERJS CLOUD)
  // =========================================================================

  private async connectP2P(targetRoomCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create client peer with randomized ID
        const peer = new Peer({
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });
        this.peer = peer;

        const timeout = setTimeout(() => {
          if (this.state === 'connecting') {
            peer.destroy();
            const err = `Connection to Room "${targetRoomCode}" timed out. Ensure the Room Code is correct and the Host is online.`;
            this.setState('error', err);
            reject(new Error(err));
          }
        }, 12000);

        peer.on('open', () => {
          const cleanCode = targetRoomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
          const conn = peer.connect(cleanCode, { reliable: true });
          this.clientConnection = conn;

          conn.on('open', () => {
            clearTimeout(timeout);
            this.setState('connected');
            resolve();
          });

          conn.on('data', (raw: any) => {
            this.handleMessage(raw);
          });

          conn.on('close', () => {
            this.emit('hostDisconnected', 'Host disconnected from race room.');
            this.disconnect();
          });

          conn.on('error', (err: any) => {
            clearTimeout(timeout);
            const msg = err?.message || 'WebRTC connection error';
            this.setState('error', msg);
            reject(new Error(msg));
          });
        });

        peer.on('error', (err: any) => {
          clearTimeout(timeout);
          const errText = err?.type === 'peer-unavailable'
            ? `Room "${targetRoomCode}" not found. Verify the Room Code or ask Host to create a room.`
            : (err?.message || 'Failed to connect to signaling server');
          this.setState('error', errText);
          reject(new Error(errText));
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to initialize WebRTC peer';
        this.setState('error', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  }

  /**
   * Initializes host room on PeerJS Cloud
   */
  public async createP2PHostRoom(
    roomCode: string,
    roomConfig: Partial<RoomConfig>,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string }
  ): Promise<void> {
    this.disconnect();
    this.setState('connecting');
    this.transportMode = 'p2p';

    return new Promise((resolve, reject) => {
      try {
        const cleanCode = roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || `APX-${Math.floor(1000 + Math.random() * 9000)}`;

        const peer = new Peer(cleanCode, {
          debug: 1,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' },
            ],
          },
        });
        this.peer = peer;

        const timeout = setTimeout(() => {
          if (this.state === 'connecting') {
            peer.destroy();
            const err = `Room hosting timed out. Check internet connection and try again.`;
            this.setState('error', err);
            reject(new Error(err));
          }
        }, 12000);

        peer.on('open', (assignedId) => {
          clearTimeout(timeout);
          this.isHost = true;
          this.selfId = 'p_host';

          const hostPlayer: LobbyPlayer = {
            id: this.selfId,
            name: player.name || 'Host Driver',
            isHost: true,
            vehicleId: player.vehicleId,
            vehicleName: player.vehicleName,
            paintId: player.paintId,
            isReady: true,
            gridSlot: 1,
            pingMs: 0,
          };

          const fullConfig: RoomConfig = {
            roomId: assignedId,
            hostName: hostPlayer.name,
            trackId: roomConfig.trackId || 'forest_valley',
            trackName: roomConfig.trackName || 'Forest Valley Circuit',
            raceMode: roomConfig.raceMode || 'circuit',
            maxPlayers: roomConfig.maxPlayers || 4,
            fillWithAI: roomConfig.fillWithAI !== false,
            lapCount: roomConfig.lapCount || 1,
          };

          this.p2pActiveRoom = {
            config: fullConfig,
            players: [hostPlayer],
          };

          this.setState('connected');
          this.emit('roomCreated', fullConfig, hostPlayer, {
            localIp: assignedId,
            port: 443,
            version: APEX_LAN_PROTOCOL_VERSION,
          });

          resolve();
        });

        // Incoming connection handler on host
        peer.on('connection', (conn: DataConnection) => {
          let remotePlayerId: string | null = null;

          conn.on('data', (raw: any) => {
            const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!msg || !msg.type) return;

            if (msg.type === 'JOIN_ROOM') {
              if (!this.p2pActiveRoom) return;

              if (this.p2pActiveRoom.players.length >= this.p2pActiveRoom.config.maxPlayers) {
                conn.send({ type: 'ERROR', message: `Lobby is full (Max ${this.p2pActiveRoom.config.maxPlayers} players).` });
                return;
              }

              const takenSlots = new Set(this.p2pActiveRoom.players.map((p) => p.gridSlot));
              let assignedSlot = 2;
              for (let s = 1; s <= 4; s++) {
                if (!takenSlots.has(s)) {
                  assignedSlot = s;
                  break;
                }
              }

              remotePlayerId = `p_${this.nextP2PPlayerNum++}`;
              const newPlayer: LobbyPlayer = {
                id: remotePlayerId,
                name: msg.player?.name || `Driver ${assignedSlot}`,
                isHost: false,
                vehicleId: msg.player?.vehicleId || 'mercedes_slc',
                vehicleName: msg.player?.vehicleName || 'STUTTGART SLC',
                paintId: msg.player?.paintId || 'racing_red',
                isReady: false,
                gridSlot: assignedSlot,
                pingMs: 0,
              };

              this.p2pActiveRoom.players.push(newPlayer);
              this.hostDataConnections.set(newPlayer.id, conn);

              // Reply with ROOM_JOINED
              conn.send({
                type: 'ROOM_JOINED',
                roomConfig: this.p2pActiveRoom.config,
                players: this.p2pActiveRoom.players,
                selfId: newPlayer.id,
                serverInfo: {
                  localIp: this.p2pActiveRoom.config.roomId,
                  port: 443,
                  version: APEX_LAN_PROTOCOL_VERSION,
                },
              });

              // Broadcast updated lobby
              this.broadcastP2P({
                type: 'LOBBY_UPDATE',
                roomConfig: this.p2pActiveRoom.config,
                players: this.p2pActiveRoom.players,
              });

              this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
            } else if (msg.type === 'TOGGLE_READY') {
              if (remotePlayerId && this.p2pActiveRoom) {
                const target = this.p2pActiveRoom.players.find((p) => p.id === remotePlayerId);
                if (target) {
                  target.isReady = !!msg.isReady;
                  this.broadcastP2P({
                    type: 'LOBBY_UPDATE',
                    roomConfig: this.p2pActiveRoom.config,
                    players: this.p2pActiveRoom.players,
                  });
                  this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
                }
              }
            } else if (msg.type === 'UPDATE_PLAYER_INFO') {
              if (remotePlayerId && this.p2pActiveRoom) {
                const target = this.p2pActiveRoom.players.find((p) => p.id === remotePlayerId);
                if (target) {
                  if (msg.vehicleId) target.vehicleId = msg.vehicleId;
                  if (msg.vehicleName) target.vehicleName = msg.vehicleName;
                  if (msg.paintId) target.paintId = msg.paintId;
                  this.broadcastP2P({
                    type: 'LOBBY_UPDATE',
                    roomConfig: this.p2pActiveRoom.config,
                    players: this.p2pActiveRoom.players,
                  });
                  this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
                }
              }
            } else if (msg.type === 'CLIENT_INPUT_FRAME') {
              if (remotePlayerId) {
                this.emit('clientInputReceived', { ...msg, playerId: remotePlayerId });
              }
            } else if (msg.type === 'PING') {
              conn.send({ type: 'PONG', timestamp: msg.timestamp || Date.now() });
            }
          });

          conn.on('close', () => {
            if (remotePlayerId && this.p2pActiveRoom) {
              const idx = this.p2pActiveRoom.players.findIndex((p) => p.id === remotePlayerId);
              if (idx !== -1) {
                const removed = this.p2pActiveRoom.players[idx];
                this.p2pActiveRoom.players.splice(idx, 1);
                this.hostDataConnections.delete(remotePlayerId);
                this.broadcastP2P({
                  type: 'LOBBY_UPDATE',
                  roomConfig: this.p2pActiveRoom.config,
                  players: this.p2pActiveRoom.players,
                });
                this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
                this.emit('playerDisconnected', removed.id, removed.name);
              }
            }
          });
        });

        peer.on('error', (err: any) => {
          clearTimeout(timeout);
          if (err?.type === 'unavailable-id') {
            // Room ID collision: retry with a fresh code
            const freshCode = `APX-${Math.floor(1000 + Math.random() * 9000)}`;
            this.createP2PHostRoom(freshCode, roomConfig, player).then(resolve).catch(reject);
          } else {
            const msg = err?.message || 'WebRTC Host initialization error';
            this.setState('error', msg);
            reject(new Error(msg));
          }
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create P2P host room';
        this.setState('error', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  }

  private broadcastP2P(msg: any): void {
    const payload = JSON.stringify(msg);
    for (const conn of this.hostDataConnections.values()) {
      if (conn.open) {
        conn.send(payload);
      }
    }
  }

  public disconnect(): void {
    this.stopPingLoop();

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    // Close PeerJS & DataChannels
    if (this.clientConnection) {
      try {
        this.clientConnection.close();
      } catch {}
      this.clientConnection = null;
    }

    for (const conn of this.hostDataConnections.values()) {
      try {
        conn.close();
      } catch {}
    }
    this.hostDataConnections.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    this.p2pActiveRoom = null;
    this.selfId = null;
    this.isHost = false;
    this.setState('disconnected');
  }

  public send(msg: ClientMessage): void {
    const payload = JSON.stringify(msg);

    if (this.transportMode === 'websocket') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(payload);
      }
    } else {
      if (this.clientConnection && this.clientConnection.open) {
        this.clientConnection.send(payload);
      }
    }
  }

  public createRoom(
    roomConfig: Partial<RoomConfig>,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string }
  ): void {
    this.send({
      type: 'CREATE_ROOM',
      version: APEX_LAN_PROTOCOL_VERSION,
      roomConfig,
      player,
    });
  }

  public joinRoom(player: { name: string; vehicleId: string; vehicleName: string; paintId: string }): void {
    this.send({
      type: 'JOIN_ROOM',
      version: APEX_LAN_PROTOCOL_VERSION,
      player,
    });
  }

  public updateLobbyConfig(config: Partial<RoomConfig>): void {
    if (this.transportMode === 'p2p' && this.isHost && this.p2pActiveRoom) {
      Object.assign(this.p2pActiveRoom.config, config);
      this.broadcastP2P({
        type: 'LOBBY_UPDATE',
        roomConfig: this.p2pActiveRoom.config,
        players: this.p2pActiveRoom.players,
      });
      this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
    } else {
      this.send({
        type: 'UPDATE_LOBBY_CONFIG',
        config,
      });
    }
  }

  public updatePlayerInfo(info: { vehicleId?: string; vehicleName?: string; paintId?: string; name?: string }): void {
    if (this.transportMode === 'p2p' && this.isHost && this.p2pActiveRoom && this.selfId) {
      const hostP = this.p2pActiveRoom.players.find((p) => p.id === this.selfId);
      if (hostP) {
        if (info.vehicleId) hostP.vehicleId = info.vehicleId;
        if (info.vehicleName) hostP.vehicleName = info.vehicleName;
        if (info.paintId) hostP.paintId = info.paintId;
        this.broadcastP2P({
          type: 'LOBBY_UPDATE',
          roomConfig: this.p2pActiveRoom.config,
          players: this.p2pActiveRoom.players,
        });
        this.emit('lobbyUpdated', this.p2pActiveRoom.config, this.p2pActiveRoom.players);
      }
    } else {
      this.send({
        type: 'UPDATE_PLAYER_INFO',
        ...info,
      });
    }
  }

  public toggleReady(isReady: boolean): void {
    this.send({
      type: 'TOGGLE_READY',
      isReady,
    });
  }

  public startRace(): void {
    if (this.transportMode === 'p2p' && this.isHost && this.p2pActiveRoom) {
      const gridAssignments: Record<string, number> = {};
      this.p2pActiveRoom.players.forEach((p) => {
        gridAssignments[p.id] = p.gridSlot;
      });

      const maxPlayers = this.p2pActiveRoom.config.maxPlayers || 4;
      const fillWithAI = this.p2pActiveRoom.config.fillWithAI;
      const aiRacers: Array<{ id: string; name: string; vehicleId: string; vehicleName: string; paintId: string; gridSlot: number }> = [];

      if (fillWithAI) {
        const takenSlots = new Set(this.p2pActiveRoom.players.map((p) => p.gridSlot));
        const aiNames = ['AI Hunter', 'AI Viper', 'AI Phoenix', 'AI Ghost'];
        let aiCount = 1;
        for (let s = 1; s <= maxPlayers; s++) {
          if (!takenSlots.has(s)) {
            const aiId = `ai_grid_${s}`;
            gridAssignments[aiId] = s;
            aiRacers.push({
              id: aiId,
              name: aiNames[aiCount - 1] || `AI Rival ${s}`,
              vehicleId: 'bavaria_m4',
              vehicleName: 'BAVARIA M4 CS',
              paintId: 'monaco_blue',
              gridSlot: s,
            });
            aiCount++;
          }
        }
      }

      const raceStartingMsg = {
        type: 'RACE_STARTING' as const,
        trackId: this.p2pActiveRoom.config.trackId,
        raceMode: this.p2pActiveRoom.config.raceMode,
        lapCount: this.p2pActiveRoom.config.lapCount,
        countdownDuration: 3,
        gridAssignments,
        aiRacers,
      };

      this.broadcastP2P(raceStartingMsg);
      this.emit('raceStarting', raceStartingMsg);
    } else {
      this.send({
        type: 'START_RACE',
      });
    }
  }

  public sendInputFrame(
    seq: number,
    input: InputState,
    predicted: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      forwardSpeed: number;
      lateralSpeed: number;
      steeringAngle: number;
      wheelSpinAngle: number;
    }
  ): void {
    this.send({
      type: 'CLIENT_INPUT_FRAME',
      seq,
      timestamp: performance.now(),
      input,
      predicted,
    });
  }

  public sendHostWorldSnapshot(snapshot: WorldSnapshotMessage): void {
    if (this.transportMode === 'p2p' && this.isHost) {
      this.broadcastP2P(snapshot);
    } else {
      this.send({
        type: 'HOST_WORLD_SNAPSHOT',
        snapshot,
      });
    }
  }

  public sendHostRaceFinished(standings: MultiplayerRacerResult[]): void {
    if (this.transportMode === 'p2p' && this.isHost) {
      this.broadcastP2P({
        type: 'RACE_FINISHED',
        standings,
      });
      this.emit('raceFinished', standings);
    } else {
      this.send({
        type: 'HOST_RACE_FINISHED',
        standings,
      });
    }
  }

  public leaveRoom(): void {
    if (this.transportMode === 'websocket') {
      this.send({
        type: 'LEAVE_ROOM',
      });
    }
    this.disconnect();
  }

  private handleMessage(rawData: string | ArrayBuffer | any): void {
    try {
      const msg = typeof rawData === 'string'
        ? JSON.parse(rawData)
        : (rawData instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(rawData)) : rawData);

      switch (msg.type) {
        case 'ROOM_CREATED':
          this.selfId = msg.player.id;
          this.isHost = true;
          this.emit('roomCreated', msg.roomConfig, msg.player, msg.serverInfo);
          break;

        case 'ROOM_JOINED':
          this.selfId = msg.selfId;
          this.isHost = false;
          this.emit('roomJoined', msg.roomConfig, msg.players, msg.selfId, msg.serverInfo);
          break;

        case 'LOBBY_UPDATE':
          this.emit('lobbyUpdated', msg.roomConfig, msg.players);
          break;

        case 'RACE_STARTING':
          this.emit('raceStarting', msg);
          break;

        case 'WORLD_SNAPSHOT':
          this.emit('worldSnapshot', msg);
          break;

        case 'CLIENT_INPUT_FRAME':
          this.emit('clientInputReceived', msg);
          break;

        case 'RACE_FINISHED':
          this.emit('raceFinished', msg.standings);
          break;

        case 'PLAYER_DISCONNECTED':
          this.emit('playerDisconnected', msg.playerId, msg.playerName);
          break;

        case 'HOST_DISCONNECTED':
          this.emit('hostDisconnected', msg.message);
          this.disconnect();
          break;

        case 'ERROR':
          this.emit('error', msg.message);
          break;

        case 'PONG':
          if (this.lastPingSentTime > 0) {
            this.pingMs = Math.round(performance.now() - this.lastPingSentTime);
            this.emit('pingUpdated', this.pingMs);
          }
          break;
      }
    } catch (err) {
      console.warn('[NetworkClient] Failed to parse message:', err);
    }
  }

  private setState(state: NetworkConnectionState, error?: string): void {
    this.state = state;
    this.emit('stateChanged', state, error);
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingIntervalId = window.setInterval(() => {
      if (this.state === 'connected' && this.transportMode === 'websocket') {
        this.lastPingSentTime = performance.now();
        this.send({
          type: 'PING',
          timestamp: Date.now(),
        });
      }
    }, 2000);
  }

  private stopPingLoop(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
}
