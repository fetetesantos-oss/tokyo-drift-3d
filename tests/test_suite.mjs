// Automated Verification Suite for TOKYO DRIFT 3D (Physics, Sensors, Calibration, Collisions, Orientation & WebGL Mobile Smoke Test)

import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Mock minimal browser globals for direct Node unit testing of ES modules
globalThis.window = {
  innerWidth: 844,
  innerHeight: 390,
  orientation: 90,
  devicePixelRatio: 2,
  addEventListener() {},
  removeEventListener() {}
};
globalThis.screen = { orientation: { angle: 90, addEventListener() {} } };
Object.defineProperty(globalThis, 'navigator', { value: { maxTouchPoints: 5 }, configurable: true });
globalThis.localStorage = {
  _map: new Map(),
  getItem(k) { return this._map.has(k) ? this._map.get(k) : null; },
  setItem(k, v) { this._map.set(k, String(v)); }
};

const { ControlManager } = await import('../js/controls.js');
const { buildWorld, TRACKS, queryWorldTrack } = await import('../js/world.js');
const { RaceSimulation } = await import('../js/physics.js');
const { CARS, computeCarStats } = await import('../js/cars.js');
const { SaveManager } = await import('../js/storage.js');
const { ENGINE_PROFILES, TokyoAudioEngine } = await import('../js/audio.js');

const execFileAsync = promisify(execFile);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('\n=== 1. SENSOR, TILT, DEADZONE, CALIBRATION & ORIENTATION TESTS ===');

test('Landscape orientation detection (Android & iOS horizontal vs portrait)', () => {
  const settings = { controlMode: 'tilt', tiltSensitivity: 1.35, tiltDeadzone: 3.5, tiltCenter: 0, tiltInvert: false };
  const ctrl = new ControlManager(settings);
  assert.equal(ctrl.isLandscape, true);
  assert.equal(ctrl.screenAngle, 90);

  // Rotate to portrait
  window.innerWidth = 390; window.innerHeight = 844;
  ctrl._handleViewportChange();
  assert.equal(ctrl.isLandscape, false);

  // Rotate back to landscape-secondary (270 deg)
  window.innerWidth = 844; window.innerHeight = 390;
  screen.orientation.angle = 270;
  ctrl._handleViewportChange();
  assert.equal(ctrl.isLandscape, true);
  assert.equal(ctrl.screenAngle, 270);
  screen.orientation.angle = 90;
});

test('Tilt steering: Left, Center (deadzone), Right & smoothing', () => {
  const settings = { controlMode: 'tilt', tiltSensitivity: 1.2, tiltDeadzone: 4.0, tiltCenter: 0, tiltInvert: false };
  const ctrl = new ControlManager(settings);

  // Inside deadzone (+2.5 deg) -> stays strictly straight
  ctrl.simulateTilt(2.5, 90);
  for (let i = 0; i < 20; i++) ctrl.update(0.016);
  assert.ok(Math.abs(ctrl.steer) < 0.001, `Expected 0 inside deadzone, got ${ctrl.steer}`);

  // Tilt right (+22 deg in landscape-primary) -> steer > 0 (right)
  ctrl.simulateTilt(22, 90);
  for (let i = 0; i < 40; i++) ctrl.update(0.016);
  assert.ok(ctrl.steer > 0.45, `Expected positive right steer, got ${ctrl.steer}`);

  // Tilt left (-22 deg in landscape-primary) -> steer < 0 (left)
  ctrl.simulateTilt(-22, 90);
  for (let i = 0; i < 40; i++) ctrl.update(0.016);
  assert.ok(ctrl.steer < -0.45, `Expected negative left steer, got ${ctrl.steer}`);

  // Landscape-secondary (270 deg) auto-inverts raw beta so steering stays natural
  ctrl.simulateTilt(22, 270);
  for (let i = 0; i < 40; i++) ctrl.update(0.016);
  assert.ok(ctrl.steer < -0.45, `Expected inverted sign at 270 deg, got ${ctrl.steer}`);
});

