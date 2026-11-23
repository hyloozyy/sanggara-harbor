// Civilian traffic: cars, angkots and scooters that follow left-hand lanes, stop at red lights,
// keep distance from what is ahead, panic when shot at, and are recycled around the player.
import { rng } from '../core/rng.js';
import { TRAFFIC_MIX } from './vehicle-catalog.js';
import { N, neighbours, laneLine, chooseNext, steerToward, edgeFromPose } from './road-graph.js';
import { GRID } from '../city/city-layout.js';
import { randomLook } from '../characters/humanoid-model.js';
import { clamp } from '../core/math-utils.js';

const CRUISE = 12.5;

export class TrafficSystem {
  constructor(vehicles, signals) {
    this.vehicles = vehicles;
    this.signals = signals;
    this.target = 22;
    this.spawnTimer = 0;
  }

  // Put a civilian car on a lane edge, `t` of the way along it.
  spawnOnEdge(from, to, t = 0.5, modelKey = null) {
    const L = laneLine(from, to);
    const x = L.ax + (L.bx - L.ax) * t, z = L.az + (L.bz - L.az) * t;
    const key = modelKey || rng.pick(TRAFFIC_MIX);
    const v = this.vehicles.spawn(key, x, z, Math.atan2(L.dx, L.dz), { driverLook: randomLook(rng) });
    v.ai = { kind: 'traffic', from, to, panic: 0, cruise: CRUISE * rng.range(0.85, 1.12), honk: 0 };
    v.vel.set(L.dx * 8, 0, L.dz * 8);
    return v;
  }

  populate(px, pz, count) {
    for (let k = 0; k < count * 4 && this.count() < count; k++) this.trySpawn(px, pz, 30, 230);
  }

  count() { return this.vehicles.list.filter((v) => v.ai && v.ai.kind === 'traffic').length; }

  trySpawn(px, pz, minD, maxD, camDir = null) {
    const i = rng.int(0, N - 1), j = rng.int(0, N - 1);
    const nbs = neighbours(i, j);
    const to = rng.pick(nbs);
    const t = rng.range(0.25, 0.7);
    const L = laneLine([i, j], to);
    const x = L.ax + (L.bx - L.ax) * t, z = L.az + (L.bz - L.az) * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < minD || d > maxD) return null;
    if (camDir && d < 120 && ((x - px) * camDir.x + (z - pz) * camDir.z) / d > 0.5) return null; // not in plain view
    if (this.vehicles.nearest(x, z, 12)) return null;
    return this.spawnOnEdge([i, j], to, t);
  }

  update(dt, player, camDir) {
    this.signals.update(dt);
    const px = player.pos.x, pz = player.pos.z;
    // Recycle far traffic and top up near the player.
    for (const v of [...this.vehicles.list]) {
      if (!v.ai || v.ai.kind !== 'traffic' || v.driver === 'player') continue;
      const d = Math.hypot(v.pos.x - px, v.pos.z - pz);
      if (d > 280 || (v.wrecked && d > 120)) this.vehicles.remove(v);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.count() < this.target) { this.spawnTimer = 0.4; this.trySpawn(px, pz, 70, 220, camDir); }

    for (const v of this.vehicles.list) {
      if (!v.ai || v.ai.kind !== 'traffic' || v.driver === 'player' || v.wrecked) continue;
      if (!v.driverModel) { v.controls.throttle = 0; v.controls.handbrake = v.speed > 1; v.controls.steer = 0; continue; }
      this.drive(v, dt, player);
    }
  }

  drive(v, dt, player) {
    const ai = v.ai;
    let L = laneLine(ai.from, ai.to);
    const toNode = { x: GRID[ai.to[0]], z: GRID[ai.to[1]] };
    const distNode = Math.hypot(toNode.x - v.pos.x, toNode.z - v.pos.z);
    // Arrived at the intersection: pick where to go next.
    if (distNode < 7.5) {
      const next = chooseNext(ai.from, ai.to, rng);
      ai.from = ai.to; ai.to = next;
      L = laneLine(ai.from, ai.to);
    }
    // Lost (pushed off course)? Re-acquire the nearest plausible lane.
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const along = (v.pos.x - L.ax) * L.dx + (v.pos.z - L.az) * L.dz;
    const lateral = Math.abs((v.pos.x - L.ax) * L.dz - (v.pos.z - L.az) * L.dx);
    if (lateral > 9) { const e = edgeFromPose(v.pos.x, v.pos.z, v.heading); ai.from = e.from; ai.to = e.to; L = laneLine(ai.from, ai.to); }
    const look = clamp(along + 6 + Math.abs(v.speed) * 0.5, 0, 80);
    const tx = L.ax + L.dx * look, tz = L.az + L.dz * look;
    const { steer, err } = steerToward(v, tx, tz);

    let want = ai.cruise * (1 - Math.min(0.6, Math.abs(err)));
    if (ai.panic > 0) { ai.panic -= dt; want = 22; }

    // Red light: stop before the crossing.
    const stopDist = distNode - 9.5;
    if (!this.signals.isGreen(L.axis) && stopDist > -1.5 && stopDist < 22 && ai.panic <= 0) want = Math.min(want, Math.max(0, stopDist * 0.7));

    // Something ahead (cars, the player, pedestrians on the road)?
    let blocked = Infinity;
    for (const o of this.vehicles.list) {
      if (o === v) continue;
      const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
      const fwd = dx * fx + dz * fz;
      if (fwd <= 0 || fwd > 18) continue;
      const side = Math.abs(dx * fz - dz * fx);
      if (side < 2.4) blocked = Math.min(blocked, fwd - (o.radius + v.radius) * 0.9);
    }
    if (!player.vehicle) {
      const dx = player.pos.x - v.pos.x, dz = player.pos.z - v.pos.z;
      const fwd = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (fwd > 0 && fwd < 12 && side < 1.8) { blocked = Math.min(blocked, fwd - v.radius - 1); ai.honk = 1; }
    }
    if (blocked < Infinity && ai.panic <= 0) want = Math.min(want, Math.max(0, (blocked - 2) * 0.9));

    const dv = want - v.speed;
    v.controls.throttle = dv > 0.3 ? clamp(dv / 4, 0.25, 1) : dv < -0.5 ? clamp(dv / 3, -1, -0.2) : 0;
    if (want < 0.3 && v.speed < 0.6) v.controls.throttle = 0;
    v.controls.steer = steer;
    v.controls.handbrake = false;
  }

  panicAround(x, z, radius) {
    for (const v of this.vehicles.list) {
      if (v.ai && v.ai.kind === 'traffic' && Math.hypot(v.pos.x - x, v.pos.z - z) < radius) v.ai.panic = 8;
    }
  }
}
