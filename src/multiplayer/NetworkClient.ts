/**
 * Project Apex — NetworkClient
 * Robust client-side WebSocket manager for LAN multiplayer communication.
 */

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
  private ws: WebSocket | null = null;
  public state: NetworkConnectionState = 'disconnected';
  public selfId: string | null = null;
  public isHost: boolean = false;
  public pingMs: number = 0;

  private pingIntervalId: number | null = null;
  private lastPingSentTime: number = 0;

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
    this.listeners[event] = (this.listeners[event]! as any[]).filter(h => h !== handler);
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
   * Connects to a LAN Host via WebSocket.
   * e.g., "192.168.1.100:5050" or "localhost:5050"
   */
  public async connect(hostAddress: string): Promise<void> {
    this.disconnect();

    this.setState('connecting');

    let cleanAddr = hostAddress.trim();
    if (!cleanAddr.includes('://')) {
      cleanAddr = `ws://${cleanAddr}`;
    }
    if (!cleanAddr.includes(':', 6)) {
      cleanAddr = `${cleanAddr}:5050`;
    }

    return new Promise((resolve, reject) => {
      try {
        const socket = new WebSocket(cleanAddr);
        this.ws = socket;

        const timeout = setTimeout(() => {
          if (this.state === 'connecting') {
            socket.close();
            const err = `Connection to ${cleanAddr} timed out. Make sure host is running and reachable.`;
            this.setState('error', err);
            reject(new Error(err));
          }
        }, 6000);

        socket.onopen = () => {
          clearTimeout(timeout);
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
          this.setState('disconnected');
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          this.stopPingLoop();
          const err = `Failed to connect to LAN server at ${cleanAddr}`;
          this.setState('error', err);
          reject(new Error(err));
        };
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error) ? err.message : 'Invalid connection address';
        this.setState('error', errorMsg);
        reject(new Error(errorMsg));
      }
    });
  }

  public disconnect(): void {
    this.stopPingLoop();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.selfId = null;
    this.isHost = false;
    this.setState('disconnected');
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
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

  public joinRoom(
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string }
  ): void {
    this.send({
      type: 'JOIN_ROOM',
      version: APEX_LAN_PROTOCOL_VERSION,
      player,
    });
  }

  public updateLobbyConfig(config: Partial<RoomConfig>): void {
    this.send({
      type: 'UPDATE_LOBBY_CONFIG',
      config,
    });
  }

  public updatePlayerInfo(info: { vehicleId?: string; vehicleName?: string; paintId?: string; name?: string }): void {
    this.send({
      type: 'UPDATE_PLAYER_INFO',
      ...info,
    });
  }

  public toggleReady(isReady: boolean): void {
    this.send({
      type: 'TOGGLE_READY',
      isReady,
    });
  }

  public startRace(): void {
    this.send({
      type: 'START_RACE',
    });
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
    this.send({
      type: 'HOST_WORLD_SNAPSHOT',
      snapshot,
    });
  }

  public sendHostRaceFinished(standings: MultiplayerRacerResult[]): void {
    this.send({
      type: 'HOST_RACE_FINISHED',
      standings,
    });
  }

  public leaveRoom(): void {
    this.send({
      type: 'LEAVE_ROOM',
    });
    this.disconnect();
  }

  private handleMessage(rawData: string | ArrayBuffer): void {
    try {
      const msg = JSON.parse(typeof rawData === 'string' ? rawData : new TextDecoder().decode(rawData)) as ServerMessage & Record<string, any>;

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
      console.warn('[NetworkClient] Failed to parse server message:', err);
    }
  }

  private setState(state: NetworkConnectionState, error?: string): void {
    this.state = state;
    this.emit('stateChanged', state, error);
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingIntervalId = window.setInterval(() => {
      if (this.state === 'connected') {
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
