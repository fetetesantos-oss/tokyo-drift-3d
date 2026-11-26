// 7 Realistic JDM-to-Hypercar Progressive Vehicle Roster (Tier 1 Simples -> Tier 7 Hipercarro Top)

export const PAINTS = [
  { id: 'silver',   name: 'Prata Metálico',  hex: '#cbd5e1', underglow: '#38bdf8', metal: 0.85 },
  { id: 'sunset',   name: 'Laranja Tóquio',  hex: '#f94d1c', underglow: '#ff2a85', metal: 0.78 },
  { id: 'wangan',   name: 'Azul Bayside',    hex: '#1d4ed8', underglow: '#22d3ee', metal: 0.88 },
  { id: 'crimson',  name: 'Vermelho Rubi',   hex: '#dc2626', underglow: '#ff2a85', metal: 0.84 },
  { id: 'panda',    name: 'Branco Pérola',   hex: '#f1f5f9', underglow: '#fbbf24', metal: 0.65 },
  { id: 'midnight', name: 'Roxo Midnight',   hex: '#6d28d9', underglow: '#a855f7', metal: 0.92 },
  { id: 'emerald',  name: 'Verde Esmeralda', hex: '#059669', underglow: '#34d399', metal: 0.85 },
  { id: 'gold',     name: 'Ouro Champagne',  hex: '#d97706', underglow: '#fbbf24', metal: 0.92 },
  { id: 'stealth',  name: 'Preto Obsidiana', hex: '#181c28', underglow: '#22d3ee', metal: 0.90 },
  { id: 'sakura',   name: 'Rosa Cyber',      hex: '#db2777', underglow: '#ff2a85', metal: 0.82 }
];

export const RIMS = [
  { id: 'steel',  name: 'Liga Clássica',   color: '#94a3b8', accent: '#cbd5e1', caliper: '#64748b' },
  { id: 'te37',   name: '6-Raios Bronze',  color: '#b45309', accent: '#fde68a', caliper: '#ef4444' },
  { id: 'mesh',   name: 'BBS Dourada',     color: '#eab308', accent: '#fef08a', caliper: '#ef4444' },
  { id: 'carbon', name: 'Forjada Carbono', color: '#334155', accent: '#e2e8f0', caliper: '#fbbf24' },
  { id: 'neon',   name: 'Anel Neon Cyan',  color: '#1e293b', accent: '#22d3ee', caliper: '#ff2a85' }
];

export const WINGS = [
  { id: 'none', name: 'Original Limpo' },
  { id: 'lip',  name: 'Ducktail Street' },
  { id: 'gt',   name: 'GT Wing Carbono' },
  { id: 'big',  name: 'Swan-Neck Pro' }
];

export const SUSPENSIONS = [
  { id: 'stock',  name: 'Rua Padrão',   rideOffset: 0.03,  camber: 0.02 },
  { id: 'sport',  name: 'Coilover',     rideOffset: -0.05, camber: 0.07 },
  { id: 'stance', name: 'Stance Baixa', rideOffset: -0.11, camber: 0.14 }
];

export const DRIFT_SETUPS = [
  { id: 'balanced', name: 'Street Equilibrado', gripMult: 1.0,  driftGripMult: 1.0,  steerMult: 1.0 },
  { id: 'pro',      name: 'Pro Drift Ângulo',   gripMult: 0.86, driftGripMult: 0.80, steerMult: 1.16 },
  { id: 'grip',     name: 'Circuito / Grip',    gripMult: 1.18, driftGripMult: 1.16, steerMult: 0.96 }
];

