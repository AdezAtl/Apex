import { Scene, UniversalCamera, Vector3, Scalar } from '@babylonjs/core';
import { Vehicle } from '../vehicle/Vehicle';
import { VehicleController } from '../vehicle/VehicleController';
import { AIOpponent } from '../ai/AIOpponent';
import { SoundManager } from '../audio/SoundManager';

export interface ReplayVehicleState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steer: number;
  wheelSpin: number;
}

export interface ReplayOpponentState extends ReplayVehicleState {
  id: string;
}

export interface ReplaySample {
  time: number; // Elapsed race time in seconds
  player: ReplayVehicleState;
  opponents: ReplayOpponentState[];
}

export type ReplayCameraAngle = 'broadcast' | 'cinematic_chase' | 'helicopter';

export interface ReplayCallbacks {
  onExitReplay: () => void;
}

export class ReplayManager {
  private scene: Scene;
  private soundManager: SoundManager;
  private callbacks: ReplayCallbacks | null = null;

  // Bounded recording buffer (Max 60 seconds @ 30Hz = 1800 samples)
  private static readonly MAX_DURATION_SECONDS = 60.0;
  private static readonly SAMPLE_INTERVAL = 0.033; // ~30 FPS sampling
  private samples: ReplaySample[] = [];
  private isRecording: boolean = false;
  private sampleTimer: number = 0;
  private raceElapsedTime: number = 0;

  // Playback state
  public isPlaying: boolean = false;
  public isPlaybackPaused: boolean = false;
  public playbackTime: number = 0;
  public totalDuration: number = 0;

  // Replay Camera
  public replayCamera: UniversalCamera | null = null;
  public cameraAngle: ReplayCameraAngle = 'broadcast';
  private cameraAnglesList: ReplayCameraAngle[] = ['broadcast', 'cinematic_chase', 'helicopter'];
  private currentAngleIndex: number = 0;

  // Replay UI Overlay
  private overlayElement: HTMLElement | null = null;
  private timeDisplayElement: HTMLElement | null = null;
  private cameraBadgeElement: HTMLElement | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(scene: Scene, soundManager: SoundManager) {
    this.scene = scene;
    this.soundManager = soundManager;
    this.boundKeyDown = this.handleKeyDown.bind(this);
  }

  // ==========================================
  // RECORDING LIFECYCLE
  // ==========================================

  public startRecording(): void {
    this.samples = [];
    this.isRecording = true;
    this.sampleTimer = 0;
    this.raceElapsedTime = 0;
  }

  public recordFrame(
    dt: number,
    player: VehicleController,
    opponents: AIOpponent[]
  ): void {
    if (!this.isRecording) return;

    this.raceElapsedTime += dt;
    this.sampleTimer += dt;

    if (this.sampleTimer >= ReplayManager.SAMPLE_INTERVAL) {
      this.sampleTimer = 0;

      const playerSample: ReplayVehicleState = {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yawAngle,
        speed: player.forwardSpeed,
        steer: player.steeringAngle,
        wheelSpin: player.wheelSpinAngle,
      };

      const opponentSamples: ReplayOpponentState[] = opponents.map((opp) => ({
        id: opp.id,
        x: opp.position.x,
        y: opp.position.y,
        z: opp.position.z,
        yaw: opp.yawAngle,
        speed: opp.forwardSpeed,
        steer: opp.steeringAngle,
        wheelSpin: opp.wheelSpinAngle,
      }));

      this.samples.push({
        time: this.raceElapsedTime,
        player: playerSample,
        opponents: opponentSamples,
      });

      // Maintain bounded ring buffer
      const maxSamples = Math.round(ReplayManager.MAX_DURATION_SECONDS / ReplayManager.SAMPLE_INTERVAL);
      if (this.samples.length > maxSamples) {
        this.samples.shift();
      }
    }
  }

  public stopRecording(): void {
    this.isRecording = false;
  }

