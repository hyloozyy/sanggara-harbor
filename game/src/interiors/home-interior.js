// Raka's room above the shop: a small rented flat. A bedroom with a teak bed, batik sheets and
// a bolster (guling), a wardrobe and a desk with his old ship's photo; a kitchen corner with a
// two-burner stove on its green LPG "melon" tank, a rice cooker, a fridge and a water gallon;
// a living room with a sofa, a rug and a TV showing the football; a tiled bathroom. Sleep in
// the bed to save (and wake up in the morning), cook noodles, grab a drink, watch TV.
import * as THREE from 'three';
import { Interior } from './interior-base.js';
import { roundedBox, lathe, roundedCylinder, tube } from './shapes.js';
import {
  sofa, turnedTable, plasticChair, ceilingFan, pendantLamp, poster, duskWindow, pottedPlant, wallClock, coatRack, contactShadow, CYL, SPHERE, PLANE,
} from './furniture.js';
import { rugTexture, tvScreenTexture, batikTexture } from './interior-textures.js';
import { formatMoney } from '../core/math-utils.js';

export class HomeInterior extends Interior {
  constructor() {
    super('home', { name: "Raka's Room", ceiling: 2.9 });
    this.envCenter = { x: 1.2, y: 1.5, z: 1.2 };
    this.envIntensity = 0.8;
    this.audioState = { music: 0, chatter: 0, street: 0.45, room: 'home' };
    this.views = {
      overview: [3.7, 2.4, 3.2, -0.8, 0.9, -1.6], bedroom: [-0.9, 1.7, 0.2, -3.2, 0.6, -2.0], kitchen: [1.2, 1.7, 1.2, 2.6, 1.0, -3.2],
      living: [-0.2, 1.6, -0.6, 3.0, 0.8, 2.4], door: [1.5, 1.7, -1.2, 2.6, 1.2, 3.4], bath: [-1.0, 1.7, 1.6, -3.2, 0.8, 2.6],
    };
  }

  floorAt(x) { return x < -0.6 ? 'wood' : 'wood'; }

