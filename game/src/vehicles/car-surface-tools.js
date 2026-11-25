// Parts that sit ON a BodySurface: ribbons along (u, v) paths (window frames, door seams,
// wipers, chrome lines), conforming patches over (u, v) regions (pillar blackouts, cladding,
// liveries) and outlines projected along z onto the nose or tail (lamps, grilles, intakes,
// plates). Each returns raw { points, normals, tris, uvs } for a PartList or a plain geometry.
import * as THREE from 'three';
import { K } from './car-body.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Densify a polyline in (u, v).
function densify(path, step = 0.08) {
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [u0, v0] = path[i], [u1, v1] = path[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot((u1 - u0) * 20, v1 - v0) / step / 6));
    for (let j = 0; j < n; j++) out.push([u0 + (u1 - u0) * j / n, v0 + (v1 - v0) * j / n]);
  }
  out.push(path[path.length - 1]);
  return out;
}

// A flat strip of `width` metres along a (u, v) path, lifted `off` metres off the surface.
// mirror: also build it on the other side (v -> 2K - v).
export function ribbon(surf, path, width, off = 0.002, { mirror = true, samples = null, closed = false } = {}) {
  const res = { points: [], normals: [], tris: [], uvs: [] };
  const sides = mirror ? [1, -1] : [1];
  for (const s of sides) {
    let pts = samples ? path : densify(closed ? [...path, path[0]] : path);
    if (s < 0) pts = pts.map(([u, v]) => [u, 2 * K - v]);
    const P = pts.map(([u, v]) => surf.point(u, v)), N = pts.map(([u, v]) => surf.normal(u, v));
    const base = res.points.length;
    let len = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const t = norm(sub(b, a)), side = norm(cross(N[i], t));
      if (i) len += Math.hypot(...sub(P[i], P[i - 1]));
      for (const k of [-0.5, 0.5]) {
        res.points.push([P[i][0] + side[0] * width * k + N[i][0] * off, P[i][1] + side[1] * width * k + N[i][1] * off, P[i][2] + side[2] * width * k + N[i][2] * off]);
        res.normals.push(N[i]);
        res.uvs.push([k + 0.5, len]);
      }
    }
    for (let i = 0; i < P.length - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      // Orient so the face points along the normal.
      const e1 = sub(res.points[c], res.points[a]), e2 = sub(res.points[b], res.points[a]);
      const fn = cross(e1, e2);
      if (fn[0] * N[i][0] + fn[1] * N[i][1] + fn[2] * N[i][2] > 0) res.tris.push([a, c, b], [b, c, d]);
      else res.tris.push([a, b, c], [b, d, c]);
    }
  }
  return res;
}

// A patch over the surface: u from u0(v) to u1(v), v from v0 to v1 (right side; mirrored too).
export function patch(surf, u0, u1, v0, v1, off = 0.003, { nu = 8, nv = 4, mirror = true, uvFlip = false } = {}) {
  const res = { points: [], normals: [], tris: [], uvs: [] };
  const U0 = typeof u0 === 'function' ? u0 : () => u0, U1 = typeof u1 === 'function' ? u1 : () => u1;
  for (const s of mirror ? [1, -1] : [1]) {
    const base = res.points.length;
    for (let j = 0; j <= nv; j++) {
      const v = v0 + (v1 - v0) * j / nv, vv = s > 0 ? v : 2 * K - v;
      for (let i = 0; i <= nu; i++) {
        const u = U0(v) + (U1(v) - U0(v)) * i / nu;
        const p = surf.point(u, vv), n = surf.normal(u, vv);
        res.points.push([p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off]);
        res.normals.push(n);
        // Texture u runs front to back on the left side so text reads correctly on both flanks.
        const tu = s > 0 !== uvFlip ? i / nu : 1 - i / nu;
        res.uvs.push([tu, j / nv]);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      const e1 = sub(res.points[b], res.points[a]), e2 = sub(res.points[c], res.points[a]), fn = cross(e1, e2), n = res.normals[a];
      if (fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] > 0) res.tris.push([a, b, c], [b, d, c]);
      else res.tris.push([a, c, b], [b, c, d]);
    }
  }
  return res;
}