  public hasRecordedData(): boolean {
    return this.samples.length >= 2;
  }

  // ==========================================
  // PLAYBACK SYSTEM
  // ==========================================

  public startPlayback(callbacks: ReplayCallbacks): void {
    if (!this.hasRecordedData()) return;

    this.callbacks = callbacks;
    this.isPlaying = true;
    this.isPlaybackPaused = false;
    this.playbackTime = 0;
    this.currentAngleIndex = 0;
    this.cameraAngle = this.cameraAnglesList[0];

    // Compute duration from recorded samples
    const firstTime = this.samples[0].time;
    const lastTime = this.samples[this.samples.length - 1].time;
    this.totalDuration = Math.max(0.1, lastTime - firstTime);

    // Initialize dedicated replay camera
    if (!this.replayCamera) {
      this.replayCamera = new UniversalCamera(
        'ReplayCamera',
        new Vector3(0, 3, 0),
        this.scene
      );
      this.replayCamera.minZ = 0.2;
      this.replayCamera.maxZ = 350;
      this.replayCamera.fov = 0.75;
    }

    const firstSample = this.samples[0];
    if (firstSample) {
      const p0 = new Vector3(firstSample.player.x, firstSample.player.y, firstSample.player.z);
      const fwd = new Vector3(Math.sin(firstSample.player.yaw), 0, Math.cos(firstSample.player.yaw));
      const rgt = new Vector3(Math.cos(firstSample.player.yaw), 0, -Math.sin(firstSample.player.yaw));
      const initCamPos = p0.add(fwd.scale(8.5)).add(rgt.scale(3.4)).add(new Vector3(0, 3.2, 0));
      this.replayCamera.position.copyFrom(initCamPos);
      this.replayCamera.setTarget(p0.add(new Vector3(0, 0.9, 0)));
    }

    this.scene.activeCamera = this.replayCamera;
    this.createUI();
    window.addEventListener('keydown', this.boundKeyDown);

    this.soundManager.playCameraSwitch();
  }

  public updatePlayback(
    dt: number,
    playerVehicle: Vehicle,
    opponents: AIOpponent[]
  ): void {
    if (!this.isPlaying) return;

    if (!this.isPlaybackPaused) {
      this.playbackTime += dt;
      // Loop replay seamlessly upon reaching end
      if (this.playbackTime > this.totalDuration) {
        this.playbackTime = 0;
      }
    }

    // Interpolate transforms for current playback time
    const sample = this.getInterpolatedSample(this.playbackTime);
    if (!sample) return;

    // Apply player transforms & visuals
    const playerPos = new Vector3(sample.player.x, sample.player.y, sample.player.z);
    playerVehicle.applyTransform(playerPos, sample.player.yaw);
    playerVehicle.updateWheels(sample.player.wheelSpin, sample.player.steer);

    // Apply opponent transforms & visuals
    for (const oppSample of sample.opponents) {
      const opp = opponents.find((o) => o.id === oppSample.id);
      if (opp && opp.isLoaded) {
        const oppPos = new Vector3(oppSample.x, oppSample.y, oppSample.z);
        opp.vehicle.applyTransform(oppPos, oppSample.yaw);
        opp.vehicle.updateWheels(oppSample.wheelSpin, oppSample.steer);
      }
    }

    // Update replay camera
    this.updateReplayCamera(playerPos, sample.player.yaw, sample.player.speed, dt);

    // Audio modulation during replay
    const rpm = 1200 + (Math.abs(sample.player.speed) / 33.3) * 5500;
    this.soundManager.updateEngine(rpm, 0.7, sample.player.speed * 3.6, !this.isPlaybackPaused);

    // Update UI HUD
    this.updateUI();
  }

