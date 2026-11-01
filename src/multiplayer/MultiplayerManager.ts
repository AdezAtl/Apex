import { Scene, Vector3 } from '@babylonjs/core';
import { NetworkClient } from './NetworkClient';
import { RemoteVehicle } from './RemoteVehicle';
import { MultiplayerLobbyUI } from './MultiplayerLobbyUI';
import { MultiplayerResultsUI } from './MultiplayerResultsUI';
import {
  RoomConfig,
  LobbyPlayer,
  RacerSnapshot,
  MultiplayerRacerResult,
  NETWORK_TICK_RATE,
  RaceMode,
} from './MultiplayerTypes';
import { VehicleController } from '../vehicle/VehicleController';
import { VehicleCollision } from '../physics/VehicleCollision';
import { CircuitDefinition } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';
import { getCircuitById } from '../tracks/TrackRegistry';
import { InputState } from '../input/InputManager';
import { CheckpointData } from '../checkpoints/CheckpointManager';
import { AIOpponent } from '../ai/AIOpponent';
import { WaypointManager } from '../ai/WaypointManager';

export interface MultiplayerManagerCallbacks {
  onStartRaceCountdown: (circuit: CircuitDefinition, mode: RaceMode, lapCount: number) => Promise<void>;
  onRaceFinished: () => void;
  onReturnToMainMenu: () => void;
  triggerSound: (soundName: 'click' | 'select' | 'start' | 'finish') => void;
}

interface PlayerProgress {
  currentGate: number;
  lapCount: number;
  isFinished: boolean;
  finishTimeSeconds: number;
  prevPosition: Vector3;
  currentPosition: Vector3;
}

export class MultiplayerManager {
  private scene: Scene;
  private callbacks: MultiplayerManagerCallbacks;

  public client: NetworkClient;
  public lobbyUI: MultiplayerLobbyUI;
  public resultsUI: MultiplayerResultsUI;

  public isActive: boolean = false;
  public isHost: boolean = false;
  public selfPlayerId: string = '';
  public activeRoomConfig: RoomConfig | null = null;
  public activeCircuit: CircuitDefinition = ForestValleyCircuit;

  // Remote vehicles (both remote human players AND client-side rendered AI)
  public remoteVehicles: Map<string, RemoteVehicle> = new Map();
  // Host-only simulated AI instances for empty LAN grid slots
  private hostAiOpponents: Map<string, AIOpponent> = new Map();
  private hostWaypointManager: WaypointManager = new WaypointManager();

  public connectedPlayers: LobbyPlayer[] = [];
  public gridAssignments: Record<string, number> = {};

  private playerProgress: Map<string, PlayerProgress> = new Map();
  private hostRaceTimeSeconds: number = 0;
  private networkTickTimer: number = 0;
  private currentNetworkTick: number = 0;
  private clientInputSeq: number = 0;
  private activeCheckpoints: CheckpointData[] = [];

  constructor(scene: Scene, callbacks: MultiplayerManagerCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;

    this.client = new NetworkClient();
    this.lobbyUI = new MultiplayerLobbyUI({
      onHost: this.handleHostRoom.bind(this),
      onJoin: this.handleJoinRoom.bind(this),
      onUpdateConfig: this.handleUpdateConfig.bind(this),
      onUpdatePlayer: this.handleUpdatePlayer.bind(this),
      onToggleReady: this.handleToggleReady.bind(this),
      onStartRace: this.handleStartRace.bind(this),
      onLeave: this.handleLeave.bind(this),
    });

    this.resultsUI = new MultiplayerResultsUI({
      onReturnToLobby: this.handleReturnToLobby.bind(this),
      onReturnToMenu: this.handleReturnToMenu.bind(this),
    });

    this.bindNetworkEvents();
  }

  public openMultiplayerMenu(): void {
    this.isActive = true;
    this.lobbyUI.show();
  }

  public close(): void {
    this.cleanupRace();
    this.client.leaveRoom();
    this.lobbyUI.hide();
    this.resultsUI.hide();
    this.isActive = false;
  }

