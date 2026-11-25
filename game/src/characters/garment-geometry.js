// Garments built on the body's own surface (torsoPoint) so they follow it exactly and deform
// with the same weights: torso shells (shirts' loose hems, vests, jackets, hi-vis, tactical
// vests), a headscarf drape over the shoulders, skirts and sarongs that hang from the hips,
// folded collars, sleeves that stand off the arm with a hem, flared shorts legs; and hair
// cards (alpha-tested strand textures) that break up the hair's silhouette and sway.
import { regionUV } from './atlas-layout.js';
import { B, HEAD_C, torsoPoint, torsoWeights } from './body-geometry.js';
import { smooth, V } from './skinned-part-builder.js';

const sgnPow = (q, k) => Math.sign(q) * Math.abs(q) ** k;

// A torso shell from yTop down to yBot. inflate(y, phi) → metres off the body. uv: 'torso'
// (same mapping as the body, so the painted garment lines up) or another region.
export function torsoShell(b, P, yTop, yBot, inflate, { region = 'torso', rows = 16, cols = 30, phiRange = null, lip = 0.004 } = {}) {
  const wf = torsoWeights(P);
  const pts = [], uvs = [], ws = [];
  const [p0, p1] = phiRange || [-Math.PI, Math.PI];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1), y = yTop + (yBot - yTop) * t;
    const row = [], ur = [], wr = [];
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, phi = p0 + (p1 - p0) * u;
      // Hem and top edges tuck back towards the body (a turned edge rather than a knife edge).
      const edge = (i === 0 || i === rows - 1) ? -lip : 0;
      const p = torsoPoint(P, y, phi, inflate(y, phi) + edge);
      const uu = 0.5 + phi / (Math.PI * 2);
      row.push(p);
      ur.push(region === 'torso' ? regionUV('torso', uu, (y - 0.825) / (1.635 - 0.825)) : regionUV(region, uu, 0.3 + 0.7 * (y - yBot) / (yTop - yBot)));
      wr.push(wf(p));
    }
    pts.push(row); uvs.push(ur); ws.push(wr);
  }
  b.surface(pts, uvs, ws, { seam: !phiRange });
}

// The loose lower part of an untucked top: stands off the trousers and ends in a hem.
export function addShirtHem(b, P, hemY, loose = 1) {
  torsoShell(b, P, 1.1, hemY, (y) => 0.004 + 0.008 * loose * smooth(1.08, hemY, y), { rows: 8, cols: 30 });
}

// Vests, jackets, hi-vis and tactical vests over the torso; jackets get an open front.
export function addTorsoShell(b, P, yTop, yBottom, inflate, region = 'outer') {
  torsoShell(b, P, yTop, yBottom, (y) => inflate * (0.7 + 0.3 * smooth(yTop, yBottom, y)) + 0.004 * smooth(1.2, yBottom, y), { region, rows: 18, cols: 30 });
}

// Headscarf (the head part is built in wear-geometry): a drape from under the chin over the
// shoulders and the top of the chest, rounded at the hem, longer at the front.
export function addHijabDrape(b, P) {
  const rows = 14, cols = 30;
  const pts = [], uvs = [], ws = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const row = [], ur = [], wr = [];
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
      const front = Math.max(0, Math.cos(phi));
      const hem = 1.37 - 0.06 * front ** 2;            // a curved hem, lowest at the front
      const y = 1.63 + (hem - 1.63) * t;
      // Close round the neck at the top, then out over the shoulders.
      const body = torsoPoint(P, Math.max(y, 1.3), phi, 0.008 + 0.007 * smooth(1.5, 1.35, y));
      const neck = smooth(1.6, 1.5, y);
      const nr = (P.neckR + 0.016) * (1 + 0.12 * smooth(1.63, 1.56, y));
      const nx = Math.sin(phi) * nr, nz = Math.cos(phi) * nr * 1.05 - 0.004;
      const p = V(nx + (body.x - nx) * neck, y, nz + (body.z - nz) * neck);
      if (y > 1.565) p.z += 0.012 * front * smooth(1.565, 1.62, y);   // wraps under the chin
      row.push(p); ur.push(regionUV('hat', u, 0.5 * (1 - t)));
      const k = smooth(1.62, 1.45, y);
      wr.push([[B.head, (1 - k) * 0.7], [B.neck, (1 - k) * 0.3], [B.chest, k]]);
    }
    pts.push(row); uvs.push(ur); ws.push(wr);
  }
  b.surface(pts, uvs, ws, { seam: true });
}

