// Kafe Jangkar: the old harbour bar. A long panelled counter with brass foot rail and beer
// taps, a mirrored back bar with lit shelves of bottles, leather stools, bentwood chairs round
// café tables, a booth under the windows, a pool table under its green lamp, an arched jukebox,
// ceiling fans, neon, posters, a dartboard, a restroom and a back room where the card game
// never ends. Bang Togar tends the bar; regulars drink, chat, laugh and shoot pool.
import * as THREE from 'three';
import { Interior } from './interior-base.js';
import {
  barCounter, backBar, barStool, bentwoodChair, cafeTable, turnedTable, booth, poolTable, jukebox, ceilingFan, pendantLamp,
  billiardLamp, sconce, poster, neonSign, wallClock, duskWindow, pottedPlant, dartboard, speakerBox, coatRack, keg, bottleCrate,
  beerGlassMesh, pintGlass, bottle, CYL, contactShadow,
} from './furniture.js';
import { roundedBox, lathe } from './shapes.js';
import { InteriorNpc, pick } from './interior-npc.js';
import { generateLook } from '../characters/character-generator.js';
import { createRng } from '../core/rng.js';
import { formatMoney } from '../core/math-utils.js';

const MENU = { title: 'KAFE JANGKAR', lines: [['Bir Jangkar', '$6'], ['Es Teh Manis', '$2'], ['Kopi Tubruk', '$3'], ['Arak Bali', '$9'], ['Kacang Rebus', '$2'], ['Pisang Goreng', '$3'], ['Mie Goreng', '$5'], ['Air Kelapa', '$3']] };

const CHAT = [
  'The harbour master raised the fees again. Again!', 'My cousin saw the Hiu Merah boys unloading at midnight.', 'Persis lost three-nil. Three!',
  'Did you hear Ratu Ayu is singing at the Alun-Alun on Saturday?', 'This beer is warm, Togar. Warm like your jokes.', 'The ship from Makassar is late. Storm in the strait.',
  'Ha! You still owe me for last week.', 'One more game, then I go home. Promise.', 'My wife thinks I am at the mosque. Shh.',
  'They are building another tower in Pusat Niaga. Who lives in those?', 'Best pisang goreng in the city, no contest.', 'Rain again tomorrow, my knee says so.',
];
const LAUGH_REPLIES = ['Ha ha ha!', 'Hah! Good one.', 'You are crazy, man.', 'No way!', 'Serius?'];

export class BarInterior extends Interior {
  constructor() {
    super('bar', { name: 'Kafe Jangkar', ceiling: 3.4 });
    this.envCenter = { x: 0, y: 1.7, z: 0 };
    this.envIntensity = 0.75;
    this.audioState = { music: 1, chatter: 1, street: 0.25, room: 'bar' };
    this.district = 'pasar-ikan';
    this.views = {
      overview: [5.6, 2.7, 4.7, -1.2, 1.0, -1.8], counter: [1.2, 1.55, 1.6, 2.4, 1.2, -3.6], pool: [-1.3, 2.0, 2.6, -3.9, 0.7, 0.0],
      door: [0.5, 2.0, -0.8, -3.5, 1.2, 4.6], back: [6.9, 1.75, -1.5, 8.7, 0.8, -3.7], wc: [-6.2, 1.8, -2.3, -8.1, 0.9, -4.1], booth: [1.0, 1.6, 1.9, 3.6, 0.9, 4.4],
    };
  }

