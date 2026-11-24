// Runs the story: start markers for the next mission, stage-by-stage objectives with spawned
// enemies, vehicles and pickups, dialogue, fail conditions, rewards, crew unlocks and autosave.
import { MISSIONS } from './mission-scripts.js';
import { CAST } from './story-cast.js';
import { Combatant, GANG_LOOKS } from '../combat/combatant-ai.js';
import { Character } from '../characters/character.js';
import { MARKER_COLORS } from '../world/world-markers.js';
import { laneLine, chooseNext, steerToward, edgeFromPose, nodePos } from '../vehicles/road-graph.js';
import { SKIN_TONES } from '../characters/humanoid-model.js';
import { rng } from '../core/rng.js';
import { clamp } from '../core/math-utils.js';
import { events } from '../core/event-bus.js';

export class MissionRunner {
  constructor(game) {
    this.game = game;
    this.completed = new Set();
    this.active = null;        // { mission, stageIndex, stage state }
    this.startMarker = null;
    this.giverNpc = null;
    this.enemies = [];
    this.spawned = [];         // vehicles spawned by the mission
    this.cooldown = 0;
    this.armed = true;
  }

  get nextMission() { return MISSIONS.find((m) => !this.completed.has(m.id)) || null; }
  get storyProgress() { return this.completed.size / MISSIONS.length; }

  refreshStartMarker() {
    const g = this.game;
    if (this.startMarker) { g.markers.remove(this.startMarker); this.startMarker = null; }
    if (this.giverNpc) { g.scene.remove(this.giverNpc.mesh); this.giverNpc = null; }
    const m = this.nextMission;
    if (!m || this.active) return;
    this.startMarker = g.markers.addZone(m.start.x, m.start.z, { radius: 2.6, color: MARKER_COLORS.objective, label: m.title, kind: 'mission-start' });
    const look = CAST[m.giver]?.look;
    if (look) {
      this.giverNpc = new Character(look, m.start.x + 1.6, m.start.z + 1.2, { name: CAST[m.giver].name });
      this.giverNpc.anim = 'idle';
      this.giverNpc.heading = Math.atan2(-1.6, -1.2);
      g.scene.add(this.giverNpc.mesh);
      this.giverNpc.updateVisual(0.016);
    }
  }

  start(mission) {
    const g = this.game;
    this.active = { mission, stageIndex: -1, stage: null, timer: 0, anchor: { ...mission.start } };
    if (this.startMarker) { g.markers.remove(this.startMarker); this.startMarker = null; }
    events.emit('mission-started', { mission });
    g.hud.missionTitleCard(mission);
    this.nextStage();
  }

  nextStage() {
    const a = this.active;
    this.cleanupStage();
    a.stageIndex++;
    const def = a.mission.stages[a.stageIndex];
    if (!def) { this.complete(); return; }
    a.stage = { def, timer: 0, done: false };
    a.timer = 0;
    this.enterStage(def, a.stage);
    events.emit('mission-stage', { mission: a.mission, index: a.stageIndex });
  }

