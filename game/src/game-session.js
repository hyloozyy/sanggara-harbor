// One play session: builds the world and every system, wires their events together (crimes,
// sounds, rewards, deaths), runs the per-frame update and feeds the HUD and minimap.
import * as THREE from 'three';
import { MissionRunner } from './missions/mission-runner.js';
import { PoliceDispatcher } from './police/police-dispatcher.js';
import { WantedSystem } from './police/wanted-system.js';
import { PlayerController } from './characters/player-controller.js';
import { VehicleManager } from './vehicles/vehicle-manager.js';
import { TrafficSystem } from './vehicles/traffic-system.js';
import { PedestrianSystem } from './characters/pedestrian-system.js';
import { WeaponSystem } from './combat/weapon-system.js';
import { SideActivities } from './missions/side-activities.js';
import { AngkotJob } from './missions/angkot-job.js';
import { WorldEvents } from './missions/world-events.js';
import { CrewAbilities } from './missions/crew-abilities.js';
import { DialogueQueue } from './missions/dialogue-queue.js';
import { Conversations } from './missions/conversations.js';
import { VoiceDirector } from './audio/voice-actor.js';
import { SoundWorld } from './audio/sound-world.js';
import { WeaponFx } from './combat/weapon-fx.js';
import { CAST } from './missions/story-cast.js';
import { Progression } from './world/progression.js';
import { Hud } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { CameraRig } from './camera/camera-rig.js';
import { Character } from './characters/character.js';
import { ParticleSystem } from './effects/particle-system.js';
import { LightFlashes } from './effects/light-flashes.js';
import { WorldMarkers } from './world/world-markers.js';
import { AmbientLife } from './world/ambient-life.js';
import { buildCity } from './city/city-builder.js';
import { assets } from './assets/asset-library.js';
import { writeSave } from './save/save-system.js';
import { PLACES } from './city/city-layout.js';
import { rng } from './core/rng.js';
import { wireGameEvents } from './game-event-wiring.js';
import { WeatherSystem } from './world/weather-system.js';
import { ROAD } from './vehicles/vehicle.js';
import { buildHudState, buildMinimapState } from './ui/hud-state.js';
import { roadRoute, routeLength } from './world/gps-route.js';
import { GUNS, WEAPON_ORDER } from './combat/weapon-catalog.js';
import { InteriorManager } from './interiors/interior-manager.js';
import { SURFACE_WEATHER } from './render/surface-weather.js';

