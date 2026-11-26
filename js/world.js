// 4 3D Tokyo Circuits with Elevation, Tunnels, Suspension Bridges, Neon Cityscape, Vending Machines, Torii & Car Meet Plaza

import { catmullRom3D, clamp } from './math.js';

export const TRACKS = [
  {
    id: 'shibuya',
    name: 'Shibuya Crossing',
    jp: '渋谷スクランブル',
    desc: 'Cruzamento chuvoso de Shibuya com prédios comerciais iluminados, viaduto, túnel e asfalto espelhado.',
    theme: 'shibuya',
    roadHalfWidth: 11.5,
    skyColor: [0.025, 0.035, 0.055],
    fogColor: [0.035, 0.048, 0.072],
    accent1: '#e11d48',
    accent2: '#f8fafc',
    controlPoints: [
      [0,    0.0,   0],
      [0,    0.0,  110],
      [48,   3.5,  210],
      [135,  8.5,  250],
      [235,  8.5,  215],
      [295,  3.0,  130],
      [260,  0.0,   35],
      [185,  0.0,   10],
      [195,  0.0,  -85],
      [270, -1.5, -175],
      [195, -2.5, -265],
      [85,  -1.5, -260],
      [15,   0.0, -185],
      [-55,  0.0, -125],
      [-45,  0.0,  -55]
    ],
    tunnelRange: [0.58, 0.78],
    bridgeRange: [0.16, 0.34]
  },
  {
    id: 'wangan',
    name: 'Wangan Bay Bridge',
    jp: '湾岸高速',
    desc: 'Rodovia expressa noturna com ponte estaiada, túnel iluminado por lâmpadas de sódio e alta velocidade.',
    theme: 'wangan',
    roadHalfWidth: 13.5,
    skyColor: [0.02, 0.032, 0.055],
    fogColor: [0.03, 0.045, 0.075],
    accent1: '#fbbf24',
    accent2: '#e2e8f0',
    controlPoints: [
      [0,    0.0,   0],
      [0,    0.5,  140],
      [55,   7.5,  280],
      [175, 13.5,  345],
      [315, 13.5,  300],
      [390,  6.5,  180],
      [365,  0.5,   30],
      [295, -2.0, -115],
      [210, -3.5, -245],
      [85,  -2.5, -295],
      [-45,  0.0, -230],
      [-95,  1.5, -110],
      [-45,  0.0,  -45]
    ],
    tunnelRange: [0.54, 0.77],
    bridgeRange: [0.15, 0.42]
  },
  {
    id: 'hakone',
    name: 'Hakone Touge',
    jp: '箱根峠',
    desc: 'Serra japonesa noturna com neblina, grampos fechados, guardrails metálicos, portais Torii e cedros.',
    theme: 'touge',
    roadHalfWidth: 9.6,
    skyColor: [0.025, 0.032, 0.048],
    fogColor: [0.045, 0.052, 0.068],
    accent1: '#f59e0b',
    accent2: '#f8fafc',
    controlPoints: [
      [0,    0.0,   0],
      [0,    1.5,   95],
      [68,   6.0,  165],
      [155, 11.5,  140],
      [140, 15.0,   55],
      [225, 16.5,    5],
      [285, 13.0,  -80],
      [215,  9.5, -160],
      [135,  6.5, -115],
      [115,  4.0, -210],
      [25,   2.0, -245],
      [-65,  1.0, -175],
      [-35,  0.5,  -95],
      [-85,  0.0,  -35]
    ],
    tunnelRange: null,
    bridgeRange: [0.22, 0.32]
  },
  {
    id: 'daikoku',
    name: 'Daikoku PA — Meet JDM',
    jp: '大黒パーキング',
    desc: 'Estacionamento noturno realista sob refletores de LED cercado por carros JDM estacionados.',
    theme: 'daikoku',
    roadHalfWidth: 16.0,
    skyColor: [0.022, 0.03, 0.05],
    fogColor: [0.035, 0.045, 0.07],
    accent1: '#f8fafc',
    accent2: '#fbbf24',
    controlPoints: [
      [0,   0.0,   0],
      [0,   0.0,  115],
      [65,  2.5,  195],
      [175, 4.5,  195],
      [245, 2.5,  110],
      [245, 0.0,  -25],
      [185, 0.0, -135],
      [75,  0.0, -165],
      [-45, 0.0, -125],
      [-75, 0.0,  -35]
    ],
    tunnelRange: null,
    bridgeRange: [0.18, 0.36]
  }
];

