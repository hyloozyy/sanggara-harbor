// Procedural fabric prints for clothing, painted straight into a character's atlas region:
// plain weave, stripes, plaid, batik (parang, kawung, mega mendung), florals, denim, camo,
// hi-vis with reflective bands and uniform khaki.
import { createRng } from '../core/rng.js';

export function shade(hex, k) {
  const r = Math.min(255, ((hex >> 16) & 255) * k), g = Math.min(255, ((hex >> 8) & 255) * k), b = Math.min(255, (hex & 255) * k);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export const css = (hex) => '#' + hex.toString(16).padStart(6, '0');

// A 128 px tile of thread noise, made once and stamped over every garment.
let grainTile = null;
function grainCanvas() {
  if (grainTile) return grainTile;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  const r = createRng(99).next;
  for (let i = 0; i < 128 * 128; i++) {
    const row = (i >> 7) & 1, v = r();
    const light = (v + row * 0.15) > 0.55;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = light ? 255 : 0;
    img.data[i * 4 + 3] = Math.floor(r() * 26);
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

export function grain(ctx, x, y, w, h, alpha = 1) {
  const t = grainCanvas();
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let yy = y; yy < y + h; yy += 128) for (let xx = x; xx < x + w; xx += 128) ctx.drawImage(t, xx, yy);
  ctx.restore();
}

function weave(ctx, x, y, w, h) { grain(ctx, x, y, w, h, 1); }

// Fill (x, y, w, h) with a pattern. `c1` base, `c2` accent.
export function paintFabric(ctx, rect, pattern, c1, c2 = 0xffffff, seed = 1, scale = 1) {
  const [x, y, w, h] = rect;
  const rng = createRng(seed).next;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = css(c1); ctx.fillRect(x, y, w, h);
  const s = scale;
  switch (pattern) {
    case 'stripes': {
      ctx.fillStyle = css(c2);
      for (let yy = y; yy < y + h; yy += 14 * s) ctx.fillRect(x, yy, w, 5 * s);
      break;
    }
    case 'pinstripe': {
      ctx.fillStyle = shade(c1, 1.35);
      for (let xx = x; xx < x + w; xx += 7 * s) ctx.fillRect(xx, y, 1, h);
      break;
    }
    case 'plaid': {
      ctx.globalAlpha = 0.45; ctx.fillStyle = css(c2);
      for (let xx = x; xx < x + w; xx += 22 * s) ctx.fillRect(xx, y, 8 * s, h);
      for (let yy = y; yy < y + h; yy += 22 * s) ctx.fillRect(x, yy, w, 8 * s);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      for (let xx = x + 14 * s; xx < x + w; xx += 22 * s) ctx.fillRect(xx, y, 2, h);
      for (let yy = y + 14 * s; yy < y + h; yy += 22 * s) ctx.fillRect(x, yy, w, 2);
      ctx.globalAlpha = 1;
      break;
    }
    case 'batik-parang': { // diagonal S-shaped bands
      ctx.strokeStyle = css(c2); ctx.lineWidth = 3 * s;
      const step = 18 * s;
      for (let k = -h; k < w + h; k += step) {
        ctx.beginPath();
        for (let t = 0; t <= h; t += 4) {
          const px = x + k + t + Math.sin(t * 0.35) * 4 * s, py = y + t;
          t === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = shade(c2, 0.8);
      for (let k = -h; k < w + h; k += step) for (let t = 6; t < h; t += 14 * s) { ctx.beginPath(); ctx.arc(x + k + t + step * 0.5, y + t, 2.2 * s, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'batik-kawung': { // four-petal ovals in a grid
      const step = 20 * s;
      for (let yy = y; yy < y + h + step; yy += step) {
        for (let xx = x; xx < x + w + step; xx += step) {
          ctx.fillStyle = css(c2);
          for (const [dx, dy, rot] of [[0, -5, 0], [0, 5, 0], [-5, 0, Math.PI / 2], [5, 0, Math.PI / 2]]) {
            ctx.beginPath(); ctx.ellipse(xx + dx * s, yy + dy * s, 3 * s, 5.5 * s, rot, 0, Math.PI * 2); ctx.fill();
          }
          ctx.fillStyle = css(c1); ctx.beginPath(); ctx.arc(xx, yy, 1.6 * s, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'batik-mega': { // cloud bands (mega mendung)
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = k % 2 ? css(c2) : shade(c2, 0.7); ctx.lineWidth = 2.5 * s;
        for (let yy = y - 10; yy < y + h + 20; yy += 26 * s) {
          ctx.beginPath();
          for (let xx = x - 10; xx < x + w + 20; xx += 18 * s) ctx.arc(xx, yy + k * 3 * s, (9 - k * 1.6) * s, Math.PI, 0);
          ctx.stroke();
        }
      }
      break;
    }
    case 'floral': {
      for (let i = 0; i < (w * h) / (260 * s * s); i++) {
        const px = x + rng() * w, py = y + rng() * h, r = (3 + rng() * 3) * s;
        ctx.fillStyle = css(c2);
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r, r * 0.6, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#f4d040'; ctx.beginPath(); ctx.arc(px, py, r * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(40,110,50,0.8)'; ctx.beginPath(); ctx.ellipse(px + r * 1.6, py + r, r * 0.7, r * 0.3, 0.6, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'dots': {
      ctx.fillStyle = css(c2);
      for (let yy = y; yy < y + h; yy += 12 * s) for (let xx = x + ((yy / (12 * s)) % 2) * 6 * s; xx < x + w; xx += 12 * s) { ctx.beginPath(); ctx.arc(xx, yy, 2.2 * s, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'denim': {
      for (let yy = y; yy < y + h; yy += 2) { ctx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`; ctx.fillRect(x, yy, w, 1); }
      for (let i = 0; i < w * h / 160; i++) { ctx.fillStyle = `rgba(20,30,60,${rng() * 0.12})`; ctx.fillRect(x + rng() * w, y + rng() * h, 3, 1); }
      break;
    }
    case 'camo': {
      for (let i = 0; i < (w * h) / 300; i++) {
        ctx.fillStyle = [shade(c1, 0.7), css(c2), shade(c2, 0.75)][i % 3];
        ctx.beginPath(); ctx.ellipse(x + rng() * w, y + rng() * h, 6 + rng() * 10, 4 + rng() * 6, rng() * 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'logo': {
      ctx.fillStyle = css(c2);
      ctx.beginPath(); ctx.arc(x + w * 0.5, y + h * 0.42, Math.min(w, h) * 0.08, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default: break;
  }
  weave(ctx, x, y, w, h);
  ctx.restore();
}
