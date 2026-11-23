// Firing for everyone: per-shooter arsenals (ammo, magazines, reloads, cooldowns), hitscan bullets
// and shotgun pellets against people, cars and walls, melee punches, and the effects they cause.
import { WEAPONS } from './weapon-catalog.js';
import { raySphere } from '../core/math-utils.js';
import { rng } from '../core/rng.js';
import { events } from '../core/event-bus.js';

export class Arsenal {
  constructor(owned = ['fists'], ammo = {}) {
    this.owned = new Set(owned);
    this.ammo = { pistol: 0, smg: 0, shotgun: 0, ...ammo };     // reserve
    this.mag = { pistol: 0, smg: 0, shotgun: 0 };
    this.current = 'fists';
    this.cooldown = 0;
    this.reloading = 0;
    for (const id of Object.keys(this.mag)) this.refillMag(id);
  }

  get weapon() { return WEAPONS[this.current]; }

  give(id, rounds = 0) {
    this.owned.add(id);
    if (id !== 'fists') { this.ammo[id] = (this.ammo[id] || 0) + rounds; if (this.mag[id] === 0) this.refillMag(id); }
  }

  refillMag(id) {
    const w = WEAPONS[id];
    const need = w.mag - this.mag[id];
    const take = Math.min(need, this.ammo[id] || 0);
    this.mag[id] += take;
    this.ammo[id] -= take;
  }

  select(id) {
    if (this.owned.has(id) && id !== this.current) { this.current = id; this.cooldown = 0.25; this.reloading = 0; return true; }
    return false;
  }

  cycle(step) {
    const order = ['fists', 'pistol', 'smg', 'shotgun'].filter((id) => this.owned.has(id));
    const i = order.indexOf(this.current);
    this.select(order[(i + step + order.length) % order.length]);
  }

  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.refillMag(this.current);
    }
  }

  canFire() {
    const w = this.weapon;
    if (this.cooldown > 0 || this.reloading > 0) return false;
    if (w.melee) return true;
    if (this.mag[w.id] <= 0) { this.startReload(); return false; }
    return true;
  }

  startReload() {
    const w = this.weapon;
    if (w.melee || this.reloading > 0 || this.mag[w.id] >= w.mag || this.ammo[w.id] <= 0) return false;
    this.reloading = w.id === 'shotgun' ? 1.6 : 1.2;
    events.emit('reload', { weapon: w.id });
    return true;
  }

  consume() {
    const w = this.weapon;
    this.cooldown = 1 / w.rate;
    if (!w.melee) this.mag[w.id] -= 1;
  }

  serialize() { return { owned: [...this.owned], ammo: { ...this.ammo }, mag: { ...this.mag }, current: this.current }; }
  restore(d) { this.owned = new Set(d.owned); Object.assign(this.ammo, d.ammo); Object.assign(this.mag, d.mag); this.current = d.current; }
}

export class WeaponSystem {
  constructor(ctx) {
    this.ctx = ctx; // { world, particles, lights, getCharacters(), vehicles }
  }

  // Fire the shooter's current weapon from origin along dir (normalised). Returns the hit list.
  fire(shooter, arsenal, origin, dir, accuracy = 1) {
    if (!arsenal.canFire()) return null;
    const w = arsenal.weapon;
    arsenal.consume();
    if (w.melee) return this.punch(shooter, w);
    const { particles, lights } = this.ctx;
    const mx = origin.x + dir.x * 0.6, my = origin.y + dir.y * 0.6, mz = origin.z + dir.z * 0.6;
    particles.muzzle(mx, my, mz, dir.x, dir.z);
    lights.flash(mx, my, mz, 0xffc070, w.id === 'shotgun' ? 40 : 22, 0.06, 14);
    events.emit('shot-fired', { shooter, weapon: w.id, x: origin.x, z: origin.z });
    const hits = [];
    for (let p = 0; p < w.pellets; p++) {
      const spread = w.spread / Math.max(0.25, accuracy);
      let dx = dir.x + rng.range(-spread, spread), dy = dir.y + rng.range(-spread, spread) * 0.7, dz = dir.z + rng.range(-spread, spread);
      const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
      const hit = this.trace(shooter, origin, dx, dy, dz, w.range);
      const ex = origin.x + dx * hit.t, ey = origin.y + dy * hit.t, ez = origin.z + dz * hit.t;
      if (p < 3 || rng.chance(0.3)) lights.tracer(mx, my, mz, ex, ey, ez);
      if (hit.character) {
        const ch = hit.character;
        const dmg = w.damage * (hit.head ? 2.5 : 1) * (1 - Math.min(0.5, hit.t / w.range * 0.5));
        particles.blood(ex, ey, ez, dx, dz);
        ch.hit(dmg, origin, { knockback: w.id === 'shotgun' ? 2.2 : 0.8, cause: 'bullet', attacker: shooter });
        hits.push(hit);
      } else if (hit.vehicle) {
        particles.sparks(ex, ey, ez, 6, 6, -dx, -dz);
        hit.vehicle.damage(w.damage * 0.9, 'bullet', { x: ex, z: ez });
        events.emit('vehicle-shot', { vehicle: hit.vehicle, shooter });
        hits.push(hit);
      } else if (hit.t < w.range) {
        particles.sparks(ex, ey, ez, 4, 4, -dx, -dz);
        particles.dust(ex, ey, ez, 2);
      }
    }
    return hits;
  }

