// Next-Gen Mobile PBR-Lite WebGL 3D Renderer: Metallic Car Clearcoat, Fresnel City Reflections, ACES Tone Mapping, Wet Asphalt Reflections, Dual Headlights & Brake Road Glow

import { Mat4 } from './math.js';

const MAIN_VS = `
  attribute vec3 aPos;
  attribute vec3 aNorm;
  attribute vec2 aUV;
  attribute vec4 aCol;

  uniform mat4 uProjView;
  uniform mat4 uModel;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying vec4 vCol;

  void main() {
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(uModel) * aNorm);
    vUV = aUV;
    vCol = aCol;
    gl_Position = uProjView * wp;
  }
`;

const MAIN_FS = `
  precision mediump float;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec2 vUV;
  varying vec4 vCol;

  uniform sampler2D uTex;
  uniform float uUseTex;
  uniform float uWetness;
  uniform float uIsSky;
  uniform vec3 uCamPos;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uHeadlightPos;
  uniform vec3 uHeadlightDir;
  uniform vec3 uUnderglowPos;
  uniform vec3 uUnderglowCol;
  uniform float uBrakeBoost;
  uniform float uTime;
  uniform float uReflStrength;
  uniform float uDynamicLights;
  uniform float uColorStyle;

  // Photorealistic Rainy Shibuya Night Environment Reflection Map (metallic clearcoat, glass & wet puddles!)
  vec3 sampleTokyoEnv(vec3 R) {
    float horizon = clamp(1.0 - abs(R.y) * 2.1, 0.0, 1.0);
    float band1 = sin(R.x * 8.0 + R.z * 5.0) * 0.5 + 0.5;
    float band2 = cos(R.x * 13.0 - R.z * 9.0) * 0.5 + 0.5;
    vec3 skyTop = vec3(0.025, 0.04, 0.075);

    vec3 cityGlow;
    if (uColorStyle < 0.5) {
      // Estilo 1 — Fotorrealista Noturno (Shibuya Chuva): reflexos naturais azul-prata, branco de rua e toque sutil de letreiro vermelho
      vec3 coolWhite = vec3(0.68, 0.80, 0.98);
      vec3 warmShop  = vec3(0.96, 0.78, 0.54);
      vec3 signRed   = vec3(0.85, 0.18, 0.22) * pow(band2, 5.0);
      cityGlow = mix(coolWhite, warmShop, band1) * 0.68 + signRed * 0.24;
    } else if (uColorStyle < 1.5) {
      // Tóquio Neon Clássico
      cityGlow = mix(vec3(1.0, 0.20, 0.58), vec3(0.14, 0.86, 1.0), band1) * 0.88;
    } else {
      // Cyberpunk Intenso
      cityGlow = mix(vec3(1.18, 0.10, 0.65), vec3(0.06, 1.08, 1.18), band1);
    }

    vec3 env = mix(skyTop, cityGlow, pow(horizon, 1.45));
    // Crisp white overhead streetlamp reflection ribbons across glossy car hood & roof
    float lampStreak = pow(max(0.0, sin(R.x * 16.0 + R.z * 16.0)), 16.0) * smoothstep(0.04, 0.78, R.y);
    env += vec3(0.92, 0.96, 1.0) * lampStreak * 1.1;
    return env;
  }

  vec3 acesToneMap(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  vec3 applyColorGrade(vec3 c) {
    vec3 mapped = acesToneMap(c);
    float luma = dot(mapped, vec3(0.299, 0.587, 0.114));
    if (uColorStyle < 0.5) {
      // Fotorrealista Noturno: contraste cinematográfico profundo, leve tom azulado chuvoso nas sombras
      mapped = mix(vec3(luma), mapped, 0.96);
      mapped = pow(clamp(mapped, 0.0, 1.0), vec3(1.03, 1.01, 0.97));
    } else if (uColorStyle >= 1.5) {
      mapped = mix(vec3(luma), mapped, 1.28);
      mapped = pow(clamp(mapped, 0.0, 1.0), vec3(0.94));
    }
    return clamp(mapped, 0.0, 1.0);
  }

  void main() {
    if (uIsSky > 0.5) {
      vec3 skyC = vCol.rgb;
      gl_FragColor = vec4(applyColorGrade(skyC * 1.05), 1.0);
      return;
    }

    vec3 baseCol = vCol.rgb;
    float matCode = vCol.a;
    float emissive = 0.0;

    if (matCode > 0.65) {
      emissive = (matCode - 0.65) / 0.35;
    }

    if (uUseTex > 0.5) {
      vec4 texel = texture2D(uTex, vUV);
      baseCol *= texel.rgb;
      emissive = max(emissive, texel.a * 0.96);
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);
    float NoV = max(dot(N, V), 0.001);

    // Photorealistic Shibuya wet night multi-source street lighting (cool rainy sky + warm commercial glow)
    vec3 L1 = normalize(vec3(0.38, 0.88, 0.32));
    vec3 L2 = normalize(vec3(-0.62, 0.42, -0.52));
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);

    vec3 hemi = mix(vec3(0.055, 0.07, 0.105), vec3(0.24, 0.31, 0.44), N.y * 0.5 + 0.5);
    vec3 lit = baseCol * (hemi + vec3(0.78, 0.84, 0.96) * diff1 + vec3(0.36, 0.28, 0.24) * diff2);

    bool isCarPaint = (matCode > 0.13 && matCode < 0.28);
    bool isGlass    = (matCode >= 0.28 && matCode < 0.44);
    bool isMatte    = (matCode >= 0.44 && matCode <= 0.65);

    vec3 R = reflect(-V, N);
    float fresnel = pow(1.0 - NoV, 3.8);

    if (isCarPaint) {
      vec3 H1 = normalize(L1 + V);
      vec3 H2 = normalize(L2 + V);
      float baseSpec = pow(max(dot(N, H1), 0.0), 32.0) * 0.62;
      float clearcoat = (pow(max(dot(N, H1), 0.0), 128.0) * 1.45 + pow(max(dot(N, H2), 0.0), 72.0) * 0.55) * max(0.35, uReflStrength);
      if (uReflStrength > 0.05) {
        vec3 envRefl = sampleTokyoEnv(R);
        lit = mix(lit, lit * 0.58 + envRefl * (0.48 + baseCol * 0.52), (0.24 + fresnel * 0.72) * clamp(uReflStrength, 0.0, 1.25));
      }
      lit += mix(baseCol, vec3(1.0), 0.45) * baseSpec + vec3(1.0, 0.99, 0.97) * clearcoat;
    } else if (isGlass) {
      vec3 H1 = normalize(L1 + V);
      float glassSpec = pow(max(dot(N, H1), 0.0), 140.0) * 1.5;
      if (uReflStrength > 0.05) {
        vec3 envRefl = sampleTokyoEnv(R);
        lit = mix(baseCol * 0.35, envRefl * 1.2, (0.38 + fresnel * 0.58) * clamp(uReflStrength, 0.0, 1.15)) + vec3(0.96, 0.98, 1.0) * glassSpec;
      } else {
        lit = baseCol * 0.6 + vec3(0.85, 0.92, 1.0) * glassSpec * 0.5;
      }
    } else if (!isMatte) {
      vec3 H1 = normalize(L1 + V);
      float specPow = mix(24.0, 88.0, uWetness);
      float spec = pow(max(dot(N, H1), 0.0), specPow) * mix(0.18, 1.1, uWetness);
      lit += vec3(0.82, 0.90, 1.0) * spec;

      // Photorealistic Rain Puddle Mirror Reflections across Shibuya wet asphalt!
      if (uWetness > 0.1 && N.y > 0.85 && uReflStrength > 0.05) {
        float pNoise = sin(vWorldPos.x * 0.18) * cos(vWorldPos.z * 0.15) + 0.5 * sin((vWorldPos.x - vWorldPos.z) * 0.27);
        float puddle = smoothstep(-0.15, 0.65, pNoise);
        vec3 roadRefl = sampleTokyoEnv(R);
        lit += roadRefl * (0.18 + fresnel * 0.72) * uWetness * (0.38 + puddle * 0.68) * uReflStrength;
      }
    }

    if (uDynamicLights > 0.5) {
      // Intense Xenon White Headlight Beam stretching forward across wet road
      vec3 toFrag = vWorldPos - uHeadlightPos;
      float distH = length(toFrag);
      if (distH < 64.0 && distH > 0.5) {
        vec3 dirToFrag = toFrag / distH;
        float cone = dot(dirToFrag, normalize(uHeadlightDir));
        float spot = smoothstep(0.60, 0.94, cone) * pow(1.0 - distH / 64.0, 1.25);
        lit += (baseCol * 1.2 + vec3(0.16, 0.18, 0.22) * uWetness) * vec3(0.96, 0.98, 1.0) * spot * 1.75;
      }

      // Directional Crimson LED Taillight & Brake Light Reflection strictly behind the rear bumper on wet asphalt
      vec3 fwdXZ = normalize(vec3(uHeadlightDir.x, 0.0, uHeadlightDir.z));
      vec3 rearPos = uUnderglowPos - fwdXZ * 2.1;
      vec3 toRear = vWorldPos - rearPos;
      float distR = length(toRear);
      if (distR < 9.5 && distR > 0.2 && N.y > 0.72) {
        float rearCone = smoothstep(0.12, 0.78, dot(toRear / distR, -fwdXZ));
        float falloffR = pow(1.0 - distR / 9.5, 1.7) * rearCone;
        float tailStrength = (0.55 + uBrakeBoost * 1.25) * (0.45 + uWetness * 0.95);
        lit += vec3(1.0, 0.06, 0.10) * falloffR * tailStrength;
      }

      // Subtle Underglow (only strong in Neon/Cyberpunk styles; subtle ground reflection in Photorealistic)
      float distU = length(vWorldPos - uUnderglowPos);
      if (distU < 5.5 && N.y > 0.72 && uColorStyle > 0.5) {
        float f2 = pow(1.0 - distU / 5.5, 2.0);
        lit += uUnderglowCol * f2 * (0.65 + uWetness * 0.6);
      }
    }

    vec3 finalCol = mix(lit, baseCol * (1.42 + uBrakeBoost * 0.85), clamp(emissive, 0.0, 1.0));

    float distCam = length(uCamPos - vWorldPos);
    float fogFactor = clamp(1.0 - exp(-pow(distCam * uFogDensity, 1.55)), 0.0, 0.90);
    finalCol = mix(finalCol, uFogColor, fogFactor);

    gl_FragColor = vec4(applyColorGrade(finalCol), 1.0);
  }
`;

