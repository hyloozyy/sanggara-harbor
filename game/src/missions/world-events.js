// Open-world happenings outside the story: Hiu Merah gunmen ambush Raka on their turf in the
// industrial district, and twelve hidden golden shells (Kerang Emas) reward exploration.
import { Combatant, GANG_LOOKS } from '../combat/combatant-ai.js';
import { MARKER_COLORS } from '../world/world-markers.js';
import { SKIN_TONES } from '../characters/humanoid-model.js';
import { districtAt } from '../city/city-layout.js';
import { rng } from '../core/rng.js';
import { events } from '../core/event-bus.js';

export const SHELL_SPOTS = [
  [-205, 360], [-120, 205], [36, -300], [352, 312], [-300, -300], [120, 120], [-40, -200], [260, -250],
  [200, 300], [-260, 60], [0, 250], [300, 20],
];

// Medical kits and body armour in alleys and on rooftops' doorsteps; they come back after a minute.
const SUPPLIES = [['health', -86.5, 46], ['health', 166.5, -40], ['health', -166.5, 160], ['health', 86.5, 246], ['health', 246, -166.5],
  ['armour', -246, -86.5], ['armour', 330, -60], ['armour', 6.5, -246], ['pistol', -233, 4], ['smg', 346, 200]];

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.ambushTimer = 25;
    this.gang = [];
    this.shellsFound = new Set();
    this.shellPickups = [];
    this.wasInTurf = false;
    this.respawns = [];
    events.on('pickup', (p) => {
      if (p.supply) this.respawns.push({ supply: p.supply, t: 60 });
      if (p.type !== 'shell') return;
      this.shellsFound.add(p.shellId);
      const n = this.shellsFound.size;
      game.progression.addMoney(250000, `Golden Shell ${n}/${SHELL_SPOTS.length}`);
      game.progression.addXp(30, 'Golden Shell');
      if (n === SHELL_SPOTS.length) {
        game.progression.addMoney(10000000, 'All Golden Shells!');
        game.hud.activityResult(true, 'SHELL COLLECTOR', 'All 12 Golden Shells found');
      }
    });
  }

  placeShells() {
    const markers = this.game.markers;
    for (const p of this.shellPickups) {
      this.game.scene.remove(p.group);
      const i = markers.pickups.indexOf(p);
      if (i >= 0) markers.pickups.splice(i, 1);
    }
    this.shellPickups = [];
    SHELL_SPOTS.forEach(([x, z], i) => {
      if (this.shellsFound.has(i)) return;
      const p = this.game.markers.addPickup('shell', x, z);
      p.shellId = i;
      this.shellPickups.push(p);
    });
  }

  placeSupply(def) {
    const [type, x, z] = def;
    const p = this.game.markers.addPickup(type, x, z, type === 'armour' ? 50 : 0);
    p.supply = def;
  }

  placeSupplies() { for (const def of SUPPLIES) this.placeSupply(def); }

  update(dt) {
    const g = this.game, p = g.player;
    for (const r of [...this.respawns]) { r.t -= dt; if (r.t <= 0) { this.placeSupply(r.supply); this.respawns.splice(this.respawns.indexOf(r), 1); } }
    const inTurf = districtAt(p.pos.x, p.pos.z) === 'kawasan-industri' && g.missions.completed.has('ikan-busuk');
    if (inTurf && !this.wasInTurf) g.hud.notify('Hiu Merah turf — watch out!', 'bad');
    this.wasInTurf = inTurf;
    for (const c of this.gang) c.update(dt, g, p.alive ? { pos: p.pos, chestY: p.body.chestY, vehicle: p.vehicle, body: p.body } : null);
    for (const c of [...this.gang]) {
      const d = Math.hypot(c.body.pos.x - p.pos.x, c.body.pos.z - p.pos.z);
      if ((!c.alive && c.body.deadTime > 20) || d > 160) {
        if (c.arrow) g.markers.remove(c.arrow);
        g.scene.remove(c.body.mesh);
        this.gang.splice(this.gang.indexOf(c), 1);
      } else if (!c.alive && c.arrow) { g.markers.remove(c.arrow); c.arrow = null; }
    }
    if (!inTurf || g.missions.active || this.gang.some((c) => c.alive)) return;
    this.ambushTimer -= dt;
    if (this.ambushTimer > 0) return;
    this.ambushTimer = rng.range(40, 70);
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(22, 32);
      const c = new Combatant(g.scene, { ...rng.pick(GANG_LOOKS), skin: rng.pick(SKIN_TONES) }, p.pos.x + Math.cos(a) * r, p.pos.z + Math.sin(a) * r, {
        faction: 'gang', weapon: rng.pick(['pistol', 'pistol', 'smg']), health: 90, accuracy: 0.38,
      });
      c.arrow = g.markers.addArrow(c.body, MARKER_COLORS.enemy);
      this.gang.push(c);
    }
    g.dialogue.say('bayu', rng.pick(["That is Pak Harun's boy! Shoot him!", 'Wrong neighbourhood, Raka!', 'The boss pays good money for your head!']));
  }

  serialize() { return { shells: [...this.shellsFound] }; }
  restore(d) { for (const i of d?.shells || []) this.shellsFound.add(i); this.placeShells(); }
}
