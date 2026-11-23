// Building facade atlases: 8 bays x 8 floors per texture with colour, lit-window emissive
// and a packed roughness(G)/metalness(B) map, in several architectural styles.
import { makeCanvas, toTexture } from './canvas-tools.js';
import { createRng } from '../core/rng.js';

const BAYS = 8, FLOORS = 8, SIZE = 512, CELL = SIZE / BAYS;

const LIGHT_COLORS = ['#ffd9a0', '#ffcf86', '#ffe7c0', '#fff1d8', '#cfe2ff', '#ffb870', '#a9c8ff'];

function rgb(c, k = 1) { return `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`; }

// Each style draws one bay (window cell) into the three canvases.
const STYLES = {
  glass(ctx, ectx, octx, x, y, s, lit, light) {
    const g = ctx.createLinearGradient(x, y, x + CELL, y + CELL);
    g.addColorStop(0, rgb(s.glass, 1.15)); g.addColorStop(1, rgb(s.glass, 0.8));
    ctx.fillStyle = g; ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, 3); ctx.fillRect(x, y, 2, CELL);
    ctx.fillStyle = rgb(s.wall, 0.8); ctx.fillRect(x, y + CELL * 0.82, CELL, 5);
    octx.fillStyle = 'rgb(0,18,150)'; octx.fillRect(x + 2, y + 3, CELL - 2, CELL * 0.82 - 3);
    if (lit) { ectx.fillStyle = light; ectx.globalAlpha = 0.55; ectx.fillRect(x + 2, y + 3, CELL - 2, CELL * 0.79 - 3); ectx.globalAlpha = 1; }
  },
  office(ctx, ectx, octx, x, y, s, lit, light) {
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = rgb(s.wall, 0.86); ctx.fillRect(x, y + CELL * 0.78, CELL, CELL * 0.22);
    ctx.fillStyle = rgb(s.glass); ctx.fillRect(x, y + CELL * 0.18, CELL, CELL * 0.5);
    ctx.fillStyle = rgb(s.wall, 0.7); ctx.fillRect(x + CELL / 2 - 1, y + CELL * 0.18, 2, CELL * 0.5);
    octx.fillStyle = 'rgb(0,25,110)'; octx.fillRect(x, y + CELL * 0.18, CELL, CELL * 0.5);
    if (lit) { ectx.fillStyle = light; ectx.globalAlpha = 0.7; ectx.fillRect(x, y + CELL * 0.18, CELL, CELL * 0.5); ectx.globalAlpha = 1; }
  },
  ruko(ctx, ectx, octx, x, y, s, lit, light, rng) {
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x, y + CELL - 6, CELL, 6);
    const wx = x + 12, wy = y + 14, ww = CELL - 24, wh = CELL - 30;
    ctx.fillStyle = rgb(s.trim); ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    ctx.fillStyle = lit ? '#3a3028' : rgb(s.glass); ctx.fillRect(wx, wy, ww, wh);
    octx.fillStyle = 'rgb(0,40,40)'; octx.fillRect(wx, wy, ww, wh);
    if (rng.chance(0.45)) { // louvred shutters
      ctx.fillStyle = rgb(s.trim, 0.9);
      for (let k = 0; k < wh; k += 4) ctx.fillRect(wx, wy + k, ww * 0.3, 2), ctx.fillRect(wx + ww * 0.7, wy + k, ww * 0.3, 2);
    }
    if (lit) { ectx.fillStyle = light; ectx.fillRect(wx + ww * 0.3, wy, ww * 0.4, wh); }
    if (rng.chance(0.25)) { ctx.fillStyle = '#d8d8d2'; ctx.fillRect(wx + ww - 14, wy + wh + 2, 16, 9); } // AC unit
  },
  colonial(ctx, ectx, octx, x, y, s, lit, light) {
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = rgb(s.wall, 0.82); ctx.fillRect(x, y + CELL - 5, CELL, 5);
    const wx = x + 18, wy = y + 12, ww = CELL - 36, wh = CELL - 22;
    ctx.fillStyle = rgb(s.trim);
    ctx.fillRect(wx - 7, wy + 6, 6, wh - 6); ctx.fillRect(wx + ww + 1, wy + 6, 6, wh - 6);
    ctx.fillStyle = lit ? '#2b2018' : '#1d2630';
    ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx, wy + ww / 2); ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0); ctx.lineTo(wx + ww, wy + wh); ctx.fill();
    ctx.strokeStyle = rgb(s.wall, 1.08); ctx.lineWidth = 3; ctx.stroke();
    octx.fillStyle = 'rgb(0,30,40)'; octx.fillRect(wx, wy + ww / 2, ww, wh - ww / 2);
    if (lit) { ectx.fillStyle = light; ectx.fillRect(wx + 2, wy + ww / 2, ww - 4, wh - ww / 2); }
  },
  apartment(ctx, ectx, octx, x, y, s, lit, light, rng) {
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = rgb(s.glass); ctx.fillRect(x + 8, y + 10, CELL - 16, CELL - 26);
    octx.fillStyle = 'rgb(0,30,60)'; octx.fillRect(x + 8, y + 10, CELL - 16, CELL - 26);
    if (lit) { ectx.fillStyle = light; ectx.fillRect(x + 10, y + 12, CELL - 20, CELL - 30); }
    // balcony slab and rail
    ctx.fillStyle = rgb(s.trim); ctx.fillRect(x, y + CELL - 16, CELL, 4);
    ctx.fillStyle = rgb(s.trim, 0.8);
    for (let k = 4; k < CELL; k += 6) ctx.fillRect(x + k, y + CELL - 28, 2, 12);
    ctx.fillRect(x, y + CELL - 29, CELL, 2);
    if (rng.chance(0.2)) { ctx.fillStyle = rng.pick(['#d04848', '#3a7bd5', '#f0c040', '#ffffff']); ctx.fillRect(x + 14, y + CELL - 26, 12, 9); }
  },
  villa(ctx, ectx, octx, x, y, s, lit, light) {
    ctx.fillStyle = rgb(s.wall); ctx.fillRect(x, y, CELL, CELL);
    ctx.fillStyle = rgb(s.trim); ctx.fillRect(x + 6, y + 8, CELL - 12, CELL - 14);
    ctx.fillStyle = rgb(s.glass); ctx.fillRect(x + 9, y + 11, CELL - 18, CELL - 20);
    ctx.fillStyle = rgb(s.trim); ctx.fillRect(x + CELL / 2 - 1, y + 11, 2, CELL - 20);
    octx.fillStyle = 'rgb(0,20,60)'; octx.fillRect(x + 9, y + 11, CELL - 18, CELL - 20);
    if (lit) { ectx.fillStyle = light; ectx.fillRect(x + 9, y + 11, CELL - 18, CELL - 20); }
  },
  warehouse(ctx, ectx, octx, x, y, s, lit, light) {
    for (let k = 0; k < CELL; k += 4) { ctx.fillStyle = rgb(s.wall, k % 8 ? 0.92 : 1.05); ctx.fillRect(x + k, y, 4, CELL); }
    if ((y / CELL) % 4 === 1) {
      ctx.fillStyle = rgb(s.glass); ctx.fillRect(x + 6, y + 20, CELL - 12, 16);
      octx.fillStyle = 'rgb(0,40,60)'; octx.fillRect(x + 6, y + 20, CELL - 12, 16);
      if (lit) { ectx.fillStyle = light; ectx.fillRect(x + 6, y + 20, CELL - 12, 16); }
    }
  },
};

