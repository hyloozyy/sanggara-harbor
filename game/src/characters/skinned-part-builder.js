// Accumulates skinned body parts (tubes swept through rings and deformed ellipsoids) into one
// BufferGeometry with skin indices/weights, atlas UVs and two material groups (matte, gloss).
import * as THREE from 'three';
import { regionUV } from './atlas-layout.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class SkinnedPartBuilder {
  constructor() {
    this.pos = []; this.nrm = []; this.uv = []; this.si = []; this.sw = [];
    this.idx = [[], [], []];
    this.count = 0;
  }

  vertex(p, n, uv, weights) {
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(uv[0], uv[1]);
    const w = normaliseWeights(weights);
    for (let k = 0; k < 4; k++) { this.si.push(w[k] ? w[k][0] : 0); this.sw.push(w[k] ? w[k][1] : 0); }
    return this.count++;
  }

  // Grid of (rows × cols) vertices already added from `start`; makes outward-facing quads.
  grid(start, rows, cols, group, closeCols = false) {
    const tris = [];
    const cc = closeCols ? cols : cols - 1;
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cc; j++) {
        const j2 = (j + 1) % cols;
        const a = start + i * cols + j, b = start + i * cols + j2, c = start + (i + 1) * cols + j, d = start + (i + 1) * cols + j2;
        tris.push([a, c, b], [b, c, d]);
      }
    }
    this.pushOriented(tris, group);
  }

  // Keep winding consistent with the vertex normals (outward).
  pushOriented(tris, group) {
    const P = this.pos, N = this.nrm;
    const e1 = V(), e2 = V(), fn = V();
    for (const [a, b, c] of tris) {
      e1.set(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]);
      e2.set(P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]);
      fn.crossVectors(e1, e2);
      const nx = N[a * 3] + N[b * 3] + N[c * 3], ny = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], nz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
      if (fn.lengthSq() < 1e-14) continue;
      if (fn.x * nx + fn.y * ny + fn.z * nz >= 0) this.idx[group].push(a, b, c);
      else this.idx[group].push(a, c, b);
    }
  }

  // A tube through rings { c: [x,y,z], rx, rz, (v) }. Around the tube u = 0.5 faces `front`
  // (default +z). uvFn(u, v, p) → atlas UV, weightFn(p, v) → [[bone, w], ...].
  sweep(rings, { segments = 14, region, uvFn = null, weightFn, group = 0, front = V(0, 0, 1), uRange = [0, 1] }) {
    const n = rings.length;
    const C = rings.map((r) => V(...r.c));
    let len = 0;
    const dist = [0];
    for (let i = 1; i < n; i++) { len += C[i].distanceTo(C[i - 1]); dist.push(len); }
    const start = this.count;
    const cols = segments + 1;
    for (let i = 0; i < n; i++) {
      const t = C[Math.min(n - 1, i + 1)].clone().sub(C[Math.max(0, i - 1)]).normalize();
      const side = front.clone().cross(t).normalize();          // to the tube's left
      if (side.lengthSq() < 0.5) side.set(1, 0, 0);
      const fwd = t.clone().cross(side).normalize();            // towards `front`
      if (fwd.dot(front) < 0) fwd.negate();
      const r = rings[i];
      const ra = Math.max(0.0005, (r.rx + r.rz) * 0.5);
      const ip = Math.max(0, i - 1), inx = Math.min(n - 1, i + 1);
      const ds = dist[inx] - dist[ip] || 1;
      const slope = (((rings[inx].rx + rings[inx].rz) - (rings[ip].rx + rings[ip].rz)) * 0.5) / ds;
      const v = r.v ?? 1 - dist[i] / (len || 1);
      for (let j = 0; j <= segments; j++) {
        const u = uRange[0] + (j / segments) * (uRange[1] - uRange[0]);
        const phi = (u - 0.5) * Math.PI * 2;
        const s = Math.sin(phi), c = Math.cos(phi);
        const p = C[i].clone().addScaledVector(side, s * r.rx).addScaledVector(fwd, c * r.rz);
        const n0 = side.clone().multiplyScalar(s / Math.max(r.rx, 1e-4)).addScaledVector(fwd, c / Math.max(r.rz, 1e-4)).normalize();
        const nn = n0.clone().addScaledVector(t, -slope * (ra > 0.001 ? 1 : 0)).normalize();
        const uv = uvFn ? uvFn(u, v, p) : regionUV(region, u, v);
        this.vertex(p, nn, uv, weightFn(p, v, u));
      }
    }
    this.grid(start, n, cols, group);
    return this;
  }

  // A deformed (super)ellipsoid. map(dir) → position; keep(dir) can cut holes (hairlines,
  // face openings). uvFn(dir, p) → atlas UV.
  ellipsoid({ lat = 12, lon = 18, map, uvFn, weightFn, group = 0, keep = null }) {
    const start = this.count;
    const cols = lon + 1;
    const dirs = [];
    const P = [];
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const ph = (j / lon) * Math.PI * 2;
        const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
        dirs.push(d); P.push(map(d));
      }
    }
    // Normals by finite differences of the mapping.
    const eps = 0.002;
    for (let k = 0; k < dirs.length; k++) {
      const d = dirs[k];
      const a = Math.abs(d.y) > 0.95 ? V(1, 0, 0) : V(0, 1, 0);
      const t1 = a.clone().cross(d).normalize(), t2 = d.clone().cross(t1).normalize();
      const p1 = map(d.clone().addScaledVector(t1, eps).normalize()).sub(P[k]);
      const p2 = map(d.clone().addScaledVector(t2, eps).normalize()).sub(P[k]);
      const nn = p1.cross(p2).normalize();
      if (!Number.isFinite(nn.x) || nn.lengthSq() < 0.5) nn.copy(d);
      if (nn.dot(d) < 0) nn.negate();
      this.vertex(P[k], nn, uvFn(d, P[k]), weightFn(P[k], d));
    }
    const tris = [];
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = start + i * cols + j, b = a + 1, c = a + cols, d2 = c + 1;
        for (const tri of [[a, c, b], [b, c, d2]]) {
          if (keep && !tri.every((q) => keep(dirs[q - start]))) continue;
          tris.push(tri);
        }
      }
    }
    this.pushOriented(tris, group);
    return this;
  }

  // A general grid surface: pts[i][j] (rows × cols) with uv[i][j] and weights[i][j]. Normals
  // come from the grid's own neighbours (central differences), so any parametric shape is
  // smooth; closeCols wraps the last column to the first (tubes). skip(i, j) drops a quad
  // (holes such as the parted lips). Returns the index of the first vertex.
  surface(pts, uvs, weights, { closeCols = false, seam = false, group = 0, skip = null, normalSign = 1, normals = null } = {}) {
    const rows = pts.length, cols = pts[0].length;
    const start = this.count;
    const t1 = V(), t2 = V(), off = V();
    const nrm = [];
    // Outward reference for the orientation vote: each row's centroid, else the whole centroid.
    const all = V(); let cnt = 0;
    const rowC = pts.map((r) => { const c = V(); for (const p of r) c.add(p); all.add(c); cnt += r.length; return c.multiplyScalar(1 / r.length); });
    all.multiplyScalar(1 / cnt);
    let vote = 0;
    for (let i = 0; i < rows; i++) {
      const nr = [];
      for (let j = 0; j < cols; j++) {
        const n = V();
        if (normals) n.copy(normals[i][j]);
        else {
          // seam: the last column repeats the first (a UV seam), so neighbours wrap past it.
          let jp = closeCols ? (j + 1) % cols : Math.min(cols - 1, j + 1), jm = closeCols ? (j - 1 + cols) % cols : Math.max(0, j - 1);
          if (seam) { jp = j === cols - 1 ? 1 : j + 1; jm = j === 0 ? cols - 2 : j - 1; }
          const ip = Math.min(rows - 1, i + 1), im = Math.max(0, i - 1);
          t1.subVectors(pts[i][jp], pts[i][jm]);
          t2.subVectors(pts[ip][j], pts[im][j]);
          n.crossVectors(t1, t2);
          if (n.lengthSq() < 1e-16) {
            // Degenerate (a pole): borrow the neighbouring row.
            const k = i === 0 ? 1 : rows - 2;
            t1.subVectors(pts[k][jp], pts[k][jm]); t2.subVectors(pts[Math.min(rows - 1, k + 1)][j], pts[Math.max(0, k - 1)][j]);
            n.crossVectors(t1, t2);
          }
          n.normalize();
          off.subVectors(pts[i][j], rowC[i]);
          if (off.lengthSq() < 1e-10) off.subVectors(pts[i][j], all);
          vote += Math.sign(n.dot(off));
        }
        nr.push(n);
      }
      nrm.push(nr);
    }
    const flip = (!normals && vote < 0 ? -1 : 1) * normalSign;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) this.vertex(pts[i][j], nrm[i][j].multiplyScalar(flip), uvs[i][j], weights[i][j]);
    const tris = [];
    const cc = closeCols ? cols : cols - 1;
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cc; j++) {
        if (skip && skip(i, j)) continue;
        const j2 = (j + 1) % cols;
        const a = start + i * cols + j, b = start + i * cols + j2, c = start + (i + 1) * cols + j, d = start + (i + 1) * cols + j2;
        tris.push([a, c, b], [b, c, d]);
      }
    }
    this.pushOriented(tris, group);
    return start;
  }

  // A tube along a centre line: centre(t) → Vector3, frame given by `front` like sweep, and
  // radius(t, phi) → [rSide, rFront] style offsets via shape(t, phi) → {x, z} in the ring's
  // (side, fwd) frame. rows/cols resolution; caps are closed by shrinking the end rings.
  tube({ rows, cols, centre, shape, uvFn, weightFn, front = V(0, 0, 1), group = 0, sideRef = null }) {
    const pts = [], uvs = [], ws = [];
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1);
      const c = centre(t);
      const tan = centre(Math.min(1, t + 0.01)).sub(centre(Math.max(0, t - 0.01))).normalize();
      const side = sideRef ? sideRef.clone() : front.clone().cross(tan);
      side.addScaledVector(tan, -side.dot(tan)).normalize();
      const fwd = tan.clone().cross(side).normalize();
      if (fwd.dot(front) < 0) fwd.negate();
      const row = [], urow = [], wrow = [];
      for (let j = 0; j <= cols; j++) {
        const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
        const o = shape(t, phi);
        const p = c.clone().addScaledVector(side, o.x).addScaledVector(fwd, o.z);
        row.push(p); urow.push(uvFn(u, t, p)); wrow.push(weightFn(p, t, u));
      }
      pts.push(row); uvs.push(urow); ws.push(wrow);
    }
    return this.surface(pts, uvs, ws, { seam: true, group });
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    // Groups: 0 matte (skin, cloth), 1 gloss (eyes, lenses, leather), 2 alpha-tested cards (hair).
    const all = [...this.idx[0], ...this.idx[1], ...this.idx[2]];
    g.setIndex(all);
    g.addGroup(0, this.idx[0].length, 0);
    g.addGroup(this.idx[0].length, this.idx[1].length, 1);
    if (this.idx[2].length) g.addGroup(this.idx[0].length + this.idx[1].length, this.idx[2].length, 2);
    g.computeBoundingSphere();
    g.boundingSphere.radius = Math.max(g.boundingSphere.radius, 1.2);
    return g;
  }
}

function normaliseWeights(list) {
  const merged = new Map();
  for (const [b, w] of list) if (w > 0.001) merged.set(b, (merged.get(b) || 0) + w);
  const arr = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = arr.reduce((s, [, w]) => s + w, 0) || 1;
  return arr.map(([b, w]) => [b, w / sum]);
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export { V };