  enterStage(def, st) {
    const g = this.game;
    const a = this.active;
    if (def.lines) g.dialogue.queueLines(def.lines);
    if (def.wanted && def.type !== 'enter-vehicle') g.wanted.setLevel(def.wanted, 'mission');
    switch (def.type) {
      case 'goto':
      case 'drive-to':
        st.marker = g.markers.addZone(def.target.x, def.target.z, { radius: def.radius || 5, label: def.text });
        a.anchor = { x: def.target.x, z: def.target.z };
        break;
      case 'enter-vehicle': {
        const vd = def.vehicle;
        const x = vd.x ?? a.anchor.x + vd.dx, z = vd.z ?? a.anchor.z + vd.dz;
        const v = g.vehicles.spawn(vd.model, x, z, vd.heading ?? 0, { color: vd.color });
        v.ai = { kind: 'mission' };
        v.controls.handbrake = true;
        v.ownedByPlayer = vd.model === 'kancil';
        this.spawned.push(v);
        a.vehicle = v;
        st.arrow = g.markers.addArrow(v, MARKER_COLORS.vehicle);
        for (const gd of def.guards || []) this.spawnEnemy(a.anchor.x + gd.dx, a.anchor.z + gd.dz, gd.weapon);
        break;
      }
      case 'eliminate':
        for (const e of def.enemies) this.spawnEnemy(a.anchor.x + e.dx, a.anchor.z + e.dz, e.weapon, e.boss ? def.boss : null);
        break;
      case 'chase': {
        const vd = def.vehicle;
        const v = g.vehicles.spawn(vd.model, a.anchor.x + vd.dx, a.anchor.z + vd.dz, Math.PI, { color: vd.color, driverLook: CAST[def.who].look });
        const e = edgeFromPose(v.pos.x, v.pos.z, v.heading);
        v.ai = { kind: 'flee', from: e.from, to: e.to };
        v.driverCharacter = new Character(CAST[def.who].look, v.pos.x, v.pos.z, { health: 60, faction: 'gang', name: CAST[def.who].name });
        this.spawned.push(v);
        st.target = v;
        st.arrow = g.markers.addArrow(v, MARKER_COLORS.enemy);
        // A scooter of Pak Harun's is left right by Raka for the pursuit.
        if (!g.player.vehicle) {
          const p = g.player.pos;
          const loan = g.vehicles.spawn('bebek', p.x + 1.8, p.z + 1.2, Math.PI, { color: 0x2050c0 });
          loan.ai = { kind: 'activity' }; loan.ownedByPlayer = true; loan.controls.handbrake = true;
          st.loan = g.markers.addArrow(loan, MARKER_COLORS.vehicle);
          st.loanVehicle = loan;
          g.dialogue.say('harun', 'Take my scooter, Raka! Hurry!');
        }
        break;
      }
      case 'collect':
        st.pickup = g.markers.addPickup('ledger', a.anchor.x + def.at.dx, a.anchor.z + def.at.dz);
        st.pickup.mission = true;
        st.marker = g.markers.addZone(st.pickup.x, st.pickup.z, { radius: 1.5 });
        break;
      case 'survive':
        st.left = def.seconds;
        break;
      case 'lose-wanted':
        if (g.wanted.level === 0) g.wanted.setLevel(def.wanted || 2, 'mission');
        break;
      case 'talk':
        st.wait = (def.lines || []).reduce((t, l) => t + g.dialogue.durationOf(l[1]), 0.6);
        break;
    }
  }

  spawnEnemy(x, z, weapon, bossKey = null) {
    const g = this.game;
    const look = bossKey ? CAST[bossKey].look : { ...rng.pick(GANG_LOOKS), skin: rng.pick(SKIN_TONES), hair: 0x111111 };
    const c = new Combatant(g.scene, look, x, z, {
      faction: 'gang', weapon, health: bossKey ? 420 : weapon === 'fists' ? 70 : 100, accuracy: bossKey ? 0.75 : 0.42, armour: bossKey ? 100 : 0,
      name: bossKey ? CAST[bossKey].name : null,
    });
    c.boss = !!bossKey;
    c.body.heading = rng.range(0, 6);
    this.enemies.push(c);
    c.arrow = g.markers.addArrow(c.body, MARKER_COLORS.enemy);
    return c;
  }

  cleanupStage() {
    const g = this.game;
    const st = this.active?.stage;
    if (!st) return;
    if (st.marker) g.markers.remove(st.marker);
    if (st.arrow) g.markers.remove(st.arrow);
    if (st.loan) g.markers.remove(st.loan);
    if (st.pickup) { g.scene.remove(st.pickup.group); g.markers.pickups.splice(g.markers.pickups.indexOf(st.pickup), 1); }
  }

  cleanupMission() {
    const g = this.game;
    this.cleanupStage();
    for (const e of this.enemies) { if (e.arrow) g.markers.remove(e.arrow); }
    // Leave bodies to the pedestrian janitor; remove live enemies after a while.
    g.leftoverCombatants.push(...this.enemies);
    this.enemies = [];
    for (const v of this.spawned) if (v.ai && v.ai.kind === 'flee') v.ai = { kind: 'traffic-parked' };
    this.spawned = [];
    this.active = null;
  }