// Skirts and sarongs: fitted from the waist over the hips, then hanging and flaring.
export function addSkirt(b, P, length, flare = 1) {
  const bottomY = length === 'long' ? 0.11 : length === 'midi' ? 0.33 : 0.5;
  const top = 1.07, hipY = 0.91;
  const rows = 20, cols = 32;
  const pts = [], uvs = [], ws = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1), y = top + (bottomY - top) * t;
    const row = [], ur = [], wr = [];
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
      let p;
      if (y >= hipY) p = torsoPoint(P, y, phi, 0.009 + 0.01 * smooth(1.0, hipY, y));
      else {
        const h = torsoPoint(P, hipY, phi, 0.019);
        const k = 1 + flare * (hipY - y) * (0.2 + 0.06 * Math.cos(phi * 2) ** 2) + 0.06 * smooth(hipY, hipY - 0.2, y);
        // Soft folds in the hanging part.
        const fold = 1 + 0.025 * smooth(hipY, bottomY, y) * Math.sin(phi * 9 + 1.3);
        p = V(h.x * k * fold, y, h.z * k * fold + 0.004);
      }
      row.push(p); ur.push(regionUV('outer', u, 0.3 + 0.7 * (y - bottomY) / (top - bottomY)));
      // Cloth hangs between the legs: each vertex follows both thighs, mostly the nearer one.
      // The front and back panels ride on skirt bones that the leading / trailing leg pushes;
      // the sides follow the nearer thigh.
      const tt = smooth(0.98, bottomY + 0.05, y);
      const cf = Math.cos(phi), fr = smooth(0.35, 0.85, cf), bk = smooth(-0.35, -0.85, cf), sd = 1 - fr - bk;
      const mixL = smooth(-0.13, 0.13, p.x);
      const lw = tt * 0.8;
      wr.push([[B.hips, 1 - lw], [B.skirtF, lw * fr], [B.skirtB, lw * bk], [B.legL, lw * sd * mixL], [B.legR, lw * sd * (1 - mixL)]]);
    }
    pts.push(row); uvs.push(ur); ws.push(wr);
  }
  b.surface(pts, uvs, ws, { seam: true });
}

// A folded shirt collar: a band round the neck, folded over, with points at the front.
export function addCollar(b, P, region = 'trim') {
  const rows = 4, cols = 26;
  const pts = [], uvs = [], ws = [];
  const span = Math.PI * 0.86;                          // open at the front
  for (let i = 0; i < rows; i++) {
    const row = [], ur = [], wr = [];
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, phi = Math.PI + (u - 0.5) * 2 * span; // centred on the back
      const front = Math.max(0, Math.cos(phi));
      const yBand = 1.57 - 0.025 * front, yFold = 1.545 - 0.03 * front, yEdge = 1.52 - 0.035 * front ** 1.5;
      const ys = [yBand, yFold + 0.006, yFold, yEdge][i];
      const out = [0.004, 0.007, 0.009, 0.01 + 0.003 * front][i];
      const base = torsoPoint(P, Math.min(ys, 1.56), phi, out);
      if (ys > 1.56) { base.y = ys; }
      row.push(base); ur.push(regionUV(region, u, i / (rows - 1))); wr.push([[B.chest, 0.55], [B.neck, 0.45]]);
    }
    pts.push(row); uvs.push(ur); ws.push(wr);
  }
  b.surface(pts, uvs, ws, {});
}

