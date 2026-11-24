// The wanted level: crimes add heat that becomes 1-5 stars, police sightings refresh the hunt,
// and staying out of sight long enough (outside the search zone) makes the stars fade away.
import { events } from '../core/event-bus.js';
import { clamp } from '../core/math-utils.js';

const THRESHOLDS = [0, 1, 160, 420, 800, 1300];

export const CRIMES = {
  carjack: { heat: 60, label: 'Car theft' },
  'car-theft-seen': { heat: 40, label: 'Vehicle theft' },
  'shots-fired': { heat: 25, label: 'Shots fired in public' },
  assault: { heat: 30, label: 'Penganiayaan' },
  murder: { heat: 120, label: 'Pembunuhan' },
  'cop-assault': { heat: 150, label: 'Assaulting an officer' },
  'cop-killed': { heat: 320, label: 'Officer killed' },
  'hit-and-run': { heat: 80, label: 'Hit and run' },
  'police-car-damage': { heat: 70, label: 'Damaging a police car' },
  'explosion': { heat: 180, label: 'Ledakan' },
};

export class WantedSystem {
  constructor() {
    this.level = 0;
    this.heat = 0;
    this.unseen = 0;          // seconds since police last saw the player
    this.lastKnown = { x: 0, z: 0 };
    this.seen = false;
    this.minLevel = 0;        // missions can force a floor
    this.maxLevel = 5;
  }

  get searchRadius() { return 50 + this.level * 25; }
  get escapeTime() { return 9 + this.level * 4; }
  get blinking() { return this.level > 0 && this.unseen > 2; }

  report(crime, x, z, { witnessed = true } = {}) {
    const c = CRIMES[crime];
    if (!c) return;
    this.heat += c.heat * (witnessed ? 1 : 0.5);
    if (this.level === 0 && this.heat > 0) this.heat = Math.max(this.heat, 1);
    this.lastKnown = { x, z };
    this.unseen = 0;
    this.recompute(c.label);
  }

  setLevel(level, reason = '') {
    this.heat = Math.max(this.heat, THRESHOLDS[clamp(level, 0, 5)] + 1);
    this.unseen = 0;
    this.recompute(reason);
  }

  recompute(reason) {
    let lvl = 0;
    for (let i = 1; i < THRESHOLDS.length; i++) if (this.heat >= THRESHOLDS[i]) lvl = i;
    lvl = clamp(Math.max(lvl, this.minLevel), 0, this.maxLevel);
    if (lvl !== this.level) {
      const prev = this.level;
      this.level = lvl;
      events.emit('wanted-changed', { level: lvl, prev, reason });
    }
  }

  clear(reason = 'escaped') {
    const prev = this.level;
    this.level = 0; this.heat = 0; this.unseen = 0;
    if (prev > 0) events.emit('wanted-changed', { level: 0, prev, reason });
  }

  // `spotted` is true when any unit currently sees the player this frame.
  update(dt, spotted, px, pz) {
    if (this.level === 0) return;
    if (spotted) {
      this.unseen = 0;
      this.lastKnown = { x: px, z: pz };
    } else {
      this.unseen += dt;
      const outside = Math.hypot(px - this.lastKnown.x, pz - this.lastKnown.z) > this.searchRadius;
      if (this.unseen > this.escapeTime && (outside || this.unseen > this.escapeTime * 1.8) && this.level > this.minLevel) {
        this.clear('escaped');
      }
    }
    // Heat slowly cools while unseen so the level does not keep climbing.
    if (!spotted) this.heat = Math.max(THRESHOLDS[this.level], this.heat - dt * 6);
  }

  serialize() { return { level: this.level, heat: this.heat }; }
}