  layout(k, M) {
    const H = this.ceilingY;
    this.world = { collision: this.collision, groundAt: () => 0 };
    // ---------------------------------------------------------------- shell
    // Flat x -4..4, z -3.5..3.5. Bedroom NW (x -4..-0.6, z -3.5..0.6), bathroom SW, kitchen N, living S.
    this.floor(k, -4, -3.5, 4, 3.5, M.floorPlankPale);
    const tg = new THREE.PlaneGeometry(4.4, 2.6); tg.rotateX(-Math.PI / 2);
    const tu = tg.attributes.uv; for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) * 4.4, tu.getY(i) * 2.6);
    k.add(tg, M.tegelGreen, 1.8, 0.004, -2.2);
    const bg = new THREE.PlaneGeometry(3.3, 2.8); bg.rotateX(-Math.PI / 2);
    const bu = bg.attributes.uv; for (let i = 0; i < bu.count; i++) bu.setXY(i, bu.getX(i) * 3.3, bu.getY(i) * 2.8);
    k.add(bg, M.tileWhite, -2.3, 0.004, 2.05);
    const c = [1.5, 1.5];
    this.wall(k, -4, -3.5, 4, -3.5, { inside: c, upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak, openings: [{ at: 1.2, w: 1.1, h: 2.2, sill: 1.0 }, { at: 5.0, w: 1.4, h: 2.2, sill: 1.15 }] });
    this.wall(k, -4, 3.5, 4, 3.5, { inside: c, upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak, openings: [{ at: 6.0, w: 1.0, h: 2.15 }] });
    this.wall(k, -4, -3.5, -4, 3.5, { inside: c, upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak });
    this.wall(k, 4, -3.5, 4, 3.5, { inside: c, upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak, openings: [{ at: 4.2, w: 1.2, h: 2.2, sill: 1.0 }] });
    // Bedroom partition with a door into the living room; bathroom walls.
    this.wall(k, -0.6, -3.5, -0.6, 0.6, { inside: [1, -1], upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak, both: true, other: { upper: M.plasterOchre, lower: null }, openings: [{ at: 2.5, w: 0.9, h: 2.1 }] });
    this.wall(k, -4, 0.6, -0.6, 0.6, { inside: [-2, -1], upper: M.plasterOchre, lower: null, both: true, other: { upper: M.tileWhite, lower: null } });
    this.wall(k, -0.6, 0.6, -0.6, 3.5, { inside: [1, 2], upper: M.plasterCream, lower: M.plasterSky, lowerH: 0.9, rail: M.woodTeak, both: true, other: { upper: M.tileWhite, lower: null }, openings: [{ at: 1.9, w: 0.8, h: 2.05 }] });
    this.exitDoor = this.door(k, 2.5, 3.42, Math.PI, { w: 1.0, h: 2.15, mat: M.woodTeak, swing: -1, auto: false });
    this.entry = { x: 2.5, z: 2.45, heading: Math.PI };
    this.exitSpot = this.spot(2.5, 2.85, 1.0, 'Go outside', null); this.exitSpot.exit = true;
    this.door(k, -0.68, -0.55, -Math.PI / 2, { w: 0.85, h: 2.05, mat: M.woodTeak, swing: 1 });
    this.door(k, -0.68, 2.9, -Math.PI / 2, { w: 0.75, h: 2.0, mat: M.white, swing: 1, sign: 'WC', signBg: '#e8f0f4' });
    for (const [x, z, w, sill, ry] of [[-2.25, -3.5, 1.1, 1.0, 0], [1.7, -3.5, 1.4, 1.15, 0], [4, 1.3, 1.2, 1.0, -Math.PI / 2]]) {
      k.push(x, (sill + 2.2) / 2, z, ry); duskWindow(k, M, w, 2.2 - sill, false, M.white); k.pop();
    }
    // Curtains (batik) beside the windows.
    const cur = new THREE.MeshStandardMaterial({ map: batikTexture(0x1a2a4a, 0xd8c8a0), roughness: 0.9, side: THREE.DoubleSide });
    const curtain = curtainGeo(0.45, 1.5);
    for (const [x, z, ry] of [[-2.95, -3.4, 0], [-1.55, -3.4, 0], [3.9, 0.45, -Math.PI / 2], [3.9, 2.15, -Math.PI / 2]]) k.add(curtain, cur, x, 2.25, z, ry);
    k.add(CYL(0.012, 0.012, 1.9, 6), M.woodTeak, -2.25, 2.3, -3.38, 0, 0, Math.PI / 2);

    // ---------------------------------------------------------------- bedroom
    k.push(-2.8, 0, -1.5, Math.PI / 2);
    bed(k, M);
    k.pop();
    this.block(-2.8, -1.5, 2.1, 1.55, 0.6);
    this.bedSeat = this.seat(-2.55, -0.86, 0, { seatY: 0.52, footZ: 0.38 }, 'bed', 'lap');
    this.bedSeat.front = 'front';
    this.spot(-2.4, -0.3, 1.1, 'Sleep until morning (save the game)', (g, mgr) => mgr.sleep(this.bedSeat));
    // Nightstand with a lamp and a phone charger cable.
    k.push(-3.65, 0, 0.05);
    k.add(roundedBox(0.45, 0.5, 0.4, 0.02), M.woodTeak, 0, 0.25, 0);
    k.add(roundedBox(0.4, 0.15, 0.02, 0.008), M.woodMid, 0, 0.36, 0.2);
    k.add(lathe([[0.08, 0], [0.09, 0.02], [0.03, 0.05], [0.02, 0.28], [0, 0.28]], 14, 'lampbase'), M.brass, 0.05, 0.5, -0.05);
    k.add(lathe([[0.15, 0.22], [0.1, 0.42], [0.09, 0.43]], 20, 'lampshade2'), M.paperShade, 0.05, 0.5, -0.05);
    k.add(roundedBox(0.07, 0.01, 0.14, 0.004), M.black, -0.1, 0.505, 0.05, 0.3);
    k.pop();
    this.block(-3.65, 0.05, 0.45, 0.4, 0.6);
    this.point(-3.55, 1.0, 0.0, 0xffc070, 2.2, 3.5);
    // Wardrobe (lemari) against the north wall with a mirror door.
    k.push(-1.4, 0, -3.18);
    k.add(roundedBox(1.15, 2.0, 0.55, 0.02), M.woodTeak, 0, 1.0, 0);
    k.add(roundedBox(1.25, 0.08, 0.6, 0.02), M.woodTeak, 0, 2.04, 0);
    k.add(roundedBox(0.52, 1.7, 0.02, 0.01), M.woodMid, -0.28, 1.05, 0.28);
    k.add(roundedBox(0.44, 1.5, 0.012, 0.006), M.mirror, 0.28, 1.05, 0.285);
    k.add(roundedBox(0.52, 1.7, 0.02, 0.01), M.woodTeak, 0.28, 1.05, 0.276);
    for (const x of [-0.05, 0.05]) k.add(CYL(0.008, 0.008, 0.1, 8), M.brass, x, 1.1, 0.31);
    k.add(roundedBox(0.4, 0.28, 0.35, 0.03), M.leatherBrown, 0.1, 2.22, 0);
    k.pop();
    this.block(-1.4, -3.18, 1.2, 0.6, 2.1);
    // Batik hanging and a framed photo of his ship over the bed.
    k.add(roundedBox(1.3, 0.85, 0.01, 0.004), M.batik, -3.98 + 0.02, 1.75, -1.5, Math.PI / 2);
    k.add(CYL(0.012, 0.012, 1.45, 6), M.woodTeak, -3.95, 2.2, -1.5, 0, Math.PI / 2);
    k.push(-0.75, 1.55, -2.2, -Math.PI / 2); poster(k, M, 'ship', 0.32, 0.45, M.woodTeak); k.pop();
    // A small rug by the bed.
    k.add(rugPlane(1.4, 0.8), new THREE.MeshStandardMaterial({ map: rugTexture(0x2a4a6a, 0xd8b070, 0x8a2a2a), roughness: 0.95 }), -1.8, 0.008, -1.5, Math.PI / 2);
    k.push(-1.6, 0, 0.25); pottedPlant(k, M, 0.8, 9); k.pop();
    k.push(-2.3, 0, -1.5); pendantLamp(k, M, H, 0.55, M.paperShade, true); k.pop();

    // ---------------------------------------------------------------- kitchen
    k.push(1.85, 0, -3.15);
    kitchenCounter(k, M, 3.2);
    k.pop();
    this.block(1.85, -3.15, 3.2, 0.62, 0.95);
    k.push(3.62, 0, -3.1); fridge(k, M); k.pop();
    this.block(3.62, -3.1, 0.66, 0.66, 1.75);
    k.push(0.2, 0, -3.15); waterDispenser(k, M); k.pop();
    this.block(0.2, -3.15, 0.36, 0.36, 1.3);
    this.spot(3.4, -2.3, 1.1, 'Grab a cold drink from the fridge', (g, mgr) => mgr.useOnce('fridge', 45, () => { g.player.body.playGesture('serve', 1.0); setTimeout(() => mgr.drink('tea', 20, 2), 900); g.hud.notify('Es teh from the fridge · +health', 'xp'); }));
    this.spot(1.3, -2.4, 1.0, 'Cook mie goreng', (g, mgr) => mgr.useOnce('stove', 90, () => mgr.cook(this)));
    // Small dining table with two plastic chairs.
    k.push(1.7, 0, -1.25); turnedTable(k, M, 0.9, 0.7, 0.74, M.woodPale, M.woodTeak); k.pop();
    this.block(1.7, -1.25, 0.9, 0.7, 0.76);
    this.diningSeats = [[1.0, -1.25, Math.PI / 2], [2.4, -1.25, -Math.PI / 2]].map(([x, z, hd]) => { k.push(x, 0, z, hd); plasticChair(k, M, M.plasticBlue); k.pop(); this.block(x, z, 0.36, 0.36, 0.45); return this.seat(x, z, hd, { seatY: 0.45 }, 'chair', 'table'); });
    k.add(lathe([[0, 0], [0.1, 0], [0.12, 0.05], [0.115, 0.055], [0.095, 0.006], [0, 0.006]], 18, 'plate2'), M.ceramic, 1.55, 0.74, -1.2);
    k.add(roundedBox(0.2, 0.004, 0.14, 0.002), M.batikBlue, 1.85, 0.742, -1.35, 0.3);
    k.push(1.7, 0, -1.6); pendantLamp(k, M, H, 0.9); k.pop();

    // ---------------------------------------------------------------- living room
    k.push(3.45, 0, 1.6, -Math.PI / 2); sofa(k, M, 2.0, M.clothMustard); k.pop();
    this.block(3.45, 1.6, 0.9, 2.0, 0.6);
    this.sofaSeats = [1.15, 2.05].map((z) => { const s = this.seat(3.38, z, -Math.PI / 2, { seatY: 0.55, footZ: 0.45 }, 'sofa', 'lap'); return s; });
    k.add(rugPlane(2.2, 1.6), new THREE.MeshStandardMaterial({ map: rugTexture(0x8a2a2a, 0xd8b070, 0x2a2a3a), roughness: 0.95 }), 1.7, 0.008, 1.6, Math.PI / 2);
    k.push(2.2, 0, 1.6); turnedTable(k, M, 0.5, 0.9, 0.42, M.woodTeak); k.pop();
    this.block(2.2, 1.6, 0.5, 0.9, 0.45);
    k.add(lathe([[0, 0], [0.05, 0], [0.065, 0.06], [0.06, 0.065], [0, 0.06]], 14, 'ashtray2'), M.glassClear, 2.15, 0.42, 1.4);
    k.add(roundedBox(0.16, 0.02, 0.05, 0.008), M.black, 2.25, 0.43, 1.8, 0.4);
    // TV on a low cabinet against the bathroom wall.
    k.push(-0.35, 0, 1.6, Math.PI / 2);
    k.add(roundedBox(1.3, 0.45, 0.4, 0.02), M.woodTeak, 0, 0.225, 0);
    k.add(roundedBox(0.6, 0.12, 0.02, 0.008), M.black, -0.25, 0.3, 0.2);
    k.add(roundedBox(1.05, 0.62, 0.06, 0.012), M.black, 0, 0.82, 0);
    k.add(roundedBox(0.3, 0.04, 0.2, 0.01), M.black, 0, 0.47, 0);
    k.add(CYL(0.025, 0.025, 0.08, 8), M.black, 0, 0.5, 0);
    this.tvTex = tvScreenTexture();
    this.tvMat = new THREE.MeshBasicMaterial({ map: this.tvTex, color: 0x101010, toneMapped: true });
    k.mesh(this.dynamic, PLANE(0.98, 0.55), this.tvMat, 0, 0.82, 0.032);
    k.pop();
    this.block(-0.35, 1.6, 0.42, 1.3, 1.1);
    this.tvLight = this.point(0.3, 0.9, 1.6, 0x6a9aff, 0, 3.5);
    this.tvOn = false;
    this.spot(0.6, 1.6, 1.2, 'Turn the TV on', () => { this.tvOn = !this.tvOn; this.tvSpotLabel(); });
    this.tvSpot = this.spots[this.spots.length - 1];
    k.push(3.95, 1.75, 1.6, -Math.PI / 2); poster(k, M, 'football', 0.45, 0.63, M.woodTeak); k.pop();
    k.push(3.5, 0, 3.0); pottedPlant(k, M, 0.9, 4); k.pop();
    k.push(1.4, 0, 3.15); coatRack(k, M); k.pop(); this.block(1.4, 3.15, 0.3, 0.3, 1.7);
    // Raka's helmet and keys on a shelf by the door, a calendar, a clock.
    k.push(3.2, 1.2, 3.38, Math.PI);
    k.add(roundedBox(0.8, 0.03, 0.22, 0.01), M.woodTeak, 0, 0, 0);
    k.add(lathe([[0, 0], [0.13, 0], [0.14, 0.06], [0.12, 0.15], [0.07, 0.2], [0, 0.21]], 18, 'helmet'), M.redPaint, -0.2, 0.015, 0);
    k.add(roundedBox(0.06, 0.01, 0.03, 0.004), M.brass, 0.15, 0.02, 0.02);
    k.pop();
    const clockG = new THREE.Group(); this.dynamic.add(clockG);
    k.push(0.9, 2.2, -3.42); this.clock = wallClock(k, M, clockG); k.pop();
    this.fan = null;
    k.push(1.9, 0, 1.6); this.fan = ceilingFan(k, M, this.dynamic, H, 0.4); k.pop();

    // ---------------------------------------------------------------- bathroom
    k.push(-3.6, 0, 1.35, Math.PI / 2);
    k.add(roundedBox(0.9, 0.7, 0.7, 0.03), M.tileBlue, 0, 0.35, 0);     // bak mandi (water tub)
    k.add(roundedBox(0.8, 0.05, 0.6, 0.02), M.tileBlue, 0, 0.66, 0);
    k.add(PLANE(0.76, 0.56), M.glassBlue, 0, 0.6, 0, 0, -Math.PI / 2);
    k.add(lathe([[0, 0], [0.08, 0], [0.09, 0.1], [0.085, 0.1], [0, 0.01]], 14, 'gayung'), M.plasticRed, 0.2, 0.69, 0.1);
    k.add(CYL(0.01, 0.01, 0.15, 6), M.plasticRed, 0.32, 0.74, 0.1, 0, 0, Math.PI / 2.4);
    k.pop();
    this.block(-3.6, 1.35, 0.7, 0.9, 0.7);
    k.push(-3.4, 0, 3.05, Math.PI);
    k.add(lathe([[0.12, 0], [0.17, 0.05], [0.19, 0.3], [0.2, 0.4], [0.18, 0.41], [0, 0.41]], 20, 'toilet'), M.ceramic, 0, 0, 0.05);
    k.add(roundedBox(0.4, 0.4, 0.18, 0.04), M.ceramic, 0, 0.6, -0.2);
    k.pop();
    this.block(-3.4, 3.05, 0.5, 0.6, 0.6);
    k.push(-1.6, 0, 3.3, Math.PI);
    k.add(roundedBox(0.5, 0.16, 0.4, 0.06), M.ceramic, 0, 0.82, 0);
    k.add(CYL(0.06, 0.08, 0.75, 14), M.ceramic, 0, 0.37, 0);
    k.add(roundedBox(0.45, 0.6, 0.02, 0.01), M.mirror, 0, 1.45, -0.18);
    k.add(tube([[0, 0.9, -0.17], [0, 1.0, -0.1], [0, 0.98, -0.04]], 0.012, 12, 8), M.chrome);
    k.pop();
    this.block(-1.6, 3.3, 0.5, 0.4, 0.9);
    k.add(CYL(0.1, 0.1, 0.04, 16), M.bulbCool, -2.3, H - 0.02, 2.0);

    // ---------------------------------------------------------------- light
    this.ambient(0x9a8a7a, 0x3a2a1a, 0.75);
    this.spotLight(1.8, H - 0.05, -1.4, 1.8, 0, -1.8, { intensity: 22, angle: 1.2, dist: 6, color: 0xffd8a8 });
    this.spotLight(1.9, H - 0.05, 1.8, 2.2, 0, 1.6, { intensity: 20, angle: 1.2, dist: 6, color: 0xffcf98, mapSize: 512 });
    this.point(-2.3, 2.2, -1.5, 0xffc078, 3.5, 5);
    this.point(-2.3, 2.5, 2.0, 0xf0f4ff, 3, 4);
    // Dusk light through the windows.
    this.point(-2.25, 1.8, -3.0, 0xff9a58, 2.5, 4);
    this.point(3.5, 1.8, 1.3, 0xff9a58, 2.5, 4);
    this.point(1.7, 2.0, -2.9, 0xff9a58, 2.0, 4);

    // ---------------------------------------------------------------- animation
    this.gecko = this.makeGecko(M);
    this.animated.push((dt, t, game) => {
      if (this.fan) this.fan.rotation.y += dt * 3.6;
      const hr = game.weather?.clock?.hour ?? 20;
      this.clock.hour.rotation.z = -(hr % 12) / 12 * Math.PI * 2;
      this.clock.min.rotation.z = -((hr * 60) % 60) / 60 * Math.PI * 2;
      this.updateTv(t);
      // The house gecko (cicak) scuttles a little now and then.
      const gk = this.gecko, ph = t * 0.35;
      const run = Math.max(0, Math.sin(ph)) ** 6;
      gk.position.x = 3.98 - 0.0; gk.position.y = 2.2 + Math.sin(t * 0.11) * 0.3; gk.position.z = -1.6 + Math.sin(t * 0.13) * 0.6 + run * 0.05;
      gk.rotation.x = Math.sin(t * 0.13 + 0.8) * 0.8;
    });
  }

  tvSpotLabel() { this.tvSpot.label = this.tvOn ? 'Turn the TV off' : 'Turn the TV on'; }

  // The football on the TV: a pitch, little players running about, the ball, the score.
  updateTv(t) {
    const tex = this.tvTex, ctx = tex.userData.ctx;
    this.tvMat.color.setScalar(this.tvOn ? 1.6 : 0.06);
    this.tvLight.intensity = this.tvOn ? 1.4 + Math.sin(t * 7) * 0.3 + Math.sin(t * 2.3) * 0.2 : 0;
    if (!this.tvOn) return;
    if ((this.tvT = (this.tvT || 0) + 1) % 3) return;
    ctx.fillStyle = '#2a8a3a'; ctx.fillRect(0, 0, 256, 144);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? '#2f9440' : '#28843a'; ctx.fillRect(i * 32 - ((t * 30) % 64), 0, 32, 144); }
    ctx.strokeStyle = '#e8f0e8'; ctx.lineWidth = 2; ctx.strokeRect(10, 14, 236, 120); ctx.beginPath(); ctx.moveTo(128 - (t * 30) % 64, 14); ctx.lineTo(128 - (t * 30) % 64, 134); ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const x = 128 + Math.sin(t * 0.7 + i * 1.7) * 90, y = 74 + Math.cos(t * 0.9 + i * 2.3) * 45;
      ctx.fillStyle = i < 5 ? '#c82a2a' : '#f0f0f0'; ctx.fillRect(x - 2, y - 6, 5, 8); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, y + 2, 5, 3);
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128 + Math.sin(t * 1.3) * 80, 74 + Math.cos(t * 1.7) * 40, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(6, 4, 92, 14); ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('PSG 1 - 1 PSM  67\'', 10, 15);
    tex.needsUpdate = true;
  }

  makeGecko(M) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 4, 8), new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.6 }));
    body.rotation.x = Math.PI / 2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.08, 6), body.material); tail.position.z = -0.07; tail.rotation.x = -Math.PI / 2;
    g.add(body, tail);
    for (const [x, z] of [[0.02, 0.025], [-0.02, 0.025], [0.02, -0.02], [-0.02, -0.02]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 4), body.material); l.position.set(x, 0, z); l.rotation.z = Math.PI / 2; g.add(l); }
    g.rotation.y = -Math.PI / 2;
    const pivot = new THREE.Group(); pivot.add(g); pivot.rotation.y = -Math.PI / 2;
    const wrapper = new THREE.Group(); wrapper.add(pivot);
    this.dynamic.add(wrapper);
    void M;
    return wrapper;
  }

  onEnter(g) { this.tvSpotLabel(); void g; }
}

