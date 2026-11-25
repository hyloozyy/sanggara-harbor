// Procedural textures for the interiors, painted on canvas the first time a room is built:
// varnished floor planks and furniture grain, patterned cement tiles (ubin tegel), bathroom and
// clinic tiles, plaster, exposed brick, pool-table felt, woven and leather upholstery, batik
// cloth, a chalkboard menu, posters with invented local brands, bottle labels and neon tubes.
// Height fields become normal maps so grain, grout and weave catch the light.
import * as THREE from 'three';
import { makeCanvas, noiseField, heightToNormalCanvas, toTexture } from '../assets/canvas-tools.js';
import { createRng } from '../core/rng.js';

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Grey canvas holding a height field (red channel) for heightToNormalCanvas.
function heightCanvas(size, fn) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = Math.max(0, Math.min(255, fn(x, y) * 255)); const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

function pixels(size, fn) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const [r, g, b] = fn(x, y); const i = (y * size + x) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Wood grain value at (u, v): long stretched noise with growth rings and a few knots.
function grainFn(size, seed, stretch = 8) {
  const n1 = noiseField(size, 4, 3, seed), n2 = noiseField(size, 16, 2, seed + 7);
  return (x, y) => {
    x = Math.floor(x) % size; y = Math.floor(y) % size;
    const i = y * size + x;
    const xs = ((x / stretch) | 0) % size;
    const ring = Math.sin((n1[y * size + xs] * 9 + x / size * 3) * Math.PI * 2) * 0.5 + 0.5;
    return 0.55 * ring + 0.3 * n1[i] + 0.15 * n2[i];
  };
}

// Floor planks: staggered boards, each a slightly different tone, grain along the board.
export function plankTextures(tone = 0x8a5a34, { size = 512, boards = 6, seed = 3 } = {}) {
  return once(`plank:${tone}:${boards}:${seed}`, () => {
    const base = rgb(tone), r = createRng(seed);
    const g = grainFn(size, seed, 1);
    const bw = size / boards;
    const shade = [], ends = [];
    for (let b = 0; b < boards; b++) { shade.push(r.range(0.82, 1.12)); ends.push(r.range(0, size)); }
    const field = (x, y) => {
      const b = Math.floor(x / bw), lx = x - b * bw;
      const seam = Math.min(lx, bw - lx) < 1.5 ? 1 : 0;
      const ey = (y + ends[b]) % size;
      const endSeam = Math.abs(ey - size / 2) < 1.2 ? 1 : 0;
      return { b, seam: seam || endSeam, gv: g((y + ends[b] * 3) % size, (x * 7 + b * 31) % size) };
    };
    const map = pixels(size, (x, y) => {
      const f = field(x, y);
      const k = shade[f.b] * (0.78 + f.gv * 0.4);
      const c = mix(base, [base[0] * 0.55, base[1] * 0.45, base[2] * 0.35], 1 - f.gv);
      return f.seam ? [c[0] * 0.35, c[1] * 0.3, c[2] * 0.28] : [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
    });
    const height = heightCanvas(size, (x, y) => { const f = field(x, y); return f.seam ? 0 : 0.6 + f.gv * 0.15; });
    const rough = pixels(size, (x, y) => { const f = field(x, y); const v = f.seam ? 230 : 120 + f.gv * 60; return [v, v, v]; });
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 3), { srgb: false }), roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Continuous furniture grain (counters, tables, cabinets).
export function grainTextures(tone = 0x6a3a1e, seed = 11) {
  return once(`grain:${tone}:${seed}`, () => {
    const size = 256, base = rgb(tone), g = grainFn(size, seed, 1);
    const map = pixels(size, (x, y) => { const v = g(y, (x * 5) % size); const k = 0.72 + v * 0.5; const c = mix(base, [base[0] * 0.5, base[1] * 0.4, base[2] * 0.32], 1 - v); return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)]; });
    const height = heightCanvas(size, (x, y) => 0.5 + g(y, (x * 5) % size) * 0.12);
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 1.5), { srgb: false }) };
  });
}