  layout(k, M) {
    const H = this.ceilingY, r = createRng(42);
    this.world = { collision: this.collision, groundAt: () => 0 };
    // ----------------------------------------------------------------- shell
    // Main hall x -6..6, z -5..5; restroom west (x -8.6..-6, z -5..-2); back room east (x 6..10, z -5..-1).
    this.floor(k, -6, -5, 6, 5, M.tegelRed);
    this.floor(k, -8.6, -5, -6, -2, M.tileWhite, M.ceiling, 2.8);
    this.floor(k, 6, -5, 10, -1, M.floorPlank, M.ceiling, 3.0);
    const hall = [0, 0];
    this.wall(k, -6, -5, 6, -5, { inside: hall, upper: M.brick, lower: M.woodDark, lowerH: 1.0 });
    this.wall(k, -6, 5, 6, 5, { inside: hall, upper: M.plasterTeal, lower: M.woodDark, lowerH: 1.1, openings: [{ at: 2.0, w: 1.0, h: 2.2 }, { at: 0.4, w: 1.2, h: 2.4, sill: 1.0 }, { at: 3.6, w: 1.2, h: 2.4, sill: 1.0 }, { at: 7.4, w: 1.4, h: 2.4, sill: 1.25 }, { at: 9.6, w: 1.4, h: 2.4, sill: 1.25 }] });
    this.wall(k, -6, -5, -6, 5, { inside: hall, upper: M.plasterTeal, lower: M.woodDark, lowerH: 1.1, openings: [{ at: 0.9, w: 0.9, h: 2.1 }], both: true, other: { upper: M.tileMint, lower: M.tileWhite } });
    this.wall(k, 6, -5, 6, 5, { inside: hall, upper: M.plasterTeal, lower: M.woodDark, lowerH: 1.1, openings: [{ at: 0.8, w: 0.95, h: 2.1 }], both: true, other: { upper: M.plasterOchre, lower: null } });
    // Restroom and back room outer walls.
    const wc = [-7.3, -3.5], back = [8, -3];
    this.wall(k, -8.6, -5, -6, -5, { inside: wc, upper: M.tileMint, lower: M.tileWhite, lowerH: 1.4, h: 2.8, rail: null });
    this.wall(k, -8.6, -2, -6, -2, { inside: wc, upper: M.tileMint, lower: M.tileWhite, lowerH: 1.4, h: 2.8, rail: null });
    this.wall(k, -8.6, -5, -8.6, -2, { inside: wc, upper: M.tileMint, lower: M.tileWhite, lowerH: 1.4, h: 2.8, rail: null, openings: [{ at: 1.1, w: 0.7, h: 2.0, sill: 1.5 }] });
    this.wall(k, 6, -5, 10, -5, { inside: back, upper: M.plasterOchre, h: 3.0, lower: null });
    this.wall(k, 6, -1, 10, -1, { inside: back, upper: M.plasterOchre, h: 3.0, lower: null });
    this.wall(k, 10, -5, 10, -1, { inside: back, upper: M.plasterOchre, h: 3.0, lower: null });
    // Exposed ceiling beams in the hall.
    for (let i = 0; i < 6; i++) k.add(roundedBox(12, 0.22, 0.18, 0.02), M.woodDark, 0, H - 0.11, -4.2 + i * 1.7);
    k.add(roundedBox(0.2, 0.24, 10, 0.02), M.woodDark, 0, H - 0.24 - 0.0, 0);

    // ----------------------------------------------------------------- doors
    // The way out (south wall), the restroom (west) and the back room (east).
    this.exitDoor = this.door(k, -3.5, 5 - 0.08, Math.PI, { w: 1.0, h: 2.2, glass: true, swing: -1, auto: false, max: 1.5 });
    this.entry = { x: -3.5, z: 3.9, heading: Math.PI };
    this.exitSpot = this.spot(-3.5, 4.35, 1.1, 'Leave Kafe Jangkar', null);
    this.exitSpot.exit = true;
    this.door(k, -5.92, -3.65, Math.PI / 2, { w: 0.9, h: 2.1, sign: 'TOILET', swing: -1, mat: M.woodMid });
    this.door(k, 5.92, -3.725, -Math.PI / 2, { w: 0.95, h: 2.1, sign: 'PRIVAT', swing: 1, signBg: '#a82a22', signColor: '#fff0d0' });

    // ----------------------------------------------------------------- the bar
    k.push(2.25, 0, -2.6);
    barCounter(k, M, 6.3, { tapX: 0.4 });
    k.pop();
    this.block(2.25, -2.6, 6.4, 0.75, 1.15);
    this.counterTopY = 1.11;
    k.push(2.25, 0, -4.68);
    backBar(k, M, 6.2, MENU);
    k.pop();
    this.block(2.25, -4.68, 6.2, 0.55, 1.0);
    // Counter return at the west end with a lift-up flap (the bartender's way in).
    k.add(roundedBox(0.62, 1.02, 0.6, 0.02), M.woodDark, -0.95, 0.55, -3.0);
    k.add(roundedBox(0.7, 0.06, 0.7, 0.028), M.woodDark, -0.95, 1.08, -3.0);
    this.block(-0.95, -3.0, 0.65, 0.65, 1.1);
    // Stools along the counter.
    const stoolX = [-0.15, 0.85, 1.85, 2.85, 3.85, 4.85];
    this.stools = stoolX.map((x) => {
      k.push(x, 0, -1.78);
      const s = barStool(k, M);
      k.pop();
      this.block(x, -1.78, 0.3, 0.3, 0.8);
      return this.seat(x, -1.78, Math.PI, { seatY: s.seatY, footY: s.footY, footZ: s.footZ }, 'stool', 'counter');
    });
    // Pendant lamps over the counter, and a few drinks left on it.
    for (const x of [0.2, 1.8, 3.4, 5.0]) { k.push(x, 0, -2.55); pendantLamp(k, M, H, 1.05); k.pop(); }
    pintGlass(k, M, 2.85, this.counterTopY, -2.35, 0.55);
    pintGlass(k, M, 4.85, this.counterTopY, -2.38, 0.3);
    bottle(k, M, 4.3, this.counterTopY, -2.55, 2, M.glassBrown, 0);

    // ----------------------------------------------------------------- tables
    const chairsAround = (cx, cz, n, rad, a0 = 0, arms = 'table') => {
      const seats = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + i / n * Math.PI * 2;
        const x = cx + Math.sin(a) * rad, z = cz + Math.cos(a) * rad, hd = a + Math.PI;
        k.push(x, 0, z, hd); bentwoodChair(k, M); k.pop();
        this.block(x, z, 0.36, 0.36, 0.5);
        seats.push(this.seat(x, z, hd, { seatY: 0.465, footZ: 0.4 }, 'chair', arms));
      }
      return seats;
    };
    k.push(0.6, 0, 1.4); cafeTable(k, M, 0.4); k.pop(); this.block(0.6, 1.4, 0.7, 0.7, 0.75);
    this.tableA = chairsAround(0.6, 1.4, 3, 0.72, 0.4);
    pintGlass(k, M, 0.5, 0.755, 1.3, 0.7); pintGlass(k, M, 0.74, 0.755, 1.5, 0.4);
    k.add(lathe([[0, 0], [0.05, 0], [0.06, 0.02], [0.055, 0.025], [0, 0.02]], 14, 'ashtray'), M.glassClear, 0.62, 0.755, 1.52);
    k.push(3.2, 0, 1.2); cafeTable(k, M, 0.4); k.pop(); this.block(3.2, 1.2, 0.7, 0.7, 0.75);
    this.tableB = chairsAround(3.2, 1.2, 2, 0.72, Math.PI / 2);
    k.add(roundedBox(0.2, 0.004, 0.28, 0.002), M.paper, 3.1, 0.756, 1.2, 0.3);
    // Booth under the east windows with two tables.
    k.push(3.25, 0, 4.62, Math.PI); booth(k, M, 3.6, M.leatherRed); k.pop();
    this.block(3.25, 4.62, 3.6, 0.6, 0.5);
    for (const x of [2.35, 4.15]) { k.push(x, 0, 3.92); turnedTable(k, M, 0.9, 0.6, 0.74, M.woodMid); k.pop(); this.block(x, 3.92, 0.9, 0.6, 0.76); }
    this.boothSeats = [1.85, 2.85, 3.65, 4.65].map((x) => this.seat(x, 4.48, Math.PI, { seatY: 0.5, footZ: 0.42 }, 'chair', 'table'));
    this.boothChairs = [2.35, 4.15].map((x) => { k.push(x, 0, 3.22); bentwoodChair(k, M); k.pop(); this.block(x, 3.22, 0.36, 0.36, 0.5); return this.seat(x, 3.22, 0, { seatY: 0.465 }, 'chair', 'table'); });
    pintGlass(k, M, 4.0, 0.74, 3.85, 0.8); bottle(k, M, 4.3, 0.74, 3.95, 2, M.glassGreen, 0);
    k.add(lathe([[0, 0], [0.09, 0], [0.11, 0.05], [0.105, 0.055], [0.085, 0.006], [0, 0.006]], 18, 'plate'), M.ceramic, 2.3, 0.74, 3.92);
    for (let i = 0; i < 5; i++) k.add(roundedBox(0.09, 0.025, 0.035, 0.012), M.woodPale, 2.28 + (i % 3) * 0.03 - 0.03, 0.765 + Math.floor(i / 3) * 0.02, 3.9 + i * 0.012 - 0.02, i);