// The bed: teak frame with a carved headboard, mattress, batik sheet, two pillows and a bolster.
function bed(k, M) {
  const L = 2.0, W = 1.45;
  k.add(roundedBox(W + 0.08, 0.28, L + 0.06, 0.02), M.woodTeak, 0, 0.2, 0);
  for (const [x, z] of [[W / 2, L / 2], [-W / 2, L / 2], [W / 2, -L / 2], [-W / 2, -L / 2]]) k.add(roundedBox(0.08, 0.2, 0.08, 0.02), M.woodTeak, x, 0.1, z);
  // Headboard: an arched panel with a carved band.
  const arch = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); arch.push([Math.cos(a) * W / 2, 0.75 + Math.sin(a) * 0.22]); }
  const s = new THREE.Shape(); s.moveTo(W / 2 + 0.04, 0); for (const [x, y] of arch) s.lineTo(x * 1.05, y); s.lineTo(-W / 2 - 0.04, 0); s.closePath();
  const hg = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
  k.add(hg, M.woodTeak, 0, 0.12, -L / 2 - 0.06);
  k.add(roundedBox(W * 0.7, 0.18, 0.02, 0.008), M.woodMid, 0, 0.78, -L / 2 - 0.0);
  k.add(roundedBox(W + 0.06, 0.45, 0.05, 0.015), M.woodTeak, 0, 0.32, L / 2 + 0.02);
  // Mattress and sheet.
  k.add(roundedBox(W - 0.04, 0.2, L - 0.06, 0.07, 3), M.mattress, 0, 0.44, 0);
  k.add(roundedBox(W + 0.0, 0.08, L * 0.62, 0.035, 3), M.batik, 0, 0.53, L * 0.18);
  k.add(roundedBox(W + 0.02, 0.18, 0.02, 0.01), M.batik, 0, 0.45, L / 2 - 0.0);
  // Pillows (squashed rounded boxes) and the guling bolster.
  for (const x of [-0.33, 0.33]) k.add(roundedBox(0.55, 0.13, 0.36, 0.06, 3), M.pillow, x, 0.6, -L / 2 + 0.28, 0, 0.12);
  const bol = new THREE.CapsuleGeometry(0.09, 0.75, 6, 14); bol.rotateX(Math.PI / 2);
  k.add(bol, M.clothCream, 0.48, 0.62, 0.15, 0.15);
  contactShadow(k, W + 0.4, L + 0.4);
}

