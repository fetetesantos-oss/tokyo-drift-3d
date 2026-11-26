// TOKYO DRIFT 3D | Main Orchestrator: 3D Chase Camera, 3D Garage Orbit, Adaptive Mobile Optimizer, HUD & Menus

import { Mat4, clamp, lerp, lerpAngle, hexToRgb01 } from './math.js';
import { CARS, PAINTS, RIMS, WINGS, SUSPENSIONS, DRIFT_SETUPS, UPGRADE_DEFS, computeCarStats } from './cars.js';
import { SaveManager, CHALLENGES } from './storage.js';
import { ControlManager } from './controls.js';
import { TokyoAudioEngine } from './audio.js';
import { TRACKS, buildWorld } from './world.js';
import { buildJDMCarMesh, buildWorldMeshes } from './mesh.js';
import { TokyoRenderer } from './renderer.js';
import { RaceSimulation } from './physics.js';

const MODES = [
  { id: 'drift_challenge', name: 'Desafio de Drift', badge: '2:00', desc: 'Faça combos, acerte Apex Clips e bata metas de pontuação.' },
  { id: 'circuit',         name: 'Circuito Urbano',  badge: '3 VOLTAS', desc: 'Corrida completa contra 3 rivais JDM com largada e chegada.' },
  { id: 'drift_battle',    name: 'Batalha de Drift', badge: '1v1', desc: 'Duelo direto contra o Drift King — vença no placar de drift.' },
  { id: 'time_attack',     name: 'Time Attack',      badge: 'CRONO', desc: '2 voltas limpas contra o relógio para cravar o melhor tempo.' },
  { id: 'free_drift',      name: 'Drift Livre',      badge: 'LIVRE', desc: 'Explore Tóquio sem cronômetro e pratique contra-esterço.' },
  { id: 'jdm_meet',        name: 'Encontro JDM',     badge: 'MEET', desc: 'Reunião noturna em Tóquio com carros customizados estacionados.' }
];

const WEATHERS = [
  { id: 'rain',  name: '🌧 Chuva Neon' },
  { id: 'clear', name: '🌙 Noite Limpa' },
  { id: 'fog',   name: '🌫 Neblina Tóquio' }
];