export const CARS = [
  {
    id: 'kei_r',
    tier: 1,
    tierLabel: 'TIER 1 • SIMPLES',
    name: 'Mira Civic-K 94',
    classLabel: 'Hatch Urbano Simples • RWD Swap',
    desc: 'Carro popular japonês simples e leve, convertido para tração traseira — ideal para dominar o drift.',
    price: 0,
    style: 'compact',
    defaultPaint: 'silver',
    defaultRim: 'steel',
    defaultWing: 'none',
    defaultKit: 'stock',
    length: 4.05, width: 1.76, height: 1.36,
    base: {
      topSpeed: 60,
      accel: 24.0,
      steerRate: 2.85,
      grip: 6.2,
      driftGrip: 2.1,
      nitroPower: 17,
      enginePitch: 1.0,
      engineType: 'i4_vtec',
      hasTurbo: false
    }
  },
  {
    id: 'hachi',
    tier: 2,
    tierLabel: 'TIER 2 • CLÁSSICO',
    name: 'Hachi-Roku S86',
    classLabel: 'Coupé Clássico Touge • RWD',
    desc: 'Ícone leve das montanhas japonesas com pintura dois-tons e resposta instantânea no contra-esterço.',
    price: 6500,
    style: 'hatch',
    defaultPaint: 'panda',
    defaultRim: 'mesh',
    defaultWing: 'lip',
    defaultKit: 'street',
    length: 4.22, width: 1.80, height: 1.28,
    base: {
      topSpeed: 66,
      accel: 27.0,
      steerRate: 3.05,
      grip: 6.0,
      driftGrip: 1.92,
      nitroPower: 20,
      enginePitch: 1.05,
      engineType: 'i4_itb',
      hasTurbo: false
    }
  },
  {
    id: 'kurokaze',
    tier: 3,
    tierLabel: 'TIER 3 • ESPORTIVO',
    name: 'Kurokaze RX-9',
    classLabel: 'Coupé Rotativo Bi-Turbo • RWD',
    desc: 'Linhas esculpidas, motor rotativo agudo e equilíbrio lendário para combos longos em Shibuya.',
    price: 14000,
    style: 'coupe',
    defaultPaint: 'sunset',
    defaultRim: 'te37',
    defaultWing: 'gt',
    defaultKit: 'street',
    length: 4.38, width: 1.92, height: 1.21,
    base: {
      topSpeed: 73,
      accel: 30.0,
      steerRate: 2.82,
      grip: 6.3,
      driftGrip: 1.98,
      nitroPower: 23,
      enginePitch: 1.12,
      engineType: 'rotary',
      hasTurbo: true
    }
  },
  {
    id: 'chaser',
    tier: 4,
    tierLabel: 'TIER 4 • DRIFT PRO',
    name: 'Chaser V-100 Turbo',
    classLabel: 'Sedã 4 Portas Preparado • RWD',
    desc: 'Sedã executivo japonês de entre-eixos longo com turbo gigante — estabilidade cirúrgica de lado.',
    price: 24000,
    style: 'sedan',
    defaultPaint: 'midnight',
    defaultRim: 'mesh',
    defaultWing: 'lip',
    defaultKit: 'wide',
    length: 4.72, width: 1.96, height: 1.32,
    base: {
      topSpeed: 76,
      accel: 31.8,
      steerRate: 2.74,
      grip: 6.4,
      driftGrip: 1.88,
      nitroPower: 25,
      enginePitch: 0.92,
      engineType: 'i6_turbo',
      hasTurbo: true
    }
  },
  {
    id: 'shogun',
    tier: 5,
    tierLabel: 'TIER 5 • WANGAN',
    name: 'Shogun GT-34 Spec-V',
    classLabel: 'Coupé Bi-Turbo 6 Cilindros',
    desc: 'Lenda das rodovias expressas de Tóquio com lanternas redondas quádruplas e tração brutal.',
    price: 38000,
    style: 'gtr',
    defaultPaint: 'wangan',
    defaultRim: 'steel',
    defaultWing: 'gt',
    defaultKit: 'wide',
    length: 4.58, width: 1.98, height: 1.27,
    base: {
      topSpeed: 82,
      accel: 34.5,
      steerRate: 2.68,
      grip: 7.0,
      driftGrip: 2.12,
      nitroPower: 27,
      enginePitch: 0.96,
      engineType: 'rb26_twin',
      hasTurbo: true
    }
  },
  {
    id: 'raijin',
    tier: 6,
    tierLabel: 'TIER 6 • SUPERCARRO',
    name: 'Raijin NS-X GT',
    classLabel: 'Supercarro Motor Central • Híbrido',
    desc: 'Cabine avançada, entradas de ar laterais esculpidas e aceleração instantânea de supercarro.',
    price: 60000,
    style: 'supercar',
    defaultPaint: 'crimson',
    defaultRim: 'carbon',
    defaultWing: 'gt',
    defaultKit: 'wide',
    length: 4.54, width: 2.04, height: 1.15,
    base: {
      topSpeed: 88,
      accel: 38.0,
      steerRate: 2.95,
      grip: 7.2,
      driftGrip: 1.95,
      nitroPower: 30,
      enginePitch: 1.06,
      engineType: 'v6_exotic',
      hasTurbo: true
    }
  },
  {
    id: 'kaguya',
    tier: 7,
    tierLabel: 'TIER 7 • HIPERCARRO TOP',
    name: 'Kaguya V12 Valkyrie',
    classLabel: 'Hipercarro Apex V12 • Edição Tóquio',
    desc: 'O topo absoluto: aerodinâmica extrema estilo protótipo, V12 aspirado e controle supremo no limite.',
    price: 95000,
    style: 'hypercar',
    defaultPaint: 'stealth',
    defaultRim: 'neon',
    defaultWing: 'big',
    defaultKit: 'wide',
    length: 4.74, width: 2.12, height: 1.08,
    base: {
      topSpeed: 96,
      accel: 42.0,
      steerRate: 3.10,
      grip: 7.6,
      driftGrip: 1.85,
      nitroPower: 34,
      enginePitch: 1.25,
      engineType: 'v12_f1',
      hasTurbo: false
    }
  }
];

