// Static collision: axis-aligned boxes for buildings and props in a spatial hash, plus the
// coastline walls. Circles (people, car corners) are pushed out; rays stop on walls.
import { rayBox } from '../core/math-utils.js';

const CELL = 20;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.cells = new Map();
    this.bounded = true;     // the city's sea walls; interiors switch them off
  }

  key(cx, cz) { return cx * 73856093 ^ cz * 19349663; }

  addBox(minX, minZ, maxX, maxZ, height = 50, tag = 'building') {
    const box = { minX, minZ, maxX, maxZ, height, tag };
    this.boxes.push(box);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const k = this.key(cx, cz);
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(box);
      }
    }
    return box;
  }

  addCenteredBox(x, z, w, d, height, tag) {
    return this.addBox(x - w / 2, z - d / 2, x + w / 2, z + d / 2, height, tag);
  }

  query(x, z, r, out = []) {
    out.length = 0;
    const seen = new Set();
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const b of list) if (!seen.has(b)) { seen.add(b); out.push(b); }
      }
    }
    return out;
  }

  // Push a circle out of every box it overlaps. Returns the push normal of the deepest contact or null.
  resolveCircle(pos, r, y = 0) {
    let contact = null;
    for (const b of this.query(pos.x, pos.z, r)) {
      if (y > b.height) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz, depth;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        nx = dx / d; nz = dz / d; depth = r - d;
      } else {
        // Centre inside the box: leave along the shortest axis.
        const opts = [[pos.x - b.minX, -1, 0], [b.maxX - pos.x, 1, 0], [pos.z - b.minZ, 0, -1], [b.maxZ - pos.z, 0, 1]];
        opts.sort((a, c) => a[0] - c[0]);
        nx = opts[0][1]; nz = opts[0][2]; depth = opts[0][0] + r;
      }
      pos.x += nx * depth; pos.z += nz * depth;
      if (!contact || depth > contact.depth) contact = { nx, nz, depth, box: b };
    }
    // Sea walls and the hills at the map edge.
    const lim = this.bounded ? [[pos.x - (-372), 1, 0], [372 - pos.x, -1, 0], [pos.z - (-372), 0, 1], [372 - pos.z, 0, -1]] : [];
    for (const [gap, nx, nz] of lim) {
      if (gap < r) {
        const depth = r - gap;
        pos.x += nx * depth; pos.z += nz * depth;
        if (!contact || depth > contact.depth) contact = { nx, nz, depth, box: null };
      }
    }
    return contact;
  }

  // Nearest hit distance along a ray, or Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxDist = 300) {
    let best = maxDist;
    const steps = Math.ceil(maxDist / CELL) + 1;
    const visited = new Set();
    for (let s = 0; s <= steps; s++) {
      const px = ox + dx * s * CELL, pz = oz + dz * s * CELL;
      if (s * CELL > best + CELL) break;
      for (const b of this.query(px, pz, CELL)) {
        if (visited.has(b)) continue;
        visited.add(b);
        const t = rayBox(ox, oy, oz, dx, dy, dz, b.minX, -1, b.minZ, b.maxX, b.height, b.maxZ);
        if (t < best) best = t;
      }
    }
    return best;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.01) return true;
    return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len) >= len - 0.5;
  }
}
