// Paints one person's texture atlas from their look: a face (skin with subtle shading,
// eye sockets, lash lines, brows, nose, lips, make-up, stubble, beards, wrinkles, freckles),
// scalp hair, irises, and every garment (prints, necklines, plackets, buttons, pockets, seams,
// belts, hems, cuffs), shoes, hats and bags.
import * as THREE from 'three';
import { ATLAS_SIZE, REGIONS, regionPx, headU, headV, HEAD_V0, HEAD_V1 } from './atlas-layout.js';
import { paintFabric, shade, css, grain } from './fabric-patterns.js';
import { createRng } from '../core/rng.js';
import { HEAD_C } from './body-geometry.js';

const rgba = (hex, a) => `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`;
const mix = (a, b, t) => {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t, g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t, bl = (a & 255) * (1 - t) + (b & 255) * t;
  return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
};

// Head-local point (metres, relative to the head centre) → canvas pixel.
function hp(x, y, z) { return regionPx('head', headU(Math.atan2(x, z)), headV(y)); }

// v (0 bottom .. 1 top) in the torso/arm/leg regions for a model-space height.
const torsoV = (y) => (y - 0.825) / (1.635 - 0.825);
function regionRectV(name, v0, v1) {
  const [x, y, w, h] = REGIONS[name];
  const top = y + (1 - v1) * h, bottom = y + (1 - v0) * h;
  return [x, top, w, bottom - top];
}

// One CPU-side scratch canvas is reused for every person; the result is uploaded as pixel
// data, so hundreds of townspeople never pile up canvases.
let scratch = null, small = {};
function scratchCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