    // ----------------------------------------------------------------- pool corner
    k.push(-3.7, 0, 0.3, Math.PI / 2);
    const pt = poolTable(k, M);
    k.pop();
    this.pool = { x: -3.7, z: 0.3, L: pt.L, W: pt.W };
    this.block(-3.7, 0.3, pt.W + 0.06, pt.L + 0.06, 0.86);
    k.push(-3.7, 0, 0.3, Math.PI / 2); billiardLamp(k, M, H, 1.4, 1.75); k.pop();
    // Cue rack on the west wall.
    k.push(-5.9, 1.3, 2.4, Math.PI / 2);
    k.add(roundedBox(0.9, 0.08, 0.06, 0.02), M.woodDark, 0, 0.5, 0.03); k.add(roundedBox(0.9, 0.08, 0.1, 0.02), M.woodDark, 0, -0.75, 0.05);
    for (let i = 0; i < 5; i++) k.add(CYL(0.007, 0.014, 1.45, 8), M.woodPale, -0.32 + i * 0.16, -0.1, 0.08, 0, 0.02);
    k.pop();
    k.push(-5.92, 1.5, -1.6, Math.PI / 2); dartboard(k, M); k.pop();
    k.push(-5.92, 1.65, 3.6, Math.PI / 2); poster(k, M, 'dangdut', 0.55, 0.77); k.pop();

    // ----------------------------------------------------------------- jukebox and music
    const jb = new THREE.Group(); this.dynamic.add(jb);
    k.push(-0.4, 0, 4.55, Math.PI);
    this.jukebox = jukebox(k, M, jb);
    k.pop();
    this.block(-0.4, 4.55, 0.82, 0.64, 1.5);
    this.jukeboxPos = { x: -0.4, z: 4.55 };
    this.spot(-0.4, 3.85, 1.1, `Play the jukebox (${formatMoney(1)})`, (g, mgr) => {
      const songs = [['dangdut', 'Dangdut · "Dockside Sway"'], ['keroncong', 'Keroncong · "Old Port"'], ['funky', 'Funky Kota · "Running Red Lights"'], ['lofi', 'Lo-fi · "Two AM Coffee"'], ['synthwave', 'Synthwave · "Harbour Lights 1986"']];
      g.player.body.playGesture('serve', 1.0);
      mgr.menu([
        ...songs.map(([id, label]) => ({ label, run: () => { if (mgr.pay(1, 'Jukebox')) { mgr.playJukebox(id); g.hud.notify(`♪ ${label}`); this.onMusic(); } } })),
        ...(mgr.jukeboxOn ? [{ label: 'Turn it off', run: () => mgr.stopJukebox() }] : []),
        { label: 'Never mind', run: () => {} },
      ]);
    });
    for (const [x, z, ry] of [[-5.75, -4.75, Math.PI / 4], [5.75, -0.2, -Math.PI / 2]]) { k.push(x, 2.75, z, ry); speakerBox(k, M); k.pop(); }