test('Center calibration zeroes tilted resting posture', () => {
  const settings = { controlMode: 'tilt', tiltSensitivity: 1.35, tiltDeadzone: 3.0, tiltCenter: 0, tiltInvert: false };
  const ctrl = new ControlManager(settings);

  // User holds phone naturally angled at +12 degrees
  ctrl.simulateTilt(12, 90);
  ctrl.calibrateCenter();
  assert.equal(settings.tiltCenter, 12);

  for (let i = 0; i < 30; i++) ctrl.update(0.016);
  assert.ok(Math.abs(ctrl.steer) < 0.001, `Calibrated center should steer 0, got ${ctrl.steer}`);

  // Tilting +15 deg relative to calibrated center (raw 27 deg) steers right
  ctrl.simulateTilt(27, 90);
  for (let i = 0; i < 30; i++) ctrl.update(0.016);
  assert.ok(ctrl.steer > 0.35, `Expected steer right after calibration, got ${ctrl.steer}`);
});

test('Alternative on-screen button controls override when sensor unavailable', () => {
  const settings = { controlMode: 'buttons', tiltSensitivity: 1.35, tiltDeadzone: 3.5, tiltCenter: 0, tiltInvert: false };
  const ctrl = new ControlManager(settings);
  assert.equal(ctrl.useTiltSteering(), false);

  ctrl.touch.left = true;
  ctrl.touch.gas = true;
  ctrl.touch.handbrake = true;
  for (let i = 0; i < 30; i++) ctrl.update(0.016);
  assert.ok(ctrl.steer < -0.8);
  assert.equal(ctrl.throttle, 1);
  assert.equal(ctrl.handbrake, true);

  // Touch-anywhere on screen accelerates, and brake overrides screenGas cleanly
  ctrl.resetInputs();
  ctrl.setScreenGas(true);
  ctrl.update(0.016);
  assert.equal(ctrl.throttle, 1, 'Touching screen should engage throttle');
  ctrl.touch.brake = true;
  ctrl.update(0.016);
  assert.equal(ctrl.brake, 1);
  assert.equal(ctrl.throttle, 0, 'Brake should take priority over screen touch acceleration');
});

console.log('\n=== 2. 3D TRACKS, ELEVATION, DRIFT PHYSICS, COLLISIONS & AI TESTS ===');

test('All 4 3D Tokyo worlds build cleanly with elevation, tunnels/bridges & clip zones', () => {
  for (const t of TRACKS) {
    const w = buildWorld(t.id);
    assert.ok(w.N > 200, `Track ${t.id} should have dense spline points`);
    assert.ok(w.clipZones.length >= 2, `Track ${t.id} should have apex clip zones`);
    assert.ok(w.buildings.length > 20, `Track ${t.id} should have Tokyo scenery`);
    const ys = w.points.map(p => p.y);
    const elevSpan = Math.max(...ys) - Math.min(...ys);
    assert.ok(elevSpan > 3.5, `Track ${t.id} should have 3D elevation variation, got ${elevSpan}`);
  }
});

