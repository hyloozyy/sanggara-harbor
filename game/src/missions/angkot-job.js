// "Narik Angkot": behind the wheel of any angkot minibus, pick up passengers waiting at the kerb
// and drop them at their stop for a fare that grows with distance and a tip for being quick.
import { Character } from '../characters/character.js';
import { randomLook } from '../characters/humanoid-model.js';
import { BLOCKS, districtAt, DISTRICTS } from '../city/city-layout.js';
import { formatRupiah } from '../core/math-utils.js';
import { rng } from '../core/rng.js';

function kerbSpot(px, pz, minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const b = rng.pick(BLOCKS);
    const s = b.slab;
    const side = rng.int(0, 3);
    const t = rng.range(12, 56);
    const x = side === 0 ? s.minX + t : side === 1 ? s.minX + t : side === 2 ? s.minX + 0.8 : s.maxX - 0.8;
    const z = side === 0 ? s.minZ + 0.8 : side === 1 ? s.maxZ - 0.8 : s.minZ + t;
    const d = Math.hypot(x - px, z - pz);
    if (d > minD && d < maxD) return { x, z };
  }
  return null;
}

export class AngkotJob {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.fares = 0;
  }

  update(dt) {
    const g = this.game, v = g.player.vehicle;
    const inAngkot = v && v.modelKey === 'angkot' && !g.missions.active && !g.side.mode;
    if (!this.active && inAngkot) this.begin();
    if (!this.active) return;
    if (!inAngkot) { this.end('Left the angkot'); return; }
    this.timer += dt;
    const p = g.player.pos;
    if (this.phase === 'pickup') {
      if (this.waiting) { this.waiting.heading = Math.atan2(p.x - this.waiting.pos.x, p.z - this.waiting.pos.z); this.waiting.updateVisual(dt); }
      if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) < 7 && Math.abs(v.speed) < 3) this.board();
    } else if (this.phase === 'dropoff') {
      if (Math.hypot(p.x - this.spot.x, p.z - this.spot.z) < 7 && Math.abs(v.speed) < 3) this.alight();
    }
  }

  begin() {
    this.active = true;
    this.fares = 0;
    this.game.hud.notify('Angkot Driver — pick up waving passengers (blue markers)');
    this.nextPassenger();
  }

  nextPassenger() {
    const g = this.game, p = g.player.pos;
    this.spot = kerbSpot(p.x, p.z, 60, 220);
    if (!this.spot) { this.end('No passengers'); return; }
    this.phase = 'pickup';
    this.timer = 0;
    this.waiting = new Character(randomLook(rng), this.spot.x, this.spot.z, { health: 60 });
    this.waiting.anim = 'phone';
    g.scene.add(this.waiting.mesh);
    this.marker = g.markers.addZone(this.spot.x, this.spot.z, { radius: 3, color: 0x40c0ff, kind: 'angkot' });
  }

  board() {
    const g = this.game, p = g.player.pos;
    g.scene.remove(this.waiting.mesh);
    this.waiting = null;
    g.markers.remove(this.marker);
    const dest = kerbSpot(p.x, p.z, 150, 420);
    if (!dest) { this.end('Passenger gave up'); return; }
    this.spot = dest;
    this.tripStart = { x: p.x, z: p.z };
    this.phase = 'dropoff';
    this.timer = 0;
    this.marker = g.markers.addZone(dest.x, dest.z, { radius: 3.5, color: 0x40c0ff, kind: 'angkot' });
    g.dialogue.say('raka', `Hop in. Dropping you at ${DISTRICTS[districtAt(dest.x, dest.z)].name}?`);
  }

  alight() {
    const g = this.game;
    const dist = Math.hypot(this.spot.x - this.tripStart.x, this.spot.z - this.tripStart.z);
    const fare = Math.round(dist * 120 / 1000) * 1000 + 5000;
    const quick = this.timer < dist / 9;
    const pay = fare + (quick ? 20000 : 0);
    g.progression.addMoney(pay, quick ? 'Angkot fare + tip' : 'Angkot fare');
    g.progression.addXp(12, 'Angkot passenger');
    this.fares++;
    g.markers.remove(this.marker);
    g.hud.notify(`Passenger ${this.fares} dropped off · ${formatRupiah(pay)}${quick ? ' (quick!)' : ''}`, 'xp');
    this.nextPassenger();
  }

  end(reason) {
    const g = this.game;
    if (this.marker) g.markers.remove(this.marker);
    if (this.waiting) g.scene.remove(this.waiting.mesh);
    this.waiting = null; this.marker = null;
    this.active = false;
    if (this.fares) g.hud.activityResult(true, 'ANGKOT DRIVER', `${this.fares} passengers delivered · ${reason}`);
  }

  hudLine() {
    if (!this.active) return null;
    return `<b>ANGKOT DRIVER</b><br>${this.phase === 'pickup' ? 'Pick up a passenger' : 'Drive to the destination'} · ${this.fares} delivered`;
  }

  objective() { return this.active ? { x: this.spot.x, z: this.spot.z, kind: 'vehicle' } : null; }
}