// Sleeves: a tube a little off the upper arm from the shoulder to the sleeve end, flaring into a
// hem. armRadius(y) is the body's own arm profile (approximated), end is the sleeve's y.
export function addSleeves(b, P, J, endY, loose = 1) {
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const [x, y0, z0] = J['arm' + side];
    const ye = J['fore' + side][1];
    const top = y0 - 0.035, L = P.limb;
    const rows = 9, cols = 18;
    const pts = [], uvs = [], ws = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1), y = top + (endY - top) * t;
      const base = (0.049 - 0.013 * smooth(y0 - 0.03, ye, y)) * L;
      const r = base + (0.004 + 0.007 * loose * smooth(top - 0.02, endY, y)) * (i === rows - 1 ? 0.7 : 1);
      const cap = i === 0 ? 0.92 : 1;
      const row = [], ur = [], wr = [];
      for (let j = 0; j <= cols; j++) {
        const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
        const p = V(x + s * 0.004 + Math.sin(phi) * r * cap, y, z0 + Math.cos(phi) * r * cap * 1.02);
        row.push(p);
        const yw = J['hand' + side][1] - 0.012, yt = y0 + 0.032;
        ur.push(regionUV('arm', u, (y - yw) / (yt - yw)));
        const pt = smooth(y0 - 0.06, y0 + 0.03, y) * 0.6, m = smooth(ye + 0.04, ye - 0.03, y);
        wr.push([[B['arm' + side], (1 - m) * (1 - pt)], [B['fore' + side], m * (1 - pt)], [B.chest, pt]]);
      }
      pts.push(row); uvs.push(ur); ws.push(wr);
    }
    b.surface(pts, uvs, ws, { seam: true });
  }
}

// Shorts: the trouser leg stands off the thigh and flares a little at the hem.
export function addShortsLegs(b, P, J, endY) {
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const [x, y0] = J['leg' + side];
    const yk = J['shin' + side][1], ya = J['foot' + side][1];
    const top = y0 - 0.02, L = P.limb * (P.f ? 1.06 : 1);
    const rows = 8, cols = 20;
    const pts = [], uvs = [], ws = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1), y = top + (endY - top) * t;
      const r = (0.088 - 0.03 * smooth(y0, yk + 0.08, y)) * L + 0.008 + 0.01 * t;
      const row = [], ur = [], wr = [];
      for (let j = 0; j <= cols; j++) {
        const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
        const p = V(x + s * 0.004 + Math.sin(phi) * r, y, 0.004 + Math.cos(phi) * r);
        row.push(p);
        const yb = ya - 0.012, yt = y0 + 0.07;
        ur.push(regionUV('leg', u, (y - yb) / (yt - yb)));
        const pt = smooth(y0 - 0.07, y0 + 0.03, y) * 0.6;
        wr.push([[B['leg' + side], 1 - pt], [B.hips, pt]]);
      }
      pts.push(row); uvs.push(ur); ws.push(wr);
    }
    b.surface(pts, uvs, ws, { seam: true });
  }
}

// ------------------------------------------------------------------ hair cards
// A strip of quads along a path; each card samples one of four strand columns of the card
// texture (the 'hat' region when the person wears no hat). group 2 = alpha-tested.
function card(b, path, width, normalFn, col, weightFn) {
  const n = path.length;
  const pts = [], uvs = [], ws = [], nr = [];
  for (let i = 0; i < n; i++) {
    const p = path[i], q = path[Math.min(n - 1, i + 1)], o = path[Math.max(0, i - 1)];
    const tan = q.clone().sub(o).normalize();
    const nrm = normalFn(p, i / (n - 1));
    const side = tan.clone().cross(nrm).normalize();
    const w = width * (1 - 0.35 * (i / (n - 1)));
    const row = [], ur = [], wr = [], rn = [];
    for (const k of [-1, 1]) {
      row.push(p.clone().addScaledVector(side, k * w / 2));
      ur.push(regionUV('hat', col * 0.25 + (k < 0 ? 0.02 : 0.23), 1 - i / (n - 1)));
      wr.push(weightFn(p, i / (n - 1)));
      rn.push(nrm);
    }
    pts.push(row); uvs.push(ur); ws.push(wr); nr.push(rn);
  }
  b.surface(pts, uvs, ws, { group: 2, normals: nr });
}