    // ----------------------------------------------------------------- walls: windows, neon, posters
    for (const [x, w, sill] of [[-5.0, 1.2, 1.0], [-1.8, 1.2, 1.0], [2.1, 1.4, 1.25], [4.3, 1.4, 1.25]]) { k.push(x, (sill + 2.4) / 2, 5, Math.PI); duskWindow(k, M, w, 2.4 - sill, true); k.pop(); }
    this.neon = [];
    k.push(2.25, 2.92, -4.9); this.neon.push(neonSign(k, M, this.dynamic, 'Kafe Jangkar', '#ff3a8a', 2.4, 0.6)); k.pop();
    k.push(-5.9, 2.55, -0.2, Math.PI / 2); this.neon.push(neonSign(k, M, this.dynamic, 'BIR DINGIN', '#40d8ff', 1.5, 0.4)); k.pop();
    k.push(5.9, 2.5, 2.6, -Math.PI / 2); this.neon.push(neonSign(k, M, this.dynamic, '⚓ OPEN ⚓', '#ffd040', 1.1, 0.32)); k.pop();
    k.push(5.92, 1.65, 1.2, -Math.PI / 2); poster(k, M, 'football', 0.55, 0.77, M.woodDark); k.pop();
    k.push(5.92, 1.7, 3.4, -Math.PI / 2); poster(k, M, 'film', 0.5, 0.7); k.pop();
    k.push(-1.0, 1.75, -4.93); poster(k, M, 'beer', 0.5, 0.7, M.brass); k.pop();
    k.push(-4.3, 1.75, -4.93); poster(k, M, 'ship', 0.55, 0.77, M.woodDark); k.pop();
    for (const x of [-5.4, -2.6]) { k.push(x, 2.1, -4.92); sconce(k, M); k.pop(); }
    for (const z of [-2.8, 1.0, 3.8]) { k.push(5.92, 2.1, z, -Math.PI / 2); sconce(k, M); k.pop(); }
    const clockG = new THREE.Group(); this.dynamic.add(clockG);
    k.push(-2.7, 2.6, 4.9, Math.PI); this.clock = wallClock(k, M, clockG); k.pop();
    k.push(-5.4, 0, 4.4); pottedPlant(k, M, 1.2, 3); k.pop();
    k.push(5.4, 0, -0.6); pottedPlant(k, M, 1.0, 5); k.pop();
    k.push(-4.8, 0, 4.6); coatRack(k, M); k.pop(); this.block(-4.8, 4.6, 0.3, 0.3, 1.7);
    // Ceiling fans.
    this.fans = [];
    for (const [x, z] of [[-0.9, 1.6], [3.3, 1.8], [-3.7, -2.6]]) { k.push(x, 0, z); this.fans.push(ceilingFan(k, M, this.dynamic, H, 0.55)); k.pop(); }
    // Doormat and a wet-floor sign by the restroom.
    k.add(roundedBox(1.2, 0.012, 0.7, 0.005), M.rubber, -3.5, 0.006, 4.4);
    k.push(-5.3, 0, -3.0, 0.4);
    k.add(roundedBox(0.3, 0.6, 0.02, 0.01), M.plasticRed, 0, 0.3, 0.1, 0, -0.25); k.add(roundedBox(0.3, 0.6, 0.02, 0.01), M.plasticRed, 0, 0.3, -0.1, 0, 0.25);
    k.pop();

    // ----------------------------------------------------------------- restroom
    k.push(-8.25, 0, -2.6, Math.PI / 2);
    k.add(roundedBox(0.5, 0.18, 0.42, 0.06), M.ceramic, 0, 0.84, 0);
    k.add(lathe([[0.03, 0.62], [0.08, 0.7], [0.1, 0.78], [0, 0.78]], 14, 'basinped'), M.ceramic, 0, 0, 0);
    k.add(CYL(0.06, 0.08, 0.7, 14), M.ceramic, 0, 0.35, -0.05);
    k.add(roundedBox(0.5, 0.7, 0.03, 0.01), M.mirror, 0, 1.55, -0.2);
    k.add(tube2([[0, 0.92, -0.18], [0, 1.02, -0.12], [0, 1.0, -0.05]]), M.chrome);
    k.pop();
    k.push(-8.2, 0, -4.4, Math.PI / 2);
    k.add(lathe([[0.12, 0], [0.17, 0.05], [0.19, 0.3], [0.2, 0.4], [0.18, 0.41], [0, 0.41]], 20, 'toilet'), M.ceramic, 0, 0, 0.05);
    k.add(roundedBox(0.4, 0.4, 0.18, 0.04), M.ceramic, 0, 0.6, -0.2);
    k.add(roundedBox(0.4, 0.03, 0.44, 0.015), M.white, 0, 0.42, 0.04);
    k.pop();
    this.block(-8.2, -4.4, 0.5, 0.6, 0.6);
    this.point(-7.3, 2.5, -3.5, 0xf0f4ff, 3, 4.5);
    k.add(CYL(0.12, 0.12, 0.05, 16), M.bulbCool, -7.3, 2.78, -3.5);

