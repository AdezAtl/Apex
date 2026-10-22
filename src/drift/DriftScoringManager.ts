import { VehicleTelemetry } from '../vehicle/VehicleController';

export interface DriftScoringConfig {
  minSpeedKmh: number;
  minSlipAngleDeg: number;
  maxSlipAngleDeg: number;
  maxAllowedYawRate: number;
  basePointsPerSecond: number;
  multiplierStepTimeSec: number;
  maxMultiplier: number;
  exitGracePeriodSec: number;
  severeImpactThreshold: number;
  sessionTotalDurationSec: number;
}

export const DEFAULT_DRIFT_CONFIG: DriftScoringConfig = {
  minSpeedKmh: 18.0, // Minimum speed required to score drift points (down from 24.0 for hairpin agility)
  minSlipAngleDeg: 5.0, // Meaningful slip angle required to initiate drift scoring (tuned for realistic slide physics)
  maxSlipAngleDeg: 62.0, // Angles beyond this indicate excessive spin/loss of control
  maxAllowedYawRate: 3.2, // Excessive angular velocity (spin-out) stops scoring
  basePointsPerSecond: 280.0, // Base scoring rate at nominal angle and speed
  multiplierStepTimeSec: 0.55, // Time required in drift to increase multiplier by +0.1x
  maxMultiplier: 5.0, // Sensible upper cap on combo multiplier
  exitGracePeriodSec: 0.95, // Chicane/switchback transition window before auto-banking
  severeImpactThreshold: 1.2, // Collision force threshold that interrupts combo
  sessionTotalDurationSec: 90.0, // 90-second scoring session
};

export type DriftBannerType = 'drifting' | 'banked' | 'lost' | 'warning' | null;

export interface DriftTelemetry {
  isDrifting: boolean;
  isInGracePeriod: boolean;
  activeDriftPoints: number;
  comboMultiplier: number;
  totalBankedScore: number;
  timeRemainingSec: number;
  sessionDurationSec: number;
  maxMultiplierAchieved: number;
  totalDriftTimeSec: number;
  feedbackBannerText: string | null;
  feedbackBannerType: DriftBannerType;
}

export class DriftScoringManager {
  public config: DriftScoringConfig;

  // Session state
  public totalBankedScore: number = 0;
  public activeDriftPoints: number = 0;
  public comboMultiplier: number = 1.0;
  public maxMultiplierAchieved: number = 1.0;
  public sessionDurationSec: number = 0;
  public totalDriftTimeSec: number = 0;

  // Drift progress tracking
  private currentContinuousDriftSec: number = 0;
  private isCurrentlyDrifting: boolean = false;
  private isInGracePeriod: boolean = false;
  private graceTimerSec: number = 0;
  private isSessionActive: boolean = false;
  private isRecoveringFromOutOfBounds: boolean = false;
  private outOfBoundsCooldownSec: number = 0;

  // Feedback banner state
  private feedbackBannerText: string | null = null;
  private feedbackBannerType: DriftBannerType = null;
  private bannerTimerSec: number = 0;

  // Completion callback
  public onSessionCompleted?: (finalScore: number, maxCombo: number, duration: number) => void;

  constructor(config: DriftScoringConfig = DEFAULT_DRIFT_CONFIG) {
    this.config = { ...config };
  }

  public startSession(): void {
    this.reset();
    this.isSessionActive = true;
    this.setBanner('90S FREESTYLE // INITIATE DRIFT', 'drifting', 2.5);
  }

  public reset(): void {
    this.totalBankedScore = 0;
    this.activeDriftPoints = 0;
    this.comboMultiplier = 1.0;
    this.maxMultiplierAchieved = 1.0;
    this.sessionDurationSec = 0;
    this.totalDriftTimeSec = 0;
    this.currentContinuousDriftSec = 0;
    this.isCurrentlyDrifting = false;
    this.isInGracePeriod = false;
    this.graceTimerSec = 0;
    this.isSessionActive = false;
    this.isRecoveringFromOutOfBounds = false;
    this.outOfBoundsCooldownSec = 0;
    this.feedbackBannerText = null;
    this.feedbackBannerType = null;
    this.bannerTimerSec = 0;
  }