// Patterned cement tiles (ubin tegel): a four-petal motif in each 20 cm tile, mirrored into
// a repeating carpet, with grout lines and a worn, slightly chalky surface.
export function tegelTextures(c1 = 0x9a3a2a, c2 = 0xe8dcc0, c3 = 0x2a4a5a, seed = 5) {
  return once(`tegel:${c1}:${c2}:${c3}`, () => {
    const size = 512, tiles = 4, ts = size / tiles;
    const A = rgb(c1), Bc = rgb(c2), C = rgb(c3);
    const n = noiseField(size, 32, 3, seed);
    const motif = (u, v) => {
      // u, v in [0,1] inside a tile, folded to one quadrant.
      const x = Math.abs(u - 0.5) * 2, y = Math.abs(v - 0.5) * 2;
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      const petal = r < 0.62 * Math.abs(Math.cos(a * 2)) + 0.12 ? 1 : 0;
      const ringK = Math.abs(r - 0.82) < 0.05 ? 1 : 0;
      const corner = Math.hypot(1 - x, 1 - y) < 0.38 ? 1 : 0;
      const dot = r < 0.13 ? 1 : 0;
      return dot ? 3 : petal ? 1 : ringK || corner ? 2 : 0;
    };
    const map = pixels(size, (x, y) => {
      const lx = x % ts, ly = y % ts;
      if (lx < 2 || ly < 2) return [150, 140, 125];
      const m = motif(lx / ts, ly / ts);
      const c = m === 1 ? A : m === 2 ? C : m === 3 ? Bc : Bc;
      const k = 0.88 + n[y * size + x] * 0.22;
      const cc = m === 3 ? A : c;
      return [cc[0] * k, cc[1] * k, cc[2] * k];
    });
    const height = heightCanvas(size, (x, y) => ((x % ts) < 2 || (y % ts) < 2 ? 0.2 : 0.7 + n[y * size + x] * 0.06));
    const rough = pixels(size, (x, y) => { const v = (x % ts) < 2 || (y % ts) < 2 ? 240 : 150 + n[y * size + x] * 70; return [v, v, v]; });
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 2.5), { srgb: false }), roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Glazed square tiles (bathroom, clinic, kitchen splashback).
export function glazedTileTextures(color = 0xe8ece8, tiles = 4, grout = 0xb8b8b0) {
  return once(`glaze:${color}:${tiles}:${grout}`, () => {
    const size = 256, ts = size / tiles, base = rgb(color), gr = rgb(grout);
    const n = noiseField(size, 8, 2, 9);
    const map = pixels(size, (x, y) => { const lx = x % ts, ly = y % ts; if (lx < 2 || ly < 2) return gr; const k = 0.95 + n[y * size + x] * 0.08; return [base[0] * k, base[1] * k, base[2] * k]; });
    const height = heightCanvas(size, (x, y) => { const lx = x % ts, ly = y % ts; if (lx < 2 || ly < 2) return 0.1; const e = Math.min(lx, ly, ts - lx, ts - ly); return 0.6 + Math.min(1, e / 5) * 0.3; });
    const rough = pixels(size, (x, y) => { const v = (x % ts) < 2 || (y % ts) < 2 ? 230 : 40; return [v, v, v]; });
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 3), { srgb: false }), roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Terrazzo: chips of marble in a cement matrix (clinic and shop floors).
export function terrazzoTextures(base = 0xd8d0c0, seed = 21) {
  return once(`terrazzo:${base}`, () => {
    const size = 512, c = makeCanvas(size), ctx = c.getContext('2d'), r = createRng(seed);
    const b = rgb(base);
    ctx.fillStyle = css(b); ctx.fillRect(0, 0, size, size);
    const chips = [[0x8a7a6a, 1], [0x3a3a3a, 1], [0xf0ece4, 1], [0xa86a4a, 0.6], [0x5a6a5a, 0.5]];
    for (let i = 0; i < 2600; i++) {
      const [col] = chips[r.int(0, chips.length - 1)];
      ctx.fillStyle = css(rgb(col), r.range(0.6, 1));
      const x = r.next() * size, y = r.next() * size, s = r.range(1.5, 6);
      ctx.beginPath();
      for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + r.next(); ctx.lineTo(x + Math.cos(a) * s * r.range(0.6, 1.2), y + Math.sin(a) * s * r.range(0.6, 1.2)); }
      ctx.fill();
    }
    const rough = pixels(256, () => [70, 70, 70]);
    return { map: toTexture(c), roughnessMap: toTexture(rough, { srgb: false }) };
  });
}

// Plaster wall: soft blotches and a fine trowel texture.
export function plasterTextures(color = 0xe8dcc4, seed = 4) {
  return once(`plaster:${color}`, () => {
    const size = 256, base = rgb(color), n = noiseField(size, 6, 4, seed), f = noiseField(size, 48, 2, seed + 3);
    const map = pixels(size, (x, y) => { const i = y * size + x; const k = 0.9 + n[i] * 0.14 + f[i] * 0.04; return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)]; });
    const height = heightCanvas(size, (x, y) => n[y * size + x] * 0.3 + f[y * size + x] * 0.3);
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 1.2), { srgb: false }) };
  });
}

