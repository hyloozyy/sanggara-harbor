// Polisi Sanggara dispatch: escalating response per wanted level — patrol cars that route through
// the streets and ram, officers who bail out and shoot, the Elang-1 helicopter, roadblocks across
// the player's path and tactical vans at five stars. Also decides whether the player is seen.
import { rng } from '../core/rng.js';
import { Combatant, policeLook } from '../combat/combatant-ai.js';
import { PoliceHelicopter } from './police-helicopter.js';
import { Arsenal } from '../combat/weapon-system.js';
import { N, neighbours, laneLine, chooseNext, steerToward, nearestNode, nodePos } from '../vehicles/road-graph.js';
import { GRID, streetAt } from '../city/city-layout.js';
import { clamp } from '../core/math-utils.js';
import { events } from '../core/event-bus.js';

const PLAN = [
  { cars: 0, vans: 0, heli: false, roadblock: false },
  { cars: 1, vans: 0, heli: false, roadblock: false },
  { cars: 2, vans: 0, heli: false, roadblock: false },
  { cars: 3, vans: 0, heli: true, roadblock: false },
  { cars: 3, vans: 1, heli: true, roadblock: true },
  { cars: 4, vans: 2, heli: true, roadblock: true },
];

let unitNumber = 10;

export class PoliceDispatcher {
  constructor(game) {
    this.game = game;
    this.units = [];        // { kind: 'car'|'van'|'roadblock', vehicle, officers: [], callsign, state }
    this.officers = [];
    this.heli = new PoliceHelicopter(game.scene, 0, 0);
    this.heliActive = false;
    this.setHeliVisible(false);
    this.spawnTimer = 0;
    this.roadblockTimer = 8;
    this.heliGunner = new Arsenal(['fists', 'smg'], { smg: 9999 });
    this.heliGunner.select('smg');
    this.heliFireT = 3;
  }

  // From four stars a marksman leans out of Elang-1 and fires short bursts at Raka.
  heliMarksman(dt, player) {
    this.heliGunner.update(dt);
    if (this.game.wanted.level < 4 || !player.alive) return;
    const h = this.heli;
    this.heliFireT -= dt;
    if (this.heliFireT > 0) return;
    if (this.heliFireT < -0.5) { this.heliFireT = 2.5 + rng.next() * 2; return; }
    if (!this.heliGunner.canFire()) return;
    const o = { x: h.pos.x, y: h.pos.y - 1.5, z: h.pos.z };
    const tx = player.pos.x + rng.range(-2.5, 2.5), ty = player.vehicle ? 1 : player.body.chestY, tz = player.pos.z + rng.range(-2.5, 2.5);
    const dx = tx - o.x, dy = ty - o.y, dz = tz - o.z, l = Math.hypot(dx, dy, dz);
    if (l > 90) return;
    this.game.weapons.fire({ heliShooter: true, vehicle: null, pos: h.pos }, this.heliGunner, o, { x: dx / l, y: dy / l, z: dz / l }, 0.5);
  }

  setHeliVisible(on) {
    const h = this.heli;
    h.root.visible = on; h.beam.visible = on;
    h.spot.intensity = on ? 260 : 0;
  }

  get policeCars() { return this.units.filter((u) => u.vehicle).map((u) => u.vehicle); }