const HEADW = [[B.head, 1]];
const hrand = (i) => { const x = Math.sin(i * 91.7 + 13.1) * 43758.5; return x - Math.floor(x); };

// Hair cards per style; shape is the skull, off(d) how far the hair shell stands off it.
export function addHairCards(b, style, shape, P) {
  if (!style || style === 'bald' || style === 'none' || style === 'hijab') return;
  const rel = (p) => V(p.x - HEAD_C[0], p.y - HEAD_C[1], p.z - HEAD_C[2]);
  const surf = (d, off) => { const p = shape(d); return p.addScaledVector(rel(p).normalize(), off); };
  const dirOf = (th, ph) => V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
  const outN = (p) => rel(p).normalize();
  const short = ['crop', 'undercut', 'spiky', 'curly', 'grey-crop'].includes(style);
  const len = style === 'spiky' ? 0.045 : style === 'curly' ? 0.035 : style === 'undercut' ? 0.06 : 0.04;
  const off0 = style === 'curly' ? 0.016 : style === 'undercut' ? 0.012 : 0.009;
  // Layers of short cards over the scalp, combed from the crown: back and down at the back,
  // forward over the top towards the forehead, down over the temples.
  const count = short ? 46 : 30;
  for (let i = 0; i < count; i++) {
    const th = 0.15 + hrand(i) * (short ? 1.05 : 0.9), ph = (hrand(i + 50) - 0.5) * Math.PI * 2;
    const d = dirOf(th, ph);
    if (d.z > 0.55 && d.y < 0.55) continue;                     // keep the face clear
    if (style === 'undercut' && d.y < 0.5) continue;
    const path = [];
    const flowF = d.z > 0 ? 1 : -1;
    for (let k = 0; k < 4; k++) {
      const t = k / 3;
      const th2 = th + t * (len / 0.1) * (d.z < -0.2 ? 1 : 0.6), ph2 = ph + t * 0.12 * flowF * Math.sign(ph);
      const curl = style === 'curly' ? 0.006 * Math.sin(t * 6 + i) : 0;
      path.push(surf(dirOf(Math.min(th2, 2.1), ph2), off0 + 0.004 * t + curl + (style === 'spiky' ? 0.01 * t : 0)));
    }
    card(b, path, short ? 0.03 : 0.04, (p) => outN(p), i % 4, () => HEADW);
  }
  if (style === 'long' || style === 'bob') {
    // Hanging cards in a ring round the back and sides, out to the shoulders; the lower part
    // follows the swinging hair bone.
    const bottom = style === 'long' ? 1.36 : 1.615;
    for (let i = 0; i < 22; i++) {
      const ph = Math.PI + (i / 21 - 0.5) * Math.PI * 1.45 + (hrand(i + 7) - 0.5) * 0.08;
      const path = [];
      for (let k = 0; k < 7; k++) {
        const t = k / 6;
        const top = surf(dirOf(0.55, ph), 0.012);
        const y = top.y + (bottom - top.y) * t + (hrand(i) - 0.5) * 0.03 * t;
        const r = 0.096 + 0.02 * t + (style === 'long' ? 0.03 * smooth(0.5, 1, t) : 0);
        const p = V(Math.sin(ph) * r * (1 + 0.1 * t), y, -0.012 + Math.cos(ph) * r * (style === 'long' ? 0.9 - 0.25 * t : 1) - (style === 'long' ? 0.05 * t : 0.01 * t));
        path.push(t === 0 ? top : p);
      }
      card(b, path, 0.05, (p) => { const n = V(p.x, 0, p.z + 0.012).normalize(); return n; }, i % 4,
        (p) => { const k = smooth(1.66, bottom, p.y) * 0.8; return [[B.head, 1 - k], [B.hairTail, k]]; });
    }
  }
  if (style === 'ponytail') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const path = [];
      for (let k = 0; k < 6; k++) {
        const t = k / 5;
        path.push(V(Math.cos(a) * 0.012 * (1 - t), 1.78 - t * 0.27, -0.115 - 0.02 * Math.sin(t * 2.2)));
      }
      card(b, path, 0.05, () => V(Math.sin(a), 0, Math.cos(a)), i % 4, (p) => (p.y > 1.77 ? HEADW : [[B.hairTail, 1]]));
    }
  }
}
void sgnPow;

