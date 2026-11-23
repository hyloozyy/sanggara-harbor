// Ground and material surfaces: wet asphalt with lane markings, pavers, sand, grass, corrugated metal, water ripples.
import { makeCanvas, noiseField, paintNoise, speckle, heightToNormalCanvas, toTexture } from './canvas-tools.js';
import { createRng } from '../core/rng.js';

const rng = createRng(77);

function asphaltBase(size, seed) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const n = noiseField(size, 8, 5, seed);
  paintNoise(ctx, size, n, [58, 57, 60], 0.11);
  speckle(ctx, size, size, size * 6, ['#77767a', '#2e2d31', '#8a8580', '#444247'], rng, 1, 2);
  // Tar seams and oil stains.
  ctx.strokeStyle = 'rgba(20,20,22,0.55)';
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = rng.range(1, 3);
    ctx.beginPath();
    let x = rng.next() * size, y = rng.next() * size;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += rng.range(-40, 40); y += rng.range(-40, 40); ctx.lineTo(x, y); }
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(15,14,18,0.45)'); g.addColorStop(1, 'rgba(15,14,18,0)');
    ctx.save(); ctx.translate(rng.next() * size, rng.next() * size); ctx.scale(rng.range(10, 30), rng.range(20, 50));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  return c;
}

// Roughness map: puddles and the worn wheel tracks are glossy, the rest is matte.
function wetRoughness(size, seed, tracks) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const n = noiseField(size, 4, 4, seed);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let r = 0.78 - Math.max(0, n[i] - 0.52) * 3.2;
      if (tracks) {
        const u = x / size;
        for (const t of tracks) r -= Math.exp(-((u - t) ** 2) / 0.0012) * 0.22;
      }
      r = Math.min(1, Math.max(0.08, r));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = r * 255;
      img.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Road strip texture: u spans the road width (11 m), v spans 12 m along the road.
export function roadTextures() {
  const size = 512;
  const c = asphaltBase(size, 11);
  const ctx = c.getContext('2d');
  const px = size / 11;
  ctx.fillStyle = 'rgba(235,232,220,0.9)';
  // Edge lines.
  ctx.fillRect(px * 0.55, 0, px * 0.15, size);
  ctx.fillRect(size - px * 0.7, 0, px * 0.15, size);
  // Centre dashes: 4 m dash, 8 m gap (half texture each side).
  ctx.fillRect(size / 2 - px * 0.08, 0, px * 0.16, size * (4 / 12));
  // Worn tyre darkening.
  ctx.fillStyle = 'rgba(25,25,28,0.18)';
  for (const t of [0.2, 0.33, 0.67, 0.8]) ctx.fillRect(t * size - px * 0.4, 0, px * 0.8, size);
  const rough = wetRoughness(size, 12, [0.2, 0.33, 0.67, 0.8]);
  return { map: toTexture(c), roughnessMap: toTexture(rough, { srgb: false }) };
}

export function asphaltTextures() {
  const c = asphaltBase(512, 21);
  return { map: toTexture(c), roughnessMap: toTexture(wetRoughness(512, 22), { srgb: false }) };
}

// Zebra crossing decal, transparent outside the stripes.
export function crosswalkTexture() {
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = 'rgba(240,238,228,0.88)';
    ctx.fillRect(8 + i * 31, 8, 18, 112);
  }
  return toTexture(c, { repeat: false });
}

export function paverTextures() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const h = makeCanvas(size);
  const hctx = h.getContext('2d');
  hctx.fillStyle = '#000'; hctx.fillRect(0, 0, size, size);
  const n = noiseField(size, 8, 3, 31);
  paintNoise(ctx, size, n, [150, 140, 128], 0.08);
  const tile = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const off = (y % 2) * tile / 2;
      const shade = rng.range(-14, 14);
      ctx.fillStyle = `rgba(${150 + shade},${138 + shade},${122 + shade},0.55)`;
      ctx.fillRect(x * tile + off + 1, y * tile + 1, tile - 2, tile - 2);
      hctx.fillStyle = '#fff';
      hctx.fillRect(x * tile + off + 1.5, y * tile + 1.5, tile - 3, tile - 3);
      if (x === 7 && off) { ctx.fillRect(off - tile + 1, y * tile + 1, tile - 2, tile - 2); hctx.fillRect(off - tile + 1.5, y * tile + 1.5, tile - 3, tile - 3); }
    }
  }
  ctx.strokeStyle = 'rgba(60,55,50,0.6)';
  return { map: toTexture(c), normalMap: toTexture(heightToNormalCanvas(h, 1.5), { srgb: false }) };
}

