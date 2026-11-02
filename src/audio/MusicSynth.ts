export type MusicTrackMode = 'menu' | 'race' | 'none';

export class MusicSynth {
  private ctx: AudioContext;
  private isRunning: boolean = false;
  private currentMode: MusicTrackMode = 'none';

  // Volume & Master controls
  private volume: number = 0.7;
  private isMuted: boolean = false;
  private masterGain: GainNode;
  private filterNode: BiquadFilterNode;

  // Clock & Scheduling
  private bpm: number = 132;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private timerId: number | null = null;
  private lookaheadMs: number = 30;
  private scheduleAheadTimeSec: number = 0.12;

  // Intensity modifier (0.0 - 1.0, e.g. boosted at top speed or final lap)
  private intensity: number = 0.5;

  // Shared noise buffer for drum synthesis
  private noiseBuffer: AudioBuffer | null = null;

  constructor(ctx: AudioContext, destination: GainNode) {
    this.ctx = ctx;

    // Master bus for music synth
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);

    // Dynamic track master filter (for intensity, lowpass muffling on pause/menus)
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(14000, this.ctx.currentTime);
    this.filterNode.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.masterGain.connect(this.filterNode);
    this.filterNode.connect(destination);

    this.createNoiseBuffer();
  }

  private createNoiseBuffer(): void {
    const rate = this.ctx.sampleRate;
    const len = rate * 1.5;
    this.noiseBuffer = this.ctx.createBuffer(1, len, rate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1.0, vol));
    const effective = this.isMuted ? 0 : this.volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    const effective = this.isMuted ? 0 : this.volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(effective, this.ctx.currentTime, 0.05);
    }
  }

  public setIntensity(val: number): void {
    this.intensity = Math.max(0, Math.min(1.0, val));
    if (this.filterNode && this.ctx) {
      const targetCutoff = 6000 + this.intensity * 12000;
      this.filterNode.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.2);
    }
  }

  public setPauseFilter(isPaused: boolean): void {
    if (!this.filterNode || !this.ctx) return;
    const targetCutoff = isPaused ? 950 : (6000 + this.intensity * 12000);
    this.filterNode.frequency.setTargetAtTime(targetCutoff, this.ctx.currentTime, 0.15);
  }

  /**
   * Starts playing a track ('menu' or 'race').
   */
  public startTrack(mode: MusicTrackMode): void {
    if (this.currentMode === mode && this.isRunning) return;

    this.stopTrack(0.1);
    this.currentMode = mode;
    if (mode === 'none') return;

    this.bpm = mode === 'menu' ? 108 : 134;
    this.currentStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.isRunning = true;

    // Reset filter
    this.setIntensity(mode === 'race' ? 0.6 : 0.25);

    // Start scheduling loop
    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  /**
   * Stops the active track with optional fade-out.
   */
  public stopTrack(fadeTime: number = 0.2): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
    this.currentMode = 'none';

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fadeTime);
      setTimeout(() => {
        if (!this.isRunning && this.masterGain && this.ctx) {
          const effective = this.isMuted ? 0 : this.volume;
          this.masterGain.gain.setValueAtTime(effective, this.ctx.currentTime);
        }
      }, fadeTime * 1000 + 50);
    }
  }

  public getCurrentMode(): MusicTrackMode {
    return this.currentMode;
  }

  private scheduler(): void {
    if (!this.isRunning || !this.ctx) return;

    // Schedule any steps that fall within the scheduleAhead window
    while (this.nextStepTime < this.ctx.currentTime + this.scheduleAheadTimeSec) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    // 16th note duration = (60 / bpm) / 4 seconds
    const secondsPer16th = 60.0 / this.bpm / 4.0;
    this.nextStepTime += secondsPer16th;
    this.currentStep = (this.currentStep + 1) % 64; // 4-bar pattern loop (64 steps)
  }

  private scheduleStep(step: number, time: number): void {
    if (this.currentMode === 'race') {
      this.scheduleRaceStep(step, time);
    } else if (this.currentMode === 'menu') {
      this.scheduleMenuStep(step, time);
    }
  }

  // =========================================================================
  // RACE SYNTHWAVE SOUNDTRACK: "APEX IGNITION" (134 BPM, High Octane)
  // =========================================================================
  private scheduleRaceStep(step: number, time: number): void {
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;

    // 1. Drum Section: Four-on-the-floor kick, snappy snare on 4 & 12, driving 16th hats
    if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
      this.triggerKick(time, 1.0);
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this.triggerSnare(time, 0.85);
    }
    // Closed hi-hat on every off-beat or 16th note
    if (stepInBar % 2 === 1) {
      const hatVelocity = (stepInBar % 4 === 2) ? 0.55 : 0.35;
      this.triggerHiHat(time, hatVelocity);
    }

    // 2. Rolling 16th-Note Bassline: Am -> F -> C -> G
    // Root notes: A1(33), F1(29), C2(36), G1(31)
    const roots = [33, 29, 36, 31];
    const root = roots[bar % 4];

    // Classic synthwave rolling octave pattern: [root, root+12, root, root+12...]
    let bassNote = root;
    if (stepInBar % 4 === 1 || stepInBar % 4 === 3) {
      bassNote = root + 12; // Octave pop
    } else if (stepInBar === 14) {
      bassNote = root + 7; // Fifth transition
    } else if (stepInBar === 15) {
      bassNote = root + 10;
    }

    this.triggerSynthBass(time, bassNote, 0.12, 0.65);

    // 3. Arpeggiator Lead: 16th-note driving melody in A minor
    const arpNotesAm = [
      57, 60, 64, 69, 64, 60, 57, 60,
      64, 67, 69, 72, 69, 67, 64, 60
    ];
    const arpNotesF = [
      53, 57, 60, 65, 60, 57, 53, 57,
      60, 65, 69, 72, 69, 65, 60, 57
    ];
    const arpNotesC = [
      48, 52, 55, 60, 55, 52, 48, 52,
      55, 60, 64, 67, 64, 60, 55, 52
    ];
    const arpNotesG = [
      55, 59, 62, 67, 62, 59, 55, 59,
      62, 67, 71, 74, 71, 67, 62, 59
    ];
    const arpBanks = [arpNotesAm, arpNotesF, arpNotesC, arpNotesG];
    const leadNote = arpBanks[bar % 4][stepInBar];

    // Trigger lead arpeggio with dynamic filter
    const leadVelocity = 0.22 + this.intensity * 0.18;
    this.triggerLeadArp(time, leadNote, 0.10, leadVelocity);

    // 4. Accent chord stabs on beat 0 and 6 of each bar
    if (stepInBar === 0 || stepInBar === 6) {
      const chordMidis = bar === 0 ? [57, 64, 69] // Am
        : bar === 1 ? [53, 60, 65] // F
        : bar === 2 ? [48, 55, 60] // C
        : [55, 62, 67]; // G
      this.triggerPolyStab(time, chordMidis, 0.35, 0.28);
    }
  }

  // =========================================================================
  // MENU SYNTHWAVE SOUNDTRACK: "NIGHT DRIVE LOUNGE" (108 BPM, Deep & Moody)
  // =========================================================================
  private scheduleMenuStep(step: number, time: number): void {
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;

    // Gentle sub-kick on beat 0 and 8
    if (stepInBar === 0 || stepInBar === 8) {
      this.triggerKick(time, 0.65, true);
    }
    // Soft rimshot / clap on 8
    if (stepInBar === 8) {
      this.triggerSnare(time, 0.45);
    }
    // Soft shaker on every second 8th
    if (stepInBar % 4 === 2) {
      this.triggerHiHat(time, 0.22);
    }

    // Lush warm bass pulse on 0, 3, 6, 10
    const roots = [33, 29, 36, 31]; // Am, F, C, G
    const root = roots[bar % 4];
    if (stepInBar === 0 || stepInBar === 3 || stepInBar === 6 || stepInBar === 10) {
      this.triggerSynthBass(time, root, 0.35, 0.45, true);
    }

    // Ambient sustained pad on start of each bar
    if (stepInBar === 0) {
      const padChords = bar === 0 ? [45, 52, 57, 60] // Am
        : bar === 1 ? [41, 48, 53, 57] // F
        : bar === 2 ? [48, 55, 60, 64] // C
        : [43, 50, 55, 59]; // G
      this.triggerPad(time, padChords, 2.2, 0.22);
    }

    // Sparse melodic plucks
    if (stepInBar === 4 || stepInBar === 10 || stepInBar === 14) {
      const melodyNotes = [69, 72, 76, 74, 71, 67];
      const note = melodyNotes[(bar * 3 + Math.floor(stepInBar / 4)) % melodyNotes.length];
      this.triggerLeadArp(time, note, 0.25, 0.20, true);
    }
  }

  // =========================================================================
  // SYNTHESIS VOICES (Zero External Audio Dependency)
  // =========================================================================

  /**
   * Analog style punchy kick drum using pitch drop sine oscillator.
   */
  private triggerKick(time: number, velocity: number = 1.0, isSoft: boolean = false): void {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startFreq = isSoft ? 110 : 155;
      const endFreq = isSoft ? 40 : 35;
      const duration = isSoft ? 0.22 : 0.16;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

      const peakGain = (isSoft ? 0.45 : 0.75) * velocity;
      gain.gain.setValueAtTime(peakGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration + 0.02);
    } catch {}
  }

  /**
   * Snappy analog snare drum combining white noise burst and triangle body.
   */
  private triggerSnare(time: number, velocity: number = 0.8): void {
    if (!this.noiseBuffer) return;
    try {
      // 1. Noise burst (snap)
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, time);
      filter.Q.setValueAtTime(1.8, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35 * velocity, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noise.start(time);
      noise.stop(time + 0.16);

      // 2. Tonal body (punch)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);

      oscGain.gain.setValueAtTime(0.3 * velocity, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

      osc.connect(oscGain);
      oscGain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + 0.10);
    } catch {}
  }

  /**
   * Crisp hi-hat synthesized via highpass filtered white noise.
   */
  private triggerHiHat(time: number, velocity: number = 0.4): void {
    if (!this.noiseBuffer) return;
    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.25 * velocity, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      source.start(time);
      source.stop(time + 0.05);
    } catch {}
  }

  /**
   * Synthwave bassline voice: dual saw/triangle with fast envelope filter bite.
   */
  private triggerSynthBass(
    time: number,
    midiNote: number,
    duration: number,
    velocity: number = 0.6,
    isSoft: boolean = false
  ): void {
    try {
      const freq = this.midiToFreq(midiNote);
      const osc = this.ctx.createOscillator();
      const subOsc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = isSoft ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq * 0.5, time);

      // Resonant filter envelope
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(isSoft ? 1.5 : 4.0, time);
      const startCutoff = isSoft ? 500 : 1800;
      const endCutoff = isSoft ? 220 : 380;
      filter.frequency.setValueAtTime(startCutoff, time);
      filter.frequency.exponentialRampToValueAtTime(endCutoff, time + duration);

      gain.gain.setValueAtTime(0.4 * velocity, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      subOsc.start(time);
      osc.stop(time + duration + 0.02);
      subOsc.stop(time + duration + 0.02);
    } catch {}
  }

  /**
   * Melodic lead arpeggio voice: bright sawtooth/square with delay sensation.
   */
  private triggerLeadArp(
    time: number,
    midiNote: number,
    duration: number,
    velocity: number = 0.3,
    isPluck: boolean = false
  ): void {
    try {
      const freq = this.midiToFreq(midiNote);
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = isPluck ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isPluck ? 2000 : 3400, time);
      filter.Q.setValueAtTime(2.2, time);

      const amp = (isPluck ? 0.35 : 0.28) * velocity;
      gain.gain.setValueAtTime(amp, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);
      osc.stop(time + duration + 0.02);
    } catch {}
  }

  /**
   * Polyphonic accent chord stab.
   */
  private triggerPolyStab(
    time: number,
    midiNotes: number[],
    duration: number,
    velocity: number = 0.3
  ): void {
    midiNotes.forEach((midi, idx) => {
      try {
        const freq = this.midiToFreq(midi);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.12 * velocity, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration + 0.02);
      } catch {}
    });
  }

  /**
   * Warm ambient synth pad for menu and atmosphere.
   */
  private triggerPad(
    time: number,
    midiNotes: number[],
    duration: number,
    velocity: number = 0.2
  ): void {
    midiNotes.forEach((midi) => {
      try {
        const freq = this.midiToFreq(midi);
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.linearRampToValueAtTime(1400, time + duration * 0.5);
        filter.frequency.linearRampToValueAtTime(600, time + duration);

        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.08 * velocity, time + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(time);
        osc.stop(time + duration + 0.05);
      } catch {}
    });
  }

  public dispose(): void {
    this.stopTrack(0.05);
  }
}