// ------------------------------------------------------------------ accessories
// UVs of the swatches painted in the corners of the eye region (see character-atlas.js).
const SWATCH = { jewel: [0.03, 0.97], band: [0.03, 0.03], face: [0.97, 0.03] };
const sw = (k) => regionUV('eye', SWATCH[k][0], SWATCH[k][1]);

// A wristwatch on the left wrist: a band round the forearm just above the hand and a face.
export function addWatch(b, P, J, kind) {
  const [x, , z0] = J.foreL, yw = J.handL[1];
  const L = P.limb;
  const y = yw + 0.032;
  const band = 'band';
  const rows = [], uvs = [], ws = [];
  for (let i = 0; i < 2; i++) {
    const r = [], u = [], w = [];
    for (let j = 0; j <= 14; j++) {
      const a = (j / 14) * Math.PI * 2;
      r.push(V(x + Math.sin(a) * 0.0235 * L, y + (i ? -0.011 : 0.011), z0 + 0.006 + Math.cos(a) * 0.029 * L));
      u.push(sw(band)); w.push([[B.foreL, 0.85], [B.handL, 0.15]]);
    }
    rows.push(r); uvs.push(u); ws.push(w);
  }
  b.surface(rows, uvs, ws, { seam: true, group: 1 });
  // The face on the back of the wrist (outside, +x for the left arm).
  b.ellipsoid({ lat: 4, lon: 10, group: 1, uvFn: (d) => (d.x > 0.5 ? sw('face') : sw(band)), weightFn: () => [[B.foreL, 0.85], [B.handL, 0.15]],
    map: (d) => V(x + 0.0235 * L + 0.003 + d.x * 0.0035, y + d.y * 0.016, z0 + 0.006 + d.z * 0.016) });
}

// Earrings: small studs with a drop at each lobe.
export function addEarrings(b, P, kind) {
  const ex = (P.f ? 0.073 : 0.077) + 0.004;
  for (const s of [1, -1]) {
    b.ellipsoid({ lat: 5, lon: 8, group: 1, uvFn: () => sw('jewel'), weightFn: () => [[B.head, 1]],
      map: (d) => V(s * ex + d.x * 0.0035, HEAD_C[1] - 0.04 + d.y * 0.0045, HEAD_C[2] - 0.006 + d.z * 0.0035) });
  }
}

// A fine chain round the base of the neck with a small pendant.
export function addNecklace(b, P, kind) {
  const rows = [], uvs = [], ws = [];
  for (let i = 0; i < 2; i++) {
    const r = [], u = [], w = [];
    for (let j = 0; j <= 24; j++) {
      const phi = (j / 24 - 0.5) * Math.PI * 2;
      const front = Math.max(0, Math.cos(phi));
      const y = 1.515 - 0.045 * front ** 2 + (i ? -0.003 : 0);
      const p = torsoPoint(P, y, phi, 0.004 + (i ? 0.001 : 0));
      r.push(p); u.push(sw('jewel')); w.push([[B.chest, 0.7], [B.neck, 0.3]]);
    }
    rows.push(r); uvs.push(u); ws.push(w);
  }
  b.surface(rows, uvs, ws, { seam: true, group: 1 });
  const c = torsoPoint(P, 1.462, 0, 0.007);
  b.ellipsoid({ lat: 4, lon: 8, group: 1, uvFn: () => sw('jewel'), weightFn: () => [[B.chest, 1]], map: (d) => V(c.x + d.x * 0.005, c.y + d.y * 0.007, c.z + d.z * 0.003) });
}
