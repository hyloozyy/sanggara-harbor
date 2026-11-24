// Shopfronts, neon signs and billboards with invented local brands, drawn on canvas atlases.
import { makeCanvas, toTexture } from './canvas-tools.js';
import { createRng } from '../core/rng.js';

export const SHOP_NAMES = [
  ['SINAR JAYA STORE', '#c0392b', '#fff3c4'],
  ['WARUNG BU LASTRI', '#1f6f5c', '#ffe08a'],
  ['SEHAT PHARMACY', '#2e7d32', '#ffffff'],
  ['KOPI KAPAL', '#3b2a20', '#ffb35a'],
  ['MARTABAK BULAN', '#f2a516', '#3a1a08'],
  ['SANGGARA CELL', '#1d4fa3', '#9ff3ff'],
  ['MULIA GOLD', '#7a1020', '#ffd76a'],
  ['BAKSO PAK GENDUT', '#d35400', '#fffbe8'],
];

const PANEL = 256, COLS = 4, ROWS = 2;
export const SHOP_PANEL_COUNT = COLS * ROWS;

function fitText(ctx, text, maxW, size, font = 'bold') {
  let s = size;
  do { ctx.font = `${font} ${s}px "Trebuchet MS", "DejaVu Sans", Arial, sans-serif`; s -= 1; } while (ctx.measureText(text).width > maxW && s > 8);
}

// Shopfront atlas: u picks a panel column, v picks the row.
export function shopfrontTextures() {
  const rng = createRng(404);
  const c = makeCanvas(PANEL * COLS, PANEL * ROWS);
  const e = makeCanvas(PANEL * COLS, PANEL * ROWS);
  const ctx = c.getContext('2d'), ectx = e.getContext('2d');
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, e.width, e.height);
  SHOP_NAMES.forEach(([name, bg, fg], i) => {
    const x = (i % COLS) * PANEL, y = Math.floor(i / COLS) * PANEL;
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(x, y, PANEL, PANEL);
    // Sign board.
    ctx.fillStyle = bg; ctx.fillRect(x + 6, y + 8, PANEL - 12, 54);
    ctx.fillStyle = fg; fitText(ctx, name, PANEL - 28, 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, x + PANEL / 2, y + 36);
    ectx.fillStyle = fg; fitText(ectx, name, PANEL - 28, 30); ectx.textAlign = 'center'; ectx.textBaseline = 'middle';
    ectx.globalAlpha = 0.9; ectx.fillText(name, x + PANEL / 2, y + 36); ectx.globalAlpha = 1;
    ectx.strokeStyle = bg; ectx.globalAlpha = 0.35; ectx.lineWidth = 3; ectx.strokeRect(x + 8, y + 10, PANEL - 16, 50); ectx.globalAlpha = 1;
    // Awning stripes.
    for (let k = 0; k < PANEL; k += 16) { ctx.fillStyle = (k / 16) % 2 ? bg : '#f4efe4'; ctx.fillRect(x + k, y + 66, 16, 18); }
    // Lit interior behind glass.
    const g = ctx.createLinearGradient(0, y + 88, 0, y + 238);
    g.addColorStop(0, '#f6d7a0'); g.addColorStop(1, '#8a5a34');
    ctx.fillStyle = g; ctx.fillRect(x + 10, y + 88, PANEL - 20, 150);
    const ge = ectx.createLinearGradient(0, y + 88, 0, y + 238);
    ge.addColorStop(0, '#ffcc88'); ge.addColorStop(1, '#6a3c1c');
    ectx.fillStyle = ge; ectx.fillRect(x + 10, y + 88, PANEL - 20, 150);
    // Shelves and goods silhouettes.
    for (let s = 0; s < 3; s++) {
      ctx.fillStyle = 'rgba(70,40,20,0.75)'; ctx.fillRect(x + 14, y + 120 + s * 36, PANEL - 28, 4);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = rng.pick(['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#ecf0f1', '#8e44ad']);
        ctx.fillRect(x + 18 + k * 16, y + 104 + s * 36, 10, 16);
      }
    }
    // Window frame and door.
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 5; ctx.strokeRect(x + 10, y + 88, PANEL - 20, 150);
    ctx.fillStyle = 'rgba(30,30,35,0.55)'; ctx.fillRect(x + PANEL - 80, y + 120, 56, 118);
    ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x, y + 240, PANEL, 16);
  });
  return { map: toTexture(c, { repeat: false }), emissiveMap: toTexture(e, { repeat: false }) };
}

export const BILLBOARDS = [
  { brand: 'KOPI KAPAL', line: 'Bitter on the tongue, sweet in the harbour', bg: ['#2b1a12', '#7a3a1a'], fg: '#ffcf7a' },
  { brand: 'SANGGARA SELULER', line: 'Full signal all the way out to sea', bg: ['#0a2a6a', '#1aa0d8'], fg: '#ffffff' },
  { brand: 'SAMBAL NYALA', line: 'Hot enough to wake you up', bg: ['#8a0a0a', '#ff5a1a'], fg: '#fff2a0' },
  { brand: 'MOTOR KILAT 125', line: 'Thrifty, nimble, never stalls', bg: ['#101010', '#3a3a3a'], fg: '#ffd400' },
];

export function billboardTextures() {
  const c = makeCanvas(1024, 512);
  const e = makeCanvas(1024, 512);
  const ctx = c.getContext('2d'), ectx = e.getContext('2d');
  BILLBOARDS.forEach((b, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256;
    const g = ctx.createLinearGradient(x, y, x + 512, y + 256);
    g.addColorStop(0, b.bg[0]); g.addColorStop(1, b.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(x, y, 512, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(x + 420, y + 128, 110, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = b.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    fitText(ctx, b.brand, 440, 64, 'bold italic'); ctx.fillText(b.brand, x + 28, y + 120);
    fitText(ctx, b.line, 440, 26, 'normal'); ctx.fillText(b.line, x + 30, y + 170);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 30, y + 190, 120, 4);
    ectx.drawImage(c, x, y, 512, 256, x, y, 512, 256);
  });
  ectx.globalCompositeOperation = 'multiply';
  ectx.fillStyle = '#7a7a7a'; ectx.fillRect(0, 0, 1024, 512);
  return { map: toTexture(c, { repeat: false }), emissiveMap: toTexture(e, { repeat: false }) };
}

// A neon word drawn as glowing tubes; used on the beach boulevard and in the old town at night.
export function neonSignTexture(text, color) {
  const c = makeCanvas(512, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, 512, 128);
  fitText(ctx, text, 470, 72, 'bold italic');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = 18;
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeText(text, 256, 66);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.strokeText(text, 256, 66);
  return toTexture(c, { repeat: false });
}

// Street-name plate used on the corner poles.
export function plateTexture(text) {
  const c = makeCanvas(256, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a5c3a'; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = '#fff'; fitText(ctx, text, 230, 30); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  return toTexture(c, { repeat: false });
}