export function paintCharacterAtlas(look, info, size = ATLAS_SIZE) {
  if (!scratch) scratch = scratchCanvas(ATLAS_SIZE);
  const { c, ctx } = scratch;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const rng = createRng(look.seed || 7);
  const R = (a, b) => rng.range(a, b);

  ctx.fillStyle = css(look.skin); ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
  paintSkinRegion(ctx, look, rng);
  paintHead(ctx, look, info, rng, R);
  paintEye(ctx, look);
  paintHair(ctx, look, rng);
  paintTorso(ctx, look, rng);
  paintArms(ctx, look);
  paintLegs(ctx, look, rng);
  paintOuter(ctx, look, rng);
  paintShoes(ctx, look);
  paintSmall(ctx, look);

  let src = scratch;
  if (size !== ATLAS_SIZE) {
    if (!small[size]) small[size] = scratchCanvas(size);
    src = small[size];
    src.ctx.clearRect(0, 0, size, size);
    src.ctx.drawImage(c, 0, 0, size, size);
  }
  const img = src.ctx.getImageData(0, 0, size, size).data;
  const data = new Uint8Array(size * size * 4);
  const row = size * 4;
  for (let y = 0; y < size; y++) data.set(img.subarray((size - 1 - y) * row, (size - y) * row), y * row);
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function paintSkinRegion(ctx, look, rng) {
  const [x, y, w, h] = REGIONS.skin;
  ctx.fillStyle = css(look.skin); ctx.fillRect(x, y, w, h);
  grain(ctx, x, y, w, h, 0.5);
}

// ---------------------------------------------------------------------- face
function paintHead(ctx, look, info, rng, R) {
  const [x0, y0, w, h] = REGIONS.head;
  const skin = look.skin, f = look.gender === 'f', face = look.face || {};
  ctx.fillStyle = css(skin); ctx.fillRect(x0, y0, w, h);
  // Large-scale tone: warmer cheeks and nose, darker under the jaw, lighter forehead.
  const grad = (cx, cy, r, col, a) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  };
  const { eyeL, eyeR, mouth, nose } = info;
  const [mx, my] = hp(...mouth);
  const [nx, ny] = hp(...nose);
  const [lx, ly] = hp(...eyeL), [rx, ry] = hp(...eyeR);
  const eyeW = Math.abs(lx - rx) * 0.36;
  const warm = mix(skin, 0xc04030, 0.25), dark = mix(skin, 0x2a1408, 0.35), light = mix(skin, 0xffffff, 0.2);
  grad((lx + rx) / 2, ly - 40, 50, light, 0.35);
  for (const ex of [lx, rx]) grad(ex + (ex - nx) * 0.25, ly + 22, 22, warm, f || face.blush ? 0.45 : 0.25);
  grad(nx, ny - 4, 12, warm, 0.25);
  grad(mx, y0 + h - 4, 70, dark, 0.45);                 // under the jaw
  for (const ex of [lx, rx]) grad(ex, ly, eyeW * 1.6, dark, 0.32);   // eye sockets
  grad(mx, my + 2, 14, dark, 0.15);
  // Mottled skin.
  grain(ctx, x0, y0, w, h, 0.7);
  // Nose: side shading and nostrils.

  ctx.fillStyle = rgba(mix(skin, 0x140804, 0.7), 0.75);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(nx + s * 4.2, ny + 3, 2.6, 1.5, s * 0.3, 0, Math.PI * 2); ctx.fill(); }

  // Scalp hair and beards are painted over a grid of head directions.
  paintScalp(ctx, look, info);

  // Eyes surroundings: lid crease, lash line, make-up.
  for (const [ex, ey, s] of [[lx, ly, 1], [rx, ry, -1]]) {
    if (face.makeup) {
      ctx.fillStyle = rgba(face.eyeshadow ?? 0x6a3a5a, 0.4);
      ctx.beginPath(); ctx.ellipse(ex, ey - 7, eyeW * 1.1, 7, 0, Math.PI, 0); ctx.fill();
    }
    ctx.strokeStyle = rgba(dark, 0.5); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(ex, ey - 2, eyeW * 1.05, 10, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = rgba(0x120806, f ? 0.95 : 0.75); ctx.lineWidth = f ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(ex, ey + 2, eyeW * 0.95, 8, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    if (f) { ctx.beginPath(); ctx.moveTo(ex + s * eyeW * 0.9, ey - 2); ctx.lineTo(ex + s * eyeW * 1.25, ey - 5); ctx.stroke(); }
    ctx.strokeStyle = rgba(dark, 0.25); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(ex, ey + 4, eyeW * 0.8, 9, 0, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  // Brows.
  const browCol = face.browColor ?? mix(look.hairColor ?? 0x1a1410, 0x000000, 0.2);
  for (const [ex, ey, s] of [[lx, ly, 1], [rx, ry, -1]]) {
    ctx.strokeStyle = css(browCol); ctx.lineCap = 'round';
    const thick = (face.browThick ?? (f ? 2.6 : 4)), arch = face.browArch ?? (f ? 5 : 3);
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = thick * (1 - k * 0.25); ctx.globalAlpha = 0.7 + k * 0.1;
      ctx.beginPath();
      ctx.moveTo(ex - s * eyeW * 0.95, ey - 15 + k * 0.6);
      ctx.quadraticCurveTo(ex + s * eyeW * 0.1, ey - 18 - arch, ex + s * eyeW * 1.25, ey - 13 + (f ? -1 : 1));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // Lips.
  const lipCol = face.lipstick ?? mix(skin, 0x9a3a3a, f ? 0.4 : 0.28);
  const lw = (f ? 10 : 11) * (face.mouthW ?? 1);
  ctx.fillStyle = css(mix(lipCol, 0x000000, 0.12));
  ctx.beginPath(); ctx.moveTo(mx - lw, my); ctx.quadraticCurveTo(mx - lw * 0.4, my - 4.5, mx, my - 3); ctx.quadraticCurveTo(mx + lw * 0.4, my - 4.5, mx + lw, my); ctx.closePath(); ctx.fill();
  ctx.fillStyle = css(lipCol);
  ctx.beginPath(); ctx.moveTo(mx - lw * 0.9, my + 0.5); ctx.quadraticCurveTo(mx, my + (f ? 7 : 6), mx + lw * 0.9, my + 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(mx, my + 3, lw * 0.35, 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(0x2a0a06, 0.7); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx - lw, my); ctx.quadraticCurveTo(mx, my + 1.2, mx + lw, my); ctx.stroke();
  // Age.
  if (look.age === 'old') {
    ctx.strokeStyle = rgba(dark, 0.35); ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(lx - 2, ly - 30 - k * 6); ctx.quadraticCurveTo((lx + rx) / 2, ly - 33 - k * 6, rx + 2, ly - 30 - k * 6); ctx.stroke(); }
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + s * 9, ny - 2); ctx.quadraticCurveTo(nx + s * 15, my - 4, mx + s * (lw + 4), my + 8); ctx.stroke(); }
    for (const [ex, ey, s] of [[lx, ly, 1], [rx, ry, -1]]) for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(ex + s * eyeW * 1.3, ey + k * 3); ctx.lineTo(ex + s * eyeW * 1.8, ey + k * 5); ctx.stroke(); }
  }
  if (face.freckles) {
    for (let i = 0; i < 40; i++) { ctx.fillStyle = rgba(dark, 0.35); ctx.beginPath(); ctx.arc(nx + R(-30, 30), ny + R(-14, 4), R(0.6, 1.3), 0, Math.PI * 2); ctx.fill(); }
  }
  if (face.mole) { ctx.fillStyle = rgba(0x2a1408, 0.8); ctx.beginPath(); ctx.arc(mx + R(-20, 20), my + R(-18, -6), 1.4, 0, Math.PI * 2); ctx.fill(); }
}

// Hair, beard, stubble and moustache masks: evaluated per texel of the head region (the head
// UV mapping is inverted back to a direction on the skull), with soft, slightly ragged edges and
// fine hair-grain noise; built once per head shape and tinted per person with one composite.
const hash2 = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function scalpMask(info, kind) {
  info.masks ||= {};
  if (info.masks[kind]) return info.masks[kind];
  const [, , w, h] = REGIONS.head;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.createImageData(w, h), D = img.data;
  const F = info.F || { ym: -0.0665, lipW: 0.024, nb: -0.046, ey: 0.006 };
  const ry = F.ry || 0.12, PAD = 3;
  for (let py = 0; py < h; py++) {
    const v = 1 - (py - PAD) / (h - 2 * PAD);
    const ly = HEAD_V0 + v * (HEAD_V1 - HEAD_V0);
    const dy = Math.max(-1, Math.min(1, ly / ry)), rr = Math.sqrt(Math.max(0, 1 - dy * dy));
    for (let px = 0; px < w; px++) {
      const u = (px - PAD) / (w - 2 * PAD), k = Math.abs(u - 0.5), sg = Math.sign(u - 0.5) || 1;
      const ang = sg * (k < 0.35 ? k / 0.35 * Math.PI / 2 : Math.PI / 2 + Math.min(1, (k - 0.35) / 0.15) * Math.PI / 2);
      const dx = Math.sin(ang) * rr, dz = Math.cos(ang) * rr;
      const lx = dx * 0.08;
      const n1 = vnoise(ang * 9 + 3, dy * 9), grain = vnoise(ang * 70, dy * 220);
      let a = 0;
      if (kind === 'hair' || kind === 'undercut' || kind === 'bald') {
        // Hairline: high on the forehead with a soft widow's peak, temples, round the ears to the nape.
        const t = sm(-0.9, 0.85, dz);
        let thr = -0.52 + 0.93 * t + 0.05 * Math.exp(-((dx / 0.25) ** 2)) * t;
        if (Math.abs(dx) > 0.72 && dz > -0.15 && dz < 0.55) thr = Math.max(thr, 0.1 + 0.08 * sm(0.72, 0.95, Math.abs(dx)));
        thr += (n1 - 0.5) * 0.06;
        const edge = sm(thr - 0.07, thr + 0.03, dy);
        a = edge * (0.82 + 0.18 * grain);
        if (kind === 'undercut') a *= dy < 0.42 ? 0.35 + 0.1 * grain : 1;
        if (kind === 'bald') a = sm(thr - 0.05, thr, dy) * sm(0.25, 0.1, dy) * 0.18 * (0.6 + 0.4 * grain);
      } else {
        const front = sm(-0.25, 0.15, dz);
        const jaw = front * sm(-0.2, -0.42, dy) * (1 - sm(0.82, 0.95, Math.abs(dx)) * sm(-0.5, -0.3, dy));
        const cheekTop = sm(F.ym + 0.03, F.ym + 0.012, ly + (Math.abs(lx) > 0.04 ? 0.01 : 0));
        const lipsK = sm(1.0, 0.7, Math.hypot(lx / (F.lipW + 0.006), (ly - F.ym) / 0.011)) * sm(0.4, 0.7, dz);
        const lips = false;
        if (kind === 'beard-full' || kind === 'beard-short') {
          a = jaw * cheekTop * (1 - lipsK * (kind === 'beard-full' ? 0.85 : 1)) * (kind === 'beard-full' ? 0.92 : 0.55) * (0.6 + 0.4 * grain) * (0.85 + 0.3 * (n1 - 0.5));
        } else if (kind === 'stubble') {
          a = jaw * cheekTop * (1 - lipsK) * (hash2(px, py) > 0.55 ? 0.42 : 0.12);
        } else if (kind === 'moustache') {
          // Follows the upper lip: thick under the nose, thinning and drooping to the corners.
          const ax = Math.abs(lx) / (F.lipW + 0.004);
          const bottom = F.ym + 0.0058 - 0.003 * ax * ax, top = F.nb - 0.002 - 0.007 * ax * ax;
          a = dz > 0.5 ? sm(1, 0.8, ax) * sm(bottom - 0.0008, bottom + 0.0008, ly) * sm(top + 0.001, top - 0.001, ly) * (0.55 + 0.45 * grain) * (Math.abs(lx) < 0.0025 ? 0.75 : 1) : 0;
        }
      }
      const o = (py * w + px) * 4;
      D[o] = D[o + 1] = D[o + 2] = 255; D[o + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
    }
  }
  g.putImageData(img, 0, 0);
  info.masks[kind] = c;
  return c;
}

let tintCanvas = null;
function stampMask(ctx, mask, col) {
  if (!tintCanvas) { tintCanvas = document.createElement('canvas'); tintCanvas.width = mask.width; tintCanvas.height = mask.height; }
  const t = tintCanvas.getContext('2d', { willReadFrequently: true });
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, tintCanvas.width, tintCanvas.height);
  t.drawImage(mask, 0, 0);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = css(col); t.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
  t.globalCompositeOperation = 'source-over';
  const [x, y] = REGIONS.head;
  ctx.drawImage(tintCanvas, x, y);
}

function paintScalp(ctx, look, info) {
  const style = look.hair;
  const col = look.hairColor ?? 0x15110e;
  const face = look.face || {};
  if (style !== 'hijab') stampMask(ctx, scalpMask(info, style === 'bald' ? 'bald' : style === 'undercut' ? 'undercut' : 'hair'), col);
  if (face.beard) stampMask(ctx, scalpMask(info, face.beard === 'full' ? 'beard-full' : 'beard-short'), col);
  else if (face.stubble) stampMask(ctx, scalpMask(info, 'stubble'), col);
  if (face.moustache) stampMask(ctx, scalpMask(info, 'moustache'), col);
}

function paintEye(ctx, look) {
  const [x, y, w, h] = REGIONS.eye;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.fillStyle = '#e4dbd0'; ctx.fillRect(x, y, w, h);
  const g = ctx.createRadialGradient(cx, cy, w * 0.2, cx, cy, w * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,60,50,0.35)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const iris = look.face?.eyeColor ?? 0x3a2210;
  ctx.fillStyle = css(iris); ctx.beginPath(); ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = css(mix(iris, 0x000000, 0.6)); ctx.lineWidth = 2; ctx.stroke();
  for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; ctx.strokeStyle = rgba(mix(iris, 0xffffff, 0.3), 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.09, cy + Math.sin(a) * w * 0.09); ctx.lineTo(cx + Math.cos(a) * w * 0.2, cy + Math.sin(a) * w * 0.2); ctx.stroke(); }
  ctx.fillStyle = '#050302'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.095, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx + w * 0.07, cy - w * 0.07, w * 0.04, 0, Math.PI * 2); ctx.fill();
  // Corners the round eyeball never samples hold small swatches for jewellery and watches.
  const sw = (u, v, col) => { ctx.fillStyle = col; ctx.fillRect(x + u * (w - 8) , y + (1 - v) * (h - 8), 8, 8); };
  const metal = { gold: '#d8a838', silver: '#c8ccd0', steel: '#b8bcc0', black: '#1c1e22' };
  sw(0, 1, metal[look.earrings || look.necklace] || metal.gold);
  sw(0, 0, look.watch === 'gold' ? metal.gold : look.watch === 'black' ? '#16181c' : look.watch ? metal.steel : '#16181c');
  sw(1, 0, '#e8ecf0');
}

