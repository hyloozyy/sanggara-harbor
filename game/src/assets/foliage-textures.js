// Canvas textures for vegetation: a coconut frond card (midrib with drooping leaflets, alpha
// cut-out), leaf-cluster cards for shade trees (overlapping leaves in several greens), ringed
// palm bark and furrowed tree bark, and a tufted grass card.
import { makeCanvas, toTexture } from './canvas-tools.js';
import { createRng } from '../core/rng.js';

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

// A frond seen from above: midrib along the card's length (v), leaflets angled outwards.
export function palmFrondTexture() {
  const W = 128, H = 512;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const r = createRng(31);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const y = H * (0.04 + t * 0.94);
    const len = W * 0.5 * Math.sin(Math.min(1, t * 1.25 + 0.08) * Math.PI) * (0.85 + r.next() * 0.25);
    for (const s of [-1, 1]) {
      const light = 28 + r.next() * 14 - t * 6;
      g.strokeStyle = hsl(78 + r.next() * 22, 45 + r.next() * 20, light);
      g.lineWidth = 3.4 - t * 1.2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(W / 2, y);
      g.quadraticCurveTo(W / 2 + s * len * 0.5, y - 10, W / 2 + s * len, y + 18 + t * 10);
      g.stroke();
      // sunlit edge
      g.strokeStyle = hsl(70, 50, light + 14, 0.5); g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(W / 2, y - 1); g.quadraticCurveTo(W / 2 + s * len * 0.5, y - 11, W / 2 + s * len, y + 17 + t * 10); g.stroke();
      if (r.chance(0.12)) { g.strokeStyle = hsl(40, 45, 45); g.lineWidth = 2; g.beginPath(); g.moveTo(W / 2 + s * len * 0.8, y + 12); g.lineTo(W / 2 + s * len, y + 18 + t * 10); g.stroke(); }
    }
  }
  g.strokeStyle = hsl(55, 35, 52); g.lineWidth = 4;
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
  const t = toTexture(c, { repeat: false });
  return t;
}

// Clusters of overlapping leaves on a transparent card.
export function leafClusterTexture(seed = 5, hue = 100) {
  const S = 256;
  const c = makeCanvas(S), g = c.getContext('2d');
  const r = createRng(seed);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const a = r.next() * Math.PI * 2, d = Math.sqrt(r.next()) * S * 0.44;
    const x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d;
    const len = 14 + r.next() * 12, w = len * 0.45;
    const rot = a + r.range(-0.8, 0.8);
    const l = 18 + r.next() * 22 + (y < S / 2 ? 6 : -4);
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = hsl(hue + r.range(-18, 18), 40 + r.next() * 25, l);
    g.beginPath(); g.ellipse(len / 2, 0, len / 2, w / 2, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = hsl(hue, 30, l + 12, 0.6); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
    g.restore();
  }
  return toTexture(c, { repeat: false });
}

// Grey-brown palm bark with leaf-scar rings (tiles along the trunk).
export function palmBarkTexture() {
  const W = 64, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const r = createRng(12);
  g.fillStyle = '#7a6650'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r.chance(0.5) ? '40,30,20' : '200,190,170'},${r.range(0.05, 0.15)})`; g.fillRect(r.next() * W, r.next() * H, r.range(2, 8), r.range(1, 3)); }
  for (let y = 0; y < H; y += 16) {
    const j = r.range(-2, 2);
    g.fillStyle = 'rgba(40,28,18,0.55)'; g.fillRect(0, y + j, W, 3);
    g.fillStyle = 'rgba(220,205,180,0.25)'; g.fillRect(0, y + j + 3, W, 2);
  }
  return toTexture(c, { repeat: true });
}

export function barkTexture() {
  const W = 128, H = 256;
  const c = makeCanvas(W, H), g = c.getContext('2d');
  const r = createRng(13);
  g.fillStyle = '#5e4a38'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = r.next() * W;
    g.strokeStyle = `rgba(${r.chance(0.6) ? '28,20,14' : '150,130,105'},${r.range(0.2, 0.5)})`;
    g.lineWidth = r.range(1, 3);
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= H; y += 16) g.lineTo(x + Math.sin(y * 0.05 + i) * 3, y);
    g.stroke();
  }
  return toTexture(c, { repeat: true });
}

export function grassTuftTexture() {
  const S = 128;
  const c = makeCanvas(S), g = c.getContext('2d');
  const r = createRng(21);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) {
    const x = S * 0.1 + r.next() * S * 0.8, h = S * (0.35 + r.next() * 0.6);
    g.strokeStyle = hsl(80 + r.range(-15, 15), 40 + r.next() * 20, 22 + r.next() * 20);
    g.lineWidth = 1.5 + r.next() * 1.5;
    g.beginPath(); g.moveTo(x, S); g.quadraticCurveTo(x + r.range(-8, 8), S - h * 0.6, x + r.range(-18, 18), S - h); g.stroke();
  }
  return toTexture(c, { repeat: false });
}
