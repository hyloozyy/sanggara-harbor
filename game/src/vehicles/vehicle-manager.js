// Owns every vehicle in the world: spawning with seated drivers, physics stepping, car-to-car
// collisions with impulses and damage, and queries such as "nearest car to steal".
import * as THREE from 'three';
import { Vehicle } from './vehicle.js';
import { VEHICLE_MODELS } from './vehicle-catalog.js';
import { HumanoidModel } from '../characters/humanoid-model.js';
import { animateHumanoid } from '../characters/humanoid-animator.js';
import { events } from '../core/event-bus.js';

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

  seatDriver(v, look) {
    const model = new HumanoidModel(look);
    model.setShadows(false);
    model.root.position.copy(v.seat);
    v.body.add(model.root);
    animateHumanoid(model, v.spec.twoWheel ? 'ride' : 'drive', 0, 1);
    v.driverModel = model;
    return model;
  }

  removeDriverModel(v) {
    if (v.driverModel) { v.body.remove(v.driverModel.root); v.driverModel = null; }
  }

  remove(v) {
    this.scene.remove(v.mesh);
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

  update(dt) {
    for (const v of this.list) {
      v.update(dt, this.world);
      if (v.driverModel) animateHumanoid(v.driverModel, v.spec.twoWheel ? 'ride' : 'drive', 0, dt, { steer: v.controls.steer });
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
