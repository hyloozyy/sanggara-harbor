// How the systems react to each other: gunfire scares people and calls the police, hits and
// deaths become crimes, rewards and loot, crashes make sparks and noise, explosions hurt
// everything nearby, the wanted level drives radio chatter, and pickups pay out.
import { WEAPONS } from './combat/weapon-catalog.js';
import { formatMoney } from './core/math-utils.js';
import { rng } from './core/rng.js';
import { events } from './core/event-bus.js';
import { townspersonName } from './missions/conversations.js';
import { voiceProfile } from './audio/voice-actor.js';

// Name, voice and mouth for a townsperson who shouts a line.
function townsperson(c) {
  if (!c?.model?.look) return {};
  const look = c.model.look;
  c.talkName ||= townspersonName(look);
  return { name: c.talkName, character: c, profile: voiceProfile(look.gender, look.age, look.seed || c.id) };
}

export function wireGameEvents(game) {
  const self = game;

  const P = () => self.player.body;
  events.on('shot-fired', ({ shooter, weapon, x, z }) => {
    self.sound.gunshot(WEAPONS[weapon]?.sound || weapon, x, 1.4, z);
    if (weapon !== 'revolver' && shooter && self.camDist(x, z) < 45) self.weaponFx.eject(shooter, weapon === 'rifle' || weapon === 'sniper' || weapon === 'shotgun');
    if (shooter === P()) {
      self.peds.scare(x, z, 45, 2, true);
      self.traffic.panicAround(x, z, 40);
      if (!self.missions.active || self.wanted.level > 0 || self.policeNear(x, z, 60)) self.crime('shots-fired', x, z, self.policeNear(x, z, 80));
    } else self.peds.scare(x, z, 30, 1, false);
  });
  events.on('witness-report', ({ x, z }) => { if (self.wanted.level === 0) self.crime('shots-fired', x, z, false); });
  events.on('character-hit', ({ character, amount, attacker }) => {
    if (character === P()) { self.hud.damageFlash(amount); self.cameraRig.addShake(0.25); }
    if (attacker === P() && character !== P()) {
      self.hud.hitMarker();
      if (character.faction === 'civilian' && character.alive && rng.chance(0.3)) self.dialogue.say('warga', rng.pick(['Ow! Why me?!', 'Mercy, mister!', 'Help! There is a maniac!']), townsperson(character));
      if (character.faction === 'police') self.crime('cop-assault', character.pos.x, character.pos.z);
      else if (character.faction === 'civilian') {
        self.peds.scare(character.pos.x, character.pos.z, 25, 1, true);
        if (self.policeNear(character.pos.x, character.pos.z, 50)) self.crime('assault', character.pos.x, character.pos.z);
      }
    }
  });
  events.on('character-died', ({ character, attacker, cause }) => {
    if (character === P()) { self.onWasted(); return; }
    const byPlayer = attacker === P() || (cause === 'vehicle' && attacker === self.player);
    if (byPlayer) {
      self.progression.stats.kills++;
      if (character.faction === 'police') { self.crime('cop-killed', character.pos.x, character.pos.z); self.progression.addXp(15, 'Police'); }
      else if (character.faction === 'gang') self.progression.addXp(25, 'Hiu Merah member');
      else self.crime(cause === 'vehicle' ? 'hit-and-run' : 'murder', character.pos.x, character.pos.z, self.policeNear(character.pos.x, character.pos.z, 60) || rng.chance(0.5));
    }
    if (character.faction !== 'player') {
      const amount = character.faction === 'gang' ? rng.int(8, 25) * 10 : rng.int(2, 9) * 10;
      if (rng.chance(character.faction === 'gang' ? 1 : 0.6)) self.markers.addPickup('cash', character.pos.x + 0.5, character.pos.z + 0.3, amount);
      if (character.faction === 'police' && rng.chance(0.4)) self.markers.addPickup('pistol', character.pos.x - 0.5, character.pos.z, 24);
      if (character.faction === 'gang' && rng.chance(0.25)) self.markers.addPickup('armour', character.pos.x - 0.6, character.pos.z - 0.4, 25);
    }
  });
  events.on('vehicle-entered', ({ vehicle, stolen, carjack }) => {
    if (stolen) self.progression.stats.carsStolen++;
    const x = vehicle.pos.x, z = vehicle.pos.z;
    if (vehicle.isPolice) self.crime('car-theft-seen', x, z);
    else if (carjack) {
      self.peds.scare(x, z, 20, 1, false);
      const victim = self.peds.list.filter((p) => p.alive && p.model?.look).sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z))[0];
      self.dialogue.say('warga', rng.pick(['Help! Thief! He took my car!', 'Hey! That is my car!', 'Carjacking! Call the police!']), victim && Math.hypot(victim.pos.x - x, victim.pos.z - z) < 12 ? townsperson(victim) : {});
      if (self.policeNear(x, z, 70)) self.crime('carjack', x, z);
      // Someone on the pavement phones it in a moment later.
      else if (rng.chance(0.45)) setTimeout(() => { if (self.wanted.level === 0) self.crime('carjack', x, z, false); }, 3000);
    }
    if (!self.radio.on && !self.radio.silent) self.radio.setOn(true);
    self.hud.notify(`${vehicle.spec.name}${carjack ? ' — carjacked!' : ''}`);
  });
  events.on('vehicle-exited', ({ vehicle }) => {
    self.radio.setOn(false);
    if (!vehicle.spec.twoWheel && vehicle.spec.body !== 'bajaj') { self.sound.door(vehicle.pos.x, 1, vehicle.pos.z, true); setTimeout(() => self.sound.door(vehicle.pos.x, 1, vehicle.pos.z, false), 550); }
  });
  events.on('vehicle-entered', ({ vehicle }) => {
    if (!vehicle.spec.twoWheel && vehicle.spec.body !== 'bajaj') { self.sound.door(vehicle.pos.x, 1, vehicle.pos.z, true); setTimeout(() => self.sound.door(vehicle.pos.x, 1, vehicle.pos.z, false), 700); }
  });
  events.on('bullet-impact', ({ x, y, z, surface }) => { self.sound.impact(surface, x, y, z); if (surface === 'ground') self.weaponFx.mark(x, y, z); });
  events.on('character-hit', ({ character, amount, cause }) => {
    if (amount > 8 && character.alive !== false && Math.random() < 0.7) self.sound.grunt(character.pos.x, character.pos.y + 1.6, character.pos.z, { female: character.model?.look?.gender === 'f', pain: Math.min(1.3, 0.6 + amount / 60) });
    void cause;
  });
  events.on('mission-started', () => self.sound.missionStart());
  events.on('vehicle-collision', ({ a, b, impact, x, z }) => {
    self.sound.crash(impact, x, 0.8, z);
    self.particles.sparks(x, 0.8, z, Math.min(30, impact * 2), 7);
    const pv = self.player.vehicle;
    if (pv && (a === pv || b === pv)) {
      self.cameraRig.addShake(Math.min(0.8, impact * 0.04));
      const other = a === pv ? b : a;
      if (other.isPolice && impact > 6) self.crime('police-car-damage', x, z);
    }
  });
  events.on('vehicle-damaged', ({ vehicle, cause, at }) => {
    if (cause === 'crash' && at && at.impact > 6) {
      self.particles.sparks(at.x, 0.7, at.z, Math.min(25, at.impact * 1.5), 6);
      self.sound.crash(at.impact, at.x, 0.8, at.z);
      if (vehicle === self.player.vehicle) self.cameraRig.addShake(Math.min(0.7, at.impact * 0.04));
    }
  });
  events.on('vehicle-shot', ({ vehicle, shooter }) => {
    if (shooter === P() && vehicle.isPolice) self.crime('police-car-damage', vehicle.pos.x, vehicle.pos.z);
    if (vehicle.ai && vehicle.ai.kind === 'traffic') vehicle.ai.panic = 8;
  });
  events.on('explosion', ({ x, y, z, power }) => {
    self.particles.explosion(x, y, z, power);
    self.lights.flash(x, y + 2, z, 0xff8a3a, 160, 0.9, 50);
    self.sound.explosion(x, y, z);
    const d = self.camDist(x, z);
    self.cameraRig.addShake(Math.max(0, 1.1 - d / 60));
    for (const ch of self.allCharacters()) {
      const cd = Math.hypot(ch.pos.x - x, ch.pos.z - z);
      if (cd < 9 && ch.alive && !ch.vehicle) ch.hit((9 - cd) * 22, { x, z }, { knockback: 12, cause: 'explosion' });
    }
    for (const v of self.vehicles.list) {
      const vd = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (vd > 0.5 && vd < 8 && !v.wrecked) { v.damage((8 - vd) * 60, 'explosion'); v.vel.x += (v.pos.x - x) / vd * 6; v.vel.z += (v.pos.z - z) / vd * 6; }
    }
    self.peds.scare(x, z, 60, 2, false);
    if (Math.hypot(self.player.pos.x - x, self.player.pos.z - z) < 40 && self.policeNear(x, z, 120)) self.crime('explosion', x, z);
  });
  events.on('wanted-changed', ({ level, prev, reason }) => {
    self.audio.wantedSting(level > prev);
    self.progression.stats.maxWanted = Math.max(self.progression.stats.maxWanted, level);
    if (level > prev) {
      self.hud.wantedUp(level, reason || 'The police want you');
      const chatter = ['Patrol units, male suspect, maroon jacket.', 'All units close in, suspect is armed!', 'Elang-1 airborne, searchlight on.', 'Set up roadblocks on the main roads!', 'Tactical Unit dispatched. Repeat, Tactical Unit!'];
      if (level >= 1) self.dialogue.say('radio', chatter[level - 1]);
    } else if (level === 0 && reason !== 'busted' && reason !== 'hospital') {
      self.hud.notify(reason === 'paint' ? 'Police lost your trail (fresh paint)' : 'You lost the police', 'xp');
      if (reason === 'escaped') self.progression.addXp(20 * prev, 'Escaped the police');
    }
  });
  events.on('mission-complete', () => { self.audio.missionJingle(true); self.saveGame('Autosave'); });
  events.on('mission-failed', () => self.audio.missionJingle(false));
  events.on('pickup', (p) => {
    self.audio.pickup();
    if (!self.player.vehicle) self.player.pickT = 1;
    const b = self.player.body;
    if (p.type === 'cash') self.progression.addMoney(p.amount || 50, 'Dropped cash');
    else if (p.type === 'health') b.health = Math.min(b.maxHealth, b.health + 60);
    else if (p.type === 'armour') b.armour = Math.min(100, b.armour + (p.amount || 50));
    else if (WEAPONS[p.type]) { self.player.arsenal.give(p.type, p.amount || WEAPONS[p.type].mag * 2); self.hud.notify(`${WEAPONS[p.type].name} +${p.amount || WEAPONS[p.type].mag * 2} ammo`); }
    else if (p.type === 'ledger') self.hud.notify("Juragan Rusdi's ledger taken");
  });
  events.on('money-changed', ({ amount, reason }) => {
    if (amount > 0) self.sound.money(); if (Math.abs(amount) >= 50) self.hud.notify(`${amount > 0 ? '+' : '−'}${formatMoney(Math.abs(amount))}${reason ? ' · ' + reason : ''}`, amount > 0 ? 'xp' : 'bad'); });
  events.on('xp-gained', ({ amount, reason }) => { if (amount >= 40) self.hud.notify(`+${amount} RESPECT · ${reason}`, 'xp'); });
  events.on('rank-up', ({ rank }) => { self.hud.activityResult(true, 'RANK UP', `${rank.name}${rank.perk ? ' — ' + rank.perk : ''}`); self.audio.missionJingle(true); });
  events.on('punch', ({ shooter }) => self.sound.swing(shooter.pos.x, shooter.pos.y + 1.3, shooter.pos.z));
  events.on('punch-hit', ({ target }) => { const p = target?.pos || P().pos; self.sound.punch(p.x, p.y + 1.3, p.z); self.cameraRig.addShake(0.15); });
  events.on('reload', ({ weapon }) => self.sound.reload(weapon));
  events.on('checkpoint', () => self.audio.checkpoint());
  events.on('horn', ({ vehicle }) => self.sound.horn(vehicle));
  events.on('notify', ({ text, kind }) => self.hud.notify(text, kind));
  events.on('crew-unlocked', ({ crew }) => self.hud.notify(`New crew: ${crew.name} — [${crew.label}] ${crew.ability}`, 'xp'));
  events.on('weapon-unlocked', ({ id }) => self.hud.notify(`New weapon: ${WEAPONS[id].name} [${WEAPONS[id].slot}]`, 'xp'));
  events.on('weapon-switch', () => self.audio.uiBlip());
  }
