// Canvas helpers for procedural textures: tileable value noise, speckle, and height-to-normal maps.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Tileable value-noise field in [0,1], `cells` lattice cells across, summed over octaves.
export function noiseField(size, cells, octaves = 4, seed = 1) {
  const rng = createRng(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0, c = cells;
  for (let o = 0; o < octaves; o++) {
    const lattice = new Float32Array(c * c).map(() => rng.next());
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * c, iy = Math.floor(fy), ty = fy - iy;
      const sy = ty * ty * (3 - 2 * ty);
      const y0 = iy % c, y1 = (iy + 1) % c;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * c, ix = Math.floor(fx), tx = fx - ix;
        const sx = tx * tx * (3 - 2 * tx);
        const x0 = ix % c, x1 = (ix + 1) % c;
        const a = lattice[y0 * c + x0], b = lattice[y0 * c + x1];
        const d = lattice[y1 * c + x0], e = lattice[y1 * c + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) + ((d + (e - d) * sx) - (a + (b - a) * sx)) * sy);
      }
    }
    total += amp; amp *= 0.5; c *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// Paint a grayscale-ish noise layer onto a canvas using base colour +/- variation.
export function paintNoise(ctx, size, field, base, variation, alpha = 1) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const n = (field[i] - 0.5) * 2 * variation;
    d[i * 4] = d[i * 4] * (1 - alpha) + (base[0] + n * 255) * alpha;
    d[i * 4 + 1] = d[i * 4 + 1] * (1 - alpha) + (base[1] + n * 255) * alpha;
    d[i * 4 + 2] = d[i * 4 + 2] * (1 - alpha) + (base[2] + n * 255) * alpha;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function speckle(ctx, w, h, count, colors, rng, sizeMin = 1, sizeMax = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rng.pick(colors);
    const s = rng.range(sizeMin, sizeMax);
    ctx.fillRect(rng.next() * w, rng.next() * h, s, s);
  }
}

// Builds a tangent-space normal map from a canvas whose red channel is height.
export function heightToNormalCanvas(source, strength = 2) {
  const w = source.width, h = source.height;
  const src = source.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = (-dx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export function toTexture(canvas, { srgb = true, repeat = true, anisotropy = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = anisotropy;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