function createSeededRand(str) {
  let seed = 1;
  for (let i = 0; i < str.length; i++) seed = (seed * 131 + str.charCodeAt(i)) % 2147483647;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function buildWorld(trackId) {
  const cfg = TRACKS.find(t => t.id === trackId) || TRACKS[0];
  const cps = cfg.controlPoints;
  const nCp = cps.length;
  const subSteps = 22;

  const raw = [];
  for (let i = 0; i < nCp; i++) {
    const p0 = cps[(i - 1 + nCp) % nCp];
    const p1 = cps[i];
    const p2 = cps[(i + 1) % nCp];
    const p3 = cps[(i + 2) % nCp];
    for (let s = 0; s < subSteps; s++) {
      raw.push(catmullRom3D(p0, p1, p2, p3, s / subSteps));
    }
  }

  const N = raw.length;
  const points = [];
  let totalLength = 0;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < N; i++) {
    const prev = raw[(i - 1 + N) % N];
    const curr = raw[i];
    const next = raw[(i + 1) % N];

    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const dz = next[2] - prev[2];
    const horizLen = Math.hypot(dx, dz) || 1;
    const len3 = Math.hypot(dx, dy, dz) || 1;

    const tx = dx / horizLen;
    const tz = dz / horizLen;
    const slope = dy / horizLen; // tan(pitch)
    // Left normal in right-handed Y-up: (+tz, 0, -tx)
    const lx = tz;
    const lz = -tx;

    const segDist = Math.hypot(curr[0] - prev[0], curr[1] - prev[1], curr[2] - prev[2]);
    totalLength += segDist;

    // Horizontal curvature
    const v1x = curr[0] - prev[0], v1z = curr[2] - prev[2];
    const v2x = next[0] - curr[0], v2z = next[2] - curr[2];
    const l1 = Math.hypot(v1x, v1z) || 1;
    const l2 = Math.hypot(v2x, v2z) || 1;
    const curv = (v1x * v2z - v1z * v2x) / (l1 * l2);

    const frac = i / N;
    const isTunnel = !!(cfg.tunnelRange && frac >= cfg.tunnelRange[0] && frac <= cfg.tunnelRange[1]);
    const isBridge = !!(cfg.bridgeRange && frac >= cfg.bridgeRange[0] && frac <= cfg.bridgeRange[1]);

    if (curr[0] < minX) minX = curr[0];
    if (curr[0] > maxX) maxX = curr[0];
    if (curr[2] < minZ) minZ = curr[2];
    if (curr[2] > maxZ) maxZ = curr[2];

    points.push({
      i,
      x: curr[0],
      y: curr[1],
      z: curr[2],
      tx, tz,
      ty: dy / len3,
      slope,
      lx, lz,
      yaw: Math.atan2(tx, tz),
      curv,
      s: totalLength,
      isTunnel,
      isBridge
    });
  }

  // Generate Apex Clipping Zones on high-curvature turns
  const clipZones = [];
  let cool = 12;
  for (let i = 14; i < N - 14; i++) {
    if (cool > 0) { cool--; continue; }
    let avgC = 0;
    for (let k = -3; k <= 3; k++) avgC += points[(i + k + N) % N].curv;
    avgC /= 7;
    if (Math.abs(avgC) > 0.042) {
      const p = points[i];
      // Outer edge of corner
      const side = avgC > 0 ? 1 : -1;
      const offset = side * (cfg.roadHalfWidth - 2.6);
      clipZones.push({
        idx: i,
        x: p.x + p.lx * offset,
        y: p.y + 0.08,
        z: p.z + p.lz * offset,
        yaw: p.yaw,
        radius: 4.8,
        cooldown: 0
      });
      cool = 28;
    }
  }

  // Scenery placement helper
  const rand = createSeededRand(cfg.id + '_tokyo3d');
  const minDistToRoad = (x, z) => {
    let best = Infinity;
    for (let i = 0; i < N; i += 2) {
      const d = Math.hypot(x - points[i].x, z - points[i].z);
      if (d < best) best = d;
    }
    return best;
  };

  // Buildings, Neon Signs, Vending Machines, Trees, Torii Gates & Street Lamps
  const buildings = [];
  const lamps = [];
  const props = []; // vending machines, torii, bridge towers
  const meetCars = []; // parked JDM cars at car meet areas

  const neonColors = ['#dc2626', '#f8fafc', '#1d4ed8', '#f59e0b', '#0284c7', '#e11d48'];

  // Street lamps along the circuit
  for (let i = 0; i < N; i += 8) {
    const p = points[i];
    if (p.isTunnel) continue;
    const side = (i % 16 === 0) ? 1 : -1;
    const d = cfg.roadHalfWidth + 1.8;
    lamps.push({
      x: p.x + p.lx * side * d,
      y: p.y,
      z: p.z + p.lz * side * d,
      yaw: p.yaw + (side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5),
      color: side > 0 ? cfg.accent2 : cfg.accent1
    });

    // Place Japanese Vending Machines / Storefront kiosks along Shibuya & Daikoku sidewalks
    if ((cfg.theme === 'shibuya' || cfg.theme === 'daikoku') && !p.isBridge && i % 24 === 0) {
      const vd = cfg.roadHalfWidth + 3.8;
      props.push({
        type: 'vending',
        x: p.x + p.lx * (-side) * vd,
        y: p.y,
        z: p.z + p.lz * (-side) * vd,
        yaw: p.yaw + (side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5),
        color: neonColors[i % neonColors.length]
      });
    }

    // Place Torii Gates arching over Hakone Touge!
    if (cfg.theme === 'touge' && !p.isBridge && i > 10 && i % 56 === 0) {
      props.push({
        type: 'torii',
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        span: cfg.roadHalfWidth * 2 + 2.4
      });
    }
  }

  // Place Suspension Bridge Towers on bridge sections
  if (cfg.bridgeRange) {
    const i1 = Math.floor((cfg.bridgeRange[0] + (cfg.bridgeRange[1] - cfg.bridgeRange[0]) * 0.28) * N);
    const i2 = Math.floor((cfg.bridgeRange[0] + (cfg.bridgeRange[1] - cfg.bridgeRange[0]) * 0.72) * N);
    [i1, i2].forEach(idx => {
      const p = points[idx % N];
      props.push({
        type: 'bridge_tower',
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        span: cfg.roadHalfWidth + 1.5,
        color: cfg.accent2
      });
    });
  }

  // Generate Tokyo Skyscrapers or Touge Trees around track
  const pad = 95;
  const gridStep = cfg.theme === 'touge' ? 20 : 28;
  for (let gx = minX - pad; gx <= maxX + pad; gx += gridStep) {
    for (let gz = minZ - pad; gz <= maxZ + pad; gz += gridStep) {
      const bx = gx + (rand() - 0.5) * gridStep * 0.55;
      const bz = gz + (rand() - 0.5) * gridStep * 0.55;
      const dist = minDistToRoad(bx, bz);
      const w = cfg.theme === 'touge' ? (4.5 + rand() * 3.5) : (12 + rand() * 14);
      const d = cfg.theme === 'touge' ? w : (12 + rand() * 14);
      const minClear = cfg.roadHalfWidth + Math.hypot(w, d) * 0.55 + 4.5;

      if (dist > minClear && dist < 115) {
        if (cfg.theme === 'touge') {
          buildings.push({
            type: 'tree',
            x: bx, y: 0, z: bz,
            w, h: 10 + rand() * 11, d,
            isSakura: rand() < 0.35
          });
        } else {
          const h = (dist < 42 ? 22 : 34) + rand() * 44;
          buildings.push({
            type: 'tower',
            x: bx, y: -1.5, z: bz,
            w, h, d,
            neonColor: neonColors[Math.floor(rand() * neonColors.length)],
            signIdx: Math.floor(rand() * 4),
            hasBillboard: rand() < 0.55
          });
        }
      }
    }
  }

  // JDM Car Meet Parking Area (Parked custom JDM cars alongside the track)
  const meetCount = cfg.theme === 'daikoku' ? 10 : 5;
  const meetColors = ['#ff521b', '#1d4ed8', '#e11d74', '#eab308', '#6d28d9', '#059669', '#f1f5f9'];
  for (let m = 0; m < meetCount; m++) {
    const idx = (cfg.theme === 'daikoku' ? 6 + m * 6 : 8 + m * 3) % N;
    const p = points[idx];
    if (p.isTunnel || p.isBridge) continue;
    const offset = (cfg.roadHalfWidth + 4.6) * (m % 2 === 0 ? 1 : -1);
    meetCars.push({
      x: p.x + p.lx * offset,
      y: p.y + 0.02,
      z: p.z + p.lz * offset,
      yaw: p.yaw + (m % 2 === 0 ? -0.55 : 0.55),
      color: meetColors[m % meetColors.length],
      underglow: neonColors[m % neonColors.length]
    });
  }

  return {
    cfg,
    points,
    N,
    totalLength,
    clipZones,
    lamps,
    props,
    buildings,
    meetCars,
    bounds: { minX: minX - 25, maxX: maxX + 25, minZ: minZ - 25, maxZ: maxZ + 25 }
  };
}

