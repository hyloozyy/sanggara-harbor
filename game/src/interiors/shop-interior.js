// Toko Berkah, the corner shop: two gondola shelves packed with goods, glass-door drink
// fridges humming with light, an ice-cream chest, rice sacks and gas tanks by the wall, a
// counter with jars of kerupuk, a cigarette rack and strips of sachets hanging overhead.
// Bu Sari keeps the till; a customer or two browse the aisles. Buy food and drink for health.
import * as THREE from 'three';
import { Interior } from './interior-base.js';
import { roundedBox, lathe } from './shapes.js';
import { plasticChair, ceilingFan, poster, duskWindow, wallClock, contactShadow, CYL, PLANE } from './furniture.js';
import { InteriorNpc, pick } from './interior-npc.js';
import { generateLook } from '../characters/character-generator.js';
import { createRng } from '../core/rng.js';
import { formatMoney } from '../core/math-utils.js';

const ITEMS = [
  { id: 'nasi', label: 'Nasi bungkus', price: 4, heal: 45, note: 'Nasi bungkus · +45 health', kind: 'eat' },
  { id: 'esteh', label: 'Es teh manis', price: 2, heal: 15, note: 'Es teh · +15 health', kind: 'tea' },
  { id: 'kopi', label: 'Kopi sachet', price: 1, heal: 8, note: 'Kopi · +8 health, stamina', kind: 'coffee' },
  { id: 'jamu', label: 'Jamu kunyit asam', price: 6, heal: 30, armour: 10, note: 'Jamu · +30 health, +10 armour', kind: 'tea' },
  { id: 'roti', label: 'Roti & susu', price: 3, heal: 25, note: 'Roti & susu · +25 health', kind: 'eat' },
];

export class ShopInterior extends Interior {
  constructor() {
    super('shop', { name: 'Toko Berkah', ceiling: 3.0 });
    this.envCenter = { x: 0, y: 1.5, z: 0 };
    this.envIntensity = 0.9;
    this.audioState = { music: 0, chatter: 0.25, street: 0.5, room: 'shop' };
    this.views = { overview: [3.0, 2.3, 2.7, -1.2, 0.9, -1.8], counter: [1.2, 1.6, 0.8, -2.4, 1.0, 1.4], aisle: [0.2, 1.6, 2.6, 0.3, 0.9, -2.6], fridge: [-0.8, 1.6, 0.4, 3.2, 1.0, -0.8] };
  }

  floorAt() { return 'tile'; }

