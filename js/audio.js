// Procedural Web Audio Engine: JDM Engines, Gear Shifts, Turbo Flutter, Tire Screech, Collisions & Tokyo Night Synth Soundtrack

export class TokyoAudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.initialized = false;
    this.sfxBus = null;
    this.musicBus = null;

    this.engOsc1 = null;
    this.engOsc2 = null;
    this.engFilter = null;
    this.engGain = null;

    this.screechGain = null;
    this.screechFilter = null;
    this.nitroGain = null;

    this.lastThrottle = false;
    this.lastGear = 1;
    this.musicInterval = null;
    this.step = 0;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.settings.sfxEnabled ? 0.34 : 0;
      this.sfxBus.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.settings.musicEnabled ? 0.24 : 0;
      this.musicBus.connect(this.ctx.destination);

      // JDM Engine (sawtooth + sub triangle + warm resonant lowpass)
      this.engFilter = this.ctx.createBiquadFilter();
      this.engFilter.type = 'lowpass';
      this.engFilter.frequency.value = 460;
      this.engFilter.Q.value = 2.6;

      this.engGain = this.ctx.createGain();
      this.engGain.gain.value = 0;

      this.engOsc1 = this.ctx.createOscillator();
      this.engOsc1.type = 'sawtooth';
      this.engOsc1.frequency.value = 60;

      this.engOsc2 = this.ctx.createOscillator();
      this.engOsc2.type = 'triangle';
      this.engOsc2.frequency.value = 120;

      this.engOsc1.connect(this.engFilter);
      this.engOsc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain);
      this.engGain.connect(this.sfxBus);
      this.engOsc1.start();
      this.engOsc2.start();

      // Shared white noise buffer
      const bufLen = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) ch[i] = Math.random() * 2 - 1;

      // Tire Screech
      const screechSrc = this.ctx.createBufferSource();
      screechSrc.buffer = noiseBuf;
      screechSrc.loop = true;

      this.screechFilter = this.ctx.createBiquadFilter();
      this.screechFilter.type = 'bandpass';
      this.screechFilter.frequency.value = 1180;
      this.screechFilter.Q.value = 7.0;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      screechSrc.connect(this.screechFilter);
      this.screechFilter.connect(this.screechGain);
      this.screechGain.connect(this.sfxBus);
      screechSrc.start();

      // Nitro Jet Roar
      const nitroSrc = this.ctx.createBufferSource();
      nitroSrc.buffer = noiseBuf;
      nitroSrc.loop = true;

      const nitroFilter = this.ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 540;
      nitroFilter.Q.value = 1.2;

      this.nitroGain = this.ctx.createGain();
      this.nitroGain.gain.value = 0;

      nitroSrc.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.sfxBus);
      nitroSrc.start();

      this._startMusicSequencer();
      this.initialized = true;
    } catch {}
  }

  syncVolumes() {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxEnabled ? 0.34 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.musicEnabled ? 0.24 : 0, t, 0.08);
  }

  updateVehicle({ rpm, gear, slip, nitro, throttle, enginePitch = 1.0, active }) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const mult = active ? 1.0 : 0.0;

    // Engine frequency & harmonic brightness
    const baseFreq = (54 + rpm * 155 + (nitro ? 32 : 0)) * enginePitch;
    this.engOsc1.frequency.setTargetAtTime(baseFreq, t, 0.035);
    this.engOsc2.frequency.setTargetAtTime(baseFreq * 1.502, t, 0.035);
    this.engFilter.frequency.setTargetAtTime(340 + rpm * 1250 + (nitro ? 600 : 0), t, 0.05);
    this.engGain.gain.setTargetAtTime((0.12 + rpm * 0.14) * mult, t, 0.05);

    // Gear-shift exhaust pop & turbo flutter
    if (active && this.settings.sfxEnabled) {
      if (typeof gear === 'number' && gear > this.lastGear && rpm < 0.7) {
        this.playBackfire();
      }
      if (this.lastThrottle && !throttle && rpm > 0.62) {
        this.playTurboFlutter();
      }
    }
    this.lastGear = gear;
    this.lastThrottle = throttle;

    // Tire screech
    const sg = Math.min(0.28, slip * 0.28) * mult;
    this.screechGain.gain.setTargetAtTime(sg, t, 0.04);
    this.screechFilter.frequency.setTargetAtTime(980 + slip * 540, t, 0.05);

    // Nitro roar
    this.nitroGain.gain.setTargetAtTime(nitro && active ? 0.32 : 0, t, 0.05);
  }

  playBackfire() {
    if (!this.initialized || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g); g.connect(this.sfxBus);
    osc.start(t); osc.stop(t + 0.11);
  }

  playTurboFlutter() {
    if (!this.initialized || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const st = t + i * 0.052;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650 - i * 240, st);
      osc.frequency.exponentialRampToValueAtTime(820, st + 0.044);
      g.gain.setValueAtTime(0.06 / (i + 1), st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.048);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(st); osc.stop(st + 0.05);
    }
  }

  playCollision(intensity = 0.7) {
    if (!this.initialized || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 + intensity * 70, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.24);
    g.gain.setValueAtTime(Math.min(0.45, 0.18 + intensity * 0.26), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g); g.connect(this.sfxBus);
    osc.start(t); osc.stop(t + 0.28);
  }

  playSFX(type) {
    if (!this.initialized || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (type === 'countdown') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.19);
    } else if (type === 'go') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t);
      g.gain.setValueAtTime(0.24, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.38);
    } else if (type === 'clip') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.setValueAtTime(990, t + 0.05);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.24);
    } else if (type === 'bank') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(783.99, t + 0.06);
      osc.frequency.setValueAtTime(1046.5, t + 0.12);
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.3);
    } else if (type === 'lap') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(587.33, t);
      osc.frequency.setValueAtTime(880, t + 0.08);
      osc.frequency.setValueAtTime(1174.66, t + 0.16);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.4);
    }
  }

  // Original Tokyo Midnight Electronic / Phonk-inspired procedural groove
  _startMusicSequencer() {
    const bassSeq = [55, 55, 65.41, 55, 73.42, 65.41, 49, 55];
    const leadSeq = [440, 0, 523.25, 0, 587.33, 523.25, 493.88, 0, 440, 0, 659.25, 0, 587.33, 0, 523.25, 440];
    this.musicInterval = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.settings.musicEnabled) return;
      const t = this.ctx.currentTime;
      const s = this.step % 16;

      // Punchy 4-on-the-floor kick
      if (s % 4 === 0) {
        const k = this.ctx.createOscillator();
        const kg = this.ctx.createGain();
        k.type = 'sine';
        k.frequency.setValueAtTime(140, t);
        k.frequency.exponentialRampToValueAtTime(36, t + 0.11);
        kg.gain.setValueAtTime(0.32, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        k.connect(kg); kg.connect(this.musicBus);
        k.start(t); k.stop(t + 0.15);
      }

      // Snare/Clap on 4 & 12
      if (s === 4 || s === 12) {
        const sn = this.ctx.createOscillator();
        const sg = this.ctx.createGain();
        sn.type = 'triangle';
        sn.frequency.setValueAtTime(240, t);
        sn.frequency.exponentialRampToValueAtTime(90, t + 0.08);
        sg.gain.setValueAtTime(0.14, t);
        sg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        sn.connect(sg); sg.connect(this.musicBus);
        sn.start(t); sn.stop(t + 0.1);
      }

      // Synthwave rolling bass
      if (s % 2 === 0) {
        const bn = bassSeq[(s / 2) % bassSeq.length];
        const b = this.ctx.createOscillator();
        const bf = this.ctx.createBiquadFilter();
        const bg = this.ctx.createGain();
        b.type = 'sawtooth';
        b.frequency.setValueAtTime(bn, t);
        bf.type = 'lowpass';
        bf.frequency.setValueAtTime(380, t);
        bg.gain.setValueAtTime(0.16, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        b.connect(bf); bf.connect(bg); bg.connect(this.musicBus);
        b.start(t); b.stop(t + 0.2);
      }

      // Neon synth arpeggio every second bar
      if ((this.step % 64) >= 16) {
        const ln = leadSeq[s];
        if (ln > 0) {
          const l = this.ctx.createOscillator();
          const lg = this.ctx.createGain();
          l.type = 'triangle';
          l.frequency.setValueAtTime(ln, t);
          lg.gain.setValueAtTime(0.08, t);
          lg.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          l.connect(lg); lg.connect(this.musicBus);
          l.start(t); l.stop(t + 0.14);
        }
      }

      this.step++;
    }, 116); // ~129 BPM
  }
}
