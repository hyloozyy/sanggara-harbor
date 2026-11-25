// Smooth parametric car bodies. A design is a table of stations along the car (half-width, sill,
// beltline, roof and greenhouse width at fractions of the length); between stations every value
// follows a monotone cubic, so bonnets, roofs and boots flow without overshoot. Each station
// becomes a cross-section through 14 named key points (floor, sill, rocker, character line,
// shoulder, glass base, window bottom/top, roof rail, roof edge, crown) joined by a centripetal
// Catmull-Rom spline, so every feature line runs cleanly along the car. The ends close with a
// rounded edge onto a flat fascia, wheel arches are cut as true circles with flared fenders.
//
// The surface S(u, v) is parametrised by u (along the car, |u| <= 0.5 is the body, beyond is the
// rounded nose/tail) and v (around the section: 0 bottom centre, K crown, 2K back to the bottom
// on the left). It is tessellated as ONE structured grid whose column lines may lean with v, so
// window and pillar edges are exact grid lines: glass, holes and trim are whole cells and no edge
// is ever jagged. The same surface drives projected parts (lamps, grilles, plates), ribbons
// (window frames, door seams, wipers) and patches (pillar blackouts, liveries, skirts).
import * as THREE from 'three';

export const KEYS = 14;            // key points per half section (0..13)
export const K = KEYS - 1;         // v of the crown
export const KV = { floor: 1, sill: 3, rocker: 4, line: 5, shoulder: 6, deck: 7, glass0: 8, win0: 9, win1: 10, rail: 11, roof: 12, crown: 13 };

