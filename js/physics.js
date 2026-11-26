// 3D Drift Vehicle Physics, Counter-Steering, Collisions, AI Racers, Drift Battle Rival & Night Traffic

import { clamp, wrapAngle, lerp } from './math.js';
import { queryWorldTrack } from './world.js';

export function createVehicle({ x = 0, y = 0, z = 0, yaw = 0, isPlayer = false, name = 'Player', color = '#ff521b', laneOffset = 0, skill = 0.85 }) {
  return {
    x, y, z,
    vx: 0, vz: 0,
    yaw,
    yawVel: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    driftAngleDeg: 0,
    isDrifting: false,
    braking: false,
    nitro: 100,
    nitroActive: false,
    rpm: 0.2,
    gear: 1,
    trackIdx: 0,
    lap: 1,
    lapProgress: 0,
    totalProgress: 0,
    finished: false,
    finishTime: 0,
    isPlayer,
    name,
    color,
    laneOffset,
    skill,
    driftScore: 0,
    lastRearL: null,
    lastRearR: null,
    wallTapCooldown: 0,
    nearMissCooldown: 0
  };
}

export class RaceSimulation {
  constructor(world, playerStats, mode, trafficEnabled = true) {
    this.world = world;
    this.playerStats = playerStats;
    this.mode = mode; // 'circuit' | 'drift_challenge' | 'drift_battle' | 'time_attack' | 'free_drift' | 'jdm_meet'
    this.trafficEnabled = trafficEnabled;

    this.targetLaps = (mode === 'circuit') ? 3 : (mode === 'drift_battle' || mode === 'time_attack' ? 2 : 99);
    this.timeLeft = (mode === 'drift_challenge') ? 120 : 0;
    this.elapsedTime = 0;
    this.countdown = (mode === 'free_drift' || mode === 'jdm_meet') ? 0 : 3.2;
    this.lastCountdownInt = 4;

    // Scoring state
    this.score = 0;
    this.driftBuffer = 0;
    this.driftMult = 1.0;
    this.driftGrace = 0;
    this.maxGrace = 1.6;
    this.bestCombo = 0;
    this.clipsHit = 0;
    this.position = 1;
    this.totalRacers = 1;
    this.finished = false;
    this.callout = '';
    this.calloutTimer = 0;
    this.shake = 0;

    // 3D Visual FX queues
    this.particles = [];
    this.skids = [];

    // Events emitted to main/audio
    this.events = [];

    this.player = null;
    this.aiCars = [];
    this.traffic = [];

    this._spawnEntities();
  }

  _spawnEntities() {
    const pts = this.world.points;
    const p0 = pts[0];

    this.player = createVehicle({
      x: p0.x - p0.lx * 2.2,
      y: p0.y,
      z: p0.z - p0.lz * 2.2,
      yaw: p0.yaw,
      isPlayer: true,
      name: 'Você'
    });
    this.player.trackIdx = 0;

    // Spawn AI opponents for Circuit Race or Drift Battle
    if (this.mode === 'circuit') {
      const rivals = [
        { name: 'Takumi-K', color: '#f1f5f9', style: 'hatch',    lane: 2.5,  ahead: 2, skill: 0.88 },
        { name: 'Kenji R34',color: '#1d4ed8', style: 'gtr',      lane: -2.5, ahead: 4, skill: 0.93 },
        { name: 'Akira NSX',color: '#dc2626', style: 'supercar', lane: 2.5,  ahead: 6, skill: 0.97 }
      ];
      rivals.forEach(r => {
        const pt = pts[r.ahead % this.world.N];
        const v = createVehicle({
          x: pt.x + pt.lx * r.lane,
          y: pt.y,
          z: pt.z + pt.lz * r.lane,
          yaw: pt.yaw,
          name: r.name,
          color: r.color,
          laneOffset: r.lane,
          skill: r.skill
        });
        v.style = r.style;
        v.trackIdx = r.ahead % this.world.N;
        v.lapProgress = r.ahead;
        this.aiCars.push(v);
      });
    } else if (this.mode === 'drift_battle') {
      const pt = pts[2];
      const rival = createVehicle({
        x: pt.x + pt.lx * 2.8,
        y: pt.y,
        z: pt.z + pt.lz * 2.8,
        yaw: pt.yaw,
        name: 'DK Ryosuke',
        color: '#6d28d9',
        laneOffset: 2.8,
        skill: 0.92
      });
      rival.style = 'supercar';
      rival.isDriftRival = true;
      rival.trackIdx = 2;
      rival.lapProgress = 2;
      this.aiCars.push(rival);
    }

    this.totalRacers = 1 + this.aiCars.length;

    // Spawn Tokyo Street Traffic (for Free Drift, Drift Challenge, Circuit)
    const allowTraffic = this.trafficEnabled && this.mode !== 'time_attack' && this.mode !== 'jdm_meet';
    if (allowTraffic) {
      const tCount = this.world.cfg.theme === 'touge' ? 4 : 6;
      const tColors = ['#64748b', '#94a3b8', '#e2e8f0', '#334155', '#475569'];
      for (let i = 0; i < tCount; i++) {
        const idx = Math.floor(((i + 1) / (tCount + 1)) * this.world.N);
        const pt = pts[idx];
        const lane = (i % 2 === 0 ? 1 : -1) * (this.world.cfg.roadHalfWidth * 0.48);
        const tv = createVehicle({
          x: pt.x + pt.lx * lane,
          y: pt.y,
          z: pt.z + pt.lz * lane,
          yaw: pt.yaw,
          name: 'Tráfego',
          color: tColors[i % tColors.length],
          laneOffset: lane,
          skill: 0.45
        });
        tv.isTraffic = true;
        tv.trackIdx = idx;
        tv.cruiseSpeed = 18 + (i % 3) * 4;
        this.traffic.push(tv);
      }
    }
  }