  private bindNetworkEvents(): void {
    this.client.on('stateChanged', (state, error) => {
      if (state === 'error') {
        this.lobbyUI.setStatus(error || 'Network error encountered', 'error');
      } else if (state === 'disconnected' && this.isActive) {
        this.lobbyUI.setStatus('Disconnected from server. Ensure LAN server is running on port 5050.', 'error');
      }
    });

    this.client.on('roomCreated', (config, player, serverInfo) => {
      this.isHost = true;
      this.selfPlayerId = player.id;
      this.activeRoomConfig = config;
      this.connectedPlayers = [player];
      this.lobbyUI.setStatus('LAN Room Created! Share your IP with other racers.', 'success');
      this.lobbyUI.setInLobby(config, [player], player.id, true, serverInfo);
    });

    this.client.on('roomJoined', (config, players, selfId, serverInfo) => {
      this.isHost = false;
      this.selfPlayerId = selfId;
      this.activeRoomConfig = config;
      this.connectedPlayers = players;
      this.lobbyUI.setStatus('Connected to Host! Waiting for race start.', 'success');
      this.lobbyUI.setInLobby(config, players, selfId, false, serverInfo);
    });

    this.client.on('lobbyUpdated', (config, players) => {
      this.activeRoomConfig = config;
      this.connectedPlayers = players;
      this.lobbyUI.updateLobbyState(config, players);
    });

    this.client.on('raceStarting', async (data) => {
      this.gridAssignments = data.gridAssignments;
      this.activeCircuit = getCircuitById(data.trackId);
      this.activeCheckpoints = [...this.activeCircuit.checkpoints];
      this.hostWaypointManager.setCircuit(this.activeCircuit);

      this.lobbyUI.hide();

      await this.callbacks.onStartRaceCountdown(this.activeCircuit, data.raceMode, data.lapCount);

      await this.spawnRemoteVehicles(data.gridAssignments, data.aiRacers || []);

      if (this.isHost) {
        this.initHostTrackers(data.gridAssignments, data.aiRacers || []);
      }
    });

    this.client.on('worldSnapshot', (snapshot) => {
      const now = performance.now();
      for (const [id, snap] of Object.entries(snapshot.racers)) {
        if (id !== this.selfPlayerId) {
          const remote = this.remoteVehicles.get(id);
          if (remote) {
            remote.pushSnapshot(snap, now);
          }
        }
      }
    });

    this.client.on('clientInputReceived', (msg) => {
      if (!this.isHost) return;
      const remote = this.remoteVehicles.get(msg.playerId);
      if (remote && msg.predicted) {
        const pred = msg.predicted;
        const prog = this.playerProgress.get(msg.playerId);
        // Push into RemoteVehicle's interpolation buffer so Host smoothly renders Client cars!
        remote.pushSnapshot({
          id: msg.playerId,
          x: pred.x,
          y: pred.y,
          z: pred.z,
          yaw: pred.yaw,
          vx: Math.sin(pred.yaw) * pred.forwardSpeed,
          vz: Math.cos(pred.yaw) * pred.forwardSpeed,
          forwardSpeed: pred.forwardSpeed,
          lateralSpeed: pred.lateralSpeed,
          steeringAngle: pred.steeringAngle,
          wheelSpinAngle: pred.wheelSpinAngle,
          currentLap: (prog?.lapCount || 0) + 1,
          currentGate: prog?.currentGate || 0,
          isFinished: prog?.isFinished || false,
          finishTimeSeconds: prog?.finishTimeSeconds || 0,
        }, performance.now());
      }
    });

    this.client.on('raceFinished', (standings) => {
      this.resultsUI.show(standings, this.selfPlayerId);
      this.callbacks.onRaceFinished();
    });

    this.client.on('playerDisconnected', (playerId, playerName) => {
      const remote = this.remoteVehicles.get(playerId);
      if (remote) {
        remote.dispose();
        this.remoteVehicles.delete(playerId);
      }
      this.playerProgress.delete(playerId);
      this.lobbyUI.setStatus(`${playerName} disconnected.`, 'info');
    });

    this.client.on('hostDisconnected', (msg) => {
      this.cleanupRace();
      this.resultsUI.hide();
      this.lobbyUI.show();
      this.lobbyUI.setStatus(msg || 'Host disconnected.', 'error');
    });

    this.client.on('error', (err) => {
      this.lobbyUI.setStatus(err, 'error');
    });
  }

