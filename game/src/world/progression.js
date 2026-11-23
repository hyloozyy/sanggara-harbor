// Money in Rupiah, respect (XP) and street rank with perks unlocked as the player rises.
import { events } from '../core/event-bus.js';

export const RANKS = [
  { xp: 0, name: 'Anak Baru', perk: null },
  { xp: 400, name: 'Preman Pasar', perk: 'Stamina lari +25%' },
  { xp: 1100, name: 'Jagoan Kampung', perk: 'Armor maksimum 100' },
  { xp: 2300, name: 'Tangan Kanan', perk: 'Diskon Toko Besi 20%' },
  { xp: 4000, name: 'Tokoh Pelabuhan', perk: 'Polisi menyerah 25% lebih cepat' },
  { xp: 6500, name: 'Raja Sanggara', perk: 'Semua senjata terbuka' },
];

export class Progression {
  constructor() {
    this.money = 150000;
    this.xp = 0;
    this.stats = { missions: 0, kills: 0, carsStolen: 0, distance: 0, maxWanted: 0, races: 0, deliveries: 0, playTime: 0 };
  }

  get rankIndex() { let r = 0; RANKS.forEach((k, i) => { if (this.xp >= k.xp) r = i; }); return r; }
  get rank() { return RANKS[this.rankIndex]; }
  get nextRank() { return RANKS[this.rankIndex + 1] || null; }
  get rankProgress() {
    const n = this.nextRank;
    if (!n) return 1;
    return (this.xp - this.rank.xp) / (n.xp - this.rank.xp);
  }

  addMoney(amount, reason = '') {
    this.money = Math.max(0, this.money + amount);
    events.emit('money-changed', { amount, reason, total: this.money });
  }

  addXp(amount, reason = '') {
    const before = this.rankIndex;
    this.xp += amount;
    events.emit('xp-gained', { amount, reason });
    if (this.rankIndex > before) events.emit('rank-up', { rank: this.rank });
  }

  serialize() { return { money: this.money, xp: this.xp, stats: { ...this.stats } }; }
  restore(d) { this.money = d.money; this.xp = d.xp; Object.assign(this.stats, d.stats || {}); }
}
