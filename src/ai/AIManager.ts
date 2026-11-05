import { Scene, Vector3 } from '@babylonjs/core';
import { AIOpponent, AIDifficulty, AIOpponentConfig } from './AIOpponent';
import { WaypointManager } from './WaypointManager';
import { RaceEventConfig } from '../events/EventConfig';
import { VehicleController } from '../vehicle/VehicleController';
import { getPaintOptionById } from '../vehicle/PaintCustomization';
import { CircuitDefinition } from '../tracks/TrackConfig';

export interface RacerStanding {
  rank: number;
  id: string;
  name: string;
  isPlayer: boolean;
  totalDistance: number;
  speedKmh: number;
  paintHex: string;
  isFinished: boolean;
  finishTime: number;
}

export interface PlayerRankInfo {
  rank: number;
  totalRacers: number;
  rankFormatted: string; // "1ST", "2ND", "3RD", "4TH"
  rankDisplay: string;   // "1st / 4"
  aheadGapMeters: number;
  behindGapMeters: number;
}

export interface FinishedRacerRecord {
  id: string;
  name: string;
  isPlayer: boolean;
  finishTime: number;
  rank: number;
}

export class AIManager {
  private scene: Scene;
  public waypointManager: WaypointManager;
  public opponents: AIOpponent[] = [];
  public isEnabled: boolean = false;
  public isRacing: boolean = false;
  public difficulty: AIDifficulty = 'normal';
  public currentCircuit: CircuitDefinition | null = null;
  public finishedRacers: FinishedRacerRecord[] = [];

  // Configured AI grid setup for the 3 opponents (staggered ahead of player in P4)
  private static readonly AI_CONFIGS: AIOpponentConfig[] = [
    {
      id: 'ai_1',
      name: 'APX ROSSO',
      paintId: 'racing_red',
      gridSlot: 1,
      gridPosition: new Vector3(-1.8, 0.05, 14.0),
      gridYaw: 0,
      driverPace: 1.00,
      personalityType: 'aggressor',
      launchDelaySeconds: 0.06,
      vehicleId: 'bmw_m3',
    },
    {
      id: 'ai_2',
      name: 'APX BILLET',
      paintId: 'metallic_silver',
      gridSlot: 2,
      gridPosition: new Vector3(1.8, 0.05, 6.0),
      gridYaw: 0,
      driverPace: 0.98,
      personalityType: 'technician',
      launchDelaySeconds: 0.14,
      vehicleId: 'toyota_supra',
    },
    {
      id: 'ai_3',
      name: 'APX OBSIDIAN',
      paintId: 'gloss_black',
      gridSlot: 3,
      gridPosition: new Vector3(-1.8, 0.05, -2.0),
      gridYaw: 0,
      driverPace: 0.95,
      personalityType: 'challenger',
      launchDelaySeconds: 0.22,
      vehicleId: 'chevy_camaro',
    },
  ];

  constructor(scene: Scene) {
    this.scene = scene;
    this.waypointManager = new WaypointManager();
  }

  /**
   * Asynchronously loads all 3 opponent vehicle models.
   */
  public async loadOpponents(): Promise<void> {
    this.dispose();

    this.opponents = [];
    for (const config of AIManager.AI_CONFIGS) {
      const opp = new AIOpponent(this.scene, {
        ...config,
        difficulty: this.difficulty,
      });
      await opp.load();
      this.opponents.push(opp);
    }
  }