// Exposed brick with mortar (behind the bar).
export function brickTextures(seed = 8) {
  return once('brick', () => {
    const size = 512, rows = 16, bh = size / rows, bwid = bh * 2.6, r = createRng(seed);
    const n = noiseField(size, 32, 3, seed);
    const tint = [];
    for (let i = 0; i < 400; i++) tint.push([r.range(0.7, 1.05), r.range(-0.05, 0.05)]);
    const cell = (x, y) => { const row = Math.floor(y / bh); const off = row % 2 ? bwid / 2 : 0; const col = Math.floor((x + off) / bwid); const lx = (x + off) - col * bwid, ly = y - row * bh; return { id: (row * 37 + col * 11) % 400, mortar: lx < 3 || ly < 3 }; };
    const map = pixels(size, (x, y) => { const c = cell(x, y); const k = n[y * size + x]; if (c.mortar) return [150 + k * 30, 140 + k * 30, 125 + k * 25]; const [t, h] = tint[c.id]; return [(150 + k * 50) * t * (1 + h), (78 + k * 30) * t, (58 + k * 20) * t * (1 - h)]; });
    const height = heightCanvas(size, (x, y) => (cell(x, y).mortar ? 0.1 : 0.6 + n[y * size + x] * 0.3));
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 3), { srgb: false }) };
  });
}

// Pool-table felt: a fine nap.
export function feltTextures(color = 0x1f6a3a) {
  return once(`felt:${color}`, () => {
    const size = 256, base = rgb(color), n = noiseField(size, 64, 2, 2), m = noiseField(size, 4, 2, 5);
    const map = pixels(size, (x, y) => { const k = 0.9 + n[y * size + x] * 0.12 + m[y * size + x] * 0.08; return [base[0] * k, base[1] * k, base[2] * k]; });
    const height = heightCanvas(size, (x, y) => n[y * size + x]);
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, 0.6), { srgb: false }) };
  });
}

// Upholstery: 'weave' (sofa cloth), 'leather' (bar stools, booths), 'cotton' (bedding).
export function fabricTextures(color, kind = 'weave', seed = 1) {
  return once(`fabric:${color}:${kind}`, () => {
    const size = 256, base = rgb(color), n = noiseField(size, kind === 'leather' ? 24 : 8, 3, seed);
    const weave = (x, y) => (kind === 'weave' ? (Math.sin(x * 1.6) * Math.sin(y * 1.6) * 0.5 + 0.5) : kind === 'cotton' ? (Math.sin(x * 2.4) * 0.5 + 0.5) * 0.5 : 0);
    const map = pixels(size, (x, y) => { const i = y * size + x; const k = 0.82 + n[i] * 0.22 + weave(x, y) * 0.08; return [Math.min(255, base[0] * k), Math.min(255, base[1] * k), Math.min(255, base[2] * k)]; });
    const height = heightCanvas(size, (x, y) => (kind === 'leather' ? Math.pow(n[y * size + x], 2) : weave(x, y) * 0.7 + n[y * size + x] * 0.3));
    return { map: toTexture(map), normalMap: toTexture(heightToNormalCanvas(height, kind === 'leather' ? 2.2 : 1.5), { srgb: false }) };
  });
}

