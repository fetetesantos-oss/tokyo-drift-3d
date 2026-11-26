// Photorealistic WebGL 3D Renderer: FBO Selective Bloom + Wet Asphalt Micro-Bump Mirror Reflections + Dual Headlights/Taillights + 1024x1024 Shibuya Signage + Additive Glow Halos

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

  // High-contrast Photorealistic Rainy Shibuya Night Environment Map (used by car clearcoat, tinted glass & wet road puddles!)
  vec3 sampleShibuyaEnv(vec3 R, vec2 worldXZ) {
    float horizon = clamp(1.0 - abs(R.y) * 1.9, 0.0, 1.0);
    float b1 = sin(R.x * 9.0 + R.z * 6.0) * 0.5 + 0.5;
    float b2 = cos(R.x * 15.0 - R.z * 11.0) * 0.5 + 0.5;
    float b3 = sin(R.x * 23.0 + R.z * 17.0) * 0.5 + 0.5;

    vec3 skyTop = vec3(0.022, 0.036, 0.068);
    vec3 cityGlow;
    if (uColorStyle < 0.5) {
      // Photorealistic Rainy Shibuya Crossing: bright white LED screens, warm amber shops, vivid red Shibuya signs, cool blue storefronts!
      vec3 coolScreen = vec3(0.75, 0.88, 1.05) * smoothstep(0.3, 0.95, b1);
      vec3 warmShop   = vec3(1.05, 0.78, 0.45) * smoothstep(0.35, 0.95, 1.0 - b1);
      vec3 shibuyaRed = vec3(1.15, 0.16, 0.18) * pow(b2, 3.2);
      vec3 signBlue   = vec3(0.22, 0.58, 1.15) * pow(b3, 3.0);
      cityGlow = (coolScreen + warmShop) * 0.72 + shibuyaRed * 0.52 + signBlue * 0.42;
    } else if (uColorStyle < 1.5) {
      cityGlow = mix(vec3(1.0, 0.20, 0.58), vec3(0.14, 0.86, 1.0), b1) * 0.92;
    } else {
      cityGlow = mix(vec3(1.22, 0.10, 0.65), vec3(0.05, 1.12, 1.22), b1);
    }

    vec3 env = mix(skyTop, cityGlow, pow(horizon, 1.35));
    // Sharp overhead Shibuya streetlamp reflection ribbons across glossy hood, roof & wet asphalt
    float lampStreak = pow(max(0.0, sin(R.x * 18.0 + R.z * 14.0)), 14.0) * smoothstep(0.03, 0.82, R.y);
    env += vec3(0.96, 0.98, 1.0) * lampStreak * 1.25;
    return env;
  }

  void main() {
    if (uIsSky > 0.5) {
      gl_FragColor = vec4(vCol.rgb * 1.08, 1.0);
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
      emissive = max(emissive, texel.a * 0.98);
    }

    vec3 N = normalize(vNormal);
    vec3 V = normalize(uCamPos - vWorldPos);

    // Micro-bump wet asphalt normal perturbation for photorealistic rain-rippled vertical city reflections!
    bool isRoad = (uUseTex > 0.5 && N.y > 0.88 && matCode < 0.12);
    float puddleMask = 0.0;
    if (isRoad && uWetness > 0.1) {
      float p1 = sin(vWorldPos.x * 0.22) * cos(vWorldPos.z * 0.17);
      float p2 = sin((vWorldPos.x + vWorldPos.z) * 0.13) * 0.6;
      puddleMask = smoothstep(-0.22, 0.58, p1 + p2);
      float microX = sin(vWorldPos.x * 6.5 + vWorldPos.z * 3.1) * cos(vWorldPos.z * 7.2);
      float microZ = cos(vWorldPos.x * 5.8 - vWorldPos.z * 6.4);
      // Smooth mirror puddles have calmer normals; rougher damp asphalt scatters reflections realistically!
      float rough = mix(0.09, 0.018, puddleMask);
      N = normalize(vec3(N.x + microX * rough, N.y, N.z + microZ * rough));
    }

    float NoV = max(dot(N, V), 0.001);
    vec3 R = reflect(-V, N);
    float fresnel = pow(1.0 - NoV, 3.6);

    // Rich Shibuya Rainy Night Key + Rim Lighting
    vec3 L1 = normalize(vec3(0.36, 0.90, 0.28));
    vec3 L2 = normalize(vec3(-0.68, 0.38, -0.58));
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);

    vec3 hemi = mix(vec3(0.045, 0.058, 0.088), vec3(0.24, 0.32, 0.46), N.y * 0.5 + 0.5);
    vec3 lit = baseCol * (hemi + vec3(0.84, 0.90, 1.0) * diff1 + vec3(0.38, 0.30, 0.26) * diff2);

    bool isCarPaint = (matCode > 0.13 && matCode < 0.28);
    bool isGlass    = (matCode >= 0.28 && matCode < 0.44);
    bool isMatte    = (matCode >= 0.44 && matCode <= 0.65);

    if (isCarPaint) {
      // Photorealistic Metallic Flake + High-Gloss Wet Clearcoat + Shibuya City Reflection!
      vec3 H1 = normalize(L1 + V);
      vec3 H2 = normalize(L2 + V);
      float baseSpec = pow(max(dot(N, H1), 0.0), 28.0) * 0.68;
      float clearcoat = (pow(max(dot(N, H1), 0.0), 140.0) * 1.85 + pow(max(dot(N, H2), 0.0), 76.0) * 0.72) * max(0.35, uReflStrength);
      if (uReflStrength > 0.05) {
        vec3 envRefl = sampleShibuyaEnv(R, vWorldPos.xz);
        lit = mix(lit, lit * 0.52 + envRefl * (0.45 + baseCol * 0.65), (0.26 + fresnel * 0.72) * clamp(uReflStrength, 0.0, 1.25));
      }
      lit += mix(baseCol, vec3(1.0), 0.42) * baseSpec + vec3(1.0, 0.99, 0.98) * clearcoat;
    } else if (isGlass) {
      vec3 H1 = normalize(L1 + V);
      float glassSpec = pow(max(dot(N, H1), 0.0), 160.0) * 1.9;
      if (uReflStrength > 0.05) {
        vec3 envRefl = sampleShibuyaEnv(R, vWorldPos.xz);
        lit = mix(baseCol * 0.28, envRefl * 1.25, (0.40 + fresnel * 0.58) * clamp(uReflStrength, 0.0, 1.15)) + vec3(0.98, 0.99, 1.0) * glassSpec;
      } else {
        lit = baseCol * 0.55 + vec3(0.9, 0.95, 1.0) * glassSpec * 0.5;
      }
    } else if (!isMatte) {
      vec3 H1 = normalize(L1 + V);
      float specPow = mix(24.0, 96.0, uWetness);
      float spec = pow(max(dot(N, H1), 0.0), specPow) * mix(0.16, 1.25, uWetness);
      lit += vec3(0.86, 0.92, 1.0) * spec;

      // Photorealistic Rainy Shibuya Wet Mirror Puddle Reflections!
      if (isRoad && uWetness > 0.1 && uReflStrength > 0.05) {
        vec3 roadRefl = sampleShibuyaEnv(R, vWorldPos.xz);
        // Stretch street-light reflections dynamically across wet puddles
        float mirrorFactor = (0.24 + fresnel * 0.85) * uWetness * (0.42 + puddleMask * 0.75) * uReflStrength;
        lit = mix(lit, lit * 0.72 + roadRefl * 1.05, clamp(mirrorFactor, 0.0, 0.88));
      }
    }

    if (uDynamicLights > 0.5) {
      vec3 fwdXZ = normalize(vec3(uHeadlightDir.x, 0.0, uHeadlightDir.z));
      vec3 rightXZ = vec3(-fwdXZ.z, 0.0, fwdXZ.x);

      // Dual Xenon White Headlight Beams projecting across wet Shibuya asphalt
      vec3 toFrag = vWorldPos - uHeadlightPos;
      float distH = length(toFrag);
      if (distH < 68.0 && distH > 0.4) {
        vec3 dirToFrag = toFrag / distH;
        float cone = dot(dirToFrag, normalize(uHeadlightDir));
        float spot = smoothstep(0.58, 0.94, cone) * pow(1.0 - distH / 68.0, 1.2);
        lit += (baseCol * 1.15 + vec3(0.22, 0.25, 0.30) * uWetness) * vec3(0.96, 0.98, 1.0) * spot * 2.1;
      }

      // Twin Photorealistic Crimson LED Taillight Reflections smeared vertically on wet puddles behind left & right taillights!
      if (N.y > 0.72) {
        vec3 rearCenter = uUnderglowPos - fwdXZ * 2.25;
        vec3 rL = rearCenter + rightXZ * 0.72;
        vec3 rR = rearCenter - rightXZ * 0.72;
        vec3 toL = vWorldPos - rL;
        vec3 toR = vWorldPos - rR;
        float dL = length(toL), dR = length(toR);
        float cL = (dL < 11.5 && dL > 0.15) ? smoothstep(0.18, 0.84, dot(toL / dL, -fwdXZ)) * pow(1.0 - dL / 11.5, 1.55) : 0.0;
        float cR = (dR < 11.5 && dR > 0.15) ? smoothstep(0.18, 0.84, dot(toR / dR, -fwdXZ)) * pow(1.0 - dR / 11.5, 1.55) : 0.0;
        float tailIntensity = (0.78 + uBrakeBoost * 1.45) * (0.45 + uWetness * (0.75 + puddleMask * 0.65));
        lit += vec3(1.15, 0.07, 0.09) * (cL + cR) * tailIntensity;
      }

      // Optional Neon Underglow (active in Neon / Cyberpunk color styles)
      float distU = length(vWorldPos - uUnderglowPos);
      if (distU < 5.8 && N.y > 0.72 && uColorStyle > 0.5) {
        float f2 = pow(1.0 - distU / 5.8, 2.0);
        lit += uUnderglowCol * f2 * (0.72 + uWetness * 0.65);
      }
    }

    // HDR Emissive Boost (exceeds 1.0 so FBO Selective Bloom makes taillights, headlights & Shibuya signs glow!)
    vec3 finalCol = mix(lit, baseCol * (1.65 + uBrakeBoost * 1.15), clamp(emissive, 0.0, 1.0));

    float distCam = length(uCamPos - vWorldPos);
    float fogFactor = clamp(1.0 - exp(-pow(distCam * uFogDensity, 1.52)), 0.0, 0.88);
    finalCol = mix(finalCol, uFogColor, fogFactor);

    gl_FragColor = vec4(finalCol, 1.0);
  }
