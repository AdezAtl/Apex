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

export class AIManager {
  private scene: Scene;
  public waypointManager: WaypointManager;
  public opponents: AIOpponent[] = [];
  public isEnabled: boolean = false;
  public isRacing: boolean = false;
  public difficulty: AIDifficulty = 'normal';
  public currentCircuit: CircuitDefinition | null = null;

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
      vehicleId: 'apex_sport_coupe',
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
      vehicleId: 'azura_coupe',
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
      vehicleId: 'stratos_sedan',
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
  public setupGrid(event: RaceEventConfig, difficulty?: AIDifficulty): void {
    if (difficulty) {
      this.setDifficulty(difficulty);
    }

    this.isRacing = false;

    // DRIFT MODE IS SOLO FREESTYLE: Disable and hide AI
    if (event.mode === 'drift') {
      this.isEnabled = false;
      this.hideOpponents();
      return;
    }

    // Circuit Race & Sprint: Enable and position on grid
    this.isEnabled = true;
    for (const opp of this.opponents) {
      opp.resetToGrid();
      if (opp.vehicle && opp.vehicle.rootNode) {
        opp.vehicle.rootNode.setEnabled(true);
      }
    }
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

    // Compare player progress against all AI progress
    let rank = 1;
    let minAheadDist = Infinity;
    let minBehindDist = Infinity;

    for (const opp of this.opponents) {
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

    const rankSuffixes = ['1ST', '2ND', '3RD', '4TH'];
    const rankDisplays = ['1st / 4', '2nd / 4', '3rd / 4', '4th / 4'];

    return {
      rank,
      totalRacers: 4,
      rankFormatted: rankSuffixes[rank - 1] || `${rank}TH`,
      rankDisplay: rankDisplays[rank - 1] || `${rank}th / 4`,
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
    const list: RacerStanding[] = [
      {
        rank: 1,
        id: 'player',
        name: 'YOU (PLAYER)',
        isPlayer: true,
        totalDistance: playerProgressDistance,
        speedKmh: Math.round(playerSpeedKmh),
        paintHex: playerPaintHex,
        isFinished: false,
        finishTime: 0,
      },
    ];

    if (this.isEnabled) {
      for (const opp of this.opponents) {
        const paint = getPaintOptionById(opp.paintId);
        list.push({
          rank: 1,
          id: opp.id,
          name: opp.name,
          isPlayer: false,
          totalDistance: opp.totalDistance,
          speedKmh: Math.round(opp.forwardSpeed * 3.6),
          paintHex: paint.hex,
          isFinished: opp.isFinished,
          finishTime: opp.finishTime,
        });
      }
    }

    // Sort descending by totalDistance
    list.sort((a, b) => b.totalDistance - a.totalDistance);

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