  emit(type, payload = {}) {
    this.events.push({ type, ...payload });
  }

  setCallout(text) {
    this.callout = text;
    this.calloutTimer = 1.6;
  }

  bankDrift() {
    if (this.driftBuffer > 40) {
      const gained = Math.floor(this.driftBuffer * this.driftMult);
      this.score += gained;
      if (gained > this.bestCombo) this.bestCombo = gained;
      this.emit('bank', { gained });
      if (gained >= 6000) this.shake = Math.max(this.shake, 0.45);
    }
    this.driftBuffer = 0;
    this.driftMult = 1.0;
    this.driftGrace = 0;
  }

  breakDrift() {
    if (this.driftBuffer > 100) {
      this.setCallout('COMBO QUEBRADO!');
    }
    this.driftBuffer = 0;
    this.driftMult = 1.0;
    this.driftGrace = 0;
  }

  repositionPlayer() {
    const q = queryWorldTrack(this.world, this.player.x, this.player.z, this.player.trackIdx);
    this.player.x = q.point.x;
    this.player.y = q.y;
    this.player.z = q.point.z;
    this.player.yaw = q.point.yaw;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.yawVel = 0;
    this.player.lastRearL = null;
    this.player.lastRearR = null;
    this.breakDrift();
  }

  step(dt, controls, weather = 'rain', particleBudget = 1.0) {
    this.events.length = 0;
    if (this.finished) return;

    // Countdown before race start
    if (this.countdown > 0) {
      this.countdown -= dt;
      const cInt = Math.ceil(this.countdown);
      if (cInt < this.lastCountdownInt && cInt > 0) {
        this.lastCountdownInt = cInt;
        this.emit('countdown', { num: cInt });
      }
      if (this.countdown <= 0) {
        this.countdown = 0;
        this.emit('go');
        this.setCallout('GO! ACELERE!');
      }
      this._updateParticles(dt, weather, particleBudget);
      return;
    }

    this.elapsedTime += dt;
    if (this.calloutTimer > 0) this.calloutTimer -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 2.4 * dt);

    // 1. Update Player Physics
    this._updateCarPhysics(this.player, {
      throttle: controls.throttle,
      brake: controls.brake,
      steer: controls.steer,
      handbrake: controls.handbrake,
      nitro: controls.nitro && this.player.nitro > 3
    }, this.playerStats, dt, weather, particleBudget);

    // 2. Update AI Racers / Drift Rival
    for (const ai of this.aiCars) {
      this._updateAI(ai, dt, weather, particleBudget);
    }

    // 3. Update Street Traffic
    for (const tv of this.traffic) {
      this._updateTraffic(tv, dt);
    }