  public update(dt: number, telemetry: VehicleTelemetry, yawRate: number): void {
    if (!this.isSessionActive) return;

    // Advance session timer
    this.sessionDurationSec += dt;
    const timeRemaining = Math.max(0, this.config.sessionTotalDurationSec - this.sessionDurationSec);

    // Update out-of-bounds recovery cooldown
    if (this.isRecoveringFromOutOfBounds) {
      this.outOfBoundsCooldownSec -= dt;
      if (this.outOfBoundsCooldownSec <= 0) {
        this.isRecoveringFromOutOfBounds = false;
      }
    }

    // Update banner display duration
    if (this.bannerTimerSec > 0) {
      this.bannerTimerSec -= dt;
      if (this.bannerTimerSec <= 0) {
        this.feedbackBannerText = null;
        this.feedbackBannerType = null;
      }
    }

    // 1. Check valid drift conditions
    const absSpeed = telemetry.speedKmh;
    const absSlip = Math.abs(telemetry.slipAngleDeg);
    const absYawRate = Math.abs(yawRate);

    const hasSufficientSpeed = absSpeed >= this.config.minSpeedKmh;
    const hasMeaningfulSlip = absSlip >= this.config.minSlipAngleDeg || (telemetry.isDrifting && absSlip >= 3.8);
    const hasControlledAngle = absSlip <= this.config.maxSlipAngleDeg;
    const hasStableYawRate = absYawRate <= this.config.maxAllowedYawRate;

    const isSpinningOut = absSlip > this.config.maxSlipAngleDeg + 5.0 || absYawRate > this.config.maxAllowedYawRate * 1.3;

    if (isSpinningOut && (this.activeDriftPoints > 0 || this.comboMultiplier > 1.0)) {
      // Uncontrolled spin detected: break combo
      this.loseCombo('SPIN OUT // COMBO LOST!');
      this.isCurrentlyDrifting = false;
      this.isInGracePeriod = false;
    } else if (
      !this.isRecoveringFromOutOfBounds &&
      hasSufficientSpeed &&
      hasMeaningfulSlip &&
      hasControlledAngle &&
      hasStableYawRate
    ) {
      // VALID DRIFT ACTIVE
      this.isCurrentlyDrifting = true;
      this.isInGracePeriod = false;
      this.graceTimerSec = 0;

      this.currentContinuousDriftSec += dt;
      this.totalDriftTimeSec += dt;

      // Scoring formula: scale with slip angle and vehicle speed
      const angleScale = Math.min(2.4, Math.max(0.4, (absSlip - this.config.minSlipAngleDeg) / 18.0 + 0.6));
      const speedScale = Math.min(2.2, Math.max(0.5, absSpeed / 36.0));
      const pointsIncrement = this.config.basePointsPerSecond * angleScale * speedScale * dt;

      this.activeDriftPoints += pointsIncrement;

      // Multiplier progression: +0.1x per interval up to max
      const multiplierSteps = Math.floor(this.currentContinuousDriftSec / this.config.multiplierStepTimeSec);
      this.comboMultiplier = Math.min(this.config.maxMultiplier, 1.0 + multiplierSteps * 0.1);
      this.maxMultiplierAchieved = Math.max(this.maxMultiplierAchieved, this.comboMultiplier);

      // Keep banner responsive
      if (!this.feedbackBannerText || this.feedbackBannerType === 'drifting') {
        const multStr = this.comboMultiplier > 1.0 ? ` (x${this.comboMultiplier.toFixed(1)})` : '';
        this.setBanner(`DRIFTING! +${Math.round(this.activeDriftPoints)}${multStr}`, 'drifting', 0.5);
      }
    } else {
      // NOT ACTIVELY DRIFTING: Check grace period or banking
      this.isCurrentlyDrifting = false;

      if (this.activeDriftPoints > 0) {
        this.isInGracePeriod = true;
        this.graceTimerSec += dt;

        // Visual feedback during chicane transition window
        const remainingGrace = Math.max(0, this.config.exitGracePeriodSec - this.graceTimerSec);
        if (remainingGrace > 0.05) {
          const multStr = this.comboMultiplier > 1.0 ? ` (x${this.comboMultiplier.toFixed(1)})` : '';
          this.setBanner(`CHICANE // HELD ${remainingGrace.toFixed(1)}s${multStr}`, 'drifting', 0.2);
        }

        if (this.graceTimerSec >= this.config.exitGracePeriodSec) {
          // Grace period elapsed cleanly -> BANK POINTS!
          this.bankPoints();
        }
      }
    }

    // 2. Session timeout check
    if (timeRemaining <= 0) {
      // Time is up! Bank any unbanked points at the buzzer
      if (this.activeDriftPoints > 0) {
        this.bankPoints();
      }
      this.isSessionActive = false;
      if (this.onSessionCompleted) {
        this.onSessionCompleted(
          this.totalBankedScore,
          this.maxMultiplierAchieved,
          this.sessionDurationSec
        );
      }
    }
  }