  layout(k, M) {
    const H = this.ceilingY, r = createRng(91);
    this.world = { collision: this.collision, groundAt: () => 0 };
    this.floor(k, -3.5, -3, 3.5, 3, M.terrazzo);
    const c = [0, 0];
    this.wall(k, -3.5, -3, 3.5, -3, { inside: c, upper: M.plasterWhite, lower: M.tileMint, lowerH: 1.1, rail: null });
    this.wall(k, -3.5, 3, 3.5, 3, { inside: c, upper: M.plasterWhite, lower: M.tileMint, lowerH: 1.1, rail: null, openings: [{ at: 3.0, w: 1.0, h: 2.2 }, { at: 0.5, w: 2.0, h: 2.3, sill: 0.9 }, { at: 4.6, w: 2.0, h: 2.3, sill: 0.9 }] });
    this.wall(k, -3.5, -3, -3.5, 3, { inside: c, upper: M.plasterWhite, lower: M.tileMint, lowerH: 1.1, rail: null });
    this.wall(k, 3.5, -3, 3.5, 3, { inside: c, upper: M.plasterWhite, lower: M.tileMint, lowerH: 1.1, rail: null });
    this.exitDoor = this.door(k, 0, 2.92, Math.PI, { w: 1.0, h: 2.2, glass: true, mat: M.greenPaint, swing: -1, auto: false });
    this.entry = { x: 0, z: 1.95, heading: Math.PI };
    this.exitSpot = this.spot(0, 2.35, 1.0, 'Leave Toko Berkah', null); this.exitSpot.exit = true;
    for (const x of [-2.0, 2.1]) { k.push(x, 1.95, 3, Math.PI); duskWindow(k, M, 2.0, 1.4, false, M.greenPaint); k.pop(); }

    // Gondola shelves (two aisles) with goods.
    for (const [x, z] of [[-0.9, -0.9], [1.5, -0.9]]) { k.push(x, 0, z, Math.PI / 2); gondola(k, M, 2.2, r); k.pop(); this.block(x, z, 0.75, 2.2, 1.6); }
    // Wall shelving along the back.
    k.push(-0.6, 0, -2.75); wallShelf(k, M, 3.6, r); k.pop();
    this.block(-0.6, -2.75, 3.6, 0.45, 2.0);
    // Drink fridges on the east wall, lit from inside.
    this.fridges = [];
    for (const z of [-2.0, -0.95]) { k.push(3.15, 0, z, -Math.PI / 2); drinkFridge(k, M, r); k.pop(); this.block(3.15, z, 0.66, 1.0, 2.0); }
    this.point(2.7, 1.4, -1.5, 0xe8f4ff, 3, 3);
    // Ice-cream chest freezer.
    k.push(3.0, 0, 0.6, -Math.PI / 2);
    k.add(roundedBox(1.1, 0.8, 0.65, 0.05, 3), M.white, 0, 0.4, 0);
    k.add(roundedBox(1.0, 0.03, 0.55, 0.01), M.glassClear, 0, 0.81, 0);
    k.add(roundedBox(0.9, 0.2, 0.02, 0.006), new THREE.MeshStandardMaterial({ color: 0x2a6ac8, emissive: 0x2a6ac8, emissiveIntensity: 0.4 }), 0, 0.6, 0.33);
    for (let i = 0; i < 12; i++) k.add(roundedBox(0.12, 0.04, 0.08, 0.01), [M.plasticRed, M.plasticBlue, M.creamPaint, M.plasticGreen][i % 4], -0.4 + (i % 6) * 0.15, 0.74, -0.12 + Math.floor(i / 6) * 0.2);
    k.pop();
    this.block(3.0, 0.6, 0.65, 1.1, 0.85);
    // Rice sacks and LPG tanks by the west wall.
    for (let i = 0; i < 4; i++) k.add(roundedBox(0.5, 0.25, 0.35, 0.1, 3), M.clothCream, -3.1, 0.13 + Math.floor(i / 2) * 0.24, 0.2 + (i % 2) * 0.4, 0.1 * i);
    for (let i = 0; i < 3; i++) k.add(lathe([[0, 0], [0.13, 0], [0.15, 0.04], [0.15, 0.24], [0.12, 0.3], [0.04, 0.32], [0.04, 0.36], [0, 0.36]], 18, 'lpg'), M.greenPaint, -3.15, 0, -0.5 - i * 0.34);
    this.block(-3.1, 0.0, 0.6, 1.8, 0.6);

    // Counter by the door with the till, jars and the cigarette rack behind.
    k.push(-2.0, 0, 1.25, Math.PI / 2);
    k.add(roundedBox(1.9, 0.95, 0.6, 0.02), M.woodTeak, 0, 0.475, 0);
    k.add(roundedBox(1.98, 0.04, 0.66, 0.015), M.glassClear, 0, 0.97, 0);
    k.add(roundedBox(1.8, 0.5, 0.02, 0.008), M.glass, 0, 0.6, 0.31);
    for (let i = 0; i < 10; i++) k.add(roundedBox(0.14, 0.09, 0.09, 0.01), M.goods, -0.75 + (i % 5) * 0.32, 0.5 + Math.floor(i / 5) * 0.2, 0.15);
    // Kerupuk jars (tall glass tins with red lids).
    for (let i = 0; i < 4; i++) {
      k.add(lathe([[0, 0], [0.11, 0], [0.11, 0.3], [0.09, 0.32], [0.09, 0.34], [0, 0.34]], 18, 'kjar'), M.glassClear, -0.7 + i * 0.26, 0.99, 0.12);
      k.add(lathe([[0, 0], [0.1, 0], [0.1, 0.22], [0, 0.22]], 12, 'kfill'), M.creamPaint, -0.7 + i * 0.26, 1.0, 0.12);
      k.add(CYL(0.095, 0.095, 0.03, 16), M.plasticRed, -0.7 + i * 0.26, 1.34, 0.12);
    }
    // The till and a calculator.
    k.add(roundedBox(0.36, 0.12, 0.3, 0.03), M.black, 0.55, 1.05, -0.05);
    k.add(roundedBox(0.3, 0.16, 0.03, 0.01), M.screenGlow, 0.55, 1.18, -0.16, 0, -0.3);
    k.add(roundedBox(0.12, 0.015, 0.16, 0.006), M.creamPaint, 0.2, 1.0, 0.05, 0.3);
    k.pop();
    this.block(-2.0, 1.25, 0.65, 1.95, 1.0);
    k.push(-3.3, 1.2, 1.25, Math.PI / 2);
    k.add(roundedBox(1.4, 0.9, 0.22, 0.02), M.woodTeak, 0, 0.45, 0);
    for (let i = 0; i < 24; i++) k.add(roundedBox(0.1, 0.12, 0.04, 0.006), M.goods, -0.6 + (i % 8) * 0.17, 0.15 + Math.floor(i / 8) * 0.28, 0.06);
    k.pop();
        // Sachet strips hanging from a wire across the front.
    const strip = new THREE.MeshStandardMaterial({ map: (() => { const t = M.goods.map.clone(); t.needsUpdate = true; return t; })(), roughness: 0.5, side: THREE.DoubleSide });
    k.add(CYL(0.003, 0.003, 4.5, 4), M.black, 0.2, 2.45, 1.6, 0, 0, Math.PI / 2);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.PlaneGeometry(0.1, 0.85, 1, 6); const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) p.setZ(j, Math.sin(p.getY(j) * 9 + i) * 0.01);
      const uv = g.attributes.uv; const cell = i % 32; for (let j = 0; j < uv.count; j++) uv.setXY(j, ((cell % 8) + uv.getX(j)) / 8, 1 - (Math.floor(cell / 8) + 1 - uv.getY(j)) / 4);
      k.add(g, strip, -1.9 + i * 0.3, 2.0, 1.6, 0.2 * Math.sin(i));
    }
    k.push(-3.45, 1.9, -1.6, Math.PI / 2); poster(k, M, 'dangdut', 0.45, 0.63); k.pop();
    k.push(-1.6, 1.85, -2.95); poster(k, M, 'football', 0.4, 0.56); k.pop();
    const clockG = new THREE.Group(); this.dynamic.add(clockG);
    k.push(1.4, 2.45, -2.95); this.clock = wallClock(k, M, clockG); k.pop();
    k.push(2.6, 0, 2.3, -2.4); plasticChair(k, M, M.plasticRed); k.pop();
    this.stool = this.seat(2.6, 2.3, -2.4, { seatY: 0.45 }, 'chair', 'lap');
    this.stool.front = 'front';
    k.push(0.3, 0, 0.6); this.fan = ceilingFan(k, M, this.dynamic, H, 0.35); k.pop();
    // Fluorescent tube lights.
    const tubeMat = M.bulbCool;
    for (const [x, z] of [[-0.9, -0.9], [1.5, -0.9], [-2.2, 1.3]]) {
      k.add(roundedBox(0.16, 0.06, 1.3, 0.02), M.white, x, H - 0.04, z);
      k.add(CYL(0.018, 0.018, 1.2, 10), tubeMat, x, H - 0.09, z, 0, Math.PI / 2);
    }

    this.ambient(0xe8f0f0, 0x6a6a60, 0.9);
    this.spotLight(-0.9, H - 0.1, -0.9, -0.9, 0, -0.9, { intensity: 26, angle: 1.25, dist: 6, color: 0xf0f8ff });
    this.spotLight(1.5, H - 0.1, -0.9, 1.5, 0, -0.9, { intensity: 24, angle: 1.25, dist: 6, color: 0xf0f8ff, shadow: false });
    this.spotLight(-2.2, H - 0.1, 1.3, -2.2, 0, 1.3, { intensity: 22, angle: 1.2, dist: 6, color: 0xfff4e0, mapSize: 512 });
    this.point(0, 1.8, 2.4, 0xff9a58, 2.5, 4);

    this.animated.push((dt, t, game) => {
      this.fan.rotation.y += dt * 4.4;
      const hr = game.weather?.clock?.hour ?? 20;
      this.clock.hour.rotation.z = -(hr % 12) / 12 * Math.PI * 2;
      this.clock.min.rotation.z = -((hr * 60) % 60) / 60 * Math.PI * 2;
    });

    // Bu Sari behind the counter; two customers.
    const sari = new InteriorNpc(generateLook(8842, 'market', { gender: 'f', age: 'adult', name: 'Bu Sari' }), -2.85, 1.2, Math.PI / 2, { name: 'Bu Sari', role: 'shopkeeper', plan: (n) => this.planKeeper(n) });
    sari.talkScript = 'shopkeeper';
    this.keeper = this.addNpc(sari);
    const browse = [[0.3, -0.9], [0.3, 0.6], [2.35, -0.4], [2.35, -1.6], [0.3, -2.1], [-2.05, -2.0], [-2.05, -0.8]];
    for (const [seed, i] of [[9101, 0], [9277, 3]]) {
      const n = new InteriorNpc(generateLook(seed, 'auto'), browse[i][0], browse[i][1], 0, { plan: (np) => this.planBrowser(np, browse) });
      n.talkScript = 'patron';
      n.idx = i;
      this.addNpc(n);
    }
  }

  planKeeper(n) {
    const r = Math.random();
    if (r < 0.35) n.walk([[-2.85, 1.2 + (Math.random() - 0.5) * 0.9]]).face(Math.PI / 2, 0.4).gesture('type', 2.2);
    else if (r < 0.55) n.face(-Math.PI / 2, 0.6).gesture('serve', 1.2).face(Math.PI / 2, 0.6);
    else if (r < 0.7) n.gesture('wipe', 2.4);
    else n.wait(2 + Math.random() * 2, { x: 0, z: 0, y: 1.4 });
  }

  planBrowser(n, pts) {
    n.idx = (n.idx + 1 + Math.floor(Math.random() * 2)) % pts.length;
    const p = pts[n.idx];
    n.walk([p]);
    // Look at the shelf, take something down, look at it.
    const shelfDir = p[0] > 2 ? Math.PI / 2 : p[0] < -1 ? Math.PI / 2 : p[1] < -2 ? Math.PI : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    n.face(shelfDir, 0.6).wait(1 + Math.random() * 1.5).gesture('serve', 1.2).wait(0.8 + Math.random());
  }

  beginTalk(conv, npc, mgr) {
    const g = conv.game;
    if (npc !== this.keeper) {
      conv.say('raka', pick(['Excuse me.', 'Evening.']));
      conv.npc(pick(['Oh, sorry, am I in your way?', 'The iced tea here is the best in the street.', 'Have you tried the jamu? My grandmother swears by it.']));
      conv.interiorChoices = conv.pendingChoices = [];
      return true;
    }
    conv.say('raka', pick(['Evening, Bu.', 'Hello, Bu Sari.']));
    conv.npc(pick(['Mas Raka! What are you looking for?', 'Welcome, welcome. Hungry? Thirsty?', 'Evening. Fresh nasi bungkus just came in.']));
    const list = ITEMS.map((it) => ({
      label: `${it.label} (${formatMoney(it.price)})`,
      run: () => {
        conv.say('raka', `${it.label}, please.`);
        if (!mgr.pay(it.price, it.label)) { conv.npc('Aduh, not enough money, Mas. Maybe next time.'); return false; }
        conv.npc(pick(['Here you go. Terima kasih!', 'Enjoy it, Mas.', 'Good choice.']));
        npc.clear(); npc.gesture('serve', 1.2);
        setTimeout(() => {
          if (!mgr.active) return;
          if (it.kind === 'eat') { g.player.body.health = Math.min(g.player.body.maxHealth, g.player.body.health + it.heal); g.player.body.playGesture('drink', 2.0); }
          else mgr.drink(it.kind, it.heal, 2);
          if (it.armour) g.player.body.armour = Math.min(100, g.player.body.armour + it.armour);
          if (it.kind === 'coffee') g.player.stamina = 1;
          g.hud.notify(it.note, 'xp');
        }, 1300);
        return false;
      },
    }));
    list.push({ label: 'Just looking, thanks.', run: () => { conv.say('raka', 'Just looking, thanks.'); conv.npc('Take your time.'); return false; } });
    conv.interiorChoices = list;
    conv.pendingChoices = list.slice(0, 4).concat(list.slice(4));
    return true;
  }
}

