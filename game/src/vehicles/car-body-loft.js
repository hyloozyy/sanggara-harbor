// Smooth car bodies lofted through cross-sections. A design lists stations along the car
// (z as a fraction of its length) with the body's half-width, sill, beltline and top heights
// and the greenhouse's half-width; between stations everything is interpolated with a
// Catmull-Rom spline, so wings, bonnets, roofs and boots flow into each other. Each section is
// a rounded profile (curved sills, bulging flanks, a shoulder, a tumblehome greenhouse and a
// crowned roof). Triangles are sorted into painted panels, glass (with A/B/C pillars and roof
// left in paint) and dark trim (bumper valances, sills), each its own mesh.
import * as THREE from 'three';

const K = 15; // points per half profile

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Sample the station table at fraction z (-0.5 .. 0.5).
export function sampleStations(stations, z) {
  let i = 0;
  while (i < stations.length - 2 && z > stations[i + 1].z) i++;
  const a = stations[Math.max(0, i - 1)], b = stations[i], c = stations[i + 1], d = stations[Math.min(stations.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (z - b.z) / ((c.z - b.z) || 1)));
  const out = {};
  for (const k of ['w', 'bot', 'belt', 'top', 'wt', 'bulge']) {
    const va = a[k] ?? b[k] ?? 0, vb = b[k] ?? 0, vc = c[k] ?? vb, vd = d[k] ?? vc;
    out[k] = catmull(va, vb, vc, vd, t);
  }
  out.top = Math.max(out.top, out.belt);
  out.wt = Math.min(out.wt, out.w);
  return out;
}

// Half profile from the bottom centre round to the top centre (x >= 0).
function halfProfile(s) {
  const { w, bot, belt, top, wt } = s;
  const bulge = s.bulge ?? 0.025;
  const r1 = Math.min(0.1, (belt - bot) * 0.3);
  const cabin = top - belt;
  const rT = Math.min(0.09, cabin * 0.35 + 0.01);
  const pts = [];
  pts.push([0, bot - 0.005]);
  pts.push([w * 0.55, bot]);
  pts.push([w - r1, bot + 0.004]);
  pts.push([w - r1 * 0.3, bot + r1 * 0.3]);
  pts.push([w + bulge * 0.4, bot + r1]);
  pts.push([w + bulge, bot + (belt - bot) * 0.45]);
  pts.push([w + bulge * 0.6, bot + (belt - bot) * 0.8]);
  pts.push([w - 0.01, belt - 0.015]);
  const sh = Math.max(wt, w - 0.05);
  pts.push([sh + (w - 0.01 - sh) * 0.3, belt + Math.min(0.012, cabin * 0.5)]);
  // Greenhouse: tumblehome up to the roof rail, then the crowned roof.
  const g0 = Math.min(sh, w - 0.02), g1 = wt;
  pts.push([g0 + (g1 - g0) * 0.35, belt + cabin * 0.38]);
  pts.push([g0 + (g1 - g0) * 0.75, belt + cabin * 0.78]);
  pts.push([g1, top - rT]);
  pts.push([g1 - rT * 0.45, top - rT * 0.15]);
  pts.push([g1 * 0.5, top + cabin * 0.03]);
  pts.push([0, top + cabin * 0.035]);
  return pts;
}