  public bankPoints(): void {
    if (this.activeDriftPoints <= 0) return;

    const bankedAmount = Math.round(this.activeDriftPoints * this.comboMultiplier);
    this.totalBankedScore += bankedAmount;

    this.setBanner(
      `+${bankedAmount.toLocaleString()} BANKED! (x${this.comboMultiplier.toFixed(1)})`,
      'banked',
      2.0
    );

    this.activeDriftPoints = 0;
    this.comboMultiplier = 1.0;
    this.currentContinuousDriftSec = 0;
    this.isInGracePeriod = false;
    this.graceTimerSec = 0;
  }

  public loseCombo(reason: string = 'COMBO LOST!'): void {
    if (this.activeDriftPoints > 0 || this.comboMultiplier > 1.0) {
      this.setBanner(reason, 'lost', 2.0);
    }
    this.activeDriftPoints = 0;
    this.comboMultiplier = 1.0;
    this.currentContinuousDriftSec = 0;
    this.isInGracePeriod = false;
    this.graceTimerSec = 0;
  }

  public onCollision(impactMagnitude: number): void {
    if (!this.isSessionActive) return;

    // Severe collisions interrupt active drift combos
    if (impactMagnitude >= this.config.severeImpactThreshold) {
      this.loseCombo('WALL IMPACT // COMBO LOST!');
    }
  }

  public onOutOfBoundsReset(): void {
    this.loseCombo('RESET // COMBO LOST!');
    this.isRecoveringFromOutOfBounds = true;
    this.outOfBoundsCooldownSec = 1.5; // Brief cooldown before new drift can be scored
  }

  private setBanner(text: string, type: DriftBannerType, durationSec: number): void {
    this.feedbackBannerText = text;
    this.feedbackBannerType = type;
    this.bannerTimerSec = durationSec;
  }

  public getTelemetry(): DriftTelemetry {
    return {
      isDrifting: this.isCurrentlyDrifting,
      isInGracePeriod: this.isInGracePeriod,
      activeDriftPoints: Math.round(this.activeDriftPoints),
      comboMultiplier: Math.round(this.comboMultiplier * 10) / 10,
      totalBankedScore: this.totalBankedScore,
      timeRemainingSec: Math.max(0, this.config.sessionTotalDurationSec - this.sessionDurationSec),
      sessionDurationSec: this.sessionDurationSec,
      maxMultiplierAchieved: Math.round(this.maxMultiplierAchieved * 10) / 10,
      totalDriftTimeSec: Math.round(this.totalDriftTimeSec * 10) / 10,
      feedbackBannerText: this.feedbackBannerText,
      feedbackBannerType: this.feedbackBannerType,
    };
  }

  public getTimeRemaining(): number {
    return Math.max(0, this.config.sessionTotalDurationSec - this.sessionDurationSec);
  }

  public isFinished(): boolean {
    return !this.isSessionActive && this.sessionDurationSec >= this.config.sessionTotalDurationSec;
  }
}