  trace(shooter, o, dx, dy, dz, range) {
    let best = { t: this.ctx.world.collision.raycast(o.x, o.y, o.z, dx, dy, dz, range) };
    // Ground plane.
    if (dy < -0.001) { const tg = -o.y / dy; if (tg < best.t) best = { t: tg }; }
    for (const ch of this.ctx.getCharacters()) {
      if (ch === shooter || !ch.alive || ch.vehicle) continue;
      if (Math.abs(ch.pos.x - o.x) > range || Math.abs(ch.pos.z - o.z) > range) continue;
      const s = ch.mesh.scale.y;
      const th = raySphere(o.x, o.y, o.z, dx, dy, dz, ch.pos.x, ch.pos.y + 1.68 * s, ch.pos.z, 0.17);
      if (th < best.t) best = { t: th, character: ch, head: true };
      for (const [hy, r] of [[1.28, 0.3], [0.92, 0.27], [0.5, 0.22]]) {
        const tb = raySphere(o.x, o.y, o.z, dx, dy, dz, ch.pos.x, ch.pos.y + hy * s, ch.pos.z, r);
        if (tb < best.t) best = { t: tb, character: ch, head: false };
      }
    }
    for (const v of this.ctx.vehicles.list) {
      if (shooter && shooter.vehicle === v) continue;
      if (Math.abs(v.pos.x - o.x) > range + 5 || Math.abs(v.pos.z - o.z) > range + 5) continue;
      for (const c of v.footprint()) {
        const tv = raySphere(o.x, o.y, o.z, dx, dy, dz, c.x, 0.85, c.z, c.r * 1.05);
        if (tv < best.t) best = { t: tv, vehicle: v };
      }
      // Drivers sitting inside can be shot through the glass.
      if (v.driverCharacter && v.driverCharacter !== shooter) {
        const ch = v.driverCharacter;
        const tc = raySphere(o.x, o.y, o.z, dx, dy, dz, v.pos.x, 1.2, v.pos.z, 0.45);
        if (tc < best.t && Math.random() < 0.5) best = { t: tc, character: ch, head: false };
      }
    }
    return best;
  }

  punch(shooter, w) {
    shooter.punchT = 0;
    const fx = Math.sin(shooter.heading), fz = Math.cos(shooter.heading);
    events.emit('punch', { shooter });
    let target = null, bd = w.range;
    for (const ch of this.ctx.getCharacters()) {
      if (ch === shooter || !ch.alive || ch.vehicle) continue;
      const dx = ch.pos.x - shooter.pos.x, dz = ch.pos.z - shooter.pos.z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.4) { bd = d; target = ch; }
    }
    if (target) {
      const knock = target.health - w.damage <= 0 || rng.chance(0.25) ? 7 : 2.5;
      target.hit(w.damage * rng.range(0.85, 1.2), shooter.pos, { knockback: knock, cause: 'melee', attacker: shooter });
      this.ctx.particles.blood(target.pos.x, target.chestY, target.pos.z, fx, fz);
      events.emit('punch-hit', { shooter, target });
    }
    return target ? [{ character: target }] : [];
  }
}