// A double-sided gondola shelf: four levels of boxes, tins and bottles in an irregular fill.
function gondola(k, M, len, r) {
  k.add(roundedBox(len, 1.5, 0.08, 0.01), M.white, 0, 0.78, 0);
  k.add(roundedBox(len, 0.12, 0.7, 0.02), M.white, 0, 0.06, 0);
  for (const side of [-1, 1]) for (let lv = 0; lv < 4; lv++) {
    const y = 0.14 + lv * 0.36;
    k.add(roundedBox(len, 0.02, 0.3, 0.006), M.white, 0, y, side * 0.19);
    k.add(roundedBox(len, 0.05, 0.01, 0.004), lv % 2 ? M.plasticRed : M.plasticBlue, 0, y + 0.0, side * 0.345);
    let x = -len / 2 + 0.06;
    while (x < len / 2 - 0.08) {
      const w = r.range(0.07, 0.16), h = r.range(0.1, 0.26);
      if (r.chance(0.2)) k.add(CYL(w * 0.4, w * 0.4, h, 12), [M.redPaint, M.greenPaint, M.creamPaint, M.bluePaint][r.int(0, 3)], x + w / 2, y + 0.01 + h / 2, side * 0.2);
      else k.add(goodsBox(w, h, 0.2, r.int(0, 31)), M.goods, x + w / 2, y + 0.01 + h / 2, side * 0.2, side > 0 ? 0 : Math.PI);
      x += w + r.range(0.005, 0.02);
    }
  }
  contactShadow(k, len + 0.4, 1.0);
}