export const FACADE_PALETTES = {
  glass: [
    { wall: [70, 80, 92], glass: [60, 105, 125] },
    { wall: [190, 190, 185], glass: [40, 80, 110] },
    { wall: [40, 44, 52], glass: [80, 95, 105] },
    { wall: [150, 120, 90], glass: [95, 85, 70] },
  ],
  office: [
    { wall: [205, 200, 188], glass: [52, 70, 88] },
    { wall: [168, 150, 128], glass: [45, 58, 70] },
    { wall: [120, 128, 136], glass: [40, 52, 66] },
  ],
  ruko: [
    { wall: [232, 214, 170], trim: [60, 120, 110], glass: [48, 52, 58] },
    { wall: [214, 120, 92], trim: [240, 236, 220], glass: [40, 44, 50] },
    { wall: [140, 196, 186], trim: [250, 245, 230], glass: [45, 50, 55] },
    { wall: [242, 196, 98], trim: [120, 70, 50], glass: [45, 45, 50] },
    { wall: [196, 160, 200], trim: [250, 250, 245], glass: [40, 45, 55] },
    { wall: [235, 235, 225], trim: [180, 60, 50], glass: [40, 45, 55] },
  ],
  colonial: [
    { wall: [238, 232, 214], trim: [46, 92, 70], glass: [30, 34, 40] },
    { wall: [230, 214, 178], trim: [60, 60, 70], glass: [30, 34, 40] },
    { wall: [222, 226, 220], trim: [120, 70, 50], glass: [30, 34, 40] },
  ],
  apartment: [
    { wall: [222, 210, 190], trim: [200, 200, 200], glass: [50, 60, 72] },
    { wall: [180, 205, 220], trim: [245, 245, 245], glass: [45, 55, 70] },
    { wall: [235, 180, 140], trim: [250, 240, 230], glass: [50, 55, 65] },
  ],
  villa: [
    { wall: [245, 238, 222], trim: [90, 70, 55], glass: [55, 75, 90] },
    { wall: [236, 222, 200], trim: [50, 50, 55], glass: [55, 75, 90] },
  ],
  warehouse: [
    { wall: [150, 158, 165], glass: [70, 90, 100] },
    { wall: [170, 120, 80], glass: [70, 90, 100] },
    { wall: [90, 120, 140], glass: [70, 90, 100] },
  ],
};