const PARTICLE_VS = `
  attribute vec3 aPos;
  attribute vec4 aCol;
  attribute float aSize;

  uniform mat4 uProjView;
  uniform float uPixelRatio;

  varying vec4 vCol;

  void main() {
    vCol = aCol;
    vec4 clip = uProjView * vec4(aPos, 1.0);
    gl_Position = clip;
    float dist = max(1.5, clip.w);
    gl_PointSize = clamp((aSize * 340.0 * uPixelRatio) / dist, 2.0, 96.0);
  }
`;

const PARTICLE_FS = `
  precision mediump float;
  varying vec4 vCol;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = length(c);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.08, r);
    gl_FragColor = vec4(vCol.rgb, vCol.a * soft);
  }
`;

const SKID_VS = `
  attribute vec3 aPos;
  attribute float aAlpha;
  uniform mat4 uProjView;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    gl_Position = uProjView * vec4(aPos, 1.0);
  }
`;

const SKID_FS = `
  precision mediump float;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(0.02, 0.02, 0.04, vAlpha);
  }
`;

function compileShader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('Shader error: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function createProgram(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compileShader(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compileShader(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  }
  return p;
}

export class TokyoRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    }) || canvas.getContext('experimental-webgl');

    if (!gl) throw new Error('WebGL não suportado neste dispositivo.');
    this.gl = gl;
    gl.getExtension('OES_element_index_uint');

    this.mainProg = createProgram(gl, MAIN_VS, MAIN_FS);
    this.partProg = createProgram(gl, PARTICLE_VS, PARTICLE_FS);
    this.skidProg = createProgram(gl, SKID_VS, SKID_FS);

    this._cacheLocations();
    this.roadTex = this._createAsphaltTexture();
    this.bldgTex = this._createTokyoFacadeTexture();

    this.maxParticles = 650;
    this.partPosData = new Float32Array(this.maxParticles * 3);
    this.partColData = new Float32Array(this.maxParticles * 4);
    this.partSizeData = new Float32Array(this.maxParticles);
    this.partPosBuf = gl.createBuffer();
    this.partColBuf = gl.createBuffer();
    this.partSizeBuf = gl.createBuffer();

    this.maxSkidQuads = 500;
    this.skidPosData = new Float32Array(this.maxSkidQuads * 6 * 3);
    this.skidAlphaData = new Float32Array(this.maxSkidQuads * 6);
    this.skidPosBuf = gl.createBuffer();
    this.skidAlphaBuf = gl.createBuffer();

    this.proj = Mat4.create();
    this.view = Mat4.create();
    this.projView = Mat4.create();
    this.identity = Mat4.create();
    this.tmpModel = Mat4.create();

    this.dpr = 1;
    this.width = 1;
    this.height = 1;
    this.time = 0;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
  }

  _cacheLocations() {
    const gl = this.gl;
    const mp = this.mainProg;
    this.mLoc = {
      aPos: gl.getAttribLocation(mp, 'aPos'),
      aNorm: gl.getAttribLocation(mp, 'aNorm'),
      aUV: gl.getAttribLocation(mp, 'aUV'),
      aCol: gl.getAttribLocation(mp, 'aCol'),
      uProjView: gl.getUniformLocation(mp, 'uProjView'),
      uModel: gl.getUniformLocation(mp, 'uModel'),
      uTex: gl.getUniformLocation(mp, 'uTex'),
      uUseTex: gl.getUniformLocation(mp, 'uUseTex'),
      uWetness: gl.getUniformLocation(mp, 'uWetness'),
      uIsSky: gl.getUniformLocation(mp, 'uIsSky'),
      uCamPos: gl.getUniformLocation(mp, 'uCamPos'),
      uFogColor: gl.getUniformLocation(mp, 'uFogColor'),
      uFogDensity: gl.getUniformLocation(mp, 'uFogDensity'),
      uHeadlightPos: gl.getUniformLocation(mp, 'uHeadlightPos'),
      uHeadlightDir: gl.getUniformLocation(mp, 'uHeadlightDir'),
      uUnderglowPos: gl.getUniformLocation(mp, 'uUnderglowPos'),
      uUnderglowCol: gl.getUniformLocation(mp, 'uUnderglowCol'),
      uBrakeBoost: gl.getUniformLocation(mp, 'uBrakeBoost'),
      uTime: gl.getUniformLocation(mp, 'uTime'),
      uReflStrength: gl.getUniformLocation(mp, 'uReflStrength'),
      uDynamicLights: gl.getUniformLocation(mp, 'uDynamicLights'),
      uColorStyle: gl.getUniformLocation(mp, 'uColorStyle')
    };

    const pp = this.partProg;
    this.pLoc = {
      aPos: gl.getAttribLocation(pp, 'aPos'),
      aCol: gl.getAttribLocation(pp, 'aCol'),
      aSize: gl.getAttribLocation(pp, 'aSize'),
      uProjView: gl.getUniformLocation(pp, 'uProjView'),
      uPixelRatio: gl.getUniformLocation(pp, 'uPixelRatio')
    };

    const sp = this.skidProg;
    this.sLoc = {
      aPos: gl.getAttribLocation(sp, 'aPos'),
      aAlpha: gl.getAttribLocation(sp, 'aAlpha'),
      uProjView: gl.getUniformLocation(sp, 'uProjView')
    };
  }

  _uploadCanvasTexture(c) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  // Photorealistic Rain-Soaked Shibuya Asphalt Texture (deep wet charcoal + polished tire lanes + crisp markings)
  _createAsphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    const img = g.createImageData(512, 512);
    const d = img.data;

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const grain = Math.abs((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1);
        const fine = Math.abs((Math.sin(x * 41.3 + y * 19.7) * 19283.23) % 1);
        const trackL = Math.exp(-Math.pow((x - 140) / 52, 2)) + Math.exp(-Math.pow((x - 372) / 52, 2));
        const n = grain * 11 + fine * 6 - trackL * 6;
        let r = 22 + n, gr = 25 + n, b = 33 + n, em = 0;

        // Crisp reflective white outer curb lines
        if ((x >= 14 && x <= 26) || (x >= 486 && x <= 498)) {
          r = 232; gr = 238; b = 248; em = 115;
        }
        // Subtle dashed white/amber center markings (authentic Japanese urban avenue)
        if (((x >= 248 && x <= 254) || (x >= 258 && x <= 264)) && (y % 128) < 76) {
          r = 248; gr = 196; b = 68; em = 130;
        }
        // Dashed lane guides
        if (((x >= 132 && x <= 138) || (x >= 374 && x <= 380)) && (y % 128) < 46) {
          r = 205; gr = 215; b = 230; em = 65;
        }

        d[idx] = Math.max(0, Math.min(255, r));
        d[idx + 1] = Math.max(0, Math.min(255, gr));
        d[idx + 2] = Math.max(0, Math.min(255, b));
        d[idx + 3] = em;
      }
    }
    g.putImageData(img, 0, 0);
    return this._uploadCanvasTexture(c);
  }

  // Authentic Photorealistic Shibuya Crossing Commercial Skyscraper Facades & Japanese Signage
  _createTokyoFacadeTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');

    g.fillStyle = '#0d1118';
    g.fillRect(0, 0, 512, 512);

    // Concrete / dark steel architectural floor plates & mullions
    g.fillStyle = '#18202c';
    for (let y = 0; y < 512; y += 42) g.fillRect(0, y, 512, 6);
    for (let x = 0; x < 512; x += 64) g.fillRect(x, 0, 5, 512);

    // Realistic warm office, fluorescent white, cool blue LED & dark unlit windows
    const winColors = ['#fef3c7', '#e0f2fe', '#fed7aa', '#cbd5e1', '#bae6fd', '#0f1520', '#0f1520', '#111827', '#1e293b'];
    let seed = 91;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 10 + col * 64;
        const y = 11 + row * 42;
        const wCol = winColors[Math.floor(rand() * winColors.length)];
        g.fillStyle = wCol;
        g.fillRect(x, y, 48, 25);
        g.fillStyle = 'rgba(10, 14, 22, 0.36)';
        g.fillRect(x, y, 48, 7);
      }
    }

    // Authentic Shibuya Commercial Vertical & Horizontal Japanese Signboards (red, white, blue, gold)
    const signs = [
      { x: 18,  y: 52,  w: 64,  h: 228, bg: '#dc2626', fg: '#ffffff', text: '渋谷', vert: true },
      { x: 400, y: 98,  w: 64,  h: 262, bg: '#f8fafc', fg: '#0f172a', text: 'ラーメン', vert: true },
      { x: 106, y: 344, w: 274, h: 74,  bg: '#1d4ed8', fg: '#ffffff', text: '渋谷スクランブル', vert: false },
      { x: 112, y: 24,  w: 256, h: 54,  bg: '#f59e0b', fg: '#0f172a', text: '東京・駐車場', vert: false }
    ];

    for (const s of signs) {
      g.fillStyle = s.bg;
      g.fillRect(s.x, s.y, s.w, s.h);
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 3;
      g.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4);
      g.fillStyle = s.fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (s.vert) {
        g.font = `900 ${s.text.length > 2 ? 32 : 40}px sans-serif`;
        const step = (s.h - 36) / s.text.length;
        for (let i = 0; i < s.text.length; i++) {
          g.fillText(s.text[i], s.x + s.w * 0.5, s.y + 24 + step * (i + 0.45));
        }
      } else {
        g.font = '900 28px sans-serif';
        g.fillText(s.text, s.x + s.w * 0.5, s.y + s.h * 0.52);
      }
    }

    const img = g.getImageData(0, 0, 512, 512);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
      d[i + 3] = lum > 58 ? Math.min(255, Math.floor((lum - 46) * 1.45)) : 0;
    }
    g.putImageData(img, 0, 0);
    return this._uploadCanvasTexture(c);
  }

  resize(width, height, qualityScale = 1.0) {
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = Math.max(0.75, rawDpr * qualityScale);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  beginFrame(camPos, camTarget, fovRad, skyCol, fogCol, fogDensity, headlightPos, headlightDir, underglowPos, underglowCol, wetness, brakeRoadGlow = 0, gfxOpts = {}) {
    const gl = this.gl;
    this.time += 0.016;
    gl.clearColor(skyCol[0], skyCol[1], skyCol[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const farPlane = gfxOpts.drawDistance || 520.0;
    Mat4.perspective(this.proj, fovRad, this.width / this.height, 0.35, farPlane);
    Mat4.lookAt(this.view, camPos, camTarget, [0, 1, 0]);
    Mat4.multiply(this.projView, this.proj, this.view);

    gl.useProgram(this.mainProg);
    gl.uniformMatrix4fv(this.mLoc.uProjView, false, this.projView);
    gl.uniform3fv(this.mLoc.uCamPos, camPos);
    gl.uniform3fv(this.mLoc.uFogColor, fogCol);
    gl.uniform1f(this.mLoc.uFogDensity, fogDensity);
    gl.uniform3fv(this.mLoc.uHeadlightPos, headlightPos);
    gl.uniform3fv(this.mLoc.uHeadlightDir, headlightDir);
    gl.uniform3fv(this.mLoc.uUnderglowPos, underglowPos);
    gl.uniform3fv(this.mLoc.uUnderglowCol, underglowCol);
    gl.uniform1f(this.mLoc.uWetness, wetness);
    gl.uniform1f(this.mLoc.uBrakeBoost, brakeRoadGlow);
    gl.uniform1f(this.mLoc.uIsSky, 0.0);
    gl.uniform1f(this.mLoc.uTime, this.time);
    gl.uniform1f(this.mLoc.uReflStrength, gfxOpts.reflStrength ?? 1.0);
    gl.uniform1f(this.mLoc.uDynamicLights, gfxOpts.dynamicLights === false ? 0.0 : 1.0);
    gl.uniform1f(this.mLoc.uColorStyle, gfxOpts.colorStyle ?? 0.0);
  }

  drawSkyDome(skyMesh, camPos) {
    const gl = this.gl;
    gl.depthMask(false);
    gl.useProgram(this.mainProg);
    gl.uniform1f(this.mLoc.uIsSky, 1.0);
    Mat4.fromTRS(this.tmpModel, camPos[0], 0, camPos[2], 0, 0, 0, 1, 1, 1);
    this.drawMesh(skyMesh, this.tmpModel, null, 0, 0);
    gl.uniform1f(this.mLoc.uIsSky, 0.0);
    gl.depthMask(true);
  }

  drawMesh(mesh, modelMat, texture = null, wetnessOverride = null, brakeBoost = 0) {
    const gl = this.gl;
    const L = this.mLoc;
    gl.useProgram(this.mainProg);
    gl.uniformMatrix4fv(L.uModel, false, modelMat || this.identity);
    gl.uniform1f(L.uBrakeBoost, brakeBoost);

    if (wetnessOverride !== null) {
      gl.uniform1f(L.uWetness, wetnessOverride);
    }

    if (texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(L.uTex, 0);
      gl.uniform1f(L.uUseTex, 1.0);
    } else {
      gl.uniform1f(L.uUseTex, 0.0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuf);
    gl.enableVertexAttribArray(L.aPos);
    gl.vertexAttribPointer(L.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuf);
    gl.enableVertexAttribArray(L.aNorm);
    gl.vertexAttribPointer(L.aNorm, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuf);
    gl.enableVertexAttribArray(L.aUV);
    gl.vertexAttribPointer(L.aUV, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colBuf);
    gl.enableVertexAttribArray(L.aCol);
    gl.vertexAttribPointer(L.aCol, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuf);
    gl.drawElements(gl.TRIANGLES, mesh.count, mesh.idxType, 0);
  }

  drawSkids(skids) {
    if (!skids || skids.length === 0) return;
    const gl = this.gl;
    const count = Math.min(skids.length, this.maxSkidQuads);
    let pOff = 0, aOff = 0;

    for (let i = skids.length - count; i < skids.length; i++) {
      const s = skids[i];
      const verts = [s.a, s.b, s.c, s.a, s.c, s.d];
      for (let v = 0; v < 6; v++) {
        this.skidPosData[pOff++] = verts[v][0];
        this.skidPosData[pOff++] = verts[v][1];
        this.skidPosData[pOff++] = verts[v][2];
        this.skidAlphaData[aOff++] = s.alpha;
      }
    }

    gl.useProgram(this.skidProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    gl.uniformMatrix4fv(this.sLoc.uProjView, false, this.projView);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skidPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.skidPosData.subarray(0, pOff), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.sLoc.aPos);
    gl.vertexAttribPointer(this.sLoc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skidAlphaBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.skidAlphaData.subarray(0, aOff), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.sLoc.aAlpha);
    gl.vertexAttribPointer(this.sLoc.aAlpha, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, aOff);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawParticles(particles) {
    if (!particles || particles.length === 0) return;
    const gl = this.gl;
    const count = Math.min(particles.length, this.maxParticles);
    let pOff = 0, cOff = 0;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      this.partPosData[pOff++] = p.x;
      this.partPosData[pOff++] = p.y;
      this.partPosData[pOff++] = p.z;

      const lifeRatio = Math.max(0, p.life / p.maxLife);
      this.partColData[cOff++] = p.r;
      this.partColData[cOff++] = p.g;
      this.partColData[cOff++] = p.b;
      this.partColData[cOff++] = p.a * lifeRatio;

      this.partSizeData[i] = p.size;
    }

    gl.useProgram(this.partProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    gl.uniformMatrix4fv(this.pLoc.uProjView, false, this.projView);
    gl.uniform1f(this.pLoc.uPixelRatio, this.dpr);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.partPosBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partPosData.subarray(0, pOff), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.pLoc.aPos);
    gl.vertexAttribPointer(this.pLoc.aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.partColBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partColData.subarray(0, cOff), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.pLoc.aCol);
    gl.vertexAttribPointer(this.pLoc.aCol, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.partSizeBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.partSizeData.subarray(0, count), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.pLoc.aSize);
    gl.vertexAttribPointer(this.pLoc.aSize, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, count);

    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
