// One play session: builds the world and every system, wires their events together (crimes,
// sounds, rewards, deaths), runs the per-frame update and feeds the HUD and minimap.
import * as THREE from 'three';
import { buildCity } from './city/city-builder.js';
import { VehicleManager } from './vehicles/vehicle-manager.js';
import { TrafficSystem } from './vehicles/traffic-system.js';
import { PedestrianSystem } from './characters/pedestrian-system.js';
import { PlayerController } from './characters/player-controller.js';
import { Character } from './characters/character.js';
import { CameraRig } from './camera/camera-rig.js';
import { WeaponSystem } from './combat/weapon-system.js';
import { ParticleSystem } from './effects/particle-system.js';
import { LightFlashes } from './effects/light-flashes.js';
import { WantedSystem } from './police/wanted-system.js';
import { PoliceDispatcher } from './police/police-dispatcher.js';
import { WorldMarkers } from './world/world-markers.js';
import { Progression } from './world/progression.js';
import { MissionRunner } from './missions/mission-runner.js';
import { SideActivities } from './missions/side-activities.js';
import { CrewAbilities } from './missions/crew-abilities.js';
import { DialogueQueue } from './missions/dialogue-queue.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { assets } from './assets/asset-library.js';
import { writeSave } from './save/save-system.js';
import { WEAPONS } from './combat/weapon-catalog.js';
import { PLACES } from './city/city-layout.js';
import { formatRupiah } from './core/math-utils.js';
import { rng } from './core/rng.js';
import { events } from './core/event-bus.js';

const HOSPITAL = { x: -86.5, z: 40, name: 'RS Sanggara Sehat' };
const POLICE_STATION = { x: 86.5, z: 120, name: 'Polsek Kota Lama' };