  public setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    for (const opp of this.opponents) {
      opp.setDifficulty(difficulty);
    }
  }

  /**
   * Configures AI navigation path and starting grid slots for the active circuit.
   */
  public setCircuit(circuit: CircuitDefinition): void {
    this.currentCircuit = circuit;
    this.waypointManager.setCircuit(circuit);

    // Update opponent starting grid slots
    for (let i = 0; i < this.opponents.length; i++) {
      const slot = circuit.aiGridSlots[i];
      if (slot && this.opponents[i]) {
        this.opponents[i].gridPosition.copyFrom(slot.position);
        this.opponents[i].gridYaw = slot.yaw;
      }
    }
  }

  /**
   * Sets up starting grid before countdown.
   * Gated: Drift mode is solo, AI opponents are disabled and hidden.
   */
  public setupGrid(
    event: RaceEventConfig,
    difficulty?: AIDifficulty,
    targetLaps: number = 1
  ): void {
    if (difficulty) {
      this.setDifficulty(difficulty);
    }

    this.isRacing = false;
    this.finishedRacers = [];

    // DRIFT & POLICE PURSUIT MODES: Disable standard AI grid
    if (event.mode === 'drift' || event.mode === 'pursuit') {
      this.isEnabled = false;
      this.hideOpponents();
      return;
    }

    const isSprint = event.mode === 'sprint' || event.mapType === 'sprint';
    let sprintFinishDistance = this.waypointManager.trackLength;
    if (isSprint && this.currentCircuit) {
      const finishCp = this.currentCircuit.checkpoints.find(c => c.id === event.finishCheckpointId);
      if (finishCp) {
        sprintFinishDistance = this.waypointManager.getTrackDistance(finishCp.position);
      } else {
        sprintFinishDistance = this.waypointManager.trackLength * 0.5;
      }
    }

    // Circuit Race & Sprint: Enable and position on grid
    this.isEnabled = true;
    for (const opp of this.opponents) {
      opp.resetToGrid();
      opp.targetLaps = targetLaps;
      opp.isSprint = isSprint;
      opp.sprintFinishDistance = sprintFinishDistance;
      opp.onFinished = (id, time) => {
        this.notifyRacerFinished(id, time, false);
      };
      if (opp.vehicle && opp.vehicle.rootNode) {
        opp.vehicle.rootNode.setEnabled(true);
      }
    }
  }

  /**
   * Records a racer as finished and permanently locks their finish rank.
   */
  public notifyRacerFinished(
    id: string,
    finishTime: number,
    isPlayer: boolean = false
  ): number {
    const existing = this.finishedRacers.find(r => r.id === id);
    if (existing) return existing.rank;

    const rank = this.finishedRacers.length + 1;
    let name = isPlayer ? 'YOU (PLAYER)' : id;
    if (!isPlayer) {
      const opp = this.opponents.find(o => o.id === id);
      if (opp) {
        name = opp.name;
        opp.isFinished = true;
        opp.finishTime = finishTime;
      }
    }

    this.finishedRacers.push({
      id,
      name,
      isPlayer,
      finishTime,
      rank,
    });
    return rank;
  }

  /**
   * Returns the locked finish rank for a racer if already finished.
   */
  public getFinishRank(id: string): number | null {
    const found = this.finishedRacers.find(r => r.id === id);
    return found ? found.rank : null;
  }

  /**
   * Released on "GO!" signal.
   */
  public startRace(): void {
    if (!this.isEnabled) return;
    this.isRacing = true;
  }

  /**
   * Updates all active AI opponents each frame.
   */
  public update(
    dt: number,
    isGameRacing: boolean,
    isGamePaused: boolean,
    playerController: VehicleController
  ): void {
    if (!this.isEnabled || isGamePaused) return;

    // During countdown, lock to grid and keep idling
    if (!this.isRacing || !isGameRacing) {
      for (const opp of this.opponents) {
        opp.updateVisuals(dt);
      }
      return;
    }

    // Build vehicle proximity list for mutual avoidance
    const allVehicles: { position: Vector3; forwardSpeed: number }[] = [
      {
        position: playerController.position.clone(),
        forwardSpeed: playerController.forwardSpeed,
      },
    ];

    for (const opp of this.opponents) {
      allVehicles.push({
        position: opp.position.clone(),
        forwardSpeed: opp.forwardSpeed,
      });
    }

    // Update each AI opponent with proximity information
    for (let i = 0; i < this.opponents.length; i++) {
      const opp = this.opponents[i];
      // Other vehicles excluding this opponent
      const others = allVehicles.filter((_, idx) => idx !== i + 1);
      opp.update(dt, this.waypointManager, others);
    }
  }

  /**
   * Computes the current real-time relative standing of the player.
   */
  public getPlayerRank(playerProgressDistance: number): PlayerRankInfo {
    if (!this.isEnabled) {
      return {
        rank: 1,
        totalRacers: 1,
        rankFormatted: '1ST',
        rankDisplay: '1st / 1',
        aheadGapMeters: 0,
        behindGapMeters: 0,
      };
    }

    const totalRacers = this.opponents.length + 1;
    const rankSuffixes = ['1ST', '2ND', '3RD', '4TH'];

    // 1. If player has already crossed the finish line, return locked official rank
    const playerFinished = this.finishedRacers.find(r => r.isPlayer);
    if (playerFinished) {
      const rank = playerFinished.rank;
      return {
        rank,
        totalRacers,
        rankFormatted: rankSuffixes[rank - 1] || `${rank}TH`,
        rankDisplay: `${rank}st / ${totalRacers}`,
        aheadGapMeters: 0,
        behindGapMeters: 0,
      };
    }

    // 2. Active in-race evaluation:
    // Base rank starts at 1 + (count of finished AI racers ahead)
    let rank = 1;
    for (const f of this.finishedRacers) {
      if (!f.isPlayer) {
        rank++;
      }
    }

    let minAheadDist = Infinity;
    let minBehindDist = Infinity;

    // Compare player progress against all active (non-finished) AI opponents
    for (const opp of this.opponents) {
      if (opp.isFinished) continue;

      const diff = opp.totalDistance - playerProgressDistance;
      if (diff > 0) {
        // AI is ahead of player
        rank++;
        if (diff < minAheadDist) minAheadDist = diff;
      } else {
        // AI is behind player
        const behind = -diff;
        if (behind < minBehindDist) minBehindDist = behind;
      }
    }

    const rankDisplays = [`1st / ${totalRacers}`, `2nd / ${totalRacers}`, `3rd / ${totalRacers}`, `4th / ${totalRacers}`];

    return {
      rank,
      totalRacers,
      rankFormatted: rankSuffixes[rank - 1] || `${rank}TH`,
      rankDisplay: rankDisplays[rank - 1] || `${rank}th / ${totalRacers}`,
      aheadGapMeters: minAheadDist === Infinity ? 0 : Math.round(minAheadDist),
      behindGapMeters: minBehindDist === Infinity ? 0 : Math.round(minBehindDist),
    };
  }

  /**
   * Returns complete leaderboard standings across all 4 competitors.
   */
  public getAllStandings(
    playerProgressDistance: number,
    playerSpeedKmh: number,
    playerPaintHex: string
  ): RacerStanding[] {
    const playerFinished = this.finishedRacers.find(r => r.isPlayer);
    const list: RacerStanding[] = [
      {
        rank: playerFinished ? playerFinished.rank : 1,
        id: 'player',
        name: 'YOU (PLAYER)',
        isPlayer: true,
        totalDistance: playerProgressDistance,
        speedKmh: Math.round(playerSpeedKmh),
        paintHex: playerPaintHex,
        isFinished: Boolean(playerFinished),
        finishTime: playerFinished ? playerFinished.finishTime : 0,
      },
    ];

    if (this.isEnabled) {
      for (const opp of this.opponents) {
        const paint = getPaintOptionById(opp.paintId);
        const oppFinished = this.finishedRacers.find(r => r.id === opp.id);
        list.push({
          rank: oppFinished ? oppFinished.rank : 1,
          id: opp.id,
          name: opp.name,
          isPlayer: false,
          totalDistance: opp.totalDistance,
          speedKmh: Math.round(opp.forwardSpeed * 3.6),
          paintHex: paint.hex,
          isFinished: Boolean(oppFinished || opp.isFinished),
          finishTime: oppFinished ? oppFinished.finishTime : opp.finishTime,
        });
      }
    }

    // Sort: Finished racers in order of finish rank; active racers by distance descending
    list.sort((a, b) => {
      if (a.isFinished && b.isFinished) {
        return a.rank - b.rank;
      }
      if (a.isFinished) return -1;
      if (b.isFinished) return 1;
      return b.totalDistance - a.totalDistance;
    });

    // Assign rank
    for (let i = 0; i < list.length; i++) {
      list[i].rank = i + 1;
    }

    return list;
  }

  public hideOpponents(): void {
    for (const opp of this.opponents) {
      if (opp.vehicle && opp.vehicle.rootNode) {
        opp.vehicle.rootNode.setEnabled(false);
      }
    }
  }

  public showOpponents(): void {
    if (!this.isEnabled) return;
    for (const opp of this.opponents) {
      if (opp.vehicle && opp.vehicle.rootNode) {
        opp.vehicle.rootNode.setEnabled(true);
      }
    }
  }

  public dispose(): void {
    for (const opp of this.opponents) {
      opp.dispose();
    }
    this.opponents = [];
    this.isEnabled = false;
    this.isRacing = false;
  }
}
