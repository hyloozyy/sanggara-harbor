// The drivable road network as a grid graph of intersections, with left-hand lanes (Indonesian
// traffic keeps left), route-finding toward a target, and a steering helper for AI drivers.
import { GRID, LANE_OFFSET } from '../city/city-layout.js';
import { clamp, wrapAngle } from '../core/math-utils.js';

export const N = GRID.length;
export const nodePos = (i, j) => ({ x: GRID[i], z: GRID[j] });

export function neighbours(i, j) {
  const out = [];
  if (i > 0) out.push([i - 1, j]);
  if (i < N - 1) out.push([i + 1, j]);
  if (j > 0) out.push([i, j - 1]);
  if (j < N - 1) out.push([i, j + 1]);
  return out;
}

// Lane centre line for travel from node a to node b: offset to the driver's left.
export function laneLine(a, b) {
  const pa = nodePos(a[0], a[1]), pb = nodePos(b[0], b[1]);
  const dx = Math.sign(pb.x - pa.x), dz = Math.sign(pb.z - pa.z);
  const lx = dz, lz = -dx; // left of travel direction
  return { ax: pa.x + lx * LANE_OFFSET, az: pa.z + lz * LANE_OFFSET, bx: pb.x + lx * LANE_OFFSET, bz: pb.z + lz * LANE_OFFSET, dx, dz, axis: dx !== 0 ? 'ew' : 'ns' };
}

export function nearestNode(x, z) {
  let bi = 0, bj = 0, bd = Infinity;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const d = (GRID[i] - x) ** 2 + (GRID[j] - z) ** 2;
    if (d < bd) { bd = d; bi = i; bj = j; }
  }
  return [bi, bj];
}

// The edge a car at (x, z) heading `heading` is most plausibly on.
export function edgeFromPose(x, z, heading) {
  const fx = Math.sin(heading), fz = Math.cos(heading);
  let best = null, bestScore = Infinity;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    for (const nb of neighbours(i, j)) {
      const L = laneLine([i, j], nb);
      const len = Math.hypot(L.bx - L.ax, L.bz - L.az);
      const t = clamp(((x - L.ax) * L.dx + (z - L.az) * L.dz) / len, 0, 1);
      const px = L.ax + (L.bx - L.ax) * t, pz = L.az + (L.bz - L.az) * t;
      const d = Math.hypot(px - x, pz - z);
      const align = 1 - (fx * L.dx + fz * L.dz);
      const score = d + align * 12;
      if (score < bestScore) { bestScore = score; best = { from: [i, j], to: nb }; }
    }
  }
  return best;
}

// Choose the next node after arriving at `at` having come from `from`.
export function chooseNext(from, at, rng, target = null) {
  const options = neighbours(at[0], at[1]).filter(([i, j]) => !(i === from[0] && j === from[1]));
  if (!options.length) return from;
  if (target) {
    options.sort((a, b) => {
      const pa = nodePos(a[0], a[1]), pb = nodePos(b[0], b[1]);
      return Math.hypot(pa.x - target.x, pa.z - target.z) - Math.hypot(pb.x - target.x, pb.z - target.z);
    });
    return rng.chance(0.85) ? options[0] : rng.pick(options);
  }
  // Prefer going straight a bit more often.
  const straight = options.find(([i, j]) => i - at[0] === at[0] - from[0] && j - at[1] === at[1] - from[1]);
  if (straight && rng.chance(0.5)) return straight;
  return rng.pick(options);
}

// Pure-pursuit steering value (-1..1) toward a point.
export function steerToward(vehicle, tx, tz) {
  const desired = Math.atan2(tx - vehicle.pos.x, tz - vehicle.pos.z);
  const err = wrapAngle(desired - vehicle.heading);
  return { steer: clamp(err * 2.2, -1, 1), err };
}
