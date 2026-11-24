// Small numeric helpers shared by physics, AI and the camera.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDamp(a, b, rate, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));
}

export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const dist = (ax, az, bx, bz) => Math.sqrt(dist2(ax, az, bx, bz));

// Heading angle (rotation.y) that makes local +z point along (dx, dz).
export const headingTo = (dx, dz) => Math.atan2(dx, dz);

// Ray (origin o, direction d normalised) against an axis-aligned box in xz plus height; returns distance or Infinity.
export function rayBox(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
  let tmin = 0, tmax = Infinity;
  const axes = [[ox, dx, minX, maxX], [oy, dy, minY, maxY], [oz, dz, minZ, maxZ]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) return Infinity; continue; }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// Ray against a sphere; returns distance or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

// US dollars with US digit grouping, e.g. $12,500.
export function formatMoney(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
