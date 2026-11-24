// Deterministic screenshot scenes (?shot=cover|combat|drive|menu|test): seeds the world, stages a
// moment of play with the real systems (missions, police, traffic, combat), simulates it with a
// fixed time step, renders, and flags window.__shotReady for the capture script.
import { rng } from '../core/rng.js';
import { MISSIONS } from '../missions/mission-scripts.js';
import { Combatant } from '../combat/combatant-ai.js';
import { Character } from '../characters/character.js';
import { generateLook } from '../characters/character-generator.js';
import { CAST } from '../missions/story-cast.js';
import { VEHICLE_MODELS } from '../vehicles/vehicle-catalog.js';
import { buildWeaponMesh } from '../combat/weapon-meshes.js';

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
  session.weather.update(0, gfx.camera);
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
    s.wanted.setLevel(3, 'Theft at the harbour');
    const offsets = [[3.2, 7], [-0.6, 17], [3.4, 28]];
    for (const [dx, dz] of offsets) {
      const u = s.police.spawnCar('car', v.pos.x, v.pos.z, null);
      if (u) { u.vehicle.pos.set(X0 + dx, 0, Z0 + dz); u.vehicle.heading = Math.PI; u.vehicle.vel.set(0, 0, -24); u.vehicle.ai.from = [4, 6]; u.vehicle.ai.to = [4, 5]; }
    }
    s.traffic.populate(0, 0, 24);
    s.peds.populate(0, 20, 34);
    s.radio.index = 3; s.radio.on = true;
    const yaw = Math.PI - (Number(new URLSearchParams(location.search).get('yaw')) || 0.12), pitch = Number(new URLSearchParams(location.search).get('pitch')) || 0.3;
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
    // Crowd the sidewalks around the chase: people stop, stare and scatter.
    s.peds.target = 60;
    for (let k = 0; k < 400 && s.peds.list.length < 60; k++) s.peds.spawn(v.pos.x, v.pos.z - 20, 8, 55);
    for (let i = 0; i < 20; i++) s.peds.update(DT, s.player, s.vehicles);
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
    s.dialogue.say('dimas', 'Cops everywhere! Take the beach road, Rak!');
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
    s.dialogue.say('lastri', 'Do not let them break my windows, Raka!');
    s.dialogue.update(0.01);
    void fireT;
    await finish(s, gfx);
  },

  // Street race up the harbour road: cranes, the container ship and the skyline at sunset.
  // Racing down the container quay under the gantry cranes, the sun low over the strait.
  // Cruising Jalan Pantai Senja into the sunset on a scooter: palms, beach, hotels, the sea.
  async beach(session, gfx) {
    const s = session;
    s.progression.money = 9870000; s.progression.xp = 1900;
    s.player.arsenal.give('pistol', 48); s.player.arsenal.select('pistol');
    s.crew.unlock('dimas');
    for (const m of MISSIONS.slice(0, 4)) s.missions.completed.add(m.id);
    s.start({});
    const v = s.vehicles.spawn('rajawali', 60, 322.6, -Math.PI / 2, { color: 0xd02010 });
    v.ai = { kind: 'crew-car' }; v.ownedByPlayer = true;
    v.vel.set(-26, 0, 0);
    s.player.body.pos.set(v.pos.x, 0, v.pos.z - 2);
    s.player.tryEnterExit(s);
    s.side.startRace(); s.side.cp = 0; s.side.time = 4.2; s.side.showCheckpoint();
    s.dialogue.clear();
    s.traffic.populate(0, 310, 22);
    s.peds.target = 50;
    for (let k = 0; k < 300 && s.peds.list.length < 50; k++) s.peds.spawn(0, 300, 6, 70);
    s.radio.index = 0; s.radio.on = true; s.radio.songIndex = 3;
    const yaw = -Math.PI / 2 + 0.32, pitch = 0.08;
    simulate(s, 1.5, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0; s.cameraRig.yaw = yaw; s.cameraRig.pitch = pitch;
    });
    s.input.simulateHold('KeyW', false);
    for (let k = 0; k < 300 && s.peds.list.length < 50; k++) s.peds.spawn(v.pos.x - 25, v.pos.z, 6, 45);
    for (let i = 0; i < 10; i++) s.peds.update(DT, s.player, s.vehicles);
    s.dialogue.say('dimas', 'Sunset on Pantai Senja. Floor it to the first gate, Rak!');
    s.dialogue.update(0.01);
    await finish(s, gfx);
  },

  async harbor(session, gfx) {
    const s = session;
    s.progression.money = 9870000; s.progression.xp = 1900;
    s.player.arsenal.give('pistol', 48); s.player.arsenal.give('smg', 90); s.player.arsenal.select('pistol');
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
    s.dialogue.say('dimas', 'Under the cranes! The harbour cops will never make it!');
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
    s.dialogue.say('dimas', 'Next gate is at the end of the wharf. Keep going, Rak!');
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
    ctx.menus.showTitle({ canContinue: true, saveLabel: 'Chapter 4 · Raid on Kota Lama · Rp 6,230,000', completed: MISSIONS.slice(0, 3).map((m) => m.id) });
    await finish(s, gfx);
  },

  // Not a picture: exercises every system for a while and logs what happened (used by tests).
  async stress(session, gfx) {
    const s = session;
    const log = (...a) => console.log('[stress]', ...a);
    s.audio.start();
    log('audio', !!s.audio.ctx, s.audio.ctx && s.audio.ctx.state);
    for (let k = 0; k < 5; k++) { const st = s.radio.next(); s.radio.update(0.3); log('radio', st && st.name); }
    s.audio.explosion(10); s.audio.gunshot('shotgun', 5); s.audio.horn(); s.audio.missionJingle(true); s.audio.voiceBlip(3);
    s.start({});
    for (const id of ['pistol', 'smg', 'shotgun', 'revolver', 'rifle', 'sniper', 'bat', 'machete']) s.player.arsenal.give(id, 300);
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
    // Angkot passenger job: board and deliver one fare by teleporting to the stops.
    if (s.player.vehicle) s.player.exitVehicle(s);
    s.side.mode = null;
    if (s.missions.active) s.missions.fail('test');
    s.missions.cooldown = 999;
    const ang = s.vehicles.spawn('angkot', 2.6, 40, 0);
    s.player.body.pos.set(4.5, 0, 40); s.player.tryEnterExit(s);
    simulate(s, 0.2);
    log('angkot job', s.angkotJob.active, s.angkotJob.phase, 'veh', s.player.vehicle && s.player.vehicle.modelKey, 'wasted', s.wastedTimer, 'busted', s.busted, 'alive', s.player.alive, 'mission', !!s.missions.active, 'side', s.side.mode);
    for (let k = 0; k < 2 && s.angkotJob.active; k++) {
      ang.pos.set(s.angkotJob.spot.x, 0, s.angkotJob.spot.z); ang.vel.set(0, 0, 0);
      simulate(s, 0.3);
      log('angkot phase', s.angkotJob.phase, 'fares', s.angkotJob.fares);
    }
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

  // Every weapon model laid out large (for checking the models): ?shot=weapons.
  async weapons(session, gfx) {
    const s = session;
    s.hud.show(false);
    const ids = ['pistol', 'revolver', 'smg', 'rifle', 'shotgun', 'sniper', 'bat', 'machete'];
    const X0 = -40, Z0 = 87.6, Y = 1.4;
    for (const p of [...s.peds.list]) s.peds.remove(p);
    ids.forEach((id, i) => {
      const m = buildWeaponMesh(id);
      m.rotation.set(0, Math.PI / 2, 0);
      m.scale.setScalar(1.8);
      m.position.set(X0 - 1.0 + (i % 2) * 2.3, Y + 1.7 - Math.floor(i / 2) * 0.62, Z0);
      s.scene.add(m);
    });
    s.cameraRig.override = { x: X0 + 0.2, y: Y + 0.8, z: Z0 + 3.6, tx: X0 + 0.2, ty: Y + 0.75, tz: Z0, fov: 50 };
    s.cameraRig.update(DT, s.player, s.input);
    s.gfx.lighting.follow(X0, Z0);
    await finish(s, gfx);
  },

  // Every vehicle model side by side (for checking the models).
  async garage(session, gfx) {
    const s = session;
    s.hud.show(false);
    const keys = Object.keys(VEHICLE_MODELS);
    // Two rows parked along Jl. Bandar (z = 160), noses towards the camera side.
    for (const v of [...s.vehicles.list]) if (Math.abs(v.pos.z - 160) < 40 && Math.abs(v.pos.x) < 80) s.vehicles.remove(v);
    keys.forEach((k, i) => {
      const row = i % 2, col = Math.floor(i / 2);
      const v = s.vehicles.spawn(k, -30 + col * 8.2 + row * 4, 157.2 + row * 5.6, Math.PI / 2 + 0.5); v.ai = { kind: 'parked' }; v.syncMesh();
      v.mesh.updateMatrixWorld(true);
    });
    s.cameraRig.override = { x: 4, y: 8.5, z: 147, tx: 2, ty: 0.3, tz: 160, fov: 76 };
    s.cameraRig.update(DT, s.player, s.input);
    s.gfx.lighting.follow(4, 160);
    await finish(s, gfx);
  },

  // Character showcase: Raka, the story cast and a crowd of generated townspeople, police,
  // harbour workers, market sellers and gangsters lined up in good light (?shot=characters).
  async characters(session, gfx, ctx) {
    const s = session;
    s.hud.show(false);
    for (const v of [...s.vehicles.list]) if (Math.hypot(v.pos.x + 50, v.pos.z - 87) < 40) s.vehicles.remove(v);
    for (const p of [...s.peds.list]) s.peds.remove(p);
    const close = ctx?.params?.get('close') === '1';
    const people = [];
    const add = (look, x, z, heading, anim = 'idle', extra = {}) => {
      const c = new Character(look, x, z, { atlasSize: 512 });
      c.heading = heading; c.anim = anim; Object.assign(c, extra);
      s.scene.add(c.mesh); people.push(c);
      return c;
    };
    const X0 = -54.5, Z0 = 87.6;
    const cast = ['dimas', 'lastri', 'harun', 'rusdi', 'bayu', 'wulan'];
    const roles = ['auto', 'auto', 'market', 'auto', 'worker', 'auto', 'police', 'auto', 'gang', 'auto', 'rider', 'auto', 'tactical', 'auto'];
    // Front row: the player and the cast. Back row: generated people.
    s.player.body.pos.set(X0, 0.16, Z0); s.player.body.heading = 0.15;
    if (close) {
      cast.slice(0, 4).forEach((k, i) => add(CAST[k].look, X0 + 0.75 * (i + 1), Z0 + 0.05 * i, -0.1 + i * 0.04));
    } else {
      cast.forEach((k, i) => add(CAST[k].look, X0 + 1.05 * (i + 1), Z0 + (i % 2) * 0.25, 0.1 - i * 0.05, i === 2 ? 'talk' : 'idle'));
      for (let i = 0; i < 14; i++) {
        const look = generateLook(7000 + i * 37, roles[i]);
        const anim = i % 5 === 1 ? 'phone' : i % 4 === 3 ? 'walk' : 'idle';
        const c = add(look, X0 - 0.4 + i * 0.62, Z0 - 2.2 - (i % 2) * 0.7, (i % 3 - 1) * 0.35, anim);
        if (i % 6 === 4) c.umbrella = true;
        if (anim === 'phone') c.model.showProp('phone', true);
        if (c.umbrella) c.model.showProp('umbrella', true);
      }
    }
    for (let k = 0; k < 40; k++) {
      for (const c of people) {
        const spd = c.anim === 'walk' ? 1.35 : 0;
        if (c.anim === 'talk') c.talk = 0.6 + 0.4 * Math.sin(k * 1.7);
        c.pos.y = 0.16;
        c.updateVisual(DT, spd);
      }
      s.player.body.updateVisual(DT, 0);
    }
    const cx = close ? X0 + 1.9 : X0 + 3.6;
    s.cameraRig.override = close ? { x: cx, y: 1.72, z: Z0 + 2.3, tx: cx, ty: 1.55, tz: Z0, fov: 40 } : { x: cx, y: 1.75, z: Z0 + 6.4, tx: cx, ty: 1.05, tz: Z0 - 1, fov: 50 };
    s.cameraRig.update(DT, s.player, s.input);
    s.gfx.lighting.follow(cx, Z0);
    await finish(s, gfx);
  },

  // A line-up of townspeople (for checking the character models).
  async people(session, gfx) {
    const s = session;
    s.hud.show(false);
    for (let i = 0; i < 8; i++) {
      const p = s.peds.spawn(-40, 87, 0, 400);
      if (!p) continue;
      p.pos.set(-46 + i * 1.3, 0.16, 87.5); p.ai.mode = 'idle'; p.anim = i % 3 ? 'idle' : 'walk'; p.heading = 0.3;
      p.updateVisual(0.5); p.updateVisual(0.5);
    }
    s.player.body.pos.set(-36, 0.16, 87.5); s.player.body.heading = -0.4; s.player.body.updateVisual(0.1);
    s.cameraRig.override = { x: -41, y: 1.9, z: 93.5, tx: -41, ty: 1.0, tz: 87.5, fov: 50 };
    s.cameraRig.update(DT, s.player, s.input);
    s.gfx.lighting.follow(-41, 87);
    await finish(s, gfx);
  },

  // Random play for two simulated minutes; logs anything that goes NaN or throws.
  async soak(session, gfx) {
    const s = session;
    const log = (...a) => console.log('[soak]', ...a);
    s.start({});
    for (const id of ['pistol', 'smg', 'shotgun']) s.player.arsenal.give(id, 500);
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
    let errors = 0;
    for (let sec = 0; sec < 120; sec++) {
      for (const k of keys) s.input.simulateHold(k, rng.chance(k === 'KeyW' ? 0.7 : 0.25));
      s.input.buttons.clear();
      if (rng.chance(0.4)) { s.input.buttons.add(0); s.input.buttons.add(2); }
      if (rng.chance(0.15)) s.input.pressed.add('KeyF');
      if (rng.chance(0.1)) s.input.pressed.add(rng.pick(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyR', 'KeyZ', 'KeyX']));
      s.cameraRig.yaw += rng.range(-0.8, 0.8);
      try { simulate(s, 1, () => { s.input.mouseDX = rng.range(-20, 20); }); } catch (e) { errors++; log('ERROR', e.message, e.stack.split('\n')[1]); }
      const p = s.player.pos;
      const bad = [p.x, p.z, ...s.vehicles.list.flatMap((v) => [v.pos.x, v.pos.z, v.heading])].some((n) => !Number.isFinite(n));
      if (bad) { log('NaN at second', sec); break; }
      if (sec % 20 === 0) log('t', sec, 'pos', p.x.toFixed(0), p.z.toFixed(0), 'veh', !!s.player.vehicle, 'wanted', s.wanted.level, 'hp', Math.round(s.player.body.health), 'peds', s.peds.list.length, 'cars', s.vehicles.list.length, 'mission', s.missions.active && s.missions.active.mission.id);
    }
    log('soak finished; errors', errors, 'money', s.progression.money, 'kills', s.progression.stats.kills);
    await finish(s, gfx);
  },

  // Alternative cover: the evidence run along the beach boulevard into the sunset.
  async cover2(session, gfx) {
    const s = session;
    s.player.arsenal.give('pistol', 60); s.player.arsenal.give('smg', 120);
    s.progression.money = 18450000; s.progression.xp = 2650;
    s.crew.unlock('dimas'); s.crew.unlock('lastri');
    s.start({});
    startMissionAt(s, 'kontainer-27', 3);
    const v = s.missions.active.vehicle;
    const X0 = 70, Z0 = 322.6;
    v.pos.set(X0, 0, Z0); v.heading = -Math.PI / 2; v.vel.set(-24, 0, 0); v.controls.handbrake = false;
    s.player.arsenal.select('smg');
    s.player.body.pos.set(v.pos.x, 0, v.pos.z - 2);
    s.player.tryEnterExit(s);
    s.missions.update(DT);
    s.wanted.setLevel(3, 'Theft at the harbour');
    for (let i = 0; i < 3; i++) {
      const u = s.police.spawnCar('car', v.pos.x, v.pos.z, null);
      if (u) { u.vehicle.pos.set(X0 + 12 + i * 10, 0, Z0 - 2 + (i % 2) * 3); u.vehicle.heading = -Math.PI / 2; u.vehicle.vel.set(-25, 0, 0); u.vehicle.ai.from = [5, 8]; u.vehicle.ai.to = [4, 8]; }
    }
    s.traffic.populate(0, 310, 20);
    s.radio.index = 3; s.radio.on = true;
    const yaw = -Math.PI / 2 + 0.3, pitch = 0.2;
    simulate(s, 1.6, () => {
      s.input.simulateHold('KeyW', true);
      s.cameraRig.idleMouse = 0; s.cameraRig.yaw = yaw; s.cameraRig.pitch = pitch;
    });
    s.input.simulateHold('KeyW', false);
    const units = s.police.units.filter((u) => u.kind === 'car');
    [[2.8, 4.5, 0.05], [-1.2, 12, -0.08], [3.2, 22, 0.1]].forEach(([dz, dx, rot], i) => {
      const pv = units[i] && units[i].vehicle;
      if (!pv) return;
      pv.pos.set(v.pos.x + dx, 0, v.pos.z - dz + 1.4); pv.heading = v.heading + rot; pv.syncMesh();
    });
    for (let k = 0; k < 300 && s.peds.list.length < 50; k++) s.peds.spawn(v.pos.x - 25, v.pos.z, 6, 45);
    for (let i = 0; i < 10; i++) s.peds.update(DT, s.player, s.vehicles);
    const h = s.police.heli;
    h.pos.set(v.pos.x - 40, 16, v.pos.z - 10); h.heading = Math.PI / 2 - 0.4; h.vel.set(0, 0, 0);
    h.aim.set(v.pos.x, 0, v.pos.z);
    h.update(0.001, { x: v.pos.x, z: v.pos.z }, s.wanted.lastKnown, true);
    h.pos.set(v.pos.x - 40, 16, v.pos.z - 10); h.root.position.copy(h.pos);
    s.dialogue.say('dimas', 'Cops everywhere! Take the beach road, Rak!');
    s.dialogue.update(0.01);
    s.cameraRig.update(DT, s.player, s.input);
    await finish(s, gfx);
  },

  async policetest(session, gfx) {
    const s = session;
    const log = (...a) => console.log('[police]', ...a);
    s.start({ freeRoam: true });
    s.player.body.pos.set(86.5, 0.16, 40);
    s.wanted.setLevel(3, 'test');
    for (let t = 0; t < 40; t += 4) {
      simulate(s, 4);
      const cars = s.police.units.map((u) => u.vehicle ? Math.round(Math.hypot(u.vehicle.pos.x - s.player.pos.x, u.vehicle.pos.z - s.player.pos.z)) + ':' + u.state : u.kind);
      log('t', t + 4, 'wanted', s.wanted.level, 'unseen', s.wanted.unseen.toFixed(1), 'hp', Math.round(s.player.body.health), 'armour', Math.round(s.player.body.armour), 'officers', s.police.officers.filter((o) => o.alive).length, 'units', cars.join(' '), 'wasted', s.wastedTimer.toFixed(1), 'busted', !!s.busted);
    }
    // Escape: get wanted, let them close in, then vanish into the hills of Bukit Hijau.
    s.wanted.setLevel(2, 'test2');
    simulate(s, 12);
    s.player.body.pos.set(-300, 0.16, -330);
    for (let t = 0; t < 40; t += 5) {
      simulate(s, 5);
      log('escape t', t + 5, 'wanted', s.wanted.level, 'unseen', s.wanted.unseen.toFixed(1), 'spotted', s.police.spotted, 'units', s.police.units.length);
    }
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
