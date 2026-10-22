import { VehicleTelemetry } from '../vehicle/VehicleController';
import { RaceMode } from '../events/EventConfig';
import { DriftTelemetry } from '../drift/DriftScoringManager';

export interface HUDState {
  telemetry: VehicleTelemetry;
  currentGate: number;
  totalGates: number;
  lap: number;
  raceTimeSeconds: number;
  mode?: RaceMode;
  countdownText?: string;
  driftTelemetry?: DriftTelemetry;
  positionRank?: string;
  positionTotal?: string;
  showPosition?: boolean;
}

export class RacingHUD {
  private speedElement: HTMLElement | null = null;
  private gearElement: HTMLElement | null = null;
  private driftBadgeElement: HTMLElement | null = null;
  private handbrakeBadgeElement: HTMLElement | null = null;
  private slipElement: HTMLElement | null = null;
  private checkpointHUDElement: HTMLElement | null = null;
  private positionRowElement: HTMLElement | null = null;
  private positionRankElement: HTMLElement | null = null;
  private positionTotalElement: HTMLElement | null = null;
  private timerLabelElement: HTMLElement | null = null;
  private raceTimerElement: HTMLElement | null = null;
  private countdownElement: HTMLElement | null = null;
  private hudContainer: HTMLElement | null = null;
  private timerCluster: HTMLElement | null = null;
  private debugOverlay: HTMLElement | null = null;

  // Drift Challenge scoring elements
  private driftScoreCluster: HTMLElement | null = null;
  private driftTotalScoreElement: HTMLElement | null = null;
  private driftActiveRow: HTMLElement | null = null;
  private driftActivePointsElement: HTMLElement | null = null;
  private driftMultiplierBadge: HTMLElement | null = null;
  private driftFeedbackBanner: HTMLElement | null = null;

  constructor() {
    this.speedElement = document.getElementById('speed-value');
    this.gearElement = document.getElementById('gear-indicator');
    this.driftBadgeElement = document.getElementById('drift-badge');
    this.handbrakeBadgeElement = document.getElementById('handbrake-badge');
    this.slipElement = document.getElementById('slip-readout');
    this.checkpointHUDElement = document.getElementById('checkpoint-indicator');
    this.positionRowElement = document.getElementById('position-indicator-row');
    this.positionRankElement = document.getElementById('position-rank');
    this.positionTotalElement = document.querySelector('#position-indicator-row .pos-total');
    this.timerLabelElement = document.getElementById('timer-label');
    this.raceTimerElement = document.getElementById('race-timer');
    this.countdownElement = document.getElementById('countdown-banner');
    this.hudContainer = document.getElementById('racing-hud');
    this.timerCluster = document.getElementById('timer-cluster');
    this.debugOverlay = document.getElementById('debug-overlay');

    this.driftScoreCluster = document.getElementById('drift-score-cluster');
    this.driftTotalScoreElement = document.getElementById('drift-total-score');
    this.driftActiveRow = document.getElementById('drift-active-row');
    this.driftActivePointsElement = document.getElementById('drift-active-points');
    this.driftMultiplierBadge = document.getElementById('drift-multiplier');
    this.driftFeedbackBanner = document.getElementById('drift-feedback-banner');
  }

  public setVisible(visible: boolean): void {
    const displayStyle = visible ? '' : 'none';
    if (this.hudContainer) this.hudContainer.style.display = displayStyle;
    if (this.timerCluster) this.timerCluster.style.display = displayStyle;
    if (this.debugOverlay) this.debugOverlay.style.display = displayStyle;
  }

  public reset(mode: RaceMode = 'time_trial'): void {
    if (this.speedElement) this.speedElement.textContent = '0';
    if (this.gearElement) this.gearElement.textContent = 'N';
    if (this.driftBadgeElement) this.driftBadgeElement.classList.add('hidden');
    if (this.handbrakeBadgeElement) this.handbrakeBadgeElement.classList.add('hidden');
    if (this.slipElement) this.slipElement.textContent = 'SLIP: 0.0°';

    if (this.checkpointHUDElement) {
      if (mode === 'drift') {
        this.checkpointHUDElement.textContent = 'DRIFT CHALLENGE // 90S FREESTYLE';
      } else if (mode === 'sprint') {
        this.checkpointHUDElement.textContent = 'SPRINT • SECTOR 1/4';
      } else {
        this.checkpointHUDElement.textContent = 'LAP 1 • SECTOR 1/6';
      }
    }

    if (this.timerLabelElement) {
      this.timerLabelElement.textContent = mode === 'drift' ? 'TIME REMAINING' : 'LAP TIME';
    }

    if (this.raceTimerElement) {
      this.raceTimerElement.textContent = mode === 'drift' ? '01:30.00' : '00:00.00';
      this.raceTimerElement.style.color = '#ffffff';
    }

    if (this.countdownElement) {
      this.countdownElement.classList.add('hidden');
      this.countdownElement.textContent = '';
    }

    // Position indicator visibility
    if (this.positionRowElement) {
      if (mode === 'drift') {
        this.positionRowElement.classList.add('hidden');
      } else {
        this.positionRowElement.classList.remove('hidden');
        if (this.positionRankElement) this.positionRankElement.textContent = '1ST';
        if (this.positionTotalElement) this.positionTotalElement.textContent = '/ 4';
      }
    }

    // Drift UI visibility
    if (this.driftScoreCluster) {
      if (mode === 'drift') {
        this.driftScoreCluster.classList.remove('hidden');
        if (this.driftTotalScoreElement) this.driftTotalScoreElement.textContent = '0 PTS';
        if (this.driftActiveRow) this.driftActiveRow.classList.add('hidden');
        if (this.driftFeedbackBanner) this.driftFeedbackBanner.classList.add('hidden');
      } else {
        this.driftScoreCluster.classList.add('hidden');
      }
    }
  }