    // 4. Car-to-Car Collisions & Near-Miss Bonuses
    this._resolveVehicleCollisions();

    // 5. Clipping Zones, Drift Scoring & Race Progress
    this._updateGameplayRules(dt);

    // 6. Particles & Weather
    this._updateParticles(dt, weather, particleBudget);
  }

  _updateCarPhysics(v, inp, stats, dt, weather, particleBudget) {
    const totalSpdPre = Math.hypot(v.vx, v.vz);
    const oldFx = Math.sin(v.yaw), oldFz = Math.cos(v.yaw);
    const oldFwd = v.vx * oldFx + v.vz * oldFz;

    v.braking = inp.brake > 0 || inp.handbrake;

    // 1. Steering & Yaw Rotation FIRST (so car inertia naturally generates authentic drift slip angle!)
    // Remember: +steer (right) decreases yaw, -steer (left) increases yaw
    const spdFactor = clamp(totalSpdPre / 9, 0, 1);
    const revSign = oldFwd >= -1.5 ? 1 : -1;
    const driftSteerGain = inp.handbrake ? 1.42 : (v.isDrifting ? 1.15 : 1.0);
    const targetYawVel = -inp.steer * stats.steerRate * spdFactor * revSign * driftSteerGain;

    v.yawVel += (targetYawVel - v.yawVel) * Math.min(1, dt * (inp.handbrake ? 8.5 : 11.0));
    v.yaw = wrapAngle(v.yaw + v.yawVel * dt);

    // 2. Project existing inertial world velocity onto NEW heading basis (+Z forward, +X left)
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    const lx = Math.cos(v.yaw);
    const lz = -Math.sin(v.yaw);

    let fwd = v.vx * fx + v.vz * fz;
    let lat = v.vx * lx + v.vz * lz;
    const totalSpd = Math.hypot(v.vx, v.vz);

    // 3. Acceleration, Braking & Nitro
    let accel = 0;
    if (inp.throttle > 0) accel += stats.accel * inp.throttle;
    if (inp.brake > 0) {
      accel -= (fwd > 3 ? stats.accel * 1.35 : stats.accel * 0.55) * inp.brake;
    }
    if (inp.nitro && inp.throttle > 0 && v.nitro > 2) {
      accel += stats.nitroPower;
      v.nitro = Math.max(0, v.nitro - 28 * dt);
      v.nitroActive = true;
    } else {
      v.nitroActive = false;
      v.nitro = Math.min(100, v.nitro + 3.2 * (stats.nitroRegen || 1) * dt);
    }

    // Slope gravity influence (authentic uphill/downhill feel!)
    const qPre = queryWorldTrack(this.world, v.x, v.z, v.trackIdx);
    accel -= qPre.slope * 9.8;

    if (inp.handbrake) {
      fwd *= Math.pow(0.68, dt);
    }

    fwd += accel * dt;

    // Aerodynamic drag & top speed cap
    const maxSpd = stats.topSpeed + (v.nitroActive ? 16 : 0);
    if (fwd > maxSpd) fwd += (maxSpd - fwd) * Math.min(1, dt * 4.0);
    if (fwd < -18) fwd = -18;

    // Natural coasting resistance
    if (inp.throttle === 0 && inp.brake === 0) {
      fwd *= Math.pow(0.55, dt);
    }

    // 4. Lateral Tire Grip & Drift Dynamics (Rain reduces lateral grip for silky Tokyo drifts!)
    const rainGripMult = (weather === 'rain') ? 0.85 : 1.0;
    const slipRatio = totalSpd > 4 ? Math.abs(lat) / totalSpd : 0;
    const initiating = inp.handbrake || (slipRatio > 0.16 && inp.throttle > 0);
    let latGrip = (initiating ? stats.driftGrip : stats.grip) * rainGripMult;
    if (inp.handbrake) latGrip *= 0.48;

    // Apply lateral tire grip damping
    lat *= Math.exp(-latGrip * dt);

    // Tail kick-out assist when initiating drift with throttle + steer
    if (Math.abs(inp.steer) > 0.2 && inp.throttle > 0 && fwd > 16 && (inp.handbrake || slipRatio > 0.14)) {
      lat += inp.steer * 14.0 * dt;
    }

    // Gentle drift stabilization so deep angles stay controllable with mobile tilt counter-steering
    const maxLat = Math.max(12, Math.abs(fwd) * 1.15);
    lat = clamp(lat, -maxLat, maxLat);

    // 5. Rebuild world XZ velocity using the SAME new heading basis
    v.vx = fx * fwd + lx * lat;
    v.vz = fz * fwd + lz * lat;

    v.x += v.vx * dt;
    v.z += v.vz * dt;

    // Telemetry
    v.forwardSpeed = fwd;
    v.lateralSpeed = lat;
    v.speed = Math.hypot(v.vx, v.vz);

    const velYaw = Math.atan2(v.vx, v.vz);
    const slipRad = wrapAngle(velYaw - v.yaw);
    v.driftAngleDeg = v.speed > 9 ? Math.min(82, Math.abs(slipRad * 180 / Math.PI)) : 0;
    v.isDrifting = v.speed > 13 && v.driftAngleDeg > 12 && fwd > 6;

    // Virtual 6-speed gearbox & RPM
    const kmh = v.speed * 3.6;
    const gLimits = [0, 52, 94, 142, 192, 245, 315];
    let gear = 1;
    while (gear < 6 && kmh > gLimits[gear]) gear++;
    v.gear = fwd < -1.5 ? 'R' : gear;
    const gMin = gLimits[gear - 1] || 0;
    const gMax = gLimits[gear] || 315;
    v.rpm = clamp((kmh - gMin * 0.7) / (gMax - gMin * 0.7), 0.18, 1.0);

    // Track Elevation, Pitch, Body Roll & Guardrail Collision
    const q = queryWorldTrack(this.world, v.x, v.z, v.trackIdx);
    v.y = q.y;

    // Dynamic chassis pitch (track slope + acceleration squat / brake dive)
    const accelSquat = (inp.throttle > 0 ? -0.025 : 0) + (v.nitroActive ? -0.035 : 0) + (inp.brake > 0 ? 0.03 : 0);
    const targetPitch = -Math.atan(q.slope) + accelSquat;
    v.pitch = lerp(v.pitch, targetPitch, Math.min(1, dt * 10));

    // Dynamic body roll into corners
    const targetRoll = clamp(lat * 0.0085, -0.14, 0.14);
    v.roll = lerp(v.roll, targetRoll, Math.min(1, dt * 10));

    // Track lap progression
    let dIdx = q.idx - v.trackIdx;
    if (dIdx < -this.world.N * 0.5) dIdx += this.world.N;
    if (dIdx > this.world.N * 0.5) dIdx -= this.world.N;
    v.lapProgress += dIdx;
    v.trackIdx = q.idx;

    if (v.lapProgress >= this.world.N) {
      v.lapProgress -= this.world.N;
      v.lap++;
      if (v.isPlayer) {
        this.emit('lap', { lap: v.lap });
        if (this.mode === 'circuit' || this.mode === 'time_attack' || this.mode === 'drift_battle') {
          if (v.lap > this.targetLaps) {
            v.finished = true;
            v.finishTime = this.elapsedTime;
            this.bankDrift();
            this.finished = true;
            this.emit('finish');
          } else {
            this.setCallout(`VOLTA ${v.lap} / ${this.targetLaps}`);
          }
        } else {
          this.score += 1000;
          this.setCallout(`VOLTA ${v.lap} • +1.000`);
        }
      } else if (v.lap > this.targetLaps && !v.finished) {
        v.finished = true;
        v.finishTime = this.elapsedTime;
      }
    }
    v.totalProgress = (v.lap - 1) * this.world.N + v.lapProgress;

    // Guardrail Collision
    const wallLimit = this.world.cfg.roadHalfWidth - 0.55;
    if (v.wallTapCooldown > 0) v.wallTapCooldown -= dt;

    if (q.absDist > wallLimit) {
      const sign = q.signedLeft >= 0 ? 1 : -1;
      const pt = q.point;
      v.x = pt.x + pt.lx * sign * wallLimit;
      v.z = pt.z + pt.lz * sign * wallLimit;

      const vn = (v.vx * pt.lx + v.vz * pt.lz) * sign;
      if (vn > 0) {
        v.vx -= pt.lx * sign * vn * 1.25;
        v.vz -= pt.lz * sign * vn * 1.25;
        v.vx *= 0.88;
        v.vz *= 0.88;

        this._spawnSparks(v.x + pt.lx * sign * 0.9, v.y + 0.55, v.z + pt.lz * sign * 0.9, 8);

        if (v.isPlayer) {
          if (vn > 11.5) {
            this.shake = Math.max(this.shake, 0.75);
            this.emit('collision', { intensity: clamp(vn / 24, 0.4, 1.0) });
            this.breakDrift();
          } else if (v.isDrifting && v.wallTapCooldown <= 0 && this.driftBuffer > 60) {
            v.wallTapCooldown = 1.6;
            this.driftBuffer += 300;
            this.driftMult = Math.min(8.0, this.driftMult + 0.4);
            this.setCallout('WALL TAP! +300');
            this.emit('clip');
            this.shake = Math.max(this.shake, 0.25);
          }
        }
      }
    }

    // Tire Smoke & 3D Skid Marks
    const slipInt = v.isDrifting ? clamp((v.driftAngleDeg - 10) / 36, 0, 1) : (inp.handbrake && v.speed > 10 ? 0.7 : 0);
    const rearZ = -1.45;
    const halfW = 0.82;
    const rlx = v.x + fx * rearZ + lx * halfW;
    const rlz = v.z + fz * rearZ + lz * halfW;
    const rrx = v.x + fx * rearZ - lx * halfW;
    const rrz = v.z + fz * rearZ - lz * halfW;

    if (slipInt > 0.1) {
      if (v.lastRearL) {
        this._addSkidSegment(v.lastRearL, [rlx, v.y + 0.04, rlz], lx, lz, 0.22 + slipInt * 0.45);
        this._addSkidSegment(v.lastRearR, [rrx, v.y + 0.04, rrz], lx, lz, 0.22 + slipInt * 0.45);
      }
      if (Math.random() < 0.78 * particleBudget) {
        const smokeRgb = v.nitroActive ? [0.55, 0.92, 1.0] : [0.85, 0.88, 0.94];
        this._spawnSmoke(rlx, v.y + 0.25, rlz, smokeRgb, slipInt);
        this._spawnSmoke(rrx, v.y + 0.25, rrz, smokeRgb, slipInt);
      }
    }
    v.lastRearL = [rlx, v.y + 0.04, rlz];
    v.lastRearR = [rrx, v.y + 0.04, rrz];

    // Nitro exhaust flames
    if (v.nitroActive && Math.random() < 0.9 * particleBudget) {
      const exX = v.x - fx * 2.25;
      const exZ = v.z - fz * 2.25;
      this.particles.push({
        x: exX + (Math.random() - 0.5) * 0.3,
        y: v.y + 0.36,
        z: exZ + (Math.random() - 0.5) * 0.3,
        vx: -fx * 12 + v.vx * 0.35,
        vy: 0.5 + Math.random(),
        vz: -fz * 12 + v.vz * 0.35,
        r: 0.16, g: 0.86, b: 1.0, a: 0.95,
        size: 0.85 + Math.random() * 0.45,
        grow: -1.8,
        life: 0.18, maxLife: 0.18
      });
    }
  }

  _updateAI(ai, dt, weather, particleBudget) {
    const pts = this.world.points;
    const lookAhead = ai.isDriftRival ? 7 : 9;
    const targetPt = pts[(ai.trackIdx + lookAhead) % this.world.N];
    const tx = targetPt.x + targetPt.lx * ai.laneOffset;
    const tz = targetPt.z + targetPt.lz * ai.laneOffset;

    const desiredYaw = Math.atan2(tx - ai.x, tz - ai.z);
    const yawDiff = wrapAngle(desiredYaw - ai.yaw);
    // Remember +steer turns right (-yaw), so steer = -yawDiff
    const steer = clamp(-yawDiff * 2.4, -1, 1);

    const sharpTurn = Math.abs(targetPt.curv) > 0.036;
    const aiStats = {
      topSpeed: 58 * ai.skill + 10,
      accel: 25 * ai.skill + 4,
      steerRate: 2.8,
      grip: ai.isDriftRival ? 5.2 : 6.8,
      driftGrip: ai.isDriftRival ? 1.85 : 2.8,
      nitroPower: 18,
      nitroRegen: 1.0
    };

    const handbrake = ai.isDriftRival && sharpTurn && ai.speed > 26;
    const throttle = sharpTurn && ai.speed > 44 ? 0.55 : 1.0;

    this._updateCarPhysics(ai, {
      throttle,
      brake: 0,
      steer,
      handbrake,
      nitro: !sharpTurn && Math.abs(yawDiff) < 0.1 && ai.nitro > 60
    }, aiStats, dt, weather, particleBudget * 0.6);

    // Drift Battle AI accumulates live drift points
    if (ai.isDriftRival && ai.isDrifting) {
      ai.driftScore += ai.driftAngleDeg * ai.speed * 0.42 * dt;
    }
  }

  _updateTraffic(tv, dt) {
    const pts = this.world.points;
    const nextPt = pts[(tv.trackIdx + 4) % this.world.N];
    const tx = nextPt.x + nextPt.lx * tv.laneOffset;
    const tz = nextPt.z + nextPt.lz * tv.laneOffset;
    const targetYaw = Math.atan2(tx - tv.x, tz - tv.z);
    tv.yaw = wrapAngle(tv.yaw + wrapAngle(targetYaw - tv.yaw) * Math.min(1, dt * 6));
    tv.vx = Math.sin(tv.yaw) * tv.cruiseSpeed;
    tv.vz = Math.cos(tv.yaw) * tv.cruiseSpeed;
    tv.x += tv.vx * dt;
    tv.z += tv.vz * dt;
    const q = queryWorldTrack(this.world, tv.x, tv.z, tv.trackIdx);
    tv.y = q.y;
    tv.pitch = -Math.atan(q.slope);
    tv.trackIdx = q.idx;
  }

  _resolveVehicleCollisions() {
    const allOthers = [...this.aiCars, ...this.traffic];
    const p = this.player;
    const minDist = 2.65;

    for (const other of allOthers) {
      const dx = p.x - other.x;
      const dz = p.z - other.z;
      const dist = Math.hypot(dx, dz);

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = minDist - dist;
        p.x += nx * overlap * 0.7;
        p.z += nz * overlap * 0.7;
        other.x -= nx * overlap * 0.3;
        other.z -= nz * overlap * 0.3;

        const relVn = (p.vx - other.vx) * nx + (p.vz - other.vz) * nz;
        if (relVn < 0) {
          p.vx -= nx * relVn * 1.15;
          p.vz -= nz * relVn * 1.15;
          if (!other.isTraffic) {
            other.vx += nx * relVn * 0.5;
            other.vz += nz * relVn * 0.5;
          }
          const impact = Math.abs(relVn);
          this._spawnSparks((p.x + other.x) * 0.5, p.y + 0.6, (p.z + other.z) * 0.5, 12);
          if (impact > 5.5) {
            this.shake = Math.max(this.shake, 0.7);
            this.emit('collision', { intensity: clamp(impact / 22, 0.35, 1.0) });
            if (impact > 10) this.breakDrift();
          }
        }
      } else if (p.isDrifting && dist < 5.6 && p.nearMissCooldown <= 0 && p.speed > 20) {
        // Near-Miss Proximity Bonus while drifting past traffic or rival!
        p.nearMissCooldown = 1.8;
        this.driftBuffer += 350;
        this.driftMult = Math.min(8.0, this.driftMult + 0.45);
        this.driftGrace = this.maxGrace;
        this.setCallout('QUASE COLISÃO! +350');
        this.emit('clip');
      }
    }
  }

  _updateGameplayRules(dt) {
    const p = this.player;
    if (p.nearMissCooldown > 0) p.nearMissCooldown -= dt;

    // Apex Clipping Zones
    for (const z of this.world.clipZones) {
      if (z.cooldown > 0) z.cooldown -= dt;
      if (z.cooldown <= 0 && p.isDrifting) {
        const d = Math.hypot(p.x - z.x, p.z - z.z);
        if (d < z.radius) {
          z.cooldown = 6.5;
          this.clipsHit++;
          this.driftBuffer += 500;
          this.driftMult = Math.min(8.0, this.driftMult + 0.65);
          this.driftGrace = this.maxGrace;
          p.nitro = Math.min(100, p.nitro + 24);
          this.setCallout('APEX CLIP! +500');
          this.emit('clip');
          this._spawnSparks(z.x, z.y + 0.5, z.z, 14, [0.13, 0.85, 0.95]);
        }
      }
    }

    // Drift Score & Combo Chain
    if (p.isDrifting) {
      const angleFactor = clamp(p.driftAngleDeg / 24, 0.4, 2.7);
      const speedFactor = clamp(p.speed / 26, 0.5, 2.6);
      const pts = 260 * angleFactor * speedFactor * dt;
      this.driftBuffer += pts;
      this.driftMult = Math.min(8.0, this.driftMult + 0.25 * dt);
      this.driftGrace = this.maxGrace;
      p.nitro = Math.min(100, p.nitro + 11 * angleFactor * (this.playerStats.nitroRegen || 1) * dt);

      if (p.driftAngleDeg > 50 && this.calloutTimer <= 0) {
        this.setCallout('ÂNGULO PRO DRIFT!');
      } else if (this.driftMult >= 5.0 && this.calloutTimer <= 0) {
        this.setCallout(`COMBO TOUGE ×${this.driftMult.toFixed(1)}`);
      }
    } else if (this.driftBuffer > 0) {
      this.driftGrace -= dt;
      if (this.driftGrace <= 0) {
        this.bankDrift();
      }
    }

    // Race Position (1st..4th)
    if (this.aiCars.length > 0) {
      let ahead = 0;
      for (const ai of this.aiCars) {
        if (this.mode === 'drift_battle') {
          if (ai.driftScore > (this.score + this.driftBuffer * this.driftMult)) ahead++;
        } else {
          if (ai.totalProgress > p.totalProgress) ahead++;
        }
      }
      this.position = 1 + ahead;
    }

    // Drift Challenge Timer
    if (this.mode === 'drift_challenge') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.bankDrift();
        this.finished = true;
        this.emit('finish');
      }
    }
  }

  _addSkidSegment(p0, p1, lx, lz, alpha) {
    const hw = 0.16;
    this.skids.push({
      a: [p0[0] + lx * hw, p0[1], p0[2] + lz * hw],
      b: [p0[0] - lx * hw, p0[1], p0[2] - lz * hw],
      c: [p1[0] - lx * hw, p1[1], p1[2] - lz * hw],
      d: [p1[0] + lx * hw, p1[1], p1[2] + lz * hw],
      alpha: clamp(alpha, 0.1, 0.72)
    });
    if (this.skids.length > 480) this.skids.shift();
  }

  _spawnSmoke(x, y, z, rgb, intensity) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 0.35,
      y,
      z: z + (Math.random() - 0.5) * 0.35,
      vx: (Math.random() - 0.5) * 2.1,
      vy: 1.0 + Math.random() * 1.4,
      vz: (Math.random() - 0.5) * 2.1,
      r: rgb[0], g: rgb[1], b: rgb[2],
      a: 0.42 + intensity * 0.36,
      size: 1.15 + intensity * 0.85,
      grow: 2.8,
      life: 0.78 + Math.random() * 0.42,
      maxLife: 1.2
    });
  }

  _spawnSparks(x, y, z, count, rgb = [1.0, 0.75, 0.2]) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y, z,
        vx: (Math.random() - 0.5) * 14,
        vy: 2.5 + Math.random() * 6,
        vz: (Math.random() - 0.5) * 14,
        r: rgb[0], g: rgb[1], b: rgb[2], a: 1.0,
        size: 0.38,
        grow: -0.4,
        life: 0.32 + Math.random() * 0.22,
        maxLife: 0.54
      });
    }
  }

  _updateParticles(dt, weather, budget) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      pt.size = Math.max(0.1, pt.size + pt.grow * dt);
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // 3D Neon Rain Streaks around player car when weather === 'rain'
    if (weather === 'rain' && budget > 0.3) {
      const drops = Math.ceil(6 * budget);
      const p = this.player;
      for (let i = 0; i < drops; i++) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 42,
          y: p.y + 8 + Math.random() * 14,
          z: p.z + (Math.random() - 0.5) * 42,
          vx: -2.0,
          vy: -26.0,
          vz: -2.0,
          r: 0.55, g: 0.85, b: 1.0, a: 0.42,
          size: 0.22,
          grow: 0,
          life: 0.55, maxLife: 0.55
        });
      }
    }

    const maxP = Math.floor(620 * budget);
    if (this.particles.length > maxP) {
      this.particles.splice(0, this.particles.length - maxP);
    }
  }
}
