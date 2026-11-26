// Realistic Multi-Harmonic Automotive DSP Engine:
// Distinct real-style engine architectures (I4 VTEC, I4 ITB, Twin-Rotor Rotary, 1JZ/2JZ I6 Turbo, RB26 Twin-Turbo, Exotic V6, F1 V12),
// Exhaust Waveshaper Saturation, Combustion Air Noise, Turbo Spool Whistle, BOV Stututu Flutter, Overrun Exhaust Pops/Crackles,
// Dual-Formant Tire Screech, Wet Rain Road Spray, Realistic Metallic Crashes & Optional Midnight Soundtrack

export const ENGINE_PROFILES = {
  // [idleHz, redlineHz, hSub, h2, h3, h4, drive, formant1, formant2, idleLfoHz, vtecBoost]
  i4_vtec:   { idle: 30, redline: 145, hSub: 0.50, h2: 1.00, h3: 1.50, h4: 2.00, drive: 3.4, f1: 210, f2: 1100, chop: 0.04, vtec: true },
  i4_itb:    { idle: 32, redline: 158, hSub: 0.50, h2: 1.00, h3: 2.00, h4: 3.00, drive: 4.2, f1: 240, f2: 1450, chop: 0.08, vtec: false },
  rotary:    { idle: 44, redline: 235, hSub: 0.50, h2: 1.00, h3: 2.00, h4: 3.00, drive: 5.0, f1: 310, f2: 1950, chop: 0.22, vtec: false }, // Brap-brap idle!
  i6_turbo:  { idle: 36, redline: 175, hSub: 0.50, h2: 1.00, h3: 1.50, h4: 3.00, drive: 3.8, f1: 185, f2: 980,  chop: 0.05, vtec: false },
  rb26_twin: { idle: 39, redline: 196, hSub: 0.50, h2: 1.00, h3: 1.50, h4: 2.50, drive: 4.5, f1: 195, f2: 1280, chop: 0.06, vtec: false },
  v6_exotic: { idle: 42, redline: 212, hSub: 0.50, h2: 1.00, h3: 1.50, h4: 2.00, drive: 4.1, f1: 230, f2: 1560, chop: 0.05, vtec: false },
  v12_f1:    { idle: 62, redline: 340, hSub: 0.50, h2: 1.00, h3: 1.50, h4: 2.00, drive: 3.6, f1: 340, f2: 2450, chop: 0.02, vtec: false }
};

function makeExhaustCurve(amount = 4.0) {
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // Asymmetric warm tube/exhaust manifold saturation (adds realistic even & odd combustion harmonics)
    const biased = x + 0.14 * x * x;
    curve[i] = Math.tanh(biased * amount);
  }
  return curve;
}

const EXHAUST_CURVES = Object.fromEntries(
  Object.entries(ENGINE_PROFILES).map(([k, p]) => [k, makeExhaustCurve(p.drive)])
);