  private async handleHostRoom(
    roomConfig: Partial<RoomConfig>,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string },
    hostAddress: string
  ): Promise<void> {
    try {
      await this.client.connect(hostAddress);
      this.client.createRoom(roomConfig, player);
    } catch (err: any) {
      this.lobbyUI.setStatus(err.message || 'Failed to start LAN host server', 'error');
    }
  }

  private async handleJoinRoom(
    hostAddress: string,
    player: { name: string; vehicleId: string; vehicleName: string; paintId: string }
  ): Promise<void> {
    try {
      await this.client.connect(hostAddress);
      this.client.joinRoom(player);
    } catch (err: any) {
      this.lobbyUI.setStatus(err.message || 'Failed to reach LAN host', 'error');
    }
  }

  private handleUpdateConfig(config: Partial<RoomConfig>): void {
    this.client.updateLobbyConfig(config);
  }

  private handleUpdatePlayer(info: { vehicleId?: string; vehicleName?: string; paintId?: string }): void {
    this.client.updatePlayerInfo(info);
  }

  private handleToggleReady(isReady: boolean): void {
    this.client.toggleReady(isReady);
  }

  private handleStartRace(): void {
    this.client.startRace();
  }

  private handleLeave(): void {
    this.close();
    this.callbacks.onReturnToMainMenu();
  }

  private handleReturnToLobby(): void {
    this.resultsUI.hide();
    this.cleanupRace();
    this.lobbyUI.show();
    if (this.activeRoomConfig) {
      this.lobbyUI.updateLobbyState(this.activeRoomConfig, this.connectedPlayers);
    }
  }

  private handleReturnToMenu(): void {
    this.close();
    this.callbacks.onReturnToMainMenu();
  }

  public getGridSlotTransform(slot: number): { position: Vector3; yaw: number } {
    switch (slot) {
      case 1:
        return { position: new Vector3(-2.8, 0.05, 14.0), yaw: 0 };
      case 2:
        return { position: new Vector3(2.8, 0.05, 6.0), yaw: 0 };
      case 3:
        return { position: new Vector3(-2.8, 0.05, -2.0), yaw: 0 };
      case 4:
      default:
        return { position: new Vector3(2.8, 0.05, -10.0), yaw: 0 };
    }
  }

  private async spawnRemoteVehicles(
    gridAssignments: Record<string, number>,
    aiRacers: Array<{ id: string; name: string; vehicleId: string; vehicleName: string; paintId: string; gridSlot: number }>
  ): Promise<void> {
    this.cleanupRace();

    // 1. Spawn remote human vehicles
    for (const player of this.connectedPlayers) {
      if (player.id === this.selfPlayerId) continue;

      const slot = gridAssignments[player.id] || 2;
      const tf = this.getGridSlotTransform(slot);

      const remote = new RemoteVehicle(
        this.scene,
        player.id,
        player.name,
        player.vehicleId,
        player.paintId,
        player.isHost
      );

      this.remoteVehicles.set(player.id, remote);
      await remote.load(tf.position, tf.yaw);
    }

    // 2. Spawn AI vehicles if fillWithAI is enabled
    for (const ai of aiRacers) {
      const tf = this.getGridSlotTransform(ai.gridSlot);
      if (this.isHost) {
        // Host simulates the AI physics and broadcasts them in WORLD_SNAPSHOT
        const aiOpp = new AIOpponent(this.scene, {
          id: ai.id,
          name: ai.name,
          paintId: ai.paintId,
          gridSlot: ai.gridSlot,
          gridPosition: tf.position,
          gridYaw: tf.yaw,
          difficulty: 'pro',
          vehicleId: ai.vehicleId,
        });
        await aiOpp.load();
        aiOpp.resetToGrid();
        this.hostAiOpponents.set(ai.id, aiOpp);
      } else {
        // Clients render AI as interpolated RemoteVehicles driven by Host snapshots
        const remoteAi = new RemoteVehicle(
          this.scene,
          ai.id,
          ai.name,
          ai.vehicleId,
          ai.paintId,
          false
        );
        this.remoteVehicles.set(ai.id, remoteAi);
        await remoteAi.load(tf.position, tf.yaw);
      }
    }
  }

  private initHostTrackers(
    gridAssignments: Record<string, number>,
    aiRacers: Array<{ id: string; name: string; vehicleId: string; vehicleName: string; paintId: string; gridSlot: number }>
  ): void {
    this.playerProgress.clear();
    this.hostRaceTimeSeconds = 0;

    for (const player of this.connectedPlayers) {
      const slot = gridAssignments[player.id] || 1;
      const tf = this.getGridSlotTransform(slot);
      this.playerProgress.set(player.id, {
        currentGate: 0,
        lapCount: 0,
        isFinished: false,
        finishTimeSeconds: 0,
        prevPosition: tf.position.clone(),
        currentPosition: tf.position.clone(),
      });
    }

    for (const ai of aiRacers) {
      const tf = this.getGridSlotTransform(ai.gridSlot);
      this.playerProgress.set(ai.id, {
        currentGate: 0,
        lapCount: 0,
        isFinished: false,
        finishTimeSeconds: 0,
        prevPosition: tf.position.clone(),
        currentPosition: tf.position.clone(),
      });
    }
  }

  public update(
    dt: number,
    localController: VehicleController | null,
    inputState: InputState,
    isRacing: boolean = true
  ): void {
    if (!this.isActive || !localController) return;

    const now = performance.now();
    for (const [_, rv] of this.remoteVehicles) {
      rv.update(dt, now);
    }

    // Update Host-controlled AI bots during active racing
    if (this.isHost) {
      const allCarPositions: { position: Vector3; forwardSpeed: number }[] = [
        { position: localController.position, forwardSpeed: localController.forwardSpeed },
      ];
      for (const [_, rv] of this.remoteVehicles) {
        allCarPositions.push({ position: rv.position, forwardSpeed: rv.forwardSpeed });
      }
      for (const [_, ai] of this.hostAiOpponents) {
        if (isRacing) {
          ai.update(dt, this.hostWaypointManager, allCarPositions);
        } else {
          ai.updateVisuals(dt);
        }
      }
    }

    this.networkTickTimer += dt;
    const tickInterval = 1.0 / NETWORK_TICK_RATE;

    if (this.networkTickTimer >= tickInterval) {
      this.networkTickTimer -= tickInterval;
      this.currentNetworkTick++;

      if (this.isHost) {
        this.updateHostNetworkTick(tickInterval, localController, isRacing);
      } else {
        this.updateClientNetworkTick(localController, inputState);
      }
    }
  }

  private updateClientNetworkTick(localController: VehicleController, inputState: InputState): void {
    this.clientInputSeq++;
    this.client.sendInputFrame(this.clientInputSeq, inputState, {
      x: localController.position.x,
      y: localController.position.y,
      z: localController.position.z,
      yaw: localController.yawAngle,
      forwardSpeed: localController.forwardSpeed,
      lateralSpeed: localController.lateralSpeed,
      steeringAngle: localController.steeringAngle,
      wheelSpinAngle: localController.wheelSpinAngle,
    });
  }

  private updateHostNetworkTick(tickDt: number, localController: VehicleController, isRacing: boolean): void {
    if (isRacing) {
      this.hostRaceTimeSeconds += tickDt;
    }

    // 1. Solid-body collisions between Host Player and Remote Human Players
    for (const [_, rv] of this.remoteVehicles) {
      if (!rv.isLoaded) continue;

      const hit = VehicleCollision.resolvePair(
        localController.position,
        localController.yawAngle,
        localController.forwardSpeed,
        localController.lateralSpeed,
        localController.speedScale,
        rv.position,
        rv.yawAngle,
        rv.forwardSpeed,
        rv.lateralSpeed,
        localController.speedScale
      );

      if (hit) {
        localController.position.x = hit.posA.x;
        localController.position.z = hit.posA.z;
        localController.forwardSpeed = hit.newForwardSpeedA;
        localController.lateralSpeed = hit.newLateralSpeedA;
        localController.yawRate += hit.torqueA;

        rv.position.x = hit.posB.x;
        rv.position.z = hit.posB.z;
        rv.forwardSpeed = hit.newForwardSpeedB;
        rv.lateralSpeed = hit.newLateralSpeedB;
      }
    }

    // 2. Update Checkpoints & Lap Progress
    if (isRacing) {
      const hostProg = this.playerProgress.get(this.selfPlayerId);
      if (hostProg && !hostProg.isFinished) {
        this.checkRacerGates(this.selfPlayerId, hostProg, localController.position);
      }

      for (const [id, rv] of this.remoteVehicles) {
        const prog = this.playerProgress.get(id);
        if (prog && !prog.isFinished) {
          this.checkRacerGates(id, prog, rv.position);
        }
      }

      for (const [id, ai] of this.hostAiOpponents) {
        const prog = this.playerProgress.get(id);
        if (prog && !prog.isFinished) {
          this.checkRacerGates(id, prog, ai.position);
          if (prog.isFinished) ai.isFinished = true;
        }
      }
    }

    // 3. Compile authoritative World Snapshot (Humans + AI)
    const racers: Record<string, RacerSnapshot> = {};

    const hProg = this.playerProgress.get(this.selfPlayerId);
    racers[this.selfPlayerId] = {
      id: this.selfPlayerId,
      x: localController.position.x,
      y: localController.position.y,
      z: localController.position.z,
      yaw: localController.yawAngle,
      vx: Math.sin(localController.yawAngle) * localController.forwardSpeed,
      vz: Math.cos(localController.yawAngle) * localController.forwardSpeed,
      forwardSpeed: localController.forwardSpeed,
      lateralSpeed: localController.lateralSpeed,
      steeringAngle: localController.steeringAngle,
      wheelSpinAngle: localController.wheelSpinAngle,
      currentLap: (hProg?.lapCount || 0) + 1,
      currentGate: hProg?.currentGate || 0,
      isFinished: hProg?.isFinished || false,
      finishTimeSeconds: hProg?.finishTimeSeconds || 0,
    };

    for (const [id, rv] of this.remoteVehicles) {
      const rProg = this.playerProgress.get(id);
      racers[id] = {
        id,
        x: rv.position.x,
        y: rv.position.y,
        z: rv.position.z,
        yaw: rv.yawAngle,
        vx: Math.sin(rv.yawAngle) * rv.forwardSpeed,
        vz: Math.cos(rv.yawAngle) * rv.forwardSpeed,
        forwardSpeed: rv.forwardSpeed,
        lateralSpeed: rv.lateralSpeed,
        steeringAngle: rv.steeringAngle,
        wheelSpinAngle: rv.wheelSpinAngle,
        currentLap: (rProg?.lapCount || 0) + 1,
        currentGate: rProg?.currentGate || 0,
        isFinished: rProg?.isFinished || false,
        finishTimeSeconds: rProg?.finishTimeSeconds || 0,
      };
    }

    for (const [id, ai] of this.hostAiOpponents) {
      const aProg = this.playerProgress.get(id);
      racers[id] = {
        id,
        x: ai.position.x,
        y: ai.position.y,
        z: ai.position.z,
        yaw: ai.yawAngle,
        vx: Math.sin(ai.yawAngle) * ai.forwardSpeed,
        vz: Math.cos(ai.yawAngle) * ai.forwardSpeed,
        forwardSpeed: ai.forwardSpeed,
        lateralSpeed: ai.lateralSpeed,
        steeringAngle: ai.steeringAngle,
        wheelSpinAngle: ai.wheelSpinAngle,
        currentLap: (aProg?.lapCount || 0) + 1,
        currentGate: aProg?.currentGate || 0,
        isFinished: aProg?.isFinished || false,
        finishTimeSeconds: aProg?.finishTimeSeconds || 0,
      };
    }

    this.client.sendHostWorldSnapshot({
      type: 'WORLD_SNAPSHOT',
      tick: this.currentNetworkTick,
      timestamp: performance.now(),
      racers,
      raceState: isRacing ? 'racing' : 'countdown',
    });

    // 4. Finish race when all human players have finished
    const humanIds = this.connectedPlayers.map(p => p.id);
    const allHumansFinished = humanIds.length > 0 && humanIds.every(id => this.playerProgress.get(id)?.isFinished);
    if (allHumansFinished) {
      this.finalizeRaceResults();
    }
  }

  private checkRacerGates(_id: string, prog: PlayerProgress, currentPos: Vector3): void {
    if (this.activeCheckpoints.length === 0) return;

    prog.prevPosition.copyFrom(prog.currentPosition);
    prog.currentPosition.copyFrom(currentPos);

    const nextGateIdx = (prog.currentGate + 1) % this.activeCheckpoints.length;
    const targetCP = this.activeCheckpoints[nextGateIdx];

    const perp = new Vector3(-targetCP.direction.z, 0, targetCP.direction.x);
    const toCar = currentPos.subtract(targetCP.position);
    toCar.y = 0;

    const lateralDist = Math.abs(Vector3.Dot(toCar, perp));
    const forwardDist = Vector3.Dot(toCar, targetCP.direction);

    if (lateralDist <= targetCP.width * 0.65 && forwardDist >= -2.5 && forwardDist <= 5.5) {
      prog.currentGate = nextGateIdx;

      if (this.activeRoomConfig?.raceMode === 'sprint' && targetCP.id === 'CP_4_CAROUSEL_SHOOT') {
        prog.isFinished = true;
        prog.finishTimeSeconds = this.hostRaceTimeSeconds;
      } else if (nextGateIdx === 0) {
        prog.lapCount++;
        const targetLaps = this.activeRoomConfig?.lapCount || 1;
        if (prog.lapCount >= targetLaps) {
          prog.isFinished = true;
          prog.finishTimeSeconds = this.hostRaceTimeSeconds;
        }
      }
    }
  }

  private finalizeRaceResults(): void {
    const results: MultiplayerRacerResult[] = [];

    const sorted = Array.from(this.playerProgress.entries()).sort((a, b) => {
      const pA = a[1];
      const pB = b[1];
      if (pA.isFinished && pB.isFinished) return pA.finishTimeSeconds - pB.finishTimeSeconds;
      if (pA.isFinished) return -1;
      if (pB.isFinished) return 1;
      if (pA.lapCount !== pB.lapCount) return pB.lapCount - pA.lapCount;
      return pB.currentGate - pA.currentGate;
    });

    const winnerTime = sorted[0]?.[1]?.finishTimeSeconds || 0;

    sorted.forEach(([id, prog], idx) => {
      const playerMeta = this.connectedPlayers.find(p => p.id === id);
      const aiMeta = this.hostAiOpponents.get(id);
      const isWinner = idx === 0;
      const gapSeconds = prog.isFinished ? prog.finishTimeSeconds - winnerTime : 0;

      results.push({
        rank: idx + 1,
        id,
        name: playerMeta ? playerMeta.name : aiMeta ? aiMeta.name : `Driver ${idx + 1}`,
        vehicleName: playerMeta ? playerMeta.vehicleName : aiMeta ? aiMeta.profile.name : 'APX-01 COUPE',
        isHuman: Boolean(playerMeta),
        finishTimeSeconds: prog.finishTimeSeconds,
        finishTimeFormatted: prog.isFinished ? this.formatTime(prog.finishTimeSeconds) : '--:--.--',
        gapFormatted: isWinner ? 'LEADER' : prog.isFinished ? `+${gapSeconds.toFixed(2)}s` : 'DNF',
        status: prog.isFinished ? 'Finished' : 'DNF',
      });
    });

    this.client.sendHostRaceFinished(results);
    this.resultsUI.show(results, this.selfPlayerId);
    this.callbacks.onRaceFinished();
  }

  private formatTime(seconds: number): string {
    if (!seconds || seconds <= 0) return '00:00.00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds * 100) % 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  }

  public getPing(): number {
    return this.client.pingMs;
  }

  public getCurrentTick(): number {
    return this.currentNetworkTick;
  }

  public cleanupRace(): void {
    for (const [_, v] of this.remoteVehicles) {
      v.dispose();
    }
    this.remoteVehicles.clear();
    for (const [_, ai] of this.hostAiOpponents) {
      ai.dispose();
    }
    this.hostAiOpponents.clear();
    this.playerProgress.clear();
    this.hostRaceTimeSeconds = 0;
  }
}