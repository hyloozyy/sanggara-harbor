// Townspeople: walk loops around the sidewalks, cross at the zebra crossings, stop to chat or
// phone, scatter and flee from gunfire and reckless drivers, call the police, drop cash when hit.
import { Character } from './character.js';
import { randomLook } from './humanoid-model.js';
import { rng } from '../core/rng.js';
import { BLOCKS, ROAD_HALF, SIDEWALK } from '../city/city-layout.js';
import { events } from '../core/event-bus.js';

const WALK = 1.35, RUN = 5.2;
const INSET = ROAD_HALF + SIDEWALK * 0.5;

// Point on a block's sidewalk ring at perimeter distance s.
function ringPoint(block, s) {
  const x0 = block.slab.minX + SIDEWALK * 0.5 - 0.2, x1 = block.slab.maxX - SIDEWALK * 0.5 + 0.2;
  const z0 = block.slab.minZ + SIDEWALK * 0.5 - 0.2, z1 = block.slab.maxZ - SIDEWALK * 0.5 + 0.2;
  const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
  s = ((s % per) + per) % per;
  if (s < w) return { x: x0 + s, z: z0, per };
  if (s < w + d) return { x: x1, z: z0 + (s - w), per };
  if (s < 2 * w + d) return { x: x1 - (s - w - d), z: z1, per };
  return { x: x0, z: z1 - (s - 2 * w - d), per };
}