function kitchenCounter(k, M, len) {
  k.add(roundedBox(len, 0.86, 0.58, 0.015), M.creamPaint, 0, 0.43, 0);
  const n = Math.round(len / 0.55);
  for (let i = 0; i < n; i++) { const x = -len / 2 + (i + 0.5) * len / n; k.add(roundedBox(len / n - 0.03, 0.7, 0.02, 0.01), M.mint, x, 0.42, 0.29); k.add(roundedBox(0.1, 0.015, 0.02, 0.006), M.steel, x, 0.7, 0.31); }
  k.add(roundedBox(len + 0.04, 0.04, 0.62, 0.012), M.terrazzo, 0, 0.88, 0.01);
  k.add(roundedBox(len, 0.6, 0.02, 0.005), M.tileWhite, 0, 1.2, -0.3);
  // Sink.
  k.add(roundedBox(0.5, 0.02, 0.38, 0.01), M.steel, 0.9, 0.905, 0);
  k.add(roundedBox(0.44, 0.015, 0.32, 0.01), M.black, 0.9, 0.91, 0);
  k.add(tube([[0.9, 0.9, -0.24], [0.9, 1.1, -0.22], [0.9, 1.12, -0.1]], 0.012, 12, 8), M.chrome);
  // Dish rack with plates.
  k.push(1.4, 0.9, 0);
  k.add(roundedBox(0.36, 0.02, 0.26, 0.008), M.plasticBlue, 0, 0.01, 0);
  for (let i = 0; i < 5; i++) k.add(CYL(0.1, 0.1, 0.01, 18), M.ceramic, -0.12 + i * 0.06, 0.11, 0, 0, Math.PI / 2, 0.2);
  k.pop();
  // Two-burner stove on the counter with a wok; the green LPG tank below.
  k.push(-0.6, 0.9, 0);
  k.add(roundedBox(0.62, 0.1, 0.4, 0.02), M.black, 0, 0.05, 0);
  for (const x of [-0.15, 0.15]) { k.add(ring(0.06, 0.01), M.iron, x, 0.11, 0); k.add(CYL(0.025, 0.025, 0.02, 10), M.iron, x, 0.11, 0); }
  k.add(lathe([[0, 0], [0.08, 0.005], [0.16, 0.05], [0.17, 0.08], [0.165, 0.08], [0.15, 0.05], [0.075, 0.012], [0, 0.008]], 24, 'wok'), M.iron, -0.15, 0.125, 0);
  k.add(lathe([[0.07, 0], [0.08, 0.1], [0.06, 0.14], [0.02, 0.15], [0.015, 0.18], [0, 0.18]], 16, 'kettle'), M.steel, 0.15, 0.12, 0);
  k.pop();
  k.add(lathe([[0, 0], [0.13, 0], [0.15, 0.04], [0.15, 0.24], [0.12, 0.3], [0.04, 0.32], [0.04, 0.36], [0, 0.36]], 18, 'lpg'), M.greenPaint, -0.6, 0.0, 0.05);
  // Rice cooker, jars of spices, a bottle of kecap.
  k.add(lathe([[0, 0], [0.12, 0], [0.13, 0.03], [0.13, 0.18], [0.11, 0.21], [0.06, 0.23], [0, 0.24]], 20, 'ricecooker'), M.white, 0.1, 0.9, -0.05);
  for (let i = 0; i < 4; i++) k.add(lathe([[0, 0], [0.035, 0], [0.035, 0.1], [0.03, 0.11], [0.03, 0.13], [0, 0.13]], 12, 'jar'), M.glassClear, 0.4 + i * 0.08, 0.9, -0.22);
  k.add(CYL(0.035, 0.035, 0.01, 12), M.redPaint, 0.4, 1.04, -0.22);
  // Wall shelf with pans.
  k.add(roundedBox(1.2, 0.03, 0.22, 0.01), M.woodTeak, 0.3, 1.65, -0.18);
  for (let i = 0; i < 3; i++) k.add(lathe([[0, 0], [0.09 - i * 0.01, 0], [0.1 - i * 0.01, 0.08], [0, 0.08]], 16, 'pan' + i), M.copper, -0.05 + i * 0.25, 1.665, -0.18);
}