function paintHair(ctx, look, rng) {
  const [x, y, w, h] = REGIONS.hair;
  const col = look.hairColor ?? 0x15110e;
  ctx.fillStyle = css(col); ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 260; i++) {
    const px = x + rng.next() * w;
    ctx.strokeStyle = rng.chance(0.5) ? rgba(mix(col, 0xffffff, 0.35), 0.35) : rgba(0x000000, 0.35);
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + rng.range(-3, 3), y + h); ctx.stroke();
  }
}

// ------------------------------------------------------------------ clothes
function paintTorso(ctx, look, rng) {
  const top = look.top, bottom = look.bottom;
  const R = REGIONS.torso;
  const [x, y, w, h] = R;
  // Trousers / skirt waist below the hem.
  paintFabric(ctx, R, bottom.pattern || 'plain', bottom.color, bottom.color2 ?? 0xffffff, look.seed + 3);
  const hemV = top.tucked ? torsoV(1.0) : top.kind === 'dress' || top.kind === 'kebaya' ? torsoV(0.84) : torsoV(0.95);
  const neckFront = top.kind === 'tank' ? torsoV(1.42) : top.kind === 'vneck' || top.kind === 'kebaya' ? torsoV(1.44) : torsoV(1.5);
  const neckBack = torsoV(1.53);
  const rect = regionRectV('torso', hemV, 1);
  paintFabric(ctx, rect, top.pattern || 'plain', top.color, top.color2 ?? 0xffffff, look.seed + 1);
  // Neck skin above the neckline: a curve lower at the front (u = 0.5).
  ctx.fillStyle = css(look.skin);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= 32; i++) {
    const u = i / 32, front = Math.max(0, Math.cos((u - 0.5) * Math.PI * 2));
    const v = neckBack + (neckFront - neckBack) * Math.pow(front, top.kind === 'vneck' ? 6 : 2.5);
    ctx.lineTo(x + u * w, y + (1 - v) * h);
  }
  ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
  // Tank tops: bare shoulders around the arm holes.
  if (top.kind === 'tank') {
    for (const u of [0.25, 0.75]) { ctx.beginPath(); ctx.ellipse(x + u * w, y + (1 - torsoV(1.47)) * h, w * 0.08, h * 0.11, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const fx = x + w * 0.5;
  const yAt = (yy) => y + (1 - torsoV(yy)) * h;
  // Hem / waistband shadow and belt.
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + (1 - hemV) * h - 2, w, 3);
  if (top.tucked || bottom.belt) { ctx.fillStyle = css(bottom.belt ?? 0x2a1a10); ctx.fillRect(x, yAt(1.02) - 4, w, 7); ctx.fillStyle = '#c8b070'; ctx.fillRect(fx - 5, yAt(1.02) - 4, 10, 7); }
  // Plackets, buttons and pockets.
  const placket = top.kind === 'shirt' || top.kind === 'batik' || top.kind === 'polo' || top.kind === 'uniform';
  if (placket) {
    const yEnd = top.kind === 'polo' ? 1.38 : top.tucked ? 1.02 : 0.95;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(fx - 1, yAt(1.5), 2, yAt(yEnd) - yAt(1.5));
    ctx.fillStyle = shade(top.color, 1.25);
    for (let yy = 1.46; yy > yEnd + 0.03; yy -= 0.07) { ctx.beginPath(); ctx.arc(fx + 3, yAt(yy), 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
  if (top.kind === 'shirt' || top.kind === 'uniform') {
    for (const s of top.kind === 'uniform' ? [-1, 1] : [1]) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(fx + s * w * 0.06 - (s < 0 ? w * 0.07 : 0), yAt(1.4), w * 0.07, h * 0.07);
    }
  }
  if (top.kind === 'uniform') {
    ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.arc(fx + w * 0.095, yAt(1.43), 4, 0, Math.PI * 2); ctx.fill();   // badge
    ctx.fillStyle = '#1a1a1a'; ctx.fillRect(fx - w * 0.13, yAt(1.415), w * 0.06, 4);                                     // name tag
    ctx.fillStyle = shade(top.color, 0.6); for (const u of [0.25, 0.75]) ctx.fillRect(x + u * w - 8, yAt(1.475), 16, 5); // epaulettes
  }
  if (top.kind === 'hoodie') {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    ctx.strokeRect(fx - w * 0.09, yAt(1.15), w * 0.18, h * 0.12);
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fx + s * 6, yAt(1.5)); ctx.lineTo(fx + s * 7, yAt(1.36)); ctx.stroke(); }
  }
  if (top.print) {
    ctx.fillStyle = css(top.color2 ?? 0xffffff);
    ctx.font = `bold ${top.print.length > 6 ? 9 : 12}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(top.print, fx, yAt(1.32));
  }
  if (look.bag === 'shoulder') { // strap across the chest
    ctx.strokeStyle = css(look.bagColor ?? 0x3a2a1a); ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + w * 0.3, yAt(1.47)); ctx.lineTo(x + w * 0.72, yAt(1.02)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.04, yAt(1.47)); ctx.lineTo(x + w * 0.28, yAt(1.47)); ctx.stroke();
  }
  if (look.bag === 'backpack') {
    ctx.strokeStyle = css(look.bagColor ?? 0x2a3a5a); ctx.lineWidth = 7;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(fx + s * w * 0.13, yAt(1.48)); ctx.lineTo(fx + s * w * 0.15, yAt(1.15)); ctx.stroke(); }
  }
  // Folds.
  for (let i = 0; i < 10; i++) {
    const ux = x + rng.next() * w, uy = y + (1 - hemV) * h - rng.range(4, 50);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux + rng.range(-12, 12), uy - rng.range(8, 20)); ctx.stroke();
  }
}

function paintArms(ctx, look) {
  const top = look.top;
  const [x, y, w, h] = REGIONS.arm;
  ctx.fillStyle = css(look.skin); ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.06)'); g.addColorStop(0.5, 'rgba(255,255,255,0.04)'); g.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  const outer = look.outer && (look.outer.kind === 'jacket' || look.outer.kind === 'hoodie');
  const sleeveV = outer ? 0.04 : { tank: 0.93, tshirt: 0.66, vneck: 0.66, polo: 0.68, shirt: top.longSleeves ? 0.04 : 0.62, batik: top.longSleeves ? 0.04 : 0.62, uniform: 0.62, hoodie: 0.04, dress: top.longSleeves ? 0.04 : 0.7, kebaya: 0.1 }[top.kind] ?? 0.66;
  const src = outer ? look.outer : top;
  const rect = regionRectV('arm', sleeveV, 1);
  paintFabric(ctx, rect, src.pattern || 'plain', src.color, src.color2 ?? 0xffffff, look.seed + 5);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, rect[1] + rect[3] - 2, w, 3);
  if (sleeveV < 0.1) { ctx.fillStyle = shade(src.color, 0.8); ctx.fillRect(x, rect[1] + rect[3] - 9, w, 7); }
}

function paintLegs(ctx, look, rng) {
  const bottom = look.bottom;
  const [x, y, w, h] = REGIONS.leg;
  ctx.fillStyle = css(look.legSkin ?? look.skin); ctx.fillRect(x, y, w, h);
  const endV = { jeans: 0.02, trousers: 0.02, cargo: 0.02, track: 0.02, shorts: 0.58, 'long-shorts': 0.5, skirt: 0.62, sarong: 0.02, capri: 0.25 }[bottom.kind] ?? 0.02;
  if (bottom.kind === 'skirt' || bottom.kind === 'dress-legs') return;
  const rect = regionRectV('leg', endV, 1);
  paintFabric(ctx, rect, bottom.pattern || 'plain', bottom.color, bottom.color2 ?? 0xffffff, look.seed + 9);
  const [, ry, , rh] = rect;
  // Side seams (u = 0.25 / 0.75), knee creases, cuffs.
  ctx.fillStyle = bottom.kind === 'track' ? css(bottom.color2 ?? 0xffffff) : 'rgba(0,0,0,0.2)';
  for (const u of [0.25, 0.75]) ctx.fillRect(x + u * w - (bottom.kind === 'track' ? 3 : 1), ry, bottom.kind === 'track' ? 6 : 2, rh);
  if (bottom.kind === 'cargo') { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; for (const u of [0.25, 0.75]) ctx.strokeRect(x + u * w - 10, y + h * 0.3, 20, 22); }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { const yy = y + h * (0.5 + rng.range(-0.04, 0.04)); ctx.beginPath(); ctx.moveTo(x + w * 0.35, yy); ctx.quadraticCurveTo(x + w * 0.5, yy + 4, x + w * 0.65, yy); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, ry + rh - 3, w, 3);
}

function paintOuter(ctx, look, rng) {
  const R = REGIONS.outer;
  const o = look.outer;
  if (!o) { paintFabric(ctx, R, 'plain', look.bottom.color, 0xffffff, look.seed + 11); return; }
  paintFabric(ctx, R, o.pattern || 'plain', o.color, o.color2 ?? 0xffffff, look.seed + 11);
  const [x, y, w, h] = R;
  const fx = x + w * 0.5;
  if (o.kind === 'hivis' || o.kind === 'tactical') {
    ctx.fillStyle = o.kind === 'hivis' ? '#d8dcdc' : '#c8c8c8';
    if (o.kind === 'hivis') for (const v of [0.45, 0.7]) ctx.fillRect(x, y + (1 - v) * h, w, 9);
    if (o.kind === 'tactical') { ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('POLICE', fx, y + h * 0.36); }
  }
  if (o.kind === 'jacket' || o.kind === 'hoodie') {
    // The open front shows the shirt; a zip or lapels at the edges.
    if (o.open) { ctx.fillStyle = css(look.top.color); ctx.fillRect(fx - w * 0.04, y, w * 0.08, h * 0.75); }
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (const s of [-1, 1]) ctx.fillRect(fx + s * w * 0.04 - 1, y, 2, h * 0.75);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y + h * 0.7 - 6, w, 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.5; for (const s of [-1, 1]) ctx.strokeRect(fx + s * w * 0.12 - 8, y + h * 0.5, 16, 12);
  }
  if (o.kind === 'apron') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(x + w * 0.3, y + h * 0.45, w * 0.4, h * 0.14);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(90,70,40,0.25)'; ctx.beginPath(); ctx.arc(x + rng.next() * w, y + h * 0.3 + rng.next() * h * 0.6, rng.range(3, 9), 0, Math.PI * 2); ctx.fill(); }
  }
}

function paintShoes(ctx, look) {
  const [x, y, w, h] = REGIONS.shoe;
  const s = look.shoes;
  ctx.fillStyle = css(s.color); ctx.fillRect(x, y, w, h);
  if (s.kind === 'sneaker') { ctx.fillStyle = '#f2f0ea'; ctx.fillRect(x, y + h * 0.62, w, h * 0.38); ctx.fillStyle = css(s.color2 ?? 0xd03020); ctx.fillRect(x + w * 0.3, y + h * 0.4, w * 0.15, h * 0.2); }
  if (s.kind === 'sandal') { ctx.fillStyle = css(look.skin); ctx.fillRect(x, y, w, h * 0.55); ctx.fillStyle = css(s.color); ctx.fillRect(x + w * 0.42, y, w * 0.16, h * 0.55); ctx.fillStyle = '#2a2018'; ctx.fillRect(x, y + h * 0.75, w, h * 0.25); }
  if (s.kind === 'leather' || s.kind === 'boot') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y + h * 0.3, w, 3); ctx.fillStyle = '#100a06'; ctx.fillRect(x, y + h * 0.82, w, h * 0.18); }
}

function paintSmall(ctx, look) {
  const fill = (name, col) => { const [x, y, w, h] = REGIONS[name]; ctx.fillStyle = css(col); ctx.fillRect(x, y, w, h); return [x, y, w, h]; };
  const hatCol = look.hatColor ?? look.scarfColor ?? 0x1a1a1a;
  const [hx, hy, hw, hh] = fill('hat', hatCol);
  if (look.hair === 'hijab' && look.scarfPattern) paintFabric(ctx, REGIONS.hat, look.scarfPattern, hatCol, look.scarfColor2 ?? 0xffffff, look.seed + 13, 0.6);
  if (look.headwear === 'cap' || look.headwear === 'cap-back') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(look.capText || 'SGR', hx + hw * 0.5, hy + hh * 0.35); }
  if (look.headwear === 'police-cap') { ctx.fillStyle = '#d8b040'; ctx.beginPath(); ctx.arc(hx + hw * 0.5, hy + hh * 0.5, 4, 0, Math.PI * 2); ctx.fill(); }
  if (look.headwear === 'straw') { ctx.strokeStyle = 'rgba(80,50,20,0.4)'; for (let i = 0; i < hw; i += 4) { ctx.beginPath(); ctx.moveTo(hx + i, hy); ctx.lineTo(hx + i + 6, hy + hh); ctx.stroke(); } }
  // Hair cards (no hat, no headscarf): four columns of strand clumps on a transparent ground,
  // dense at the root (top) and thinning to ragged tips.
  if (!look.headwear && look.hair !== 'hijab' && look.hair !== 'bald') {
    const col = look.hairColor ?? 0x15110e;
    ctx.clearRect(hx, hy, hw, hh);
    const rng = createRng((look.seed || 3) + 77);
    const cw = hw / 4;
    for (let c = 0; c < 4; c++) {
      const x0 = hx + c * cw;
      for (let k = 0; k < 170; k++) {
        const x = x0 + 2 + rng.next() * (cw - 4), len = hh * (0.6 + 0.4 * rng.next());
        const shade = rng.next();
        ctx.strokeStyle = shade < 0.22 ? css(mix(col, 0x000000, 0.25)) : shade > 0.9 ? css(mix(col, 0xffffff, 0.16)) : css(col);
        ctx.lineWidth = 1.2 + rng.next() * 1.6;
        ctx.beginPath(); ctx.moveTo(x, hy); ctx.quadraticCurveTo(x + rng.range(-1.5, 1.5), hy + len * 0.5, x + rng.range(-3, 3), hy + len); ctx.stroke();
      }
      // A solid root band so the card meets the scalp without gaps.
      ctx.fillStyle = css(col); ctx.fillRect(x0 + 2, hy, cw - 4, hh * 0.18);
    }
  }
  fill('bag', look.bagColor ?? 0x4a3020);
  fill('trim', look.outer?.kind === 'jacket' ? look.outer.color : look.top.color);
  const [dx, dy, dw, dh] = fill('dark', 0x0c0806);
  ctx.fillStyle = '#e8e0cc'; ctx.fillRect(dx, dy + dh * 0.78, dw, dh * 0.22);   // teeth
  const [lx, ly, lw, lh] = fill('lens', look.face?.sunglasses || look.headwear === 'helmet' ? 0x101418 : 0x8a9aa0);
  const g = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
  g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(lx, ly, lw, lh);
}