const HOSPITAL = { x: -86.5, z: 40, name: 'Sanggara Sehat Hospital' };
const POLICE_STATION = { x: 86.5, z: 120, name: 'Kota Lama Police Station' };

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
    this.ambient = new AmbientLife(this.scene);
    this.weather = new WeatherSystem(gfx, audio);
    this.weather.attachCity(city.root);
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
    this.voices = new VoiceDirector(audio);
    this.sound = new SoundWorld(audio);
    audio.uiClick = () => this.sound.uiClick();
    this.weaponFx = new WeaponFx(this.scene, this.sound);
    this.dialogue.voices = this.voices;
    this.dialogue.findSpeaker = (key) => this.findSpeaker(key);
    this.dialogue.onSpeaking = (on) => audio.duckMusic?.(on);
    this.hud = new Hud();
    this.minimap = new Minimap(document.getElementById('minimap'), document.getElementById('big-map-canvas'));
    this.leftoverCombatants = [];
    this.weapons = new WeaponSystem({ world: this.world, particles: this.particles, lights: this.lights, vehicles: this.vehicles, getCharacters: () => this.allCharacters() });
    this.police = new PoliceDispatcher(this);
    this.missions = new MissionRunner(this);
    this.side = new SideActivities(this);
    this.crew = new CrewAbilities(this);
    this.worldEvents = new WorldEvents(this);
    this.angkotJob = new AngkotJob(this);
    this.talk = new Conversations(this);
    this.hospital = HOSPITAL;
    this.waypoint = null;
    this.gpsRoute = null;
    this.gpsTimer = 0;
    this.time = 0;
    this.wastedTimer = 0;
    this.crimeCooldown = {};
    this.lastPos = this.player.pos.clone();
    this.wheelOpen = false;
    this.headlight = new THREE.SpotLight(0xfff0d0, 0, 60, 0.5, 0.6, 1.3);
    this.scene.add(this.headlight, this.headlight.target);
    this.interiors = new InteriorManager(this);
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
    this.worldEvents.placeShells();
    this.worldEvents.placeSupplies();
    this.freeRoam = freeRoam;
    this.started = true;
    // Free roam starts a few steps from the first mission's marker instead of inside it.
    if (freeRoam && Math.hypot(p.x - PLACES.station.x, p.z - PLACES.station.z) < 4) p.set(7.5, 0.16, -20);
    this.missions.refreshStartMarker();
    this.hud.show(true);
    this.cameraRig.yaw = Math.PI * 0.75;
  }

  allCharacters() {
    const list = [this.player.body, ...this.peds.list];
    for (const o of this.police.officers) list.push(o.body);
    for (const e of this.missions.enemies) list.push(e.body);
    for (const e of this.leftoverCombatants) list.push(e.body);
    for (const e of this.worldEvents.gang) list.push(e.body);
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

  wireEvents() { wireGameEvents(this); }

  // A carjacked driver is pulled out and runs.
  ejectDriver(v, player) {
    const look = v.driverModel ? v.driverModel.look : { shirt: 0xe8e2d4, pants: 0x2a2e3a, skin: 0xa8744e };
    this.vehicles.removeDriverModel(v);
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
      this.wanted.clear('busted'); // officers lower their weapons
      this.audio.missionJingle(false);
      if (this.missions.active) this.missions.fail('Raka was arrested');
      for (const id of GUNS) this.player.arsenal.ammo[id] = Math.floor((this.player.arsenal.ammo[id] || 0) / 2);
    }
  }

  respawn(place = HOSPITAL) {
    const b = this.player.body;
    b.alive = true; b.health = b.maxHealth; b.state = 'idle'; b.knock = 0; b.fallT = 0;
    b.pos.set(place.x, 0.16, place.z);
    b.mesh.rotation.set(0, 0, 0);
    const fee = Math.min(this.progression.money, Math.max(100, Math.round(this.progression.money * 0.08 / 10) * 10));
    this.progression.addMoney(-fee, this.busted ? `Fine · ${place.name}` : place.name);
    this.busted = false;
    this.wanted.minLevel = 0;
    this.wanted.clear('hospital');
    this.police.clearAll();
    this.cameraRig.current.set(0, 0, 0);
  }

  saveGame(label) {
    if (writeSave(this, label)) this.hud.notify(`Game saved · ${label}`, 'xp');
  }

  // ---------------------------------------------------------------- update
  // GPS route to the player's waypoint (cleared on arrival) or else the current objective.
  updateGps(dt) {
    this.gpsTimer -= dt;
    if (this.gpsTimer > 0) return;
    this.gpsTimer = 0.4;
    const p = this.player.pos;
    if (this.waypoint && Math.hypot(this.waypoint.x - p.x, this.waypoint.z - p.z) < 12) { this.waypoint = null; this.hud.notify('Waypoint reached'); }
    const target = this.waypoint || buildMinimapState(this, HOSPITAL).objective;
    this.gpsRoute = target ? roadRoute(p.x, p.z, target.x, target.z) : null;
    this.gpsDistance = target ? routeLength(p.x, p.z, this.gpsRoute) : 0;
  }

  // The Character in the world who speaks for a cast key (for lip-sync and voice panning).
  findSpeaker(key) {
    if (key === 'raka') return this.player.body;
    const name = CAST[key]?.name;
    if (!name) return null;
    if (this.missions.giverNpc?.name === name) return this.missions.giverNpc;
    for (const c of this.allCharacters()) if (c.name === name) return c;
    return null;
  }

  // Inside a building only the room runs: Raka, its people, the camera, talk and sound.
  updateInside(dt) {
    const I = this.interiors;
    I.updateInside(dt);
    this.talk.update(dt);
    const cam = this.gfx.camera, fw = this.cameraRig.forward;
    this.voices.listener = { x: cam.position.x, z: cam.position.z, yaw: Math.atan2(fw.x, fw.z) };
    for (const v of I.voices) { v.listener = this.voices.listener; v.update(); }
    this.dialogue.update(dt);
    this.cameraRig.update(dt, this.player, this.input);
    this.weather.update(dt, cam);
    SURFACE_WEATHER.uWet.value = 0; SURFACE_WEATHER.uSnow.value = 0;
    this.updateAudio(dt);
    this.progression.stats.playTime += dt;
  }

  update(dt) {
    this.time += dt;
    const input = this.input, player = this.player;
    const camDir = this.cameraRig.forward;
    this.interiors.update(dt);
    if (this.interiors.inside) { this.updateInside(dt); return; }

    if (input.hit('KeyR') && player.vehicle) {
      const st = this.radio.next();
      this.hud.notify(st ? `📻 ${st.name}` : 'Radio off');
    }
    // Weapon wheel on Tab.
    const tab = input.down('Tab') && !player.vehicle;
    if (tab) {
      this.wheelAngle = (this.wheelAngle || 0);
      if (Math.abs(input.mouseDX) + Math.abs(input.mouseDY) > 2) this.wheelAngle = Math.atan2(input.mouseDY, input.mouseDX);
      const n = WEAPON_ORDER.length, step = Math.PI * 2 / n;
      const slot = ((Math.round((this.wheelAngle + Math.PI / 2) / step) % n) + n) % n;
      const id = WEAPON_ORDER[slot];
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
    else if (!this.interiors.trans) player.update(dt, input, this);
    if (!player.vehicle && player.alive && !this.interiors.trans) {
      const { hitSpeed, hitBy } = this.vehicles.pushOut(player.body);
      if (hitSpeed > 5 && player.body.knock <= 0) player.body.hit(hitSpeed * hitSpeed * 0.35, { x: hitBy.pos.x, z: hitBy.pos.z }, { knockback: Math.min(12, hitSpeed * 0.7), cause: 'vehicle' });
    }
    this.crew.update(dt, input);
    this.traffic.update(dt, player, camDir);
    this.vehicles.update(dt);
    this.peds.update(dt, player, this.vehicles, this.weather);
    this.police.update(dt, player, camDir);
    this.missions.update(dt);
    this.side.update(dt);
    this.worldEvents.update(dt);
    this.angkotJob.update(dt);
    for (const c of [...this.leftoverCombatants]) {
      c.update(dt, this, null);
      if (Math.hypot(c.body.pos.x - player.pos.x, c.body.pos.z - player.pos.z) > 140) { this.scene.remove(c.body.mesh); c.body.dispose(); this.leftoverCombatants.splice(this.leftoverCombatants.indexOf(c), 1); }
    }
    this.markers.update(dt, player);
    this.talk.update(dt);
    this.updateGps(dt);
    const cam = this.gfx.camera, fw = this.cameraRig.forward;
    this.voices.listener = { x: cam.position.x, z: cam.position.z, yaw: Math.atan2(fw.x, fw.z) };
    this.dialogue.update(dt);
    this.updateVehicleEffects(dt);
    this.particles.update(dt);
    this.weaponFx.update(dt);
    this.lights.update(dt);
    this.lights.updateSirens(this.police.policeCars, this.gfx.camera.position, this.time);
    this.sea.update(this.time);
    this.ambient.update(this.time);
    this.cameraRig.update(dt, player, input);
    this.updateHeadlight();
    this.weather.update(dt, this.gfx.camera);
    ROAD.grip = this.weather.grip;
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
    const pv = this.player.vehicle, snd = this.sound, b = this.player.body;
    const inside = this.interiors.inside;
    snd.setListener(this.gfx.camera, this.cameraRig.forward, dt);
    snd.room = inside ? this.interiors.active.audioState : null;
    if (inside) snd.updateVehicles(dt, null, [], [], null);
    else snd.updateVehicles(dt, pv, this.vehicles.list, this.police.policeCars, this.police.heliActive ? this.police.heli : null);
    const w = this.weather;
    snd.updateAmbience(dt, { x: b.pos.x, z: b.pos.z, night: w.clock.night ?? 0, rain: w.cur.rain, inCar: !!pv && !pv.spec.twoWheel, inCarRain: w.cur.rain });
    // Footsteps: one per stride, by surface and wetness.
    if (!pv && b.alive && b.grounded && b.knock <= 0 && !inside && !this.interiors.trans) {
      const sp = Math.hypot(b.vel.x, b.vel.z);
      this.strideDist = (this.strideDist || 0) + sp * dt;
      const stride = sp > 4 ? 1.25 : 0.78;
      if (sp > 0.6 && this.strideDist > stride) { this.strideDist = 0; snd.footstep(b.pos.x, b.pos.z, { running: sp > 4, wet: w.wetness }); }
    }
    this.radio.update(dt);
  }

  // Everything the HUD and the minimap show this frame.
  hudState() { return buildHudState(this, HOSPITAL); }
  minimapState() { return buildMinimapState(this, HOSPITAL); }
}

