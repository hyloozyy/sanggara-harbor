// Factory car paints: real-world finishes (solid, metallic, pearl) as clearcoated physical
// materials. Metallic and pearl paints get a fine flake normal map under a mirror-smooth clear
// coat, so close up the base coat sparkles while the reflections stay crisp. One material per
// colour, shared by every car wearing it.
import * as THREE from 'three';
import { makeCanvas } from '../assets/canvas-tools.js';
import { weatherizeMaterial } from '../render/surface-weather.js';

// Named factory colours. finish: solid | metallic | pearl.
export const PAINT = {
  pearlWhite: { hex: 0xe8e7e1, finish: 'pearl' },
  polarWhite: { hex: 0xeeeeea, finish: 'solid' },
  silver: { hex: 0xa9adb2, finish: 'metallic' },
  titanium: { hex: 0x7d8186, finish: 'metallic' },
  gunmetal: { hex: 0x4a4e55, finish: 'metallic' },
  graphite: { hex: 0x2c2f34, finish: 'metallic' },
  black: { hex: 0x0c0d0f, finish: 'metallic' },
  solidBlack: { hex: 0x111214, finish: 'solid' },
  deepRed: { hex: 0x74101a, finish: 'metallic' },
  burgundy: { hex: 0x431219, finish: 'metallic' },
  navy: { hex: 0x15223f, finish: 'metallic' },
  steelBlue: { hex: 0x2a4a74, finish: 'metallic' },
  champagne: { hex: 0xb7a688, finish: 'metallic' },
  bronze: { hex: 0x5b4634, finish: 'metallic' },
  olive: { hex: 0x4a4d3a, finish: 'metallic' },
  forest: { hex: 0x1e3b2c, finish: 'metallic' },
  flameRed: { hex: 0xb4141a, finish: 'solid' },
  racingYellow: { hex: 0xe3a90c, finish: 'solid' },
  brightBlue: { hex: 0x1748b8, finish: 'metallic' },
  sunsetOrange: { hex: 0xd2520f, finish: 'metallic' },
  racingGreen: { hex: 0x1b5a36, finish: 'metallic' },
  taxiBlue: { hex: 0x2a6cc4, finish: 'solid' },
  policeWhite: { hex: 0xf1f1ec, finish: 'solid' },
  tacticalGrey: { hex: 0x24282c, finish: 'solid' },
  angkotTeal: { hex: 0x0d8a86, finish: 'solid' },
  angkotBlue: { hex: 0x1c5cc0, finish: 'solid' },
  angkotOrange: { hex: 0xd8661a, finish: 'solid' },
  angkotYellow: { hex: 0xdcb21c, finish: 'solid' },
  angkotGreen: { hex: 0x2c8c3c, finish: 'solid' },
  cream: { hex: 0xe6dcc4, finish: 'solid' },
};

const FINISH = new Map(Object.values(PAINT).map((p) => [p.hex, p.finish]));
export const paintFinish = (hex) => FINISH.get(hex) ?? 'metallic';
export const paints = (...names) => names.map((n) => PAINT[n].hex);

// A tiling flake normal map: random tiny tilts per texel.
let flake = null;
function flakeMap() {
  if (flake) return flake;
  const n = 256, c = makeCanvas(n), g = c.getContext('2d');
  const img = g.createImageData(n, n);
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < n * n; i++) {
    const a = rnd() * Math.PI * 2, t = Math.pow(rnd(), 1.5) * 0.55;
    img.data[i * 4] = 128 + Math.cos(a) * t * 127;
    img.data[i * 4 + 1] = 128 + Math.sin(a) * t * 127;
    img.data[i * 4 + 2] = 255 * Math.sqrt(1 - t * t);
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  flake = new THREE.CanvasTexture(c);
  flake.wrapS = flake.wrapT = THREE.RepeatWrapping;
  flake.repeat.set(6, 6);
  flake.colorSpace = THREE.NoColorSpace;
  flake.anisotropy = 4;
  return flake;
}

const cache = new Map();
export function carPaint(hex) {
  if (cache.has(hex)) return cache.get(hex);
  const finish = paintFinish(hex);
  const col = new THREE.Color(hex);
  const lum = col.r * 0.3 + col.g * 0.55 + col.b * 0.15;
  const o = { color: col, clearcoat: 1, clearcoatRoughness: 0.07, envMapIntensity: 1.15 };
  if (finish === 'solid') Object.assign(o, { metalness: 0.0, roughness: 0.42 });
  else if (finish === 'pearl') Object.assign(o, { metalness: 0.15, roughness: 0.38, normalMap: flakeMap(), normalScale: new THREE.Vector2(0.12, 0.12), iridescence: 0.35, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 420], sheen: 0.4, sheenColor: new THREE.Color(0xfff2e0), sheenRoughness: 0.5 });
  else Object.assign(o, { metalness: lum < 0.02 ? 0.45 : 0.62, roughness: 0.34, normalMap: flakeMap(), normalScale: new THREE.Vector2(0.22, 0.22) });
  const m = new THREE.MeshPhysicalMaterial(o);
  m.userData.paint = true;
  m.userData.hex = hex;
  weatherizeMaterial(m, { wet: 0.35, snow: 1 });
  cache.set(hex, m);
  return m;
}
