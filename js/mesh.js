// High-Detail Curved 3D Automotive Mesh Generator (Smooth 12-Point Cross-Section Lofting, Recessed Wheel Arches, 24-Seg Alloy Wheels) + Photorealistic Shibuya Crossing 3D World

import { hexToRgb01 } from './math.js';

export class MeshBuilder {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }

  // Material codes stored in vertex color alpha (aCol.a):
  //  0.00      = standard matte / concrete / asphalt
  //  0.18      = metallic automotive clearcoat paint (Fresnel + dual specular + Shibuya reflections)
  //  0.34      = dark reflective automotive glass / chrome trim
  //  0.52      = matte dark rubber tire / ground contact shadow
  //  0.72..1.0 = HDR emissive (triggers FBO Bloom! taillights, headlights, signs, streetlamps)
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
    for (let i = 0; i < 4; i++) {
      this.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      this.norm.push(nx, ny, nz);
      this.uv.push(uvs[i][0], uvs[i][1]);
      this.col.push(color[0], color[1], color[2], mat);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  addSmoothQuad(p0, p1, p2, p3, n0, n1, n2, n3, color, mat = 0.18, uv0 = [0, 0], uv1 = [1, 0], uv2 = [1, 1], uv3 = [0, 1]) {
    const base = this.pos.length / 3;
    const pts = [p0, p1, p2, p3];
    const norms = [n0, n1, n2, n3];
    const uvs = [uv0, uv1, uv2, uv3];
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

  addCylinderY(cx, y0, y1, cz, rBot, rTop, segs, color, mat = 0, uvReps = [2, 2]) {
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      const u0 = (i / segs) * uvReps[0], u1 = ((i + 1) / segs) * uvReps[0];
      const p0 = [cx + c0 * rBot, y0, cz + s0 * rBot];
      const p1 = [cx + c1 * rBot, y0, cz + s1 * rBot];
      const p2 = [cx + c1 * rTop, y1, cz + s1 * rTop];
      const p3 = [cx + c0 * rTop, y1, cz + s0 * rTop];
      this.addSmoothQuad(p0, p1, p2, p3, [c0, 0, s0], [c1, 0, s1], [c1, 0, s1], [c0, 0, s0], color, mat, [u0, 0], [u1, 0], [u1, uvReps[1]], [u0, uvReps[1]]);
    }
  }

  // Smooth Curved Multi-Ribbon Automotive Body Lofting!
  // Generates a truly rounded car shell with curved tumblehome, domed hood/roof crown, sculpted fender shoulders & beltline crease!
  addCurvedCarShell(stations, bodyCol, glassCol, trimCol, bodyMat = 0.18) {
    // Build a 10-point cross-section curve from right rocker (-X) over crown (0) to left rocker (+X) for each station
    const rings = stations.map(st => {
      const z = st.z;
      const yb = st.yBot;
      const ym = st.yMid;       // Beltline height
      const ys = st.yShd ?? (ym + 0.09); // Sculpted fender shoulder top
      const yt = st.yTop;       // Roof/hood center crown
      const wb = st.wBot;
      const wm = st.wMid;       // Widest fender/door bulge
      const ws = st.wShd ?? (wm * 0.94);
      const wt = st.wTop;       // Roof/hood half-width
      const crownLift = st.crown ?? 0.055; // Realistic domed curvature across hood & roof!
      const isGlassSide = !!st.glassSide;
      const isGlassTop = !!st.glassTop;

      // Half-profile points from center (x=0) out to left (+X), mirrored to right (-X)
      // 0: Center crown, 1: Upper deck edge, 2: Upper shoulder/glass mid, 3: Beltline fender crease, 4: Mid door bulge, 5: Lower rocker
      const pts = [
        { x: -wb * 0.94, y: yb,          nx: -0.65, ny: -0.75, segType: 'trim' },
        { x: -wm,        y: yb + (ym - yb) * 0.48, nx: -0.98, ny: -0.10, segType: 'body' },
        { x: -wm * 1.01, y: ym,          nx: -0.94, ny:  0.34, segType: 'body' },
        { x: -ws,        y: ys,          nx: -0.62, ny:  0.78, segType: isGlassSide ? 'glass' : 'body' },
        { x: -wt,        y: yt - 0.02,   nx: -0.34, ny:  0.94, segType: isGlassTop ? 'glass' : 'body' },
        { x:  0,         y: yt + crownLift, nx: 0.0, ny: 1.0,  segType: isGlassTop ? 'glass' : 'body' },
        { x:  wt,        y: yt - 0.02,   nx:  0.34, ny:  0.94, segType: isGlassSide ? 'glass' : 'body' },
        { x:  ws,        y: ys,          nx:  0.62, ny:  0.78, segType: 'body' },
        { x:  wm * 1.01, y: ym,          nx:  0.94, ny:  0.34, segType: 'body' },
        { x:  wm,        y: yb + (ym - yb) * 0.48, nx:  0.98, ny: -0.10, segType: 'body' },
        { x:  wb * 0.94, y: yb,          nx:  0.65, ny: -0.75, segType: 'trim' }
      ];
      return { z, st, pts };
    });

    // Stitch consecutive curved cross-section rings with smooth longitudinal slope normals
    for (let i = 0; i < rings.length - 1; i++) {
      const r0 = rings[i];
      const r1 = rings[i + 1];
      const dz = r1.z - r0.z;

      for (let j = 0; j < r0.pts.length - 1; j++) {
        const a0 = r0.pts[j], a1 = r0.pts[j + 1];
        const b0 = r1.pts[j], b1 = r1.pts[j + 1];

        // Determine panel material (glossy paint vs dark mirror glass vs dark lower trim)
        const isTopStrip = (j === 4 || j === 5);
        const isSideGlassStrip = (j === 3 || j === 6);
        let col = bodyCol;
        let mat = bodyMat;

        if (isTopStrip && r0.st.glassTop) {
          col = glassCol; mat = 0.34;
        } else if (isSideGlassStrip && r0.st.glassSide) {
          col = glassCol; mat = 0.34;
        } else if (j === 0 || j === r0.pts.length - 2) {
          col = r0.st.lowerTrim ? trimCol : bodyCol;
          mat = r0.st.lowerTrim ? 0.12 : bodyMat;
        } else if (isTopStrip && r0.st.carbonTop) {
          col = [0.09, 0.10, 0.13]; mat = 0.22;
        }

        // Compute longitudinal Z normal tilt for smooth curved hood/windshield/fastback light flow!
        const dy0 = b0.y - a0.y;
        const dy1 = b1.y - a1.y;
        const nz0 = dz !== 0 ? (-dy0 / Math.abs(dz)) * 0.72 : 0;
        const nz1 = dz !== 0 ? (-dy1 / Math.abs(dz)) * 0.72 : 0;

        this.addSmoothQuad(
          [a0.x, a0.y, r0.z], [a1.x, a1.y, r0.z],
          [b1.x, b1.y, r1.z], [b0.x, b0.y, r1.z],
          [a0.nx, a0.ny, nz0], [a1.nx, a1.ny, nz1],
          [b1.nx, b1.ny, nz1], [b0.nx, b0.ny, nz0],
          col, mat,
          [j / 10, i / rings.length], [(j + 1) / 10, i / rings.length],
          [(j + 1) / 10, (i + 1) / rings.length], [j / 10, (i + 1) / rings.length]
        );
      }
    }

    // Smooth Front Bumper & Rear Fascia End-Caps
    const capRing = (ring, isFront) => {
      const p = ring.pts;
      const z = ring.z;
      const nz = isFront ? 1 : -1;
      for (let k = 0; k < 5; k++) {
        const l0 = p[k], l1 = p[k + 1];
        const r0 = p[p.length - 1 - k], r1 = p[p.length - 2 - k];
        if (isFront) {
          this.addSmoothQuad(
            [l0.x, l0.y, z], [r0.x, r0.y, z], [r1.x, r1.y, z], [l1.x, l1.y, z],
            [l0.nx * 0.35, l0.ny * 0.35, nz], [r0.nx * 0.35, r0.ny * 0.35, nz],
            [r1.nx * 0.35, r1.ny * 0.35, nz], [l1.nx * 0.35, l1.ny * 0.35, nz],
            bodyCol, bodyMat
          );
        } else {
          this.addSmoothQuad(
            [r0.x, r0.y, z], [l0.x, l0.y, z], [l1.x, l1.y, z], [r1.x, r1.y, z],
            [r0.nx * 0.35, r0.ny * 0.35, nz], [l0.nx * 0.35, l0.ny * 0.35, nz],
            [l1.nx * 0.35, l1.ny * 0.35, nz], [r1.nx * 0.35, r1.ny * 0.35, nz],
            bodyCol, bodyMat
          );
        }
      }
    };
    capRing(rings[0], true);
    capRing(rings[rings.length - 1], false);
  }

  // Realistic 24-Segment Alloy Wheel + Curved Tire Shoulder + Deep Metallic Barrel + Slotted Brake Disc + Colored Caliper
  addRealisticWheel(cx, cy, cz, radius, width, rimCol, accentCol, caliperCol, camber = 0.04) {
    const segs = 24;
    const hx = width * 0.5;
    const sideSign = cx >= 0 ? 1 : -1;
    const tireCol = [0.055, 0.06, 0.068];
    const sidewallCol = [0.085, 0.09, 0.105];
    const rotorCol = [0.68, 0.72, 0.78];
    const tiltX = (localX, localY) => cx + localX - sideSign * localY * camber;

    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // Curved Tire Tread
      const p0 = [tiltX(-hx, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const p1 = [tiltX( hx, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const p2 = [tiltX( hx, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      const p3 = [tiltX(-hx, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      this.addSmoothQuad(p0, p1, p2, p3, [0, s0, c0], [0, s0, c0], [0, s1, c1], [0, s1, c1], tireCol, 0.52);

      // Outer Tire Sidewall -> Gloss Alloy Rim Lip
      const rRim = radius * 0.74;
      const rHub = radius * 0.22;
      const ox = sideSign * (hx + 0.006);
      const dishX = sideSign * (hx - 0.062);

      const t0 = [tiltX(ox, s0 * radius), cy + s0 * radius, cz + c0 * radius];
      const t1 = [tiltX(ox, s1 * radius), cy + s1 * radius, cz + c1 * radius];
      const m0 = [tiltX(ox, s0 * rRim), cy + s0 * rRim, cz + c0 * rRim];
      const m1 = [tiltX(ox, s1 * rRim), cy + s1 * rRim, cz + c1 * rRim];
      if (sideSign > 0) this.addQuad(t0, t1, m1, m0, sidewallCol, [0,0],[1,0],[1,1],[0,1], 0.52);
      else this.addQuad(t1, t0, m0, m1, sidewallCol, [0,0],[1,0],[1,1],[0,1], 0.52);

      // Deep Polished Chrome/Alloy Barrel Lip
      const d0 = [tiltX(dishX, s0 * rRim * 0.94), cy + s0 * rRim * 0.94, cz + c0 * rRim * 0.94];
      const d1 = [tiltX(dishX, s1 * rRim * 0.94), cy + s1 * rRim * 0.94, cz + c1 * rRim * 0.94];
      const lipMat = (accentCol[2] > 0.85 && accentCol[0] < 0.25) ? 0.90 : 0.34;
      if (sideSign > 0) this.addQuad(m0, m1, d1, d0, accentCol, [0,0],[1,0],[1,1],[0,1], lipMat);
      else this.addQuad(m1, m0, d0, d1, accentCol, [0,0],[1,0],[1,1],[0,1], lipMat);

      // 6 Twin-Spoke Alloy Rim + Visible Slotted Rotor & Red/Gold Caliper behind spokes
      const isSpoke = (i % 4 === 0);
      const isCaliper = (!isSpoke && (i >= 3 && i <= 6));
      const h0 = [tiltX(ox - sideSign * 0.018, s0 * rHub), cy + s0 * rHub, cz + c0 * rHub];
      const h1 = [tiltX(ox - sideSign * 0.018, s1 * rHub), cy + s1 * rHub, cz + c1 * rHub];
      const faceCol = isSpoke ? rimCol : (isCaliper ? caliperCol : rotorCol);
      const faceMat = isSpoke ? 0.34 : (isCaliper ? 0.25 : 0.16);
      if (sideSign > 0) this.addQuad(h0, d0, d1, h1, faceCol, [0,0],[1,0],[1,1],[0,1], faceMat);
      else this.addQuad(h1, d1, d0, h0, faceCol, [0,0],[1,0],[1,1],[0,1], faceMat);
    }
  }

  // Glowing Twin-Ring Circular LED Taillight Cluster (Iconic Skyline GT-R R34 style from Image #1!)
  addLEDTaillightRing(cx, cy, cz, rOuter, color) {
    const segs = 14;
    const rInner = rOuter * 0.52;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.addQuad(
        [cx + c0 * rInner, cy + s0 * rInner, cz],
        [cx + c0 * rOuter, cy + s0 * rOuter, cz],
        [cx + c1 * rOuter, cy + s1 * rOuter, cz],
        [cx + c1 * rInner, cy + s1 * rInner, cz],
        color, [0,0],[1,0],[1,1],[0,1], 1.0
      );
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
// PHOTOREALISTIC CURVED 3D AUTOMOTIVE BUILDER (ALL 7 TIERS: SIMPLES -> HIPERCARRO)
// =========================================================================
export function buildJDMCarMesh(gl, {
  style = 'gtr',
  bodyHex = '#1d4ed8',
  underglowHex = '#22d3ee',
  rimHex = '#cbd5e1',
  rimAccentHex = '#f8fafc',
  caliperHex = '#ef4444',
  wing = 'gt',
  bodykit = 'street',
  rideOffset = -0.04,
  camber = 0.04,
  isTraffic = false
}) {
  const mb = new MeshBuilder();
  const body = hexToRgb01(bodyHex);
  const darkTrim = [0.045, 0.052, 0.068];
  const carbon = [0.08, 0.09, 0.115];
  const glass = [0.03, 0.05, 0.085];
  const chrome = [0.84, 0.88, 0.95];
  const headCol = [0.98, 0.99, 1.0];
  const tailBright = [1.0, 0.14, 0.08];
  const tailCore = [1.0, 0.45, 0.18];
  const rim = hexToRgb01(rimHex);
  const rimAcc = hexToRgb01(rimAccentHex);
  const caliper = hexToRgb01(caliperHex);

  const y0 = 0.25 + rideOffset;
  const wb = (bodykit === 'wide' && !isTraffic) ? 0.08 : 0.0;

  // High-resolution 10-station curved longitudinal profiles for ALL 7 tiers!
  const profiles = {
    compact: { // Tier 1: Realistic curved 90s Japanese Hatchback (like EG Civic / Starlet)
      L: 4.06, halfW: 0.88 + wb, wr: 0.32, fz: 1.26, rz: -1.24,
      stations: [
        { z:  2.03, yBot: y0+0.05, yMid: y0+0.30, yShd: y0+0.42, yTop: y0+0.44, wBot: 0.68, wMid: 0.78, wShd: 0.72, wTop: 0.58, crown: 0.04, lowerTrim: true },
        { z:  1.84, yBot: y0+0.02, yMid: y0+0.42, yShd: y0+0.50, yTop: y0+0.53, wBot: 0.82, wMid: 0.88, wShd: 0.84, wTop: 0.72, crown: 0.05 },
        { z:  1.32, yBot: y0+0.01, yMid: y0+0.50, yShd: y0+0.58, yTop: y0+0.60, wBot: 0.85, wMid: 0.90, wShd: 0.86, wTop: 0.75, crown: 0.05 },
        { z:  0.86, yBot: y0+0.01, yMid: y0+0.56, yShd: y0+0.62, yTop: y0+0.64, wBot: 0.84, wMid: 0.89, wShd: 0.85, wTop: 0.75, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.26, yBot: y0+0.01, yMid: y0+0.60, yShd: y0+0.96, yTop: y0+1.13, wBot: 0.84, wMid: 0.89, wShd: 0.74, wTop: 0.62, crown: 0.06, glassSide: true },
        { z: -0.62, yBot: y0+0.01, yMid: y0+0.62, yShd: y0+0.98, yTop: y0+1.14, wBot: 0.85, wMid: 0.90, wShd: 0.73, wTop: 0.61, crown: 0.06, glassSide: true },
        { z: -1.32, yBot: y0+0.01, yMid: y0+0.63, yShd: y0+0.96, yTop: y0+1.09, wBot: 0.85, wMid: 0.90, wShd: 0.74, wTop: 0.62, crown: 0.05, glassTop: true, glassSide: true },
        { z: -1.86, yBot: y0+0.04, yMid: y0+0.60, yShd: y0+0.69, yTop: y0+0.72, wBot: 0.82, wMid: 0.87, wShd: 0.82, wTop: 0.72, crown: 0.04 },
        { z: -2.03, yBot: y0+0.09, yMid: y0+0.42, yShd: y0+0.58, yTop: y0+0.64, wBot: 0.72, wMid: 0.80, wShd: 0.76, wTop: 0.66, crown: 0.03, lowerTrim: true }
      ]
    },
    hatch: { // Tier 2: Sleek Classic Touge Liftback (AE86 Trueno style)
      L: 4.26, halfW: 0.90 + wb, wr: 0.33, fz: 1.32, rz: -1.28,
      stations: [
        { z:  2.13, yBot: y0+0.02, yMid: y0+0.26, yShd: y0+0.36, yTop: y0+0.39, wBot: 0.74, wMid: 0.82, wShd: 0.76, wTop: 0.64, crown: 0.03, lowerTrim: true },
        { z:  1.88, yBot: y0,      yMid: y0+0.40, yShd: y0+0.47, yTop: y0+0.49, wBot: 0.86, wMid: 0.90, wShd: 0.86, wTop: 0.76, crown: 0.04 },
        { z:  1.26, yBot: y0,      yMid: y0+0.48, yShd: y0+0.54, yTop: y0+0.56, wBot: 0.87, wMid: 0.91, wShd: 0.87, wTop: 0.78, crown: 0.04 },
        { z:  0.70, yBot: y0,      yMid: y0+0.54, yShd: y0+0.58, yTop: y0+0.60, wBot: 0.86, wMid: 0.90, wShd: 0.86, wTop: 0.76, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.04, yBot: y0,      yMid: y0+0.57, yShd: y0+0.90, yTop: y0+1.04, wBot: 0.86, wMid: 0.90, wShd: 0.74, wTop: 0.63, crown: 0.05, glassSide: true },
        { z: -0.92, yBot: y0,      yMid: y0+0.59, yShd: y0+0.88, yTop: y0+1.02, wBot: 0.87, wMid: 0.92, wShd: 0.73, wTop: 0.61, crown: 0.05, glassTop: true, glassSide: true },
        { z: -1.82, yBot: y0+0.02, yMid: y0+0.58, yShd: y0+0.65, yTop: y0+0.68, wBot: 0.85, wMid: 0.90, wShd: 0.84, wTop: 0.75, crown: 0.04 },
        { z: -2.13, yBot: y0+0.07, yMid: y0+0.42, yShd: y0+0.56, yTop: y0+0.62, wBot: 0.76, wMid: 0.84, wShd: 0.78, wTop: 0.68, crown: 0.03, lowerTrim: true }
      ]
    },
    coupe: { // Tier 3: Curvy Aerodynamic Sports Coupe (RX-7 FD silhouette)
      L: 4.44, halfW: 0.96 + wb, wr: 0.34, fz: 1.38, rz: -1.34,
      stations: [
        { z:  2.22, yBot: y0,      yMid: y0+0.22, yShd: y0+0.32, yTop: y0+0.35, wBot: 0.72, wMid: 0.84, wShd: 0.76, wTop: 0.60, crown: 0.04, lowerTrim: true },
        { z:  1.92, yBot: y0-0.02, yMid: y0+0.38, yShd: y0+0.46, yTop: y0+0.48, wBot: 0.90, wMid: 0.96, wShd: 0.90, wTop: 0.74, crown: 0.06 },
        { z:  1.32, yBot: y0-0.02, yMid: y0+0.46, yShd: y0+0.54, yTop: y0+0.56, wBot: 0.93, wMid: 0.99, wShd: 0.92, wTop: 0.78, crown: 0.06 },
        { z:  0.64, yBot: y0-0.02, yMid: y0+0.52, yShd: y0+0.56, yTop: y0+0.58, wBot: 0.90, wMid: 0.96, wShd: 0.90, wTop: 0.76, crown: 0.05, glassTop: true, glassSide: true },
        { z: -0.06, yBot: y0-0.02, yMid: y0+0.55, yShd: y0+0.84, yTop: y0+0.97, wBot: 0.90, wMid: 0.96, wShd: 0.74, wTop: 0.60, crown: 0.06, glassSide: true },
        { z: -0.84, yBot: y0-0.02, yMid: y0+0.58, yShd: y0+0.83, yTop: y0+0.94, wBot: 0.94, wMid: 1.00, wShd: 0.75, wTop: 0.58, crown: 0.06, glassTop: true, glassSide: true },
        { z: -1.78, yBot: y0,      yMid: y0+0.58, yShd: y0+0.65, yTop: y0+0.67, wBot: 0.93, wMid: 0.99, wShd: 0.91, wTop: 0.78, crown: 0.05 },
        { z: -2.22, yBot: y0+0.06, yMid: y0+0.42, yShd: y0+0.56, yTop: y0+0.60, wBot: 0.78, wMid: 0.88, wShd: 0.82, wTop: 0.70, crown: 0.04, lowerTrim: true }
      ]
    },
    sedan: { // Tier 4: Executive 4-Door Drift Sedan (Chaser JZX100)
      L: 4.74, halfW: 0.97 + wb, wr: 0.35, fz: 1.50, rz: -1.46,
      stations: [
        { z:  2.37, yBot: y0+0.02, yMid: y0+0.30, yShd: y0+0.42, yTop: y0+0.45, wBot: 0.80, wMid: 0.90, wShd: 0.84, wTop: 0.70, crown: 0.04, lowerTrim: true },
        { z:  2.04, yBot: y0,      yMid: y0+0.46, yShd: y0+0.54, yTop: y0+0.56, wBot: 0.94, wMid: 0.98, wShd: 0.93, wTop: 0.82, crown: 0.05 },
        { z:  1.42, yBot: y0,      yMid: y0+0.52, yShd: y0+0.58, yTop: y0+0.60, wBot: 0.95, wMid: 0.99, wShd: 0.94, wTop: 0.84, crown: 0.05 },
        { z:  0.84, yBot: y0,      yMid: y0+0.56, yShd: y0+0.60, yTop: y0+0.62, wBot: 0.94, wMid: 0.98, wShd: 0.93, wTop: 0.82, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.18, yBot: y0,      yMid: y0+0.59, yShd: y0+0.93, yTop: y0+1.08, wBot: 0.94, wMid: 0.98, wShd: 0.80, wTop: 0.68, crown: 0.06, glassSide: true },
        { z: -0.96, yBot: y0,      yMid: y0+0.61, yShd: y0+0.92, yTop: y0+1.06, wBot: 0.95, wMid: 0.99, wShd: 0.79, wTop: 0.66, crown: 0.06, glassTop: true, glassSide: true },
        { z: -1.56, yBot: y0,      yMid: y0+0.62, yShd: y0+0.69, yTop: y0+0.72, wBot: 0.95, wMid: 0.99, wShd: 0.93, wTop: 0.82, crown: 0.04 },
        { z: -2.20, yBot: y0+0.02, yMid: y0+0.58, yShd: y0+0.66, yTop: y0+0.69, wBot: 0.90, wMid: 0.95, wShd: 0.89, wTop: 0.78, crown: 0.04 },
        { z: -2.37, yBot: y0+0.07, yMid: y0+0.44, yShd: y0+0.58, yTop: y0+0.64, wBot: 0.80, wMid: 0.88, wShd: 0.82, wTop: 0.72, crown: 0.03, lowerTrim: true }
      ]
    },
    gtr: { // Tier 5: Hero Bayside Blue GT-34 Spec-V (directly inspired by Image #1!)
      L: 4.62, halfW: 1.00 + wb, wr: 0.35, fz: 1.44, rz: -1.38,
      stations: [
        { z:  2.31, yBot: y0-0.02, yMid: y0+0.30, yShd: y0+0.42, yTop: y0+0.45, wBot: 0.84, wMid: 0.93, wShd: 0.88, wTop: 0.74, crown: 0.04, lowerTrim: true },
        { z:  1.96, yBot: y0-0.02, yMid: y0+0.46, yShd: y0+0.54, yTop: y0+0.56, wBot: 0.96, wMid: 1.01, wShd: 0.96, wTop: 0.84, crown: 0.05 },
        { z:  1.34, yBot: y0-0.02, yMid: y0+0.52, yShd: y0+0.59, yTop: y0+0.61, wBot: 0.97, wMid: 1.02, wShd: 0.96, wTop: 0.84, crown: 0.05 },
        { z:  0.74, yBot: y0-0.02, yMid: y0+0.57, yShd: y0+0.61, yTop: y0+0.63, wBot: 0.95, wMid: 0.99, wShd: 0.94, wTop: 0.82, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.08, yBot: y0-0.02, yMid: y0+0.60, yShd: y0+0.92, yTop: y0+1.05, wBot: 0.95, wMid: 0.99, wShd: 0.78, wTop: 0.66, crown: 0.06, glassSide: true },
        { z: -0.92, yBot: y0-0.02, yMid: y0+0.62, yShd: y0+0.90, yTop: y0+1.03, wBot: 0.97, wMid: 1.03, wShd: 0.78, wTop: 0.65, crown: 0.06, glassTop: true, glassSide: true },
        { z: -1.62, yBot: y0-0.02, yMid: y0+0.62, yShd: y0+0.70, yTop: y0+0.72, wBot: 0.97, wMid: 1.03, wShd: 0.95, wTop: 0.84, crown: 0.04 },
        { z: -2.20, yBot: y0+0.02, yMid: y0+0.58, yShd: y0+0.68, yTop: y0+0.70, wBot: 0.92, wMid: 0.98, wShd: 0.92, wTop: 0.82, crown: 0.04 },
        { z: -2.31, yBot: y0+0.06, yMid: y0+0.46, yShd: y0+0.62, yTop: y0+0.67, wBot: 0.86, wMid: 0.94, wShd: 0.88, wTop: 0.78, crown: 0.03, lowerTrim: true }
      ]
    },
    supercar: { // Tier 6: Mid-Engine Exotic Supercar (Raijin NS-X GT)
      L: 4.56, halfW: 1.04 + wb, wr: 0.35, fz: 1.42, rz: -1.36,
      stations: [
        { z:  2.28, yBot: y0-0.04, yMid: y0+0.18, yShd: y0+0.28, yTop: y0+0.30, wBot: 0.76, wMid: 0.88, wShd: 0.80, wTop: 0.64, crown: 0.04, lowerTrim: true },
        { z:  1.90, yBot: y0-0.04, yMid: y0+0.34, yShd: y0+0.44, yTop: y0+0.46, wBot: 0.96, wMid: 1.02, wShd: 0.94, wTop: 0.78, crown: 0.05 },
        { z:  1.28, yBot: y0-0.04, yMid: y0+0.44, yShd: y0+0.50, yTop: y0+0.52, wBot: 0.97, wMid: 1.03, wShd: 0.94, wTop: 0.78, crown: 0.05 },
        { z:  0.86, yBot: y0-0.04, yMid: y0+0.48, yShd: y0+0.52, yTop: y0+0.54, wBot: 0.95, wMid: 1.00, wShd: 0.92, wTop: 0.76, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.02, yBot: y0-0.04, yMid: y0+0.52, yShd: y0+0.80, yTop: y0+0.91, wBot: 0.97, wMid: 1.03, wShd: 0.74, wTop: 0.60, crown: 0.06, glassSide: true },
        { z: -0.72, yBot: y0-0.04, yMid: y0+0.56, yShd: y0+0.78, yTop: y0+0.88, wBot: 1.01, wMid: 1.07, wShd: 0.76, wTop: 0.58, crown: 0.05, glassTop: true, carbonTop: true },
        { z: -1.78, yBot: y0-0.02, yMid: y0+0.58, yShd: y0+0.64, yTop: y0+0.66, wBot: 1.01, wMid: 1.07, wShd: 0.98, wTop: 0.84, crown: 0.04 },
        { z: -2.28, yBot: y0+0.04, yMid: y0+0.44, yShd: y0+0.58, yTop: y0+0.62, wBot: 0.90, wMid: 0.99, wShd: 0.92, wTop: 0.80, crown: 0.03, lowerTrim: true }
      ]
    },
    hypercar: { // Tier 7: Top Apex V12 Hypercar (Kaguya Valkyrie)
      L: 4.76, halfW: 1.08 + wb, wr: 0.36, fz: 1.52, rz: -1.44,
      stations: [
        { z:  2.38, yBot: y0-0.05, yMid: y0+0.14, yShd: y0+0.22, yTop: y0+0.24, wBot: 0.72, wMid: 0.86, wShd: 0.74, wTop: 0.56, crown: 0.04, lowerTrim: true },
        { z:  1.94, yBot: y0-0.05, yMid: y0+0.32, yShd: y0+0.42, yTop: y0+0.44, wBot: 1.00, wMid: 1.08, wShd: 0.96, wTop: 0.76, crown: 0.06 },
        { z:  1.32, yBot: y0-0.05, yMid: y0+0.40, yShd: y0+0.46, yTop: y0+0.48, wBot: 0.98, wMid: 1.06, wShd: 0.94, wTop: 0.74, crown: 0.05 },
        { z:  0.94, yBot: y0-0.05, yMid: y0+0.44, yShd: y0+0.48, yTop: y0+0.50, wBot: 0.95, wMid: 1.02, wShd: 0.90, wTop: 0.72, crown: 0.04, glassTop: true, glassSide: true },
        { z:  0.12, yBot: y0-0.05, yMid: y0+0.48, yShd: y0+0.75, yTop: y0+0.86, wBot: 0.98, wMid: 1.05, wShd: 0.68, wTop: 0.52, crown: 0.07, glassSide: true },
        { z: -0.70, yBot: y0-0.05, yMid: y0+0.52, yShd: y0+0.74, yTop: y0+0.83, wBot: 1.05, wMid: 1.12, wShd: 0.72, wTop: 0.52, crown: 0.05, carbonTop: true },
        { z: -1.88, yBot: y0-0.03, yMid: y0+0.56, yShd: y0+0.62, yTop: y0+0.64, wBot: 1.05, wMid: 1.11, wShd: 1.00, wTop: 0.88, crown: 0.04 },
        { z: -2.38, yBot: y0+0.03, yMid: y0+0.40, yShd: y0+0.56, yTop: y0+0.60, wBot: 0.92, wMid: 1.03, wShd: 0.95, wTop: 0.84, crown: 0.03, lowerTrim: true }
      ]
    }
  };

  const prof = profiles[style] || profiles.gtr;
  const halfW = prof.halfW;
  const fullW = halfW * 2;
  const sts = prof.stations.map(s => ({
    ...s,
    wBot: s.wBot + wb,
    wMid: s.wMid + wb,
    wShd: s.wShd + wb * 0.85
  }));

  // 1. Main High-Detail Curved Smooth-Shaded Metallic Car Shell
  mb.addCurvedCarShell(sts, body, glass, darkTrim, isTraffic ? 0.12 : 0.18);

  // Two-tone Panda lower trim for Hachi-Roku S86 when white
  if (style === 'hatch' && bodyHex.toLowerCase() === '#f1f5f9') {
    mb.addBox(0, y0 + 0.14, 0, fullW + 0.02, 0.20, prof.L * 0.94, darkTrim, 0.12);
  }

  // 2. Aerodynamic Carbon Splitter, Side Skirts & Multi-Fin Diffuser
  const frontZ = sts[0].z;
  const rearZ = sts[sts.length - 1].z;
  if (!isTraffic && (bodykit !== 'stock' || style === 'supercar' || style === 'hypercar' || style === 'gtr')) {
    const lipExtra = bodykit === 'wide' ? 0.12 : 0.05;
    mb.addBox(0, y0 - 0.02, frontZ + 0.03, fullW + lipExtra, 0.055, 0.30, carbon, 0.16);
    mb.addBox(0, y0 - 0.015, 0, fullW + lipExtra, 0.06, prof.L * 0.64, carbon, 0.16);
  }
  mb.addBox(0, y0 + 0.07, rearZ - 0.02, fullW * 0.84, 0.20, 0.14, darkTrim, 0.06);
  if (!isTraffic && style !== 'compact') {
    [-0.46, -0.18, 0.18, 0.46].forEach(ox => {
      mb.addBox(ox * halfW, y0 + 0.07, rearZ - 0.05, 0.035, 0.18, 0.16, carbon, 0.14);
    });
  }

  // 3. Supercar Side Intakes / Hypercar Dorsal Fin / Widebody Arches
  if (style === 'supercar' || style === 'hypercar') {
    [-1, 1].forEach(s => {
      mb.addBox(s * (halfW + 0.01), y0 + 0.30, -0.45, 0.11, 0.32, 0.82, darkTrim, 0.06);
      mb.addBox(s * (halfW + 0.05), y0 + 0.32, -0.52, 0.035, 0.28, 0.70, body, 0.18);
    });
  }
  if (style === 'hypercar') {
    mb.addBox(0, y0 + 0.78, -1.12, 0.045, 0.30, 1.15, carbon, 0.18);
  }

  // 4. Sculpted Aerodynamic Side Wing Mirrors
  const mirrorZ = sts[3].z - 0.12;
  const mirrorY = sts[3].yShd + 0.08;
  [-1, 1].forEach(s => {
    mb.addBox(s * (halfW + 0.07), mirrorY, mirrorZ, 0.17, 0.085, 0.13, body, 0.18);
    mb.addBox(s * (halfW - 0.01), mirrorY - 0.045, mirrorZ, 0.07, 0.07, 0.055, darkTrim, 0.08);
  });

  // 5. Recessed Front Intercooler Mouth + Chrome-Housed Xenon Projector Headlights
  const hlY = sts[0].yMid + 0.06;
  mb.addBox(0, y0 + 0.14, frontZ + 0.012, fullW * 0.48, 0.18, 0.05, [0.06, 0.07, 0.09], 0.06);
  if (!isTraffic && style !== 'compact') {
    mb.addBox(0, y0 + 0.14, frontZ + 0.025, fullW * 0.38, 0.14, 0.03, chrome, 0.34);
  }
  [-1, 1].forEach(s => {
    const hx = s * halfW * 0.62;
    mb.addBox(hx, hlY, frontZ + 0.01, 0.42, 0.14, 0.05, [0.05, 0.06, 0.08], 0.34);
    mb.addBox(hx, hlY, frontZ + 0.028, 0.32, 0.075, 0.035, headCol, 1.0);
  });

  // 6. Photorealistic Glowing LED Taillight Signatures + Illuminated White Japanese License Plate!
  const tlY = sts[sts.length - 1].yMid + 0.09;
  // Dark recessed tail panel backing
  mb.addBox(0, tlY, rearZ - 0.01, fullW * 0.86, 0.22, 0.04, [0.04, 0.045, 0.06], 0.34);
  if (style === 'gtr' || style === 'coupe') {
    // Iconic Twin-Ring Glowing Red LED Halos (like Image #1 Skyline R34!)
    mb.addLEDTaillightRing( halfW * 0.68, tlY, rearZ - 0.032, 0.095, tailBright);
    mb.addLEDTaillightRing( halfW * 0.42, tlY, rearZ - 0.032, 0.080, tailCore);
    mb.addLEDTaillightRing(-halfW * 0.42, tlY, rearZ - 0.032, 0.080, tailCore);
    mb.addLEDTaillightRing(-halfW * 0.68, tlY, rearZ - 0.032, 0.095, tailBright);
  } else if (style === 'supercar' || style === 'hypercar') {
    mb.addBox(0, tlY + 0.01, rearZ - 0.028, fullW * 0.82, 0.065, 0.04, tailBright, 1.0);
    mb.addBox(0, tlY + 0.01, rearZ - 0.035, fullW * 0.44, 0.028, 0.035, tailCore, 1.0);
  } else {
    mb.addBox( halfW * 0.62, tlY, rearZ - 0.028, 0.44, 0.12, 0.04, tailBright, 1.0);
    mb.addBox(-halfW * 0.62, tlY, rearZ - 0.028, 0.44, 0.12, 0.04, tailBright, 1.0);
  }
  // Crisp White Illuminated Japanese Rear License Plate (東京 11-23)
  mb.addBox(0, y0 + 0.28, rearZ - 0.024, 0.34, 0.17, 0.025, [0.95, 0.96, 0.92], 0.82);

  // 7. Chrome / Titanium Exhaust Tips
  if (style === 'compact') {
    mb.addBox(-halfW * 0.52, y0 + 0.06, rearZ - 0.07, 0.10, 0.10, 0.16, chrome, 0.34);
  } else if (style === 'hypercar') {
    [-0.18, -0.06, 0.06, 0.18].forEach(ox => {
      mb.addBox(ox, y0 + 0.36, rearZ - 0.07, 0.085, 0.085, 0.18, [0.65, 0.78, 0.96], 0.34);
    });
  } else {
    [-0.50, 0.50].forEach(ox => {
      mb.addBox(ox * halfW, y0 + 0.06, rearZ - 0.08, 0.13, 0.12, 0.20, chrome, 0.34);
    });
  }

  // 8. Sculpted Rear Wing / Spoiler
  if (!isTraffic && wing !== 'none') {
    const wy = sts[sts.length - 2].yTop + 0.01;
    const wz = rearZ + 0.24;
    if (wing === 'lip') {
      mb.addBox(0, wy + 0.04, wz - 0.06, fullW * 0.86, 0.10, 0.18, body, 0.18);
    } else if (wing === 'gt' || wing === 'big') {
      const wH = wing === 'big' ? 0.42 : 0.26;
      const wW = wing === 'big' ? fullW * 1.04 : fullW * 0.92;
      mb.addBox( halfW * 0.52, wy + wH * 0.5, wz, 0.045, wH, 0.18, body, 0.18);
      mb.addBox(-halfW * 0.52, wy + wH * 0.5, wz, 0.045, wH, 0.18, body, 0.18);
      mb.addBox(0, wy + wH, wz - 0.04, wW, 0.05, 0.28, wing === 'big' ? carbon : body, 0.18);
      mb.addBox( wW * 0.5, wy + wH, wz - 0.04, 0.04, 0.22, 0.34, body, 0.18);
      mb.addBox(-wW * 0.5, wy + wH, wz - 0.04, 0.04, 0.22, 0.34, body, 0.18);
    }
  }

  // 9. Realistic Grounded Soft Contact Shadow under chassis
  mb.addQuad(
    [-halfW * 1.08, 0.032, rearZ - 0.14],
    [ halfW * 1.08, 0.032, rearZ - 0.14],
    [ halfW * 1.08, 0.032, frontZ + 0.14],
    [-halfW * 1.08, 0.032, frontZ + 0.14],
    [0.008, 0.01, 0.015], [0,0],[1,0],[1,1],[0,1], 0.52
  );

  // 10. Four 24-Segment Gloss Alloy Wheels with Brake Rotors, Calipers & Camber
  const wx = halfW - 0.04;
  const wr = prof.wr;
  mb.addRealisticWheel( wx, wr, prof.fz, wr, 0.27, rim, rimAcc, caliper, camber);
  mb.addRealisticWheel(-wx, wr, prof.fz, wr, 0.27, rim, rimAcc, caliper, camber);
  mb.addRealisticWheel( wx, wr, prof.rz, wr, 0.31, rim, rimAcc, caliper, camber * 1.12);
  mb.addRealisticWheel(-wx, wr, prof.rz, wr, 0.31, rim, rimAcc, caliper, camber * 1.12);

  return mb.build(gl);
}

// =========================================================================
// PHOTOREALISTIC RAINY TOKYO NIGHT SKY DOME & TOKYO TOWER
// =========================================================================
export function buildSkyDomeMesh(gl) {
  const mb = new MeshBuilder();
  const R = 380;
  const segs = 28;
  const rings = [
    { y: -25, r: R,       col: [0.025, 0.035, 0.052] },
    { y:  25, r: R,       col: [0.068, 0.088, 0.125] }, // Rain-cloud Shibuya urban light pollution bounce
    { y:  95, r: R * 0.88, col: [0.022, 0.032, 0.052] },
    { y: 195, r: R * 0.45, col: [0.012, 0.018, 0.032] },
    { y: 250, r: 2,       col: [0.008, 0.012, 0.024] }
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

  // Iconic Red-Orange Tokyo Tower Landmark on Horizon
  const tx = 140, tz = 310;
  mb.addBox(tx, 34, tz, 14, 72, 14, [0.96, 0.30, 0.14], 0.90);
  mb.addBox(tx, 76, tz, 16, 6, 16, [1.0, 0.94, 0.84], 1.0);
  mb.addBox(tx, 114, tz, 5, 70, 5, [0.96, 0.34, 0.16], 0.92);
  mb.addBox(tx, 158, tz, 1.4, 24, 1.4, [1.0, 0.86, 0.78], 1.0);

  return mb.build(gl);
}

// =========================================================================
// PHOTOREALISTIC SHIBUYA CROSSING WORLD MESHES (Includes Iconic Shibuya 109 Cylinder Landmark!)
// =========================================================================
export function buildWorldMeshes(gl, world) {
  const pts = world.points;
  const N = world.N;
  const w = world.cfg.roadHalfWidth;

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

    const col = (i === 0 || i === 1) ? [1.15, 1.18, 1.22] : [1, 1, 1];
    roadMB.addQuad(l0, r0, r1, l1, col, [0, vCoord], [1, vCoord], [1, vNext], [0, vNext], (i === 0 ? 0.20 : 0));
    vCoord = vNext;
  }

  // 2. ENVIRONMENT STRUCTURES (Sidewalks, Galvanized Steel Guardrails, Crosswalks, Traffic Lights, Tunnels, Bridges)
  const envMB = new MeshBuilder();
  const steelRail = [0.36, 0.40, 0.46];
  const curbConcrete = [0.20, 0.23, 0.28];
  const sidewalkCol = [0.14, 0.16, 0.20];
  const curbRed = [0.78, 0.14, 0.18];
  const curbWhite = [0.90, 0.92, 0.96];
  const tunnelWall = [0.13, 0.15, 0.19];
  const tunnelLight = [1.0, 0.88, 0.66];

  for (let i = 0; i < N; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % N];
    const isSharp = Math.abs(p0.curv) > 0.028;
    const rw = w + 0.9;

    [-1, 1].forEach(side => {
      const x0 = p0.x + p0.lx * side * rw, z0 = p0.z + p0.lz * side * rw;
      const x1 = p1.x + p1.lx * side * rw, z1 = p1.z + p1.lz * side * rw;

      // Sidewalk Deck outside road curb (makes Shibuya feel like a real dense city street!)
      if (!p0.isBridge && !p0.isTunnel && world.cfg.theme !== 'touge') {
        const sw0 = [p0.x + p0.lx * side * (rw + 5.5), p0.y + 0.18, p0.z + p0.lz * side * (rw + 5.5)];
        const sw1 = [p1.x + p1.lx * side * (rw + 5.5), p1.y + 0.18, p1.z + p1.lz * side * (rw + 5.5)];
        const in0 = [x0, p0.y + 0.18, z0];
        const in1 = [x1, p1.y + 0.18, z1];
        if (side > 0) envMB.addQuad(in0, sw0, sw1, in1, sidewalkCol, [0,0],[1,0],[1,1],[0,1], 0.08);
        else envMB.addQuad(sw0, in0, in1, sw1, sidewalkCol, [0,0],[1,0],[1,1],[0,1], 0.08);
      }

      const b0 = [x0, p0.y, z0], b1 = [x1, p1.y, z1];
      const t0 = [x0, p0.y + 0.88, z0], t1 = [x1, p1.y + 0.88, z1];
      if (side > 0) envMB.addQuad(b0, b1, t1, t0, curbConcrete, [0,0],[1,0],[1,1],[0,1], 0.06);
      else envMB.addQuad(b1, b0, t0, t1, curbConcrete, [0,0],[1,0],[1,1],[0,1], 0.06);

      const n0 = [x0, p0.y + 0.92, z0], n1 = [x1, p1.y + 0.92, z1];
      const n0b = [x0, p0.y + 0.58, z0], n1b = [x1, p1.y + 0.58, z1];
      const beamCol = isSharp ? (i % 2 === 0 ? curbRed : curbWhite) : steelRail;
      const beamMat = isSharp ? 0.32 : 0.18;
      if (side > 0) envMB.addQuad(n0b, n1b, n1, n0, beamCol, [0,0],[1,0],[1,1],[0,1], beamMat);
      else envMB.addQuad(n1b, n0b, n0, n1, beamCol, [0,0],[1,0],[1,1],[0,1], beamMat);

      if (i % 6 === 0) {
        envMB.addBox(x0, p0.y + 0.94, z0, 0.22, 0.12, 0.22, side > 0 ? [1.0, 0.78, 0.22] : [0.95, 0.97, 1.0], 0.95);
      }
    });

    // Shibuya Scramble White Pedestrian Crosswalk + Japanese Traffic Signal
    if (world.cfg.theme === 'shibuya' && !p0.isTunnel && !p0.isBridge && (i === 4 || i === 18 || i % 42 === 0)) {
      const stripeCount = 9;
      for (let s = 0; s < stripeCount; s++) {
        const u = -w + 1.2 + (s / (stripeCount - 1)) * (w * 2 - 2.4);
        const cx = p0.x + p0.lx * u;
        const cz = p0.z + p0.lz * u;
        const fx = p0.tx * 2.4, fz = p0.tz * 2.4;
        const swx = p0.lx * 0.48, swz = p0.lz * 0.48;
        const cy = p0.y + 0.025;
        envMB.addQuad(
          [cx - fx - swx, cy, cz - fz - swz], [cx - fx + swx, cy, cz - fz + swz],
          [cx + fx + swx, cy, cz + fz + swz], [cx + fx - swx, cy, cz + fz - swz],
          [0.88, 0.91, 0.96], [0,0],[1,0],[1,1],[0,1], 0.22
        );
      }
      const tx = p0.x + p0.lx * (w + 2.2), tz = p0.z + p0.lz * (w + 2.2);
      envMB.addBox(tx, p0.y + 3.2, tz, 0.26, 6.4, 0.26, [0.22, 0.25, 0.30]);
      envMB.addBox(tx - p0.lx * 2.4, p0.y + 5.8, tz - p0.lz * 2.4, 1.85, 0.54, 0.42, [0.10, 0.12, 0.15]);
      envMB.addBox(tx - p0.lx * 2.0, p0.y + 5.8, tz - p0.lz * 2.0, 0.38, 0.38, 0.48, i % 84 === 0 ? [0.14, 0.95, 0.46] : [1.0, 0.14, 0.14], 1.0);
    }

    if (p0.isBridge && i % 6 === 0 && p0.y > 1.5) {
      envMB.addBox(p0.x, p0.y * 0.5 - 0.5, p0.z, 3.2, p0.y + 1.0, 3.2, [0.18, 0.20, 0.24]);
    }

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
  envMB.addBox(sp.x + sp.lx * gw, sp.y + 4.5, sp.z + sp.lz * gw, 0.8, 9.0, 0.8, steelRail);
  envMB.addBox(sp.x - sp.lx * gw, sp.y + 4.5, sp.z - sp.lz * gw, 0.8, 9.0, 0.8, steelRail);
  envMB.addBox(sp.x, sp.y + 8.6, sp.z, w * 2.1, 0.45, 0.55, [0.12, 0.15, 0.20]);
  envMB.addBox(sp.x, sp.y + 8.35, sp.z, w * 1.5, 0.20, 0.40, [0.98, 0.99, 1.0], 1.0);

  // Clipping Zone Markers
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

  // Street Lamps with Arm + Warm/Cool LED Fixture
  for (const l of world.lamps) {
    envMB.addBox(l.x, l.y + 4.1, l.z, 0.22, 8.2, 0.22, [0.22, 0.26, 0.32]);
    envMB.addBox(l.x, l.y + 8.2, l.z, 1.4, 0.20, 0.72, [1.0, 0.96, 0.90], 1.0);
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

  // 3. SHIBUYA COMMERCIAL TOWERS + ICONIC CYLINDRICAL SHIBUYA 109 LANDMARK!
  const bldgMB = new MeshBuilder();
  if (world.cfg.theme === 'shibuya') {
    // Iconic Cylindrical Shibuya Landmark Tower straight ahead of the Start Intersection (like Image #1!)
    bldgMB.addCylinderY(18, -1.5, 48, 86, 8.2, 8.2, 18, [1, 1, 1], 0.08, [2, 2]);
    // Glowing red rooftop landmark crown sign
    envMB.addBox(18, 51, 86, 7.5, 4.8, 7.5, [0.96, 0.18, 0.14], 0.98);
  }

  for (let idx = 0; idx < world.buildings.length; idx++) {
    const b = world.buildings[idx];
    if (b.type === 'tree') {
      envMB.addBox(b.x, b.y + 2.5, b.z, 0.9, 5.0, 0.9, [0.20, 0.14, 0.10]);
      const leafCol = b.isSakura ? [0.78, 0.44, 0.56] : [0.06, 0.17, 0.15];
      envMB.addBox(b.x, b.y + 3.5 + (b.h - 3.5) * 0.5, b.z, b.w * 0.7, b.h - 3.5, b.d * 0.7, leafCol, 0.0);
    } else {
      if (idx % 9 === 0 && b.w > 13) {
        // Cylindrical glass commercial tower variety
        bldgMB.addCylinderY(b.x, b.y, b.y + b.h, b.z, b.w * 0.46, b.w * 0.46, 14, [1, 1, 1], 0.08, [2, Math.max(1, Math.round(b.h / 18))]);
      } else {
        bldgMB.addBox(b.x, b.y + b.h * 0.5, b.z, b.w, b.h, b.d, [1, 1, 1], 0.06, [1, Math.max(1, Math.round(b.h / 16))]);
      }
      envMB.addBox(b.x, b.y + b.h + 0.4, b.z, b.w + 0.2, 0.65, b.d + 0.2, [0.16, 0.19, 0.24]);
      if (b.h > 44) {
        envMB.addBox(b.x, b.y + b.h + 5.5, b.z, 0.32, 10.0, 0.32, [0.35, 0.4, 0.48]);
        envMB.addBox(b.x, b.y + b.h + 10.8, b.z, 0.85, 0.85, 0.85, [1.0, 0.12, 0.16], 1.0);
      }
      if (b.hasBillboard) {
        const nc = hexToRgb01(b.neonColor);
        envMB.addBox(b.x, b.y + b.h + 2.4, b.z, b.w * 0.52, 3.2, 0.55, nc, 0.92);
      }
    }
  }

  // 4. DARK WET URBAN GROUND PLANE
  const groundMB = new MeshBuilder();
  const gS = 950;
  const gCol = world.cfg.theme === 'touge' ? [0.03, 0.045, 0.05] : [0.02, 0.026, 0.038];
  groundMB.addQuad([-gS, -4.2, -gS], [-gS, -4.2, gS], [gS, -4.2, gS], [gS, -4.2, -gS], gCol);

  return {
    sky: buildSkyDomeMesh(gl),
    road: roadMB.build(gl),
    env: envMB.build(gl),
    buildings: bldgMB.build(gl),
    ground: groundMB.build(gl)
  };
}
