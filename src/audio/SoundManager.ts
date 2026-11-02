import { MusicSynth, MusicTrackMode } from './MusicSynth';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private isInitialized: boolean = false;

  // Audio Busses
  private masterGain: GainNode | null = null;
  private engineBusGain: GainNode | null = null;
  private effectsBusGain: GainNode | null = null;
  private musicBusGain: GainNode | null = null;

  // Music Synth Engine
  private musicSynth: MusicSynth | null = null;

  // Volume States (0.0 to 1.0)
  private masterVolume: number = 0.8;
  private engineVolume: number = 0.8;
  private effectsVolume: number = 0.8;
  private musicVolume: number = 0.7;
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

  // Continuous High-Speed Aerodynamic Wind Rush Nodes
  private windNoiseSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  // Spatial Opponent Engine Channels (up to 3 AI cars)
  private opponentSynths: {
    osc: OscillatorNode;
    filter: BiquadFilterNode;
    panner: StereoPannerNode;
    gain: GainNode;
  }[] = [];

  // Procedural Police Siren Nodes
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  // Shared Noise Buffer for SFX
  private noiseBuffer: AudioBuffer | null = null;

  // Cooldown Debouncers
  private lastShiftTime: number = 0;
  private lastCollisionTime: number = 0;
  private lastBlowOffTime: number = 0;

  constructor(
    initialMasterVolume: number = 0.8,
    initialEngineVolume: number = 0.8,
    initialEffectsVolume: number = 0.8,
    initialMuted: boolean = false,
    initialMusicVolume: number = 0.7
  ) {
    this.masterVolume = initialMasterVolume;
    this.engineVolume = initialEngineVolume;
    this.effectsVolume = initialEffectsVolume;
    this.musicVolume = initialMusicVolume;
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

      // Music Sub-Bus
      this.musicBusGain = this.ctx.createGain();
      this.musicBusGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicBusGain.connect(this.masterGain);

      // Initialize Procedural Synthwave Music Engine
      this.musicSynth = new MusicSynth(this.ctx, this.musicBusGain);
      this.musicSynth.setVolume(this.musicVolume);
      this.musicSynth.setMuted(this.isMuted);

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
      this.initWindSynth();
      this.initOpponentSynths();
      this.initSirenSynth();

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

  /**
   * Continuous aerodynamic high-speed wind rush synthesizer using lowpass filtered noise.
   */
  private initWindSynth(): void {
    if (!this.ctx || !this.effectsBusGain || !this.noiseBuffer) return;

    try {
      const now = this.ctx.currentTime;
      this.windNoiseSource = this.ctx.createBufferSource();
      this.windNoiseSource.buffer = this.noiseBuffer;
      this.windNoiseSource.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.setValueAtTime(320, now);

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.0001, now);

      this.windNoiseSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.effectsBusGain);

      this.windNoiseSource.start(now);
    } catch (e) {
      console.warn('[SoundManager] Error initializing wind rush synth:', e);
    }
  }

  /**
   * Spatial 3D AI opponent engine synthesizers (up to 3 concurrent channels).
   */
  private initOpponentSynths(): void {
    if (!this.ctx || !this.engineBusGain) return;

    try {
      this.opponentSynths = [];
      const hasStereoPanner = typeof this.ctx.createStereoPanner === 'function';

      for (let i = 0; i < 3; i++) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now);
        filter.Q.setValueAtTime(2.2, now);

        const panner = hasStereoPanner ? this.ctx.createStereoPanner() : null;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);

        osc.connect(filter);
        if (panner) {
          filter.connect(panner);
          panner.connect(gain);
        } else {
          filter.connect(gain);
        }
        gain.connect(this.engineBusGain);

        osc.start(now);
        if (panner) {
          this.opponentSynths.push({ osc, filter, panner, gain });
        }
      }
    } catch (e) {
      console.warn('[SoundManager] Error initializing spatial opponent synths:', e);
    }
  }

  /**
   * Procedural police pursuit siren synthesizer (dual-tone wail & yelp).
   */
  private initSirenSynth(): void {
    if (!this.ctx || !this.effectsBusGain) return;

    try {
      const now = this.ctx.currentTime;
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();

      this.sirenOsc.type = 'sawtooth';
      this.sirenOsc.frequency.setValueAtTime(740, now);

      const sirenFilter = this.ctx.createBiquadFilter();
      sirenFilter.type = 'lowpass';
      sirenFilter.frequency.setValueAtTime(1400, now);

      this.sirenGain.gain.setValueAtTime(0.0001, now);

      this.sirenOsc.connect(sirenFilter);
      sirenFilter.connect(this.sirenGain);
      this.sirenGain.connect(this.effectsBusGain);

      this.sirenOsc.start(now);
    } catch (e) {
      console.warn('[SoundManager] Error initializing police siren synth:', e);
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

  /**
   * Updates procedural aerodynamic wind rush per frame based on forward velocity.
   * Activates above 120 km/h and scales smoothly up to 350+ km/h.
   */
  public updateWindRush(forwardSpeedMps: number, isActive: boolean): void {
    if (!this.isInitialized || !this.ctx || !this.windGain || !this.windFilter) return;

    try {
      const now = this.ctx.currentTime;
      const speedKmh = Math.abs(forwardSpeedMps) * 3.6;

      if (!isActive || speedKmh < 110) {
        this.windGain.gain.setTargetAtTime(0.0001, now, 0.1);
        return;
      }

      // Wind rush scales from 110 km/h up to 340 km/h
      const factor = Math.min(1.0, (speedKmh - 110) / 210.0);
      const targetGain = factor * 0.26 * (this.isMuted ? 0 : 1.0);
      const targetCutoff = 350 + Math.pow(factor, 1.4) * 2600;

      this.windGain.gain.setTargetAtTime(targetGain, now, 0.08);
      this.windFilter.frequency.setTargetAtTime(targetCutoff, now, 0.08);
    } catch {}
  }

  /**
   * Updates 3D spatial engine roar for nearby AI opponents.
   * Uses relative position and vehicle heading for stereo panning and distance attenuation.
   */
  public updateOpponentsAudio(
    playerPos: { x: number; z: number; yaw: number },
    opponents: { position: { x: number; z: number }; forwardSpeed: number }[],
    isActive: boolean
  ): void {
    if (!this.isInitialized || !this.ctx || this.opponentSynths.length === 0) return;

    try {
      const now = this.ctx.currentTime;
      if (!isActive) {
        for (const ch of this.opponentSynths) {
          ch.gain.gain.setTargetAtTime(0.0001, now, 0.06);
        }
        return;
      }

      for (let i = 0; i < this.opponentSynths.length; i++) {
        const ch = this.opponentSynths[i];
        const opp = opponents[i];

        if (!opp) {
          ch.gain.gain.setTargetAtTime(0.0001, now, 0.06);
          continue;
        }

        const dx = opp.position.x - playerPos.x;
        const dz = opp.position.z - playerPos.z;
        const dist = Math.hypot(dx, dz);

        // Audible radius: within 35m
        if (dist > 35.0) {
          ch.gain.gain.setTargetAtTime(0.0001, now, 0.08);
          continue;
        }

        // Relative lateral angle for stereo panning
        const cosY = Math.cos(-playerPos.yaw);
        const sinY = Math.sin(-playerPos.yaw);
        const localX = dx * cosY - dz * sinY;

        const pan = Math.max(-1.0, Math.min(1.0, localX / 8.5));
        ch.panner.pan.setTargetAtTime(pan, now, 0.04);

        // Attenuation with distance (quadratic falloff)
        const distFactor = Math.max(0, 1.0 - dist / 35.0);
        const targetGain = distFactor * distFactor * 0.28 * (this.isMuted ? 0 : 1.0);
        ch.gain.gain.setTargetAtTime(targetGain, now, 0.04);

        // Frequency scales with forward speed
        const speed = Math.max(0, opp.forwardSpeed);
        const freq = 50 + Math.min(280, speed * 4.2);
        ch.osc.frequency.setTargetAtTime(freq, now, 0.04);

        const cutoff = 280 + Math.min(2200, speed * 26);
        ch.filter.frequency.setTargetAtTime(cutoff, now, 0.04);
      }
    } catch {}
  }

  /**
   * Updates police siren volume and frequency modulation based on distance to pursuing unit.
   * Modulates dual-tone wail frequency and applies realistic atmospheric distance falloff.
   */
  public updatePoliceSiren(distMeters: number, isPursuitActive: boolean): void {
    if (!this.isInitialized || !this.ctx || !this.sirenOsc || !this.sirenGain) return;

    try {
      const now = this.ctx.currentTime;
      if (!isPursuitActive || distMeters > 95.0) {
        this.sirenGain.gain.setTargetAtTime(0.0001, now, 0.12);
        return;
      }

      // Rapid dual-tone emergency sweep: cycles 740 Hz to 1080 Hz
      const sweepRate = distMeters < 20.0 ? 2.2 : 1.4; // Yelps faster when tailing close
      const cycle = Math.sin(now * sweepRate * Math.PI * 2);
      const targetFreq = 880 + cycle * 180;
      this.sirenOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);

      // Distance attenuation: loud within 15m, smoothly dropping to zero at 95m
      const distFactor = Math.max(0, 1.0 - distMeters / 95.0);
      const targetGain = Math.pow(distFactor, 1.4) * 0.22 * (this.isMuted ? 0 : 1.0);
      this.sirenGain.gain.setTargetAtTime(targetGain, now, 0.06);
    } catch {}
  }

  // ==========================================
  // DISCRETE RACING & VEHICLE SFX
  // ==========================================

  /**
   * Authentic multi-stage compressor surge turbo flutter ('stututu') on throttle lift.
   * Features high-pressure blow-off crack followed by 6 resonant acoustic chop pulses.
   */
  public playTurboBlowOff(intensity: number = 1.0): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001 || !this.noiseBuffer) return;

    const nowMs = performance.now();
    if (nowMs - this.lastBlowOffTime < 420) return; // Debounce
    this.lastBlowOffTime = nowMs;

    try {
      const now = this.ctx.currentTime;
      const flutterCount = 6;
      const baseFreq = 2900;
      const effectiveIntensity = Math.max(0.6, Math.min(1.5, intensity));

      // 1. Initial High-Pressure Vent Psssh Crack
      const ventNoise = this.ctx.createBufferSource();
      ventNoise.buffer = this.noiseBuffer;
      const ventFilter = this.ctx.createBiquadFilter();
      ventFilter.type = 'bandpass';
      ventFilter.frequency.setValueAtTime(3600, now);
      ventFilter.Q.setValueAtTime(3.5, now);
      const ventGain = this.ctx.createGain();
      ventGain.gain.setValueAtTime(0.55 * effectiveIntensity, now);
      ventGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      ventNoise.connect(ventFilter);
      ventFilter.connect(ventGain);
      ventGain.connect(this.effectsBusGain);
      ventNoise.start(now);
      ventNoise.stop(now + 0.1);

      // 2. Rhythmic Compressor Flutter Chop ('stu-tu-tu-tu-tu-tsh')
      for (let i = 0; i < flutterCount; i++) {
        const pulseTime = now + 0.045 + i * 0.054;
        const pulseDuration = 0.052;
        const pulseFreq = Math.max(950, baseFreq - i * 290);

        // Filtered white noise body
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(pulseFreq, pulseTime);
        filter.Q.setValueAtTime(7.8 + i * 0.4, pulseTime); // High Q for distinctive whistle chirp

        const gain = this.ctx.createGain();
        const decay = Math.pow(0.84, i);
        const pulseVol = 0.68 * decay * effectiveIntensity;
        gain.gain.setValueAtTime(pulseVol, pulseTime);
        gain.gain.exponentialRampToValueAtTime(0.001, pulseTime + pulseDuration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.effectsBusGain);

        noise.start(pulseTime);
        noise.stop(pulseTime + pulseDuration + 0.01);

        // Acoustic blade whistle resonance oscillator (creates the sharp 'tu' chirp)
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pulseFreq * 0.72, pulseTime);
        osc.frequency.exponentialRampToValueAtTime(pulseFreq * 0.45, pulseTime + pulseDuration);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.24 * decay * effectiveIntensity, pulseTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, pulseTime + pulseDuration);

        osc.connect(oscGain);
        oscGain.connect(this.effectsBusGain);

        osc.start(pulseTime);
        osc.stop(pulseTime + pulseDuration + 0.01);
      }
    } catch {}
  }

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

  /**
   * Urgent warning pulse for final 5 seconds before car elimination.
   */
  public playEliminationWarning(): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.effectsBusGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  /**
   * Dramatic elimination drop chord when a car is knocked out.
   */
  public playEliminationChime(isPlayerEliminated: boolean = false): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;
    try {
      const now = this.ctx.currentTime;
      const baseFreq = isPlayerEliminated ? 95 : 190;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.45, now + 0.7);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      osc.connect(gain);
      gain.connect(this.effectsBusGain);
      osc.start(now);
      osc.stop(now + 0.8);
    } catch {}
  }

  /**
   * Electronic radar chime and camera shutter snap when speeding past a speed trap.
   */
  public playRadarFlash(_speedKmh: number = 0): void {
    this.initContext();
    if (!this.ctx || !this.effectsBusGain || this.isMuted || this.effectsVolume <= 0.001) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.14);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.effectsBusGain);
      osc.start(now);
      osc.stop(now + 0.25);
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

  public setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1.0, vol));
    if (this.musicBusGain && this.ctx) {
      this.musicBusGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
    }
    if (this.musicSynth) {
      this.musicSynth.setVolume(this.musicVolume);
    }
  }

  public getMusicVolume(): number {
    return this.musicVolume;
  }

  public startMusic(mode: MusicTrackMode): void {
    this.initContext();
    if (this.musicSynth) {
      this.musicSynth.startTrack(mode);
    }
  }

  public stopMusic(fadeTime: number = 0.2): void {
    if (this.musicSynth) {
      this.musicSynth.stopTrack(fadeTime);
    }
  }

  public setMusicIntensity(intensity: number): void {
    if (this.musicSynth) {
      this.musicSynth.setIntensity(intensity);
    }
  }

  public setMusicPaused(isPaused: boolean): void {
    if (this.musicSynth) {
      this.musicSynth.setPauseFilter(isPaused);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      const effective = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
    }
    if (this.musicSynth) {
      this.musicSynth.setMuted(this.isMuted);
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