  spawnCar(kind, px, pz, camDir) {
    for (let tries = 0; tries < 30; tries++) {
      const i = rng.int(0, N - 1), j = rng.int(0, N - 1);
      const p = nodePos(i, j);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < 90 || d > 220) continue;
      if (camDir && ((p.x - px) * camDir.x + (p.z - pz) * camDir.z) / d > 0.6 && d < 150) continue;
      const to = chooseNext([i, j], [i, j], rng, { x: px, z: pz });
      const L = laneLine([i, j], to);
      const v = this.game.vehicles.spawn(kind === 'van' ? 'taktis' : 'patroli', L.ax + L.dx * 10, L.az + L.dz * 10, Math.atan2(L.dx, L.dz), { driverLook: policeLook(kind === 'van' ? 'tactical' : 'police') });
      v.sirenOn = true;
      v.ai = { kind: 'police', from: [i, j], to, stuck: 0, reverseT: 0 };
      v.vel.set(L.dx * 12, 0, L.dz * 12);
      const unit = { kind, vehicle: v, officers: [], callsign: `${kind === 'van' ? 'TACTICAL' : 'PATROL'}-${unitNumber++}`, state: 'en route' };
      this.units.push(unit);
      events.emit('police-unit', { unit, action: 'dispatched' });
      return unit;
    }
    return null;
  }

  spawnRoadblock(player) {
    // Pick the intersection ahead of the player's travel direction.
    const v = player.vehicle;
    const dirX = v ? Math.sin(v.heading) : 0, dirZ = v ? Math.cos(v.heading) : 0;
    const ax = player.pos.x + dirX * 110, az = player.pos.z + dirZ * 110;
    const [i, j] = nearestNode(ax, az);
    const p = nodePos(i, j);
    if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 60) return;
    const horizontal = Math.abs(dirZ) > Math.abs(dirX);
    const officers = [];
    const cars = [];
    for (const s of [-1, 1]) {
      const x = p.x + (horizontal ? s * 2.6 : 0), z = p.z + (horizontal ? 0 : s * 2.6);
      const car = this.game.vehicles.spawn('patroli', x, z, horizontal ? Math.PI / 2 + s * 0.2 : s * 0.2);
      car.sirenOn = true;
      car.ai = { kind: 'parked-police' };
      car.controls.handbrake = true;
      cars.push(car);
      const o = this.spawnOfficer(x + (horizontal ? 0 : 0) + rng.range(-1, 1), z + rng.range(-1, 1) + (horizontal ? (dirZ > 0 ? -4 : 4) : 0), 'pistol');
      o.holdPosition = { x: o.body.pos.x, z: o.body.pos.z };
      officers.push(o);
    }
    const unit = { kind: 'roadblock', vehicle: cars[0], extra: cars[1], officers, callsign: `ROADBLOCK ${streetAt(p.x, p.z) || ''}`.trim(), state: 'standing by' };
    this.units.push(unit);
    events.emit('police-unit', { unit, action: 'roadblock' });
  }

  spawnOfficer(x, z, weapon = 'pistol') {
    const o = new Combatant(this.game.scene, policeLook(rng.chance(0.25) ? 'tactical' : 'police'), x, z, {
      faction: 'police', weapon, health: 90, accuracy: 0.28 + this.game.wanted.level * 0.05, armour: weapon === 'smg' ? 50 : 0,
    });
    this.officers.push(o);
    return o;
  }

  update(dt, player, camDir) {
    const wanted = this.game.wanted;
    const plan = PLAN[wanted.level];
    const px = player.pos.x, pz = player.pos.z;

    // Remove destroyed or abandoned units.
    for (const u of [...this.units]) {
      const v = u.vehicle;
      const far = v && Math.hypot(v.pos.x - px, v.pos.z - pz) > 320;
      if ((v && v.wrecked && v.burnTimer > 20) || (wanted.level === 0 && far) || (v && !this.game.vehicles.list.includes(v))) {
        if (v && this.game.vehicles.list.includes(v) && far) this.game.vehicles.remove(v);
        if (u.extra && far) this.game.vehicles.remove(u.extra);
        this.units.splice(this.units.indexOf(u), 1);
      }
    }
    for (const o of [...this.officers]) {
      const d = Math.hypot(o.body.pos.x - px, o.body.pos.z - pz);
      if ((!o.alive && o.body.deadTime > 30) || (wanted.level === 0 && d > 90)) {
        this.game.scene.remove(o.body.mesh); o.body.dispose();
        this.officers.splice(this.officers.indexOf(o), 1);
      }
    }

    // Top up the response.
    this.spawnTimer -= dt;
    const active = (k) => this.units.filter((u) => u.kind === k && u.vehicle && !u.vehicle.wrecked).length;
    if (this.spawnTimer <= 0 && wanted.level > 0) {
      this.spawnTimer = 2.5;
      if (active('car') < plan.cars) this.spawnCar('car', px, pz, camDir);
      else if (active('van') < plan.vans) this.spawnCar('van', px, pz, camDir);
    }
    if (plan.roadblock && player.vehicle) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0 && this.units.filter((u) => u.kind === 'roadblock').length < 2) { this.spawnRoadblock(player); this.roadblockTimer = 25; }
    }
    if (plan.heli && !this.heliActive) {
      this.heliActive = true;
      this.heli.pos.set(px + 150, 70, pz - 150);
      this.setHeliVisible(true);
      events.emit('police-unit', { unit: { callsign: 'ELANG-1 HELI', kind: 'heli' }, action: 'dispatched' });
    } else if (!plan.heli && this.heliActive) {
      this.heliActive = false;
      this.setHeliVisible(false);
    }

    // Drive units and see if anyone has eyes on the player.
    let spotted = false;
    for (const u of this.units) {
      const v = u.vehicle;
      if (!v || v.wrecked) { u.state = 'wrecked'; continue; }
      if (u.kind === 'roadblock') { if (this.sees(v.pos.x, 1.5, v.pos.z, player, 70)) spotted = true; continue; }
      const sees = this.sees(v.pos.x, 1.5, v.pos.z, player, 85);
      if (sees) spotted = true;
      this.drivePursuit(u, dt, player, sees || wanted.unseen < 2);
    }
    for (const o of this.officers) {
      const target = wanted.level > 0 && player.alive ? player.body : null;
      o.hostile = !!target;
      o.update(dt, this.game, target ? { pos: target.pos, chestY: target.chestY, vehicle: player.vehicle, body: target } : null);
      if (o.alive && wanted.level > 0 && this.sees(o.body.pos.x, o.body.headY, o.body.pos.z, player, 60)) spotted = true;
    }
    if (this.heliActive) {
      const sc = wanted.lastKnown;
      const heliSees = wanted.unseen < 1.5 || this.heli.illuminates(px, pz);
      this.heli.update(dt, { x: px, z: pz }, sc, heliSees);
      if (heliSees) this.heliMarksman(dt, player);
      if (this.heli.illuminates(px, pz) && Math.hypot(this.heli.pos.x - px, this.heli.pos.z - pz) < 120) spotted = true;
    }
    wanted.update(dt, spotted, px, pz);
    this.spotted = spotted;

    if (wanted.level === 0) for (const u of this.units) if (u.vehicle) { u.vehicle.sirenOn = false; u.state = 'returning'; }
  }

  sees(x, y, z, player, range) {
    const d = Math.hypot(player.pos.x - x, player.pos.z - z);
    if (d > range) return false;
    return this.game.world.collision.lineOfSight(x, y, z, player.pos.x, 1.4, player.pos.z);
  }

  drivePursuit(u, dt, player, tracking) {
    const v = u.vehicle, ai = v.ai;
    const px = player.pos.x, pz = player.pos.z;
    const d = Math.hypot(px - v.pos.x, pz - v.pos.z);
    const wanted = this.game.wanted;
    let tx, tz, want;
    if (wanted.level === 0) {
      // Return to patrol: just drive on.
      tx = v.pos.x + Math.sin(v.heading) * 20; tz = v.pos.z + Math.cos(v.heading) * 20; want = 10;
    } else if (d < 55 && tracking) {
      // Direct pursuit, leading the target.
      const pv = player.vehicle ? player.vehicle.vel : { x: 0, z: 0 };
      tx = px + pv.x * 0.6; tz = pz + pv.z * 0.6;
      want = player.vehicle ? clamp(Math.abs(player.vehicle.speed) + 8, 12, v.spec.maxSpeed) : clamp((d - 11) * 0.7, 0, 14);
      u.state = player.vehicle ? 'pursuing' : 'closing in';
      // On foot nearby: stop and send officers out.
      if (!player.vehicle && d < 24 && !u.officers.length && Math.abs(v.speed) < 6) {
        const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
        for (const s of [-1, 1]) u.officers.push(this.spawnOfficer(v.pos.x + rx * s * 2, v.pos.z + rz * s * 2, u.kind === 'van' ? 'smg' : 'pistol'));
        this.game.vehicles.removeDriverModel(v);
        u.state = 'on foot';
      }
      if (u.officers.length) want = 0;
    } else {
      // Route through the grid toward the last known position.
      const goal = tracking ? { x: px, z: pz } : wanted.lastKnown;
      let L = laneLine(ai.from, ai.to);
      const node = nodePos(ai.to[0], ai.to[1]);
      if (Math.hypot(node.x - v.pos.x, node.z - v.pos.z) < 9) {
        const next = chooseNext(ai.from, ai.to, rng, goal);
        ai.from = ai.to; ai.to = next; L = laneLine(ai.from, ai.to);
      }
      const along = (v.pos.x - L.ax) * L.dx + (v.pos.z - L.az) * L.dz;
      const lateral = Math.abs((v.pos.x - L.ax) * L.dz - (v.pos.z - L.az) * L.dx);
      if (lateral > 12) { const n = nearestNode(v.pos.x, v.pos.z); const nb = neighbours(n[0], n[1]); ai.from = n; ai.to = nb[0]; }
      const look = Math.max(0, along) + 10;
      tx = L.ax + L.dx * look; tz = L.az + L.dz * look;
      want = tracking ? 30 : 20;
      u.state = tracking ? 'pursuing' : 'searching';
      void GRID;
    }
    const { steer, err } = steerToward(v, tx, tz);
    want *= 1 - Math.min(0.55, Math.abs(err) * 0.5);
    // Stuck against something: reverse out.
    if (Math.abs(v.speed) < 1 && want > 3) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt);
    if (ai.stuck > 1.6) { ai.reverseT = 1.4; ai.stuck = 0; }
    if (ai.reverseT > 0) {
      ai.reverseT -= dt;
      v.controls.throttle = -1; v.controls.steer = -steer; v.controls.handbrake = false;
      return;
    }
    const dv = want - v.speed;
    v.controls.throttle = clamp(dv / 3, -1, 1);
    v.controls.steer = steer;
    v.controls.handbrake = Math.abs(err) > 1.3 && v.speed > 14;
  }

  // Units the HUD lists (callsign, state, distance).
  hudList(player) {
    const list = this.units.map((u) => ({
      callsign: u.callsign, kind: u.kind,
      state: u.vehicle && u.vehicle.wrecked ? 'wrecked' : u.state,
      dist: u.vehicle ? Math.round(Math.hypot(u.vehicle.pos.x - player.pos.x, u.vehicle.pos.z - player.pos.z)) : 0,
    }));
    if (this.heliActive) list.unshift({ callsign: 'ELANG-1 HELI', kind: 'heli', state: this.game.wanted.unseen < 2 ? 'searchlight' : 'sweeping', dist: Math.round(Math.hypot(this.heli.pos.x - player.pos.x, this.heli.pos.z - player.pos.z)) });
    const onFoot = this.officers.filter((o) => o.alive).length;
    if (onFoot) list.push({ callsign: `OFFICERS ×${onFoot}`, kind: 'foot', state: 'firing', dist: 0 });
    return list;
  }

  clearAll() {
    for (const u of this.units) { if (u.vehicle) this.game.vehicles.remove(u.vehicle); if (u.extra) this.game.vehicles.remove(u.extra); }
    for (const o of this.officers) { this.game.scene.remove(o.body.mesh); o.body.dispose(); }
    this.units = []; this.officers = [];
    this.heliActive = false; this.setHeliVisible(false);
  }
}
