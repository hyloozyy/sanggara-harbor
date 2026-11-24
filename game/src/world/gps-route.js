// GPS: a route along the road grid from the player to a waypoint or objective, as world points
// (snap to the nearest road, follow the grid through intersections, finish at the target).
import { GRID, ROAD_HALF } from '../city/city-layout.js';

const nearestIndex = (v) => GRID.reduce((best, g, i) => (Math.abs(g - v) < Math.abs(GRID[best] - v) ? i : best), 0);
const clampGrid = (v) => Math.max(GRID[0], Math.min(GRID[GRID.length - 1], v));

export function roadRoute(fx, fz, tx, tz) {
  // Which road the player stands on: a north-south road (x on a grid line) or east-west.
  const ix = nearestIndex(fx), iz = nearestIndex(fz);
  const onNS = Math.abs(fx - GRID[ix]) < ROAD_HALF + 4, onEW = Math.abs(fz - GRID[iz]) < ROAD_HALF + 4;
  const tix = nearestIndex(tx), tiz = nearestIndex(tz);
  const pts = [];
  // Snap onto the nearest road first.
  let x, z;
  if (onNS || (!onEW && Math.abs(fx - GRID[ix]) < Math.abs(fz - GRID[iz]))) { x = GRID[ix]; z = clampGrid(fz); }
  else { x = clampGrid(fx); z = GRID[iz]; }
  pts.push({ x, z });
  const alongNS = x === GRID[ix] && Math.abs(fx - GRID[ix]) <= Math.abs(fz - GRID[iz]) + 1e-6;
  // Travel along the current road to the target's cross street, then across, then down to it.
  if (alongNS) {
    pts.push({ x, z: GRID[tiz] });
    pts.push({ x: GRID[tix], z: GRID[tiz] });
  } else {
    pts.push({ x: GRID[tix], z });
    pts.push({ x: GRID[tix], z: GRID[tiz] });
  }
  // Last leg along the target's nearest road to the point beside it.
  const last = pts[pts.length - 1];
  if (Math.abs(tx - GRID[tix]) < Math.abs(tz - GRID[tiz])) pts.push({ x: GRID[tix], z: clampGrid(tz) });
  else pts.push({ x: clampGrid(tx), z: GRID[tiz] });
  void last;
  pts.push({ x: tx, z: tz });
  // Drop zero-length legs.
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5);
}

export function routeLength(fx, fz, pts) {
  let d = 0, px = fx, pz = fz;
  for (const p of pts) { d += Math.hypot(p.x - px, p.z - pz); px = p.x; pz = p.z; }
  return d;
}