  private getInterpolatedSample(timeOffset: number): ReplaySample | null {
    if (this.samples.length === 0) return null;
    const baseTime = this.samples[0].time;
    const targetAbsTime = baseTime + timeOffset;

    // Find bounding frames
    let idx = 0;
    for (let i = 0; i < this.samples.length - 1; i++) {
      if (this.samples[i + 1].time >= targetAbsTime) {
        idx = i;
        break;
      }
    }

    const s0 = this.samples[idx];
    const s1 = this.samples[Math.min(this.samples.length - 1, idx + 1)];
    if (!s1 || s0 === s1) return s0;

    const range = s1.time - s0.time;
    const alpha = range > 0.0001 ? Math.max(0, Math.min(1.0, (targetAbsTime - s0.time) / range)) : 0;

    return {
      time: targetAbsTime,
      player: {
        x: Scalar.Lerp(s0.player.x, s1.player.x, alpha),
        y: Scalar.Lerp(s0.player.y, s1.player.y, alpha),
        z: Scalar.Lerp(s0.player.z, s1.player.z, alpha),
        yaw: this.lerpAngle(s0.player.yaw, s1.player.yaw, alpha),
        speed: Scalar.Lerp(s0.player.speed, s1.player.speed, alpha),
        steer: Scalar.Lerp(s0.player.steer, s1.player.steer, alpha),
        wheelSpin: Scalar.Lerp(s0.player.wheelSpin, s1.player.wheelSpin, alpha),
      },
      opponents: s0.opponents.map((opp0) => {
        const opp1 = s1.opponents.find((o) => o.id === opp0.id) || opp0;
        return {
          id: opp0.id,
          x: Scalar.Lerp(opp0.x, opp1.x, alpha),
          y: Scalar.Lerp(opp0.y, opp1.y, alpha),
          z: Scalar.Lerp(opp0.z, opp1.z, alpha),
          yaw: this.lerpAngle(opp0.yaw, opp1.yaw, alpha),
          speed: Scalar.Lerp(opp0.speed, opp1.speed, alpha),
          steer: Scalar.Lerp(opp0.steer, opp1.steer, alpha),
          wheelSpin: Scalar.Lerp(opp0.wheelSpin, opp1.wheelSpin, alpha),
        };
      }),
    };
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  private updateReplayCamera(carPos: Vector3, carYaw: number, speed: number, dt: number): void {
    if (!this.replayCamera) return;

    const forward = new Vector3(Math.sin(carYaw), 0, Math.cos(carYaw));
    const right = new Vector3(Math.cos(carYaw), 0, -Math.sin(carYaw));

    switch (this.cameraAngle) {
      case 'broadcast': {
        // Trackside broadcast camera: elevated trackside viewpoint with smooth tracking
        const sideOffset = 3.4;
        const leadDist = 8.5;
        const idealPos = carPos
          .add(forward.scale(leadDist))
          .add(right.scale(sideOffset))
          .add(new Vector3(0, 3.2, 0));

        this.replayCamera.position = Vector3.Lerp(this.replayCamera.position, idealPos, Math.min(1.0, dt * 6.0));
        this.replayCamera.setTarget(carPos.add(new Vector3(0, 0.9, 0)));
        this.replayCamera.fov = 0.75;
        break;
      }

      case 'cinematic_chase': {
        // Low, dramatic close chase camera with speed setback
        const dist = 5.2 + Math.min(1.0, Math.abs(speed) / 33.3) * 1.5;
        const idealPos = carPos
          .subtract(forward.scale(dist))
          .add(new Vector3(0, 1.6, 0));

        this.replayCamera.position = Vector3.Lerp(this.replayCamera.position, idealPos, Math.min(1.0, dt * 8.0));
        this.replayCamera.setTarget(carPos.add(forward.scale(4.0)).add(new Vector3(0, 1.0, 0)));
        this.replayCamera.fov = 0.88;
        break;
      }

      case 'helicopter': {
        // Helicopter follow: elevated panoramic angle from 12m height
        const idealPos = carPos
          .subtract(forward.scale(10.0))
          .add(right.scale(3.5))
          .add(new Vector3(0, 12.0, 0));

        this.replayCamera.position = Vector3.Lerp(this.replayCamera.position, idealPos, Math.min(1.0, dt * 4.0));
        this.replayCamera.setTarget(carPos.add(forward.scale(2.0)).add(new Vector3(0, 0.8, 0)));
        this.replayCamera.fov = 0.95;
        break;
      }
    }
  }

  public cycleCamera(): void {
    this.currentAngleIndex = (this.currentAngleIndex + 1) % this.cameraAnglesList.length;
    this.cameraAngle = this.cameraAnglesList[this.currentAngleIndex];
    this.soundManager.playCameraSwitch();
  }

  public togglePause(): void {
    this.isPlaybackPaused = !this.isPlaybackPaused;
    this.soundManager.playUIClick();
  }

  public stopPlayback(): void {
    this.isPlaying = false;
    this.isPlaybackPaused = false;
    this.soundManager.updateEngine(0, 0, 0, false);
    window.removeEventListener('keydown', this.boundKeyDown);
    this.destroyUI();

    if (this.callbacks) {
      this.callbacks.onExitReplay();
    }
  }

  // ==========================================
  // REPLAY UI
  // ==========================================

  private createUI(): void {
    this.destroyUI();

    this.overlayElement = document.createElement('div');
    this.overlayElement.id = 'replay-overlay';
    this.overlayElement.className = 'replay-overlay';

    this.overlayElement.innerHTML = `
      <div class="replay-top-bar">
        <div class="replay-badge">
          <span class="replay-rec-dot"></span>
          <span>REPLAY // BROADCAST</span>
        </div>
        <div id="replay-camera-badge" class="replay-camera-tag">ANGLE: BROADCAST TV</div>
      </div>

      <div class="replay-bottom-bar">
        <div class="replay-timeline-box">
          <span id="replay-time-display" class="replay-time-text">00:00.00 / 00:00.00</span>
          <div class="replay-hints">
            <span class="key-hint">[SPACE] PAUSE/PLAY</span>
            <span class="key-hint">[C] CYCLE CAMERA</span>
            <span class="key-hint">[ESC] EXIT</span>
          </div>
        </div>
        <button id="btn-replay-exit" class="apex-btn secondary-btn replay-exit-btn">
          <span class="btn-text">EXIT REPLAY</span>
        </button>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.overlayElement);

    this.timeDisplayElement = document.getElementById('replay-time-display');
    this.cameraBadgeElement = document.getElementById('replay-camera-badge');

    document.getElementById('btn-replay-exit')?.addEventListener('click', () => {
      this.stopPlayback();
    });
  }

  private updateUI(): void {
    if (this.timeDisplayElement) {
      const cur = this.formatTime(this.playbackTime);
      const total = this.formatTime(this.totalDuration);
      const status = this.isPlaybackPaused ? ' (PAUSED)' : '';
      this.timeDisplayElement.textContent = `${cur} / ${total}${status}`;
    }

    if (this.cameraBadgeElement) {
      const names: Record<ReplayCameraAngle, string> = {
        broadcast: 'ANGLE: BROADCAST TRACKSIDE',
        cinematic_chase: 'ANGLE: CINEMATIC CHASE',
        helicopter: 'ANGLE: HELICOPTER OVERHEAD',
      };
      this.cameraBadgeElement.textContent = names[this.cameraAngle];
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  private destroyUI(): void {
    if (this.overlayElement) {
      this.overlayElement.remove();
      this.overlayElement = null;
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isPlaying) return;

    if (e.code === 'Space') {
      e.preventDefault();
      this.togglePause();
    } else if (e.code === 'KeyC') {
      e.preventDefault();
      this.cycleCamera();
    } else if (e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      this.stopPlayback();
    }
  }

  public dispose(): void {
    this.stopRecording();
    this.stopPlayback();
    if (this.replayCamera) {
      this.replayCamera.dispose();
      this.replayCamera = null;
    }
    this.samples = [];
  }
}