// Build the body. design: { stations, len, glass: { a: [z0,z1], c: [z0,z1], b: [z...], from, to },
// trim: { front, rear } } with z as fractions of the length.
export function loftBody(design, L) {
  const st = design.stations;
  const rings = design.rings ?? 64;
  const pos = [], ringInfo = [];
  const zs = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    // Denser rings near the ends where the shape changes quickly.
    const u = -0.5 + (t < 0.5 ? 0.5 * Math.pow(t * 2, 1.25) : 1 - 0.5 * Math.pow((1 - t) * 2, 1.25));
    zs.push(u);
  }
  // Make sure each wheel arch has rings through it.
  for (const ar of design.arches || []) for (let k = -4; k <= 4; k++) zs.push((ar.z + (k / 4) * ar.r * 0.98) / L);
  zs.sort((x, y) => x - y);
  for (const zf of zs) {
    const s = sampleStations(st, zf);
    for (const ar of design.arches || []) {
      const dz = zf * L - ar.z;
      if (Math.abs(dz) < ar.r) s.bot = Math.max(s.bot, ar.y + Math.sqrt(ar.r * ar.r - dz * dz));
    }
    const half = halfProfile(s);
    const ring = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y])];
    for (const [x, y] of ring) pos.push(x, y, zf * L);
    ringInfo.push(s);
  }
  const R = 2 * K - 2;
  const ringsN = zs.length - 1;
  const groups = { paint: [], glass: [], trim: [] };
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const gl = design.glass || {};
  const inZ = (z, r) => r && z >= r[0] * L && z <= r[1] * L;
  const classify = (a, b, c, ri) => {
    const pa = P(a), pb = P(b), pc = P(c);
    const cx = (pa[0] + pb[0] + pc[0]) / 3, cy = (pa[1] + pb[1] + pc[1]) / 3, cz = (pa[2] + pb[2] + pc[2]) / 3;
    const s = ringInfo[ri];
    const cabin = s.top - s.belt;
    const zf = cz / L;
    const ax = Math.abs(cx);
    // Dark valances and sills.
    if (cy < s.bot + (design.sill ?? 0.09) && ax > s.w * 0.3) return 'trim';
    if ((zf > (design.trimFront ?? 0.46) || zf < (design.trimRear ?? -0.46)) && cy < s.bot + (design.bumperH ?? 0.16)) return 'trim';
    if (gl.none || cabin < 0.12 || cy < s.belt + 0.035 || cy > s.top - Math.min(0.06, cabin * 0.15)) return 'paint';
    if (gl.from != null && (zf < gl.from || zf > gl.to)) return 'paint';
    const sideEdge = ax > s.wt * 0.72;
    if (sideEdge && (inZ(cz, gl.a) || inZ(cz, gl.c))) return 'paint';          // A and C pillars
    if (ax > s.wt * 0.5 && (gl.b || []).some((bz) => Math.abs(zf - bz) < (gl.bw ?? 0.018))) return 'paint'; // B pillars
    if (gl.d && sideEdge && Math.abs(zf - gl.d) < 0.02) return 'paint';
    return 'glass';
  };
  for (let i = 0; i < ringsN; i++) {
    for (let j = 0; j < R; j++) {
      const j2 = (j + 1) % R;
      const a = i * R + j, b = i * R + j2, c = (i + 1) * R + j, d = (i + 1) * R + j2;
      for (const tri of [[a, b, c], [b, d, c]]) groups[classify(...tri, i)].push(...tri);
    }
  }
  // End caps (fan to the centre of the first and last rings).
  const capIdx = [];
  for (const [ri, flip] of [[0, true], [ringsN, false]]) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < R; j++) { const p = P(ri * R + j); cx += p[0]; cy += p[1]; cz += p[2]; }
    const ci = pos.length / 3;
    pos.push(cx / R, cy / R, cz / R);
    for (let j = 0; j < R; j++) {
      const a = ri * R + j, b = ri * R + (j + 1) % R;
      capIdx.push(...(flip ? [ci, a, b] : [ci, b, a]));
    }
  }
  groups.paint.push(...capIdx);
  const make = (idx) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos.slice(), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const out = { paint: make(groups.paint), glass: make(groups.glass), trim: make(groups.trim) };
  // Make sure normals point outwards (the winding depends on the profile direction).
  const n = out.paint.attributes.normal, p0 = out.paint.attributes.position;
  let dot = 0;
  for (let i = 0; i < p0.count; i += 7) dot += n.getX(i) * p0.getX(i) + n.getY(i) * (p0.getY(i) - 0.7);
  if (dot < 0) for (const g of Object.values(out)) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.index.needsUpdate = true; g.computeVertexNormals(); }
  for (const g of Object.values(out)) { g.computeBoundingSphere(); g.userData.shared = true; }
  out.sample = (zf) => sampleStations(st, zf);
  return out;
}
