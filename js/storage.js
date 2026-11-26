// Persistent Progression, 7-Tier Garage Customization, Records, Challenges & Settings

import { CARS } from './cars.js';

const STORAGE_KEY = 'tokyo_drift_3d_save_v2';

export const CHALLENGES = [
  { id: 'c_combo5k',  title: 'Primeiro Combo 5.000',     desc: 'Faça um único combo de 5.000 pontos',       reward: 4500,  check: (s) => s.stats.bestCombo >= 5000 },
  { id: 'c_winrace',  title: 'Rei da Avenida',           desc: 'Vença uma corrida em 1º lugar',             reward: 7000,  check: (s) => s.stats.racesWon >= 1 },
  { id: 'c_battle',   title: 'Vencedor do Duelo 1v1',    desc: 'Vença uma Batalha de Drift',                reward: 9000,  check: (s) => s.stats.battlesWon >= 1 },
  { id: 'c_clips10',  title: 'Cirurgião do Apex',        desc: 'Acerte 10 Apex Clips acumulados',           reward: 6000,  check: (s) => s.stats.totalClips >= 10 },
  { id: 'c_score40k', title: 'Lenda de Shibuya',         desc: 'Alcance 40.000 pontos no Desafio de Drift', reward: 15000, check: (s) => s.stats.bestDriftScore >= 40000 },
  { id: 'c_cars4',    title: 'Colecionador de Tóquio',   desc: 'Desbloqueie 4 veículos na garagem',         reward: 25000, check: (s) => Object.keys(s.cars).filter(k => s.cars[k].unlocked).length >= 4 }
];

function createDefaultSave() {
  const cars = {};
  CARS.forEach((c, idx) => {
    cars[c.id] = {
      unlocked: idx === 0 || c.id === 'shogun',
      paint: c.defaultPaint,
      rim: c.defaultRim || 'steel',
      wing: c.defaultWing,
      suspension: idx === 0 ? 'stock' : 'sport',
      driftSetup: 'balanced',
      bodykit: c.defaultKit || 'stock',
      upgrades: { engine: 0, turbo: 0, drift: 0, tires: 0 }
    };
  });

  return {
    yen: 8500,
    selectedCar: 'shogun',
    selectedTrack: 'shibuya',
    selectedMode: 'drift_challenge',
    weather: 'rain',
    cars,
    records: {},
    leaderboard: [],
    claimedChallenges: {},
    stats: {
      bestCombo: 0,
      bestDriftScore: 0,
      racesWon: 0,
      battlesWon: 0,
      totalClips: 0,
      totalDrifts: 0
    },
    settings: {
      controlMode: 'auto',
      tiltSensitivity: 1.35,
      tiltDeadzone: 3.5,
      tiltCenter: 0,
      tiltInvert: false,
      quality: 'qhd1440',
      resMode: '1440p',
      resScale: 1.0,
      sharpen: 0.65,
      reflections: 'high',
      dynamicLights: true,
      particleDensity: 1.0,
      drawDistance: 520,
      visualStyle: 'realistic',
      showFps: true,
      sfxEnabled: true,
      musicEnabled: true,
      trafficEnabled: true
    }
  };
}

export class SaveManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    const def = createDefaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return def;
      const parsed = JSON.parse(raw);
      const merged = {
        ...def,
        ...parsed,
        stats: { ...def.stats, ...(parsed.stats || {}) },
        settings: { ...def.settings, ...(parsed.settings || {}) },
        cars: { ...def.cars },
        records: parsed.records || {},
        leaderboard: Array.isArray(parsed.leaderboard) ? parsed.leaderboard : [],
        claimedChallenges: parsed.claimedChallenges || {}
      };
      if (!merged.settings.photorealHeroV4) {
        merged.settings.visualStyle = 'realistic';
        merged.settings.photorealHeroV4 = true;
        merged.cars.shogun.unlocked = true;
        merged.selectedCar = 'shogun';
      }
      if (!merged.settings.qhd4kUpgradeV5) {
        merged.settings.quality = 'qhd1440';
        merged.settings.resMode = '1440p';
        merged.settings.sharpen = 0.65;
        merged.settings.qhd4kUpgradeV5 = true;
      }
      for (const c of CARS) {
        if (parsed.cars && parsed.cars[c.id]) {
          merged.cars[c.id] = {
            ...def.cars[c.id],
            ...parsed.cars[c.id],
            upgrades: { ...def.cars[c.id].upgrades, ...(parsed.cars[c.id].upgrades || {}) }
          };
        }
      }
      if (!merged.cars[merged.selectedCar]) merged.selectedCar = CARS[0].id;
      return merged;
    } catch {
      return def;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {}
  }

  getCarState(carId) {
    return this.data.cars[carId] || this.data.cars[CARS[0].id];
  }

  addYen(amount) {
    this.data.yen = Math.max(0, Math.floor(this.data.yen + amount));
    this.save();
  }

  spendYen(amount) {
    if (this.data.yen < amount) return false;
    this.data.yen = Math.floor(this.data.yen - amount);
    this.save();
    return true;
  }

  recordRun({ trackId, carId, mode, score, bestCombo, clips, wonRace, wonBattle, lapTime }) {
    const s = this.data.stats;
    if (bestCombo > s.bestCombo) s.bestCombo = Math.floor(bestCombo);
    if (score > s.bestDriftScore) s.bestDriftScore = Math.floor(score);
    if (wonRace) s.racesWon++;
    if (wonBattle) s.battlesWon++;
    s.totalClips += clips;

    if (!this.data.records[trackId]) this.data.records[trackId] = { bestDrift: 0, bestTime: null };
    const rec = this.data.records[trackId];
    let isNewRecord = false;

    if (score > (rec.bestDrift || 0)) {
      rec.bestDrift = Math.floor(score);
      if (mode === 'drift_challenge' || mode === 'drift_battle') isNewRecord = true;
    }
    if (lapTime && (!rec.bestTime || lapTime < rec.bestTime)) {
      rec.bestTime = lapTime;
      if (mode === 'time_attack' || mode === 'circuit') isNewRecord = true;
    }

    if (score >= 1000) {
      this.data.leaderboard.push({
        track: trackId,
        car: carId,
        score: Math.floor(score),
        mode
      });
      this.data.leaderboard.sort((a, b) => b.score - a.score);
      this.data.leaderboard = this.data.leaderboard.slice(0, 10);
    }

    const newlyCompleted = [];
    for (const ch of CHALLENGES) {
      if (!this.data.claimedChallenges[ch.id] && ch.check(this.data)) {
        this.data.claimedChallenges[ch.id] = true;
        this.data.yen += ch.reward;
        newlyCompleted.push(ch);
      }
    }

    this.save();
    return { isNewRecord, newlyCompleted };
  }
}