// Batik cloth (bed sheet, curtains, the safehouse wall hanging): parang diagonal bands with
// kawung rosettes.
export function batikTexture(bg = 0x6a3a1a, fg = 0xe8c890, seed = 2) {
  return once(`batik:${bg}:${fg}`, () => {
    const size = 256, c = makeCanvas(size), ctx = c.getContext('2d');
    const B = rgb(bg), F = rgb(fg);
    ctx.fillStyle = css(B); ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = css(F); ctx.fillStyle = css(F);
    for (let k = -8; k < 8; k++) {
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let t = 0; t <= size * 1.5; t += 4) { const x = t + k * 48, y = t + Math.sin(t * 0.12) * 6; ctx.lineTo(x, y); }
      ctx.stroke();
      for (let t = 12; t < size * 1.5; t += 26) {
        const x = t + k * 48 + 18, y = t - 6;
        ctx.beginPath(); ctx.ellipse(x, y, 7, 3.5, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, y, 3.5, 7, Math.PI / 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 0.25;
    const n = noiseField(size, 16, 2, seed);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < size * size; i++) { const k = 0.9 + n[i] * 0.2; img.data[i * 4] *= k; img.data[i * 4 + 1] *= k; img.data[i * 4 + 2] *= k; }
    ctx.putImageData(img, 0, 0);
    return toTexture(c);
  });
}

// Woven pandan mat / rug with a border.
export function rugTexture(c1 = 0x8a2a2a, c2 = 0xd8b070, c3 = 0x2a2a3a) {
  return once(`rug:${c1}`, () => {
    const size = 512, c = makeCanvas(size), ctx = c.getContext('2d');
    const A = css(rgb(c1)), Bc = css(rgb(c2)), C = css(rgb(c3));
    ctx.fillStyle = A; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = C; ctx.fillRect(18, 18, size - 36, size - 36);
    ctx.fillStyle = A; ctx.fillRect(40, 40, size - 80, size - 80);
    ctx.strokeStyle = Bc; ctx.lineWidth = 6;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); const s = 60 + i * 30; ctx.moveTo(size / 2, size / 2 - s * 1.4); ctx.lineTo(size / 2 + s, size / 2); ctx.lineTo(size / 2, size / 2 + s * 1.4); ctx.lineTo(size / 2 - s, size / 2); ctx.closePath(); ctx.stroke(); }
    for (let x = 30; x < size; x += 24) { ctx.fillStyle = Bc; ctx.fillRect(x, 26, 10, 8); ctx.fillRect(x, size - 34, 10, 8); }
    const n = noiseField(size, 128, 1, 3), img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < size * size; i++) { const k = 0.85 + n[i] * 0.25; img.data[i * 4] *= k; img.data[i * 4 + 1] *= k; img.data[i * 4 + 2] *= k; }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { repeat: false });
  });
}

