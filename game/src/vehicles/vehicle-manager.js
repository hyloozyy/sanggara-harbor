// Owns every vehicle in the world: spawning with seated drivers, physics stepping, car-to-car
// collisions with impulses and damage, and queries such as "nearest car to steal".
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { VEHICLE_MODELS } from './vehicle-catalog.js';
import { HumanoidModel } from '../characters/humanoid-model.js';
import { animateHumanoid } from '../characters/humanoid-animator.js';
import { events } from '../core/event-bus.js';

// Handles, pegs, the steering wheel and the ground in the seated person's model space.
export function driverRig(v, model) {
  const sc = model.root.scale.y || 1, seat = v.seat;
  const R = model.rigCache || (model.rigCache = { grips: [[0, 0, 0], [0, 0, 0]], pegs: [[0, 0, 0], [0, 0, 0]], stand: [0, 0, 0], ground: 0, hipY: 0, wheel: null, wheelTurn: 0, stepThrough: false });
  const toM = (x, y, z, out) => { out[0] = (x - seat.x) / sc; out[1] = (y - seat.y) / sc; out[2] = (z - seat.z) / sc; return out; };
  R.ground = -seat.y / sc;
  const seatTop = v.seatTop ?? (v.rig?.seatTop ?? seat.y + 0.1);
  R.hipY = v.rig ? (seatTop + 0.13 - seat.y) / sc : 0.04 / sc; // car seats are deep: the hips sink into the cushion
  const side = v.spec.twoWheel ? 0.62 : v.spec.width / 2 + 0.42;
  toM(-side, 0, seat.z + (v.spec.twoWheel ? 0.05 : 0.1), R.stand); R.stand[1] = 0;
  if (v.rig) {
    const a = v.steer * 1.4, c = Math.cos(a), s = Math.sin(a), P = v.rig.pivot;
    for (let i = 0; i < 2; i++) {
      const g = v.rig.grips[i], dx = g[0] - P[0], dz = g[2] - P[2];
      toM(P[0] + dx * c + dz * s, g[1], P[2] - dx * s + dz * c, R.grips[i]);
      const p = v.rig.pegs[i]; toM(p[0], p[1], p[2], R.pegs[i]);
    }
    R.stepThrough = !!v.rig.stepThrough; R.seated = !!v.rig.seated;
  }
  if (v.steering) {
    const st = v.steering, t = st.tilt;
    R.wheel = R.wheel || { c: [0, 0, 0], x: [1, 0, 0], u: [0, 1, 0], r: 0.18 };
    toM(st.center.x, st.center.y, st.center.z, R.wheel.c);
    R.wheel.u[0] = 0; R.wheel.u[1] = Math.cos(t); R.wheel.u[2] = Math.sin(t);
    R.wheel.r = st.r / sc;
    R.wheelTurn = v.steer * 1.4 * 2.2;
  }
  return R;
}

// Where someone getting out stands, in world space.
export function standSpot(v) {
  const side = v.spec.twoWheel ? 0.62 : v.spec.width / 2 + 0.42;
  const fz = v.seat.z + (v.spec.twoWheel ? 0.05 : 0.1);
  const c = Math.cos(v.heading), s = Math.sin(v.heading);
  return { x: v.pos.x + (-side) * c + fz * s, z: v.pos.z - (-side) * s + fz * c, heading: v.heading };
}

export function animateDriver(v, model, dt) {
  const rig = driverRig(v, model);
  const ride = v.spec.twoWheel || !!v.rig;
  animateHumanoid(model, ride ? 'ride' : 'drive', 0, dt, { steer: v.controls.steer, rig, mount: v.mount ?? 1, vSpeed: v.speed, lookYaw: v.lookYaw || 0 });
}

