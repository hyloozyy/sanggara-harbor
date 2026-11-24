// Gathers, once per frame, everything the HUD and the minimap draw: wanted level, money and rank,
// weapon and ammo, mission panel, police units, vehicle gauges, radio, hints and blips.
import { PLACES } from '../city/city-layout.js';

export function buildHudState(game, HOSPITAL) {
const self = game;
  const p = self.player, b = p.body, a = p.arsenal;
  const v = p.vehicle;
  let hint = null;
  if (!v && b.alive) {
    const near = self.vehicles.nearest(b.pos.x, b.pos.z, 4.2, (c) => !c.wrecked);
    if (near) hint = `<kbd>F</kbd>${near.driverModel ? 'Carjack' : 'Enter'} ${near.spec.name}`;
  } else if (v) hint = null;
  const next = self.missions.nextMission;
  if (!self.missions.active && next && Math.hypot(b.pos.x - next.start.x, b.pos.z - next.start.z) < 10) {
    hint = `<kbd>${next.chapter}</kbd>${next.title} — step into the yellow circle`;
  }
  let aimTarget = false;
  if (b.aiming && !v) {
    const { origin, dir } = self.cameraRig.aimRay();
    const hit = self.weapons.trace(b, origin, dir.x, dir.y, dir.z, 90);
    aimTarget = !!(hit.character && hit.character.faction !== 'civilian');
  }
  let activity = null;
  if (self.side.mode === 'race') activity = `<b>SUNSET STREET RACE</b><br>Gate ${self.side.cp + 1}/${self.side.routeLength} · record ${self.side.record} s · ${self.side.time.toFixed(1)} s`;
  if (self.side.mode === 'delivery') activity = `<b>MARTABAK DELIVERY</b><br>Drop ${self.side.delivered + 1}/3 · ${Math.ceil(self.side.time)} s left`;
  if (!activity) activity = self.angkotJob.hudLine();
  const sp = v ? Math.abs(v.speed) * 3.6 : 0;
  return {
    wanted: self.wanted.level, wantedBlink: self.wanted.blinking,
    money: self.progression.money, rank: self.progression.rank.name, xp: self.progression.xp, rankProgress: self.progression.rankProgress,
    weapon: a.current, mag: a.mag[a.current] ?? 0, reserve: a.ammo[a.current] ?? 0, reloading: a.reloading > 0, owned: [...a.owned],
    crew: self.crew.hudState(),
    mission: self.missions.panelState(),
    police: self.wanted.level > 0 ? self.police.hudList(p) : [],
    px: b.pos.x, pz: b.pos.z,
    dialogue: self.dialogue.line,
    vehicle: v ? {
      name: v.spec.name, kmh: sp, maxKmh: v.spec.maxSpeed * 3.6, condition: v.health / v.spec.health, drifting: v.drifting,
      gear: v.speed < -0.5 ? 'R' : sp < 2 ? 'N' : String(Math.min(5, 1 + Math.floor(sp / (v.spec.maxSpeed * 3.6 / 5)))),
    } : null,
    radio: v && self.radio.on && !self.radio.silent ? { name: self.radio.station.name, song: self.radio.songTitle, dj: self.radio.station.dj } : null,
    health: b.health / b.maxHealth, armour: b.armour / 100,
    aiming: b.aiming && !v, aimTarget,
    hint, activity,
    wasted: self.wastedTimer > 0 ? (self.busted ? 'BUSTED' : 'WASTED') : null,
  };
}

export function buildMinimapState(game, HOSPITAL) {
const self = game;
  const p = self.player;
  const acts = [
    { ...PLACES.raceStart, color: '#40ffc0', name: 'Race', icon: 'R' }, { ...PLACES.deliveryDepot, color: '#ff8040', name: 'Delivery', icon: 'D' },
    { ...PLACES.paintShop, color: '#8080ff', name: 'Paint Shop', icon: 'P' }, { ...PLACES.gunShop, color: '#ff4040', name: 'Gun Shop', icon: 'G' },
    { ...PLACES.safehouse, color: '#60ff80', name: 'Safehouse', icon: 'S' }, { ...HOSPITAL, color: '#ffffff', name: 'Hospital', icon: '+' },
  ];
  const enemies = [...self.missions.enemies, ...self.worldEvents.gang].filter((e) => e.alive).map((e) => ({ x: e.body.pos.x, z: e.body.pos.z }));
  return {
    px: p.pos.x, pz: p.pos.z, yaw: self.cameraRig.yaw, heading: p.vehicle ? p.vehicle.heading : p.body.heading,
    speed: p.vehicle ? Math.abs(p.vehicle.speed) : 0,
    police: self.police.policeCars.filter((v) => !v.wrecked).map((v) => ({ x: v.pos.x, z: v.pos.z })).concat(self.police.officers.filter((o) => o.alive).map((o) => ({ x: o.body.pos.x, z: o.body.pos.z }))),
    heli: self.police.heliActive ? { x: self.police.heli.pos.x, z: self.police.heli.pos.z } : null,
    enemies, activities: acts,
    objective: self.missions.objectivePoint(self.angkotJob.objective()) || (self.side.markers[0] ? { x: self.side.markers[0].x, z: self.side.markers[0].z, kind: 'objective' } : null),
    searchZone: self.wanted.level > 0 && self.wanted.unseen > 2 ? { x: self.wanted.lastKnown.x, z: self.wanted.lastKnown.z, r: self.wanted.searchRadius } : null,
  };
}
