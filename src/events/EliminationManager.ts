import { AIOpponent } from '../ai/AIOpponent';
import { SoundManager } from '../audio/SoundManager';

export interface EliminationTelemetry {
  isActive: boolean;
  roundTimeRemaining: number;
  activeRound: number;
  totalRounds: number;
  eliminatedDriverName: string | null;
  bannerMessage: string | null;
  bannerDuration: number;
}

export class EliminationManager {
  private isActive: boolean = false;
  private soundManager: SoundManager;

  public roundDurationSec: number = 30.0;
  public roundTimer: number = 30.0;
  public activeRound: number = 1;
  public totalRounds: number = 3;

  private lastWarningSec: number = -1;
  private bannerMessage: string | null = null;
  private bannerDuration: number = 0;
  private eliminatedOpponentIds: Set<number> = new Set();
  public isPlayerEliminated: boolean = false;
  public isPlayerWinner: boolean = false;

  constructor(soundManager: SoundManager) {
    this.soundManager = soundManager;
  }

  public start(): void {
    this.isActive = true;
    this.roundTimer = this.roundDurationSec;
    this.activeRound = 1;
    this.totalRounds = 3;
    this.lastWarningSec = -1;
    this.bannerMessage = 'ROUND 1 • 30S ELIMINATION';
    this.bannerDuration = 3.5;
    this.eliminatedOpponentIds.clear();
    this.isPlayerEliminated = false;
    this.isPlayerWinner = false;
  }

  public reset(): void {
    this.isActive = false;
    this.roundTimer = this.roundDurationSec;
    this.activeRound = 1;
    this.lastWarningSec = -1;
    this.bannerMessage = null;
    this.bannerDuration = 0;
    this.eliminatedOpponentIds.clear();
    this.isPlayerEliminated = false;
    this.isPlayerWinner = false;
  }

  public update(
    dt: number,
    playerPosition: number, // 1 = 1st, 2 = 2nd, 3 = 3rd, 4 = 4th
    opponents: AIOpponent[]
  ): { playerEliminated: boolean; playerWon: boolean } {
    if (!this.isActive || this.isPlayerEliminated || this.isPlayerWinner) {
      return { playerEliminated: false, playerWon: false };
    }

    if (this.bannerDuration > 0) {
      this.bannerDuration -= dt;
      if (this.bannerDuration <= 0) {
        this.bannerMessage = null;
      }
    }

    this.roundTimer -= dt;

    // Warning pings at 5, 4, 3, 2, 1 seconds
    const intSec = Math.ceil(this.roundTimer);
    if (intSec <= 5 && intSec >= 1 && intSec !== this.lastWarningSec) {
      this.lastWarningSec = intSec;
      this.soundManager.playEliminationWarning();
    }

    if (this.roundTimer <= 0) {
      // Time is up! Eliminate last place contender among active drivers
      const activeOpponents = opponents.filter((_, idx) => !this.eliminatedOpponentIds.has(idx));
      const totalContenders = activeOpponents.length + 1; // plus player

      if (playerPosition >= totalContenders) {
        // Player is eliminated!
        this.isPlayerEliminated = true;
        this.isActive = false;
        this.bannerMessage = `ELIMINATED! FINISHED ${this.getOrdinal(totalContenders)}`;
        this.bannerDuration = 6.0;
        this.soundManager.playEliminationChime(true);
        return { playerEliminated: true, playerWon: false };
      }

      // An AI opponent is eliminated
      // Find active opponent with lowest total distance
      let lowestDist = Infinity;
      let eliminatedIndex = -1;
      let eliminatedName = 'OPPONENT';

      opponents.forEach((opp, idx) => {
        if (!this.eliminatedOpponentIds.has(idx)) {
          if (opp.totalDistance < lowestDist) {
            lowestDist = opp.totalDistance;
            eliminatedIndex = idx;
            eliminatedName = opp.name;
          }
        }
      });

      if (eliminatedIndex !== -1) {
        this.eliminatedOpponentIds.add(eliminatedIndex);
        const opp = opponents[eliminatedIndex];
        if (opp) {
          opp.forwardSpeed = 0;
          opp.isFinished = true;
        }

        this.soundManager.playEliminationChime(false);
        this.bannerMessage = `ELIMINATED: ${eliminatedName} (P${totalContenders})`;
        this.bannerDuration = 4.0;
      }

      // Check if only player remains!
      const remainingOpponents = opponents.filter((_, idx) => !this.eliminatedOpponentIds.has(idx));
      if (remainingOpponents.length === 0) {
        this.isPlayerWinner = true;
        this.isActive = false;
        this.bannerMessage = 'ELIMINATION CHAMPION! 1ST PLACE WINNER!';
        this.bannerDuration = 6.0;
        this.soundManager.playFinishCelebration();
        return { playerEliminated: false, playerWon: true };
      }

      // Advance to next round
      this.activeRound++;
      this.roundTimer = this.roundDurationSec;
      this.lastWarningSec = -1;
    }

    return { playerEliminated: false, playerWon: false };
  }

  private getOrdinal(n: number): string {
    if (n === 1) return '1ST';
    if (n === 2) return '2ND';
    if (n === 3) return '3RD';
    return `${n}TH`;
  }

  public getTelemetry(): EliminationTelemetry {
    return {
      isActive: this.isActive,
      roundTimeRemaining: Math.max(0, this.roundTimer),
      activeRound: this.activeRound,
      totalRounds: this.totalRounds,
      eliminatedDriverName: null,
      bannerMessage: this.bannerMessage,
      bannerDuration: this.bannerDuration,
    };
  }
}