// Project a front-view quad ([x, y] corners: top-inner, top-outer, bottom-outer, bottom-inner;
// x in metres) onto the nose (dir 1) or tail (dir -1). Mirrored to the left when mirror is set.
export function endQuad(surf, quad, dir, off = 0.004, { nx = 8, ny = 4, mirror = true, sub: subRect = null } = {}) {
  const res = { points: [], normals: [], tris: [], uvs: [] };
  for (const s of mirror ? [1, -1] : [1]) {
    const base = res.points.length, ok = [];
    const [s0, s1, t0, t1] = subRect || [0, 1, 0, 1];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const a = s0 + (s1 - s0) * i / nx, b = t0 + (t1 - t0) * j / ny;
      const top = [quad[0][0] + (quad[1][0] - quad[0][0]) * a, quad[0][1] + (quad[1][1] - quad[0][1]) * a];
      const bot = [quad[3][0] + (quad[2][0] - quad[3][0]) * a, quad[3][1] + (quad[2][1] - quad[3][1]) * a];
      const x = (top[0] + (bot[0] - top[0]) * b) * s, y = top[1] + (bot[1] - top[1]) * b;
      const hit = surf.endPoint(x, y, dir);
      ok.push(!!hit);
      if (hit) {
        res.points.push([hit.p.x + hit.n.x * off, hit.p.y + hit.n.y * off, hit.p.z + hit.n.z * off]);
        res.normals.push([hit.n.x, hit.n.y, hit.n.z]);
      } else { res.points.push([x, y, 0]); res.normals.push([0, 0, dir]); }
      res.uvs.push([s > 0 === dir > 0 ? a : 1 - a, 1 - b]);
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      if (!ok[a] || !ok[b] || !ok[c] || !ok[d]) continue;
      const A = base + a, B = base + b, C = base + c, D = base + d;
      const fn = cross(sub(res.points[B], res.points[A]), sub(res.points[C], res.points[A])), n = res.normals[A];
      if (fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2] > 0) res.tris.push([A, B, C], [B, D, C]);
      else res.tris.push([A, C, B], [B, C, D]);
    }
  }
  return res;
}

// A disc of radius r projected onto the nose/tail at (x, y).
export function endDisc(surf, x, y, r, dir, off = 0.005, { seg = 14, mirror = true } = {}) {
  const res = { points: [], normals: [], tris: [], uvs: [] };
  for (const s of mirror ? [1, -1] : [1]) {
    const c = surf.endPoint(x * s, y, dir);
    if (!c) continue;
    const base = res.points.length;
    const n = c.n, up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(n, up).normalize(), t2 = new THREE.Vector3().crossVectors(n, t1);
    res.points.push([c.p.x + n.x * off, c.p.y + n.y * off, c.p.z + n.z * off]); res.normals.push([n.x, n.y, n.z]); res.uvs.push([0.5, 0.5]);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const p = c.p.clone().addScaledVector(t1, Math.cos(a) * r).addScaledVector(t2, Math.sin(a) * r).addScaledVector(n, off);
      res.points.push([p.x, p.y, p.z]); res.normals.push([n.x, n.y, n.z]); res.uvs.push([0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2]);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + 1 + i, b = base + 1 + (i + 1) % seg;
      const fn = cross(sub(res.points[a], res.points[base]), sub(res.points[b], res.points[base]));
      if (fn[0] * n.x + fn[1] * n.y + fn[2] * n.z > 0) res.tris.push([base, a, b]); else res.tris.push([base, b, a]);
    }
  }
  return res;
}

// Combine raw part results.
export function joinRaw(...list) {
  const res = { points: [], normals: [], tris: [], uvs: [] };
  for (const r of list) {
    const base = res.points.length;
    res.points.push(...r.points); res.normals.push(...r.normals); res.uvs.push(...r.uvs);
    for (const t of r.tris) res.tris.push([t[0] + base, t[1] + base, t[2] + base]);
  }
  return res;
}