  public update(state: HUDState): void {
    const { telemetry, currentGate, totalGates, lap, raceTimeSeconds, mode, countdownText, driftTelemetry, positionRank, positionTotal, showPosition } = state;

    // Position indicator
    if (this.positionRowElement) {
      if (mode !== 'drift' && showPosition !== false) {
        this.positionRowElement.classList.remove('hidden');
        if (this.positionRankElement && positionRank) {
          this.positionRankElement.textContent = positionRank;
        }
        if (this.positionTotalElement && positionTotal) {
          this.positionTotalElement.textContent = positionTotal;
        }
      } else {
        this.positionRowElement.classList.add('hidden');
      }
    }

    // Speed in KM/H directly from vehicle velocity
    if (this.speedElement) {
      this.speedElement.textContent = String(telemetry.speedKmh);
    }

    // Gear indicator
    if (this.gearElement) {
      this.gearElement.textContent = telemetry.gear;
      if (telemetry.gear === 'R') {
        this.gearElement.style.color = 'var(--accent-amber)';
        this.gearElement.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      } else if (telemetry.gear === 'D') {
        this.gearElement.style.color = '#ffffff';
        this.gearElement.style.borderColor = 'rgba(255, 255, 255, 0.25)';
      } else {
        this.gearElement.style.color = '#94a3b8';
        this.gearElement.style.borderColor = 'rgba(255, 255, 255, 0.12)';
      }
    }

    // Drift & Handbrake indicators
    if (this.driftBadgeElement) {
      if (telemetry.isDrifting) {
        this.driftBadgeElement.classList.remove('hidden');
      } else {
        this.driftBadgeElement.classList.add('hidden');
      }
    }

    if (this.handbrakeBadgeElement) {
      if (telemetry.handbrakeActive) {
        this.handbrakeBadgeElement.classList.remove('hidden');
      } else {
        this.handbrakeBadgeElement.classList.add('hidden');
      }
    }

    // Live slip angle readout
    if (this.slipElement) {
      this.slipElement.textContent = `SLIP: ${telemetry.slipAngleDeg.toFixed(1)}°`;
    }

    // Mode-aware header readout
    if (this.checkpointHUDElement) {
      if (mode === 'drift') {
        this.checkpointHUDElement.textContent = 'DRIFT CHALLENGE // 90S FREESTYLE';
      } else if (mode === 'sprint') {
        this.checkpointHUDElement.textContent = `SPRINT • SECTOR ${currentGate}/${totalGates}`;
      } else {
        this.checkpointHUDElement.textContent = `LAP ${lap} • SECTOR ${currentGate}/${totalGates}`;
      }
    }

    // Race Timer & Drift Time Remaining
    if (this.raceTimerElement) {
      if (mode === 'drift' && driftTelemetry) {
        this.raceTimerElement.textContent = this.formatTime(driftTelemetry.timeRemainingSec);
        if (driftTelemetry.timeRemainingSec < 15.0) {
          this.raceTimerElement.style.color = 'var(--accent-amber)';
        } else {
          this.raceTimerElement.style.color = '#ffffff';
        }
      } else {
        this.raceTimerElement.textContent = this.formatTime(raceTimeSeconds);
        this.raceTimerElement.style.color = '#ffffff';
      }
    }

    // Dedicated Drift Scoring Widget Updates
    if (mode === 'drift' && driftTelemetry) {
      if (this.driftScoreCluster) this.driftScoreCluster.classList.remove('hidden');

      if (this.driftTotalScoreElement) {
        this.driftTotalScoreElement.textContent = `${driftTelemetry.totalBankedScore.toLocaleString()} PTS`;
      }

      const isDriftActive = driftTelemetry.activeDriftPoints > 0 || driftTelemetry.isDrifting || driftTelemetry.isInGracePeriod;
      if (this.driftActiveRow) {
        if (isDriftActive) {
          this.driftActiveRow.classList.remove('hidden');
          if (this.driftActivePointsElement) {
            this.driftActivePointsElement.textContent = `+${driftTelemetry.activeDriftPoints.toLocaleString()} PTS`;
          }
          if (this.driftMultiplierBadge) {
            this.driftMultiplierBadge.textContent = `x${driftTelemetry.comboMultiplier.toFixed(1)}`;
          }
        } else {
          this.driftActiveRow.classList.add('hidden');
        }
      }

      if (this.driftFeedbackBanner) {
        if (driftTelemetry.feedbackBannerText) {
          this.driftFeedbackBanner.textContent = driftTelemetry.feedbackBannerText;
          this.driftFeedbackBanner.className = `drift-feedback-banner ${driftTelemetry.feedbackBannerType || ''}`;
          this.driftFeedbackBanner.classList.remove('hidden');
        } else {
          this.driftFeedbackBanner.classList.add('hidden');
        }
      }
    } else {
      if (this.driftScoreCluster) this.driftScoreCluster.classList.add('hidden');
    }

    // Countdown / status banner
    if (this.countdownElement) {
      if (countdownText) {
        this.countdownElement.textContent = countdownText;
        this.countdownElement.classList.remove('hidden');
      } else {
        this.countdownElement.classList.add('hidden');
      }
    }
  }

  public formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 100);

    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    const msStr = String(milliseconds).padStart(2, '0');

    return `${mStr}:${sStr}.${msStr}`;
  }
}