class TokyoDriftApp {
  constructor() {
    this.save = new SaveManager();
    this.settings = this.save.data.settings;
    this.controls = new ControlManager(this.settings);
    this.audio = new TokyoAudioEngine(this.settings);

    this.canvas = document.getElementById('glCanvas');
    this.miniCanvas = document.getElementById('minimapCanvas');
    this.miniCtx = this.miniCanvas ? this.miniCanvas.getContext('2d') : null;

    this.renderer = new TokyoRenderer(this.canvas);

    this.state = 'menu'; // 'menu' | 'garage' | 'racing' | 'paused' | 'results'
    this.world = null;
    this.worldMeshes = null;
    this.playerMesh = null;
    this.aiMeshes = [];
    this.trafficMesh = null;
    this.meetCarMeshes = [];
    this.sim = null;

    // 3rd-person Chase Camera & Garage Orbit Camera state
    this.camPos = [0, 4, -10];
    this.camTarget = [0, 1.2, 6];
    this.camYaw = 0;
    this.camFov = 62 * Math.PI / 180;
    this.garageAngle = -2.42;
    this.garageDrag = false;
    this.garageLastX = 0;
    this.portraitDismissed = false;

    // Adaptive Mobile Performance Governor
    this.fpsSamples = [];
    this.currentFps = 60;
    this.qualityScale = 1.0;
    this.particleBudget = 1.0;
    this.autoStepTimer = 0;
    this.tmpMat = Mat4.create();

    this._bindUI();
    this._applyQualityProfile();
    this._loadTrackAndGarageMeshes();
    this._renderAllMenus();
    this._checkOrientationGuard();

    // Expose read/test hook for verification
    window.__TOKYO_DRIFT_TEST__ = this;

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _getQualityConfig() {
    const s = this.settings;
    const q = s.quality || 'auto';
    const reflMap = { high: q === 'ultra' ? 1.25 : 1.0, medium: 0.55, off: 0.0 };
    const styleMap = { realistic: 0.0, neon: 1.0, cyberpunk: 2.0 };
    const dprScale = (q === 'auto') ? this.qualityScale : (s.resScale ?? 1.0);
    const particles = (q === 'auto') ? this.particleBudget : (s.particleDensity ?? 1.0);
    return {
      dprScale,
      particles,
      reflStrength: reflMap[s.reflections || 'high'] ?? 1.0,
      dynamicLights: s.dynamicLights !== false,
      drawDistance: Number(s.drawDistance) || 520,
      colorStyle: styleMap[s.visualStyle || 'realistic'] ?? 0.0
    };
  }

  _applyGraphicsPreset(preset) {
    const s = this.settings;
    s.quality = preset;
    if (preset === 'ultra') {
      s.resScale = 1.0; s.reflections = 'high'; s.dynamicLights = true; s.particleDensity = 1.0; s.drawDistance = 520;
    } else if (preset === 'high') {
      s.resScale = 0.92; s.reflections = 'high'; s.dynamicLights = true; s.particleDensity = 0.85; s.drawDistance = 440;
    } else if (preset === 'medium') {
      s.resScale = 0.78; s.reflections = 'medium'; s.dynamicLights = true; s.particleDensity = 0.6; s.drawDistance = 380;
    } else if (preset === 'low') {
      s.resScale = 0.58; s.reflections = 'off'; s.dynamicLights = false; s.particleDensity = 0.3; s.drawDistance = 260;
    } else if (preset === 'auto') {
      s.resScale = 1.0; s.reflections = 'high'; s.dynamicLights = true; s.particleDensity = 1.0; s.drawDistance = 520;
      this.qualityScale = 1.0; this.particleBudget = 1.0;
    }
    this.save.save();
    this._applyQualityProfile();
    this._syncGraphicsUI();
    this._syncSettingsUI();
  }

  _applyQualityProfile() {
    const cfg = this._getQualityConfig();
    this.renderer.resize(window.innerWidth, window.innerHeight, cfg.dprScale);
    const fpsEl = document.getElementById('hudFps');
    if (fpsEl) fpsEl.classList.toggle('hidden', this.settings.showFps === false);
  }

  _loadTrackAndGarageMeshes() {
    const trackId = this.save.data.selectedTrack;
    this.world = buildWorld(trackId);
    this.worldMeshes = buildWorldMeshes(this.renderer.gl, this.world);
    this._rebuildPlayerMesh();

    // Shared traffic & parked JDM meet car meshes
    const gl = this.renderer.gl;
    this.trafficMesh = buildJDMCarMesh(gl, {
      style: 'sedan', bodyHex: '#64748b', underglowHex: '#000000',
      rimHex: '#94a3b8', rimAccentHex: '#1e293b', wing: 'none', bodykit: 'stock', rideOffset: 0.04, isTraffic: true
    });
    this.meetCarMeshes = this.world.meetCars.map((mc, i) => buildJDMCarMesh(gl, {
      style: ['coupe', 'gtr', 'supercar', 'hypercar', 'hatch', 'sedan'][i % 6],
      bodyHex: mc.color,
      underglowHex: mc.underglow,
      rimHex: '#eab308',
      rimAccentHex: '#22d3ee',
      caliperHex: '#ef4444',
      wing: i % 2 === 0 ? 'gt' : 'big',
      bodykit: 'wide',
      rideOffset: -0.09,
      camber: 0.10
    }));
  }

  _rebuildPlayerMesh() {
    const carId = this.save.data.selectedCar;
    const carDef = CARS.find(c => c.id === carId) || CARS[0];
    const cs = this.save.getCarState(carDef.id);
    const paint = PAINTS.find(p => p.id === cs.paint) || PAINTS[0];
    const rim = RIMS.find(r => r.id === cs.rim) || RIMS[0];
    const susp = SUSPENSIONS.find(s => s.id === cs.suspension) || SUSPENSIONS[1];

    this.playerMesh = buildJDMCarMesh(this.renderer.gl, {
      style: carDef.style,
      bodyHex: paint.hex,
      underglowHex: paint.underglow,
      rimHex: rim.color,
      rimAccentHex: rim.accent,
      caliperHex: rim.caliper || '#ef4444',
      wing: cs.wing,
      bodykit: cs.bodykit || 'street',
      rideOffset: susp.rideOffset,
      camber: susp.camber || 0.05
    });
    this.playerUnderglowRgb = hexToRgb01(paint.underglow);
  }

  startRace(forceMode = null) {
    this.audio.init();
    this.controls.requestLandscapeLock();

    const carDef = CARS.find(c => c.id === this.save.data.selectedCar) || CARS[0];
    const carState = this.save.getCarState(carDef.id);
    // If the car currently previewed on Menu is locked and not a Test Drive, launch free_drift test drive automatically or use unlocked
    const isTestDrive = !carState.unlocked;
    const mode = forceMode || (isTestDrive ? 'free_drift' : this.save.data.selectedMode);

    if (mode === 'jdm_meet' && this.save.data.selectedTrack !== 'daikoku') {
      this.save.data.selectedTrack = 'daikoku';
      this.save.save();
      this._loadTrackAndGarageMeshes();
    }

    const stats = computeCarStats(carDef, carState);
    this.sim = new RaceSimulation(this.world, stats, mode, this.settings.trafficEnabled);
    if (isTestDrive) this.sim.setCallout(`TEST DRIVE • ${carDef.name}`);

    // Build sculpted 3D meshes for AI opponents
    const gl = this.renderer.gl;
    this.aiMeshes = this.sim.aiCars.map(ai => buildJDMCarMesh(gl, {
      style: ai.style || 'coupe',
      bodyHex: ai.color,
      underglowHex: ai.isDriftRival ? '#a855f7' : '#22d3ee',
      rimHex: '#eab308',
      rimAccentHex: '#ffffff',
      caliperHex: '#ef4444',
      wing: 'gt',
      bodykit: 'wide',
      rideOffset: -0.06,
      camber: 0.07
    }));

    // Initialize chase camera right behind car
    const p = this.sim.player;
    this.camYaw = p.yaw;
    this.camPos = [p.x - Math.sin(p.yaw) * 8.2, p.y + 3.1, p.z - Math.cos(p.yaw) * 8.2];
    this.camTarget = [p.x + Math.sin(p.yaw) * 6, p.y + 1.2, p.z + Math.cos(p.yaw) * 6];

    this.state = 'racing';
    this._syncOverlays();
    this._syncHudControlLayout();
  }

  pauseRace() {
    if (this.state !== 'racing') return;
    this.state = 'paused';
    this._screenGasPointers?.clear();
    document.getElementById('tGas')?.classList.remove('pressed');
    this.controls.resetInputs();
    this._syncOverlays();
  }

  resumeRace() {
    if (this.state !== 'paused') return;
    this.state = 'racing';
    this._syncOverlays();
  }

  returnToMenu() {
    this.state = 'menu';
    this.sim = null;
    this._screenGasPointers?.clear();
    document.getElementById('tGas')?.classList.remove('pressed');
    this.controls.resetInputs();
    this._renderAllMenus();
    this._syncOverlays();
  }

  _finishRace() {
    this.state = 'results';
    const s = this.sim;
    const mode = s.mode;
    const wonRace = mode === 'circuit' && s.position === 1;
    const wonBattle = mode === 'drift_battle' && s.position === 1;

    // Reward calculation in Japanese Yen (¥)
    let rewardYen = Math.floor(s.score * 0.14) + s.clipsHit * 180;
    if (wonRace) rewardYen += 4500;
    else if (mode === 'circuit') rewardYen += Math.max(1000, (5 - s.position) * 900);
    if (wonBattle) rewardYen += 5500;
    if (mode === 'time_attack') rewardYen += 2500;
    rewardYen = Math.max(500, rewardYen);

    this.save.addYen(rewardYen);
    const { isNewRecord, newlyCompleted } = this.save.recordRun({
      trackId: this.world.cfg.id,
      carId: this.save.data.selectedCar,
      mode,
      score: s.score,
      bestCombo: s.bestCombo,
      clips: s.clipsHit,
      wonRace,
      wonBattle,
      lapTime: (mode === 'time_attack' || mode === 'circuit') ? s.elapsedTime : null
    });

    // Populate Results Modal
    const titleEl = document.getElementById('resTitle');
    const subEl = document.getElementById('resSub');
    if (mode === 'circuit') {
      titleEl.textContent = wonRace ? '1º LUGAR — VITÓRIA!' : `${s.position}º LUGAR`;
      subEl.textContent = `${this.world.cfg.name} • Tempo: ${this._formatTime(s.elapsedTime)}`;
    } else if (mode === 'drift_battle') {
      const rivalPts = Math.floor(s.aiCars[0]?.driftScore || 0);
      titleEl.textContent = wonBattle ? 'VITÓRIA NO DUELO!' : 'DERROTA NO DUELO';
      subEl.textContent = `Você ${Math.floor(s.score).toLocaleString('pt-BR')} × ${rivalPts.toLocaleString('pt-BR')} Rival`;
    } else if (mode === 'time_attack') {
      titleEl.textContent = this._formatTime(s.elapsedTime);
      subEl.textContent = `TIME ATTACK • ${this.world.cfg.name}`;
    } else {
      titleEl.textContent = this._getDriftGrade(s.score).label;
      subEl.textContent = `DESAFIO DE DRIFT • ${this.world.cfg.name}`;
    }

    document.getElementById('resGrade').textContent = (mode === 'circuit' || mode === 'drift_battle')
      ? `${s.position}º`
      : this._getDriftGrade(s.score).code;
    document.getElementById('resScore').textContent = Math.floor(s.score).toLocaleString('pt-BR');
    document.getElementById('resCombo').textContent = Math.floor(s.bestCombo).toLocaleString('pt-BR');
    document.getElementById('resClips').textContent = s.clipsHit;
    document.getElementById('resYen').textContent = `+¥ ${rewardYen.toLocaleString('pt-BR')}`;

    const badge = document.getElementById('resBadges');
    badge.innerHTML = '';
    if (isNewRecord) {
      badge.innerHTML += `<div class="badge-gold">★ NOVO RECORDE NA PISTA! ★</div>`;
    }
    newlyCompleted.forEach(ch => {
      badge.innerHTML += `<div class="badge-cyan">🏆 Desafio: ${ch.title} (+¥ ${ch.reward.toLocaleString('pt-BR')})</div>`;
    });

    this._syncOverlays();
  }

  _getDriftGrade(score) {
    if (score >= 85000) return { code: 'DK', label: 'DRIFT KING DE TÓQUIO' };
    if (score >= 50000) return { code: 'SS', label: 'LENDA DE SHIBUYA' };
    if (score >= 28000) return { code: 'S',  label: 'MESTRE DO TOUGE' };
    if (score >= 15000) return { code: 'A',  label: 'PILOTO NOTURNO' };
    if (score >= 6000)  return { code: 'B',  label: 'CORREDOR DE RUA' };
    return { code: 'C', label: 'AQUECENDO OS PNEUS' };
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  // =========================================================================
  // UI BINDINGS & MENUS
  // =========================================================================
  _bindUI() {
    window.addEventListener('resize', () => {
      this._applyQualityProfile();
      this._checkOrientationGuard();
    });
    this.controls.onOrientationChange = () => {
      this._applyQualityProfile();
      this._checkOrientationGuard();
    };

    // Global Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'racing') this.pauseRace();
        else if (this.state === 'paused') this.resumeRace();
      }
      if (e.code === 'KeyR' && this.state === 'racing' && this.sim) {
        this.sim.repositionPlayer();
      }
      if (e.code === 'KeyC' && this.state === 'racing') {
        this._triggerCalibrationToast();
      }
      if (e.code === 'KeyM') {
        this.settings.sfxEnabled = !this.settings.sfxEnabled;
        this.settings.musicEnabled = this.settings.sfxEnabled;
        this.audio.syncVolumes();
        this.save.save();
        this._syncSettingsUI();
      }
    });