// ------------------------------------------------------------------ station interpolation
function pchipSlopes(xs, ys) {
  const n = xs.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / ((xs[i + 1] - xs[i]) || 1e-6));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i]; const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return m;
}
function pchip(xs, ys, ms, x) {
  if (x <= xs[0]) return ys[0];
  const n = xs.length;
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = 0;
  while (i < n - 2 && x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * ms[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * ms[i + 1];
}

const FIELDS = ['w', 'bot', 'belt', 'top', 'wt', 'bulge', 'dip'];

// ------------------------------------------------------------------ the surface
export class BodySurface {
  // design: { stations: [{z, w, bot, belt, top, wt, bulge}], nose, tail, arches: [{z, r, y, flare}] } in metres,
  // z of stations as fractions of the body length.
  constructor(design, L) {
    this.d = design; this.L = L;
    this.nose = design.rNose ?? 0.07; this.tailR = design.rTail ?? 0.06;
    this.faceF = design.faceF ?? 0.1; this.faceR = design.faceR ?? 0.07;
    this.bodyL = L - this.nose - this.tailR - this.faceF - this.faceR;
    this.zMid = (this.tailR + this.faceR - this.nose - this.faceF) / 2;  // body centre offset so the overall length is L
    const st = design.stations;
    this.xs = st.map((s) => s.z);
    this.tables = {};
    for (const f of FIELDS) {
      const ys = st.map((s) => s[f] ?? (f === 'bulge' ? 0.03 : 0));
      this.tables[f] = { ys, ms: pchipSlopes(this.xs, ys) };
    }
    this.arches = design.arches || [];
    this.capU = 0.06;
    this.ringCache = new Map();
  }

  // z (metres) of body param u (|u| <= 0.5).
  zOf(u) { return this.zMid + u * this.bodyL; }

  station(u) {
    const s = {};
    for (const f of FIELDS) { const t = this.tables[f]; s[f] = pchip(this.xs, t.ys, t.ms, u); }
    s.top = Math.max(s.top, s.belt);
    s.wt = Math.min(s.wt, s.w);
    const z = this.zOf(u);
    s.flare = 0;
    s.archBot = s.bot;
    for (const a of this.arches) {
      const dz = z - a.z;
      if (Math.abs(dz) < a.r) s.archBot = Math.max(s.archBot, a.y + Math.sqrt(a.r * a.r - dz * dz));
      const k = Math.max(0, 1 - (dz / (a.r * 1.5)) ** 2);
      s.flare = Math.max(s.flare, (a.flare ?? 0.02) * k * k * (3 - 2 * k));
    }
    return s;
  }

  // The 14 key points (x >= 0) of the section at body param u.
  keys(u) {
    const s = this.station(u);
    const { w, belt, top, wt, bulge, flare } = s;
    // Wheel arches cut only the outer part of the section (the wheel wells); the floor and the
    // middle of the bumpers stay where they are.
    const floor = s.bot, bot = s.archBot;
    const H = Math.max(0.05, belt - bot), C = Math.max(0, top - belt);
    const r1 = Math.min(0.1, H * 0.32);
    const fl = flare;
    const gb = Math.max(wt, w - 0.055);
    const crown = 0.022 + 0.022 * Math.min(1, C / 0.3);
    const cy = Math.min(0.02, C * 0.12);
    return [
      [0, floor],
      [w * 0.62, floor + (bot - floor) * 0.15],
      [w - r1 * 0.85, bot + 0.002],
      [w + bulge * 0.2 + fl * 0.6, bot + r1 * 0.75],
      [w + bulge * 0.7 + fl, bot + H * 0.36],
      [w + bulge + fl * 0.8, bot + H * 0.64],
      [w + bulge * 0.55 + fl * 0.3, belt - Math.min(0.045, H * 0.12)],
      [w - 0.012, belt - 0.002],
      [gb, belt + cy],
      [gb + (wt - gb) * 0.14, belt + cy + (C - cy) * 0.1],
      [gb + (wt - gb) * 0.9, belt + cy + (C - cy) * 0.9],
      [wt - 0.002, belt + C * 0.975],
      [wt * 0.84, top + crown * 0.55 - (s.dip ?? 0) * 0.45],
      [0, top + crown - (s.dip ?? 0)],
    ];
  }

  // Centripetal Catmull-Rom through the key points; v in [0, K].
  static evalKeys(P, v) {
    const i = Math.min(K - 1, Math.max(0, Math.floor(v))), t = Math.min(1, Math.max(0, v - i));
    const p1 = P[i], p2 = P[i + 1];
    const p0 = i > 0 ? P[i - 1] : [-P[1][0], P[1][1]];
    const p3 = i + 2 <= K ? P[i + 2] : [-P[K - 1][0], P[K - 1][1]];
    const dt = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const t0 = 0, t1 = t0 + dt(p0, p1), t2 = t1 + dt(p1, p2), t3 = t2 + dt(p2, p3);
    const tt = t1 + (t2 - t1) * t;
    const out = [0, 0];
    for (let c = 0; c < 2; c++) {
      const A1 = (t1 - tt) / (t1 - t0) * p0[c] + (tt - t0) / (t1 - t0) * p1[c];
      const A2 = (t2 - tt) / (t2 - t1) * p1[c] + (tt - t1) / (t2 - t1) * p2[c];
      const A3 = (t3 - tt) / (t3 - t2) * p2[c] + (tt - t2) / (t3 - t2) * p3[c];
      const B1 = (t2 - tt) / (t2 - t0) * A1 + (tt - t0) / (t2 - t0) * A2;
      const B2 = (t3 - tt) / (t3 - t1) * A2 + (tt - t1) / (t3 - t1) * A3;
      out[c] = (t2 - tt) / (t2 - t1) * B1 + (tt - t1) / (t2 - t1) * B2;
    }
    return out;
  }

  // Point on the surface. u beyond +-0.5 runs over the rounded edge onto the flat end face.
  point(u, v) {
    const vv = v > K ? 2 * K - v : v, sx = v > K ? -1 : 1;
    const au = Math.abs(u);
    if (au <= 0.5) {
      const P = this.keysCached(u);
      const [x, y] = BodySurface.evalKeys(P, vv);
      return [sx * x, y, this.zOf(u)];
    }
    const sgn = Math.sign(u), end = sgn * 0.5, rho = sgn > 0 ? this.nose : this.tailR;
    const P = this.keysCached(end);
    const [x, y] = BodySurface.evalKeys(P, vv);
    // In-plane outward normal from the section tangent.
    const a = BodySurface.evalKeys(P, Math.max(0, vv - 0.02)), b = BodySurface.evalKeys(P, Math.min(K, vv + 0.02));
    let nx = b[1] - a[1], ny = -(b[0] - a[0]);
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    if (vv < 1e-3) { nx = 0; ny = -1; } else if (vv > K - 1e-3) { nx = 0; ny = 1; }
    const t = Math.min(1, (au - 0.5) / this.capU);
    const c = this.endCentre(end);
    let px, py, dz;
    if (t <= 0.5) {
      const th = (t / 0.5) * Math.PI / 2;
      const inset = rho * (1 - Math.cos(th));
      px = x - nx * inset; py = y - ny * inset; dz = rho * Math.sin(th);
    } else {
      const tau = (t - 0.5) / 0.5, k = 1 - tau;
      const ix = x - nx * rho, iy = y - ny * rho;
      px = c[0] + (ix - c[0]) * k; py = c[1] + (iy - c[1]) * k;
      // The end face is domed so bumpers curve in plan and section.
      dz = rho + (sgn > 0 ? this.faceF : this.faceR) * (1 - k * k);
    }
    return [sx * px, py, this.zOf(end) + sgn * dz];
  }

  keysCached(u) {
    const k = Math.round(u * 1e6);
    let P = this.ringCache.get(k);
    if (!P) { P = this.keys(u); if (this.ringCache.size > 20000) this.ringCache.clear(); this.ringCache.set(k, P); }
    return P;
  }

  endCentre(end) {
    const P = this.keysCached(end);
    let lo = Infinity, hi = -Infinity;
    for (const p of P) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); }
    return [0, (lo + hi) / 2];
  }

  // Outward unit normal by finite differences.
  normal(u, v) {
    const e = 0.002, f = 0.01;
    const lim = 0.5 + this.capU - 1e-4;
    const u0 = Math.max(-lim, u - e), u1 = Math.min(lim, u + e);
    const a = this.point(u0, v), b = this.point(u1, v), c = this.point(u, v - f), d = this.point(u, v + f);
    const du = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], dv = [d[0] - c[0], d[1] - c[1], d[2] - c[2]];
    let n = [du[1] * dv[2] - du[2] * dv[1], du[2] * dv[0] - du[0] * dv[2], du[0] * dv[1] - du[1] * dv[0]];
    const p = this.point(u, v), cy = this.endCentre(Math.max(-0.5, Math.min(0.5, u)))[1];
    const out = [p[0], (p[1] - cy) * 0.6, Math.abs(u) > 0.5 ? Math.sign(u) : 0];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) n = n.map((x) => -x);
    const l = Math.hypot(...n) || 1;
    return n.map((x) => x / l);
  }

  // Low-resolution full section polygon at u (for inside tests).
  ring(u) {
    const pts = [];
    for (let i = 0; i <= 26; i++) { const p = this.point(u, (i / 26) * K); pts.push([p[0], p[1]]); }
    for (let i = 25; i >= 1; i--) { const p = pts[i]; pts.push([-p[0], p[1]]); }
    return pts;
  }

  static inside(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  // Where a ray along z (dir +1 front, -1 rear) through (x, y) meets the body: returns u.
  endU(x, y, dir) {
    let lo = dir * 0.25, hi = dir * (0.5 + this.capU - 1e-4);
    if (!BodySurface.inside(this.ring(lo), x, y)) {
      lo = dir * 0.0;
      if (!BodySurface.inside(this.ring(lo), x, y)) return null;
    }
    for (let i = 0; i < 26; i++) {
      const m = (lo + hi) / 2;
      if (BodySurface.inside(this.ring(m), x, y)) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }

  // Point and normal on the front/rear surface at (x, y).
  endPoint(x, y, dir) {
    const u = this.endU(x, y, dir);
    if (u == null) return null;
    const z = Math.abs(u) <= 0.5 ? this.zOf(u) : this.point(u, 0)[2];
    // Normal: sample neighbours.
    const e = 0.01;
    const zx = this.endZ(x + e, y, dir, z), zy = this.endZ(x, y + e, dir, z);
    const n = new THREE.Vector3(-(zx - z) / e, -(zy - z) / e, 1).multiplyScalar(dir);
    n.z = dir; n.normalize();
    return { p: new THREE.Vector3(x, y, z), n };
  }
  endZ(x, y, dir, fallback) {
    const u = this.endU(x, y, dir);
    if (u == null) return fallback;
    return Math.abs(u) <= 0.5 ? this.zOf(u) : this.point(u, 0)[2];
  }

  // v of the point on the right half at body param u with height y, between key rows va..vb.
  vAtY(u, y, va = KV.sill, vb = KV.deck) {
    let lo = va, hi = vb;
    const ylo = this.point(u, lo)[1];
    const up = this.point(u, hi)[1] > ylo;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) / 2, py = this.point(u, m)[1];
      if ((py < y) === up) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  }
}