export class PedestrianSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.target = 34;
    void INSET;
  }

  spawn(px, pz, minD = 25, maxD = 120) {
    const near = BLOCKS.filter((b) => { const d = Math.hypot(b.cx - px, b.cz - pz); return d > minD - 40 && d < maxD + 40; });
    if (!near.length) return null;
    const block = rng.pick(near);
    const s = rng.range(0, 260);
    const p = ringPoint(block, s);
    const d = Math.hypot(p.x - px, p.z - pz);
    if (d < minD || d > maxD) return null;
    const ped = new Character(randomLook(rng), p.x, p.z, { health: 60 });
    ped.ai = { block, s, dir: rng.chance(0.5) ? 1 : -1, mode: 'walk', timer: rng.range(4, 20), fleeFrom: null, crossing: null, called: false };
    ped.anim = 'auto';
    if (rng.chance(0.12)) { ped.ai.mode = 'idle'; ped.anim = rng.chance(0.5) ? 'phone' : 'idle'; }
    this.scene.add(ped.mesh);
    this.list.push(ped);
    return ped;
  }

  // A pedestrian that was not spawned by the system (e.g. a dragged-out driver) joins it.
  adopt(ch, fleeFrom) {
    const block = BLOCKS.reduce((a, b) => (Math.hypot(b.cx - ch.pos.x, b.cz - ch.pos.z) < Math.hypot(a.cx - ch.pos.x, a.cz - ch.pos.z) ? b : a));
    ch.ai = { block, s: 0, dir: 1, mode: 'flee', timer: 8, fleeFrom, crossing: null, called: false };
    ch.anim = 'auto';
    this.scene.add(ch.mesh);
    this.list.push(ch);
  }

  remove(p) {
    this.scene.remove(p.mesh);
    this.list.splice(this.list.indexOf(p), 1);
  }

  populate(px, pz, n) { for (let k = 0; k < n * 5 && this.list.length < n; k++) this.spawn(px, pz, 8, 110); }

  // Anyone within `radius` of (x, z) panics.
  scare(x, z, radius, severity = 1, byPlayer = false) {
    for (const p of this.list) {
      if (!p.alive || !p.ai) continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < radius) {
        p.ai.mode = severity > 1 && d < 10 && rng.chance(0.35) ? 'cower' : 'flee';
        p.ai.fleeFrom = { x, z };
        p.ai.timer = rng.range(6, 12);
        if (byPlayer && !p.ai.called && severity > 0 && rng.chance(0.3)) {
          p.ai.called = true;
          events.emit('witness-report', { x: p.pos.x, z: p.pos.z, severity });
        }
      }
    }
  }

  update(dt, player, vehicles) {
    const px = player.pos.x, pz = player.pos.z;
    for (const p of [...this.list]) {
      const d = Math.hypot(p.pos.x - px, p.pos.z - pz);
      if (d > 150 || (!p.alive && p.deadTime > 25)) { this.remove(p); continue; }
      p.mesh.visible = d < 95; // distant townspeople are too small to be worth drawing
    }
    if (this.list.length < this.target) this.spawn(px, pz, 45, 120);

    for (const p of this.list) {
      if (!p.alive) { p.updateVisual(dt); continue; }
      const ai = p.ai;
      let wx = 0, wz = 0;
      ai.timer -= dt;
      if (ai.mode === 'walk') {
        const t = ringPoint(ai.block, ai.s + ai.dir * 1.5);
        const dx = t.x - p.pos.x, dz = t.z - p.pos.z, dd = Math.hypot(dx, dz) || 1;
        if (dd < 3) ai.s += ai.dir * WALK * dt;
        wx = dx / dd * WALK; wz = dz / dd * WALK;
        if (ai.timer <= 0) { ai.timer = rng.range(8, 25); if (rng.chance(0.2)) { ai.mode = 'idle'; ai.timer = rng.range(3, 8); p.anim = rng.chance(0.4) ? 'phone' : 'idle'; } }
      } else if (ai.mode === 'idle') {
        if (ai.timer <= 0) { ai.mode = 'walk'; p.anim = 'auto'; ai.timer = rng.range(8, 20); }
      } else if (ai.mode === 'flee' && ai.fleeFrom) {
        const dx = p.pos.x - ai.fleeFrom.x, dz = p.pos.z - ai.fleeFrom.z, dd = Math.hypot(dx, dz) || 1;
        wx = dx / dd * RUN; wz = dz / dd * RUN;
        p.anim = 'auto';
        if (ai.timer <= 0) this.calmDown(p);
      } else if (ai.mode === 'cower') {
        p.anim = 'cower';
        if (ai.timer <= 0) { ai.mode = 'flee'; ai.timer = 6; }
      }
      // Dodge cars that are about to hit them.
      for (const v of vehicles.list) {
        const sp = Math.hypot(v.vel.x, v.vel.z);
        const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z, dd = Math.hypot(dx, dz);
        if (dd < v.radius + 0.6 && sp > 3) {
          const dmg = sp * sp * 0.5;
          p.hit(dmg, { x: v.pos.x, z: v.pos.z }, { knockback: Math.min(14, sp * 0.8), cause: 'vehicle', attacker: v.driver === 'player' ? player : null });
          this.scare(p.pos.x, p.pos.z, 25, 1, v.driver === 'player');
        } else if (dd < 9 && sp > 6 && ai.mode !== 'flee') {
          const fwd = (dx * v.vel.x + dz * v.vel.z) / (sp * dd);
          if (fwd > 0.8) { ai.mode = 'flee'; ai.fleeFrom = { x: v.pos.x - v.vel.x, z: v.pos.z - v.vel.z }; ai.timer = 3; }
        }
      }
      p.move(dt, this.world, wx, wz);
      p.updateVisual(dt);
    }
  }

  calmDown(p) {
    const ai = p.ai;
    let best = null, bd = Infinity;
    for (const b of BLOCKS) { const d = Math.hypot(b.cx - p.pos.x, b.cz - p.pos.z); if (d < bd) { bd = d; best = b; } }
    ai.block = best;
    // Find perimeter position nearest to us.
    let bs = 0, bdist = Infinity;
    for (let s = 0; s < 280; s += 4) { const r = ringPoint(best, s); const d = Math.hypot(r.x - p.pos.x, r.z - p.pos.z); if (d < bdist) { bdist = d; bs = s; } }
    ai.s = bs; ai.mode = 'walk'; ai.fleeFrom = null; ai.timer = rng.range(8, 20); p.anim = 'auto';
  }
}