// Fast nearest track point + exact interpolated elevation & signed lateral offset
export function queryWorldTrack(world, x, z, hintIdx = -1) {
  const pts = world.points;
  const N = world.N;
  let bestIdx = 0;
  let bestD2 = Infinity;

  if (hintIdx >= 0 && hintIdx < N) {
    // Local window search first (O(1))
    const win = 24;
    for (let k = -win; k <= win; k++) {
      const i = (hintIdx + k + N) % N;
      const dx = x - pts[i].x;
      const dz = z - pts[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    // Fallback to global if far from hint
    if (bestD2 > 45 * 45) {
      for (let i = 0; i < N; i++) {
        const dx = x - pts[i].x;
        const dz = z - pts[i].z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
      }
    }
  } else {
    for (let i = 0; i < N; i++) {
      const dx = x - pts[i].x;
      const dz = z - pts[i].z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
  }

  const p = pts[bestIdx];
  const next = pts[(bestIdx + 1) % N];
  const prev = pts[(bestIdx - 1 + N) % N];

  // Project along tangent to interpolate exact Y elevation cleanly
  const rx = x - p.x;
  const rz = z - p.z;
  const along = rx * p.tx + rz * p.tz;
  let interpY = p.y;
  if (along > 0) {
    const segLen = Math.hypot(next.x - p.x, next.z - p.z) || 1;
    const t = clamp(along / segLen, 0, 1);
    interpY = p.y + (next.y - p.y) * t;
  } else {
    const segLen = Math.hypot(p.x - prev.x, p.z - prev.z) || 1;
    const t = clamp(-along / segLen, 0, 1);
    interpY = p.y + (prev.y - p.y) * t;
  }

  // Signed lateral offset (+ = left of center, - = right of center)
  const signedLeft = rx * p.lx + rz * p.lz;

  return {
    idx: bestIdx,
    point: p,
    y: interpY,
    slope: p.slope,
    signedLeft,
    absDist: Math.abs(signedLeft)
  };
}
