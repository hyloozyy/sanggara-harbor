// One normal map shared by every person (all atlases use the same layout): cloth folds and
// creases where garments bunch (waist and armpits of shirts, elbows, knees and ankles of
// trousers, the hang of skirts and scarves), a fine weave, hair strands, sole tread and soft
// skin. Built once from a painted height field, converted to normals with a Sobel filter.
import * as THREE from 'three';
import { ATLAS_SIZE, REGIONS } from './atlas-layout.js';

let cached = null;
export function foldNormalMap() {
  if (cached) return cached;
  const N = ATLAS_SIZE;
  const H = new Float32Array(N * N);
  const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // fn(u, v) → height for every texel of a region (u, v in 0..1, v = 0 at the region's bottom).
  const region = (name, fn) => {
    const [x0, y0, w, h] = REGIONS[name];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x / (w - 1), v = 1 - y / (h - 1);
      H[(y0 + y) * N + x0 + x] = fn(u, v, x, y);
    }
  };
  const weave = (x, y) => 0.06 * (Math.sin(x * 2.1) * Math.sin(y * 2.1));
  region('torso', (u, v, x, y) => {
    // Horizontal waist folds (wavy), diagonal pulls from the armpits, a weave; skin above the neckline.
    const waist = sm(0.05, 0.2, v) * sm(0.48, 0.25, v) * Math.sin(v * 120 + Math.sin(u * 25) * 2.2) * 0.55;
    let pit = 0;
    for (const c of [0.25, 0.75]) { const d = Math.abs(u - c); pit += sm(0.12, 0.0, d) * sm(0.55, 0.68, v) * sm(0.85, 0.7, v) * Math.sin((u - c) * 90 + v * 60) * 0.45; }
    return (waist + pit) * (1 - sm(0.84, 0.9, v)) + weave(x, y) + noise(u * 14, v * 14) * 0.25;
  });
  region('arm', (u, v, x, y) => {
    const front = Math.max(0, Math.cos((u - 0.5) * Math.PI * 2));
    const elbow = sm(0.1, 0.0, Math.abs(v - 0.45)) * front * Math.sin((v - 0.45) * 160) * 0.3;
    const bunch = sm(0.1, 0.0, Math.abs(v - 0.06)) * Math.sin(v * 200 + u * 8) * 0.35;
    return elbow + bunch + weave(x, y) * 0.6 + noise(u * 10, v * 20) * 0.18;
  });
  region('leg', (u, v, x, y) => {
    const back = Math.max(0, -Math.cos((u - 0.5) * Math.PI * 2)), front = Math.max(0, Math.cos((u - 0.5) * Math.PI * 2));
    const knee = sm(0.1, 0.0, Math.abs(v - 0.47)) * (back * 0.8 + front * 0.35) * Math.sin((v - 0.47) * 140 + u * 6) * 0.7;
    const ankle = sm(0.16, 0.02, v) * Math.sin(v * 150 + Math.sin(u * 30) * 1.5) * 0.5;
    const crotch = sm(0.85, 0.97, v) * Math.sin(u * 40 + v * 50) * 0.25;
    return knee + ankle + crotch + weave(x, y) + noise(u * 10, v * 24) * 0.2;
  });
  region('outer', (u, v, x, y) => Math.sin(u * 48 + Math.sin(v * 7) * 1.5) * sm(0.85, 0.3, v) * 0.6 + weave(x, y) + noise(u * 12, v * 12) * 0.2);
  region('hat', (u, v) => Math.sin(u * 160 + noise(u * 8, v * 3) * 6) * 0.4 + Math.sin(u * 30 + v * 9) * 0.25);
  region('hair', (u, v) => Math.sin(u * 140 + noise(u * 6, v * 4) * 5) * 0.5);
  region('shoe', (u, v) => (v < 0.2 ? Math.sin(u * 120) * 0.5 : 0) + noise(u * 20, v * 20) * 0.15);
  region('head', (u, v) => noise(u * 90, v * 90) * 0.08);
  region('skin', (u, v) => noise(u * 30, v * 30) * 0.12);
  // Sobel → tangent-space normals (y up in UV space; the texture is uploaded without a flip).
  const data = new Uint8Array(N * N * 4);
  const k = 2.2;
  const at = (x, y) => H[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * k * 0.125, ny = dy * k * 0.125, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const o = ((N - 1 - y) * N + x) * 4;      // rows flipped to match the atlas upload
      data[o] = (nx * 0.5 + 0.5) * 255; data[o + 1] = (ny * 0.5 + 0.5) * 255; data[o + 2] = (nz * 0.5 + 0.5) * 255; data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  cached = tex;
  return tex;
}