  complete() {
    const g = this.game, m = this.active.mission;
    this.completed.add(m.id);
    g.progression.addMoney(m.reward.money, m.title);
    g.progression.addXp(m.reward.xp, m.title);
    g.progression.stats.missions++;
    if (m.giveWeapon) { g.player.arsenal.give(m.giveWeapon[0], m.giveWeapon[1]); events.emit('weapon-unlocked', { id: m.giveWeapon[0] }); }
    if (m.unlockCrew) g.crew.unlock(m.unlockCrew);
    this.cleanupMission();
    events.emit('mission-complete', { mission: m });
    g.hud.missionResult(true, m);
    this.cooldown = 4;
    this.armed = false;
    this.refreshStartMarker();
  }

  fail(reason) {
    const g = this.game, m = this.active.mission;
    this.cleanupMission();
    events.emit('mission-failed', { mission: m, reason });
    g.hud.missionResult(false, m, reason);
    this.cooldown = 4;
    this.armed = false;
    this.refreshStartMarker();
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.cooldown -= dt;
    if (this.giverNpc) { this.giverNpc.anim = 'idle'; this.giverNpc.updateVisual(dt); }
    for (const e of this.enemies) {
      e.update(dt, g, p.alive ? { pos: p.pos, chestY: p.body.chestY, vehicle: p.vehicle, body: p.body } : null);
      if (!e.alive && e.arrow) { g.markers.remove(e.arrow); e.arrow = null; }
    }
    if (!this.active) {
      const m = this.nextMission;
      // After a mission ends the next marker only arms once Raka has stepped away from it.
      if (m && !this.armed && Math.hypot(p.pos.x - m.start.x, p.pos.z - m.start.z) > 6) this.armed = true;
      if (m && this.armed && this.cooldown <= 0 && p.alive && Math.hypot(p.pos.x - m.start.x, p.pos.z - m.start.z) < 3.2 && (!p.vehicle || Math.abs(p.vehicle.speed) < 4)) this.start(m);
      return;
    }
    if (!p.alive) { this.fail('Raka went down'); return; }
    const a = this.active, st = a.stage, def = st.def;
    st.timer += dt;
    if (a.vehicle && a.vehicle.wrecked && (def.type === 'enter-vehicle' || def.requireMissionVehicle)) { this.fail('Mission vehicle destroyed'); return; }
    let done = false;
    switch (def.type) {
      case 'goto':
        done = Math.hypot(p.pos.x - def.target.x, p.pos.z - def.target.z) < (def.radius || 5);
        break;
      case 'drive-to': {
        const inside = Math.hypot(p.pos.x - def.target.x, p.pos.z - def.target.z) < (def.radius || 5);
        const okVehicle = !def.requireMissionVehicle || p.vehicle === a.vehicle;
        done = inside && okVehicle && (!p.vehicle || Math.abs(p.vehicle.speed) < 7);
        st.hint = def.requireMissionVehicle && p.vehicle !== a.vehicle ? 'Get back in the mission vehicle' : null;
        break;
      }
      case 'enter-vehicle':
        done = p.vehicle === a.vehicle;
        if (done && def.wanted) g.wanted.setLevel(def.wanted, 'mission');
        break;
      case 'eliminate':
        done = this.enemies.length > 0 && this.enemies.every((e) => !e.alive);
        st.count = this.enemies.filter((e) => e.alive).length;
        break;
      case 'chase':
        done = this.updateChase(dt, st);
        break;
      case 'collect':
        done = !g.markers.pickups.includes(st.pickup);
        if (done) st.pickup = null;
        break;
      case 'lose-wanted':
        done = g.wanted.level === 0 && st.timer > 1;
        break;
      case 'survive':
        st.left -= dt;
        if (g.wanted.level < (def.wanted || 0) && st.left > 3) g.wanted.setLevel(def.wanted, 'mission');
        done = st.left <= 0;
        break;
      case 'talk':
        done = st.timer > st.wait;
        break;
    }
    if (done) this.nextStage();
  }

