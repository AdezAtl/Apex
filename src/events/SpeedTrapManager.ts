import { SoundManager } from '../audio/SoundManager';

export interface SpeedTrapRecord {
  trapIndex: number;
  trapName: string;
  speedKmh: number;
  timestamp: number;
}

export interface SpeedTrapTelemetry {
  isActive: boolean;
  trapsCompleted: number;
  totalTraps: number;
  latestTrapSpeedKmh: number;
  highestTrapSpeedKmh: number;
  aggregateSpeedKmh: number;
  bannerMessage: string | null;
  bannerDuration: number;
}

export class SpeedTrapManager {
  private isActive: boolean = false;
  private soundManager: SoundManager;

  // Track checkpoint IDs designated as speed traps
  private trapCheckpointIds: string[] = [];
  private capturedTraps: Map<string, number> = new Map();
  private trapRecords: SpeedTrapRecord[] = [];

  private latestTrapSpeed: number = 0;
  private highestTrapSpeed: number = 0;
  private bannerMessage: string | null = null;
  private bannerDuration: number = 0;

  constructor(soundManager: SoundManager) {
    this.soundManager = soundManager;
  }

  public setCircuitTraps(circuitId: string): void {
    if (circuitId === 'akobo_highway') {
      this.trapCheckpointIds = [
        'AK_CP_3',
        'AK_CP_7',
        'AK_CP_10',
        'AK_CP_15',
      ];
    } else if (circuitId === 'eleyele_ring') {
      this.trapCheckpointIds = [
        'EY_CP_2',
        'EY_CP_6',
        'EY_CP_10',
      ];
    } else if (circuitId === 'savanna_ridge') {
      this.trapCheckpointIds = [
        'SR_CP_1_EAST_CHUTE',
        'SR_CP_4_WEST_RIDGE',
        'SR_CP_7_SOUTH_HIGHWAY_WEST',
        'SR_CP_8_SOUTH_HIGHWAY_MID',
      ];
    } else {
      // Default to Forest Valley
      this.trapCheckpointIds = [
        'CP_1_NORTH_ENTRY',
        'CP_5_BACK_STRAIGHT_LAUNCH',
        'CP_9_WEST_STRAIGHT_MID',
      ];
    }
  }

  public start(): void {
    this.isActive = true;
    this.capturedTraps.clear();
    this.trapRecords = [];
    this.latestTrapSpeed = 0;
    this.highestTrapSpeed = 0;
    this.bannerMessage = 'SPEED TRAP CHALLENGE // MAX ACCELERATION';
    this.bannerDuration = 3.5;
  }

  public reset(): void {
    this.isActive = false;
    this.capturedTraps.clear();
    this.trapRecords = [];
    this.latestTrapSpeed = 0;
    this.highestTrapSpeed = 0;
    this.bannerMessage = null;
    this.bannerDuration = 0;
  }

  public update(dt: number): void {
    if (this.bannerDuration > 0) {
      this.bannerDuration -= dt;
      if (this.bannerDuration <= 0) {
        this.bannerMessage = null;
      }
    }
  }

  /**
   * Called when the player crosses any checkpoint.
   */
  public onCheckpointCrossed(checkpointId: string, speedKmh: number): boolean {
    if (!this.isActive) return false;

    const trapIdx = this.trapCheckpointIds.indexOf(checkpointId);
    if (trapIdx === -1) return false;

    // Check if this trap was already triggered on this lap
    if (this.capturedTraps.has(checkpointId)) return false;

    const recordedSpeed = Math.round(speedKmh);
    this.capturedTraps.set(checkpointId, recordedSpeed);
    this.latestTrapSpeed = recordedSpeed;
    if (recordedSpeed > this.highestTrapSpeed) {
      this.highestTrapSpeed = recordedSpeed;
    }

    const record: SpeedTrapRecord = {
      trapIndex: trapIdx + 1,
      trapName: `RADAR TRAP ${trapIdx + 1}`,
      speedKmh: recordedSpeed,
      timestamp: performance.now(),
    };
    this.trapRecords.push(record);

    this.soundManager.playRadarFlash(recordedSpeed);
    this.bannerMessage = `RADAR TRAP ${trapIdx + 1} // ${recordedSpeed} KM/H!`;
    this.bannerDuration = 3.2;

    return true;
  }

  public getAggregateSpeed(): number {
    let sum = 0;
    for (const spd of this.capturedTraps.values()) {
      sum += spd;
    }
    return sum;
  }

  public isAllTrapsCompleted(): boolean {
    return this.capturedTraps.size >= this.trapCheckpointIds.length;
  }

  public getTelemetry(): SpeedTrapTelemetry {
    return {
      isActive: this.isActive,
      trapsCompleted: this.capturedTraps.size,
      totalTraps: this.trapCheckpointIds.length,
      latestTrapSpeedKmh: this.latestTrapSpeed,
      highestTrapSpeedKmh: this.highestTrapSpeed,
      aggregateSpeedKmh: this.getAggregateSpeed(),
      bannerMessage: this.bannerMessage,
      bannerDuration: this.bannerDuration,
    };
  }
}
