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

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.ambushTimer = 25;
    this.gang = [];
    this.shellsFound = new Set();
    this.shellPickups = [];
    this.wasInTurf = false;
    events.on('pickup', (p) => {
      if (p.type !== 'shell') return;
      this.shellsFound.add(p.shellId);
      const n = this.shellsFound.size;
      game.progression.addMoney(250000, `Kerang Emas ${n}/${SHELL_SPOTS.length}`);
      game.progression.addXp(30, 'Kerang Emas');
      if (n === SHELL_SPOTS.length) {
        game.progression.addMoney(10000000, 'Semua Kerang Emas!');
        game.hud.activityResult(true, 'KOLEKTOR KERANG', 'Semua 12 Kerang Emas ditemukan');
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

  update(dt) {
    const g = this.game, p = g.player;
    const inTurf = districtAt(p.pos.x, p.pos.z) === 'kawasan-industri' && g.missions.completed.has('ikan-busuk');
    if (inTurf && !this.wasInTurf) g.hud.notify('Wilayah Hiu Merah — hati-hati!', 'bad');
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
    g.dialogue.say('bayu', rng.pick(['Itu dia orangnya Pak Harun! Tembak!', 'Kau salah masuk wilayah, Raka!', 'Juragan bayar mahal untuk kepalamu!']));
  }

  serialize() { return { shells: [...this.shellsFound] }; }
  restore(d) { for (const i of d?.shells || []) this.shellsFound.add(i); this.placeShells(); }
}
