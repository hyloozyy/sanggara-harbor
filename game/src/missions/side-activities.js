// Things to do between story missions: the "Balap Liar Senja" street race against the clock,
// martabak deliveries on a scooter, the paint shop that clears the wanted level, the hardware
// store that sells guns and ammo, and the safehouse where the game is saved.
import { PLACES } from '../city/city-layout.js';
import { MARKER_COLORS } from '../world/world-markers.js';
import { formatRupiah } from '../core/math-utils.js';
import { rng } from '../core/rng.js';
import { events } from '../core/event-bus.js';
import { WEAPONS } from '../combat/weapon-catalog.js';

const RACE_ROUTE = [
  [-40, 317.4], [80, 317.4], [200, 317.4], [317.4, 290], [317.4, 190], [317.4, 80], [317.4, -30], [300, -77.4],
  [200, -77.4], [90, -77.4], [2.6, -40], [2.6, 90], [2.6, 220], [-60, 322.6],
];
const RECORD = 78; // seconds to beat ("rekor Kobra Senja")
const DELIVERY_SPOTS = [[-40, 87.5], [114, 166.6], [-114, 245.6], [86, -86.5], [166.5, 114], [-86.5, 34], [246, 86.5], [-166.6, 200]];

export class SideActivities {
  constructor(game) {
    this.game = game;
    this.mode = null;           // 'race' | 'delivery'
    this.markers = [];
    this.fixed = [];
    this.raceBest = null;
    this.cool = {};
  }

  get routeLength() { return RACE_ROUTE.length; }
  get record() { return RECORD; }

  placeFixedMarkers() {
    const g = this.game;
    for (const m of this.fixed) g.markers.remove(m);
    this.fixed = [
      g.markers.addZone(PLACES.raceStart.x, PLACES.raceStart.z, { radius: 4, color: MARKER_COLORS.race, kind: 'activity', label: 'race' }),
      g.markers.addZone(PLACES.deliveryDepot.x, PLACES.deliveryDepot.z, { radius: 2.5, color: 0xff8040, kind: 'activity', label: 'delivery' }),
      g.markers.addZone(PLACES.paintShop.x, PLACES.paintShop.z, { radius: 5, color: 0x8080ff, kind: 'activity', label: 'paint' }),
      g.markers.addZone(PLACES.gunShop.x, PLACES.gunShop.z, { radius: 2.2, color: 0xff4040, kind: 'activity', label: 'guns' }),
      g.markers.addZone(PLACES.safehouse.x, PLACES.safehouse.z, { radius: 2.2, color: 0x60ff80, kind: 'activity', label: 'save' }),
    ];
  }

  near(place, r) { const p = this.game.player.pos; return Math.hypot(p.x - place.x, p.z - place.z) < r; }

  ready(key) { return !this.cool[key] || this.cool[key] <= 0; }

  update(dt) {
    const g = this.game, p = g.player;
    for (const k of Object.keys(this.cool)) this.cool[k] -= dt;
    if (!p.alive) { if (this.mode) this.stop(false, 'Gagal'); return; }
    const busy = g.missions.active || this.mode;

    if (!busy && p.vehicle && this.near(PLACES.raceStart, 4.5) && this.ready('race')) this.startRace();
    if (!busy && !p.vehicle && this.near(PLACES.deliveryDepot, 2.5) && this.ready('delivery')) this.startDelivery();
    if (p.vehicle && this.near(PLACES.paintShop, 5.5) && this.ready('paint') && g.wanted.level > 0) this.paintJob();
    if (!p.vehicle && this.near(PLACES.gunShop, 2.2) && this.ready('guns')) this.shop();
    if (!p.vehicle && this.near(PLACES.safehouse, 2.2) && this.ready('save')) { this.cool.save = 8; g.saveGame('Kos Raka'); }

    if (this.mode === 'race') this.updateRace(dt);
    else if (this.mode === 'delivery') this.updateDelivery(dt);
  }

  // --- street race -------------------------------------------------------
  startRace() {
    this.mode = 'race';
    this.time = 0;
    this.cp = 0;
    this.showCheckpoint();
    this.game.dialogue.say('dimas', `Balap Liar Senja! Rekor Kobra Senja ${RECORD} detik. Ikuti gerbang hijau!`);
    events.emit('activity', { kind: 'race-start' });
  }

  showCheckpoint() {
    for (const m of this.markers) this.game.markers.remove(m);
    const [x, z] = RACE_ROUTE[this.cp];
    this.markers = [this.game.markers.addZone(x, z, { radius: 6, color: MARKER_COLORS.race, kind: 'race' })];
  }