test('3D Drift physics: acceleration, handbrake drift angle, scoring, nitro & counter-steer', () => {
  const w = buildWorld('shibuya');
  const stats = computeCarStats(CARS[0], { upgrades: { engine: 1, turbo: 1, drift: 1, tires: 0 }, driftSetup: 'pro' });
  const sim = new RaceSimulation(w, stats, 'drift_challenge', false);
  sim.countdown = 0;

  // Accelerate straight to build speed
  for (let i = 0; i < 90; i++) {
    sim.step(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false }, 'rain', 1.0);
  }
  assert.ok(sim.player.speed > 25, `Car should accelerate, speed=${sim.player.speed}`);

  // Initiate right drift with handbrake + steering
  let maxDriftAngle = 0;
  for (let i = 0; i < 60; i++) {
    sim.step(1 / 60, { throttle: 1, brake: 0, steer: 0.9, handbrake: i < 25, nitro: false }, 'rain', 1.0);
    if (sim.player.driftAngleDeg > maxDriftAngle) maxDriftAngle = sim.player.driftAngleDeg;
  }
  assert.ok(maxDriftAngle > 16, `Car should achieve drift angle > 16°, got ${maxDriftAngle.toFixed(1)}°`);
  assert.ok(sim.driftBuffer > 100, `Drift should accumulate points, got ${sim.driftBuffer}`);
  assert.ok(sim.skids.length > 0, 'Drift should generate 3D skid marks');
  assert.ok(sim.particles.length > 0, 'Drift should generate tire smoke particles');

  // Verify Nitro activates & boosts speed
  const preNitro = sim.player.nitro;
  sim.step(0.1, { throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: true }, 'rain', 1.0);
  assert.ok(sim.player.nitro < preNitro, 'Nitro should consume charge');
});

test('Guardrail collision clamps car inside track & emits sparks/collision event', () => {
  const w = buildWorld('shibuya');
  const stats = computeCarStats(CARS[0], { upgrades: { engine: 0, turbo: 0, drift: 0, tires: 0 } });
  const sim = new RaceSimulation(w, stats, 'free_drift', false);
  sim.countdown = 0;

  // Push car directly into left guardrail at high lateral velocity
  const p0 = w.points[5];
  sim.player.x = p0.x + p0.lx * (w.cfg.roadHalfWidth + 4);
  sim.player.z = p0.z + p0.lz * (w.cfg.roadHalfWidth + 4);
  sim.player.vx = p0.lx * 22;
  sim.player.vz = p0.lz * 22;

  sim.step(1 / 60, { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false }, 'clear', 1.0);
  const q = queryWorldTrack(w, sim.player.x, sim.player.z, sim.player.trackIdx);
  assert.ok(q.absDist <= w.cfg.roadHalfWidth, `Car should be clamped inside guardrail, dist=${q.absDist}`);
  assert.ok(sim.events.some(e => e.type === 'collision'), 'Hard wall impact should emit collision event');
});

test('Circuit mode spawns 3 AI opponents & car-to-car collision resolves cleanly', () => {
  const w = buildWorld('wangan');
  const stats = computeCarStats(CARS[0], { upgrades: { engine: 0, turbo: 0, drift: 0, tires: 0 } });
  const sim = new RaceSimulation(w, stats, 'circuit', true);
  assert.equal(sim.aiCars.length, 3);
  assert.ok(sim.traffic.length >= 4);

  // Place player overlapping first AI car to test vehicle-to-vehicle collision
  sim.countdown = 0;
  const ai = sim.aiCars[0];
  sim.player.x = ai.x - 1.2;
  sim.player.z = ai.z;
  sim.player.vx = 18;
  sim.player.vz = 0;
  ai.vx = 0; ai.vz = 0;

  sim.step(1 / 60, { throttle: 1, brake: 0, steer: 0, handbrake: false, nitro: false }, 'clear', 1.0);
  const distAfter = Math.hypot(sim.player.x - ai.x, sim.player.z - ai.z);
  assert.ok(distAfter > 1.2, `Collision should separate vehicles, distAfter=${distAfter}`);
});

test('Progression save system: Yen rewards, unlocks & challenge completion', () => {
  const save = new SaveManager();
  const res = save.recordRun({
    trackId: 'shibuya', carId: 'kurokaze', mode: 'drift_challenge',
    score: 45000, bestCombo: 8500, clips: 12, wonRace: true, wonBattle: true, lapTime: 78.4
  });
  assert.equal(res.isNewRecord, true);
  assert.ok(res.newlyCompleted.length >= 4, 'Should unlock multiple progression challenges');
  assert.ok(save.data.yen > 15000, 'Should award challenge Yen bonuses');
});

