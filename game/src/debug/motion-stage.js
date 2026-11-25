// A scripted stage of people in motion, shared by the motion lab (debug/motion.html) and the
// game's ?shot=motion scene: a walker who stops and turns on the spot, a jogger and a sprinter
// on a loop, two townspeople who shake hands and chat, a gunman strafing with his rifle up, a
// brawl with a stagger, a collapse, a scooter rider who stops (foot down) and sets off again,
// a sport bike leaning through bends and a driver turning the wheel.
import { Character } from '../characters/character.js';
import { generateLook } from '../characters/character-generator.js';
import { Vehicle } from '../vehicles/vehicle.js';
import { VEHICLE_MODELS } from '../vehicles/vehicle-catalog.js';
import { HumanoidModel } from '../characters/humanoid-model.js';
import { animateDriver, animatePassenger, passengerSeat } from '../vehicles/vehicle-manager.js';
import { buildWeaponMesh } from '../combat/weapon-meshes.js';

const look = (seed, o = {}) => generateLook(seed, o.role || 'auto', o);

export function createMotionStage(scene, ox = 0, oz = 0) {
  const actors = {};
  const people = [];
  const add = (name, seed, x, z, heading = 0, o = {}) => {
    const c = new Character(look(seed, o), ox + x, oz + z, { health: 100 });
    c.heading = heading; c.anim = 'auto';
    scene.add(c.mesh);
    people.push(c);
    actors[name] = { ch: c, focus: () => ({ x: c.pos.x, y: c.pos.y + 1.0, z: c.pos.z }) };
    return c;
  };
  const W = add('walker', 11, -6, 0, 0);
  const J = add('jogger', 23, 0, -4, 0, { gender: 'f' });
  const S = add('sprinter', 37, 0, -4, 0, { gender: 'm' });
  const T1 = add('talkA', 41, -12, 6, Math.PI / 2, { gender: 'f' });
  const T2 = add('talkB', 52, -11.05, 6, -Math.PI / 2, { gender: 'm', age: 'old' });
  const G = add('gunman', 63, 8, 6, 0, { role: 'gang' });
  G.model.hold(buildWeaponMesh('rifle')); G.twoHanded = true;
  const P = add('puncher', 74, 14, 0, Math.PI / 2);
  const V = add('victim', 85, 15.1, 0, -Math.PI / 2);
  const D = add('faller', 96, 20, 6, 0.4);
  actors.talk = { ch: T1, focus: () => ({ x: (T1.pos.x + T2.pos.x) / 2, y: 1.2, z: T1.pos.z }) };
  actors.fight = { ch: P, focus: () => ({ x: (P.pos.x + V.pos.x) / 2, y: 1.0, z: P.pos.z }) };

  const vehicles = [];
  const addVeh = (name, key, x, z, heading, seed) => {
    const spec = VEHICLE_MODELS[key];
    const v = new Vehicle(spec, key, spec.colors[0], ox + x, oz + z, heading);
    const m = new HumanoidModel(look(seed, { role: spec.twoWheel ? 'rider' : 'auto' }));
    m.root.position.copy(v.seat); v.body.add(m.root);
    v.driverModel = m; v.mount = 1; v.mountDir = 1;
    scene.add(v.mesh);
    vehicles.push(v);
    actors[name] = { v, focus: () => ({ x: v.pos.x, y: 0.9, z: v.pos.z }) };
    return v;
  };
  const addPassenger = (v, seed, role = 'auto') => {
    const m = new HumanoidModel(look(seed, { role }));
    v.passengerSeat = passengerSeat(v); m.root.position.copy(v.passengerSeat.pos); v.body.add(m.root); v.passengerModel = m;
  };
  const sc = addVeh('scooter', 'bebek', -4, 14, 0, 107);
  addPassenger(sc, 211, 'rider');
  const bk = addVeh('bike', 'kilat', 10, 16, 0, 118);
  const car = addVeh('car', 'lestari', 24, 14, 0, 129);
  addPassenger(car, 223);
  const bj = addVeh('bajaj', 'bajaj', 44, 14, 0, 167);
  addPassenger(bj, 231);
  const mb = addVeh('mountBike', 'kilat', 30, 4, 0, 131);
  const ms = addVeh('mountScooter', 'bebek', 33, 4, 0, 142);
  const mc = addVeh('mountCar', 'kancil', 37, 4, 0, 153);

  let t = 0;
  const loop = (c, cx, cz, r, speed, dt) => {
    // Round a rounded-rectangle loop at constant speed.
    c.loopA = (c.loopA ?? 0) + speed / r * dt;
    const a = c.loopA;
    const tx = ox + cx + Math.sin(a) * r * 1.6, tz = oz + cz + Math.cos(a) * r;
    const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz) || 1;
    c.move(dt, null, dx / d * Math.min(speed, d * 4), dz / d * Math.min(speed, d * 4));
  };
  function step(dt) {
    t += dt;
    // Walker: walk 2.6 s, stop 1.6 s, turn round on the spot, walk back.
    {
      const cyc = t % 8.4, back = Math.floor(t / 8.4) % 2;
      const h = back ? Math.PI : 0;
      if (cyc < 2.6) { W.move(dt, null, Math.sin(h) * 1.4, Math.cos(h) * 1.4, h, 6); }
      else if (cyc < 4.2) W.move(dt, null, 0, 0, h, 6);
      else if (cyc < 5.4) W.move(dt, null, 0, 0, h + Math.PI, 3.5);
      else W.move(dt, null, 0, 0, h + Math.PI, 6);
      if (cyc > 5.4) W.heading = h + Math.PI;
      if (cyc >= 5.4 && cyc - dt < 5.4) W.heading = h + Math.PI;
    }
    loop(J, 0, -4, 5, 3.6, dt);
    loop(S, 0, -4, 7, 6.8, dt);
    // Talkers: handshake, then turns of speech with gestures, a nod and a wave goodbye.
    if (t > 0.3 && !T1.shook) { T1.shook = true; T1.playGesture('handshake', 1.8, T2); T2.playGesture('handshake', 1.8, T1); }
    const speaker = Math.floor(t / 2.6) % 2;
    const syl = Math.max(0, Math.sin(t * 13)) * (0.5 + 0.5 * Math.sin(t * 3.1));
    if (t > 2.2) { (speaker ? T2 : T1).talk = syl; }
    if (t > 2.2) { T1.listening = speaker === 1; T2.listening = speaker === 0; }
    if (Math.abs(t % 5.2 - 4.0) < dt / 2 && t > 3) (speaker ? T1 : T2).playGesture('nod', 1.2);
    T1.lookAt(T2.pos.x, T2.pos.z, T2.headY); T2.lookAt(T1.pos.x, T1.pos.z, T1.headY);
    T1.move(dt, null, 0, 0, Math.PI / 2); T2.move(dt, null, 0, 0, -Math.PI / 2);
    // Gunman: strafes left and right with the rifle shouldered, firing bursts.
    G.aiming = true; G.aimPitch = 0.05;
    const sx = Math.sin(t * 0.8) > 0 ? 1.6 : -1.6;
    G.move(dt, null, sx, 0, 0, 10);
    if (Math.floor(t * 6) % 9 < 3 && Math.floor(t * 6) !== G.lastShot) { G.lastShot = Math.floor(t * 6); G.recoil = Math.min(1, (G.recoil || 0) + 0.35); }
    // Brawl: jab, jab, heavy hit (stagger) every 2.4 s; the victim squares up again.
    const pc = t % 2.4;
    if ((pc < dt || Math.abs(pc - 0.6) < dt / 2 || Math.abs(pc - 1.2) < dt / 2) && P.punchT >= 1) {
      P.punchT = 0; P.meleeKind = 'fists';
      P.pendingHit = 0.1;
    }
    if (P.pendingHit != null) {
      P.pendingHit -= dt;
      if (P.pendingHit <= 0) { P.pendingHit = null; V.hitBack = 1; V.hitSide = 0.2; const heavy = pc > 1.1 && pc < 1.6; V.hit(0.01, P.pos, { knockback: heavy ? 2.6 : 0.5 }); V.health = 100; }
    }
    const back = Math.hypot(V.pos.x - (ox + 15.1), V.pos.z - oz);
    V.move(dt, null, back > 0.05 && V.stagger <= 0 ? (ox + 15.1 - V.pos.x) * 2 : 0, back > 0.05 && V.stagger <= 0 ? (oz - V.pos.z) * 2 : 0, -Math.PI / 2, 8);
    P.move(dt, null, 0, 0, Math.PI / 2);
    // Faller: walks, gets shot and collapses.
    if (t < 1.2) D.move(dt, null, Math.sin(0.4) * 1.3, Math.cos(0.4) * 1.3);
    else { if (D.alive) { D.hitBack = 1; D.hitSide = 0.4; D.die(null, 'bullet'); } D.move(dt, null, 0, 0); }
    for (const c of people) c.updateVisual(dt);

    // Scooter: rides a loop, slows to a stop (foot down) every 7 s, then pulls away.
    {
      const cyc = t % 7;
      const want = cyc < 4.5 ? 7 : cyc < 6.2 ? 0 : 3;
      sc.speed += (want - sc.speed) * (1 - Math.exp(-(want < sc.speed ? 2.2 : 1.2) * dt));
      sc.angVel = 0.55 * Math.sin(t * 0.6) * Math.min(1, sc.speed / 3);
      driveScripted(sc, dt);
    }
    {
      bk.speed = 11 + 3 * Math.sin(t * 0.5);
      bk.angVel = 0.6 * Math.sin(t * 0.9);
      driveScripted(bk, dt);
    }
    // Climbing on and off (1 s on, 1.2 s seated, 1 s off, 1 s standing beside).
    for (const v of [mb, ms, mc]) {
      const c = (t + (v === ms ? 1 : v === mc ? 2 : 0)) % 4.4;
      v.mount = c < 1.1 ? c / 1.1 : c < 2.3 ? 1 : c < 3.4 ? 1 - (c - 2.3) / 1.1 : 0;
      v.speed = 0; v.angVel = 0;
      driveScripted(v, dt);
    }
    { bj.speed = 5; bj.angVel = 0.3 * Math.sin(t * 0.7); driveScripted(bj, dt); }
    {
      car.speed = 4;
      car.angVel = 0.35 * Math.sin(t * 0.8);
      driveScripted(car, dt);
    }
  }
  function driveScripted(v, dt) {
    v.heading += v.angVel * dt;
    v.vel.set(Math.sin(v.heading) * v.speed, 0, Math.cos(v.heading) * v.speed);
    v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
    v.steer = Math.max(-0.5, Math.min(0.5, v.angVel * (v.spec.wheelbase || 2.5) / Math.max(1, v.speed) * 1.2));
    v.controls.steer = v.steer / 0.5;
    v.wheelSpin = (v.wheelSpin || 0) + v.speed / (v.spec.wheelRadius || 0.3) * dt;
    v.leanDt = dt;
    v.syncMesh();
    animateDriver(v, v.driverModel, dt);
    if (v.passengerModel) animatePassenger(v, v.passengerModel, dt);
  }
  return { actors, people, vehicles, step, get time() { return t; } };
}