export const FACADE_BAYS = BAYS;
export const FACADE_FLOORS = FLOORS;

export function facadeTextures(style, paletteIndex, seed = 1, litChance = 0.24) {
  const rng = createRng(seed * 131 + paletteIndex * 17 + style.length);
  const palette = FACADE_PALETTES[style][paletteIndex % FACADE_PALETTES[style].length];
  const c = makeCanvas(SIZE), e = makeCanvas(SIZE), o = makeCanvas(SIZE);
  const ctx = c.getContext('2d'), ectx = e.getContext('2d'), octx = o.getContext('2d');
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, SIZE, SIZE);
  octx.fillStyle = 'rgb(0,225,0)'; octx.fillRect(0, 0, SIZE, SIZE); // matte, non-metal walls
  const draw = STYLES[style];
  for (let fy = 0; fy < FLOORS; fy++) {
    const floorLit = rng.chance(0.14);
    const light = rng.pick(LIGHT_COLORS);
    for (let bx = 0; bx < BAYS; bx++) {
      const lit = floorLit ? rng.chance(0.85) : rng.chance(litChance);
      draw(ctx, ectx, octx, bx * CELL, fy * CELL, palette, lit, floorLit ? light : rng.pick(LIGHT_COLORS), rng);
    }
  }
  // Weathering gradient (darker at the bottom of each texture repeat is invisible; use light grime streaks).
  ctx.fillStyle = 'rgba(40,30,20,0.05)';
  for (let i = 0; i < 40; i++) ctx.fillRect(rng.next() * SIZE, rng.next() * SIZE, rng.range(1, 3), rng.range(20, 80));
  return {
    map: toTexture(c),
    emissiveMap: toTexture(e),
    ormMap: toTexture(o, { srgb: false }),
  };
}
