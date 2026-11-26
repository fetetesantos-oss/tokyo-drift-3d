// Realistic Sculpted 3D Vehicle Lofting Engine (7 Distinct Silhouettes: Compact -> Hypercar) + Tokyo Night World & Sky Dome Meshes

import { hexToRgb01 } from './math.js';

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  // Material encoding in vertex alpha (aCol.a):
  //   0.00 = standard matte / road / concrete
  //   0.18 = gloss metallic car paint (clearcoat + city Fresnel reflections)
  //   0.35 = dark glossy automotive glass (mirror-like Fresnel reflections)
  //   0.52 = dark ground shadow / matte rubber tire
  //   0.70..1.00 = emissive neon / headlights / taillights / DRLs
  addQuad(p0, p1, p2, p3, color, uv0 = [0, 0], uv1 = [1, 0], uv2 = [1, 1], uv3 = [0, 1], mat = 0) {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    const base = this.pos.length / 3;
    const pts = [p0, p1, p2, p3];
    const uvs = [uv0, uv1, uv2, uv3];
    const r = color[0], g = color[1], b = color[2];

    for (let i = 0; i < 4; i++) {
      this.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      this.norm.push(nx, ny, nz);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(r, g, b, mat);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // Smooth-normal quad (explicit vertex normals for curved metallic car panels!)
  addSmoothQuad(p0, p1, p2, p3, n0, n1, n2, n3, color, mat = 0.18) {
    const base = this.pos.length / 3;
    const pts = [p0, p1, p2, p3];
    const norms = [n0, n1, n2, n3];
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let i = 0; i < 4; i++) {
      const nl = Math.hypot(norms[i][0], norms[i][1], norms[i][2]) || 1;
      this.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      this.norm.push(norms[i][0] / nl, norms[i][1] / nl, norms[i][2] / nl);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color[0], color[1], color[2], mat);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addBox(cx, cy, cz, sx, sy, sz, color, mat = 0, uvScale = [1, 1]) {
    const hx = sx * 0.5, hy = sy * 0.5, hz = sz * 0.5;
    const x0 = cx - hx, x1 = cx + hx;
    const y0 = cy - hy, y1 = cy + hy;
    const z0 = cz - hz, z1 = cz + hz;
    const u = uvScale[0], v = uvScale[1];

    this.addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, [0, 0], [u, 0], [u, v], [0, v], mat);
    this.addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color, [0, 0], [u, 0], [u, v], [0, v], mat);
    this.addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, [0, 0], [u, 0], [u, v], [0, v], mat);
    this.addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, [0, 0], [u, 0], [u, v], [0, v], mat);
    this.addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color, [0, 0], [1, 0], [1, 1], [0, 1], mat);
    this.addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, [0, 0], [1, 0], [1, 1], [0, 1], mat);
  }

  addTaperedBox(cx, y0, y1, cz, botW, botL, topW, topL, topZShift, color, mat = 0) {
    const bw = botW * 0.5, bl = botL * 0.5;
    const tw = topW * 0.5, tl = topL * 0.5;
    const tz = cz + topZShift;

    const b0 = [cx - bw, y0, cz + bl], b1 = [cx + bw, y0, cz + bl];
    const b2 = [cx + bw, y0, cz - bl], b3 = [cx - bw, y0, cz - bl];
    const t0 = [cx - tw, y1, tz + tl], t1 = [cx + tw, y1, tz + tl];
    const t2 = [cx + tw, y1, tz - tl], t3 = [cx - tw, y1, tz - tl];

    this.addQuad(b0, b1, t1, t0, color, [0,0],[1,0],[1,1],[0,1], mat);
    this.addQuad(b2, b3, t3, t2, color, [0,0],[1,0],[1,1],[0,1], mat);
    this.addQuad(b1, b2, t2, t1, color, [0,0],[1,0],[1,1],[0,1], mat);
    this.addQuad(b3, b0, t0, t3, color, [0,0],[1,0],[1,1],[0,1], mat);
    this.addQuad(t0, t1, t2, t3, color, [0,0],[1,0],[1,1],[0,1], mat);
  }

  // Loft a smooth symmetrical 3D hull across longitudinal stations!
  // Each station: { z, yBot, yMid, yTop, wBot, wMid, wTop, topMat, sideMat, topCol, sideCol }
  addSculptedHull(stations, defaultCol, bodyMat = 0.18) {
    for (let i = 0; i < stations.length - 1; i++) {
      const s0 = stations[i];
      const s1 = stations[i + 1];
      const colTop = s0.topCol || defaultCol;
      const colSide = s0.sideCol || defaultCol;
      const matTop = s0.topMat !== undefined ? s0.topMat : bodyMat;
      const matSide = s0.sideMat !== undefined ? s0.sideMat : bodyMat;

      // Top Deck / Hood / Windshield / Roof
      const t0L = [ s0.wTop, s0.yTop, s0.z], t0R = [-s0.wTop, s0.yTop, s0.z];
      const t1L = [ s1.wTop, s1.yTop, s1.z], t1R = [-s1.wTop, s1.yTop, s1.z];
      const dz = s1.z - s0.z;
      const dy = s1.yTop - s0.yTop;
      const slopeN = [0, Math.abs(dz) + 0.15, -dy * Math.sign(dz || 1)];
      this.addSmoothQuad(t0R, t0L, t1L, t1R,
        [-0.18, slopeN[1], slopeN[2]], [0.18, slopeN[1], slopeN[2]],
        [0.18, slopeN[1], slopeN[2]], [-0.18, slopeN[1], slopeN[2]],
        colTop, matTop
      );

      // Upper Shoulder / Side Glass (from yMid to yTop)
      const m0L = [ s0.wMid, s0.yMid, s0.z], m0R = [-s0.wMid, s0.yMid, s0.z];
      const m1L = [ s1.wMid, s1.yMid, s1.z], m1R = [-s1.wMid, s1.yMid, s1.z];
      const upperSideMat = s0.upperSideMat !== undefined ? s0.upperSideMat : matSide;
      const upperSideCol = s0.upperSideCol || colSide;
      // Left (+X)
      this.addSmoothQuad(m0L, m1L, t1L, t0L,
        [0.92, 0.38, 0], [0.92, 0.38, 0], [0.55, 0.82, 0], [0.55, 0.82, 0],
        upperSideCol, upperSideMat
      );
      // Right (-X)
      this.addSmoothQuad(m1R, m0R, t0R, t1R,
        [-0.92, 0.38, 0], [-0.92, 0.38, 0], [-0.55, 0.82, 0], [-0.55, 0.82, 0],
        upperSideCol, upperSideMat
      );

      // Lower Door / Fender Skirt (from yBot to yMid)
      const b0L = [ s0.wBot, s0.yBot, s0.z], b0R = [-s0.wBot, s0.yBot, s0.z];
      const b1L = [ s1.wBot, s1.yBot, s1.z], b1R = [-s1.wBot, s1.yBot, s1.z];
      // Left (+X)
      this.addSmoothQuad(b0L, b1L, m1L, m0L,
        [0.98, -0.15, 0], [0.98, -0.15, 0], [0.92, 0.35, 0], [0.92, 0.35, 0],
        colSide, matSide
      );
      // Right (-X)
      this.addSmoothQuad(b1R, b0R, m0R, m1R,
        [-0.98, -0.15, 0], [-0.98, -0.15, 0], [-0.92, 0.35, 0], [-0.92, 0.35, 0],
        colSide, matSide
      );
    }

    // Front Nose Cap (first station)
    const sf = stations[0];
    this.addQuad(
      [-sf.wBot, sf.yBot, sf.z], [sf.wBot, sf.yBot, sf.z],
      [sf.wMid, sf.yMid, sf.z], [-sf.wMid, sf.yMid, sf.z],
      sf.frontCol || defaultCol, [0,0],[1,0],[1,1],[0,1], bodyMat
    );
    this.addQuad(
      [-sf.wMid, sf.yMid, sf.z], [sf.wMid, sf.yMid, sf.z],
      [sf.wTop, sf.yTop, sf.z], [-sf.wTop, sf.yTop, sf.z],
      sf.frontCol || defaultCol, [0,0],[1,0],[1,1],[0,1], bodyMat
    );

    // Rear Tail Cap (last station)
    const sr = stations[stations.length - 1];
    this.addQuad(
      [sr.wBot, sr.yBot, sr.z], [-sr.wBot, sr.yBot, sr.z],
      [-sr.wMid, sr.yMid, sr.z], [sr.wMid, sr.yMid, sr.z],
      sr.rearCol || defaultCol, [0,0],[1,0],[1,1],[0,1], bodyMat
    );
    this.addQuad(
      [sr.wMid, sr.yMid, sr.z], [-sr.wMid, sr.yMid, sr.z],
      [-sr.wTop, sr.yTop, sr.z], [sr.wTop, sr.yTop, sr.z],
      sr.rearCol || defaultCol, [0,0],[1,0],[1,1],[0,1], bodyMat
    );
  }

  // Detailed 16-segment Deep-Dish Wheel + Slotted Brake Rotor + Colored Caliper + Stance Camber!
  addRealisticWheel(cx, cy, cz, radius, width, rimCol, accentCol, caliperCol, camber = 0.05) {
    const segs = 16;
    const hx = width * 0.5;
    const sideSign = cx >= 0 ? 1 : -1;
    const tireCol = [0.07, 0.075, 0.085];
    const sidewallCol = [0.10, 0.105, 0.12];
    const rotorCol = [0.62, 0.66, 0.72];

    const tiltX = (localX, localY) => cx + localX - sideSign * localY * camber;

    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // Tire Tread Outer Ring
      const p0 = [tiltX(-hx, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const p1 = [tiltX( hx, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const p2 = [tiltX( hx, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      const p3 = [tiltX(-hx, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      this.addQuad(p0, p1, p2, p3, tireCol, [0,0],[1,0],[1,1],[0,1], 0.52);

      // Tire Sidewall -> Rim Lip (outer facing side)
      const rRim = radius * 0.72;
      const rHub = radius * 0.24;
      const ox = sideSign * (hx + 0.005);
      const dishX = sideSign * (hx - 0.055);

      const t0 = [tiltX(ox, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const t1 = [tiltX(ox, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      const m0 = [tiltX(ox, s0 * rRim), cy + s0 * rRim, cz + c0 * rRim];
      const m1 = [tiltX(ox, s1 * rRim), cy + s1 * rRim, cz + c1 * rRim];
      if (sideSign > 0) this.addQuad(t0, t1, m1, m0, sidewallCol, [0,0],[1,0],[1,1],[0,1], 0.52);
      else this.addQuad(t1, t0, m0, m1, sidewallCol, [0,0],[1,0],[1,1],[0,1], 0.52);

      // Deep-Dish Metallic Barrel Rim Lip
      const d0 = [tiltX(dishX, s0 * rRim * 0.94), cy + s0 * rRim * 0.94, cz + c0 * rRim * 0.94];
      const d1 = [tiltX(dishX, s1 * rRim * 0.94), cy + s1 * rRim * 0.94, cz + c1 * rRim * 0.94];
      const lipMat = accentCol[2] > 0.82 && accentCol[0] < 0.3 ? 0.92 : 0.18;
      if (sideSign > 0) this.addQuad(m0, m1, d1, d0, accentCol, [0,0],[1,0],[1,1],[0,1], lipMat);
      else this.addQuad(m1, m0, d0, d1, accentCol, [0,0],[1,0],[1,1],[0,1], lipMat);

      // Spokes + Recessed Brake Disc behind gaps
      const isSpoke = (i % 3 === 0);
      const h0 = [tiltX(ox - sideSign * 0.02, s0 * rHub), cy + s0 * rHub, cz + c0 * rHub];
      const h1 = [tiltX(ox - sideSign * 0.02, s1 * rHub), cy + s1 * rHub, cz + c1 * rHub];
      const faceCol = isSpoke ? rimCol : (i === 2 || i === 3 ? caliperCol : rotorCol);
      const faceMat = isSpoke ? 0.18 : (i === 2 || i === 3 ? 0.32 : 0.12);
      if (sideSign > 0) this.addQuad(h0, d0, d1, h1, faceCol, [0,0],[1,0],[1,1],[0,1], faceMat);
      else this.addQuad(h1, d1, d0, h0, faceCol, [0,0],[1,0],[1,1],[0,1], faceMat);
    }
  }

  build(gl) {
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.pos), gl.STATIC_DRAW);

    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.norm), gl.STATIC_DRAW);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.uv), gl.STATIC_DRAW);

    const colBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.col), gl.STATIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    const useUint32 = (this.pos.length / 3) > 65535;
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      useUint32 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
      gl.STATIC_DRAW
    );

    return {
      posBuf, normBuf, uvBuf, colBuf, idxBuf,
      count: this.idx.length,
      idxType: useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT
    };
  }
}

// =========================================================================
// SCULPTED 3D REALISTIC VEHICLE BUILDER (ALL 7 TIERS: SIMPLES -> HIPERCARRO)
// =========================================================================
export function buildJDMCarMesh(gl, {
  style = 'coupe',
  bodyHex = '#f94d1c',
  underglowHex = '#ff2a85',
  rimHex = '#b45309',
  rimAccentHex = '#fde68a',
  caliperHex = '#ef4444',
  wing = 'gt',
  bodykit = 'street',
  rideOffset = -0.04,
  camber = 0.05,
  isTraffic = false
}) {
  const mb = new MeshBuilder();
  const body = hexToRgb01(bodyHex);
  const darkTrim = [0.06, 0.07, 0.095];
  const carbon = [0.10, 0.115, 0.145];
  const glass = [0.05, 0.09, 0.15];
  const chrome = [0.78, 0.84, 0.92];
  const headCol = [0.95, 0.98, 1.0];
  const drlCyan = [0.85, 0.95, 1.0];
  const tailCol = [1.0, 0.08, 0.22];
  const glow = hexToRgb01(underglowHex);
  const rim = hexToRgb01(rimHex);
  const rimAcc = hexToRgb01(rimAccentHex);
  const caliper = hexToRgb01(caliperHex);

  const y0 = 0.26 + rideOffset;
  const wideBoost = (bodykit === 'wide' && !isTraffic) ? 0.09 : 0.0;

  // Define distinct realistic automotive silhouettes per tier!
  const profiles = {
    compact: { // Tier 1: Humble Japanese 90s compact hatch (tall greenhouse, short hood, honest proportions)
      L: 4.02, W: 0.88 + wideBoost, wheelR: 0.32, fz: 1.24, rz: -1.24,
      stations: [
        { z:  2.01, yBot: y0+0.04, yMid: y0+0.34, yTop: y0+0.48, wBot: 0.76, wMid: 0.82, wTop: 0.74 },
        { z:  1.65, yBot: y0+0.02, yMid: y0+0.52, yTop: y0+0.58, wBot: 0.86, wMid: 0.88, wTop: 0.78 },
        { z:  0.88, yBot: y0+0.02, yMid: y0+0.58, yTop: y0+0.64, wBot: 0.86, wMid: 0.88, wTop: 0.80, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.32, yBot: y0+0.02, yMid: y0+0.62, yTop: y0+1.16, wBot: 0.86, wMid: 0.88, wTop: 0.68, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.18, yBot: y0+0.02, yMid: y0+0.64, yTop: y0+1.14, wBot: 0.86, wMid: 0.88, wTop: 0.66, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.84, yBot: y0+0.04, yMid: y0+0.62, yTop: y0+0.72, wBot: 0.84, wMid: 0.86, wTop: 0.76 },
        { z: -2.01, yBot: y0+0.08, yMid: y0+0.44, yTop: y0+0.62, wBot: 0.76, wMid: 0.82, wTop: 0.74 }
      ]
    },
    hatch: { // Tier 2: Classic 80s Touge Liftback (sleek wedge nose, fastback rear)
      L: 4.24, W: 0.90 + wideBoost, wheelR: 0.33, fz: 1.32, rz: -1.28,
      stations: [
        { z:  2.12, yBot: y0+0.02, yMid: y0+0.30, yTop: y0+0.42, wBot: 0.78, wMid: 0.85, wTop: 0.76 },
        { z:  1.60, yBot: y0,      yMid: y0+0.48, yTop: y0+0.54, wBot: 0.88, wMid: 0.90, wTop: 0.82 },
        { z:  0.72, yBot: y0,      yMid: y0+0.56, yTop: y0+0.60, wBot: 0.88, wMid: 0.90, wTop: 0.82, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.10, yBot: y0,      yMid: y0+0.58, yTop: y0+1.06, wBot: 0.88, wMid: 0.90, wTop: 0.68, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.92, yBot: y0,      yMid: y0+0.60, yTop: y0+1.04, wBot: 0.88, wMid: 0.91, wTop: 0.66, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.85, yBot: y0+0.02, yMid: y0+0.58, yTop: y0+0.66, wBot: 0.86, wMid: 0.89, wTop: 0.80 },
        { z: -2.12, yBot: y0+0.06, yMid: y0+0.42, yTop: y0+0.60, wBot: 0.78, wMid: 0.84, wTop: 0.76 }
      ]
    },
    coupe: { // Tier 3: Sleek Rotary Sports Coupe (curvy low hood, tapered cabin, wide haunches)
      L: 4.42, W: 0.96 + wideBoost, wheelR: 0.34, fz: 1.38, rz: -1.34,
      stations: [
        { z:  2.21, yBot: y0,      yMid: y0+0.26, yTop: y0+0.38, wBot: 0.80, wMid: 0.88, wTop: 0.76 },
        { z:  1.62, yBot: y0-0.02, yMid: y0+0.46, yTop: y0+0.52, wBot: 0.94, wMid: 0.97, wTop: 0.84 },
        { z:  0.66, yBot: y0-0.02, yMid: y0+0.54, yTop: y0+0.58, wBot: 0.92, wMid: 0.95, wTop: 0.82, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.02, yBot: y0-0.02, yMid: y0+0.56, yTop: y0+0.99, wBot: 0.92, wMid: 0.96, wTop: 0.66, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.82, yBot: y0-0.02, yMid: y0+0.58, yTop: y0+0.96, wBot: 0.95, wMid: 0.99, wTop: 0.64, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.78, yBot: y0,      yMid: y0+0.58, yTop: y0+0.65, wBot: 0.94, wMid: 0.97, wTop: 0.84 },
        { z: -2.21, yBot: y0+0.05, yMid: y0+0.44, yTop: y0+0.60, wBot: 0.82, wMid: 0.89, wTop: 0.78 }
      ]
    },
    sedan: { // Tier 4: Executive 4-Door Drift Sedan (long wheelbase, distinct notchback trunk)
      L: 4.72, W: 0.98 + wideBoost, wheelR: 0.35, fz: 1.50, rz: -1.46,
      stations: [
        { z:  2.36, yBot: y0+0.02, yMid: y0+0.34, yTop: y0+0.48, wBot: 0.84, wMid: 0.92, wTop: 0.82 },
        { z:  1.72, yBot: y0,      yMid: y0+0.52, yTop: y0+0.58, wBot: 0.96, wMid: 0.98, wTop: 0.88 },
        { z:  0.86, yBot: y0,      yMid: y0+0.58, yTop: y0+0.62, wBot: 0.96, wMid: 0.98, wTop: 0.88, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.22, yBot: y0,      yMid: y0+0.60, yTop: y0+1.10, wBot: 0.96, wMid: 0.98, wTop: 0.74, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.96, yBot: y0,      yMid: y0+0.62, yTop: y0+1.08, wBot: 0.96, wMid: 0.99, wTop: 0.72, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.52, yBot: y0,      yMid: y0+0.62, yTop: y0+0.70, wBot: 0.96, wMid: 0.98, wTop: 0.88 },
        { z: -2.20, yBot: y0+0.02, yMid: y0+0.60, yTop: y0+0.68, wBot: 0.92, wMid: 0.95, wTop: 0.85 },
        { z: -2.36, yBot: y0+0.06, yMid: y0+0.45, yTop: y0+0.64, wBot: 0.84, wMid: 0.90, wTop: 0.80 }
      ]
    },
    gtr: { // Tier 5: Wangan Legend GT-34 (bold boxy-muscular fenders, aggressive nose, tall rear trunk)
      L: 4.58, W: 0.99 + wideBoost, wheelR: 0.35, fz: 1.44, rz: -1.38,
      stations: [
        { z:  2.29, yBot: y0-0.02, yMid: y0+0.34, yTop: y0+0.48, wBot: 0.88, wMid: 0.94, wTop: 0.84 },
        { z:  1.65, yBot: y0-0.02, yMid: y0+0.52, yTop: y0+0.58, wBot: 0.98, wMid: 1.01, wTop: 0.88 },
        { z:  0.74, yBot: y0-0.02, yMid: y0+0.58, yTop: y0+0.62, wBot: 0.96, wMid: 0.99, wTop: 0.86, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.10, yBot: y0-0.02, yMid: y0+0.60, yTop: y0+1.06, wBot: 0.96, wMid: 0.99, wTop: 0.72, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.94, yBot: y0-0.02, yMid: y0+0.62, yTop: y0+1.04, wBot: 0.98, wMid: 1.02, wTop: 0.70, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -1.58, yBot: y0-0.02, yMid: y0+0.62, yTop: y0+0.70, wBot: 0.98, wMid: 1.01, wTop: 0.88 },
        { z: -2.29, yBot: y0+0.04, yMid: y0+0.48, yTop: y0+0.68, wBot: 0.90, wMid: 0.96, wTop: 0.86 }
      ]
    },
    supercar: { // Tier 6: Mid-Engine Japanese Supercar (cab-forward teardrop, ultra-low wedge, wide rear)
      L: 4.54, W: 1.03 + wideBoost, wheelR: 0.35, fz: 1.42, rz: -1.36,
      stations: [
        { z:  2.27, yBot: y0-0.04, yMid: y0+0.20, yTop: y0+0.30, wBot: 0.82, wMid: 0.92, wTop: 0.76 },
        { z:  1.60, yBot: y0-0.04, yMid: y0+0.42, yTop: y0+0.48, wBot: 0.98, wMid: 1.03, wTop: 0.84 },
        { z:  0.88, yBot: y0-0.04, yMid: y0+0.48, yTop: y0+0.54, wBot: 0.96, wMid: 1.00, wTop: 0.80, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.04, yBot: y0-0.04, yMid: y0+0.52, yTop: y0+0.92, wBot: 0.98, wMid: 1.02, wTop: 0.64, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.70, yBot: y0-0.04, yMid: y0+0.56, yTop: y0+0.90, wBot: 1.02, wMid: 1.06, wTop: 0.62, topCol: glass, topMat: 0.35, upperSideCol: carbon, upperSideMat: 0.18 },
        { z: -1.74, yBot: y0-0.02, yMid: y0+0.58, yTop: y0+0.64, wBot: 1.02, wMid: 1.06, wTop: 0.90 },
        { z: -2.27, yBot: y0+0.04, yMid: y0+0.44, yTop: y0+0.60, wBot: 0.92, wMid: 1.00, wTop: 0.86 }
      ]
    },
    hypercar: { // Tier 7: Top Apex V12 Hypercar (razor LMP nose, fighter bubble canopy, extreme rear haunches)
      L: 4.74, W: 1.08 + wideBoost, wheelR: 0.36, fz: 1.52, rz: -1.44,
      stations: [
        { z:  2.37, yBot: y0-0.06, yMid: y0+0.15, yTop: y0+0.24, wBot: 0.78, wMid: 0.90, wTop: 0.66 },
        { z:  1.72, yBot: y0-0.06, yMid: y0+0.38, yTop: y0+0.44, wBot: 1.02, wMid: 1.08, wTop: 0.82 },
        { z:  0.96, yBot: y0-0.06, yMid: y0+0.44, yTop: y0+0.48, wBot: 0.96, wMid: 1.02, wTop: 0.76, topCol: glass, topMat: 0.35, upperSideCol: glass, upperSideMat: 0.35 },
        { z:  0.14, yBot: y0-0.06, yMid: y0+0.48, yTop: y0+0.86, wBot: 0.98, wMid: 1.04, wTop: 0.56, upperSideCol: glass, upperSideMat: 0.35 },
        { z: -0.68, yBot: y0-0.06, yMid: y0+0.52, yTop: y0+0.84, wBot: 1.06, wMid: 1.12, wTop: 0.54, topCol: carbon, topMat: 0.18, upperSideCol: carbon, upperSideMat: 0.18 },
        { z: -1.86, yBot: y0-0.04, yMid: y0+0.56, yTop: y0+0.62, wBot: 1.06, wMid: 1.11, wTop: 0.94 },
        { z: -2.37, yBot: y0+0.02, yMid: y0+0.40, yTop: y0+0.58, wBot: 0.94, wMid: 1.04, wTop: 0.90 }
      ]
    }
  };

  const prof = profiles[style] || profiles.coupe;
  const L = prof.L;
  const halfW = prof.W;
  const fullW = halfW * 2;
  const sts = prof.stations.map(s => ({
    ...s,
    wBot: s.wBot + wideBoost,
    wMid: s.wMid + wideBoost
  }));

  // 1. Main Sculpted Smooth-Shaded Automotive Body Hull
  mb.addSculptedHull(sts, body, isTraffic ? 0.08 : 0.18);

  // Two-tone Panda lower trim for Hachi-Roku S86 when white
  if (style === 'hatch' && bodyHex.toLowerCase() === '#f1f5f9') {
    mb.addBox(0, y0 + 0.14, 0, fullW + 0.02, 0.22, L * 0.96, darkTrim, 0.08);
  }

  // 2. Carbon / Matte Aerodynamic Lower Splitter, Side Skirts & Rear Multi-Fin Diffuser
  const frontZ = sts[0].z;
  const rearZ = sts[sts.length - 1].z;
  if (!isTraffic && (bodykit !== 'stock' || style === 'supercar' || style === 'hypercar')) {
    const lipExtra = bodykit === 'wide' ? 0.12 : 0.05;
    mb.addBox(0, y0 - 0.03, frontZ + 0.04, fullW + lipExtra, 0.06, 0.34, carbon, 0.14);
    mb.addBox(0, y0 - 0.02, 0, fullW + lipExtra, 0.07, L * 0.68, carbon, 0.14);
  }
  // Rear Diffuser + Vertical Aero Fins
  mb.addBox(0, y0 + 0.08, rearZ - 0.02, fullW * 0.84, 0.22, 0.16, darkTrim, 0.05);
  if (!isTraffic && style !== 'compact') {
    [-0.45, -0.18, 0.18, 0.45].forEach(ox => {
      mb.addBox(ox * halfW, y0 + 0.08, rearZ - 0.06, 0.04, 0.20, 0.18, carbon, 0.12);
    });
  }

  // 3. Sculpted Widebody Overfenders / Supercar Side Air Intakes / Hypercar Dorsal Fin
  if (style === 'supercar' || style === 'hypercar') {
    // Deep carbon side air intakes ahead of rear wheels
    [-1, 1].forEach(s => {
      mb.addBox(s * (halfW + 0.01), y0 + 0.30, -0.45, 0.12, 0.34, 0.85, darkTrim, 0.05);
      mb.addBox(s * (halfW + 0.05), y0 + 0.32, -0.52, 0.04, 0.30, 0.72, body, 0.18);
    });
  }
  if (style === 'hypercar') {
    // LMP Dorsal Roof Shark Fin
    mb.addBox(0, y0 + 0.78, -1.12, 0.05, 0.32, 1.15, carbon, 0.18);
  }
  if (bodykit === 'wide' && !isTraffic) {
    [-1, 1].forEach(s => {
      mb.addBox(s * (halfW + 0.02), y0 + 0.22, prof.fz, 0.12, 0.30, 0.88, body, 0.18);
      mb.addBox(s * (halfW + 0.03), y0 + 0.24, prof.rz, 0.14, 0.34, 0.96, body, 0.18);
    });
  }

  // 4. Sculpted Side Wing Mirrors (realistic automotive touch!)
  const mirrorZ = sts[2].z - 0.15;
  const mirrorY = sts[2].yTop + 0.12;
  [-1, 1].forEach(s => {
    mb.addBox(s * (halfW + 0.06), mirrorY, mirrorZ, 0.18, 0.09, 0.14, body, 0.18);
    mb.addBox(s * (halfW - 0.02), mirrorY - 0.05, mirrorZ, 0.08, 0.08, 0.06, darkTrim, 0.05);
  });

  // 5. Front Intercooler Grille + Realistic Projector Headlights & LED DRLs
  const hlY = sts[0].yMid + 0.06;
  mb.addBox(0, y0 + 0.15, frontZ + 0.015, fullW * 0.48, 0.20, 0.05, [0.16, 0.19, 0.24], 0.08);
  if (!isTraffic && style !== 'compact') {
    // Exposed metallic FMIC intercooler fins
    mb.addBox(0, y0 + 0.14, frontZ + 0.03, fullW * 0.38, 0.15, 0.03, chrome, 0.18);
  }

  // Headlight housings + intense xenon projectors + crisp LED DRL strip
  [-1, 1].forEach(s => {
    const hx = s * halfW * 0.64;
    mb.addBox(hx, hlY, frontZ + 0.01, 0.44, 0.15, 0.06, darkTrim, 0.35);
    mb.addBox(hx, hlY, frontZ + 0.03, 0.34, 0.08, 0.04, headCol, 1.0);
    if (style === 'supercar' || style === 'hypercar' || style === 'coupe') {
      mb.addBox(hx + s * 0.04, hlY - 0.05, frontZ + 0.035, 0.40, 0.03, 0.04, drlCyan, 1.0);
    }
  });

  // 6. Signature Taillights & Illuminated Japanese License Plate
  const tlY = sts[sts.length - 1].yMid + 0.08;
  if (style === 'gtr') {
    // Iconic Twin-Ring Round Crimson LEDs
    [-0.72, -0.44, 0.44, 0.72].forEach(ox => {
      mb.addBox(ox * halfW, tlY, rearZ - 0.02, 0.17, 0.17, 0.06, tailCol, 1.0);
    });
  } else if (style === 'supercar' || style === 'hypercar') {
    // Full-Width Cyber Crimson Light Bar
    mb.addBox(0, tlY + 0.02, rearZ - 0.02, fullW * 0.84, 0.08, 0.06, tailCol, 1.0);
    mb.addBox(0, tlY + 0.02, rearZ - 0.03, fullW * 0.42, 0.03, 0.05, [1.0, 0.55, 0.2], 1.0);
  } else {
    mb.addBox( halfW * 0.62, tlY, rearZ - 0.02, 0.48, 0.14, 0.06, tailCol, 1.0);
    mb.addBox(-halfW * 0.62, tlY, rearZ - 0.02, 0.48, 0.14, 0.06, tailCol, 1.0);
  }
  // Japanese Rear License Plate (subtle warm white illumination)
  mb.addBox(0, y0 + 0.30, rearZ - 0.02, 0.36, 0.16, 0.03, [0.92, 0.95, 0.90], 0.72);

  // 7. Exhaust System (Single simple pipe on Tier 1 -> Twin/Quad Titanium on Top Tiers!)
  if (style === 'compact') {
    mb.addBox(-halfW * 0.55, y0 + 0.06, rearZ - 0.08, 0.10, 0.10, 0.18, chrome, 0.18);
  } else if (style === 'hypercar') {
    [-0.18, -0.06, 0.06, 0.18].forEach(ox => {
      mb.addBox(ox, y0 + 0.36, rearZ - 0.07, 0.09, 0.09, 0.18, [0.55, 0.72, 0.96], 0.35);
    });
  } else {
    [-0.52, 0.52].forEach(ox => {
      mb.addBox(ox * halfW, y0 + 0.06, rearZ - 0.09, 0.14, 0.12, 0.22, [0.58, 0.70, 0.92], 0.3);
    });
  }

  // 8. Rear Aerodynamic Wing / Spoiler Options
  if (!isTraffic && wing !== 'none') {
    const wy = sts[sts.length - 2].yTop;
    const wz = rearZ + 0.22;
    if (wing === 'lip') {
      mb.addBox(0, wy + 0.05, wz - 0.06, fullW * 0.86, 0.11, 0.18, body, 0.18);
    } else if (wing === 'gt' || wing === 'big') {
      const wH = wing === 'big' ? 0.46 : 0.30;
      const wW = wing === 'big' ? fullW * 1.06 : fullW * 0.94;
      mb.addBox( halfW * 0.46, wy + wH * 0.5, wz, 0.05, wH, 0.20, carbon, 0.16);
      mb.addBox(-halfW * 0.46, wy + wH * 0.5, wz, 0.05, wH, 0.20, carbon, 0.16);
      mb.addBox(0, wy + wH, wz - 0.05, wW, 0.055, 0.32, carbon, 0.18);
      mb.addBox( wW * 0.5, wy + wH, wz - 0.05, 0.045, 0.25, 0.38, body, 0.18);
      mb.addBox(-wW * 0.5, wy + wH, wz - 0.05, 0.045, 0.25, 0.38, body, 0.18);
    }
  }

  // 9. Grounded Soft Contact Shadow + Optional Neon Underglow Strip
  mb.addQuad(
    [-halfW * 1.06, 0.035, rearZ - 0.1],
    [ halfW * 1.06, 0.035, rearZ - 0.1],
    [ halfW * 1.06, 0.035, frontZ + 0.1],
    [-halfW * 1.06, 0.035, frontZ + 0.1],
    [0.01, 0.01, 0.02], [0,0],[1,0],[1,1],[0,1], 0.52
  );
  if (!isTraffic && style !== 'compact') {
    mb.addQuad(
      [-halfW * 0.86, 0.06, rearZ + 0.25],
      [ halfW * 0.86, 0.06, rearZ + 0.25],
      [ halfW * 0.86, 0.06, frontZ - 0.25],
      [-halfW * 0.86, 0.06, frontZ - 0.25],
      glow, [0,0],[1,0],[1,1],[0,1], 0.94
    );
  }

  // 10. Four Realistic 3D Deep-Dish Wheels with Brake Rotors, Calipers & Camber
  const wx = halfW - 0.06;
  const wr = prof.wheelR;
  mb.addRealisticWheel( wx, wr, prof.fz, wr, 0.27, rim, rimAcc, caliper, camber);
  mb.addRealisticWheel(-wx, wr, prof.fz, wr, 0.27, rim, rimAcc, caliper, camber);
  mb.addRealisticWheel( wx, wr, prof.rz, wr, 0.31, rim, rimAcc, caliper, camber * 1.15);
  mb.addRealisticWheel(-wx, wr, prof.rz, wr, 0.31, rim, rimAcc, caliper, camber * 1.15);

  return mb.build(gl);
}

// =========================================================================
// TOKYO NIGHT SKY DOME & DISTANT TOKYO TOWER LANDMARK
// =========================================================================
export function buildSkyDomeMesh(gl) {
  const mb = new MeshBuilder();
  const R = 360;
  const segs = 28;
  // Photorealistic overcast rainy Tokyo midnight sky (deep blue-slate clouds + soft urban horizon glow)
  const rings = [
    { y: -20, r: R,       col: [0.035, 0.045, 0.068] },
    { y:  22, r: R,       col: [0.075, 0.095, 0.135] },
    { y:  88, r: R * 0.88, col: [0.025, 0.035, 0.058] },
    { y: 185, r: R * 0.45, col: [0.015, 0.022, 0.038] },
    { y: 240, r: 2,       col: [0.010, 0.015, 0.028] }
  ];

  for (let ri = 0; ri < rings.length - 1; ri++) {
    const a = rings[ri], b = rings[ri + 1];
    for (let s = 0; s < segs; s++) {
      const t0 = (s / segs) * Math.PI * 2;
      const t1 = ((s + 1) / segs) * Math.PI * 2;
      const p0 = [Math.cos(t0) * a.r, a.y, Math.sin(t0) * a.r];
      const p1 = [Math.cos(t1) * a.r, a.y, Math.sin(t1) * a.r];
      const p2 = [Math.cos(t1) * b.r, b.y, Math.sin(t1) * b.r];
      const p3 = [Math.cos(t0) * b.r, b.y, Math.sin(t0) * b.r];
      mb.addQuad(p0, p1, p2, p3, a.col, [0,0],[1,0],[1,1],[0,1], 0.85);
    }
  }

  // Iconic Illuminated Red-Orange Tokyo Tower Landmark on the Horizon
  const tx = 140, tz = 310;
  mb.addTaperedBox(tx, -5, 72, tz, 24, 24, 9, 9, 0, [0.95, 0.30, 0.16], 0.90);
  mb.addBox(tx, 76, tz, 13, 6, 13, [1.0, 0.94, 0.84], 1.0);
  mb.addTaperedBox(tx, 79, 148, tz, 8, 8, 1.5, 1.5, 0, [0.95, 0.34, 0.18], 0.92);
  mb.addBox(tx, 158, tz, 1.4, 22, 1.4, [1.0, 0.86, 0.78], 1.0);

  return mb.build(gl);
}

// =========================================================================
// WORLD MESHES (Photorealistic Shibuya Crosswalks, Steel Guardrails, Traffic Signals, Tunnels & Bridges)
// =========================================================================
export function buildWorldMeshes(gl, world) {
  const pts = world.points;
  const N = world.N;
  const w = world.cfg.roadHalfWidth;
  const acc1 = hexToRgb01(world.cfg.accent1);
  const acc2 = hexToRgb01(world.cfg.accent2);

  // 1. ROAD SURFACE MESH
  const roadMB = new MeshBuilder();
  let vCoord = 0;
  for (let i = 0; i < N; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % N];
    const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
    const vNext = vCoord + segLen * 0.085;

    const l0 = [p0.x + p0.lx * w, p0.y, p0.z + p0.lz * w];
    const r0 = [p0.x - p0.lx * w, p0.y, p0.z - p0.lz * w];
    const r1 = [p1.x - p1.lx * w, p1.y, p1.z - p1.lz * w];
    const l1 = [p1.x + p1.lx * w, p1.y, p1.z + p1.lz * w];

    const col = (i === 0 || i === 1) ? [1.18, 1.20, 1.24] : [1, 1, 1];
    roadMB.addQuad(l0, r0, r1, l1, col, [0, vCoord], [1, vCoord], [1, vNext], [0, vNext], (i === 0 ? 0.25 : 0));
    vCoord = vNext;
  }

  // 2. ENVIRONMENT STRUCTURES
  const envMB = new MeshBuilder();
  const steelRail = [0.34, 0.38, 0.44];
  const curbConcrete = [0.22, 0.25, 0.30];
  const curbRed = [0.76, 0.14, 0.18];
  const curbWhite = [0.88, 0.90, 0.94];
  const tunnelWall = [0.14, 0.16, 0.20];
  const tunnelLight = [1.0, 0.88, 0.68]; // Realistic warm sodium tunnel lighting!

  for (let i = 0; i < N; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % N];
    const isSharp = Math.abs(p0.curv) > 0.028;
    const rw = w + 0.9;

    // Realistic Galvanized Steel Guardrails + Subtle Curb Reflectors (no cartoon neon bars!)
    [-1, 1].forEach(side => {
      const x0 = p0.x + p0.lx * side * rw, z0 = p0.z + p0.lz * side * rw;
      const x1 = p1.x + p1.lx * side * rw, z1 = p1.z + p1.lz * side * rw;

      const b0 = [x0, p0.y, z0], b1 = [x1, p1.y, z1];
      const t0 = [x0, p0.y + 0.92, z0], t1 = [x1, p1.y + 0.92, z1];
      if (side > 0) envMB.addQuad(b0, b1, t1, t0, curbConcrete, [0,0],[1,0],[1,1],[0,1], 0.06);
      else envMB.addQuad(b1, b0, t0, t1, curbConcrete, [0,0],[1,0],[1,1],[0,1], 0.06);

      // Metallic top W-beam guardrail + apex red/white curbs on sharp corners
      const n0 = [x0, p0.y + 0.96, z0], n1 = [x1, p1.y + 0.96, z1];
      const n0b = [x0, p0.y + 0.62, z0], n1b = [x1, p1.y + 0.62, z1];
      const beamCol = isSharp ? (i % 2 === 0 ? curbRed : curbWhite) : steelRail;
      const beamMat = isSharp ? 0.35 : 0.16;
      if (side > 0) envMB.addQuad(n0b, n1b, n1, n0, beamCol, [0,0],[1,0],[1,1],[0,1], beamMat);
      else envMB.addQuad(n1b, n0b, n0, n1, beamCol, [0,0],[1,0],[1,1],[0,1], beamMat);

      // Small reflective roadside cat's-eye delineators every 6 segments
      if (i % 6 === 0) {
        envMB.addBox(x0, p0.y + 0.96, z0, 0.24, 0.14, 0.24, side > 0 ? [1.0, 0.78, 0.22] : [0.95, 0.97, 1.0], 0.95);
      }
    });

    // Authentic Shibuya White Zebra Pedestrian Crosswalks at street junctions!
    if (world.cfg.theme === 'shibuya' && !p0.isTunnel && !p0.isBridge && (i === 4 || i % 48 === 0)) {
      const stripeCount = 8;
      for (let s = 0; s < stripeCount; s++) {
        const u = -w + 1.4 + (s / (stripeCount - 1)) * (w * 2 - 2.8);
        const cx = p0.x + p0.lx * u;
        const cz = p0.z + p0.lz * u;
        const fx = p0.tx * 2.2, fz = p0.tz * 2.2;
        const swx = p0.lx * 0.52, swz = p0.lz * 0.52;
        const cy = p0.y + 0.025;
        envMB.addQuad(
          [cx - fx - swx, cy, cz - fz - swz], [cx - fx + swx, cy, cz - fz + swz],
          [cx + fx + swx, cy, cz + fz + swz], [cx + fx - swx, cy, cz + fz - swz],
          [0.86, 0.89, 0.94], [0,0],[1,0],[1,1],[0,1], 0.18
        );
      }
      // Realistic Japanese Traffic Signal Pole with glowing Red/Green light at crossing
      const tx = p0.x + p0.lx * (w + 2.2), tz = p0.z + p0.lz * (w + 2.2);
      envMB.addBox(tx, p0.y + 3.2, tz, 0.28, 6.4, 0.28, [0.22, 0.25, 0.30]);
      envMB.addBox(tx - p0.lx * 2.4, p0.y + 5.8, tz - p0.lz * 2.4, 1.8, 0.55, 0.45, [0.12, 0.14, 0.18]);
      envMB.addBox(tx - p0.lx * 2.0, p0.y + 5.8, tz - p0.lz * 2.0, 0.36, 0.36, 0.50, i % 96 === 0 ? [0.12, 0.92, 0.45] : [1.0, 0.14, 0.18], 1.0);
    }

    // Bridge Concrete Pillars
    if (p0.isBridge && i % 6 === 0 && p0.y > 1.5) {
      envMB.addBox(p0.x, p0.y * 0.5 - 0.5, p0.z, 3.2, p0.y + 1.0, 3.2, [0.18, 0.20, 0.24]);
    }

    // Illuminated Expressway Tunnel Arch + Warm Sodium Ceiling Lamps
    if (p0.isTunnel && p1.isTunnel) {
      const tw = w + 1.2, th = 9.2;
      const l0b = [p0.x + p0.lx * tw, p0.y, p0.z + p0.lz * tw];
      const l1b = [p1.x + p1.lx * tw, p1.y, p1.z + p1.lz * tw];
      const l0t = [p0.x + p0.lx * (tw * 0.86), p0.y + th, p0.z + p0.lz * (tw * 0.86)];
      const l1t = [p1.x + p1.lx * (tw * 0.86), p1.y + th, p1.z + p1.lz * (tw * 0.86)];
      const r0b = [p0.x - p0.lx * tw, p0.y, p0.z - p0.lz * tw];
      const r1b = [p1.x - p1.lx * tw, p1.y, p1.z - p1.lz * tw];
      const r0t = [p0.x - p0.lx * (tw * 0.86), p0.y + th, p0.z - p0.lz * (tw * 0.86)];
      const r1t = [p1.x - p1.lx * (tw * 0.86), p1.y + th, p1.z - p1.lz * (tw * 0.86)];

      envMB.addQuad(l0b, l1b, l1t, l0t, tunnelWall);
      envMB.addQuad(r1b, r0b, r0t, r1t, tunnelWall);
      envMB.addQuad(l0t, l1t, r1t, r0t, [0.09, 0.11, 0.14]);

      if (i % 3 === 0) {
        const c0L = [p0.x + p0.lx * 2.2, p0.y + th - 0.15, p0.z + p0.lz * 2.2];
        const c0R = [p0.x - p0.lx * 2.2, p0.y + th - 0.15, p0.z - p0.lz * 2.2];
        const c1R = [p1.x - p1.lx * 2.2, p1.y + th - 0.15, p1.z - p1.lz * 2.2];
        const c1L = [p1.x + p1.lx * 2.2, p1.y + th - 0.15, p1.z + p1.lz * 2.2];
        envMB.addQuad(c0L, c1L, c1R, c0R, tunnelLight, [0,0],[1,0],[1,1],[0,1], 1.0);
      }
    }

    // Authentic Japanese Shuto Expressway Green Overhead Sign Gantries
    if (i > 20 && i % 65 === 0 && !p0.isTunnel && world.cfg.theme !== 'touge') {
      const gw = w + 1.5;
      envMB.addBox(p0.x + p0.lx * gw, p0.y + 4.4, p0.z + p0.lz * gw, 0.55, 8.8, 0.55, steelRail);
      envMB.addBox(p0.x - p0.lx * gw, p0.y + 4.4, p0.z - p0.lz * gw, 0.55, 8.8, 0.55, steelRail);
      const sL = [p0.x + p0.lx * (gw * 0.72), p0.y + 7.4, p0.z + p0.lz * (gw * 0.72)];
      const sR = [p0.x - p0.lx * (gw * 0.72), p0.y + 7.4, p0.z - p0.lz * (gw * 0.72)];
      const signGreen = [0.05, 0.48, 0.30];
      envMB.addQuad(sL, sR, [sR[0], p0.y + 9.2, sR[2]], [sL[0], p0.y + 9.2, sL[2]], signGreen, [0,0],[1,0],[1,1],[0,1], 0.80);
      envMB.addQuad(sR, sL, [sL[0], p0.y + 9.2, sL[2]], [sR[0], p0.y + 9.2, sR[2]], signGreen, [0,0],[1,0],[1,1],[0,1], 0.80);
    }
  }

  // Start / Finish Steel Overhead Gantry
  const sp = pts[0];
  const gw = w + 1.6;
  envMB.addBox(sp.x + sp.lx * gw, sp.y + 4.5, sp.z + sp.lz * gw, 0.9, 9.0, 0.9, steelRail);
  envMB.addBox(sp.x - sp.lx * gw, sp.y + 4.5, sp.z - sp.lz * gw, 0.9, 9.0, 0.9, steelRail);
  const gL = [sp.x + sp.lx * (gw + 0.5), sp.y + 8.4, sp.z + sp.lz * (gw + 0.5)];
  const gR = [sp.x - sp.lx * (gw + 0.5), sp.y + 8.4, sp.z - sp.lz * (gw + 0.5)];
  const gLT = [gL[0], sp.y + 9.8, gL[2]];
  const gRT = [gR[0], sp.y + 9.8, gR[2]];
  envMB.addQuad(gL, gR, gRT, gLT, [0.10, 0.13, 0.18], [0,0],[1,0],[1,1],[0,1], 0.15);
  envMB.addQuad(gR, gL, gLT, gRT, [0.10, 0.13, 0.18], [0,0],[1,0],[1,1],[0,1], 0.15);
  // Crisp white/red start gantry floodlights
  envMB.addBox(sp.x, sp.y + 8.5, sp.z, w * 1.4, 0.25, 0.45, [0.98, 0.99, 1.0], 1.0);

  // Clipping Zone Markers (subtle amber-white glowing zone on wet asphalt)
  for (const z of world.clipZones) {
    const cx = Math.cos(z.yaw), sx = Math.sin(z.yaw);
    const fx = sx * 3.8, fz = cx * 3.8;
    const lx = cx * 1.4, lz = -sx * 1.4;
    const y = z.y + 0.04;
    envMB.addQuad(
      [z.x - fx - lx, y, z.z - fz - lz], [z.x - fx + lx, y, z.z - fz + lz],
      [z.x + fx + lx, y, z.z + fz + lz], [z.x + fx - lx, y, z.z + fz - lz],
      [0.98, 0.78, 0.24], [0,0],[1,0],[1,1],[0,1], 0.85
    );
  }

  // Realistic Tokyo Street Lamps (warm-white LED poles)
  for (const l of world.lamps) {
    envMB.addBox(l.x, l.y + 4.0, l.z, 0.24, 8.0, 0.24, [0.24, 0.27, 0.32]);
    envMB.addBox(l.x, l.y + 8.1, l.z, 1.35, 0.22, 0.75, [0.98, 0.96, 0.90], 1.0);
  }

  // Props (Vending Machines, Torii Gates, Bridge Towers)
  for (const pr of world.props) {
    if (pr.type === 'vending') {
      const vc = hexToRgb01(pr.color);
      envMB.addBox(pr.x, pr.y + 1.1, pr.z, 1.3, 2.2, 1.0, [0.16, 0.19, 0.24]);
      envMB.addBox(pr.x, pr.y + 1.35, pr.z, 1.36, 1.05, 1.06, vc, 0.88);
    } else if (pr.type === 'torii') {
      const red = [0.82, 0.14, 0.16];
      const darkT = [0.08, 0.08, 0.1];
      const lx = Math.cos(pr.yaw), lz = -Math.sin(pr.yaw);
      const half = pr.span * 0.5;
      envMB.addBox(pr.x + lx * half, pr.y + 5.2, pr.z + lz * half, 0.85, 10.4, 0.85, red, 0.18);
      envMB.addBox(pr.x - lx * half, pr.y + 5.2, pr.z - lz * half, 0.85, 10.4, 0.85, red, 0.18);
      const pL = [pr.x + lx * (half + 2.2), pr.y + 9.8, pr.z + lz * (half + 2.2)];
      const pR = [pr.x - lx * (half + 2.2), pr.y + 9.8, pr.z - lz * (half + 2.2)];
      envMB.addQuad(pL, pR, [pR[0], pr.y + 10.9, pR[2]], [pL[0], pr.y + 10.9, pL[2]], red, [0,0],[1,0],[1,1],[0,1], 0.35);
      envMB.addQuad(pR, pL, [pL[0], pr.y + 10.9, pL[2]], [pR[0], pr.y + 10.9, pR[2]], darkT);
    } else if (pr.type === 'bridge_tower') {
      const lx = Math.cos(pr.yaw), lz = -Math.sin(pr.yaw);
      const half = pr.span;
      envMB.addBox(pr.x + lx * half, pr.y + 15, pr.z + lz * half, 2.0, 34, 2.0, [0.24, 0.28, 0.34]);
      envMB.addBox(pr.x - lx * half, pr.y + 15, pr.z - lz * half, 2.0, 34, 2.0, [0.24, 0.28, 0.34]);
      const aL = [pr.x + lx * half, pr.y + 30, pr.z + lz * half];
      const aR = [pr.x - lx * half, pr.y + 30, pr.z - lz * half];
      envMB.addQuad(aL, aR, [aR[0], pr.y + 32, aR[2]], [aL[0], pr.y + 32, aL[2]], [0.95, 0.97, 1.0], [0,0],[1,0],[1,1],[0,1], 0.92);
      envMB.addQuad(aR, aL, [aL[0], pr.y + 32, aL[2]], [aR[0], pr.y + 32, aR[2]], [0.95, 0.97, 1.0], [0,0],[1,0],[1,1],[0,1], 0.92);
    }
  }

  // 3. BUILDINGS MESH + Rooftop Parapets & Aviation Spires
  const bldgMB = new MeshBuilder();
  for (const b of world.buildings) {
    if (b.type === 'tree') {
      envMB.addBox(b.x, b.y + 2.5, b.z, 0.9, 5.0, 0.9, [0.20, 0.14, 0.10]);
      const leafCol = b.isSakura ? [0.78, 0.44, 0.56] : [0.06, 0.17, 0.15];
      envMB.addTaperedBox(b.x, b.y + 3.5, b.y + b.h, b.z, b.w, b.d, b.w * 0.15, b.d * 0.15, 0, leafCol, 0.0);
    } else {
      bldgMB.addBox(b.x, b.y + b.h * 0.5, b.z, b.w, b.h, b.d, [1, 1, 1], 0.06, [1, Math.max(1, Math.round(b.h / 16))]);
      // Realistic architectural rooftop cornice + subtle illuminated rooftop billboard
      envMB.addBox(b.x, b.y + b.h + 0.4, b.z, b.w + 0.25, 0.7, b.d + 0.25, [0.16, 0.19, 0.24]);
      if (b.h > 44) {
        envMB.addBox(b.x, b.y + b.h + 5.5, b.z, 0.32, 10.0, 0.32, [0.35, 0.4, 0.48]);
        envMB.addBox(b.x, b.y + b.h + 10.8, b.z, 0.8, 0.8, 0.8, [1.0, 0.12, 0.18], 1.0);
      }
      if (b.hasBillboard) {
        const nc = hexToRgb01(b.neonColor);
        envMB.addBox(b.x, b.y + b.h + 2.4, b.z, b.w * 0.52, 3.2, 0.55, nc, 0.88);
      }
    }
  }

  // 4. NIGHT GROUND PLANE
  const groundMB = new MeshBuilder();
  const gS = 950;
  const gCol = world.cfg.theme === 'touge' ? [0.035, 0.05, 0.06] : [0.025, 0.032, 0.065];
  groundMB.addQuad([-gS, -4.2, -gS], [-gS, -4.2, gS], [gS, -4.2, gS], [gS, -4.2, -gS], gCol);

  return {
    sky: buildSkyDomeMesh(gl),
    road: roadMB.build(gl),
    env: envMB.build(gl),
    buildings: bldgMB.build(gl),
    ground: groundMB.build(gl)
  };
}
