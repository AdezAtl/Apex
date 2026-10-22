/**
 * Project Apex — LAN Multiplayer Protocol & Message Types
 * Host-authoritative LAN networking architecture specifications.
 */

import { InputState } from '../input/InputManager';

export const APEX_LAN_PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_LAN_PORT = 5050;
export const MAX_LAN_PLAYERS = 4;
export const NETWORK_TICK_RATE = 30; // 30Hz network update frequency

export type RaceMode = 'time_trial' | 'sprint' | 'circuit';

export interface LobbyPlayer {
  id: string;
  name: string;
  isHost: boolean;
  vehicleId: string;
  vehicleName: string;
  paintId: string;
  isReady: boolean;
  gridSlot: number;
  pingMs: number;
  isAI?: boolean;
}

export interface RoomConfig {
  roomId: string;
  hostName: string;
  trackId: string;
  trackName: string;
  raceMode: RaceMode;
  maxPlayers: number;
  fillWithAI: boolean;
  lapCount: number;
}

export interface ServerInfo {
  localIp: string;
  port: number;
  version: string;
}

// ----------------------------------------------------
// Telemetry & Snapshot Types
// ----------------------------------------------------

export interface RacerSnapshot {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  forwardSpeed: number;
  lateralSpeed: number;
  steeringAngle: number;
  wheelSpinAngle: number;
  currentLap: number;
  currentGate: number;
  isFinished: boolean;
  finishTimeSeconds: number;
}

export interface WorldSnapshotMessage {
  type: 'WORLD_SNAPSHOT';
  tick: number;
  timestamp: number;
  racers: Record<string, RacerSnapshot>;
  raceState: 'countdown' | 'racing' | 'finished';
}

export interface ClientInputMessage {
  type: 'CLIENT_INPUT_FRAME';
  seq: number;
  timestamp: number;
  input: InputState;
  // Client predicted transform for validation and smoothing
  predicted: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    forwardSpeed: number;
    lateralSpeed: number;
    steeringAngle: number;
    wheelSpinAngle: number;
  };
}

export interface MultiplayerRacerResult {
  rank: number;
  id: string;
  name: string;
  vehicleName: string;
  isHuman: boolean;
  finishTimeFormatted: string;
  finishTimeSeconds: number;
  gapFormatted: string;
  status: 'Finished' | 'DNF' | 'Disconnected';
}

// ----------------------------------------------------
// Protocol Messages: Client -> Server
// ----------------------------------------------------

export type ClientMessage =
  | {
      type: 'CREATE_ROOM';
      version: string;
      roomConfig: Partial<RoomConfig>;
      player: {
        name: string;
        vehicleId: string;
        vehicleName: string;
        paintId: string;
      };
    }
  | {
      type: 'JOIN_ROOM';
      version: string;
      roomId?: string;
      player: {
        name: string;
        vehicleId: string;
        vehicleName: string;
        paintId: string;
      };
    }
  | {
      type: 'UPDATE_LOBBY_CONFIG';
      config: Partial<RoomConfig>;
    }
  | {
      type: 'UPDATE_PLAYER_INFO';
      vehicleId?: string;
      vehicleName?: string;
      paintId?: string;
      name?: string;
    }
  | {
      type: 'TOGGLE_READY';
      isReady: boolean;
    }
  | {
      type: 'START_RACE';
    }
  | ClientInputMessage
  | {
      type: 'PING';
      timestamp: number;
    }
  | {
      type: 'LEAVE_ROOM';
    }
  | {
      // Host authoritative updates relayed via server
      type: 'HOST_WORLD_SNAPSHOT';
      snapshot: WorldSnapshotMessage;
    }
  | {
      type: 'HOST_RACE_FINISHED';
      standings: MultiplayerRacerResult[];
    };

// ----------------------------------------------------
// Protocol Messages: Server -> Client
// ----------------------------------------------------

export type ServerMessage =
  | {
      type: 'ROOM_CREATED';
      roomConfig: RoomConfig;
      player: LobbyPlayer;
      serverInfo: ServerInfo;
    }
  | {
      type: 'ROOM_JOINED';
      roomConfig: RoomConfig;
      players: LobbyPlayer[];
      selfId: string;
      serverInfo: ServerInfo;
    }
  | {
      type: 'LOBBY_UPDATE';
      roomConfig: RoomConfig;
      players: LobbyPlayer[];
    }
  | {
      type: 'RACE_STARTING';
      trackId: string;
      raceMode: RaceMode;
      lapCount: number;
      countdownDuration: number;
      gridAssignments: Record<string, number>; // playerId -> gridSlot (1-4)
      aiRacers: Array<{
        id: string;
        name: string;
        vehicleId: string;
        vehicleName: string;
        paintId: string;
        gridSlot: number;
      }>;
    }
  | WorldSnapshotMessage
  | {
      type: 'RACE_FINISHED';
      standings: MultiplayerRacerResult[];
    }
  | (ClientInputMessage & { playerId: string })
  | {
      type: 'PLAYER_DISCONNECTED';
      playerId: string;
      playerName: string;
    }
  | {
      type: 'HOST_DISCONNECTED';
      message: string;
    }
  | {
      type: 'ERROR';
      message: string;
      code?: string;
    }
  | {
      type: 'PONG';
      timestamp: number;
    };