function wallShelf(k, M, len, r) {
  k.add(roundedBox(len, 2.0, 0.04, 0.01), M.white, 0, 1.0, -0.2);
  for (let lv = 0; lv < 5; lv++) {
    const y = 0.1 + lv * 0.4;
    k.add(roundedBox(len, 0.02, 0.4, 0.006), M.white, 0, y, 0);
    let x = -len / 2 + 0.06;
    while (x < len / 2 - 0.1) {
      const w = r.range(0.08, 0.2), h = r.range(0.1, 0.3);
      k.add(goodsBox(w, h, 0.25, r.int(0, 31)), M.goods, x + w / 2, y + 0.01 + h / 2, 0);
      x += w + r.range(0.005, 0.02);
    }
  }
}

// Glass-door drink fridge with rows of bottles and cans, lit from inside.
function drinkFridge(k, M, r) {
  k.add(roundedBox(0.95, 2.0, 0.65, 0.03), M.redPaint, 0, 1.0, 0);
  k.add(roundedBox(0.85, 1.6, 0.02, 0.01), M.black, 0, 1.0, -0.28);
  const lit = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xe8f4ff, emissiveIntensity: 1.2 });
  k.add(roundedBox(0.84, 0.02, 0.5, 0.005), lit, 0, 1.78, 0);
  for (let lv = 0; lv < 4; lv++) {
    const y = 0.32 + lv * 0.38;
    k.add(roundedBox(0.84, 0.01, 0.5, 0.004), M.steel, 0, y, 0);
    for (let i = 0; i < 7; i++) {
      const x = -0.36 + i * 0.12;
      if (lv % 2) k.add(CYL(0.032, 0.032, 0.12, 12), [M.redPaint, M.greenPaint, M.bluePaint, M.creamPaint][r.int(0, 3)], x, y + 0.065, 0.1);
      else k.add(lathe([[0, 0], [0.03, 0], [0.03, 0.14], [0.012, 0.2], [0.012, 0.23], [0, 0.23]], 10, 'pet'), [M.glassClear, M.glassGreen, M.glassBrown][r.int(0, 2)], x, y + 0.005, 0.1);
    }
  }
  k.add(roundedBox(0.88, 1.62, 0.02, 0.01), M.glass, 0, 1.0, 0.33);
  k.add(roundedBox(0.03, 0.4, 0.04, 0.01), M.chrome, 0.38, 1.1, 0.36);
  k.add(roundedBox(0.9, 0.28, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xc82a2a, emissive: 0xff4a3a, emissiveIntensity: 0.6 }), 0, 1.88, 0.33);
  void PLANE;
}

const boxCache = new Map();
function goodsBox(w, h, d, cell) {
  const key = `${w.toFixed(2)}:${h.toFixed(2)}:${d}:${cell}`;
  if (boxCache.has(key)) return boxCache.get(key);
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const u0 = (cell % 8) / 8, v0 = 1 - (Math.floor(cell / 8) + 1) / 4;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 8, v0 + uv.getY(i) / 4);
  boxCache.set(key, g);
  return g;
}