    // ----------------------------------------------------------------- back room
    k.push(8.2, 0, -3.0); turnedTable(k, M, 1.1, 1.1, 0.76, M.feltRed, M.woodDark); k.pop();
    this.block(8.2, -3.0, 1.1, 1.1, 0.78);
    this.backSeats = [[8.2, -2.1, Math.PI], [8.2, -3.9, 0], [7.3, -3.0, Math.PI / 2]].map(([x, z, hd]) => { k.push(x, 0, z, hd); bentwoodChair(k, M); k.pop(); this.block(x, z, 0.36, 0.36, 0.5); return this.seat(x, z, hd, { seatY: 0.465 }, 'chair', 'table'); });
    for (let i = 0; i < 18; i++) k.add(roundedBox(0.06, 0.002, 0.09, 0.001), i % 3 ? M.white : M.redPaint, 8.0 + r.range(-0.3, 0.4), 0.762 + i * 0.0021, -3.0 + r.range(-0.3, 0.3), r.range(0, 3));
    for (let i = 0; i < 6; i++) k.add(roundedBox(0.15, 0.01, 0.07, 0.003), M.greenPaint, 8.4 + i * 0.03, 0.764 + i * 0.006, -2.85, 0.2 * i);
    for (const [x, z] of [[9.6, -4.6], [9.6, -4.1], [9.1, -4.6]]) { k.push(x, 0, z); keg(k, M); k.pop(); }
    this.block(9.4, -4.4, 1.0, 0.9, 0.6);
    for (let i = 0; i < 6; i++) { k.push(6.6 + (i % 2) * 0.42, Math.floor(i / 2) * 0.28, -4.7); bottleCrate(k, M, i % 2 ? M.plasticGreen : M.plasticRed); k.pop(); }
    this.block(6.8, -4.7, 0.9, 0.4, 0.9);
    k.push(9.7, 0, -1.8, -Math.PI / 2);
    k.add(roundedBox(0.7, 0.9, 0.6, 0.03), M.iron, 0, 0.45, 0);
    k.add(CYL(0.06, 0.06, 0.03, 20), M.brass, 0.1, 0.55, 0.31, 0, Math.PI / 2);
    k.add(roundedBox(0.04, 0.16, 0.04, 0.01), M.brass, -0.22, 0.45, 0.31);
    k.pop();
    this.block(9.7, -1.8, 0.6, 0.7, 0.9);
    k.push(8.2, 0, -3.0); pendantLamp(k, M, 3.0, 1.1, M.lampShade, false); k.pop();
    k.push(9.96, 1.7, -3.0, -Math.PI / 2); poster(k, M, 'wanted', 0.45, 0.63); k.pop();

    // ----------------------------------------------------------------- lights
    this.ambient(0x8a6a4a, 0x2a1810, 0.55);
    this.spotLight(2.2, H - 0.05, -2.2, 2.2, 0, -2.6, { intensity: 55, angle: 1.05, dist: 8, color: 0xffcf90 });
    this.spotLight(-3.7, 1.52, 0.3, -3.7, 0, 0.3, { intensity: 22, angle: 1.15, penumbra: 0.6, dist: 4, color: 0xfff0c8, mapSize: 512 });
    this.spotLight(2.0, H - 0.05, 2.8, 2.2, 0, 3.0, { intensity: 38, angle: 1.15, dist: 8, color: 0xffc078, shadow: true, mapSize: 512 });
    this.point(2.2, 1.6, -4.2, 0xffa850, 5, 5);           // back-bar shelves glow
    this.point(2.25, 2.85, -4.4, 0xff3a8a, 3.5, 5);        // pink neon wash
    this.point(-5.5, 2.4, -0.2, 0x40c8ff, 2.5, 4);         // blue neon wash
    this.jukeLight = this.point(-0.4, 1.3, 3.9, 0xff7a30, 3, 3.5);
    this.point(-3.5, 2.6, 3.6, 0xffc070, 3, 5);            // by the door
    this.point(8.2, 1.9, -3.0, 0xffd090, 7, 5);            // back room bulb
    this.point(4.5, 2.2, 0.0, 0xffb060, 2.5, 6);