// Chalkboard menu for the bar (prices in dollars, like the rest of the game).
export function chalkboardTexture(title, lines) {
  return once(`chalk:${title}`, () => {
    const c = makeCanvas(512, 640), ctx = c.getContext('2d');
    ctx.fillStyle = '#1c2420'; ctx.fillRect(0, 0, 512, 640);
    const n = noiseField(128, 16, 2, 4);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${0.02 + n[i % n.length] * 0.04})`; ctx.fillRect(Math.random() * 512, Math.random() * 640, 30, 2); }
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 26; ctx.strokeRect(0, 0, 512, 640);
    ctx.fillStyle = '#f4f0e0'; ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif'; ctx.fillText(title, 256, 92);
    ctx.font = 'italic 24px Georgia, serif'; ctx.fillStyle = '#f0c870'; ctx.fillText('~ sejak 1972 ~', 256, 128);
    ctx.textAlign = 'left'; ctx.font = '28px Georgia, serif';
    lines.forEach(([name, price], i) => {
      const y = 196 + i * 52;
      ctx.fillStyle = i % 2 ? '#e8f0f8' : '#f8e8e0'; ctx.fillText(name, 46, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffe080'; ctx.fillText(price, 466, y); ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(46, y + 12); ctx.lineTo(466, y + 12); ctx.stroke(); ctx.setLineDash([]);
    });
    return toTexture(c, { repeat: false });
  });
}

// Posters: concert, film, beer advert, football club, shipping line, clinic notices.
const POSTERS = {
  dangdut: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ff2a6a'); g.addColorStop(1, '#2a0a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = `hsla(${40 + i * 8},100%,60%,0.3)`; ctx.beginPath(); ctx.moveTo(w / 2, h * 0.38); ctx.arc(w / 2, h * 0.38, w, i * 0.45, i * 0.45 + 0.18); ctx.fill(); }
    ctx.fillStyle = '#ffe14a'; ctx.font = 'bold 44px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DANGDUT', w / 2, h * 0.62); ctx.fillText('MALAM MINGGU', w / 2, h * 0.7);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('bersama RATU AYU & OM PELABUHAN', w / 2, h * 0.78); ctx.fillText('LAPANGAN ALUN-ALUN · SABTU 20.00', w / 2, h * 0.84);
    ctx.fillStyle = '#1a0a1a'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.3, 46, 60, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w / 2 - 60, h * 0.38, 120, 90);
  },
  film: (ctx, w, h) => {
    ctx.fillStyle = '#0a1420'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h * 0.35, w * 0.8); g.addColorStop(0, '#d8502a'); g.addColorStop(1, '#0a1420'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h * 0.7);
    ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.moveTo(0, h * 0.62); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.58 + Math.sin(x * 0.05) * 12); ctx.lineTo(w, h * 0.7); ctx.lineTo(0, h * 0.7); ctx.fill();
    ctx.fillStyle = '#f0e8d0'; ctx.font = 'bold 50px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('OMBAK', w / 2, h * 0.8); ctx.fillText('BERDARAH', w / 2, h * 0.88);
    ctx.font = '18px sans-serif'; ctx.fillText('SEGERA DI BIOSKOP SANGGARA', w / 2, h * 0.95);
  },
  beer: (ctx, w, h) => {
    ctx.fillStyle = '#0e3a2a'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 8; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#e8c860'; ctx.font = 'bold 58px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('BIR', w / 2, h * 0.18); ctx.fillText('JANGKAR', w / 2, h * 0.28);
    ctx.fillStyle = '#c88a20'; ctx.fillRect(w * 0.36, h * 0.36, w * 0.28, h * 0.4); ctx.fillStyle = '#fff8e8'; ctx.fillRect(w * 0.35, h * 0.33, w * 0.3, h * 0.06);
    ctx.strokeStyle = '#e8c860'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(w * 0.68, h * 0.52, 30, -1.2, 1.2); ctx.stroke();
    ctx.fillStyle = '#f0e8d0'; ctx.font = 'italic 24px Georgia, serif'; ctx.fillText('Dingin seperti angin laut', w / 2, h * 0.86);
  },
  football: (ctx, w, h) => {
    ctx.fillStyle = '#f0e8d8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#b01e2a'; ctx.fillRect(0, 0, w, h * 0.22);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PERSIS SANGGARA', w / 2, h * 0.14);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const x = w * (0.1 + i * 0.16), y = h * (0.35 + row * 0.17); ctx.fillStyle = '#c8905a'; ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = row === 1 ? '#fff' : '#b01e2a'; ctx.fillRect(x - 24, y + 16, 48, 40); }
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('JUARA LIGA PESISIR 1998', w / 2, h * 0.94);
  },
  ship: (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f8d890'); g.addColorStop(0.6, '#e87a4a'); g.addColorStop(0.61, '#1a4a6a'); g.addColorStop(1, '#0a2a4a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0f0f0'; ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.58); ctx.lineTo(w * 0.85, h * 0.58); ctx.lineTo(w * 0.78, h * 0.66); ctx.lineTo(w * 0.22, h * 0.66); ctx.fill();
    ctx.fillRect(w * 0.35, h * 0.48, w * 0.3, h * 0.1); ctx.fillStyle = '#c03020'; ctx.fillRect(w * 0.47, h * 0.4, w * 0.07, h * 0.08);
    ctx.fillStyle = '#0a2a4a'; ctx.font = 'bold 34px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('PELNI SANGGARA', w / 2, h * 0.14);
    ctx.font = 'italic 22px Georgia, serif'; ctx.fillText('Menyambung Nusantara', w / 2, h * 0.2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.fillText('KM BINTANG TIMUR · SETIAP KAMIS', w / 2, h * 0.86);
  },
  health: (ctx, w, h) => {
    ctx.fillStyle = '#f4faf8'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a8a6a'; ctx.fillRect(0, 0, w, h * 0.18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CUCI TANGAN', w / 2, h * 0.12);
    for (let i = 0; i < 6; i++) { const x = w * (0.25 + (i % 2) * 0.5), y = h * (0.32 + Math.floor(i / 2) * 0.22); ctx.fillStyle = '#d8ece8'; ctx.beginPath(); ctx.arc(x, y, 50, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#c89070'; ctx.beginPath(); ctx.ellipse(x - 10, y, 18, 30, -0.4, 0, Math.PI * 2); ctx.ellipse(x + 12, y + 4, 18, 30, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1a8a6a'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(String(i + 1), x - 40, y - 34); }
  },
  wanted: (ctx, w, h) => {
    ctx.fillStyle = '#f0e8d0'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 50px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DICARI', w / 2, h * 0.13);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(w * 0.2, h * 0.18, w * 0.6, h * 0.45); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(w / 2, h * 0.34, 50, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w * 0.3, h * 0.45, w * 0.4, h * 0.2);
    ctx.font = 'bold 24px sans-serif'; ctx.fillText('KAWANAN HIU MERAH', w / 2, h * 0.72); ctx.font = '20px sans-serif'; ctx.fillText('Hubungi Polsek Kota Lama', w / 2, h * 0.8); ctx.fillText('Telp. 110', w / 2, h * 0.86);
  },
};

export function posterTexture(kind) {
  return once(`poster:${kind}`, () => {
    const w = 320, h = 448, c = makeCanvas(w, h), ctx = c.getContext('2d');
    POSTERS[kind](ctx, w, h);
    // Age: yellowed edges, creases and a little fading.
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.85); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, 'rgba(120,90,40,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2 + 6); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2 - 4, h); ctx.stroke();
    return toTexture(c, { repeat: false });
  });
}
export const POSTER_KINDS = Object.keys(POSTERS);

// Bottle labels: an atlas of 8 labels in a row (u wraps around the bottle).
export function labelAtlas() {
  return once('labels', () => {
    const w = 1024, h = 128, c = makeCanvas(w, h), ctx = c.getContext('2d');
    const L = [['#1a4a2a', '#e8c860', 'JANGKAR'], ['#f0e8d0', '#b01e2a', 'ARAK'], ['#2a1a0a', '#e8a840', 'RUM'], ['#0a1a3a', '#f0f0f0', 'GIN'], ['#8a1a1a', '#f0e0a0', 'ANGGUR'], ['#e8d890', '#2a2a2a', 'TUAK'], ['#3a2a5a', '#f0c8f0', 'LYCHEE'], ['#f0f0f0', '#1a5a8a', 'SODA']];
    L.forEach(([bg, fg, name], i) => {
      const x = i * 128;
      ctx.fillStyle = bg; ctx.fillRect(x, 0, 128, h);
      ctx.fillStyle = fg; ctx.fillRect(x, 10, 128, 4); ctx.fillRect(x, h - 14, 128, 4);
      ctx.font = 'bold 26px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText(name, x + 64, 74);
      ctx.font = '12px sans-serif'; ctx.fillText('SANGGARA', x + 64, 96);
      ctx.beginPath(); ctx.arc(x + 64, 36, 10, 0, Math.PI * 2); ctx.fill();
    });
    return toTexture(c, { repeat: false });
  });
}

// Neon tube lettering on a transparent background (mounted on walls as glowing signs).
export function neonTubeTexture(text, color, { w = 512, h = 128, font = 'bold italic 72px "Brush Script MT", cursive, sans-serif', script = true } = {}) {
  return once(`ntube:${text}:${color}:${w}`, () => {
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.font = script ? font : `bold ${Math.round(h * 0.55)}px Impact, sans-serif`;
    let size = parseInt(ctx.font.match(/(\d+)px/)[1], 10);
    while (ctx.measureText(text).width > w * 0.9 && size > 10) { size -= 2; ctx.font = ctx.font.replace(/\d+px/, size + 'px'); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = color; ctx.shadowBlur = 16; ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.strokeText(text, w / 2, h / 2);
    ctx.shadowBlur = 6; ctx.lineWidth = 4; ctx.strokeText(text, w / 2, h / 2);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6; ctx.strokeText(text, w / 2, h / 2);
    const t = toTexture(c, { repeat: false });
    return t;
  });
}

// A soft radial blob (fake contact shadows under furniture, lamp glows).
export function blobTexture() {
  return once('blob', () => {
    const s = 128, c = makeCanvas(s), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.55, 'rgba(0,0,0,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return toTexture(c, { repeat: false, srgb: false });
  });
}

export function glowTexture() {
  return once('glow', () => {
    const s = 128, c = makeCanvas(s), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return toTexture(c, { repeat: false });
  });
}

// Simple screen image for the TV (a football match at dusk).
export function tvScreenTexture() {
  const c = makeCanvas(256, 144), ctx = c.getContext('2d');
  const t = toTexture(c, { repeat: false });
  t.userData = { canvas: c, ctx };
  return t;
}

// Shelf goods for the warung: packets, cans, boxes in an atlas (8 x 4 cells).
export function goodsAtlas() {
  return once('goods', () => {
    const w = 1024, h = 512, c = makeCanvas(w, h), ctx = c.getContext('2d'), r = createRng(33);
    const brands = ['INDOMIE', 'KOPI', 'TEH', 'SUSU', 'SABUN', 'KACANG', 'KERUPUK', 'GULA', 'BERAS', 'SAMBAL', 'KECAP', 'BISKUIT', 'PERMEN', 'AQUA', 'SODA', 'ROKOK'];
    const cols = ['#d82a2a', '#f0c020', '#2a7ad8', '#2aa85a', '#f08a2a', '#8a2ab8', '#f0f0f0', '#1a1a1a'];
    for (let i = 0; i < 32; i++) {
      const x = (i % 8) * 128, y = Math.floor(i / 8) * 128;
      const bg = cols[r.int(0, cols.length - 1)], fg = bg === '#f0f0f0' || bg === '#f0c020' ? '#1a1a1a' : '#ffffff';
      ctx.fillStyle = bg; ctx.fillRect(x, y, 128, 128);
      ctx.fillStyle = cols[r.int(0, cols.length - 1)]; ctx.fillRect(x, y + 80, 128, 20);
      ctx.fillStyle = fg; ctx.font = 'bold 22px Impact, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(brands[i % brands.length], x + 64, y + 50);
      ctx.beginPath(); ctx.arc(x + 64, y + 18, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.strokeRect(x + 1, y + 1, 126, 126);
    }
    return toTexture(c, { repeat: false });
  });
}

export function materialFromTextures(tex, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.normalMap || null, roughnessMap: tex.roughnessMap || null, roughness: 1, metalness: 0, ...opts });
  return m;
}