export function concreteTexture(seed = 41, tint = [170, 166, 158]) {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  paintNoise(ctx, size, noiseField(size, 6, 5, seed), tint, 0.09);
  speckle(ctx, size, size, 900, ['rgba(80,80,80,0.3)', 'rgba(220,220,210,0.3)'], rng);
  // Rain streaks.
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(60,55,50,0.07)';
    ctx.fillRect(rng.next() * size, rng.next() * size * 0.3, rng.range(1, 4), rng.range(40, 160));
  }
  return toTexture(c);
}

export function sandTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  paintNoise(ctx, size, noiseField(size, 4, 5, 51), [214, 186, 140], 0.1);
  speckle(ctx, size, size, 3000, ['rgba(255,240,210,0.5)', 'rgba(150,120,90,0.4)'], rng, 1, 1.5);
  // Ripples.
  ctx.strokeStyle = 'rgba(160,130,95,0.18)';
  for (let y = 0; y < size; y += 9) {
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 3);
    ctx.stroke();
  }
  return toTexture(c);
}

export function grassTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  paintNoise(ctx, size, noiseField(size, 5, 5, 61), [82, 112, 52], 0.16);
  for (let i = 0; i < 2500; i++) {
    ctx.strokeStyle = rng.pick(['rgba(120,150,70,0.5)', 'rgba(50,80,35,0.5)', 'rgba(150,160,80,0.4)']);
    const x = rng.next() * size, y = rng.next() * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 5)); ctx.stroke();
  }
  return toTexture(c);
}

// Vertical ribs, used for warehouses and shipping containers (tinted by material colour).
export function corrugatedTextures() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const h = makeCanvas(size);
  const hctx = h.getContext('2d');
  for (let x = 0; x < size; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 16);
    const g = Math.round(185 + v * 50);
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x, 0, 1, size);
    hctx.fillStyle = `rgb(${Math.round(v * 255)},0,0)`;
    hctx.fillRect(x, 0, 1, size);
  }
  // Rust and grime.
  const n = noiseField(size, 6, 4, 71);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const r = Math.max(0, n[i] - 0.58) * 3;
    img.data[i * 4] -= r * 40; img.data[i * 4 + 1] -= r * 80; img.data[i * 4 + 2] -= r * 110;
  }
  ctx.putImageData(img, 0, 0);
  return { map: toTexture(c), normalMap: toTexture(heightToNormalCanvas(h, 3), { srgb: false }) };
}

export function clayTileTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a4472c'; ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const s = rng.range(-20, 20);
      const g = ctx.createLinearGradient(0, y * 16, 0, y * 16 + 16);
      g.addColorStop(0, `rgb(${190 + s},${92 + s * 0.5},${58})`);
      g.addColorStop(1, `rgb(${120 + s},${50 + s * 0.4},${34})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x * 16 + 8 + (y % 2) * 8, y * 16 + 9, 7.5, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(c);
}

export function roofTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  paintNoise(ctx, size, noiseField(size, 8, 4, 81), [110, 106, 100], 0.12);
  speckle(ctx, size, size, 4000, ['#8a857c', '#5c5852', '#9c968d'], rng, 1, 2);
  ctx.strokeStyle = 'rgba(40,40,40,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  return toTexture(c);
}

export function woodPlankTexture() {
  const size = 256;
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++) {
    const s = rng.range(-18, 18);
    ctx.fillStyle = `rgb(${120 + s},${86 + s},${58 + s * 0.5})`;
    ctx.fillRect(0, y * 32, size, 31);
    ctx.fillStyle = 'rgba(40,25,15,0.5)';
    ctx.fillRect(0, y * 32 + 31, size, 1);
    for (let k = 0; k < 20; k++) {
      ctx.fillStyle = 'rgba(60,40,25,0.15)';
      ctx.fillRect(rng.next() * size, y * 32 + rng.next() * 30, rng.range(20, 90), 1);
    }
  }
  return toTexture(c);
}

// Soft rolling ripples for the harbour and the sea; scrolled every frame.
export function waterNormalTexture() {
  const size = 256;
  const h = makeCanvas(size);
  const ctx = h.getContext('2d');
  const n1 = noiseField(size, 8, 4, 91);
  const n2 = noiseField(size, 16, 3, 92);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const y = Math.floor(i / size);
    const v = n1[i] * 0.6 + n2[i] * 0.4 + Math.sin(y / size * Math.PI * 2 * 6) * 0.05;
    img.data[i * 4] = Math.max(0, Math.min(255, v * 255));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(heightToNormalCanvas(h, 6), { srgb: false });
}

export function radialSpriteTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.5)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return toTexture(c, { repeat: false });
}
