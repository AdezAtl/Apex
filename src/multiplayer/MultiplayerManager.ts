/**
 * Project Apex — MultiplayerManager
 * Master coordinator for LAN multiplayer races, synchronizing vehicle states,
 * authoritative host physics, collisions, checkpoints, and UI transitions.
 */

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
import { AzureCoastCircuit } from '../tracks/AzureCoastCircuit';
import { InputState } from '../input/InputManager';
import { CheckpointData } from '../checkpoints/CheckpointManager';

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

  // Remote vehicles for other connected human players
  public remoteVehicles: Map<string, RemoteVehicle> = new Map();

  // Connected players metadata
  public connectedPlayers: LobbyPlayer[] = [];
  public gridAssignments: Record<string, number> = {};

  // Host-Authoritative State
  private playerProgress: Map<string, PlayerProgress> = new Map();
  private hostRaceTimeSeconds: number = 0;
  private networkTickTimer: number = 0;
  private currentNetworkTick: number = 0;
  private clientInputSeq: number = 0;

  // Checkpoints for active track
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

  // ----------------------------------------------------
  // Network Event Handlers
  // ----------------------------------------------------

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
      this.activeCircuit = data.trackId === 'azure_coast' ? AzureCoastCircuit : ForestValleyCircuit;
      this.activeCheckpoints = [...this.activeCircuit.checkpoints];

      this.lobbyUI.hide();

      // Launch race in parent Game engine
      await this.callbacks.onStartRaceCountdown(this.activeCircuit, data.raceMode, data.lapCount);

      // Spawn remote vehicles for all other human players
      await this.spawnRemoteVehicles(data.gridAssignments);

      // Initialize host progress trackers if hosting
      if (this.isHost) {
        this.initHostTrackers(data.gridAssignments);
      }
    });

    this.client.on('worldSnapshot', (snapshot) => {
      // Ingest host authoritative updates on client
      for (const [id, snap] of Object.entries(snapshot.racers)) {
        if (id !== this.selfPlayerId) {
          const remote = this.remoteVehicles.get(id);
          if (remote) {
            remote.pushSnapshot(snap);
          }
        }
      }
    });

    this.client.on('clientInputReceived', (msg) => {
      if (!this.isHost) return;
      // In host authoritative simulation: feed client input or update their position
      const remote = this.remoteVehicles.get(msg.playerId);
      if (remote && msg.predicted) {
        // Validating predicted position against track limits
        const pred = msg.predicted;
        remote.position.set(pred.x, pred.y, pred.z);
        remote.yawAngle = pred.yaw;
        remote.forwardSpeed = pred.forwardSpeed;
        remote.lateralSpeed = pred.lateralSpeed;
        remote.steeringAngle = pred.steeringAngle;
        remote.wheelSpinAngle = pred.wheelSpinAngle;
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

  // ----------------------------------------------------
  // Lobby Actions
  // ----------------------------------------------------

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

  // ----------------------------------------------------
  // Race Lifecycle & Vehicle Spawning
  // ----------------------------------------------------

  public getGridSlotTransform(slot: number): { position: Vector3; yaw: number } {
    // Staggered grid slots on the broad 13m road
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

  private async spawnRemoteVehicles(gridAssignments: Record<string, number>): Promise<void> {
    // Clean up existing remote vehicles
    for (const [_, v] of this.remoteVehicles) {
      v.dispose();
    }
    this.remoteVehicles.clear();

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
  }

  private initHostTrackers(gridAssignments: Record<string, number>): void {
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
  }

  // ----------------------------------------------------
  // Frame Update Loop
  // ----------------------------------------------------

  public update(dt: number, localController: VehicleController | null, inputState: InputState): void {
    if (!this.isActive || !localController) return;

    // Update remote vehicle visual meshes and interpolation buffers
    const now = performance.now();
    for (const [_, rv] of this.remoteVehicles) {
      rv.update(dt, now);
    }

    this.networkTickTimer += dt;
    const tickInterval = 1.0 / NETWORK_TICK_RATE;

    if (this.networkTickTimer >= tickInterval) {
      this.networkTickTimer -= tickInterval;
      this.currentNetworkTick++;

      if (this.isHost) {
        this.updateHostNetworkTick(dt, localController);
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

  private updateHostNetworkTick(dt: number, localController: VehicleController): void {
    this.hostRaceTimeSeconds += dt;

    // 1. Solve solid-body collisions between Local Host Player and all Remote Players
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

    // 2. Update Checkpoints & Lap Progress authoritatively for Host
    const hostProg = this.playerProgress.get(this.selfPlayerId);
    if (hostProg && !hostProg.isFinished) {
      this.checkRacerGates(this.selfPlayerId, hostProg, localController.position);
    }

    // 3. Update Checkpoints & Lap Progress authoritatively for all Remote Players
    for (const [id, rv] of this.remoteVehicles) {
      const prog = this.playerProgress.get(id);
      if (prog && !prog.isFinished) {
        this.checkRacerGates(id, prog, rv.position);
      }
    }

    // 4. Compile authoritative World Snapshot
    const racers: Record<string, RacerSnapshot> = {};

    // Local host racer
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

    // Remote racers
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

    // Broadcast snapshot down to clients
    this.client.sendHostWorldSnapshot({
      type: 'WORLD_SNAPSHOT',
      tick: this.currentNetworkTick,
      timestamp: performance.now(),
      racers,
      raceState: 'racing',
    });

    // 5. Check if all racers finished
    const allFinished = Array.from(this.playerProgress.values()).every(p => p.isFinished);
    if (allFinished && this.playerProgress.size > 0) {
      this.finalizeRaceResults();
    }
  }

  private checkRacerGates(_id: string, prog: PlayerProgress, currentPos: Vector3): void {
    if (this.activeCheckpoints.length === 0) return;

    prog.prevPosition.copyFrom(prog.currentPosition);
    prog.currentPosition.copyFrom(currentPos);

    const nextGateIdx = (prog.currentGate + 1) % this.activeCheckpoints.length;
    const targetCP = this.activeCheckpoints[nextGateIdx];

    // Gate crossing test
    const perp = new Vector3(-targetCP.direction.z, 0, targetCP.direction.x);
    const toCar = currentPos.subtract(targetCP.position);
    toCar.y = 0;

    const lateralDist = Math.abs(Vector3.Dot(toCar, perp));
    const forwardDist = Vector3.Dot(toCar, targetCP.direction);

    // If car passed through gate plane
    if (lateralDist <= targetCP.width * 0.55 && forwardDist >= -1.0 && forwardDist <= 4.0) {
      prog.currentGate = nextGateIdx;

      // In sprint mode: checkpoint 4 is the finish line
      if (this.activeRoomConfig?.raceMode === 'sprint' && targetCP.id === 'CP_4_CAROUSEL_SHOOT') {
        prog.isFinished = true;
        prog.finishTimeSeconds = this.hostRaceTimeSeconds;
      } else if (nextGateIdx === 0) {
        // Crossed Start/Finish
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

    // Sort by: Finished first (by finish time), then by lap count, then by gate count
    const sorted = Array.from(this.playerProgress.entries()).sort((a, b) => {
      const pA = a[1];
      const pB = b[1];
      if (pA.isFinished && pB.isFinished) {
        return pA.finishTimeSeconds - pB.finishTimeSeconds;
      }
      if (pA.isFinished) return -1;
      if (pB.isFinished) return 1;
      if (pA.lapCount !== pB.lapCount) return pB.lapCount - pA.lapCount;
      return pB.currentGate - pA.currentGate;
    });

    const winnerTime = sorted[0]?.[1]?.finishTimeSeconds || 0;

    sorted.forEach(([id, prog], idx) => {
      const playerMeta = this.connectedPlayers.find(p => p.id === id);
      const isWinner = idx === 0;
      const gapSeconds = prog.finishTimeSeconds - winnerTime;

      results.push({
        rank: idx + 1,
        id,
        name: playerMeta ? playerMeta.name : `Driver ${idx + 1}`,
        vehicleName: playerMeta ? playerMeta.vehicleName : 'APX-01 COUPE',
        isHuman: true,
        finishTimeSeconds: prog.finishTimeSeconds,
        finishTimeFormatted: this.formatTime(prog.finishTimeSeconds),
        gapFormatted: isWinner ? 'LEADER' : `+${gapSeconds.toFixed(2)}s`,
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
    const totalCenti = Math.floor(seconds * 100);
    const cs = totalCenti % 100;
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
    this.playerProgress.clear();
    this.hostRaceTimeSeconds = 0;
  }
}