  updateRace(dt) {
    const p = this.game.player;
    this.time += dt;
    if (!p.vehicle) { this.stop(false, 'Keluar dari kendaraan'); return; }
    const [x, z] = RACE_ROUTE[this.cp];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 7) {
      this.cp++;
      events.emit('checkpoint', {});
      if (this.cp >= RACE_ROUTE.length) {
        const win = this.time <= RECORD;
        const prize = win ? 2500000 : 300000;
        this.game.progression.addMoney(prize, 'Balap');
        this.game.progression.addXp(win ? 220 : 60, 'Balap');
        this.game.progression.stats.races++;
        this.raceBest = Math.min(this.raceBest ?? Infinity, this.time);
        this.stop(win, `${this.time.toFixed(1)} dtk ${win ? '— rekor baru!' : `(rekor ${RECORD} dtk)`}`);
        return;
      }
      this.showCheckpoint();
    }
  }

  // --- martabak delivery -------------------------------------------------
  startDelivery() {
    const g = this.game;
    this.mode = 'delivery';
    this.drops = [...DELIVERY_SPOTS].sort(() => rng.next() - 0.5).slice(0, 3);
    this.time = 75;
    this.delivered = 0;
    const v = g.vehicles.spawn('bebek', PLACES.deliveryDepot.x + 3, PLACES.deliveryDepot.z - 3.5, Math.PI / 2, { color: 0xf2a516 });
    v.ai = { kind: 'activity' };
    v.ownedByPlayer = true;
    this.scooter = v;
    this.showDrop();
    g.dialogue.say('lastri', 'Martabak Bulan butuh kurir! Tiga antaran, 75 detik, jangan sampai dingin.');
  }

  showDrop() {
    for (const m of this.markers) this.game.markers.remove(m);
    const [x, z] = this.drops[this.delivered];
    this.markers = [this.game.markers.addZone(x, z, { radius: 4, color: 0xff8040, kind: 'delivery' })];
  }

  updateDelivery(dt) {
    const p = this.game.player;
    this.time -= dt;
    if (this.time <= 0) { this.stop(false, 'Martabak keburu dingin'); return; }
    const [x, z] = this.drops[this.delivered];
    if (Math.hypot(p.pos.x - x, p.pos.z - z) < 4.5) {
      this.delivered++;
      this.game.progression.addMoney(350000, 'Antar martabak');
      this.game.progression.stats.deliveries++;
      events.emit('checkpoint', {});
      if (this.delivered >= this.drops.length) {
        this.game.progression.addMoney(600000, 'Bonus kilat');
        this.game.progression.addXp(150, 'Antar martabak');
        this.stop(true, `Semua antaran selesai, sisa ${Math.ceil(this.time)} dtk`);
        return;
      }
      this.time += 20;
      this.showDrop();
    }
  }

  stop(success, detail) {
    for (const m of this.markers) this.game.markers.remove(m);
    this.markers = [];
    const title = this.mode === 'race' ? 'BALAP LIAR SENJA' : 'ANTAR MARTABAK';
    this.cool[this.mode] = 6;
    this.mode = null;
    this.game.hud.activityResult(success, title, detail);
  }

  // --- shops ---------------------------------------------------------------
  paintJob() {
    const g = this.game;
    this.cool.paint = 10;
    const price = 500000 + g.wanted.level * 250000;
    if (g.progression.money < price) { events.emit('notify', { text: `Cat ulang butuh ${formatRupiah(price)}`, kind: 'bad' }); return; }
    g.progression.addMoney(-price, 'Bengkel Cat');
    g.wanted.clear('paint');
    const v = g.player.vehicle;
    const colors = [0x1a60e0, 0xf0c000, 0x101010, 0xf0f0f0, 0x20a050, 0x8a1a1a];
    const color = rng.pick(colors);
    v.body.traverse((o) => { if (o.isMesh && o.material && o.material.userData.paint) o.material = g.assets.carPaint(color); });
    v.health = v.spec.health;
    events.emit('notify', { text: `Bengkel Cat Pak Darto: mobil dicat ulang, polisi kehilangan jejak (−${formatRupiah(price)})` });
  }

  shop() {
    const g = this.game, a = g.player.arsenal;
    this.cool.guns = 12;
    const discount = g.progression.rankIndex >= 3 ? 0.8 : 1;
    // Buy the next weapon the player does not own yet, else refill ammo.
    const next = ['pistol', 'smg', 'shotgun'].find((id) => !a.owned.has(id));
    if (next) {
      const price = WEAPONS[next].price * discount;
      if (g.progression.money >= price) {
        g.progression.addMoney(-price, 'Toko Besi');
        a.give(next, WEAPONS[next].mag * 4);
        events.emit('notify', { text: `Toko Besi Om Beni: ${WEAPONS[next].name} dibeli (−${formatRupiah(price)})` });
        events.emit('weapon-unlocked', { id: next });
        return;
      }
      events.emit('notify', { text: `${WEAPONS[next].name} seharga ${formatRupiah(price)} — uangmu belum cukup`, kind: 'bad' });
    }
    const ammoPrice = 400000 * discount;
    if (a.owned.size > 1 && g.progression.money >= ammoPrice) {
      g.progression.addMoney(-ammoPrice, 'Peluru');
      for (const id of a.owned) if (id !== 'fists') a.ammo[id] += WEAPONS[id].mag * 3;
      g.player.body.armour = Math.max(g.player.body.armour, g.progression.rankIndex >= 2 ? 100 : 50);
      events.emit('notify', { text: `Peluru dan rompi diisi ulang (−${formatRupiah(ammoPrice)})` });
    }
  }

  serialize() { return { raceBest: this.raceBest }; }
  restore(d) { this.raceBest = d?.raceBest ?? null; }
}
