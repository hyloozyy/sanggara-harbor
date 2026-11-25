// Klinik Sehat, a small neighbourhood clinic: terrazzo floor, mint tiles, a reception desk with
// Suster Ratih, a row of waiting chairs, a treatment bay behind a curtain on a rail with an
// examination bed, a drip stand and a glass medicine cabinet. Pay to be patched up.
import * as THREE from 'three';
import { Interior } from './interior-base.js';
import { roundedBox, lathe, tube } from './shapes.js';
import { poster, duskWindow, wallClock, pottedPlant, ceilingFan, contactShadow, CYL } from './furniture.js';
import { InteriorNpc, pick } from './interior-npc.js';
import { generateLook } from '../characters/character-generator.js';
import { formatMoney } from '../core/math-utils.js';

export class ClinicInterior extends Interior {
  constructor() {
    super('clinic', { name: 'Klinik Sehat', ceiling: 3.0 });
    this.envCenter = { x: 0, y: 1.5, z: 0 };
    this.envIntensity = 0.9;
    this.audioState = { music: 0, chatter: 0.1, street: 0.4, room: 'clinic' };
    this.views = { overview: [3.0, 2.3, 2.6, -1.5, 0.9, -1.8], desk: [0.8, 1.6, 1.0, -2.0, 1.0, -1.6], bay: [-0.2, 1.7, 1.2, 2.6, 0.8, -1.8] };
  }

  floorAt() { return 'tile'; }