// ------------------------------------------------------------------ grid tessellation
// lines: [{ name, f: (v) => u }] (v in [0, K] on the right half; mirrored on the left).
// regions: [{ cls, from, to, v0, v1 }] — cells between lines `from` and `to` and key rows v0..v1
// (on both sides; v1 > K means across the crown). First match wins; default 'paint'.
export function tessellate(surf, lines, regions, { target = 0.085, rowSegs } = {}) {
  lines = [...lines].sort((a, b) => a.f(K * 0.7) - b.f(K * 0.7));
  const names = lines.map((l) => l.name);
  const lineAt = (i, v) => {
    const vv = v > K ? 2 * K - v : v;
    let u = lines[0].f(vv);
    for (let k = 1; k <= i; k++) u = Math.max(u + 1e-5, lines[k].f(vv));
    return u;
  };
  // Rows: key points subdivided.
  const segs = rowSegs ?? [2, 2, 2, 3, 3, 3, 2, 2, 1, 4, 1, 3, 4];
  const rows = [];
  for (let i = 0; i < K; i++) for (let j = 0; j < segs[i]; j++) rows.push(i + j / segs[i]);
  // Full ring: bottom centre up the right side to the crown and down the left side.
  const full = [...rows, K, ...rows.slice(1).reverse().map((v) => 2 * K - v)];
  // Columns: subdivide between consecutive lines by surface distance.
  const cols = []; // { i (line pair), a (fraction) }
  const probes = [1, 3.5, 5, 7, 9.5, 11.5, 13];
  for (let i = 0; i < lines.length - 1; i++) {
    let dist = 0;
    for (const v of probes) {
      const p = surf.point(lineAt(i, v), v), q = surf.point(lineAt(i + 1, v), v);
      dist = Math.max(dist, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
    }
    const n = Math.max(1, Math.min(48, Math.ceil(dist / target)));
    for (let j = 0; j < n; j++) cols.push({ i, a: j / n });
  }
  cols.push({ i: lines.length - 2, a: 1 });
  const colU = (c, v) => { const u0 = lineAt(c.i, v), u1 = lineAt(c.i + 1, v); return u0 + (u1 - u0) * c.a; };
  const R = full.length, Cn = cols.length;
  const pos = new Float32Array(R * Cn * 3), uv = new Float32Array(R * Cn * 2);
  for (let ci = 0; ci < Cn; ci++) {
    let arc = 0, prev = null;
    for (let ri = 0; ri < R; ri++) {
      const v = full[ri], p = surf.point(colU(cols[ci], v), v);
      const k = ci * R + ri;
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2];
      if (prev) arc += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      prev = p;
      uv[k * 2] = p[2] * 1.0; uv[k * 2 + 1] = arc * 1.0;
    }
  }
  // Classify cells.
  const regionIdx = regions.map((rg) => ({ ...rg, a: names.indexOf(rg.from), b: names.indexOf(rg.to) }));
  for (const rg of regionIdx) if (rg.a < 0 || rg.b < 0) throw new Error(`body region lines missing: ${rg.from} ${rg.to}`);
  const cls = (ci, ri) => {
    const li = cols[ci].i;
    const v1 = ri === R - 1 ? 2 * K : full[ri + 1];
    const vm = (full[ri] + v1) / 2, seg = Math.floor(vm > K ? 2 * K - vm : vm);
    for (const rg of regionIdx) {
      if (li < Math.min(rg.a, rg.b) || li >= Math.max(rg.a, rg.b)) continue;
      if (seg >= rg.v0 && (rg.v1 > K || seg < rg.v1)) return rg.cls;
    }
    return 'paint';
  };
  const groups = {};
  for (let ci = 0; ci < Cn - 1; ci++) for (let ri = 0; ri < R; ri++) {
    const r2 = (ri + 1) % R;
    const a = ci * R + ri, b = ci * R + r2, c = (ci + 1) * R + ri, d = (ci + 1) * R + r2;
    const g = cls(ci, ri);
    (groups[g] ||= []).push(a, c, b, b, c, d);
  }
  // Orient the faces outwards: test a cell on the right flank.
  {
    const ci = Math.floor(Cn / 2), ri = full.findIndex((v) => v >= KV.line);
    const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    const a = P(ci * R + ri), b = P(ci * R + ri + 1), c = P((ci + 1) * R + ri);
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const nx = e1[1] * e2[2] - e1[2] * e2[1];
    if (nx < 0) for (const ix of Object.values(groups)) for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
  }
  return { pos, uv, groups, R, Cn, rows: full, cols, colU, lineAt, names };
}