export const UPGRADE_DEFS = [
  { key: 'engine', name: 'Motor & Escape',       desc: '+Velocidade Máxima & Aceleração', costs: [2500, 6000, 12000] },
  { key: 'turbo',  name: 'Kit Bi-Turbo / N2O',   desc: '+Potência & Recarga do Nitro',    costs: [2500, 6000, 12000] },
  { key: 'drift',  name: 'Ângulo & Transmissão', desc: '+Controle no Contra-Esterço',     costs: [2000, 5000, 10000] },
  { key: 'tires',  name: 'Pneus Semi-Slick',     desc: '+Aderência & Recuperação',        costs: [2000, 5000, 10000] }
];

export function computeCarStats(carDef, carState) {
  const upg = carState.upgrades || { engine: 0, turbo: 0, drift: 0, tires: 0 };
  const setup = DRIFT_SETUPS.find(s => s.id === (carState.driftSetup || 'balanced')) || DRIFT_SETUPS[0];
  const b = carDef.base;

  const topSpeed = b.topSpeed * (1 + upg.engine * 0.05);
  const accel = b.accel * (1 + upg.engine * 0.07);
  const nitroPower = b.nitroPower * (1 + upg.turbo * 0.13);
  const nitroRegen = 1 + upg.turbo * 0.18;
  const steerRate = b.steerRate * (1 + upg.drift * 0.055) * setup.steerMult;
  const grip = b.grip * (1 + upg.tires * 0.06) * setup.gripMult;
  const driftGrip = b.driftGrip * (1 - upg.drift * 0.03) * setup.driftGripMult;

  return {
    topSpeed,
    accel,
    nitroPower,
    nitroRegen,
    steerRate,
    grip,
    driftGrip,
    enginePitch: b.enginePitch,
    engineType: b.engineType || 'rb26_twin',
    hasTurbo: !!(b.hasTurbo || upg.turbo > 0),
    bars: {
      speed: Math.min(100, Math.round(((topSpeed - 52) / 56) * 100)),
      accel: Math.min(100, Math.round(((accel - 20) / 28) * 100)),
      drift: Math.min(100, Math.round(((steerRate / driftGrip) / 2.0) * 100)),
      nitro: Math.min(100, Math.round(((nitroPower - 14) / 26) * 100))
    }
  };
}