  layout(k, M) {
    const H = this.ceilingY;
    this.world = { collision: this.collision, groundAt: () => 0 };
    this.floor(k, -3.5, -3, 3.5, 3, M.terrazzo);
    const c = [0, 0];
    const wl = { inside: c, upper: M.plasterWhite, lower: M.tileMint, lowerH: 1.2, rail: M.steel };
    this.wall(k, -3.5, -3, 3.5, -3, { ...wl });
    this.wall(k, -3.5, 3, 3.5, 3, { ...wl, openings: [{ at: 3.0, w: 1.0, h: 2.2 }, { at: 0.6, w: 1.6, h: 2.3, sill: 1.0 }, { at: 5.0, w: 1.4, h: 2.3, sill: 1.0 }] });
    this.wall(k, -3.5, -3, -3.5, 3, { ...wl });
    this.wall(k, 3.5, -3, 3.5, 3, { ...wl });
    this.exitDoor = this.door(k, 0, 2.92, Math.PI, { w: 1.0, h: 2.2, glass: true, mat: M.white, casing: M.steel, swing: -1, auto: false });
    this.entry = { x: 0, z: 1.95, heading: Math.PI };
    this.exitSpot = this.spot(0, 2.35, 1.0, 'Leave Klinik Sehat', null); this.exitSpot.exit = true;
    for (const [x, w] of [[-2.1, 1.6], [2.3, 1.4]]) { k.push(x, 1.65, 3, Math.PI); duskWindow(k, M, w, 1.3, true, M.white); k.pop(); }

    // Reception desk (curved front made of rounded panels) with a computer and a bell.
    k.push(-2.0, 0, -1.4);
    k.add(roundedBox(1.9, 1.05, 0.6, 0.04, 3), M.white, 0, 0.525, 0);
    k.add(roundedBox(2.0, 0.04, 0.7, 0.015), M.woodPale, 0, 1.07, 0.02);
    k.add(roundedBox(1.9, 0.12, 0.02, 0.006), new THREE.MeshStandardMaterial({ color: 0x1aa87a, emissive: 0x1aa87a, emissiveIntensity: 0.4 }), 0, 0.85, 0.31);
    k.add(roundedBox(0.45, 0.3, 0.03, 0.01), M.black, -0.4, 1.3, -0.1);
    k.add(roundedBox(0.41, 0.26, 0.01, 0.004), M.screenGlow, -0.4, 1.3, -0.08);
    k.add(roundedBox(0.4, 0.015, 0.14, 0.004), M.black, -0.4, 1.1, 0.05);
    k.add(lathe([[0, 0], [0.04, 0], [0.04, 0.01], [0.035, 0.04], [0.01, 0.06], [0, 0.07]], 14, 'bell'), M.brass, 0.5, 1.09, 0.15);
    for (let i = 0; i < 6; i++) k.add(roundedBox(0.22, 0.006, 0.3, 0.002), M.paper, 0.2, 1.093 + i * 0.006, -0.05, 0.05 * i);
    k.pop();
    this.block(-2.0, -1.4, 2.0, 0.7, 1.1);
    // Waiting chairs: a row of steel seats on a beam.
    k.push(-0.3, 0, 1.7);
    k.add(roundedBox(2.2, 0.05, 0.06, 0.02), M.steel, 0, 0.3, 0);
    for (const x of [-0.95, 0.95]) k.add(roundedBox(0.06, 0.3, 0.5, 0.02), M.steel, x, 0.15, 0);
    this.waitSeats = [];
    for (let i = 0; i < 4; i++) {
      const x = -0.75 + i * 0.5;
      k.add(roundedBox(0.44, 0.04, 0.42, 0.02), M.plasticBlue, x, 0.45, 0);
      k.add(roundedBox(0.44, 0.38, 0.03, 0.014), M.plasticBlue, x, 0.68, -0.2, 0, -0.12);
      k.add(CYL(0.02, 0.02, 0.15, 8), M.steel, x, 0.36, 0);
    }
    k.pop();
    this.block(-0.3, 1.7, 2.2, 0.5, 0.5);
    for (let i = 0; i < 4; i++) this.waitSeats.push(this.seat(-1.05 + i * 0.5, 1.68, 0, { seatY: 0.47, footZ: 0.42 }, 'chair', 'lap'));
    for (const s of this.waitSeats) s.front = 'front';

    // Treatment bay on the east side: curtain rail, bed, drip stand, cabinet.
    k.push(2.3, 0, -1.6, -Math.PI / 2);
    k.add(roundedBox(1.9, 0.08, 0.75, 0.02), M.steel, 0, 0.6, 0);
    for (const [x, z] of [[0.85, 0.3], [-0.85, 0.3], [0.85, -0.3], [-0.85, -0.3]]) k.add(CYL(0.025, 0.025, 0.6, 8), M.steel, x, 0.3, z);
    k.add(roundedBox(1.85, 0.1, 0.7, 0.04, 3), M.leatherBrown, 0, 0.69, 0);
    k.add(roundedBox(0.5, 0.08, 0.68, 0.035, 3), M.leatherBrown, -0.7, 0.78, 0, 0, 0, 0.25);
    k.add(roundedBox(1.3, 0.003, 0.66, 0.001), M.paper, 0.2, 0.745, 0);
    k.pop();
    this.block(2.3, -1.6, 0.8, 1.95, 0.8);
    this.bedSeat = this.seat(2.3 - 0.0, -1.0, Math.PI / 2 + Math.PI, { seatY: 0.74, footY: 0, footZ: 0.42 }, 'bed', 'lap');
    this.bedSeat.heading = -Math.PI / 2; this.bedSeat.x = 1.98; this.bedSeat.front = 'front';
    // Drip stand.
    k.push(1.5, 0, -2.5);
    k.add(lathe([[0, 0], [0.25, 0], [0.25, 0.02], [0, 0.03]], 5, 'dripbase'), M.steel);
    k.add(CYL(0.012, 0.012, 1.8, 8), M.steel, 0, 0.9, 0);
    k.add(tube([[-0.15, 1.85, 0], [0, 1.8, 0], [0.15, 1.85, 0]], 0.008, 10, 6), M.steel);
    k.add(roundedBox(0.1, 0.16, 0.04, 0.02), M.glassClear, 0.13, 1.7, 0);
    k.add(tube([[0.13, 1.6, 0], [0.18, 1.1, 0.05], [0.4, 0.8, 0.1]], 0.003, 16, 4), M.glassClear);
    k.pop();
    // Curtain on a ceiling rail, half drawn.
    k.add(tube([[1.2, 2.4, -3.0], [1.2, 2.4, -0.4], [3.5, 2.4, -0.4]], 0.012, 20, 6), M.steel);
    const cg = new THREE.PlaneGeometry(1.4, 2.0, 24, 2), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 18) * 0.04);
    cg.computeVertexNormals(); cg.translate(0, 1.38, 0);
    const curtainMat = new THREE.MeshStandardMaterial({ color: 0x9ad0c8, roughness: 0.9, side: THREE.DoubleSide });
    k.add(cg, curtainMat, 1.2, 0, -2.25, Math.PI / 2);
    k.add(cg, curtainMat, 2.75, 0, -0.4, 0, 0, 0);
    // Glass medicine cabinet on the north wall.
    k.push(-0.2, 0, -2.78);
    k.add(roundedBox(1.2, 1.9, 0.4, 0.02), M.white, 0, 0.95, 0);
    for (let lv = 0; lv < 4; lv++) {
      k.add(roundedBox(1.1, 0.015, 0.34, 0.005), M.glassClear, 0, 0.6 + lv * 0.35, 0);
      for (let i = 0; i < 8; i++) k.add(lathe([[0, 0], [0.03, 0], [0.03, 0.09], [0.015, 0.11], [0.015, 0.13], [0, 0.13]], 10, 'medjar'), [M.glassBrown, M.glassClear, M.glassBlue][(i + lv) % 3], -0.45 + i * 0.13, 0.61 + lv * 0.35, 0.02);
    }
    k.add(roundedBox(1.12, 1.4, 0.015, 0.006), M.glass, 0, 1.2, 0.2);
    k.pop();
    this.block(-0.2, -2.78, 1.2, 0.42, 1.9);
    // A scale, a plant, posters, a clock, a fan.
    k.push(-3.1, 0, 0.4);
    k.add(roundedBox(0.36, 0.06, 0.4, 0.02), M.white, 0, 0.03, 0);
    k.add(CYL(0.02, 0.02, 1.3, 8), M.steel, 0, 0.7, -0.15);
    k.add(roundedBox(0.3, 0.05, 0.04, 0.01), M.steel, 0, 1.35, -0.12);
    k.pop();
    this.block(-3.1, 0.4, 0.4, 0.4, 1.3);
    k.push(3.0, 0, 2.4); pottedPlant(k, M, 1.0, 12); k.pop();
    k.push(-3.45, 1.9, -0.6, Math.PI / 2); poster(k, M, 'health', 0.5, 0.7, M.white); k.pop();
    k.push(1.4, 1.85, 2.92, Math.PI); poster(k, M, 'wanted', 0.4, 0.56); k.pop();
    const clockG = new THREE.Group(); this.dynamic.add(clockG);
    k.push(-2.0, 2.45, -2.92); this.clock = wallClock(k, M, clockG); k.pop();
    k.push(0.3, 0, 0.3); this.fan = ceilingFan(k, M, this.dynamic, H, 0.35); k.pop();
    for (const [x, z] of [[-1.6, -1.0], [2.2, -1.6], [-0.3, 1.5]]) { k.add(roundedBox(1.2, 0.05, 0.25, 0.02), M.white, x, H - 0.03, z); k.add(roundedBox(1.1, 0.02, 0.2, 0.008), M.bulbCool, x, H - 0.06, z); }
    contactShadow(k, 0.1, 0.1);

    this.ambient(0xf0f8f8, 0x7a8080, 0.95);
    this.spotLight(-1.6, H - 0.08, -1.0, -1.6, 0, -1.2, { intensity: 24, angle: 1.25, dist: 6, color: 0xf4faff });
    this.spotLight(2.2, H - 0.08, -1.6, 2.2, 0, -1.6, { intensity: 22, angle: 1.1, dist: 6, color: 0xf4faff, mapSize: 512 });
    this.point(-0.3, 2.4, 1.5, 0xf4faff, 3.5, 5);
    this.point(0, 1.6, 2.4, 0xff9a58, 2, 4);

    this.animated.push((dt, t, game) => {
      this.fan.rotation.y += dt * 4;
      const hr = game.weather?.clock?.hour ?? 20;
      this.clock.hour.rotation.z = -(hr % 12) / 12 * Math.PI * 2;
      this.clock.min.rotation.z = -((hr * 60) % 60) / 60 * Math.PI * 2;
    });

    // Suster Ratih at the desk; a patient waiting.
    const ratih = new InteriorNpc(generateLook(6620, 'auto', {
      gender: 'f', age: 'adult', name: 'Suster Ratih', hair: 'hijab', scarfColor: 0xe8f0ee,
      top: { kind: 'shirt', color: 0x7ac0b4, pattern: 'plain', longSleeves: true, tucked: false },
      bottom: { kind: 'trousers', color: 0x5a9a90, pattern: 'plain' },
    }), -2.0, -2.15, 0, { name: 'Suster Ratih', role: 'nurse', plan: (n) => this.planNurse(n) });
    ratih.talkScript = 'nurse';
    this.nurse = this.addNpc(ratih);
    const pat = new InteriorNpc(generateLook(6711, 'auto', { age: 'old' }), this.waitSeats[0].x, this.waitSeats[0].z, 0, { plan: (n) => { if (Math.random() < 0.3) n.gesture('stretch', 2.2); else n.wait(3 + Math.random() * 3, { x: -2, z: -1.4, y: 1.3 }); } });
    pat.seat = this.waitSeats[0]; this.waitSeats[0].occupant = pat; pat.sitK = 1; pat.talkScript = 'patron';
    this.addNpc(pat);
  }

  planNurse(n) {
    const r = Math.random();
    if (r < 0.45) n.walk([[-2.0, -2.15]]).face(0, 0.5).gesture('type', 2.6);
    else if (r < 0.65) n.walk([[-0.6, -2.3]]).face(Math.PI, 0.5).gesture('serve', 1.2).wait(0.8);
    else if (r < 0.8) n.walk([[1.4, -1.0]]).face(Math.PI / 2, 0.5).gesture('wipe', 2.0);
    else n.walk([[-2.0, -2.15]]).face(0, 0.5).wait(2.5, { x: 0, z: 1.5, y: 1.3 });
  }

  beginTalk(conv, npc, mgr) {
    const g = conv.game, b = g.player.body;
    if (npc !== this.nurse) {
      conv.say('raka', 'Evening.');
      conv.npc(pick(['My knee again. Every time it rains.', 'Ratih is the best nurse in Sanggara. Don\'t tell the doctor.', 'Waiting, always waiting.']));
      conv.interiorChoices = conv.pendingChoices = [];
      return true;
    }
    conv.say('raka', pick(['Evening, Suster.', 'Hello.']));
    const hurt = b.health < b.maxHealth * 0.6;
    conv.npc(hurt ? 'Ya Allah, look at you! Sit, sit, let me see.' : 'Good evening. How can I help?');
    const list = [
      { label: `Patch me up. (${formatMoney(40)})`, run: () => {
        conv.say('raka', 'Can you patch me up?');
        if (!mgr.pay(40, 'Treatment')) { conv.npc('I am sorry, the clinic needs the fee for the medicine.'); return false; }
        conv.npc('Hold still. This will sting a little.');
        npc.clear(); npc.gesture('serve', 1.4).gesture('wipe', 2.0);
        b.health = b.maxHealth;
        g.hud.notify('Treated · health restored', 'xp');
        return false;
      } },
      { label: `Vitamin injection. (${formatMoney(15)})`, run: () => {
        conv.say('raka', 'One of those vitamin shots.');
        if (!mgr.pay(15, 'Vitamins')) { conv.npc('Come back when you have the money.'); return false; }
        conv.npc('There. You will feel it in ten minutes.');
        b.health = Math.min(b.maxHealth, b.health + 25); g.player.stamina = 1;
        g.hud.notify('Vitamins · +25 health, stamina', 'xp');
        return false;
      } },
      { label: 'Just passing by.', run: () => { conv.say('raka', 'Just passing by.'); conv.npc('Stay safe out there. I see too many young men in here.'); return false; } },
    ];
    conv.interiorChoices = conv.pendingChoices = list;
    return true;
  }
}
