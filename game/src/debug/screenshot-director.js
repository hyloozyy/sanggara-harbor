// Deterministic screenshot scenes (?shot=cover|combat|drive|menu|test): seeds the world, stages a
// moment of play with the real systems (missions, police, traffic, combat), simulates it with a
// fixed time step, renders, and flags window.__shotReady for the capture script.
import { rng } from '../core/rng.js';
import { MISSIONS } from '../missions/mission-scripts.js';
import { Combatant } from '../combat/combatant-ai.js';

const DT = 1 / 30;

function simulate(session, seconds, perStep = () => {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    perStep(i * DT);
    session.update(DT);
    session.input.endFrame();
  }
}

function startMissionAt(session, id, stageIndex) {
  const m = MISSIONS.find((x) => x.id === id);
  for (const x of MISSIONS) { if (x === m) break; session.missions.completed.add(x.id); }
  session.missions.start(m);
  while (session.missions.active && session.missions.active.stageIndex < stageIndex) session.missions.nextStage();
  session.dialogue.clear();
}

function finish(session, gfx) {
  session.hud.resultTimer = 0.0001;
  session.hud.update(DT, session.hudState());
  session.minimap.draw(DT, session.minimapState());
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      gfx.render(12.5);
      if (++n < 2) requestAnimationFrame(tick);
      else { console.log('scene draw calls', JSON.stringify(gfx.post.sceneStats)); window.__shotReady = true; resolve(); }
    };
    requestAnimationFrame(tick);
  });
}