export class TokyoAudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.initialized = false;
    this.sfxBus = null;
    this.musicBus = null;

    // Multi-harmonic realistic engine graph
    this.oscSub = null;
    this.oscMain = null;
    this.oscHarm1 = null;
    this.oscHarm2 = null;
    this.idleLfo = null;
    this.idleLfoGain = null;
    this.intakeNoiseGain = null;
    this.intakeFilter = null;
    this.exhaustShaper = null;
    this.exhaustLowShelf = null;
    this.exhaustBodyFilter = null;
    this.exhaustSnarlFilter = null;
    this.engineGain = null;
    this.activeEngineType = null;

    // Turbocharger spool whine
    this.turboOsc = null;
    this.turboGain = null;
    this.boostPressure = 0;

    // Realistic dual-formant tire squeal + rubber scrub + wet rain spray
    this.screechF1 = null;
    this.screechF2 = null;
    this.screechGain = null;
    this.scrubGain = null;
    this.rainSprayGain = null;
    this.nitroGain = null;

    this.noiseBuf = null;
    this.pinkBuf = null;
    this.lastThrottle = false;
    this.lastGear = 1;
    this.lastRpm = 0.2;
    this.shiftCutTimer = 0;
    this.popCooldown = 0;
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

      // Master dynamics compressor so loud exhaust pops, turbo & screech punch cleanly without clipping!
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      comp.attack.value = 0.005;
      comp.release.value = 0.12;
      comp.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.settings.sfxEnabled ? 0.42 : 0;
      this.sfxBus.connect(comp);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.settings.musicEnabled ? 0.16 : 0;
      this.musicBus.connect(comp);

      // Build white & warm pink/brown noise buffers for exhaust air rush, pops, tire scrub & rain spray
      const sr = this.ctx.sampleRate;
      const bufLen = sr * 2;
      this.noiseBuf = this.ctx.createBuffer(1, bufLen, sr);
      this.pinkBuf = this.ctx.createBuffer(1, bufLen, sr);
      const wn = this.noiseBuf.getChannelData(0);
      const pn = this.pinkBuf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufLen; i++) {
        const white = Math.random() * 2 - 1;
        wn[i] = white;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.950 * b2 + white * 0.048;
        pn[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.05) * 2.2));
      }

      // === 1. REALISTIC MULTI-HARMONIC AUTOMOTIVE ENGINE SYNTH ===
      const preMix = this.ctx.createGain();
      preMix.gain.value = 0.55;

      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'triangle';
      const gSub = this.ctx.createGain(); gSub.gain.value = 0.58;

      this.oscMain = this.ctx.createOscillator();
      this.oscMain.type = 'sawtooth';
      const gMain = this.ctx.createGain(); gMain.gain.value = 0.52;

      this.oscHarm1 = this.ctx.createOscillator();
      this.oscHarm1.type = 'sawtooth';
      const gH1 = this.ctx.createGain(); gH1.gain.value = 0.30;

      this.oscHarm2 = this.ctx.createOscillator();
      this.oscHarm2.type = 'square';
      const gH2 = this.ctx.createGain(); gH2.gain.value = 0.14;

      // Subtle combustion chop LFO (gives rotary "brap-brap" & cammed idle rumble!)
      this.idleLfo = this.ctx.createOscillator();
      this.idleLfo.type = 'sine';
      this.idleLfo.frequency.value = 9;
      this.idleLfoGain = this.ctx.createGain();
      this.idleLfoGain.gain.value = 0.06;
      this.idleLfo.connect(this.idleLfoGain);
      this.idleLfoGain.connect(preMix.gain);

      // Intake & combustion exhaust roar noise mixed BEFORE waveshaper!
      const intakeSrc = this.ctx.createBufferSource();
      intakeSrc.buffer = this.pinkBuf;
      intakeSrc.loop = true;
      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.frequency.value = 320;
      this.intakeFilter.Q.value = 1.6;
      this.intakeNoiseGain = this.ctx.createGain();
      this.intakeNoiseGain.gain.value = 0.22;
      intakeSrc.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeNoiseGain);
      this.intakeNoiseGain.connect(preMix);
      intakeSrc.start();

      this.oscSub.connect(gSub); gSub.connect(preMix);
      this.oscMain.connect(gMain); gMain.connect(preMix);
      this.oscHarm1.connect(gH1); gH1.connect(preMix);
      this.oscHarm2.connect(gH2); gH2.connect(preMix);

      // Asymmetric Exhaust Waveshaper Saturation (transforms clean waves into throaty real engine roar!)
      this.exhaustShaper = this.ctx.createWaveShaper();
      this.exhaustShaper.curve = makeExhaustCurve(4.2);
      this.exhaustShaper.oversample = '2x';

      // Exhaust Muffler Low-End Chest Thump + Resonant Tailpipe Formant + Throttle Lowpass
      this.exhaustLowShelf = this.ctx.createBiquadFilter();
      this.exhaustLowShelf.type = 'lowshelf';
      this.exhaustLowShelf.frequency.value = 140;
      this.exhaustLowShelf.gain.value = 7.5;

      this.exhaustBodyFilter = this.ctx.createBiquadFilter();
      this.exhaustBodyFilter.type = 'peaking';
      this.exhaustBodyFilter.frequency.value = 240;
      this.exhaustBodyFilter.Q.value = 2.0;
      this.exhaustBodyFilter.gain.value = 5.5;

      this.exhaustSnarlFilter = this.ctx.createBiquadFilter();
      this.exhaustSnarlFilter.type = 'lowpass';
      this.exhaustSnarlFilter.frequency.value = 950;
      this.exhaustSnarlFilter.Q.value = 2.2;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;

      preMix.connect(this.exhaustShaper);
      this.exhaustShaper.connect(this.exhaustLowShelf);
      this.exhaustLowShelf.connect(this.exhaustBodyFilter);
      this.exhaustBodyFilter.connect(this.exhaustSnarlFilter);
      this.exhaustSnarlFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxBus);

      this.oscSub.start();
      this.oscMain.start();
      this.oscHarm1.start();
      this.oscHarm2.start();
      this.idleLfo.start();

      // === 2. TURBOCHARGER SPOOL WHISTLE ===
      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.value = 2600;
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.value = 0;
      this.turboOsc.connect(this.turboGain);
      this.turboGain.connect(this.sfxBus);
      this.turboOsc.start();

      // === 3. REALISTIC DUAL-FORMANT TIRE SQUEAL + RUBBER SCRUB ===
      const screechSrc = this.ctx.createBufferSource();
      screechSrc.buffer = this.noiseBuf;
      screechSrc.loop = true;

      this.screechF1 = this.ctx.createBiquadFilter();
      this.screechF1.type = 'bandpass';
      this.screechF1.frequency.value = 840;
      this.screechF1.Q.value = 11.0;

      this.screechF2 = this.ctx.createBiquadFilter();
      this.screechF2.type = 'bandpass';
      this.screechF2.frequency.value = 1520;
      this.screechF2.Q.value = 13.0;

      this.screechGain = this.ctx.createGain();
      this.screechGain.gain.value = 0;

      screechSrc.connect(this.screechF1);
      screechSrc.connect(this.screechF2);
      this.screechF1.connect(this.screechGain);
      this.screechF2.connect(this.screechGain);
      this.screechGain.connect(this.sfxBus);
      screechSrc.start();

      // Low rubber scrub & wet road tire spray
      const spraySrc = this.ctx.createBufferSource();
      spraySrc.buffer = this.pinkBuf;
      spraySrc.loop = true;

      const scrubFilter = this.ctx.createBiquadFilter();
      scrubFilter.type = 'bandpass';
      scrubFilter.frequency.value = 280;
      scrubFilter.Q.value = 1.5;
      this.scrubGain = this.ctx.createGain();
      this.scrubGain.gain.value = 0;

      const rainFilter = this.ctx.createBiquadFilter();
      rainFilter.type = 'highpass';
      rainFilter.frequency.value = 2200;
      this.rainSprayGain = this.ctx.createGain();
      this.rainSprayGain.gain.value = 0;

      spraySrc.connect(scrubFilter); scrubFilter.connect(this.scrubGain); this.scrubGain.connect(this.sfxBus);
      spraySrc.connect(rainFilter); rainFilter.connect(this.rainSprayGain); this.rainSprayGain.connect(this.sfxBus);
      spraySrc.start();

      // === 4. NITROUS JET ROAR ===
      const nitroSrc = this.ctx.createBufferSource();
      nitroSrc.buffer = this.noiseBuf;
      nitroSrc.loop = true;
      const nitroFilter = this.ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.value = 620;
      nitroFilter.Q.value = 1.1;
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
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxEnabled ? 0.42 : 0, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.settings.musicEnabled ? 0.16 : 0, t, 0.08);
  }

  updateVehicle({ rpm, gear, slip, nitro, throttle, engineType = 'rb26_twin', hasTurbo = true, speed = 0, weather = 'rain', active }) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const profKey = ENGINE_PROFILES[engineType] ? engineType : 'rb26_twin';
    const prof = ENGINE_PROFILES[profKey];

    if (this.activeEngineType !== profKey) {
      this.activeEngineType = profKey;
      this.exhaustShaper.curve = EXHAUST_CURVES[profKey];
    }

    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, t, 0.08);
      this.turboGain.gain.setTargetAtTime(0, t, 0.06);
      this.screechGain.gain.setTargetAtTime(0, t, 0.05);
      this.scrubGain.gain.setTargetAtTime(0, t, 0.05);
      this.rainSprayGain.gain.setTargetAtTime(0, t, 0.08);
      this.nitroGain.gain.setTargetAtTime(0, t, 0.05);
      return;
    }

    // Brief ignition torque-cut on upshift (gives authentic crisp real gear changes!)
    if (this.shiftCutTimer > 0) this.shiftCutTimer -= 0.016;
    if (this.popCooldown > 0) this.popCooldown -= 0.016;

    if (this.settings.sfxEnabled) {
      if (typeof gear === 'number' && typeof this.lastGear === 'number') {
        if (gear > this.lastGear) {
          this.shiftCutTimer = 0.065;
          this.playExhaustPop(0.85);
          if (hasTurbo && this.boostPressure > 0.35) this.playTurboFlutter(this.boostPressure);
        } else if (gear < this.lastGear && speed > 15) {
          // Downshift rev-match exhaust crackle!
          this.playExhaustPop(0.6);
        }
      }
      // Lifting off gas at high RPM -> turbo flutter + overrun exhaust burble/pops!
      if (this.lastThrottle && !throttle && rpm > 0.56) {
        if (hasTurbo && this.boostPressure > 0.32) this.playTurboFlutter(this.boostPressure);
        if (this.popCooldown <= 0) {
          this.playOverrunBurble();
          this.popCooldown = 0.65;
        }
      }
    }
    this.lastGear = gear;
    this.lastThrottle = throttle;
    this.lastRpm = rpm;

    // Turbo boost pressure buildup
    const boostTarget = (hasTurbo && throttle && rpm > 0.35) ? Math.min(1, (rpm - 0.3) * 1.45 + (nitro ? 0.3 : 0)) : 0;
    this.boostPressure += (boostTarget - this.boostPressure) * (throttle ? 0.09 : 0.18);

    // Authentic rev-limiter fuel-cut stutter right at redline!
    const limiterCut = (rpm > 0.965 && throttle && Math.sin(t * 95) > 0.35) ? 0.28 : 1.0;

    // Firing fundamental frequency (real exponential RPM feel)
    const rCurve = Math.pow(Math.max(0.05, rpm), 1.08);
    const f0 = prof.idle + (prof.redline - prof.idle) * rCurve + (nitro ? 16 : 0);

    // VTEC cam-crossover kick above 68% RPM on 4-cylinder starter!
    const vtecKick = (prof.vtec && rpm > 0.68 && throttle) ? 1.35 : 1.0;

    this.oscSub.frequency.setTargetAtTime(f0 * prof.hSub, t, 0.025);
    this.oscMain.frequency.setTargetAtTime(f0 * prof.h2, t, 0.025);
    this.oscHarm1.frequency.setTargetAtTime(f0 * prof.h3 * 1.003, t, 0.025);
    this.oscHarm2.frequency.setTargetAtTime(f0 * prof.h4 * 0.998, t, 0.025);

    // Choppy idle modulation fades out as RPM rises (authentic ported rotary & high-cam idle!)
    const idleFactor = Math.max(0, 1 - rpm * 2.4);
    this.idleLfo.frequency.setTargetAtTime(7 + rpm * 18, t, 0.05);
    this.idleLfoGain.gain.setTargetAtTime(prof.chop * (0.3 + idleFactor * 1.6), t, 0.05);

    // Throttle load opens up exhaust snarl & intake air roar dramatically (just like a real gas pedal!)
    const load = throttle ? 1.0 : 0.32;
    const cutMult = (this.shiftCutTimer > 0 ? 0.35 : 1.0) * limiterCut;
    const snarlCutoff = (prof.f1 + (prof.f2 - prof.f1) * rpm * load * vtecKick) * (nitro ? 1.35 : 1.0);
    this.exhaustBodyFilter.frequency.setTargetAtTime(prof.f1 * (0.85 + rpm * 0.6), t, 0.04);
    this.exhaustSnarlFilter.frequency.setTargetAtTime(Math.min(4800, snarlCutoff), t, 0.035);
    this.intakeFilter.frequency.setTargetAtTime(220 + rpm * 1200, t, 0.04);
    this.intakeNoiseGain.gain.setTargetAtTime((0.12 + rpm * 0.28) * load, t, 0.04);

    const engVol = (0.16 + rpm * 0.22 * (0.55 + load * 0.45)) * cutMult * vtecKick;
    this.engineGain.gain.setTargetAtTime(engVol, t, 0.03);

    // Turbo spool whistle (distinctive JDM turbine whine rising under boost)
    const turboFreq = 2200 + this.boostPressure * 3900;
    this.turboOsc.frequency.setTargetAtTime(turboFreq, t, 0.05);
    this.turboGain.gain.setTargetAtTime(hasTurbo ? this.boostPressure * 0.038 : 0, t, 0.05);

    // Dual-formant realistic tire squeal + rubber scrub
    const slipClamped = Math.max(0, Math.min(1, slip));
    this.screechF1.frequency.setTargetAtTime(760 + slipClamped * 320, t, 0.04);
    this.screechF2.frequency.setTargetAtTime(1420 + slipClamped * 540, t, 0.04);
    this.screechGain.gain.setTargetAtTime(slipClamped * 0.26, t, 0.04);
    this.scrubGain.gain.setTargetAtTime(slipClamped * 0.22, t, 0.04);

    // Wet Tokyo rain road spray hiss proportional to vehicle speed in Rain!
    const rainAmt = (weather === 'rain') ? Math.min(1, speed / 55) * 0.095 : 0;
    this.rainSprayGain.gain.setTargetAtTime(rainAmt, t, 0.08);

    // Nitrous jet roar
    this.nitroGain.gain.setTargetAtTime(nitro ? 0.28 : 0, t, 0.04);
  }

  // Realistic Garage / Menu Car Selection Exhaust Rev Blip (so you hear every engine tier!)
  playRevBlip(engineType = 'rb26_twin', hasTurbo = true) {
    if (!this.initialized || !this.settings.sfxEnabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const profKey = ENGINE_PROFILES[engineType] ? engineType : 'rb26_twin';
    const prof = ENGINE_PROFILES[profKey];

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const shaper = this.ctx.createWaveShaper();
    const flt = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc3.type = 'sawtooth';
    shaper.curve = EXHAUST_CURVES[profKey];
    flt.type = 'lowpass';
    flt.Q.value = 2.4;

    const fLow = prof.idle * 1.15;
    const fPeak = prof.idle + (prof.redline - prof.idle) * 0.80;
    osc1.frequency.setValueAtTime(fLow, t);
    osc1.frequency.exponentialRampToValueAtTime(fPeak, t + 0.20);
    osc1.frequency.exponentialRampToValueAtTime(fLow * 1.04, t + 0.60);

    osc2.frequency.setValueAtTime(fLow * prof.hSub, t);
    osc2.frequency.exponentialRampToValueAtTime(fPeak * prof.hSub, t + 0.20);
    osc2.frequency.exponentialRampToValueAtTime(fLow * prof.hSub * 1.04, t + 0.60);

    osc3.frequency.setValueAtTime(fLow * prof.h3, t);
    osc3.frequency.exponentialRampToValueAtTime(fPeak * prof.h3, t + 0.20);
    osc3.frequency.exponentialRampToValueAtTime(fLow * prof.h3 * 1.04, t + 0.60);

    const g3 = this.ctx.createGain();
    g3.gain.value = 0.42;

    flt.frequency.setValueAtTime(prof.f1, t);
    flt.frequency.exponentialRampToValueAtTime(prof.f2 * 1.18, t + 0.19);
    flt.frequency.exponentialRampToValueAtTime(prof.f1 * 0.9, t + 0.60);

    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    osc1.connect(shaper);
    osc2.connect(shaper);
    osc3.connect(g3); g3.connect(shaper);
    shaper.connect(flt); flt.connect(g); g.connect(this.sfxBus);
    osc1.start(t); osc2.start(t); osc3.start(t);
    osc1.stop(t + 0.68); osc2.stop(t + 0.68); osc3.stop(t + 0.68);

    if (hasTurbo) setTimeout(() => this.playTurboFlutter(0.78), 215);
    if (profKey === 'rotary' || profKey === 'rb26_twin' || profKey === 'v6_exotic' || profKey === 'v12_f1') {
      setTimeout(() => this.playExhaustPop(0.55), 340);
    }
  }

  // Deep muffled exhaust backfire pop
  playExhaustPop(intensity = 0.8) {
    if (!this.initialized || !this.settings.sfxEnabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(420 + intensity * 300, t);
    flt.frequency.exponentialRampToValueAtTime(95, t + 0.11);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.42 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(flt); flt.connect(g); g.connect(this.sfxBus);
    src.start(t); src.stop(t + 0.13);
  }

  // Authentic JDM exhaust overrun crackle-pop sequence when lifting throttle!
  playOverrunBurble() {
    const pops = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pops; i++) {
      setTimeout(() => this.playExhaustPop(0.42 + Math.random() * 0.35), i * (75 + Math.random() * 55));
    }
  }

  // Iconic JDM Turbo Blow-Off Valve "STUTUTU" compressor surge flutter!
  playTurboFlutter(boost = 0.8) {
    if (!this.initialized || !this.settings.sfxEnabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const pulses = 4;
    for (let i = 0; i < pulses; i++) {
      const st = t + i * 0.056;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2200 - i * 260, st);
      bp.Q.value = 6.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime((0.15 * boost) / (1 + i * 0.45), st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.048);
      src.connect(bp); bp.connect(g); g.connect(this.sfxBus);
      src.start(st); src.stop(st + 0.052);
    }
  }

  // Realistic layered metallic chassis crunch + sub-bass impact thud
  playCollision(intensity = 0.7) {
    if (!this.initialized || !this.settings.sfxEnabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    // 1. Sub-bass thud
    const thud = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(115, t);
    thud.frequency.exponentialRampToValueAtTime(28, t + 0.22);
    tg.gain.setValueAtTime(Math.min(0.55, 0.22 + intensity * 0.32), t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    thud.connect(tg); tg.connect(this.sfxBus);
    thud.start(t); thud.stop(t + 0.26);

    // 2. Metallic crunch noise burst
    const crunch = this.ctx.createBufferSource();
    crunch.buffer = this.noiseBuf;
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.setValueAtTime(950, t);
    cf.frequency.exponentialRampToValueAtTime(280, t + 0.26);
    cf.Q.value = 1.4;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(Math.min(0.5, 0.16 + intensity * 0.32), t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    crunch.connect(cf); cf.connect(cg); cg.connect(this.sfxBus);
    crunch.start(t); crunch.stop(t + 0.30);
  }

  playSFX(type) {
    if (!this.initialized || !this.settings.sfxEnabled || !this.ctx) return;
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
      g.gain.setValueAtTime(0.20, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(this.sfxBus);
      osc.start(t); osc.stop(t + 0.24);
    } else if (type === 'bank') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t);
      osc.frequency.setValueAtTime(783.99, t + 0.06);
      osc.frequency.setValueAtTime(1046.5, t + 0.12);
      g.gain.setValueAtTime(0.18, t);
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

  // Subtle Original Tokyo Midnight Electronic Groove (sits cleanly under the realistic engine roar)
  _startMusicSequencer() {
    const bassSeq = [55, 55, 65.41, 55, 73.42, 65.41, 49, 55];
    const leadSeq = [440, 0, 523.25, 0, 587.33, 523.25, 493.88, 0, 440, 0, 659.25, 0, 587.33, 0, 523.25, 440];
    this.musicInterval = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || !this.settings.musicEnabled) return;
      const t = this.ctx.currentTime;
      const s = this.step % 16;

      if (s % 4 === 0) {
        const k = this.ctx.createOscillator();
        const kg = this.ctx.createGain();
        k.type = 'sine';
        k.frequency.setValueAtTime(135, t);
        k.frequency.exponentialRampToValueAtTime(36, t + 0.11);
        kg.gain.setValueAtTime(0.28, t);
        kg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        k.connect(kg); kg.connect(this.musicBus);
        k.start(t); k.stop(t + 0.15);
      }

      if (s % 2 === 0) {
        const bn = bassSeq[(s / 2) % bassSeq.length];
        const b = this.ctx.createOscillator();
        const bf = this.ctx.createBiquadFilter();
        const bg = this.ctx.createGain();
        b.type = 'sawtooth';
        b.frequency.setValueAtTime(bn, t);
        bf.type = 'lowpass';
        bf.frequency.setValueAtTime(340, t);
        bg.gain.setValueAtTime(0.14, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
        b.connect(bf); bf.connect(bg); bg.connect(this.musicBus);
        b.start(t); b.stop(t + 0.2);
      }

      if ((this.step % 64) >= 16) {
        const ln = leadSeq[s];
        if (ln > 0) {
          const l = this.ctx.createOscillator();
          const lg = this.ctx.createGain();
          l.type = 'triangle';
          l.frequency.setValueAtTime(ln, t);
          lg.gain.setValueAtTime(0.06, t);
          lg.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
          l.connect(lg); lg.connect(this.musicBus);
          l.start(t); l.stop(t + 0.14);
        }
      }
      this.step++;
    }, 116);
  }
}