export class GameSession {
  constructor(gfx, input, audio, radio, onProgress = () => {}) {
    this.gfx = gfx;
    this.scene = gfx.scene;
    this.input = input;
    this.audio = audio;
    this.radio = radio;
    this.assets = assets;
    const city = buildCity(onProgress);
    this.city = city;
    this.scene.add(city.root);
    this.world = { collision: city.collision };
    this.sea = city.sea;
    this.particles = new ParticleSystem(this.scene);
    this.lights = new LightFlashes(this.scene);
    this.vehicles = new VehicleManager(this.scene, this.world);
    this.traffic = new TrafficSystem(this.vehicles, city.signals);
    this.peds = new PedestrianSystem(this.scene, this.world);
    this.player = new PlayerController(this.scene, PLACES.station.x, PLACES.station.z);
    this.cameraRig = new CameraRig(gfx.camera, city.collision);
    this.wanted = new WantedSystem();
    this.markers = new WorldMarkers(this.scene);
    this.progression = new Progression();
    this.dialogue = new DialogueQueue();
    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'), document.getElementById('big-map-canvas'));
    this.leftoverCombatants = [];
    this.weapons = new WeaponSystem({ world: this.world, particles: this.particles, lights: this.lights, vehicles: this.vehicles, getCharacters: () => this.allCharacters() });
    this.police = new PoliceDispatcher(this);
    this.missions = new MissionRunner(this);
    this.side = new SideActivities(this);
    this.crew = new CrewAbilities(this);
    this.time = 0;
    this.wastedTimer = 0;
    this.crimeCooldown = {};
    this.lastPos = this.player.pos.clone();
    this.wheelOpen = false;
    this.headlight = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.6, 1.3);
    this.scene.add(this.headlight, this.headlight.target);
    this.wireEvents();
  }

  // The player's car throws a real light beam down the road at dusk.
  updateHeadlight() {
    const v = this.player.vehicle, h = this.headlight;
    if (!v || v.wrecked || !v.headMeshes.length) { h.intensity = 0; return; }
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    h.position.set(v.pos.x + fx * v.spec.length * 0.5, v.y + 0.75, v.pos.z + fz * v.spec.length * 0.5);
    h.target.position.set(v.pos.x + fx * 22, 0, v.pos.z + fz * 22);
    h.intensity = 160 * (v.headMeshes.length / 2);
  }

  start({ freeRoam = false } = {}) {
    const p = this.player.pos;
    this.traffic.populate(p.x, p.z, this.traffic.target);
    this.peds.populate(p.x, p.z, this.peds.target);
    this.side.placeFixedMarkers();
    this.freeRoam = freeRoam;
    this.missions.refreshStartMarker();
    this.hud.show(true);
    this.cameraRig.yaw = Math.PI * 0.75;
  }

  allCharacters() {
    const list = [this.player.body, ...this.peds.list];
    for (const o of this.police.officers) list.push(o.body);
    for (const e of this.missions.enemies) list.push(e.body);
    for (const e of this.leftoverCombatants) list.push(e.body);
    return list;
  }

  // ---------------------------------------------------------------- events
  crime(kind, x, z, witnessed = true) {
    const now = this.time;
    if (this.crimeCooldown[kind] && now - this.crimeCooldown[kind] < 2.5) return;
    this.crimeCooldown[kind] = now;
    this.wanted.report(kind, x, z, { witnessed });
  }

  policeNear(x, z, r) {
    return this.police.policeCars.some((v) => Math.hypot(v.pos.x - x, v.pos.z - z) < r) ||
      this.police.officers.some((o) => o.alive && Math.hypot(o.body.pos.x - x, o.body.pos.z - z) < r);
  }

  camDist(x, z) { const c = this.gfx.camera.position; return Math.hypot(c.x - x, c.z - z); }

  wireEvents() {
    const P = () => this.player.body;
    events.on('shot-fired', ({ shooter, weapon, x, z }) => {
      this.audio.gunshot(weapon, this.camDist(x, z));
      if (shooter === P()) {
        this.peds.scare(x, z, 45, 2, true);
        this.traffic.panicAround(x, z, 40);
        if (!this.missions.active || this.wanted.level > 0 || this.policeNear(x, z, 60)) this.crime('shots-fired', x, z, this.policeNear(x, z, 80));
      } else this.peds.scare(x, z, 30, 1, false);
    });
    events.on('witness-report', ({ x, z }) => { if (this.wanted.level === 0) this.crime('shots-fired', x, z, false); });
    events.on('character-hit', ({ character, amount, attacker }) => {
      if (character === P()) { this.hud.damageFlash(amount); this.cameraRig.addShake(0.25); }
      if (attacker === P() && character !== P()) {
        this.hud.hitMarker();
        if (character.faction === 'police') this.crime('cop-assault', character.pos.x, character.pos.z);
        else if (character.faction === 'civilian') {
          this.peds.scare(character.pos.x, character.pos.z, 25, 1, true);
          if (this.policeNear(character.pos.x, character.pos.z, 50)) this.crime('assault', character.pos.x, character.pos.z);
        }
      }
    });
    events.on('character-died', ({ character, attacker, cause }) => {
      if (character === P()) { this.onWasted(); return; }
      const byPlayer = attacker === P() || (cause === 'vehicle' && attacker === this.player);
      if (byPlayer) {
        this.progression.stats.kills++;
        if (character.faction === 'police') { this.crime('cop-killed', character.pos.x, character.pos.z); this.progression.addXp(15, 'Polisi'); }
        else if (character.faction === 'gang') this.progression.addXp(25, 'Anggota Hiu Merah');
        else this.crime(cause === 'vehicle' ? 'hit-and-run' : 'murder', character.pos.x, character.pos.z, this.policeNear(character.pos.x, character.pos.z, 60) || rng.chance(0.5));
      }
      if (character.faction !== 'player') {
        const amount = character.faction === 'gang' ? rng.int(8, 25) * 10000 : rng.int(2, 9) * 10000;
        if (rng.chance(character.faction === 'gang' ? 1 : 0.6)) this.markers.addPickup('cash', character.pos.x + 0.5, character.pos.z + 0.3, amount);
        if (character.faction === 'police' && rng.chance(0.4)) this.markers.addPickup('pistol', character.pos.x - 0.5, character.pos.z, 24);
        if (character.faction === 'gang' && rng.chance(0.25)) this.markers.addPickup('armour', character.pos.x - 0.6, character.pos.z - 0.4, 25);
      }
    });
    events.on('vehicle-entered', ({ vehicle, stolen, carjack }) => {
      if (stolen) this.progression.stats.carsStolen++;
      const x = vehicle.pos.x, z = vehicle.pos.z;
      if (vehicle.isPolice) this.crime('car-theft-seen', x, z);
      else if (carjack) {
        this.peds.scare(x, z, 20, 1, false);
        if (this.policeNear(x, z, 70)) this.crime('carjack', x, z);
      }
      if (!this.radio.on && !this.radio.silent) this.radio.setOn(true);
      this.hud.notify(`${vehicle.spec.name}${carjack ? ' — dibajak!' : ''}`);
    });
    events.on('vehicle-exited', () => this.radio.setOn(false));
    events.on('vehicle-collision', ({ a, b, impact, x, z }) => {
      if (this.camDist(x, z) < 80) this.audio.crash(impact);
      this.particles.sparks(x, 0.8, z, Math.min(30, impact * 2), 7);
      const pv = this.player.vehicle;
      if (pv && (a === pv || b === pv)) {
        this.cameraRig.addShake(Math.min(0.8, impact * 0.04));
        const other = a === pv ? b : a;
        if (other.isPolice && impact > 6) this.crime('police-car-damage', x, z);
      }
    });
    events.on('vehicle-damaged', ({ vehicle, cause, at }) => {
      if (cause === 'crash' && at && at.impact > 6) {
        this.particles.sparks(at.x, 0.7, at.z, Math.min(25, at.impact * 1.5), 6);
        if (this.camDist(at.x, at.z) < 80) this.audio.crash(at.impact);
        if (vehicle === this.player.vehicle) this.cameraRig.addShake(Math.min(0.7, at.impact * 0.04));
      }
    });
    events.on('vehicle-shot', ({ vehicle, shooter }) => {
      if (shooter === P() && vehicle.isPolice) this.crime('police-car-damage', vehicle.pos.x, vehicle.pos.z);
      if (vehicle.ai && vehicle.ai.kind === 'traffic') vehicle.ai.panic = 8;
    });
    events.on('explosion', ({ x, y, z, power }) => {
      this.particles.explosion(x, y, z, power);
      this.lights.flash(x, y + 2, z, 0xff8a3a, 160, 0.9, 50);
      this.audio.explosion(this.camDist(x, z));
      const d = this.camDist(x, z);
      this.cameraRig.addShake(Math.max(0, 1.1 - d / 60));
      for (const ch of this.allCharacters()) {
        const cd = Math.hypot(ch.pos.x - x, ch.pos.z - z);
        if (cd < 9 && ch.alive && !ch.vehicle) ch.hit((9 - cd) * 22, { x, z }, { knockback: 12, cause: 'explosion' });
      }
      for (const v of this.vehicles.list) {
        const vd = Math.hypot(v.pos.x - x, v.pos.z - z);
        if (vd > 0.5 && vd < 8 && !v.wrecked) { v.damage((8 - vd) * 60, 'explosion'); v.vel.x += (v.pos.x - x) / vd * 6; v.vel.z += (v.pos.z - z) / vd * 6; }
      }
      this.peds.scare(x, z, 60, 2, false);
      if (Math.hypot(this.player.pos.x - x, this.player.pos.z - z) < 40 && this.policeNear(x, z, 120)) this.crime('explosion', x, z);
    });
    events.on('wanted-changed', ({ level, prev, reason }) => {
      this.audio.wantedSting(level > prev);
      this.progression.stats.maxWanted = Math.max(this.progression.stats.maxWanted, level);
      if (level > prev) {
        this.hud.notify(`${'★'.repeat(level)}  ${reason || 'Polisi mencarimu'}`, 'police');
        const chatter = ['Unit patroli, tersangka laki-laki, jaket merah marun.', 'Semua unit merapat, tersangka bersenjata!', 'Elang-1 mengudara, lampu sorot menyala.', 'Pasang penghadang di jalan utama!', 'Unit Taktis diberangkatkan. Ulangi, Unit Taktis!'];
        if (level >= 1) this.dialogue.say('radio', chatter[level - 1]);
      } else if (level === 0) {
        this.hud.notify(reason === 'paint' ? 'Polisi kehilangan jejak (cat baru)' : 'Kamu lolos dari kejaran polisi', 'xp');
        if (reason === 'escaped') this.progression.addXp(20 * prev, 'Lolos dari polisi');
      }
    });
    events.on('mission-complete', () => { this.audio.missionJingle(true); this.saveGame('Autosave'); });
    events.on('mission-failed', () => this.audio.missionJingle(false));
    events.on('pickup', (p) => {
      this.audio.pickup();
      const b = this.player.body;
      if (p.type === 'cash') this.progression.addMoney(p.amount || 50000, 'Uang tercecer');
      else if (p.type === 'health') b.health = Math.min(b.maxHealth, b.health + 60);
      else if (p.type === 'armour') b.armour = Math.min(100, b.armour + (p.amount || 50));
      else if (WEAPONS[p.type]) { this.player.arsenal.give(p.type, p.amount || WEAPONS[p.type].mag * 2); this.hud.notify(`${WEAPONS[p.type].name} +${p.amount || WEAPONS[p.type].mag * 2} peluru`); }
      else if (p.type === 'ledger') this.hud.notify('Buku besar Juragan Rusdi diambil');
    });
    events.on('money-changed', ({ amount, reason }) => { if (Math.abs(amount) >= 50000) this.hud.notify(`${amount > 0 ? '+' : '−'}${formatRupiah(Math.abs(amount))}${reason ? ' · ' + reason : ''}`, amount > 0 ? 'xp' : 'bad'); });
    events.on('xp-gained', ({ amount, reason }) => { if (amount >= 40) this.hud.notify(`+${amount} RESPEK · ${reason}`, 'xp'); });
    events.on('rank-up', ({ rank }) => { this.hud.activityResult(true, 'NAIK PERINGKAT', `${rank.name}${rank.perk ? ' — ' + rank.perk : ''}`); this.audio.missionJingle(true); });
    events.on('dialogue-line', (l) => this.audio.voiceBlip(l.speaker.length));
    events.on('punch', () => this.audio.whoosh());
    events.on('punch-hit', () => { this.audio.punch(); this.cameraRig.addShake(0.15); });
    events.on('reload', () => this.audio.reload());
    events.on('checkpoint', () => this.audio.checkpoint());
    events.on('horn', () => this.audio.horn());
    events.on('notify', ({ text, kind }) => this.hud.notify(text, kind));
    events.on('crew-unlocked', ({ crew }) => this.hud.notify(`Kru baru: ${crew.name} — [${crew.label}] ${crew.ability}`, 'xp'));
    events.on('weapon-unlocked', ({ id }) => this.hud.notify(`Senjata baru: ${WEAPONS[id].name} [${WEAPONS[id].slot}]`, 'xp'));
    events.on('weapon-switch', () => this.audio.uiBlip());
  }

  // A carjacked driver is pulled out and runs.
  ejectDriver(v, player) {
    this.vehicles.removeDriverModel(v);
    const look = { shirt: 0xe8e2d4, pants: 0x2a2e3a, skin: 0xa8744e };
    const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    const ped = new Character(look, v.pos.x + rx * 2.2, v.pos.z + rz * 2.2, { health: 60 });
    ped.knock = 0.9;
    this.peds.adopt(ped, { x: player.pos.x, z: player.pos.z });
  }

  onWasted() {
    this.wastedTimer = 4.5;
    this.audio.missionJingle(false);
    if (this.player.vehicle) this.player.exitVehicle(this, true);
  }

  // Standing still on foot next to an officer while wanted ends in an arrest.
  checkBusted(dt) {
    const b = this.player.body;
    if (this.wastedTimer > 0 || !b.alive || this.player.vehicle || this.wanted.level === 0) { this.bustT = 0; return; }
    const cop = this.police.officers.some((o) => o.alive && Math.hypot(o.body.pos.x - b.pos.x, o.body.pos.z - b.pos.z) < 2.2);
    const still = Math.hypot(b.vel.x, b.vel.z) < 1.2 || b.knock > 0;
    this.bustT = cop && still ? (this.bustT || 0) + dt : 0;
    if (this.bustT > 1.6) {
      this.busted = true;
      this.wastedTimer = 4;
      this.audio.missionJingle(false);
      if (this.missions.active) this.missions.fail('Raka ditangkap polisi');
      for (const id of ['pistol', 'smg', 'shotgun']) this.player.arsenal.ammo[id] = Math.floor((this.player.arsenal.ammo[id] || 0) / 2);
    }
  }

  respawn(place = HOSPITAL) {
    const b = this.player.body;
    b.alive = true; b.health = b.maxHealth; b.state = 'idle'; b.knock = 0; b.fallT = 0;
    b.pos.set(place.x, 0.16, place.z);
    b.mesh.rotation.set(0, 0, 0);
    const fee = Math.min(this.progression.money, Math.max(100000, Math.round(this.progression.money * 0.08 / 1000) * 1000));
    this.progression.addMoney(-fee, this.busted ? `Denda ${place.name}` : place.name);
    this.busted = false;
    this.wanted.minLevel = 0;
    this.wanted.clear('hospital');
    this.police.clearAll();
    this.cameraRig.current.set(0, 0, 0);
  }

  saveGame(label) {
    if (writeSave(this, label)) this.hud.notify(`Permainan tersimpan · ${label}`, 'xp');
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    const input = this.input, player = this.player;
    const camDir = this.cameraRig.forward;

    if (input.hit('KeyR') && player.vehicle) {
      const st = this.radio.next();
      this.hud.notify(st ? `📻 ${st.name}` : 'Radio dimatikan');
    }
    // Weapon wheel on Tab.
    const tab = input.down('Tab') && !player.vehicle;
    if (tab) {
      this.wheelAngle = (this.wheelAngle || 0);
      if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 2) this.wheelAngle = Math.atan2(input.mouseDY, input.mouseDX);
      const slot = ((Math.round((this.wheelAngle + Math.PI / 2) / (Math.PI / 2)) % 4) + 4) % 4;
      const id = ['fists', 'pistol', 'smg', 'shotgun'][slot];
      if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 2) player.arsenal.select(id);
      input.mouseDX = 0; input.mouseDY = 0;
    }
    this.hud.showWeaponWheel(tab, [...player.arsenal.owned], player.arsenal.current);

    if (this.wastedTimer > 0) {
      this.wastedTimer -= dt;
      if (this.wastedTimer <= 0) this.respawn(this.busted ? POLICE_STATION : HOSPITAL);
    }
    this.checkBusted(dt);
    if (this.busted) { player.body.anim = 'cower'; player.body.aiming = false; player.body.move(dt, this.world, 0, 0); player.body.updateVisual(dt); }
    else player.update(dt, input, this);
    this.crew.update(dt, input);
    this.traffic.update(dt, player, camDir);
    this.vehicles.update(dt);
    this.peds.update(dt, player, this.vehicles);
    this.police.update(dt, player, camDir);
    this.missions.update(dt);
    this.side.update(dt);
    for (const c of [...this.leftoverCombatants]) {
      c.update(dt, this, null);
      if (Math.hypot(c.body.pos.x - player.pos.x, c.body.pos.z - player.pos.z) > 140) { this.scene.remove(c.body.mesh); this.leftoverCombatants.splice(this.leftoverCombatants.indexOf(c), 1); }
    }
    this.markers.update(dt, player);
    this.dialogue.update(dt);
    this.updateVehicleEffects(dt);
    this.particles.update(dt);
    this.lights.update(dt);
    this.lights.updateSirens(this.police.policeCars, this.gfx.camera.position, this.time);
    this.sea.update(this.time);
    this.cameraRig.update(dt, player, input);
    this.updateHeadlight();
    this.gfx.lighting.follow(player.pos.x, player.pos.z);
    this.updateAudio(dt);
    this.progression.stats.distance += this.lastPos.distanceTo(player.pos) < 20 ? this.lastPos.distanceTo(player.pos) : 0;
    this.lastPos.copy(player.pos);
    this.progression.stats.playTime += dt;
  }

  updateVehicleEffects(dt) {
    for (const v of this.vehicles.list) {
      if (this.camDist(v.pos.x, v.pos.z) > 160) continue;
      const frac = v.health / v.spec.health;
      const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
      const hx = v.pos.x + fx * v.spec.length * 0.38, hz = v.pos.z + fz * v.spec.length * 0.38;
      if (v.wrecked) {
        if (v.burnTimer < 25 && rng.chance(0.7)) { this.particles.fire(v.pos.x, 1.0, v.pos.z, 1.4); this.particles.engineSmoke(v.pos.x, 1.8, v.pos.z, true); }
        continue;
      }
      if (frac < 0.45 && rng.chance(frac < 0.25 ? 0.6 : 0.25)) this.particles.engineSmoke(hx, 1.0, hz, frac < 0.25);
      if (frac < 0.2) {
        if (rng.chance(0.5)) this.particles.fire(hx, 0.9, hz, 0.7);
        v.health -= v.spec.health * 0.04 * dt;
        if (v.health <= 0) v.explode();
      }
      if (v.drifting || (v.braking && Math.abs(v.speed) > 14 && v.controls.handbrake)) {
        const bx = v.pos.x - fx * v.spec.length * 0.35, bz = v.pos.z - fz * v.spec.length * 0.35;
        if (rng.chance(0.7)) this.particles.tyreSmoke(bx, bz, 1);
      }
    }
  }

  updateAudio(dt) {
    const a = this.audio;
    const pv = this.player.vehicle;
    a.updateEngine(pv);
    let nearest = Infinity;
    for (const v of this.police.policeCars) if (v.sirenOn) nearest = Math.min(nearest, this.camDist(v.pos.x, v.pos.z));
    a.updateSiren(dt, nearest);
    a.updateRotor(this.police.heliActive ? this.camDist(this.police.heli.pos.x, this.police.heli.pos.z) : Infinity);
    this.radio.update(dt);
  }

  // Everything the HUD shows this frame.
  hudState() {
    const p = this.player, b = p.body, a = p.arsenal;
    const v = p.vehicle;
    let hint = null;
    if (!v && b.alive) {
      const near = this.vehicles.nearest(b.pos.x, b.pos.z, 4.2, (c) => !c.wrecked);
      if (near) hint = `<kbd>F</kbd>${near.driverModel ? 'Bajak' : 'Masuk'} ${near.spec.name}`;
    } else if (v) hint = null;
    let activity = null;
    if (this.side.mode === 'race') activity = `<b>BALAP LIAR SENJA</b><br>Gerbang ${this.side.cp + 1}/${this.side.routeLength} · rekor ${this.side.record} dtk · ${this.side.time.toFixed(1)} dtk`;
    if (this.side.mode === 'delivery') activity = `<b>ANTAR MARTABAK</b><br>Antaran ${this.side.delivered + 1}/3 · sisa ${Math.ceil(this.side.time)} dtk`;
    const sp = v ? Math.abs(v.speed) * 3.6 : 0;
    return {
      wanted: this.wanted.level, wantedBlink: this.wanted.blinking,
      money: this.progression.money, rank: this.progression.rank.name, xp: this.progression.xp, rankProgress: this.progression.rankProgress,
      weapon: a.current, mag: a.mag[a.current] ?? 0, reserve: a.ammo[a.current] ?? 0, reloading: a.reloading > 0, owned: [...a.owned],
      crew: this.crew.hudState(),
      mission: this.missions.panelState(),
      police: this.wanted.level > 0 ? this.police.hudList(p) : [],
      px: b.pos.x, pz: b.pos.z,
      dialogue: this.dialogue.line,
      vehicle: v ? {
        name: v.spec.name, kmh: sp, maxKmh: v.spec.maxSpeed * 3.6, condition: v.health / v.spec.health, drifting: v.drifting,
        gear: v.speed < -0.5 ? 'R' : sp < 2 ? 'N' : String(Math.min(5, 1 + Math.floor(sp / (v.spec.maxSpeed * 3.6 / 5)))),
      } : null,
      radio: v && this.radio.on && !this.radio.silent ? { name: this.radio.station.name, song: this.radio.songTitle, dj: this.radio.station.dj } : null,
      health: b.health / b.maxHealth, armour: b.armour / 100,
      aiming: b.aiming && !v, aimTarget: false,
      hint, activity,
      wasted: this.wastedTimer > 0 ? (this.busted ? 'TERTANGKAP' : 'TUMBANG') : null,
    };
  }

  minimapState() {
    const p = this.player;
    const acts = [
      { ...PLACES.raceStart, color: '#40ffc0', name: 'Balap' }, { ...PLACES.deliveryDepot, color: '#ff8040', name: 'Antar' },
      { ...PLACES.paintShop, color: '#8080ff', name: 'Bengkel Cat' }, { ...PLACES.gunShop, color: '#ff4040', name: 'Toko Besi' },
      { ...PLACES.safehouse, color: '#60ff80', name: 'Simpan' }, { ...HOSPITAL, color: '#ffffff', name: 'RS' },
    ];
    const enemies = this.missions.enemies.filter((e) => e.alive).map((e) => ({ x: e.body.pos.x, z: e.body.pos.z }));
    return {
      px: p.pos.x, pz: p.pos.z, yaw: this.cameraRig.yaw, heading: p.vehicle ? p.vehicle.heading : p.body.heading,
      speed: p.vehicle ? Math.abs(p.vehicle.speed) : 0,
      police: this.police.policeCars.filter((v) => !v.wrecked).map((v) => ({ x: v.pos.x, z: v.pos.z })).concat(this.police.officers.filter((o) => o.alive).map((o) => ({ x: o.body.pos.x, z: o.body.pos.z }))),
      heli: this.police.heliActive ? { x: this.police.heli.pos.x, z: this.police.heli.pos.z } : null,
      enemies, activities: acts,
      objective: this.missions.objectivePoint() || (this.side.markers[0] ? { x: this.side.markers[0].x, z: this.side.markers[0].z, kind: 'objective' } : null),
      searchZone: this.wanted.level > 0 && this.wanted.unseen > 2 ? { x: this.wanted.lastKnown.x, z: this.wanted.lastKnown.z, r: this.wanted.searchRadius } : null,
    };
  }
}