function fridge(k, M) {
  k.add(roundedBox(0.62, 1.7, 0.62, 0.05, 3), M.fridgeWhite, 0, 0.86, 0);
  k.add(roundedBox(0.6, 0.01, 0.01, 0.004), M.steel, 0, 1.2, 0.31);
  for (const y of [0.75, 1.45]) k.add(roundedBox(0.03, 0.3, 0.04, 0.012), M.steel, -0.24, y, 0.33);
  // Magnets and a note.
  k.add(roundedBox(0.12, 0.16, 0.003, 0.001), M.paper, 0.05, 1.4, 0.312, 0.08);
  for (const [x, y, m] of [[0.12, 1.5, M.redPaint], [-0.05, 1.3, M.bluePaint], [0.15, 1.0, M.plasticGreen]]) k.add(CYL(0.018, 0.018, 0.01, 10), m, x, y, 0.315, 0, Math.PI / 2);
  contactShadow(k, 0.9, 0.9);
}

function waterDispenser(k, M) {
  k.add(roundedBox(0.32, 0.95, 0.32, 0.03), M.white, 0, 0.475, 0);
  k.add(roundedBox(0.1, 0.06, 0.04, 0.01), M.plasticBlue, -0.06, 0.62, 0.17);
  k.add(roundedBox(0.1, 0.06, 0.04, 0.01), M.plasticRed, 0.06, 0.62, 0.17);
  k.add(lathe([[0.03, 0], [0.13, 0.03], [0.14, 0.1], [0.14, 0.32], [0.12, 0.36], [0.03, 0.4], [0.025, 0.43], [0, 0.43]], 20, 'galon'), M.glassBlue, 0, 1.38, 0, 0, Math.PI);
}

function ring(R, r) { return new THREE.TorusGeometry(R, r, 6, 20).rotateX(Math.PI / 2); }
function rugPlane(w, d) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return g; }
function curtainGeo(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 16, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x / w * Math.PI * 5) * 0.03); }
  g.computeVertexNormals();
  g.translate(0, -h / 2, 0.04);
  return g;
}

void roundedCylinder; void SPHERE; void formatMoney;