test('Realistic per-car engine profiles & turbo upgrade audio configuration', () => {
  const seenProfiles = new Set();
  for (const car of CARS) {
    assert.ok(ENGINE_PROFILES[car.base.engineType], `Car ${car.id} missing valid ENGINE_PROFILES entry: ${car.base.engineType}`);
    seenProfiles.add(car.base.engineType);
    const stockStats = computeCarStats(car, { upgrades: { engine: 0, turbo: 0, drift: 0, tires: 0 } });
    assert.equal(stockStats.engineType, car.base.engineType);
    assert.equal(stockStats.hasTurbo, car.base.hasTurbo);
    const turboStats = computeCarStats(car, { upgrades: { engine: 0, turbo: 1, drift: 0, tires: 0 } });
    assert.equal(turboStats.hasTurbo, true, `Car ${car.id} should enable turbo sound when turbo upgrade installed`);
  }
  assert.equal(seenProfiles.size, CARS.length, 'Each of the 7 car tiers should have a distinct engine sound profile');
  const audio = new TokyoAudioEngine({ sfxEnabled: true, musicEnabled: true });
  audio.updateVehicle({ rpm: 0.75, gear: 3, slip: 0.5, nitro: false, throttle: true, engineType: 'v12_f1', hasTurbo: false, speed: 45, weather: 'rain', active: true });
  audio.playRevBlip('rotary', true);
});

console.log('\n=== 3. HEADLESS CHROME MOBILE LANDSCAPE WEBGL & DOM VERIFICATION ===');

// Start lightweight local HTTP server to test ES modules + WebGL in headless Chrome
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const cleanUrl = (req.url || '/').split('?')[0];
  const rel = cleanUrl === '/' ? 'index.html' : cleanUrl.replace(/^\/+/, '');
  const full = path.join(rootDir, rel);
  if (fs.existsSync(full) && fs.statSync(full).isFile()) {
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

try {
  // Run headless Chrome at Android Mobile Landscape resolution (844x390) with SwiftShader WebGL
  const { stdout } = await execFileAsync('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--window-size=844,390',
    '--virtual-time-budget=600',
    '--dump-dom',
    `http://127.0.0.1:${port}/index.html`
  ], { timeout: 25000, maxBuffer: 1024 * 1024 * 5 });

  assert.ok(stdout.includes('TOKYO'), 'DOM should render TOKYO DRIFT 3D UI');
  assert.ok(stdout.includes('Shibuya Crossing'), 'Track cards should be dynamically rendered by ES modules');
  assert.ok(stdout.includes('Desafio de Drift'), 'Mode cards should be dynamically rendered by ES modules');
  assert.ok(stdout.includes('1440p') && stdout.includes('4K'), 'Graphics options should expose 1440p QHD and 4K UHD modes');
  assert.ok(stdout.includes('portraitGuard') && stdout.includes('class="hidden"'), 'Portrait guard should stay hidden in 844x390 landscape');
  passed++;
  console.log('  [PASS] Headless Chrome Android Landscape (844x390) 1440p QHD ES Modules + WebGL boot verified');

  // Also test Portrait (390x844) triggers portrait orientation guard!
  const { stdout: portraitDom } = await execFileAsync('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--enable-webgl',
    '--window-size=390,844',
    '--virtual-time-budget=500',
    '--dump-dom',
    `http://127.0.0.1:${port}/index.html`
  ], { timeout: 25000, maxBuffer: 1024 * 1024 * 5 });

  assert.ok(!portraitDom.includes('<div id="portraitGuard" class="hidden">'), 'Portrait guard MUST activate in 390x844 portrait mode');
  passed++;
  console.log('  [PASS] Headless Chrome Portrait Guard (390x844) enforces landscape orientation');
} catch (err) {
  console.error('  [FAIL] Headless Chrome check:', err.message);
  process.exitCode = 1;
} finally {
  server.close();
}

console.log(`\nSUMMARY: ${passed} tests passed.\n`);