`;

// Fullscreen Post-Processing Quad Shaders (Selective Bloom Bright-Pass, Separable Gaussian Blur, ACES Filmic Tone Mapping Composite!)
const POST_VS = `
  attribute vec2 aPos;
  varying vec2 vUV;
  void main() {
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const BLOOM_EXTRACT_FS = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uScene;
  void main() {
    vec3 c = texture2D(uScene, vUV).rgb;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float soft = smoothstep(0.62, 1.0, lum);
    gl_FragColor = vec4(c * soft, 1.0);
  }
`;

const BLOOM_BLUR_FS = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uTex;
  uniform vec2 uDir;
  void main() {
    vec3 sum = texture2D(uTex, vUV).rgb * 0.227027;
    sum += texture2D(uTex, vUV + uDir * 1.3846).rgb * 0.316216;
    sum += texture2D(uTex, vUV - uDir * 1.3846).rgb * 0.316216;
    sum += texture2D(uTex, vUV + uDir * 3.2307).rgb * 0.070270;
    sum += texture2D(uTex, vUV - uDir * 3.2307).rgb * 0.070270;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

const COMPOSITE_FS = `
  precision mediump float;
  varying vec2 vUV;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform float uColorStyle;

  vec3 acesToneMap(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  void main() {
    vec3 sceneCol = texture2D(uScene, vUV).rgb;
    vec3 bloomCol = texture2D(uBloom, vUV).rgb;
    vec3 hdr = sceneCol + bloomCol * uBloomStrength;

    // Cinematic subtle vignette framing
    vec2 vigUV = vUV * 2.0 - 1.0;
    float vig = clamp(1.0 - dot(vigUV, vigUV) * 0.24, 0.58, 1.0);
    vec3 col = acesToneMap(hdr * 1.12) * vig;

    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    if (uColorStyle < 0.5) {
      // Photorealistic Rainy Shibuya Cinema Grade: rich deep cool blacks, crisp white highlights, vivid taillight reds
      col = mix(vec3(luma), col, 1.06);
      col = pow(clamp(col, 0.0, 1.0), vec3(1.02, 1.00, 0.96));
    } else if (uColorStyle >= 1.5) {
      col = mix(vec3(luma), col, 1.32);
    }
    gl_FragColor = vec4(col, 1.0);
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
    gl_PointSize = clamp((aSize * 360.0 * uPixelRatio) / dist, 2.0, 128.0);
  }
`;

const PARTICLE_FS = `
  precision mediump float;
  varying vec4 vCol;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = length(c);
    if (r > 0.5) discard;
    // Soft radial volumetric falloff (works beautifully for both smoke clouds and additive LED glow halos!)
    float soft = pow(smoothstep(0.5, 0.02, r), 1.45);
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
    gl_FragColor = vec4(0.015, 0.018, 0.028, vAlpha);
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
    this.extractProg = createProgram(gl, POST_VS, BLOOM_EXTRACT_FS);
    this.blurProg = createProgram(gl, POST_VS, BLOOM_BLUR_FS);
    this.compProg = createProgram(gl, POST_VS, COMPOSITE_FS);

    this._cacheLocations();
    this.roadTex = this._createAsphaltTexture();
    this.bldgTex = this._createShibuyaFacadeTexture();

    // Fullscreen post-processing quad
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // FBOs for Selective Bloom Pipeline
    this.sceneFBO = null;
    this.bloomFBO1 = null;
    this.bloomFBO2 = null;
    this.bloomActive = false;
    this.curColorStyle = 0.0;
    this.curBloomStrength = 0.72;

    // Particles & Additive Halos buffers
    this.maxParticles = 700;
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

  _createFBO(w, h, withDepth) {
    const gl = this.gl;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let rb = null;
    if (withDepth) {
      rb = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { fb, tex, rb, w, h } : null;
  }

  _destroyFBO(f) {
    if (!f) return;
    const gl = this.gl;
    gl.deleteFramebuffer(f.fb);
    gl.deleteTexture(f.tex);
    if (f.rb) gl.deleteRenderbuffer(f.rb);
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

    this.eLoc = { aPos: gl.getAttribLocation(this.extractProg, 'aPos'), uScene: gl.getUniformLocation(this.extractProg, 'uScene') };
    this.bLoc = { aPos: gl.getAttribLocation(this.blurProg, 'aPos'), uTex: gl.getUniformLocation(this.blurProg, 'uTex'), uDir: gl.getUniformLocation(this.blurProg, 'uDir') };
    this.cLoc = {
      aPos: gl.getAttribLocation(this.compProg, 'aPos'),
      uScene: gl.getUniformLocation(this.compProg, 'uScene'),
      uBloom: gl.getUniformLocation(this.compProg, 'uBloom'),
      uBloomStrength: gl.getUniformLocation(this.compProg, 'uBloomStrength'),
      uColorStyle: gl.getUniformLocation(this.compProg, 'uColorStyle')
    };
  }

  _uploadCanvasTexture(c) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return tex;
  }

  // Deep Dark Rain-Soaked Shibuya Asphalt Texture
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
        const n = grain * 10 + fine * 5 - trackL * 5;
        let r = 18 + n, gr = 21 + n, b = 28 + n, em = 0;

        if ((x >= 14 && x <= 26) || (x >= 486 && x <= 498)) {
          r = 232; gr = 238; b = 248; em = 105;
        }
        if (((x >= 249 && x <= 254) || (x >= 258 && x <= 263)) && (y % 128) < 76) {
          r = 250; gr = 198; b = 68; em = 120;
        }
        if (((x >= 132 && x <= 137) || (x >= 375 && x <= 380)) && (y % 128) < 46) {
          r = 205; gr = 215; b = 230; em = 60;
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

  // Ultra-Rich 1024x1024 Photorealistic Shibuya Crossing Commercial Skyscraper Facade Texture!
  _createShibuyaFacadeTexture() {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const g = c.getContext('2d');

    g.fillStyle = '#0c1018';
    g.fillRect(0, 0, 1024, 1024);

    // Concrete / anodized dark steel curtain wall structure
    g.fillStyle = '#182130';
    for (let y = 0; y < 1024; y += 64) g.fillRect(0, y, 1024, 9);
    for (let x = 0; x < 1024; x += 85) g.fillRect(x, 0, 7, 1024);

    // Realistic glowing Shibuya office floors, department store windows & bright ground-floor retail bays
    const winPalette = ['#fef3c7', '#e0f2fe', '#fed7aa', '#f8fafc', '#bae6fd', '#fde68a', '#0e1420', '#0e1420', '#141c2b'];
    let seed = 109;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 12; col++) {
        const x = 11 + col * 85;
        const y = 13 + row * 64;
        const isGround = row >= 13;
        const wCol = isGround ? (col % 2 === 0 ? '#fef08a' : '#e0f2fe') : winPalette[Math.floor(rand() * winPalette.length)];
        g.fillStyle = wCol;
        g.fillRect(x, y, 68, isGround ? 44 : 38);
        // Subtle architectural ceiling light strip & dark furniture silhouette inside lit rooms
        if (wCol !== '#0e1420' && wCol !== '#141c2b') {
          g.fillStyle = 'rgba(255,255,255,0.65)';
          g.fillRect(x + 4, y + 3, 60, 5);
          g.fillStyle = 'rgba(10, 15, 25, 0.35)';
          g.fillRect(x, y + 26, 68, 12);
        }
      }
    }

    // Giant Shibuya Crossing LED Video Billboard Screen (like the iconic Shibuya QFRONT screen in Image #1!)
    const screenGrad = g.createLinearGradient(250, 260, 720, 560);
    screenGrad.addColorStop(0, '#0ea5e9');
    screenGrad.addColorStop(0.5, '#1d4ed8');
    screenGrad.addColorStop(1, '#f59e0b');
    g.fillStyle = screenGrad;
    g.fillRect(260, 270, 440, 250);
    g.strokeStyle = '#1e293b';
    g.lineWidth = 10;
    g.strokeRect(260, 270, 440, 250);
    g.fillStyle = '#ffffff';
    g.font = '900 54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('渋谷 SHIBUYA', 480, 375);
    g.fillStyle = '#fef08a';
    g.font = '900 32px sans-serif';
    g.fillText('東京ナイト・スクランブル', 480, 445);

    // Authentic Vertical & Horizontal Japanese Commercial Signs (Red, White, Blue, Gold, Green)
    const signs = [
      { x: 26,  y: 70,  w: 112, h: 380, bg: '#dc2626', fg: '#ffffff', text: '渋谷本店', vert: true },
      { x: 865, y: 120, w: 118, h: 430, bg: '#f8fafc', fg: '#0f172a', text: 'ラーメン', vert: true },
      { x: 740, y: 600, w: 112, h: 320, bg: '#0284c7', fg: '#ffffff', text: 'ゲーム', vert: true },
      { x: 160, y: 610, w: 105, h: 310, bg: '#f59e0b', fg: '#0f172a', text: 'カラオケ', vert: true },
      { x: 290, y: 740, w: 410, h: 96,  bg: '#b91c1c', fg: '#ffffff', text: '大衆酒場・東京', vert: false },
      { x: 220, y: 40,  w: 520, h: 88,  bg: '#1e3a8a', fg: '#f8fafc', text: 'SHIBUYA CROSSING', vert: false }
    ];

    for (const s of signs) {
      g.fillStyle = s.bg;
      g.fillRect(s.x, s.y, s.w, s.h);
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 5;
      g.strokeRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
      g.fillStyle = s.fg;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      if (s.vert) {
        g.font = `900 ${s.text.length >= 4 ? 52 : 62}px sans-serif`;
        const step = (s.h - 46) / s.text.length;
        for (let i = 0; i < s.text.length; i++) {
          g.fillText(s.text[i], s.x + s.w * 0.5, s.y + 30 + step * (i + 0.45));
        }
      } else {
        g.font = '900 42px sans-serif';
        g.fillText(s.text, s.x + s.w * 0.5, s.y + s.h * 0.52);
      }
    }

    const img = g.getImageData(0, 0, 1024, 1024);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11);
      d[i + 3] = lum > 56 ? Math.min(255, Math.floor((lum - 44) * 1.48)) : 0;
    }
    g.putImageData(img, 0, 0);
    return this._uploadCanvasTexture(c);
  }

  resize(width, height, qualityScale = 1.0) {
    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = Math.max(0.75, rawDpr * qualityScale);
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const cw = Math.max(2, Math.floor(this.width * this.dpr));
    const ch = Math.max(2, Math.floor(this.height * this.dpr));
    this.canvas.width = cw;
    this.canvas.height = ch;

    // Rebuild Selective Bloom FBOs matching viewport size
    this._destroyFBO(this.sceneFBO);
    this._destroyFBO(this.bloomFBO1);
    this._destroyFBO(this.bloomFBO2);
    this.sceneFBO = this._createFBO(cw, ch, true);
    const bw = Math.max(2, Math.floor(cw * 0.5));
    const bh = Math.max(2, Math.floor(ch * 0.5));
    this.bloomFBO1 = this._createFBO(bw, bh, false);
    this.bloomFBO2 = this._createFBO(bw, bh, false);
    this.gl.viewport(0, 0, cw, ch);
  }

  beginFrame(camPos, camTarget, fovRad, skyCol, fogCol, fogDensity, headlightPos, headlightDir, underglowPos, underglowCol, wetness, brakeRoadGlow = 0, gfxOpts = {}) {
    const gl = this.gl;
    this.time += 0.016;
    this.curColorStyle = gfxOpts.colorStyle ?? 0.0;
    this.curBloomStrength = gfxOpts.reflStrength > 0.1 ? (this.curColorStyle >= 1.5 ? 0.95 : 0.68) : 0.25;
    this.bloomActive = !!(this.sceneFBO && this.bloomFBO1 && this.bloomFBO2 && gfxOpts.dynamicLights !== false);

    if (this.bloomActive) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fb);
      gl.viewport(0, 0, this.sceneFBO.w, this.sceneFBO.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

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
    gl.uniform1f(this.mLoc.uColorStyle, this.curColorStyle);
  }

  // Finalize frame: Selective Bright-Pass -> 2-Pass Separable Gaussian Blur -> ACES Filmic Bloom Composite!
  endFrame() {
    if (!this.bloomActive) return;
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);

    const drawQuad = (aPosLoc) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Pass 1: Extract bright HDR lights (taillights, headlights, Shibuya billboards, puddle specular glints)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO1.fb);
    gl.viewport(0, 0, this.bloomFBO1.w, this.bloomFBO1.h);
    gl.useProgram(this.extractProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
    gl.uniform1i(this.eLoc.uScene, 0);
    drawQuad(this.eLoc.aPos);

    // Pass 2: Horizontal Blur -> bloomFBO2
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO2.fb);
    gl.useProgram(this.blurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO1.tex);
    gl.uniform1i(this.bLoc.uTex, 0);
    gl.uniform2f(this.bLoc.uDir, 1.8 / this.bloomFBO1.w, 0.0);
    drawQuad(this.bLoc.aPos);

    // Pass 3: Vertical Blur -> bloomFBO1
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO1.fb);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO2.tex);
    gl.uniform2f(this.bLoc.uDir, 0.0, 1.8 / this.bloomFBO1.h);
    drawQuad(this.bLoc.aPos);

    // Pass 4: ACES Filmic Composite to Screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.compProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.tex);
    gl.uniform1i(this.cLoc.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomFBO1.tex);
    gl.uniform1i(this.cLoc.uBloom, 1);
    gl.uniform1f(this.cLoc.uBloomStrength, this.curBloomStrength);
    gl.uniform1f(this.cLoc.uColorStyle, this.curColorStyle);
    drawQuad(this.cLoc.aPos);

    // Unbind FBO textures so the next frame never triggers a WebGL feedback loop!
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.enable(gl.DEPTH_TEST);
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
    if (wetnessOverride !== null) gl.uniform1f(L.uWetness, wetnessOverride);

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

  // Draw standard alpha particles (smoke, rain) OR additive glowing halos (taillight flare, headlight flare, streetlamp halos!)
  drawParticles(particles, additive = false) {
    if (!particles || particles.length === 0) return;
    const gl = this.gl;
    const count = Math.min(particles.length, this.maxParticles);
    let pOff = 0, cOff = 0;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      this.partPosData[pOff++] = p.x;
      this.partPosData[pOff++] = p.y;
      this.partPosData[pOff++] = p.z;

      const lifeRatio = p.maxLife ? Math.max(0, p.life / p.maxLife) : 1.0;
      this.partColData[cOff++] = p.r;
      this.partColData[cOff++] = p.g;
      this.partColData[cOff++] = p.b;
      this.partColData[cOff++] = p.a * lifeRatio;
      this.partSizeData[i] = p.size;
    }

    gl.useProgram(this.partProg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
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