  updateChase(dt, st) {
    const g = this.game, v = st.target, p = g.player;
    const rider = v.driverCharacter;
    // A hard knock throws Bayu off his scooter.
    if (v.health < v.spec.health * 0.6 && !st.thrown) { st.thrown = true; g.dialogue.say('bayu', 'Ow! Mercy, mercy! I was only following orders!'); }
    if (v.wrecked || st.thrown || (rider && !rider.alive)) { if (v.driverModel) g.vehicles.removeDriverModel(v); v.controls.throttle = 0; return true; }
    const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
    if (st.loan && p.vehicle) { g.markers.remove(st.loan); st.loan = null; }
    if (d > 340) { this.fail('Bayu got away'); return false; }
    if (d < 5 && Math.abs(v.speed) < 3 && st.timer > 3) {
      g.vehicles.removeDriverModel(v);
      return true;
    }
    // Flee through the grid, picking the exit farthest from the player.
    const ai = v.ai;
    let L = laneLine(ai.from, ai.to);
    const node = nodePos(ai.to[0], ai.to[1]);
    if (Math.hypot(node.x - v.pos.x, node.z - v.pos.z) < 8) {
      const away = { x: v.pos.x * 2 - p.pos.x, z: v.pos.z * 2 - p.pos.z };
      const next = chooseNext(ai.from, ai.to, rng, away);
      ai.from = ai.to; ai.to = next; L = laneLine(ai.from, ai.to);
    }
    const along = (v.pos.x - L.ax) * L.dx + (v.pos.z - L.az) * L.dz;
    const { steer, err } = steerToward(v, L.ax + L.dx * (Math.max(0, along) + 9), L.az + L.dz * (Math.max(0, along) + 9));
    // Bayu keeps just ahead: he slows when far in front and opens up when Raka closes in.
    const pace = d > 120 ? 13 : d < 30 ? 22 : 18;
    const want = (st.timer < 2.5 ? 0 : pace) * (1 - Math.min(0.6, Math.abs(err)));
    v.controls.throttle = clamp((want - v.speed) / 3, -1, 1);
    v.controls.steer = steer;
    v.controls.handbrake = false;
    if (rider) rider.pos.set(v.pos.x, 0, v.pos.z);
    return false;
  }

  // What the HUD mission panel shows.
  panelState() {
    if (!this.active) return null;
    const a = this.active, m = a.mission;
    const st = a.stage;
    let objective = st?.def.text || '';
    if (st?.def.type === 'eliminate' && st.count !== undefined) objective += ` (${st.count} left)`;
    if (st?.def.type === 'survive') objective += ` — ${Math.ceil(Math.max(0, st.left))} s`;
    if (st?.hint) objective = st.hint;
    return {
      chapter: `${m.chapter} · ${CAST[m.giver]?.full || ''}`, title: m.title,
      stages: m.stages.map((s, i) => ({ text: s.text, state: i < a.stageIndex ? 'done' : i === a.stageIndex ? 'active' : 'todo' })),
      objective,
    };
  }

  // Where the minimap's objective marker points.
  objectivePoint(override = null) {
    if (!this.active && override) return override;
    if (!this.active) { const m = this.nextMission; return m ? { x: m.start.x, z: m.start.z, kind: 'mission' } : null; }
    const st = this.active.stage;
    if (!st) return null;
    const d = st.def;
    if (d.target) return { x: d.target.x, z: d.target.z, kind: 'objective' };
    if (st.target) return { x: st.target.pos.x, z: st.target.pos.z, kind: 'enemy' };
    if (this.active.vehicle && d.type === 'enter-vehicle') return { x: this.active.vehicle.pos.x, z: this.active.vehicle.pos.z, kind: 'vehicle' };
    if (st.pickup) return { x: st.pickup.x, z: st.pickup.z, kind: 'objective' };
    const alive = this.enemies.find((e) => e.alive);
    if (alive) return { x: alive.body.pos.x, z: alive.body.pos.z, kind: 'enemy' };
    return null;
  }

  serialize() { return { completed: [...this.completed] }; }
  restore(d) { this.completed = new Set(d.completed || []); }
}