    // ----------------------------------------------------------------- animation
    this.animated.push((dt, t, game) => {
      for (const f of this.fans) f.rotation.y += dt * 4.2;
      const jk = this.jukebox, on = game.interiors?.jukeboxOn;
      const hue = (t * 0.06) % 1;
      jk.tubeMat.emissive.setHSL(on ? hue : 0.07, on ? 0.95 : 0.8, on ? 0.55 : 0.42);
      jk.tubeMat.emissiveIntensity = on ? 3 + Math.sin(t * 2.2) * 0.6 : 1.6;
      if (on) jk.carousel.rotation.z += dt * 0.6;
      this.jukeLight.color.copy(jk.tubeMat.emissive); this.jukeLight.intensity = on ? 3.2 : 1.4;
      // Old neon: a faint buzz and the odd flicker on the blue sign.
      const fl = Math.sin(t * 37) > 0.995 || (Math.sin(t * 0.7) > 0.98 && Math.sin(t * 50) > 0) ? 0.25 : 1;
      this.neon[1].color.setRGB(2.6 * fl, 2.6 * fl, 2.6 * fl);
      const d = new Date(), hr = game.weather?.clock?.hour ?? d.getHours();
      this.clock.hour.rotation.z = -(hr % 12) / 12 * Math.PI * 2;
      this.clock.min.rotation.z = -((hr * 60) % 60) / 60 * Math.PI * 2;
    });
    this.buildCast(M);
  }

  // ----------------------------------------------------------------- talking
  beginTalk(conv, npc, mgr) {
    const g = conv.game;
    let list;
    if (npc === this.bartender) {
      conv.say('raka', pick(['Evening, Togar.', 'Bang Togar.', 'Hey, Togar.']));
      conv.npc(pick(['Raka! The sailor returns. What are you drinking?', 'Evening. Sit, sit. What can I get you?', 'Ah, my favourite customer. Well, top ten. What\'ll it be?']));
      const order = (kind, price, label, heal, line) => () => {
        conv.say('raka', line);
        if (!mgr.pay(price, label)) { conv.npc('Cash first, friend. This is a bar, not a charity.'); return false; }
        conv.npc(pick(['Coming right up.', 'Good choice.', 'One moment.', 'Ice cold, as always.']));
        this.pendingOrder = { kind, x: g.player.pos.x, done: () => mgr.serveDrink(kind, heal) };
        npc.clear();
        return false;
      };
      list = [
        { label: `A cold Bir Jangkar. (${formatMoney(6)})`, run: order('beer', 6, 'Bir Jangkar', 12, 'A cold Bir Jangkar, please.') },
        { label: `Es teh manis. (${formatMoney(2)})`, run: order('tea', 2, 'Es teh manis', 15, 'Just an iced tea.') },
        { label: `Kopi tubruk. (${formatMoney(3)})`, run: order('coffee', 3, 'Kopi tubruk', 10, 'Kopi tubruk. Strong.') },
        { label: 'Heard anything lately?', run: () => { conv.say('raka', 'Heard anything lately?'); conv.npc(this.rumour(g)); return true; } },
        { label: 'Nothing for now.', run: () => { conv.say('raka', 'Nothing for now.'); conv.npc('Shout if you change your mind.'); return false; } },
      ];
    } else {
      conv.say('raka', pick(['Evening.', 'Mind if I join you?', 'Hey there.']));
      conv.npc(pick(['Evening, sailor.', 'Pull up a stool, the beer is cold.', 'Ah, a new face. Welcome to the Jangkar.', 'Shh, I am losing at this game.']));
      list = [
        { label: `Buy you a drink? (${formatMoney(6)})`, run: () => {
          conv.say('raka', 'This round is on me.');
          if (!mgr.pay(6, 'A round')) { conv.npc('Ha! With what money?'); return false; }
          conv.npc(pick(['Terima kasih! Now that is a proper sailor.', 'You are a good man, Raka.', 'To the harbour!']));
          npc.clear(); npc.gesture('cheers', 1.6).gesture('drink', 2.4);
          g.progression.addXp(5, 'Made a friend');
          return false;
        } },
        { label: 'What\'s the talk tonight?', run: () => { conv.say('raka', 'So what\'s the talk tonight?'); conv.npc(pick(CHAT)); return true; } },
        { label: 'Enjoy your evening.', run: () => { conv.say('raka', 'Enjoy your evening.'); conv.npc(pick(['You too.', 'Selamat malam.', 'Don\'t be a stranger.'])); return false; } },
      ];
    }
    conv.interiorChoices = list;
    conv.pendingChoices = list;
    return true;
  }

  // When the music starts, the regulars bob their heads; one of them goes to the jukebox.
  onMusic() {
    for (const n of this.regulars || []) if (n.seat && Math.random() < 0.5) { n.clear(); n.gesture('nod', 1.4).gesture('cheers', 1.4); }
  }

  rumour(g) {
    const done = g.missions.completed.size;
    if (done >= 7) return 'Since Rusdi went down, the Hiu Merah boys drink somewhere else. Business has never been better.';
    if (done >= 4) return 'People talk about you, you know. The sailor who fights the sharks. Be careful who hears it.';
    if (done >= 2) return 'Rusdi\'s collectors were in here last week, asking about a man with a maroon jacket. I told them nothing.';
    return pick([
      'The Hiu Merah take a cut from every crate in the fish market. Pak Harun is not happy about it.',
      'Bu Lastri is looking for you. Something about a delivery, and not the martabak kind.',
      'Street racers meet on the beach road at sunset. Fourteen gates, one record. Fools, all of them.',
      'There is a respray shop in the industrial estate. Pak Darto. He asks no questions.',
    ]);
  }

  // ----------------------------------------------------------------- people
  buildCast(M) {
    const look = (seed, o = {}) => generateLook(seed, 'auto', o);
    // Bang Togar, behind the bar: white shirt, dark apron, a moustache to be proud of.
    const togar = new InteriorNpc(generateLook(7311, 'auto', {
      gender: 'm', age: 'adult', build: 'heavy', name: 'Bang Togar',
      top: { kind: 'shirt', color: 0xf0ece0, pattern: 'plain', longSleeves: true, tucked: true },
      bottom: { kind: 'trousers', color: 0x1a1a1a, pattern: 'plain', belt: 0x111111 },
      outer: { kind: 'apron', color: 0x2a1a12 },
      face: { stubble: false, beard: null, moustache: true, sunglasses: false, browThick: 5, browArch: 2, eyeColor: 0x2a1608, mole: false, freckles: false },
    }), 2.0, -3.45, 0, { name: 'Bang Togar', role: 'bartender', plan: (n, room, game) => this.planBartender(n, room, game) });
    togar.talkScript = 'bartender';
    togar.body.model.hold(beerGlassMesh(M));
    this.bartender = this.addNpc(togar);
    this.barStations = { center: [2.0, -3.4], taps: [2.55, -3.35], sink: [1.35, -3.4], register: [-0.0, -3.4], east: [4.3, -3.4], west: [0.3, -3.4] };

    const regulars = [];
    const mk = (seed, o, seat, plan) => {
      const n = new InteriorNpc(look(seed, o), seat.x, seat.z, seat.heading, { plan });
      n.seat = seat; seat.occupant = n; n.sitK = 1;
      n.body.model.hold(beerGlassMesh(M));
      n.talkScript = 'patron';
      regulars.push(this.addNpc(n));
      return n;
    };
    // Three at the counter, two friends at table A, a couple in the booth.
    const p1 = mk(1201, { gender: 'm', age: 'old' }, this.stools[1], (n) => this.planPatron(n));
    const p2 = mk(1302, { gender: 'm' }, this.stools[3], (n) => this.planPatron(n));
    const p3 = mk(1499, { gender: 'f' }, this.stools[4], (n) => this.planPatron(n));
    p2.neighbour = p3; p3.neighbour = p2; p1.neighbour = p2;
    const a1 = mk(2101, { gender: 'm' }, this.tableA[0], (n) => this.planPatron(n));
    const a2 = mk(2202, { gender: 'm', age: 'adult' }, this.tableA[1], (n) => this.planPatron(n));
    a1.neighbour = a2; a2.neighbour = a1;
    const b1 = mk(3307, { gender: 'f' }, this.boothSeats[3], (n) => this.planPatron(n));
    const b2 = mk(3408, { gender: 'm' }, this.boothChairs[1], (n) => this.planPatron(n));
    b1.neighbour = b2; b2.neighbour = b1;
    // Card players in the back room.
    const c1 = mk(4501, { gender: 'm', age: 'old' }, this.backSeats[0], (n) => this.planCards(n));
    const c2 = mk(4602, { gender: 'm' }, this.backSeats[1], (n) => this.planCards(n));
    c1.neighbour = c2; c2.neighbour = c1;
    // Two pool players.
    const spots = this.poolSpots();
    const q1 = new InteriorNpc(look(5150, { gender: 'm', age: 'young' }), spots[0].x, spots[0].z, spots[0].h, { plan: (n) => this.planPool(n) });
    const q2 = new InteriorNpc(look(5262, { gender: 'f', age: 'young' }), spots[3].x, spots[3].z, spots[3].h, { plan: (n) => this.planPool(n) });
    q1.talkScript = q2.talkScript = 'patron';
    q1.partner = q2; q2.partner = q1; q1.turn = true;
    for (const q of [q1, q2]) this.addNpc(q);
    this.regulars = regulars;
  }

  poolSpots() {
    const { x, z } = this.pool, hw = this.pool.W / 2 + 0.55, hl = this.pool.L / 2 + 0.55;
    const pts = [[x - hw, z - 0.6], [x - hw, z + 0.7], [x - 0.2, z + hl], [x + hw, z + 0.5], [x + hw, z - 0.6], [x + 0.3, z - hl]];
    return pts.map(([px, pz]) => ({ x: px, z: pz, h: Math.atan2(x - px, z - pz) }));
  }

  // Bang Togar's round: polish a glass, pour one, top somebody up, ring the till, lean on the bar.
  planBartender(n, room, game) {
    const S = this.barStations;
    const order = this.pendingOrder;
    if (order) { this.pendingOrder = null; this.serveOrder(n, order); return; }
    // Raka just sat down at the counter: come over and ask.
    const seat = game?.interiors?.seat;
    if (seat?.kind === 'stool' && this.greeted !== seat) {
      this.greeted = seat;
      n.walk([[Math.max(-0.2, Math.min(4.9, seat.x)), -3.3]]).face(Math.PI, 0.4).chat(pick(['What\'ll it be, Raka?', 'Evening! What are you drinking?', 'The usual?']), null).wait(4, { x: seat.x, z: seat.z, y: 1.4 });
      return;
    }
    if (!seat) this.greeted = null;
    const r = Math.random();
    if (r < 0.32) n.walk([S.center]).face(Math.PI, 0.5).gesture('wipe', 3.2).gesture('wipe', 2.6);
    else if (r < 0.5) n.walk([S.taps]).face(Math.PI, 0.4).gesture('pour', 2.6).walk([pick([S.east, S.west, S.center])]).face(Math.PI, 0.3).gesture('serve', 1.1);
    else if (r < 0.65) n.walk([S.sink]).face(Math.PI, 0.4).gesture('wipe', 2.4);
    else if (r < 0.78) n.walk([S.register]).face(Math.PI * 0.85, 0.5).gesture('type', 1.6).wait(0.8);
    else {
      // Chat with whoever is at the counter.
      const at = this.stools.filter((s) => s.occupant instanceof InteriorNpc);
      if (at.length) {
        const s = pick(at);
        n.walk([[s.x, -3.35]]).face(Math.PI, 0.4).chat(pick(['Another one, Pak?', 'You look tired, my friend.', 'The usual?', 'Did you see the match?']), s.occupant);
        n.call(() => { if (s.occupant instanceof InteriorNpc) s.occupant.clear(), s.occupant.wait(0.4).chat(pick(['Why not.', 'Tired? I am exhausted.', 'Always the usual.', 'Don\'t remind me.']), n).gesture('nod', 1.2); });
        n.wait(2.5, () => s.occupant?.body?.pos && { x: s.occupant.body.pos.x, z: s.occupant.body.pos.z, y: 1.5 });
      } else n.walk([S.center]).face(Math.PI, 0.4).wait(3);
    }
  }

  // Raka's order: pour it at the taps, bring it over, set it down on the counter in front of him.
  serveOrder(n, order) {
    const S = this.barStations;
    const px = Math.max(-0.2, Math.min(4.9, order.x));
    n.walk([S.taps]).face(Math.PI, 0.35).gesture(order.kind === 'beer' ? 'pour' : 'wipe', order.kind === 'beer' ? 2.4 : 1.8);
    n.walk([[px, -3.3]]).face(Math.PI, 0.35).gesture('serve', 1.1);
    n.call(() => order.done?.());
  }

  planPatron(n) {
    const r = Math.random();
    const nb = n.neighbour;
    if (!n.seat) return;
    if (r < 0.28) n.gesture('drink', 2.6).wait(1 + Math.random() * 2);
    else if (r < 0.55 && nb && !nb.busyTalking) {
      const line = pick(CHAT);
      n.chat(line, nb);
      if (nb.seat && Math.random() < 0.7) nb.clear(), nb.wait(line.length * 0.05 + 1.0, { x: n.body.pos.x, z: n.body.pos.z, y: 1.3 }).gesture(Math.random() < 0.5 ? 'laugh' : 'nod', 1.4).chat(pick(LAUGH_REPLIES), n);
      n.wait(2.5, { x: nb.body.pos.x, z: nb.body.pos.z, y: 1.3 });
    } else if (r < 0.62) n.gesture('cheers', 1.6).gesture('drink', 2.4);
    else if (r < 0.66 && n.seat.kind !== 'stool') n.gesture('stretch', 2.2);
    else if (r < 0.7 && !this.wcBusy) this.restroomTrip(n);
    else n.wait(2 + Math.random() * 3, Math.random() < 0.5 ? null : { x: Math.random() * 8 - 4, z: Math.random() * 6 - 3, y: 1.4 });
  }

  // Up, across the room to the restroom, a while inside, back to the same seat.
  restroomTrip(n) {
    const seat = n.seat;
    this.wcBusy = true;
    const front = InteriorNpc.seatFront(seat, seat.kind === 'stool' ? 0.5 : 0.45);
    const path = [[front.x, front.z], [-1.6, -0.9], [-5.2, -2.2], [-5.4, -3.65], [-6.5, -3.65], [-7.4, -3.4]];
    n.stand().walk(path).wait(5 + Math.random() * 4).walk([...path].reverse().slice(1));
    n.call(() => { this.wcBusy = false; });
    n.sitOn(seat);
  }

  planCards(n) {
    const r = Math.random();
    if (r < 0.35) n.wait(1.5 + Math.random() * 2, { x: 8.2, z: -3.0, y: 0.8 });
    else if (r < 0.55) n.gesture('serve', 1.0);
    else if (r < 0.7) n.gesture('drink', 2.4);
    else if (n.neighbour) n.chat(pick(['Your turn.', 'Hah, full house!', 'I fold.', 'You are cheating, I know it.', 'Double or nothing.']), n.neighbour).gesture(Math.random() < 0.5 ? 'laugh' : 'shrug', 1.3);
  }

  // Pool: walk round the table to the next shot, line it up, bend, stroke and strike, watch.
  planPool(n) {
    const spots = this.poolSpots();
    if (n.turn) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      n.walk([[s.x, s.z]]).face(s.h + (Math.random() - 0.5) * 0.4, 0.6).gesture('cue', 2.8).wait(1.2, { x: this.pool.x, z: this.pool.z, y: 0.8 });
      n.call(() => { if (Math.random() < 0.55) { n.turn = false; n.partner.turn = true; } });
    } else {
      // Waiting: lean back, chalk the cue, watch the other one.
      const p = n.partner.body.pos;
      n.wait(1.5 + Math.random(), { x: p.x, z: p.z, y: 1.2 });
      if (Math.random() < 0.3) n.gesture('wipe', 1.2);
      if (Math.random() < 0.2) n.chat(pick(['Nice shot!', 'Lucky.', 'Watch and learn.', 'Ah, so close.']), n.partner);
    }
  }
}

function tube2(points) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 12, 0.012, 8, false);
}

void contactShadow;