export class VehicleManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.list = [];
  }

  spawn(modelKey, x, z, heading, { color, driverLook = null } = {}) {
    const spec = VEHICLE_MODELS[modelKey];
    const v = new Vehicle(spec, modelKey, color ?? spec.colors[Math.floor(Math.random() * spec.colors.length)], x, z, heading);
    this.scene.add(v.mesh);
    this.list.push(v);
    if (driverLook) this.seatDriver(v, driverLook);
    return v;
  }

  // Seat a person in the vehicle. animateIn: they climb on / get in from the left-hand door
  // side (mount 0 → 1) instead of appearing seated.
  seatDriver(v, look, { animateIn = false } = {}) {
    if (v.driverModel) this.removeDriverModel(v);
    const model = new HumanoidModel(look);
    model.setShadows(!!animateIn);
    model.root.position.copy(v.seat);
    v.body.add(model.root);
    v.mount = animateIn ? 0 : 1; v.mountDir = 1; v.onDismounted = null;
    animateDriver(v, model, 1);
    v.driverModel = model;
    return model;
  }

  // Climb off / get out (mount 1 → 0), then call done() with the standing spot in world space.
  dismount(v, done) {
    if (!v.driverModel) { done?.(standSpot(v)); return; }
    v.mountDir = -1; v.onDismounted = done;
  }

  removeDriverModel(v) {
    const cb = v.onDismounted;
    if (v.driverModel) { v.body.remove(v.driverModel.root); v.driverModel.dispose(); v.driverModel = null; }
    v.mountDir = 1; v.onDismounted = null;
    cb?.(standSpot(v)); // a dismount cut short still puts the person on their feet
  }

  remove(v) {
    this.removeDriverModel(v);
    this.scene.remove(v.mesh);
    v.dispose?.();
    const i = this.list.indexOf(v);
    if (i >= 0) this.list.splice(i, 1);
    events.emit('vehicle-removed', v);
  }

  nearest(x, z, maxDist, filter = () => true) {
    let best = null, bd = maxDist * maxDist;
    for (const v of this.list) {
      if (!filter(v)) continue;
      const d = (v.pos.x - x) ** 2 + (v.pos.z - z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  // Keep a person out of car bodies; returns the speed of the fastest car that hit them.
  pushOut(ch) {
    let hitSpeed = 0, hitBy = null;
    for (const v of this.list) {
      if (ch.vehicle === v) continue;
      const dx0 = ch.pos.x - v.pos.x, dz0 = ch.pos.z - v.pos.z;
      if (dx0 * dx0 + dz0 * dz0 > (v.radius + 1) ** 2) continue;
      for (const c of v.footprint()) {
        const dx = ch.pos.x - c.x, dz = ch.pos.z - c.z, rr = c.r + ch.radius * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        ch.pos.x += dx / d * (rr - d); ch.pos.z += dz / d * (rr - d);
        const sp = Math.hypot(v.vel.x, v.vel.z);
        if (sp > hitSpeed) { hitSpeed = sp; hitBy = v; }
      }
    }
    return { hitSpeed, hitBy };
  }

  update(dt) {
    for (const v of this.list) {
      v.update(dt, this.world);
      if (v.driverModel) {
        const dur = v.spec.twoWheel ? 0.95 : 1.1;
        if (v.mountDir < 0) {
          v.mount = Math.max(0, (v.mount ?? 1) - dt / dur);
          if (v.mount <= 0) { this.removeDriverModel(v); continue; }
        } else if (v.mount < 1) v.mount = Math.min(1, v.mount + dt / dur);
        animateDriver(v, v.driverModel, dt);
      }
    }
    this.collidePairs();
  }

  collidePairs() {
    const L = this.list;
    for (let a = 0; a < L.length; a++) {
      const A = L[a];
      for (let b = a + 1; b < L.length; b++) {
        const B = L[b];
        const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z;
        const reach = A.radius + B.radius;
        if (dx * dx + dz * dz > reach * reach) continue;
        // Fine test between footprint circles.
        let best = null;
        for (const ca of A.footprint()) for (const cb of B.footprint()) {
          const ex = cb.x - ca.x, ez = cb.z - ca.z, rr = ca.r + cb.r;
          const d2 = ex * ex + ez * ez;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 0.001;
            const depth = rr - d;
            if (!best || depth > best.depth) best = { nx: ex / d, nz: ez / d, depth };
          }
        }
        if (!best) continue;
        const ma = A.spec.mass, mb = B.spec.mass, tot = ma + mb;
        A.pos.x -= best.nx * best.depth * (mb / tot); A.pos.z -= best.nz * best.depth * (mb / tot);
        B.pos.x += best.nx * best.depth * (ma / tot); B.pos.z += best.nz * best.depth * (ma / tot);
        const rvx = B.vel.x - A.vel.x, rvz = B.vel.z - A.vel.z;
        const vn = rvx * best.nx + rvz * best.nz;
        if (vn >= 0) continue;
        const j = -(1 + 0.35) * vn / (1 / ma + 1 / mb);
        A.vel.x -= (j / ma) * best.nx; A.vel.z -= (j / ma) * best.nz;
        B.vel.x += (j / mb) * best.nx; B.vel.z += (j / mb) * best.nz;
        A.angVel += (Math.random() - 0.5) * Math.min(2, -vn * 0.15);
        B.angVel += (Math.random() - 0.5) * Math.min(2, -vn * 0.15);
        const impact = -vn;
        if (impact > 4) {
          const dmg = impact * impact * 0.45;
          A.damage(dmg * (mb / tot) * 2, 'crash', { x: A.pos.x + best.nx * A.radius * 0.5, z: A.pos.z + best.nz * A.radius * 0.5, impact });
          B.damage(dmg * (ma / tot) * 2, 'crash', { x: B.pos.x - best.nx * B.radius * 0.5, z: B.pos.z - best.nz * B.radius * 0.5, impact });
          events.emit('vehicle-collision', { a: A, b: B, impact, x: (A.pos.x + B.pos.x) / 2, z: (A.pos.z + B.pos.z) / 2 });
        }
      }
    }
  }
}

export const tmpVec = new THREE.Vector3();
