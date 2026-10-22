export class SoundManager {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;

  // Audio Busses
  private masterGain: GainNode | null = null;
  private engineBusGain: GainNode | null = null;
  private effectsBusGain: GainNode | null = null;

  // Volume States (0.0 to 1.0)
  private masterVolume: number = 0.8;
  private engineVolume: number = 0.8;
  private effectsVolume: number = 0.8;
  private isMuted: boolean = false;

  // Continuous Engine Synthesizer Nodes
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineSynthGain: GainNode | null = null;
  private isEngineRunning: boolean = false;

  // Continuous Tire Squeal Nodes
  private tireNoiseSource: AudioBufferSourceNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;

  // Shared Noise Buffer for SFX
  private noiseBuffer: AudioBuffer | null = null;

  // Cooldown Debouncers
  private lastShiftTime: number = 0;
  private lastCollisionTime: number = 0;

  constructor(
    initialMasterVolume: number = 0.8,
    initialEngineVolume: number = 0.8,
    initialEffectsVolume: number = 0.8,
    initialMuted: boolean = false
  ) {
    this.masterVolume = initialMasterVolume;
    this.engineVolume = initialEngineVolume;
    this.effectsVolume = initialEffectsVolume;
    this.isMuted = initialMuted;
  }

  /**
   * Initializes Web Audio context and continuous synthesizer graphs.
   * Called on first user interaction or game start.
   */
  public initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master Gain Bus
      this.masterGain = this.ctx.createGain();
      const effectiveMaster = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(effectiveMaster, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Engine Sub-Bus
      this.engineBusGain = this.ctx.createGain();
      this.engineBusGain.gain.setValueAtTime(this.engineVolume, this.ctx.currentTime);
      this.engineBusGain.connect(this.masterGain);

      // Effects Sub-Bus
      this.effectsBusGain = this.ctx.createGain();
      this.effectsBusGain.gain.setValueAtTime(this.effectsVolume, this.ctx.currentTime);
      this.effectsBusGain.connect(this.masterGain);

      // Precompute 2-second white noise buffer for tire squeal and transmission pops
      const sampleRate = this.ctx.sampleRate;
      const bufferLength = sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // Initialize persistent continuous synthesizers
      this.initEngineSynth();
      this.initTireSynth();

      this.isInitialized = true;
    } catch (e) {
      console.warn('[SoundManager] Web Audio not supported or blocked:', e);
    }
  }

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  public getContextState(): AudioContextState | null {
    return this.ctx ? this.ctx.state : null;
  }

  /**
   * Continuous multi-harmonic procedural engine synthesizer.
   * Utilizes dual oscillators (sawtooth harmonic + sub-octave rumble)
   * routed through a dynamic resonant lowpass filter modulated by RPM and throttle.
   */
  private initEngineSynth(): void {
    if (!this.ctx || !this.engineBusGain) return;

    try {
      const now = this.ctx.currentTime;

      // Primary firing pulse (sawtooth for mechanical engine harmonics)
      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(45, now);

      // Sub-octave combustion rumble (triangle wave)
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(22.5, now);

      // Dynamic Lowpass Filter (simulates acoustic throttle body opening & induction roar)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(280, now);
      this.engineFilter.Q.setValueAtTime(2.2, now);

      // Dedicated engine synthesis gain node
      this.engineSynthGain = this.ctx.createGain();
      this.engineSynthGain.gain.setValueAtTime(0.001, now);

      // Graph wiring: [Osc1 & Osc2] -> Filter -> SynthGain -> EngineBusGain
      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineSynthGain);
      this.engineSynthGain.connect(this.engineBusGain);

      this.engineOsc1.start(now);
      this.engineOsc2.start(now);
      this.isEngineRunning = true;
    } catch (e) {
      console.warn('[SoundManager] Error initializing engine synth:', e);
    }
  }

  /**
   * Continuous tire friction synthesizer using looped bandpass filtered noise.
   */
  private initTireSynth(): void {
    if (!this.ctx || !this.effectsBusGain || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;

      this.tireNoiseSource = this.ctx.createBufferSource();
      this.tireNoiseSource.buffer = this.noiseBuffer;
      this.tireNoiseSource.loop = true;

      this.tireFilter = this.ctx.createBiquadFilter();
      this.tireFilter.type = 'bandpass';
      this.tireFilter.frequency.setValueAtTime(1100, now);
      this.tireFilter.Q.setValueAtTime(3.2, now);

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0.0001, now);

      this.tireNoiseSource.connect(this.tireFilter);
      this.tireFilter.connect(this.tireGain);
      this.tireGain.connect(this.effectsBusGain);

      this.tireNoiseSource.start(now);
    } catch (e) {
      console.warn('[SoundManager] Error initializing tire squeal synth:', e);
    }
  }

  // ==========================================
  // REAL-TIME CONTINUOUS SYNTHESIS UPDATES
  // ==========================================

  /**
   * Updates procedural engine sound per frame based on vehicle telemetry.
   * Modulates frequency by RPM and cutoff filter by throttle load.
   */
  public updateEngine(
    rpm: number,
    throttle: number,
    _speedKmh: number,
    isActive: boolean
  ): void {
    if (!this.isInitialized || !this.ctx || !this.isEngineRunning) return;
    if (!this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineSynthGain) return;

    try {
      const now = this.ctx.currentTime;
      const smoothTime = 0.04;

      if (!isActive) {
        // Mute engine when paused or in menus
        this.engineSynthGain.gain.setTargetAtTime(0.0001, now, 0.08);
        return;
      }

      // Clamp RPM bounds: 950 (idle) to 7200 (redline)
      const clampedRpm = Math.max(850, Math.min(7400, rpm));
      const rpmFraction = (clampedRpm - 950) / (7200 - 950);

      // Fundamental firing frequency: ~42Hz at idle to ~360Hz at redline
      const baseFreq = 42 + rpmFraction * 318;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, smoothTime);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, now, smoothTime);

      // Throttle opening induction roar: cutoff opens up from ~240Hz to ~2600Hz
      const targetCutoff = 240 + Math.pow(rpmFraction, 0.7) * 900 + throttle * 1500;
      this.engineFilter.frequency.setTargetAtTime(targetCutoff, now, smoothTime);

      // Engine volume: quiet idle rumble (0.16) up to punchy full-throttle pull (0.42)
      const targetGain = (0.16 + rpmFraction * 0.14 + throttle * 0.12) * (this.isMuted ? 0 : 1.0);
      this.engineSynthGain.gain.setTargetAtTime(targetGain, now, smoothTime);
    } catch {}
  }

  /**
   * Updates procedural tire squeal per frame based on slip angle and lateral velocity.
   * Activates ONLY during sustained high slip / drifting above threshold.
   */
  public updateTires(
    slipAngleRad: number,
    lateralSpeed: number,
    forwardSpeed: number,
    isActive: boolean
  ): void {
    if (!this.isInitialized || !this.ctx || !this.tireGain || !this.tireFilter) return;

    try {
      const now = this.ctx.currentTime;
      const absSlip = Math.abs(slipAngleRad);
      const absLat = Math.abs(lateralSpeed);
      const absSpeed = Math.abs(forwardSpeed);

      if (!isActive || absSpeed < 3.5) {
        this.tireGain.gain.setTargetAtTime(0.0001, now, 0.05);
        return;
      }

      // Squeal activates when slip angle > 0.16 rad (~9°) OR lateral speed > 2.6 m/s
      const slipThreshold = 0.16;
      const latThreshold = 2.6;

      if (absSlip > slipThreshold || absLat > latThreshold) {
        const slipExcess = Math.max(0, (absSlip - slipThreshold) / 0.40);
        const latExcess = Math.max(0, (absLat - latThreshold) / 8.0);
        const intensity = Math.min(1.0, slipExcess * 0.65 + latExcess * 0.35);

        // Center frequency modulates slightly with speed: 950Hz to 1450Hz
        const centerFreq = 950 + Math.min(500, absSpeed * 18);
        this.tireFilter.frequency.setTargetAtTime(centerFreq, now, 0.05);

        const targetGain = intensity * 0.38 * (this.isMuted ? 0 : 1.0);
        this.tireGain.gain.setTargetAtTime(targetGain, now, 0.06);
      } else {
        // Pure silent tracking on straight grip
        this.tireGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
    } catch {}
  }

  // ==========================================
  // DISCRETE RACING & VEHICLE SFX
  // ==========================================

  /**
   * Mechanical pneumatic shift pop on gear change.
   */
  public playGearShift(gear: number): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    const now = performance.now();
    if (now - this.lastShiftTime < 320) return; // Debounce against rapid re-triggers
    this.lastShiftTime = now;

    try {
      const audioTime = this.ctx.currentTime;

      // 1. Pneumatic pressure release click (short filtered noise burst)
      if (this.noiseBuffer) {
        const popSource = this.ctx.createBufferSource();
        popSource.buffer = this.noiseBuffer;

        const popFilter = this.ctx.createBiquadFilter();
        popFilter.type = 'highpass';
        popFilter.frequency.setValueAtTime(2400, audioTime);

        const popGain = this.ctx.createGain();
        popGain.gain.setValueAtTime(0.22, audioTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.045);

        popSource.connect(popFilter);
        popFilter.connect(popGain);
        popGain.connect(this.effectsBusGain);

        popSource.start(audioTime);
        popSource.stop(audioTime + 0.05);
      }

      // 2. Mechanical dog ring / actuator engagement clack
      const clackOsc = this.ctx.createOscillator();
      const clackGain = this.ctx.createGain();

      clackOsc.type = 'triangle';
      clackOsc.frequency.setValueAtTime(420 + (gear || 1) * 25, audioTime);
      clackOsc.frequency.exponentialRampToValueAtTime(140, audioTime + 0.04);

      clackGain.gain.setValueAtTime(0.18, audioTime);
      clackGain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.05);

      clackOsc.connect(clackGain);
      clackGain.connect(this.effectsBusGain);

      clackOsc.start(audioTime);
      clackOsc.stop(audioTime + 0.06);
    } catch {}
  }

  /**
   * Heavy mechanical collision impact thud with debounce.
   */
  public playCollisionImpact(intensity: number = 1.0): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    const now = performance.now();
    if (now - this.lastCollisionTime < 220) return; // Debounce wall rubbing
    this.lastCollisionTime = now;

    try {
      const audioTime = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(Math.min(220, 140 + intensity * 20), audioTime);
      osc.frequency.exponentialRampToValueAtTime(36, audioTime + 0.20);

      const hitGain = Math.min(0.55, 0.22 + intensity * 0.06);
      gain.gain.setValueAtTime(hitGain, audioTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.24);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(audioTime);
      osc.stop(audioTime + 0.26);
    } catch {}
  }

  // ==========================================
  // RACE PROGRESSION & UI SFX
  // ==========================================

  public playCountdownBeep(isGo: boolean = false): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;
      const freq = isGo ? 880 : 440; // High tone on GO, standard on 3-2-1
      const duration = isGo ? 0.35 : 0.12;

      osc.type = isGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {}
  }

  public playFinishChime(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5 chime
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.effectsBusGain) return;
        const now = this.ctx.currentTime + idx * 0.12;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.effectsBusGain);

        osc.start(now);
        osc.stop(now + 0.5);
      });
    } catch {}
  }

  /**
   * Crisp UI interaction click.
   */
  public playUIClick(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.025);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch {}
  }

  /**
   * Confirmed selection audio cue.
   */
  public playUISelect(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.07);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  /**
   * Pause cue: gentle downward tone.
   */
  public playPause(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }

  /**
   * Resume cue: gentle upward tone.
   */
  public playResume(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {}
  }

  /**
   * Subtle camera mode switch audio cue.
   */
  public playCameraSwitch(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.035);

      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.effectsBusGain);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {}
  }

  /**
   * Atmospheric cinematic shimmer for starting grid sweep.
   */
  public playGridSweepCue(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [293.66, 440.0]; // D4 - A4 ambient fifth
      notes.forEach((freq) => {
        if (!this.ctx || !this.effectsBusGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

        osc.connect(gain);
        gain.connect(this.effectsBusGain);

        osc.start(now);
        osc.stop(now + 1.3);
      });
    } catch {}
  }

  /**
   * Celebratory cinematic chord for race finish line crossing.
   */
  public playFinishCelebration(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.0, 523.25]; // C major chord
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.effectsBusGain) return;
        const noteTime = now + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.85);

        osc.connect(gain);
        gain.connect(this.effectsBusGain);

        osc.start(noteTime);
        osc.stop(noteTime + 0.9);
      });
    } catch {}
  }

  // ==========================================
  // VOLUME & BUS CONTROLS
  // ==========================================

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, vol));
    if (this.masterGain && this.ctx) {
      const effective = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setEngineVolume(vol: number): void {
    this.engineVolume = Math.max(0, Math.min(1.0, vol));
    if (this.engineBusGain && this.ctx) {
      this.engineBusGain.gain.setValueAtTime(this.engineVolume, this.ctx.currentTime);
    }
  }

  public getEngineVolume(): number {
    return this.engineVolume;
  }

  public setEffectsVolume(vol: number): void {
    this.effectsVolume = Math.max(0, Math.min(1.0, vol));
    if (this.effectsBusGain && this.ctx) {
      this.effectsBusGain.gain.setValueAtTime(this.effectsVolume, this.ctx.currentTime);
    }
  }

  public getEffectsVolume(): number {
    return this.effectsVolume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const effective = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }
}