    // Drag to orbit 3D car in Menu / Garage, OR touch & hold anywhere on screen to accelerate while racing!
    this._screenGasPointers = new Set();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state === 'garage' || this.state === 'menu') {
        this.garageDrag = true;
        this.garageLastX = e.clientX;
      } else if (this.state === 'racing') {
        e.preventDefault();
        this.audio.init();
        this._screenGasPointers.add(e.pointerId);
        this.controls.setScreenGas(true);
        document.getElementById('tGas')?.classList.add('pressed');
      }
    }, { passive: false });
    window.addEventListener('pointermove', (e) => {
      if (this.garageDrag) {
        const dx = e.clientX - this.garageLastX;
        this.garageLastX = e.clientX;
        this.garageAngle -= dx * 0.009;
      }
    });
    const releaseScreenPointer = (e) => {
      this.garageDrag = false;
      if (this._screenGasPointers.has(e.pointerId)) {
        this._screenGasPointers.delete(e.pointerId);
        if (this._screenGasPointers.size === 0) {
          this.controls.setScreenGas(false);
          if (!this.controls.touch.gas) document.getElementById('tGas')?.classList.remove('pressed');
        }
      }
    };
    window.addEventListener('pointerup', releaseScreenPointer);
    window.addEventListener('pointercancel', releaseScreenPointer);
    window.addEventListener('blur', () => {
      this._screenGasPointers.clear();
      this.controls.setScreenGas(false);
      document.getElementById('tGas')?.classList.remove('pressed');
    });

    // Portrait Guard Buttons
    document.getElementById('btnForceLandscape')?.addEventListener('click', () => {
      this.controls.requestLandscapeLock();
    });
    document.getElementById('btnIgnorePortrait')?.addEventListener('click', () => {
      this.portraitDismissed = true;
      document.getElementById('portraitGuard').classList.add('hidden');
    });

    // Main Menu Buttons
    document.getElementById('btnPlay').onclick = () => this.startRace();
    const cycleMenuCar = (delta) => {
      const idx = CARS.findIndex(c => c.id === this.save.data.selectedCar);
      const next = (idx + delta + CARS.length) % CARS.length;
      this.save.data.selectedCar = CARS[next].id;
      this.save.save();
      this._rebuildPlayerMesh();
      this._renderAllMenus();
    };
    document.getElementById('btnMenuPrevCar')?.addEventListener('click', () => cycleMenuCar(-1));
    document.getElementById('btnMenuNextCar')?.addEventListener('click', () => cycleMenuCar(1));
    document.getElementById('btnOpenGarage').onclick = () => {
      this.audio.init();
      this.state = 'garage';
      this._renderGarage();
      this._syncOverlays();
    };
    document.getElementById('btnOpenGraphics')?.addEventListener('click', () => this._openGraphics(true));
    document.getElementById('btnOpenSettings').onclick = () => this._openSettings(true);
    document.getElementById('btnOpenRanking').onclick = () => this._openRanking(true);

    // Garage Back
    document.getElementById('btnGarageBack').onclick = () => {
      this.state = 'menu';
      this._renderAllMenus();
      this._syncOverlays();
    };
    document.getElementById('btnGarageRace').onclick = () => this.startRace();

    // HUD Buttons
    document.getElementById('btnHudPause').onclick = () => this.pauseRace();
    document.getElementById('btnHudReset').onclick = () => this.sim?.repositionPlayer();
    document.getElementById('btnHudCalib').onclick = () => this._triggerCalibrationToast();
    document.getElementById('btnHudSettings').onclick = () => {
      if (this.state === 'racing') this.pauseRace();
      this._openSettings(true);
    };

    // Touch Pedals & Fallback Steering Buttons
    this.controls.bindTouchButton(document.getElementById('tLeft'), 'left');
    this.controls.bindTouchButton(document.getElementById('tRight'), 'right');
    this.controls.bindTouchButton(document.getElementById('tGas'), 'gas');
    this.controls.bindTouchButton(document.getElementById('tBrake'), 'brake');
    this.controls.bindTouchButton(document.getElementById('tDrift'), 'handbrake');
    this.controls.bindTouchButton(document.getElementById('tNitro'), 'nitro');

    // Pause Modal Buttons
    document.getElementById('btnPauseResume').onclick = () => this.resumeRace();
    document.getElementById('btnPauseRestart').onclick = () => this.startRace();
    document.getElementById('btnPauseGraphics')?.addEventListener('click', () => this._openGraphics(true));
    document.getElementById('btnPauseSettings').onclick = () => this._openSettings(true);
    document.getElementById('btnPauseCalib').onclick = () => this._triggerCalibrationToast();
    document.getElementById('btnPauseMenu').onclick = () => this.returnToMenu();

    // Graphics Options Modal Controls
    document.getElementById('btnCloseGraphics')?.addEventListener('click', () => this._openGraphics(false));
    document.querySelectorAll('#gfxPresetRow [data-preset]').forEach(btn => {
      btn.addEventListener('click', () => this._applyGraphicsPreset(btn.dataset.preset));
    });
    const markCustomGfx = () => {
      this.settings.quality = 'custom';
      this.save.save();
      this._applyQualityProfile();
      this._syncGraphicsUI();
    };
    document.getElementById('selVisualStyle')?.addEventListener('change', (e) => {
      this.settings.visualStyle = e.target.value;
      this.save.save();
      this._syncGraphicsUI();
    });
    document.getElementById('rngResScale')?.addEventListener('input', (e) => {
      this.settings.resScale = parseFloat(e.target.value);
      markCustomGfx();
    });
    document.getElementById('selReflections')?.addEventListener('change', (e) => {
      this.settings.reflections = e.target.value;
      markCustomGfx();
    });
    document.getElementById('chkDynamicLights')?.addEventListener('change', (e) => {
      this.settings.dynamicLights = e.target.checked;
      markCustomGfx();
    });
    document.getElementById('rngParticles')?.addEventListener('input', (e) => {
      this.settings.particleDensity = parseFloat(e.target.value);
      markCustomGfx();
    });
    document.getElementById('selDrawDistance')?.addEventListener('change', (e) => {
      this.settings.drawDistance = Number(e.target.value);
      markCustomGfx();
    });
    document.getElementById('chkShowFps')?.addEventListener('change', (e) => {
      this.settings.showFps = e.target.checked;
      this.save.save();
      this._applyQualityProfile();
    });

    // Results Modal Buttons
    document.getElementById('btnResRestart').onclick = () => this.startRace();
    document.getElementById('btnResGarage').onclick = () => {
      this.state = 'garage';
      this.sim = null;
      this._renderGarage();
      this._syncOverlays();
    };
    document.getElementById('btnResMenu').onclick = () => this.returnToMenu();

    // Settings Modal Controls
    document.getElementById('btnCloseSettings').onclick = () => this._openSettings(false);
    document.getElementById('btnEnableGyro').onclick = async () => {
      const res = await this.controls.requestSensorPermission();
      const status = document.getElementById('gyroStatus');
      if (res.ok) {
        this.settings.controlMode = 'tilt';
        this.save.save();
        status.textContent = '✓ Sensor ativado! Incline o celular na horizontal para dirigir.';
        this._syncSettingsUI();
        this._syncHudControlLayout();
      } else {
        status.textContent = 'Sensor indisponível neste navegador — use Botões na Tela ou Teclado.';
      }
    };
    document.getElementById('btnCalibrateCenter').onclick = () => this._triggerCalibrationToast();
    document.getElementById('btnResetCenter').onclick = () => {
      this.controls.resetCalibration();
      this.save.save();
      this._syncSettingsUI();
    };

    document.getElementById('selControlMode').onchange = (e) => {
      this.settings.controlMode = e.target.value;
      this.save.save();
      this._syncHudControlLayout();
    };
    document.getElementById('rngSensitivity').oninput = (e) => {
      this.settings.tiltSensitivity = parseFloat(e.target.value);
      document.getElementById('valSensitivity').textContent = this.settings.tiltSensitivity.toFixed(2) + '×';
      this.save.save();
    };
    document.getElementById('rngDeadzone').oninput = (e) => {
      this.settings.tiltDeadzone = parseFloat(e.target.value);
      document.getElementById('valDeadzone').textContent = this.settings.tiltDeadzone.toFixed(1) + '°';
      this.save.save();
    };
    document.getElementById('chkInvertTilt').onchange = (e) => {
      this.settings.tiltInvert = e.target.checked;
      this.save.save();
    };
    document.getElementById('selQuality').onchange = (e) => {
      this._applyGraphicsPreset(e.target.value);
    };
    document.getElementById('chkTraffic').onchange = (e) => {
      this.settings.trafficEnabled = e.target.checked;
      this.save.save();
    };
    document.getElementById('chkSfx').onchange = (e) => {
      this.audio.init();
      this.settings.sfxEnabled = e.target.checked;
      this.audio.syncVolumes();
      this.save.save();
    };
    document.getElementById('chkMusic').onchange = (e) => {
      this.audio.init();
      this.settings.musicEnabled = e.target.checked;
      this.audio.syncVolumes();
      this.save.save();
    };

    // Ranking Modal
    document.getElementById('btnCloseRanking').onclick = () => this._openRanking(false);
  }

  _openGraphics(show) {
    document.getElementById('graphicsModal')?.classList.toggle('hidden', !show);
    if (show) this._syncGraphicsUI();
  }

  _syncGraphicsUI() {
    const s = this.settings;
    document.querySelectorAll('#gfxPresetRow [data-preset]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === s.quality);
    });
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('selVisualStyle', s.visualStyle || 'neon');
    setVal('rngResScale', s.resScale ?? 1.0);
    setTxt('valResScale', Math.round((s.resScale ?? 1.0) * 100) + '%');
    setVal('selReflections', s.reflections || 'high');
    setChk('chkDynamicLights', s.dynamicLights !== false);
    setVal('rngParticles', s.particleDensity ?? 1.0);
    setTxt('valParticles', Math.round((s.particleDensity ?? 1.0) * 100) + '%');
    setVal('selDrawDistance', String(s.drawDistance || 520));
    setChk('chkShowFps', s.showFps !== false);
  }

  _triggerCalibrationToast() {
    const deg = this.controls.calibrateCenter();
    this.save.save();
    this._syncSettingsUI();
    const toast = document.getElementById('toastBanner');
    toast.textContent = `✓ Centro do Giroscópio Calibrado (${deg.toFixed(1)}°)`;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  _checkOrientationGuard() {
    const portrait = window.innerHeight > window.innerWidth;
    const isMobileLike = this.controls.isTouchDevice || (window.innerWidth <= 520 && window.innerHeight > window.innerWidth * 1.35);
    const guard = document.getElementById('portraitGuard');
    // Enforce landscape on smartphones / touch devices & narrow portrait viewports
    if (portrait && isMobileLike && !this.portraitDismissed) {
      guard.classList.remove('hidden');
      if (this.state === 'racing') this.pauseRace();
    } else {
      guard.classList.add('hidden');
    }
  }

  _syncOverlays() {
    document.getElementById('menuScreen').classList.toggle('hidden', this.state !== 'menu');
    document.getElementById('garageScreen').classList.toggle('hidden', this.state !== 'garage');
    document.getElementById('hudLayer').classList.toggle('hidden', this.state !== 'racing' && this.state !== 'paused');
    document.getElementById('pauseModal').classList.toggle('hidden', this.state !== 'paused');
    document.getElementById('resultsModal').classList.toggle('hidden', this.state !== 'results');
  }

  _syncHudControlLayout() {
    const showSteerBtns = !this.controls.useTiltSteering() && (this.controls.isTouchDevice || this.settings.controlMode === 'buttons');
    const showPedals = this.controls.isTouchDevice || this.settings.controlMode === 'buttons' || this.settings.controlMode === 'tilt';
    document.getElementById('touchSteerPad').classList.toggle('hidden', !showSteerBtns);
    document.getElementById('touchPedalPad').classList.toggle('hidden', !showPedals);
    document.getElementById('tiltIndicatorWrap').classList.toggle('hidden', !this.controls.useTiltSteering());
  }

  _openSettings(show) {
    document.getElementById('settingsModal').classList.toggle('hidden', !show);
    if (show) this._syncSettingsUI();
  }

  _syncSettingsUI() {
    document.getElementById('selControlMode').value = this.settings.controlMode;
    document.getElementById('rngSensitivity').value = this.settings.tiltSensitivity;
    document.getElementById('valSensitivity').textContent = this.settings.tiltSensitivity.toFixed(2) + '×';
    document.getElementById('rngDeadzone').value = this.settings.tiltDeadzone;
    document.getElementById('valDeadzone').textContent = this.settings.tiltDeadzone.toFixed(1) + '°';
    document.getElementById('chkInvertTilt').checked = !!this.settings.tiltInvert;
    document.getElementById('selQuality').value = this.settings.quality;
    document.getElementById('chkTraffic').checked = !!this.settings.trafficEnabled;
    document.getElementById('chkSfx').checked = !!this.settings.sfxEnabled;
    document.getElementById('chkMusic').checked = !!this.settings.musicEnabled;
    document.getElementById('gyroStatus').textContent = this.controls.sensorActive
      ? `Sensor ativo • Inclinação: ${this.controls.calibratedDeg.toFixed(1)}° (Centro: ${(this.settings.tiltCenter || 0).toFixed(1)}°)`
      : (this.controls.needsIOSPermission
          ? 'Toque em "Ativar Giroscópio (iOS/Android)" para liberar a inclinação.'
          : 'Aguardando sensor de inclinação (em PC use WASD/Setas ou Botões na Tela).');
  }

  _openRanking(show) {
    const modal = document.getElementById('rankingModal');
    modal.classList.toggle('hidden', !show);
    if (!show) return;

    const lb = document.getElementById('leaderboardList');
    const items = this.save.data.leaderboard;
    if (items.length === 0) {
      lb.innerHTML = `<div class="muted-note">Nenhuma pontuação registrada ainda. Complete um Drift para entrar no ranking!</div>`;
    } else {
      lb.innerHTML = items.map((r, i) => {
        const t = TRACKS.find(x => x.id === r.track)?.name || r.track;
        const c = CARS.find(x => x.id === r.car)?.name || r.car;
        return `<div class="rank-row">
          <span class="rank-pos">#${i + 1}</span>
          <span class="rank-info"><strong>${c}</strong> • ${t}</span>
          <span class="rank-pts">${r.score.toLocaleString('pt-BR')} pts</span>
        </div>`;
      }).join('');
    }

    const chList = document.getElementById('challengesList');
    chList.innerHTML = CHALLENGES.map(ch => {
      const done = !!this.save.data.claimedChallenges[ch.id];
      return `<div class="challenge-row ${done ? 'done' : ''}">
        <div>
          <div class="ch-title">${done ? '✓ ' : ''}${ch.title}</div>
          <div class="ch-desc">${ch.desc}</div>
        </div>
        <span class="ch-reward">¥ ${ch.reward.toLocaleString('pt-BR')}</span>
      </div>`;
    }).join('');
  }

  _renderAllMenus() {
    document.getElementById('menuYen').textContent = `¥ ${this.save.data.yen.toLocaleString('pt-BR')}`;
    const selCar = CARS.find(c => c.id === this.save.data.selectedCar) || CARS[0];
    const selState = this.save.getCarState(selCar.id);
    const tierEl = document.getElementById('menuCarTier');
    if (tierEl) tierEl.textContent = selCar.tierLabel + (selState.unlocked ? '' : ' • TEST DRIVE');
    document.getElementById('menuActiveCar').textContent = selCar.name;
    const playBtn = document.getElementById('btnPlay');
    if (playBtn) playBtn.textContent = selState.unlocked ? 'INICIAR CORRIDA →' : '⚡ TEST DRIVE LIVRE →';

    // Modes
    const modeBox = document.getElementById('modeGrid');
    modeBox.innerHTML = '';
    MODES.forEach(m => {
      const btn = document.createElement('button');
      btn.className = `card-btn ${this.save.data.selectedMode === m.id ? 'active' : ''}`;
      btn.innerHTML = `<div class="card-top"><span>${m.name}</span><span class="pill">${m.badge}</span></div><div class="card-sub">${m.desc}</div>`;
      btn.onclick = () => {
        this.save.data.selectedMode = m.id;
        this.save.save();
        this._renderAllMenus();
      };
      modeBox.appendChild(btn);
    });

    // Tracks
    const trackBox = document.getElementById('trackGrid');
    trackBox.innerHTML = '';
    TRACKS.forEach(t => {
      const rec = this.save.data.records[t.id];
      const recTxt = rec?.bestDrift ? `Rec: ${rec.bestDrift.toLocaleString('pt-BR')}` : t.jp;
      const btn = document.createElement('button');
      btn.className = `card-btn ${this.save.data.selectedTrack === t.id ? 'active' : ''}`;
      btn.innerHTML = `<div class="card-top"><span>${t.name}</span><span class="pill-cyan">${recTxt}</span></div><div class="card-sub">${t.desc}</div>`;
      btn.onclick = () => {
        if (this.save.data.selectedTrack !== t.id) {
          this.save.data.selectedTrack = t.id;
          this.save.save();
          this._loadTrackAndGarageMeshes();
        }
        this._renderAllMenus();
      };
      trackBox.appendChild(btn);
    });

    // Weather Chips
    const weatherBox = document.getElementById('weatherRow');
    weatherBox.innerHTML = '';
    WEATHERS.forEach(w => {
      const b = document.createElement('button');
      b.className = `chip-btn ${this.save.data.weather === w.id ? 'active' : ''}`;
      b.textContent = w.name;
      b.onclick = () => {
        this.save.data.weather = w.id;
        this.save.save();
        this._renderAllMenus();
      };
      weatherBox.appendChild(b);
    });
  }

  _renderGarage() {
    document.getElementById('garageYen').textContent = `¥ ${this.save.data.yen.toLocaleString('pt-BR')}`;

    // Car selector strip (Tier 1 Simples -> Tier 7 Hipercarro)
    const list = document.getElementById('garageCarList');
    list.innerHTML = '';
    CARS.forEach(c => {
      const cs = this.save.getCarState(c.id);
      const selected = this.save.data.selectedCar === c.id;
      const b = document.createElement('button');
      b.className = `car-tab ${selected ? 'active' : ''} ${!cs.unlocked ? 'locked' : ''}`;
      b.innerHTML = `<strong>T${c.tier} • ${c.name}</strong><span>${cs.unlocked ? '✓ Na Garagem' : '🔒 ¥' + c.price.toLocaleString('pt-BR')}</span>`;
      b.onclick = () => {
        this.save.data.selectedCar = c.id;
        this.save.save();
        this._rebuildPlayerMesh();
        this._renderGarage();
      };
      list.appendChild(b);
    });

    const carDef = CARS.find(c => c.id === this.save.data.selectedCar) || CARS[0];
    const cs = this.save.getCarState(carDef.id);
    const stats = computeCarStats(carDef, cs);

    const gTier = document.getElementById('gCarTier');
    if (gTier) gTier.textContent = carDef.tierLabel;
    document.getElementById('gCarName').textContent = carDef.name;
    document.getElementById('gCarDesc').textContent = `${carDef.classLabel} — ${carDef.desc}`;
    document.getElementById('gBarSpeed').style.width = stats.bars.speed + '%';
    document.getElementById('gBarAccel').style.width = stats.bars.accel + '%';
    document.getElementById('gBarDrift').style.width = stats.bars.drift + '%';
    document.getElementById('gBarNitro').style.width = stats.bars.nitro + '%';

    const buyBox = document.getElementById('gUnlockWrap');
    const customBox = document.getElementById('gCustomWrap');
    const raceBtn = document.getElementById('btnGarageRace');

    if (!cs.unlocked) {
      buyBox.classList.remove('hidden');
      customBox.classList.add('hidden');
      raceBtn.disabled = false;
      raceBtn.textContent = 'TEST DRIVE →';
      const buyBtn = document.getElementById('btnBuyCar');
      buyBtn.textContent = `DESBLOQUEAR POR ¥ ${carDef.price.toLocaleString('pt-BR')}`;
      buyBtn.disabled = this.save.data.yen < carDef.price;
      buyBtn.onclick = () => {
        if (this.save.spendYen(carDef.price)) {
          cs.unlocked = true;
          this.save.save();
          this.audio.playSFX('bank');
          this._renderGarage();
        }
      };
      const testBtn = document.getElementById('btnTestDrive');
      if (testBtn) testBtn.onclick = () => this.startRace('free_drift');
      return;
    }

    buyBox.classList.add('hidden');
    customBox.classList.remove('hidden');
    raceBtn.disabled = false;
    raceBtn.textContent = 'CORRER →';

    // Paints
    const pRow = document.getElementById('gPaintRow');
    pRow.innerHTML = '';
    PAINTS.forEach(p => {
      const sw = document.createElement('button');
      sw.className = `swatch ${cs.paint === p.id ? 'active' : ''}`;
      sw.style.background = p.hex;
      sw.title = p.name;
      sw.onclick = () => { cs.paint = p.id; this.save.save(); this._rebuildPlayerMesh(); this._renderGarage(); };
      pRow.appendChild(sw);
    });

    // Rims, Wing, Bodykit, Suspension, Drift Setup
    this._renderChipGroup('gRimRow', RIMS, cs.rim, (id) => { cs.rim = id; this.save.save(); this._rebuildPlayerMesh(); this._renderGarage(); });
    this._renderChipGroup('gWingRow', WINGS, cs.wing, (id) => { cs.wing = id; this.save.save(); this._rebuildPlayerMesh(); this._renderGarage(); });
    this._renderChipGroup('gKitRow', [
      { id: 'stock', name: 'Original' }, { id: 'street', name: 'Street Lip' }, { id: 'wide', name: 'Widebody GT' }
    ], cs.bodykit || 'street', (id) => { cs.bodykit = id; this.save.save(); this._rebuildPlayerMesh(); this._renderGarage(); });
    this._renderChipGroup('gSuspRow', SUSPENSIONS, cs.suspension, (id) => { cs.suspension = id; this.save.save(); this._rebuildPlayerMesh(); this._renderGarage(); });
    this._renderChipGroup('gSetupRow', DRIFT_SETUPS, cs.driftSetup, (id) => { cs.driftSetup = id; this.save.save(); this._renderGarage(); });

    // Mechanical Upgrades
    const uList = document.getElementById('gUpgradeList');
    uList.innerHTML = '';
    UPGRADE_DEFS.forEach(u => {
      const lvl = cs.upgrades[u.key] || 0;
      const maxed = lvl >= u.costs.length;
      const cost = maxed ? 0 : u.costs[lvl];
      const row = document.createElement('div');
      row.className = 'upg-row';
      row.innerHTML = `
        <div>
          <div class="upg-name">${u.name} <span class="pill-cyan">Nv.${lvl}/${u.costs.length}</span></div>
          <div class="upg-desc">${u.desc}</div>
        </div>
        <button class="upg-btn" ${maxed || this.save.data.yen < cost ? 'disabled' : ''}>
          ${maxed ? 'MÁX' : '¥ ' + cost.toLocaleString('pt-BR')}
        </button>
      `;
      if (!maxed) {
        row.querySelector('button').onclick = () => {
          if (this.save.spendYen(cost)) {
            cs.upgrades[u.key] = lvl + 1;
            this.save.save();
            this.audio.playSFX('clip');
            this._renderGarage();
          }
        };
      }
      uList.appendChild(row);
    });
  }

  _renderChipGroup(elId, items, activeId, onPick) {
    const box = document.getElementById(elId);
    box.innerHTML = '';
    items.forEach(item => {
      const b = document.createElement('button');
      b.className = `chip-btn ${item.id === activeId ? 'active' : ''}`;
      b.textContent = item.name;
      b.onclick = () => onPick(item.id);
      box.appendChild(b);
    });
  }

  // =========================================================================
  // MAIN SIMULATION & RENDER LOOP
  // =========================================================================
  _loop(now) {
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = clamp(rawDt, 0.001, 0.05);

    // FPS tracking & Adaptive Mobile Quality Governor
    const instFps = rawDt > 0 ? 1 / rawDt : 60;
    this.fpsSamples.push(instFps);
    if (this.fpsSamples.length > 30) this.fpsSamples.shift();
    this.currentFps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;

    if (this.settings.quality === 'auto' && this.state === 'racing') {
      this.autoStepTimer += dt;
      if (this.autoStepTimer > 2.2) {
        this.autoStepTimer = 0;
        if (this.currentFps < 40 && this.qualityScale > 0.62) {
          this.qualityScale = Math.max(0.6, this.qualityScale - 0.14);
          this.particleBudget = Math.max(0.35, this.particleBudget - 0.2);
          this._applyQualityProfile();
        } else if (this.currentFps > 56 && this.qualityScale < 1.0) {
          this.qualityScale = Math.min(1.0, this.qualityScale + 0.08);
          this.particleBudget = Math.min(1.0, this.particleBudget + 0.12);
          this._applyQualityProfile();
        }
      }
    }

    this.controls.update(dt);

    if (this.state === 'racing' && this.sim) {
      const qCfg = this._getQualityConfig();
      this.sim.step(dt, this.controls, this.save.data.weather, qCfg.particles);

      // Process Simulation Audio & State Events
      for (const ev of this.sim.events) {
        if (ev.type === 'countdown') this.audio.playSFX('countdown');
        else if (ev.type === 'go') this.audio.playSFX('go');
        else if (ev.type === 'clip') this.audio.playSFX('clip');
        else if (ev.type === 'bank') this.audio.playSFX('bank');
        else if (ev.type === 'lap') this.audio.playSFX('lap');
        else if (ev.type === 'collision') this.audio.playCollision(ev.intensity);
        else if (ev.type === 'finish') this._finishRace();
      }

      const p = this.sim.player;
      const slipNorm = p.isDrifting ? clamp((p.driftAngleDeg - 10) / 38, 0, 1) : 0;
      this.audio.updateVehicle({
        rpm: p.rpm,
        gear: p.gear,
        slip: slipNorm,
        nitro: p.nitroActive,
        throttle: this.controls.throttle > 0,
        enginePitch: this.sim.playerStats.enginePitch || 1.0,
        active: this.state === 'racing'
      });

      this._updateChaseCamera(dt);
      this._updateHUD();
    } else {
      // Menu / Garage / Paused: orbit camera smoothly around the customized 3D car
      if (!this.garageDrag && (this.state === 'menu' || this.state === 'garage')) {
        this.garageAngle += dt * 0.34;
      }
      this.audio.updateVehicle({ rpm: 0.2, gear: 1, slip: 0, nitro: false, throttle: false, active: false });
      if (!document.getElementById('settingsModal').classList.contains('hidden')) {
        this._syncSettingsUI();
      }
    }

    this._render3DScene();
    requestAnimationFrame((t) => this._loop(t));
  }

  _updateChaseCamera(dt) {
    const p = this.sim.player;
    // Dynamic drift camera: lags slightly behind heading toward velocity vector so you look INTO the corner!
    const velYaw = p.speed > 8 ? Math.atan2(p.vx, p.vz) : p.yaw;
    const blendYaw = p.isDrifting ? lerpAngle(p.yaw, velYaw, 0.38) : p.yaw;
    this.camYaw = lerpAngle(this.camYaw, blendYaw, Math.min(1, dt * 6.2));

    const speedNorm = clamp(p.speed / 72, 0, 1);
    const dist = 7.4 + speedNorm * 1.45 + (p.nitroActive ? 0.9 : 0);
    const height = 2.75 + speedNorm * 0.45;

    const shakeAmt = this.sim.shake * 0.35;
    const sx = (Math.random() - 0.5) * shakeAmt;
    const sy = (Math.random() - 0.5) * shakeAmt;

    const targetCamX = p.x - Math.sin(this.camYaw) * dist + sx;
    const targetCamY = p.y + height + sy;
    const targetCamZ = p.z - Math.cos(this.camYaw) * dist;

    const smooth = Math.min(1, dt * 11);
    this.camPos[0] = lerp(this.camPos[0], targetCamX, smooth);
    this.camPos[1] = lerp(this.camPos[1], targetCamY, smooth);
    this.camPos[2] = lerp(this.camPos[2], targetCamZ, smooth);

    const lookDist = 11.0;
    this.camTarget[0] = p.x + Math.sin(p.yaw) * lookDist;
    this.camTarget[1] = p.y + 1.15 - p.pitch * 3.0;
    this.camTarget[2] = p.z + Math.cos(p.yaw) * lookDist;

    const targetFov = (62 + speedNorm * 10 + (p.nitroActive ? 11 : 0)) * Math.PI / 180;
    this.camFov = lerp(this.camFov, targetFov, Math.min(1, dt * 6));
  }

  _render3DScene() {
    const r = this.renderer;
    const wCfg = this.world.cfg;
    const weather = this.save.data.weather;
    const wetness = weather === 'rain' ? 0.92 : (weather === 'fog' ? 0.45 : 0.28);
    const fogDensity = weather === 'fog' ? 0.012 : (weather === 'rain' ? 0.0078 : 0.0052);

    let carX, carY, carZ, carYaw, carPitch = 0, carRoll = 0, braking = false;
    if (this.sim && (this.state === 'racing' || this.state === 'paused' || this.state === 'results')) {
      const p = this.sim.player;
      carX = p.x; carY = p.y; carZ = p.z;
      carYaw = p.yaw; carPitch = p.pitch; carRoll = p.roll;
      braking = p.braking;
    } else {
      // Showcase car angled in dramatic drift stance on wet Shibuya Crossing, looking down the illuminated avenue!
      const p0 = this.world.points[0];
      carX = p0.x; carY = p0.y; carZ = p0.z; carYaw = p0.yaw + 0.32;
      const orbitDist = this.state === 'garage' ? 5.6 : 6.0;
      const orbitH = this.state === 'garage' ? 1.72 : 1.85;
      const sinA = Math.sin(this.garageAngle);
      const cosA = Math.cos(this.garageAngle);
      const camRightX = cosA;
      const camRightZ = -sinA;
      const lateralFrame = this.state === 'garage' ? 1.75 : -1.85;
      this.camPos = [
        carX + sinA * orbitDist + camRightX * lateralFrame,
        carY + orbitH,
        carZ + cosA * orbitDist + camRightZ * lateralFrame
      ];
      this.camTarget = [
        carX + camRightX * lateralFrame,
        carY + 0.85,
        carZ + camRightZ * lateralFrame
      ];
      this.camFov = 52 * Math.PI / 180;
    }

    const hlPos = [carX + Math.sin(carYaw) * 2.1, carY + 0.85, carZ + Math.cos(carYaw) * 2.1];
    const hlDir = [Math.sin(carYaw), -0.14, Math.cos(carYaw)];
    const ugPos = [carX, carY + 0.2, carZ];
    const brakeGlow = braking ? 0.85 : (this.state !== 'racing' ? 0.35 : 0.0);
    const gfxOpts = this._getQualityConfig();

    r.beginFrame(
      this.camPos, this.camTarget, this.camFov,
      wCfg.skyColor, wCfg.fogColor, fogDensity,
      hlPos, hlDir, ugPos, this.playerUnderglowRgb || [0.14, 0.82, 0.94], wetness, brakeGlow, gfxOpts
    );

    if (this.worldMeshes.sky) r.drawSkyDome(this.worldMeshes.sky, this.camPos);

    // Static Photorealistic Tokyo World
    r.drawMesh(this.worldMeshes.ground, null, null, 0.05);
    r.drawMesh(this.worldMeshes.road, null, r.roadTex, wetness, brakeGlow);
    r.drawMesh(this.worldMeshes.buildings, null, r.bldgTex, 0.15);
    r.drawMesh(this.worldMeshes.env, null, null, 0.22);

    // Parked JDM Car Meet Vehicles
    for (let i = 0; i < this.world.meetCars.length; i++) {
      const mc = this.world.meetCars[i];
      Mat4.fromTRS(this.tmpMat, mc.x, mc.y, mc.z, 0, mc.yaw, 0, 1, 1, 1);
      r.drawMesh(this.meetCarMeshes[i], this.tmpMat, null, 0.72);
    }

    if (this.sim) r.drawSkids(this.sim.skids);

    // Player 3D Curved Car
    Mat4.fromTRS(this.tmpMat, carX, carY, carZ, carPitch, carYaw, carRoll, 1, 1, 1);
    r.drawMesh(this.playerMesh, this.tmpMat, null, 0.90, brakeGlow);

    // Collect Additive Volumetric Glow Halos (LED Taillights, Xenon Headlights, Nearby Streetlamps!)
    const halos = [];
    const fx = Math.sin(carYaw), fz = Math.cos(carYaw);
    const lx = Math.cos(carYaw), lz = -Math.sin(carYaw);
    const tailScale = braking ? 1.55 : 1.15;
    // Player Left & Right Crimson LED Taillight Glow Halos
    halos.push({ x: carX - fx * 2.34 + lx * 0.62, y: carY + 0.78, z: carZ - fz * 2.34 + lz * 0.62, r: 1.0, g: 0.14, b: 0.08, a: 0.85, size: tailScale });
    halos.push({ x: carX - fx * 2.34 - lx * 0.62, y: carY + 0.78, z: carZ - fz * 2.34 - lz * 0.62, r: 1.0, g: 0.14, b: 0.08, a: 0.85, size: tailScale });
    // Player Left & Right Xenon White Headlight Glow Halos
    halos.push({ x: carX + fx * 2.34 + lx * 0.64, y: carY + 0.62, z: carZ + fz * 2.34 + lz * 0.64, r: 0.92, g: 0.97, b: 1.0, a: 0.72, size: 1.25 });
    halos.push({ x: carX + fx * 2.34 - lx * 0.64, y: carY + 0.62, z: carZ + fz * 2.34 - lz * 0.64, r: 0.92, g: 0.97, b: 1.0, a: 0.72, size: 1.25 });

    // Nearby Streetlamp Atmospheric Rain Halos
    for (let i = 0; i < this.world.lamps.length; i++) {
      const lm = this.world.lamps[i];
      const dx = lm.x - this.camPos[0], dz = lm.z - this.camPos[2];
      if (dx * dx + dz * dz < 165 * 165) {
        halos.push({ x: lm.x, y: lm.y + 8.1, z: lm.z, r: 1.0, g: 0.94, b: 0.82, a: 0.48, size: 2.3 });
      }
    }

    // AI Opponents & Traffic + their realistic headlights/taillights halos
    if (this.sim) {
      for (let i = 0; i < this.sim.aiCars.length; i++) {
        const ai = this.sim.aiCars[i];
        Mat4.fromTRS(this.tmpMat, ai.x, ai.y, ai.z, ai.pitch, ai.yaw, ai.roll, 1, 1, 1);
        r.drawMesh(this.aiMeshes[i], this.tmpMat, null, 0.82, ai.braking ? 0.55 : 0);
        const afx = Math.sin(ai.yaw), afz = Math.cos(ai.yaw);
        halos.push({ x: ai.x - afx * 2.25, y: ai.y + 0.76, z: ai.z - afz * 2.25, r: 1.0, g: 0.12, b: 0.08, a: 0.75, size: 1.35 });
      }
      for (const tv of this.sim.traffic) {
        Mat4.fromTRS(this.tmpMat, tv.x, tv.y, tv.z, tv.pitch, tv.yaw, 0, 1, 1, 1);
        r.drawMesh(this.trafficMesh, this.tmpMat, null, 0.55);
        const tfx = Math.sin(tv.yaw), tfz = Math.cos(tv.yaw);
        halos.push({ x: tv.x - tfx * 2.2, y: tv.y + 0.74, z: tv.z - tfz * 2.2, r: 1.0, g: 0.12, b: 0.10, a: 0.65, size: 1.1 });
        halos.push({ x: tv.x + tfx * 2.2, y: tv.y + 0.64, z: tv.z + tfz * 2.2, r: 0.95, g: 0.97, b: 1.0, a: 0.65, size: 1.2 });
      }
      // Volumetric White Tire Smoke & Rain
      r.drawParticles(this.sim.particles, false);
    } else {
      // Showcase dramatic tire smoke mist swirling around the rear wheels on wet Shibuya Crossing!
      const t = r.time;
      const mist = [];
      for (let m = 0; m < 10; m++) {
        const ph = (t * 0.7 + m * 0.63) % 1.0;
        const side = (m % 2 === 0 ? 0.92 : -0.92);
        mist.push({
          x: carX - fx * (1.35 + ph * 2.1) + lx * (side + Math.sin(t + m) * 0.35),
          y: carY + 0.25 + ph * 0.85,
          z: carZ - fz * (1.35 + ph * 2.1) + lz * (side + Math.cos(t + m) * 0.35),
          r: 0.88, g: 0.91, b: 0.96, a: 0.32 * (1 - ph), size: 1.3 + ph * 2.2
        });
      }
      r.drawParticles(mist, false);
    }

    // Additive LED & Streetlamp Glow Halos
    if (gfxOpts.dynamicLights) r.drawParticles(halos, true);

    // 4-Pass FBO Selective Bloom + ACES Filmic Tone Mapping Composite!
    r.endFrame();
  }

  _updateHUD() {
    const s = this.sim;
    const p = s.player;

    document.getElementById('hudScore').textContent = Math.floor(s.score).toLocaleString('pt-BR');
    document.getElementById('hudSpeed').textContent = Math.floor(p.speed * 3.6);
    document.getElementById('hudGear').textContent = p.gear;
    document.getElementById('hudAngle').textContent = `${Math.round(p.driftAngleDeg)}°`;
    document.getElementById('hudRpmBar').style.width = `${Math.round(p.rpm * 100)}%`;
    document.getElementById('hudNitroBar').style.width = `${Math.round(p.nitro)}%`;
    document.getElementById('hudFps').textContent = `${Math.round(this.currentFps)} FPS`;

    // Position / Lap / Timer
    const posWrap = document.getElementById('hudPosWrap');
    if (s.mode === 'circuit' || s.mode === 'drift_battle') {
      posWrap.classList.remove('hidden');
      document.getElementById('hudPos').textContent = `${s.position}º/${s.totalRacers}`;
    } else {
      posWrap.classList.add('hidden');
    }

    const lapTxt = (s.targetLaps < 50) ? `Volta ${Math.min(p.lap, s.targetLaps)}/${s.targetLaps}` : `Volta ${p.lap}`;
    document.getElementById('hudLap').textContent = lapTxt;

    const timerEl = document.getElementById('hudTimer');
    if (s.mode === 'drift_challenge') {
      const m = Math.floor(s.timeLeft / 60);
      const sec = Math.floor(s.timeLeft % 60);
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      timerEl.classList.toggle('urgent', s.timeLeft <= 15);
    } else if (s.mode === 'time_attack' || s.mode === 'circuit' || s.mode === 'drift_battle') {
      timerEl.textContent = this._formatTime(s.elapsedTime);
      timerEl.classList.remove('urgent');
    } else {
      timerEl.textContent = s.mode === 'jdm_meet' ? 'MEET JDM' : 'LIVRE';
      timerEl.classList.remove('urgent');
    }

    // Rival Drift Score in 1v1 Drift Battle
    const rivalPill = document.getElementById('hudRivalScore');
    if (s.mode === 'drift_battle' && s.aiCars[0]) {
      rivalPill.classList.remove('hidden');
      rivalPill.textContent = `RIVAL: ${Math.floor(s.aiCars[0].driftScore).toLocaleString('pt-BR')}`;
    } else {
      rivalPill.classList.add('hidden');
    }

    // Countdown Overlay
    const cdEl = document.getElementById('hudCountdown');
    if (s.countdown > 0) {
      cdEl.classList.remove('hidden');
      cdEl.textContent = Math.ceil(s.countdown);
    } else {
      cdEl.classList.add('hidden');
    }

    // Active Drift Combo Banner
    const driftBox = document.getElementById('hudDriftBox');
    if (s.driftBuffer > 25) {
      driftBox.classList.add('visible');
      document.getElementById('hudDriftPts').textContent = '+' + Math.floor(s.driftBuffer).toLocaleString('pt-BR');
      document.getElementById('hudDriftMult').textContent = '×' + s.driftMult.toFixed(1);
      document.getElementById('hudGraceBar').style.width = `${clamp((s.driftGrace / s.maxGrace) * 100, 0, 100)}%`;
    } else {
      driftBox.classList.remove('visible');
    }
    document.getElementById('hudCallout').textContent = s.calloutTimer > 0 ? s.callout : '';

    // Live Tilt Steering Indicator Needle
    const needle = document.getElementById('tiltNeedle');
    if (needle) {
      needle.style.left = `${50 + this.controls.steer * 46}%`;
    }

    // Minimap
    this._drawMinimap();
  }

  _drawMinimap() {
    if (!this.miniCtx || !this.world || !this.sim) return;
    const c = this.miniCtx;
    const w = this.miniCanvas.width;
    const h = this.miniCanvas.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(6, 9, 18, 0.78)';
    c.fillRect(0, 0, w, h);

    const b = this.world.bounds;
    const sx = b.maxX - b.minX;
    const sz = b.maxZ - b.minZ;
    const sc = Math.min((w - 14) / sx, (h - 14) / sz);
    const ox = (w - sx * sc) * 0.5 - b.minX * sc;
    const oz = (h - sz * sc) * 0.5 - b.minZ * sc;

    const pts = this.world.points;
    c.beginPath();
    c.moveTo(pts[0].x * sc + ox, pts[0].z * sc + oz);
    for (let i = 1; i < this.world.N; i += 2) {
      c.lineTo(pts[i].x * sc + ox, pts[i].z * sc + oz);
    }
    c.closePath();
    c.strokeStyle = 'rgba(255,255,255,0.34)';
    c.lineWidth = 3.5;
    c.stroke();

    // AI Dots
    c.fillStyle = '#a855f7';
    for (const ai of this.sim.aiCars) {
      c.beginPath();
      c.arc(ai.x * sc + ox, ai.z * sc + oz, 3, 0, Math.PI * 2);
      c.fill();
    }

    // Player Dot
    const p = this.sim.player;
    c.fillStyle = '#ff2a85';
    c.beginPath();
    c.arc(p.x * sc + ox, p.z * sc + oz, 4.2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.4;
    c.stroke();
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => { new TokyoDriftApp(); });
} else {
  new TokyoDriftApp();
}