const SCENES = {
  // Everything at once: a 3-star chase with the helicopter, mission panel, traffic and people.
  async cover(session, gfx) {
    const s = session;
    s.player.arsenal.give('pistol', 60); s.player.arsenal.give('smg', 120);
    s.progression.money = 18450000; s.progression.xp = 2650;
    s.crew.unlock('dimas'); s.crew.unlock('lastri');
    s.start({});
    startMissionAt(s, 'kontainer-27', 3);
    const v = s.missions.active.vehicle;
    // The evidence pickup races north up Jalan Raya Sanggara through the glass towers of Pusat Niaga.
    const X0 = -2.6, Z0 = 70;
    v.pos.set(X0, 0, Z0); v.heading = Math.PI; v.vel.set(0, 0, -22); v.controls.handbrake = false;
    s.player.arsenal.select('smg');
    s.player.body.pos.set(v.pos.x + 2, 0, v.pos.z);
    s.player.tryEnterExit(s);
    s.missions.update(DT);
    s.wanted.setLevel(3, 'Pencurian di pelabuhan');
    const offsets = [[3.2, 7], [-0.6, 17], [3.4, 28]];
    for (const [dx, dz] of offsets) {
      const u = s.police.spawnCar('car', v.pos.x, v.pos.z, null);
      if (u) { u.vehicle.pos.set(X0 + dx, 0, Z0 + dz); u.vehicle.heading = Math.PI; u.vehicle.vel.set(0, 0, -24); u.vehicle.ai.from = [4, 6]; u.vehicle.ai.to = [4, 5]; }
    }
    s.traffic.populate(0, 0, 24);
    s.peds.populate(0, 20, 34);
    s.radio.index = 3; s.radio.on = true;
    const yaw = Math.PI - 0.22, pitch = 0.36;
    simulate(s, 2.2, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0; s.cameraRig.yaw = yaw; s.cameraRig.pitch = pitch;
    });
    s.input.simulateHold('KeyW', false);
    // Frame the pursuers: one alongside, two fanned out behind.
    const units = s.police.units.filter((u) => u.kind === 'car');
    [[3.4, 3.2, 0.06], [-0.4, 14, -0.1], [3.6, 25, 0.12]].forEach(([dx, dz, rot], i) => {
      const pv = units[i] && units[i].vehicle;
      if (!pv) return;
      pv.pos.set(v.pos.x + dx, 0, v.pos.z + dz); pv.heading = v.heading + rot; pv.syncMesh();
    });
    // A fourth patrol car that lost the chase burns against a lamp post.
    const wreck = s.vehicles.spawn('patroli', v.pos.x + 8.6, v.pos.z - 17, Math.PI * 0.62);
    wreck.ai = { kind: 'parked-police' }; wreck.sirenOn = true; wreck.health = wreck.spec.health * 0.12;
    for (let i = 0; i < 40; i++) { s.updateVehicleEffects(DT); s.particles.update(DT); }
    const h = s.police.heli;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    h.pos.set(v.pos.x + fx * 44 + 4, 15, v.pos.z + fz * 44); h.heading = v.heading + Math.PI + 0.5; h.vel.set(0, 0, 0);
    h.aim.set(v.pos.x, 0, v.pos.z);
    h.update(0.001, { x: v.pos.x, z: v.pos.z }, s.wanted.lastKnown, true);
    h.pos.set(v.pos.x + fx * 44 + 4, 15, v.pos.z + fz * 44); h.root.position.copy(h.pos);
    s.dialogue.say('dimas', 'Polisi di mana-mana! Lewat pantai, Rak!');
    s.dialogue.update(0.01);
    s.cameraRig.update(DT, s.player, s.input);
    await finish(s, gfx);
  },

  // On-foot gunfight outside Warung Bu Lastri in Kota Lama.
  async combat(session, gfx) {
    const s = session;
    s.player.arsenal.give('pistol', 60); s.player.arsenal.give('smg', 150);
    s.progression.money = 6230000; s.progression.xp = 1350;
    s.crew.unlock('dimas'); s.crew.unlock('lastri');
    s.start({});
    startMissionAt(s, 'serangan-kota-lama', 1);
    const b = s.player.body;
    b.pos.set(46, 0, 162.8);
    s.player.arsenal.select('smg');
    s.player.syncHeldWeapon();
    s.traffic.populate(20, 160, 12);
    s.peds.populate(20, 170, 30);
    const enemies = s.missions.enemies;
    // Spread the gunmen along Jalan Cempaka, one already down.
    const spots = [[33, 160.5], [27, 157.2], [24, 163.4], [17, 159.5], [11, 156.8]];
    enemies.forEach((e, i) => { const p = spots[i % spots.length]; e.body.pos.set(p[0], 0, p[1]); e.reaction = 0.2 + i * 0.13; });
    const yaw = -Math.PI / 2 + 0.1;
    let fireT = 0;
    simulate(s, 1.0, (t) => {
      s.cameraRig.yaw = yaw; s.cameraRig.pitch = 0.08; s.cameraRig.idleMouse = 0;
      s.input.buttons.add(2);
      if (t > 0.5) { s.input.buttons.add(0); fireT += DT; }
      b.health = Math.max(b.health, 150);
    });
    enemies[2].body.hit(500, b.pos, { knockback: 6, attacker: b });
    // The gunmen's black sedan takes one burst too many.
    const gangCar = s.vehicles.spawn('lestari', 21, 157.4, -Math.PI / 2 + 0.5, { color: 0x15161a });
    gangCar.ai = { kind: 'parked' }; gangCar.controls.handbrake = true;
    gangCar.explode();
    gangCar.burnTimer = 0;
    simulate(s, 0.4, () => { s.input.buttons.add(2); s.cameraRig.yaw = yaw; s.cameraRig.pitch = 0.08; });
    // Final frame: trigger held, a fresh burst in flight.
    s.cameraRig.yaw = yaw; s.cameraRig.pitch = 0.08;
    s.player.arsenal.cooldown = 0; s.player.arsenal.mag.smg = 30;
    s.input.buttons.add(0); s.input.buttons.add(2); s.input.clicked.add(0);
    s.update(DT);
    s.player.arsenal.cooldown = 0;
    for (const e of enemies) if (e.alive) { e.arsenal.cooldown = 0; e.reaction = 0; e.los = true; e.update(DT, s, { pos: b.pos, chestY: b.chestY, vehicle: null, body: b }); }
    s.dialogue.clear();
    // Keep the camera clear: drop blood puffs from hits on Raka himself.
    s.particles.soft.items = s.particles.soft.items.filter((p) => !(p.color0[0] === 0.45 && Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < 2.5));
    s.particles.soft.update(0);
    s.dialogue.say('lastri', 'Jangan sampai kaca warungku pecah, Raka!');
    s.dialogue.update(0.01);
    void fireT;
    await finish(s, gfx);
  },

  // Street race up the harbour road: cranes, the container ship and the skyline at sunset.
  // Racing down the container quay under the gantry cranes, the sun low over the strait.
  async harbor(session, gfx) {
    const s = session;
    s.progression.money = 9870000; s.progression.xp = 1900;
    s.crew.unlock('dimas');
    for (const m of MISSIONS.slice(0, 4)) s.missions.completed.add(m.id);
    s.start({});
    const v = s.vehicles.spawn('rajawali', 351, -345, 0, { color: 0xf0c000 });
    v.ai = { kind: 'crew-car' }; v.ownedByPlayer = true;
    v.vel.set(0, 0, 30);
    s.player.body.pos.set(v.pos.x - 2, 0, v.pos.z);
    s.player.tryEnterExit(s);
    s.side.startRace(); s.side.cp = 6; s.side.time = 41.7; s.side.showCheckpoint();
    s.dialogue.clear();
    for (const [x, z, k] of [[349, -250, 'banteng'], [360, -180, 'angkot'], [347, -150, 'lestari']]) {
      const t = s.vehicles.spawn(k, x, z, Math.PI); t.ai = { kind: 'parked' }; t.controls.handbrake = true;
    }
    s.peds.populate(340, -250, 12);
    s.radio.index = 1; s.radio.on = true; s.radio.songIndex = 2;
    const yaw = 0.4, pitch = 0.08;
    simulate(s, 1.6, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0; s.cameraRig.yaw = yaw; s.cameraRig.pitch = pitch;
    });
    s.input.simulateHold('KeyW', false);
    s.dialogue.say('dimas', 'Lewat bawah derek! Polisi pelabuhan tidak akan sempat!');
    s.dialogue.update(0.01);
    await finish(s, gfx);
  },

  async drive(session, gfx) {
    const s = session;
    s.progression.money = 9870000; s.progression.xp = 1900;
    s.crew.unlock('dimas');
    for (const m of MISSIONS.slice(0, 4)) s.missions.completed.add(m.id);
    s.start({});
    const v = s.vehicles.spawn('rajawali', 317.4, 40, Math.PI, { color: 0xd02010 });
    v.ai = { kind: 'crew-car' }; v.ownedByPlayer = true;
    v.vel.set(0, 0, -30);
    s.player.body.pos.set(v.pos.x - 2, 0, v.pos.z);
    s.player.tryEnterExit(s);
    s.side.startRace();
    s.side.cp = 6; s.side.time = 38.2; s.side.showCheckpoint();
    s.dialogue.clear();
    s.traffic.populate(300, -20, 20);
    s.peds.populate(300, -20, 24);
    s.radio.index = 0; s.radio.on = true; s.radio.songIndex = 0;
    const yaw = Math.PI + 0.28, pitch = 0.1;
    simulate(s, 1.4, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0; s.cameraRig.yaw = yaw; s.cameraRig.pitch = pitch;
    });
    s.input.simulateHold('KeyW', false); s.input.simulateHold('KeyA', false);
    s.dialogue.say('dimas', 'Gerbang berikutnya di ujung dermaga. Gas terus, Rak!');
    s.dialogue.update(0.01);
    await finish(s, gfx);
  },

  // The title screen with the story briefing over the flyover of the city.
  async menu(session, gfx, ctx) {
    const s = session;
    s.traffic.populate(-40, 200, 22);
    s.peds.populate(-40, 240, 20);
    for (let i = 0; i < 30; i++) { s.traffic.update(DT, { pos: { x: -40, z: 200 }, vehicle: null }, null); s.vehicles.update(DT); }
    s.cameraRig.override = { x: -150, y: 34, z: 372, tx: 10, ty: 22, tz: 170 };
    s.cameraRig.update(DT, s.player, s.input);
    s.hud.show(false);
    document.getElementById('title-screen').classList.remove('hidden');
    ctx.menus.showTitle({ canContinue: true, saveLabel: 'Bab 4 · Serangan di Kota Lama · Rp 6.230.000', completed: MISSIONS.slice(0, 3).map((m) => m.id) });
    await finish(s, gfx);
  },

  // Not a picture: exercises every system for a while and logs what happened (used by tests).
  async stress(session, gfx) {
    const s = session;
    const log = (...a) => console.log('[stress]', ...a);
    s.start({});
    for (const id of ['pistol', 'smg', 'shotgun']) s.player.arsenal.give(id, 300);
    s.crew.unlock('dimas'); s.crew.unlock('lastri');
    // Walk every mission through every stage.
    for (const m of MISSIONS) {
      s.missions.start(m);
      let guard = 0;
      while (s.missions.active && guard++ < 20) { simulate(s, 0.3); if (s.missions.active) s.missions.nextStage(); }
      log('mission ok', m.id, 'completed', s.missions.completed.has(m.id));
    }
    s.missions.completed.clear(); s.missions.refreshStartMarker();
    // On foot shooting with 5 stars.
    s.wanted.setLevel(5, 'stress');
    s.player.arsenal.select('smg');
    simulate(s, 6, (t) => { s.input.buttons.add(0); s.input.buttons.add(2); s.cameraRig.yaw += 0.02; if (t > 5) s.input.buttons.clear(); });
    log('after shooting: police units', s.police.units.length, 'officers', s.police.officers.length, 'heli', s.police.heliActive, 'peds', s.peds.list.length, 'health', Math.round(s.player.body.health));
    // Steal the nearest car and drive with handbrake turns.
    s.player.body.health = 200;
    const car = s.vehicles.nearest(s.player.pos.x, s.player.pos.z, 300, (v) => !v.wrecked && !v.isPolice);
    if (car) { s.player.body.pos.set(car.pos.x + 1.5, 0, car.pos.z); s.player.tryEnterExit(s); }
    simulate(s, 10, (t) => { s.input.simulateHold('KeyW', true); s.input.simulateHold('Space', (t % 3) > 2.4); s.input.simulateHold('KeyD', (t % 4) > 3); });
    s.input.simulateHold('KeyW', false); s.input.simulateHold('Space', false); s.input.simulateHold('KeyD', false);
    log('driving: in vehicle', !!s.player.vehicle, 'speed', s.player.vehicle && s.player.vehicle.speed.toFixed(1), 'pos', s.player.pos.x.toFixed(0), s.player.pos.z.toFixed(0), 'roadblocks', s.police.units.filter((u) => u.kind === 'roadblock').length);
    // Blow something up, use the crew, run the activities.
    const victim = s.vehicles.list.find((v) => v !== s.player.vehicle && !v.wrecked);
    if (victim) victim.damage(99999, 'stress');
    s.crew.use('lastri'); s.crew.use('dimas');
    simulate(s, 2);
    if (s.player.vehicle) s.player.exitVehicle(s);
    s.wanted.clear('stress');
    s.police.clearAll();
    s.player.body.pos.set(-120, 0, 317.4);
    s.side.cool = {};
    const car2 = s.vehicles.spawn('kancil', -120, 317.4, Math.PI / 2);
    s.player.body.pos.set(-120, 0, 319.5); s.player.tryEnterExit(s);
    simulate(s, 3, () => s.input.simulateHold('KeyW', true));
    s.input.simulateHold('KeyW', false);
    log('race mode', s.side.mode, 'cp', s.side.cp, 'car', car2.spec.name);
    s.saveGame('stress');
    log('save ok', !!localStorage.getItem('pelabuhan-sanggara-save-v1'));
    s.respawn();
    log('done; vehicles', s.vehicles.list.length, 'particles', s.particles.glow.items.length + s.particles.soft.items.length, 'calls', gfx.renderer.info.render.calls);
    await finish(s, gfx);
  },

  async drivetest(session, gfx) {
    const s = session;
    const log = (...a) => console.log('[drive]', ...a);
    s.start({});
    const car = s.vehicles.spawn('kancil', -120, 317.4, Math.PI / 2);
    s.player.body.pos.set(-120, 0, 319.5); s.player.tryEnterExit(s);
    log('entered', s.player.vehicle && s.player.vehicle.id, car.id, 'side mode', s.side.mode, 'active', !!s.missions.active);
    for (let k = 0; k < 8; k++) {
      simulate(s, 1, () => s.input.simulateHold('KeyW', true));
      const v = s.player.vehicle;
      log('t', k + 1, 'speed', v && v.speed.toFixed(1), 'pos', s.player.pos.x.toFixed(1), s.player.pos.z.toFixed(1), 'race', s.side.mode, s.side.cp);
    }
    await finish(s, gfx);
  },

  // Every vehicle model side by side (for checking the models).
  async garage(session, gfx) {
    const s = session;
    s.hud.show(false);
    const keys = ['lestari', 'kancil', 'banteng', 'angkot', 'rajawali', 'taksi', 'patroli', 'taktis', 'bebek'];
    keys.forEach((k, i) => { const v = s.vehicles.spawn(k, -60 + i * 6.5, 120, 0.6); v.ai = { kind: 'parked' }; v.syncMesh(); });
    s.peds.populate(-40, 120, 10);
    s.cameraRig.override = { x: -36, y: 4.5, z: 136, tx: -34, ty: 0.5, tz: 120, fov: 60 };
    s.cameraRig.update(DT, s.player, s.input);
    s.gfx.lighting.follow(-34, 120);
    await finish(s, gfx);
  },

  async test(session, gfx) {
    session.start({});
    session.missions.start(session.missions.nextMission);
    simulate(session, 1.0);
    await finish(session, gfx);
  },
};

export async function stageScreenshot(name, ctx) {
  rng.reseed(Number(ctx.params.get('seed') || 7));
  ctx.session.input.enabled = true;
  const scene = SCENES[name] || SCENES.test;
  void Combatant;
  await scene(ctx.session, ctx.gfx, ctx);
}
