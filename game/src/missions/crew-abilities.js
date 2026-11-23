// Crew favours unlocked through the story: Dimas brings a getaway car (Z), Bu Lastri uses her
// contacts to call off one wanted star (X). Each has a cooldown shown on the HUD.
import { events } from '../core/event-bus.js';
import { laneLine, nearestNode, neighbours } from '../vehicles/road-graph.js';

export const CREW = {
  dimas: { key: 'KeyZ', label: 'Z', name: 'Dimas', ability: 'Mobil Jemputan', cooldown: 90 },
  lastri: { key: 'KeyX', label: 'X', name: 'Bu Lastri', ability: 'Kabar Polisi', cooldown: 120 },
};

export class CrewAbilities {
  constructor(game) {
    this.game = game;
    this.unlocked = new Set();
    this.timers = { dimas: 0, lastri: 0 };
  }

  unlock(id) {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    events.emit('crew-unlocked', { id, crew: CREW[id] });
  }

  update(dt, input) {
    for (const id of Object.keys(this.timers)) this.timers[id] = Math.max(0, this.timers[id] - dt);
    for (const id of this.unlocked) if (input.hit(CREW[id].key)) this.use(id);
  }

  use(id) {
    const g = this.game;
    if (this.timers[id] > 0) { events.emit('notify', { text: `${CREW[id].name} belum bisa dihubungi (${Math.ceil(this.timers[id])} dtk)`, kind: 'bad' }); return; }
    if (id === 'dimas') {
      if (g.player.vehicle) { events.emit('notify', { text: 'Kamu sudah di dalam kendaraan', kind: 'bad' }); return; }
      const [i, j] = nearestNode(g.player.pos.x, g.player.pos.z);
      const to = neighbours(i, j)[0];
      const L = laneLine([i, j], to);
      const v = g.vehicles.spawn('rajawali', L.ax + L.dx * 14, L.az + L.dz * 14, Math.atan2(L.dx, L.dz), { color: 0xd02010 });
      v.ai = { kind: 'crew-car' };
      v.ownedByPlayer = true;
      v.controls.handbrake = true;
      g.dialogue.say('dimas', 'Rajawali GT sudah kutaruh di ujung jalan. Jangan dibaret!');
    } else if (id === 'lastri') {
      if (g.wanted.level === 0) { events.emit('notify', { text: 'Tidak ada yang mencarimu sekarang', kind: 'bad' }); return; }
      g.wanted.heat = 0;
      g.wanted.setLevel(Math.max(g.wanted.minLevel, g.wanted.level - 1), 'crew');
      if (g.wanted.level === 0) g.wanted.clear('crew');
      g.dialogue.say('lastri', 'Sudah kutelepon sepupuku di kantor polisi. Satu bintang hilang.');
    }
    this.timers[id] = CREW[id].cooldown;
  }

  hudState() {
    return [...this.unlocked].map((id) => ({ ...CREW[id], id, cooldown: this.timers[id] }));
  }

  serialize() { return { unlocked: [...this.unlocked] }; }
  restore(d) { for (const id of d.unlocked || []) this.unlocked.add(id); }
}
