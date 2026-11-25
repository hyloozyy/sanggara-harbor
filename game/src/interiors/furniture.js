// Modelled furniture and fittings shared by the interiors. Every builder works in its own frame
// (origin on the floor at the piece's centre, front facing +z) through a Kit, so a piece is
// built once in local coordinates and placed anywhere. Static parts are batched per material;
// moving parts (fan rotors, doors, clock hands, jukebox lights) come back as objects to animate.
// Shapes are bevelled or turned the way the real things are: bullnose counter tops, tufted
// leather stools on chrome pedestals, bentwood chairs, turned table legs, arched jukeboxes.
import * as THREE from 'three';
import { roundedBox, lathe, roundedCylinder, tube, ring, extrudeShape, roundRectPoints } from './shapes.js';
import { posterTexture, neonTubeTexture, chalkboardTexture, blobTexture } from './interior-textures.js';
import { neonMaterial } from './interior-materials.js';
import { createRng } from '../core/rng.js';

const TAU = Math.PI * 2;
const geo = new Map();
const g1 = (key, make) => { if (!geo.has(key)) geo.set(key, make()); return geo.get(key); };
const SPHERE = (r, w = 16, h = 12) => g1(`sph:${r}:${w}`, () => new THREE.SphereGeometry(r, w, h));
const CYL = (r1, r2, h, s = 16) => g1(`cyl:${r1}:${r2}:${h}:${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const PLANE = (w, h) => g1(`pl:${w}:${h}`, () => new THREE.PlaneGeometry(w, h));

// ------------------------------------------------------------------------------- shadows
// Soft contact shadow under a piece (keeps things grounded when shadow maps are off).
let blobMat = null;
export function contactShadow(k, w, d, strength = 0.55) {
  if (!blobMat) blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2 });
  const g = g1(`blob:${w}:${d}`, () => { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); return p; });
  k.add(g, blobMat, 0, 0.004 + Math.random() * 0.002, 0);
  void strength;
}

// ------------------------------------------------------------------------------- seating
// Bar stool: weighted dome base, chrome column, foot ring on three struts, tufted round seat.
export function barStool(k, M, seatMat = M.leatherRed) {
  k.add(lathe([[0, 0], [0.22, 0.0], [0.225, 0.012], [0.2, 0.03], [0.09, 0.06], [0.04, 0.08], [0, 0.08]], 28, 'stoolbase'), M.chrome);
  k.add(CYL(0.026, 0.026, 0.64), M.chrome, 0, 0.4, 0);
  k.add(ring(0.17, 0.011), M.chrome, 0, 0.3, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; k.add(CYL(0.008, 0.008, 0.15), M.chrome, Math.cos(a) * 0.095, 0.3, Math.sin(a) * 0.095, -a, 0, Math.PI / 2); }
  k.add(lathe([[0.03, 0.7], [0.11, 0.71], [0.12, 0.72], [0, 0.73]], 20, 'stoolcup'), M.blackMetal);
  // Seat: a cushion with a rolled edge and a button-tufted top.
  k.add(lathe([[0, 0.72], [0.17, 0.72], [0.195, 0.735], [0.2, 0.76], [0.195, 0.785], [0.175, 0.8], [0.12, 0.81], [0.06, 0.815], [0, 0.812]], 32, 'stoolseat'), seatMat);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; k.add(SPHERE(0.008, 8, 6), M.brass, Math.cos(a) * 0.1, 0.808, Math.sin(a) * 0.1); }
  contactShadow(k, 0.6, 0.6);
  return { seatY: 0.81, footY: 0.31, footZ: 0.16 };
}

// Bentwood café chair: round seat, splayed legs with a ring, a bent loop for the back.
export function bentwoodChair(k, M, mat = M.woodDark) {
  k.add(roundedCylinder(0.2, 0.045, 0.015, 28), mat, 0, 0.42, 0);
  k.add(ring(0.205, 0.012), mat, 0, 0.44, 0);
  const legs = [[0.15, 0.13], [-0.15, 0.13], [0.13, -0.15], [-0.13, -0.15]];
  for (const [x, z] of legs) k.add(tube([[x * 1.2, 0, z * 1.2], [x * 1.05, 0.22, z * 1.05], [x, 0.42, z]], 0.014, 8, 8), mat);
  k.add(ring(0.165, 0.009), mat, 0, 0.2, 0);
  // Back: the rear legs continue up into a bent loop with an inner oval.
  const back = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (i / 16); back.push([Math.cos(a) * 0.17, 0.46 + Math.sin(a) * 0.36, -0.16 - Math.sin(a) * 0.04]); }
  k.add(tube(back, 0.014, 24, 8), mat);
  const inner = [];
  for (let i = 0; i <= 20; i++) { const a = TAU * (i / 20); inner.push([Math.cos(a) * 0.1, 0.66 + Math.sin(a) * 0.12, -0.175]); }
  k.add(tube(inner, 0.01, 30, 6, true), mat);
  contactShadow(k, 0.6, 0.6);
  return { seatY: 0.465 };
}

// Molded plastic warung chair (the stackable kind in every food stall).
export function plasticChair(k, M, mat = M.plasticRed) {
  k.add(roundedBox(0.42, 0.035, 0.4, 0.015), mat, 0, 0.43, 0);
  k.add(roundedBox(0.4, 0.3, 0.03, 0.014), mat, 0, 0.62, -0.2, 0, -0.18);
  for (const [x, z] of [[0.18, 0.17], [-0.18, 0.17], [0.18, -0.17], [-0.18, -0.17]]) k.add(CYL(0.016, 0.022, 0.43, 10), mat, x * 1.08, 0.215, z * 1.08, 0, z * 0.25, -x * 0.25);
  contactShadow(k, 0.6, 0.6);
  return { seatY: 0.45 };
}

// Booth along a wall: wooden plinth, a leather seat cushion and a channel-tufted high back.
export function booth(k, M, len = 1.6, mat = M.leatherRed) {
  k.add(roundedBox(len, 0.4, 0.55, 0.02), M.woodDark, 0, 0.2, 0);
  k.add(roundedBox(len - 0.04, 0.1, 0.52, 0.045), mat, 0, 0.45, 0.02);
  const n = Math.max(3, Math.round(len / 0.22));
  for (let i = 0; i < n; i++) k.add(roundedBox(len / n - 0.01, 0.52, 0.12, 0.05), mat, -len / 2 + (i + 0.5) * len / n, 0.8, -0.22, 0, -0.08);
  k.add(roundedBox(len + 0.04, 1.15, 0.08, 0.02), M.woodDark, 0, 0.58, -0.3);
  k.add(roundedBox(len + 0.08, 0.05, 0.14, 0.02), M.woodDark, 0, 1.17, -0.3);
  contactShadow(k, len + 0.3, 0.9);
  return { seatY: 0.5 };
}

// Sofa with loose seat and back cushions and rolled arms.
export function sofa(k, M, len = 2.0, mat = M.clothGreen, legMat = M.woodTeak) {
  k.add(roundedBox(len, 0.3, 0.85, 0.04), mat, 0, 0.27, 0);
  const n = len > 1.6 ? 3 : 2, cw = (len - 0.36) / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + 0.18 + (i + 0.5) * cw;
    k.add(roundedBox(cw - 0.01, 0.14, 0.62, 0.06, 3), mat, x, 0.48, 0.07);
    k.add(roundedBox(cw - 0.02, 0.46, 0.18, 0.08, 3), mat, x, 0.72, -0.27, 0, -0.14);
  }
  k.add(roundedBox(len, 0.48, 0.16, 0.06), mat, 0, 0.62, -0.36);
  for (const s of [-1, 1]) { k.add(roundedBox(0.2, 0.36, 0.85, 0.08, 3), mat, s * (len / 2 - 0.1), 0.5, 0); k.add(CYL(0.11, 0.11, 0.84, 18), mat, s * (len / 2 - 0.1), 0.66, 0, 0, Math.PI / 2); }
  for (const [x, z] of [[len / 2 - 0.08, 0.36], [-len / 2 + 0.08, 0.36], [len / 2 - 0.08, -0.36], [-len / 2 + 0.08, -0.36]]) k.add(CYL(0.025, 0.018, 0.12, 10), legMat, x, 0.06, z);
  contactShadow(k, len + 0.3, 1.1);
  return { seatY: 0.55 };
}

// ------------------------------------------------------------------------------- tables
// Round café table: bevelled top on a cast-iron column with four curved feet.
export function cafeTable(k, M, r = 0.38, top = M.woodMid) {
  k.add(roundedCylinder(r, 0.035, 0.012, 36), top, 0, 0.72, 0);
  k.add(lathe([[0.06, 0.66], [0.08, 0.7], [0.08, 0.72], [0, 0.72]], 16, 'ctcap'), M.iron);
  k.add(lathe([[0.05, 0.12], [0.035, 0.2], [0.03, 0.4], [0.04, 0.5], [0.03, 0.6], [0.045, 0.66], [0.06, 0.68]], 16, 'ctcol'), M.iron);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + Math.PI / 4; k.add(tube([[0, 0.14, 0], [Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15], [Math.cos(a) * 0.28, 0.015, Math.sin(a) * 0.28]], 0.016, 10, 8), M.iron); }
  contactShadow(k, r * 2.4, r * 2.4);
  return { topY: 0.755 };
}

// Rectangular table with turned legs and an apron.
export function turnedTable(k, M, w = 1.2, d = 0.75, h = 0.75, top = M.woodTeak, legMat = top) {
  k.add(roundedBox(w, 0.04, d, 0.014), top, 0, h - 0.02, 0);
  k.add(roundedBox(w - 0.12, 0.09, d - 0.12, 0.008), legMat, 0, h - 0.09, 0);
  const leg = lathe([[0.03, 0], [0.026, 0.05], [0.022, 0.12], [0.03, 0.18], [0.02, 0.24], [0.018, 0.42], [0.026, 0.5], [0.032, 0.55], [0.032, h - 0.12], [0.0, h - 0.12]], 12, 'tleg' + h);
  for (const [x, z] of [[w / 2 - 0.07, d / 2 - 0.07], [-w / 2 + 0.07, d / 2 - 0.07], [w / 2 - 0.07, -d / 2 + 0.07], [-w / 2 + 0.07, -d / 2 + 0.07]]) k.add(leg, legMat, x, 0, z);
  contactShadow(k, w + 0.3, d + 0.3);
  return { topY: h };
}

// ------------------------------------------------------------------------------- tableware
const pint = () => g1('pint', () => lathe([[0, 0], [0.032, 0], [0.034, 0.004], [0.038, 0.1], [0.042, 0.14], [0.04, 0.152], [0.036, 0.152], [0.038, 0.14], [0.034, 0.1], [0.03, 0.008], [0, 0.008]], 18));
const beerFill = () => g1('beerfill', () => lathe([[0, 0.008], [0.03, 0.008], [0.034, 0.1], [0.037, 0.125], [0, 0.125]], 16));
const foamTop = () => g1('foam', () => lathe([[0, 0.124], [0.037, 0.124], [0.039, 0.135], [0.03, 0.142], [0, 0.144]], 16));
const tumbler = () => g1('tumbler', () => lathe([[0, 0], [0.036, 0], [0.038, 0.09], [0.034, 0.09], [0.032, 0.012], [0, 0.012]], 18));

export function pintGlass(k, M, x, y, z, full = 0.8) {
  k.add(pint(), M.glass, x, y, z);
  if (full > 0) { k.add(beerFill(), M.beer, x, y, z, 0, 0, 0, 1, full, 1); k.add(foamTop(), M.foam, x, y + (full - 1) * 0.125, z); }
}

// A glass of beer as its own object (carried by hand, put down on the counter).
export function beerGlassMesh(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(pint(), M.glass), new THREE.Mesh(beerFill(), M.beer), new THREE.Mesh(foamTop(), M.foam));
  return g;
}
export function teaGlassMesh(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(tumbler(), M.glass));
  const t = new THREE.Mesh(g1('teafill', () => lathe([[0, 0.012], [0.032, 0.012], [0.034, 0.075], [0, 0.075]], 14)), M.tea); g.add(t);
  return g;
}
export function coffeeCupMesh(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(g1('cup', () => lathe([[0, 0], [0.03, 0], [0.04, 0.06], [0.037, 0.06], [0.027, 0.006], [0, 0.006]], 16)), M.ceramic));
  g.add(new THREE.Mesh(g1('cupfill', () => lathe([[0, 0.04], [0.036, 0.05], [0, 0.05]], 12)), M.coffee));
  const h = new THREE.Mesh(g1('cuph', () => new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI)), M.ceramic); h.position.set(0.042, 0.032, 0); h.rotation.z = -Math.PI / 2; g.add(h);
  return g;
}

// Bottle profiles: wine, spirit, beer, squat liqueur, tall gin.
const BOTTLES = [
  [[0, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.19], [0.03, 0.23], [0.014, 0.26], [0.013, 0.31], [0.015, 0.315], [0, 0.315]],
  [[0, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.17], [0.036, 0.2], [0.016, 0.22], [0.014, 0.27], [0.017, 0.275], [0, 0.275]],
  [[0, 0], [0.029, 0], [0.03, 0.01], [0.03, 0.13], [0.02, 0.17], [0.012, 0.21], [0.013, 0.22], [0, 0.22]],
  [[0, 0], [0.05, 0], [0.052, 0.01], [0.052, 0.11], [0.044, 0.14], [0.018, 0.16], [0.016, 0.2], [0.02, 0.205], [0, 0.205]],
  [[0, 0], [0.034, 0], [0.036, 0.01], [0.036, 0.25], [0.026, 0.27], [0.013, 0.29], [0.013, 0.33], [0, 0.33]],
];
const bottleGeo = (i) => g1('bottle' + i, () => lathe(BOTTLES[i], 18));
const labelGeo = (shape, cell) => g1(`label:${shape}:${cell}`, () => {
  const p = BOTTLES[shape], r = p[2][0] + 0.0015, y0 = p[2][1] + 0.04, y1 = Math.min(p[3][1] - 0.02, y0 + 0.09);
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, 18, 1, true, -1.2, 2.4);
  g.translate(0, (y0 + y1) / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / 8);
  return g;
});
const capGeo = (shape) => g1('cap' + shape, () => { const p = BOTTLES[shape], top = p[p.length - 1][1], r = p[p.length - 2][0] + 0.002; return lathe([[r, top - 0.025], [r, top + 0.002], [0, top + 0.004]], 12); });

export function bottle(k, M, x, y, z, shape, glassMat, cell, ry = 0) {
  k.add(bottleGeo(shape), glassMat, x, y, z, ry);
  k.add(labelGeo(shape, cell), M.labels, x, y, z, ry);
  k.add(capGeo(shape), shape === 2 ? M.brass : M.blackMetal, x, y, z, ry);
}

// ------------------------------------------------------------------------------- the bar
// Counter: panelled front with a brass foot rail, a bullnose top with a drip edge, the
// working side with a sink, glass racks and a cash register; three beer taps on a tower.
export function barCounter(k, M, len = 5, opts = {}) {
  const d = 0.62, h = 1.08;
  const r = createRng(opts.seed || 7);
  // Body and kick plinth.
  k.add(roundedBox(len, h - 0.1, d - 0.08, 0.02), M.woodDark, 0, (h - 0.1) / 2 + 0.06, -0.02);
  k.add(roundedBox(len - 0.04, 0.08, d - 0.14, 0.01), M.black, 0, 0.04, -0.03);
  // Raised front panels.
  const n = Math.max(2, Math.round(len / 0.75)), pw = len / n;
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * pw;
    k.add(roundedBox(pw - 0.12, 0.62, 0.03, 0.012), M.woodMid, x, 0.52, d / 2 - 0.05);
    k.add(roundedBox(pw - 0.2, 0.5, 0.02, 0.008), M.woodDark, x, 0.52, d / 2 - 0.035);
    k.add(roundedBox(0.04, 0.9, 0.05, 0.012), M.woodDark, -len / 2 + i * pw, 0.5, d / 2 - 0.04);
  }
  // Top: a bullnose slab with a lip and a darker inlay band.
  k.add(roundedBox(len + 0.08, 0.06, d + 0.12, 0.028, 3), M.woodDark, 0, h, 0.04);
  k.add(roundedBox(len - 0.1, 0.004, 0.06, 0.002), M.brass, 0, h + 0.031, -0.12);
  // Brass foot rail on brackets.
  k.add(tube([[-len / 2 + 0.05, 0.2, d / 2 + 0.16], [len / 2 - 0.05, 0.2, d / 2 + 0.16]], 0.022, 4, 14), M.brass);
  for (let i = 0; i <= Math.round(len / 1.2); i++) {
    const x = -len / 2 + 0.1 + i * (len - 0.2) / Math.round(len / 1.2);
    k.add(tube([[x, 0.2, d / 2 + 0.16], [x, 0.24, d / 2 + 0.08], [x, 0.26, d / 2 - 0.02]], 0.012, 8, 8), M.brass);
  }
  // Working side (behind, -z): a lower bench with a steel sink, drainers, glass racks.
  k.add(roundedBox(len - 0.2, 0.04, 0.4, 0.01), M.steel, 0, 0.88, -d / 2 - 0.12);
  k.add(roundedBox(0.45, 0.02, 0.32, 0.01), M.black, -len * 0.2, 0.9, -d / 2 - 0.12);
  k.add(tube([[-len * 0.2, 0.88, -d / 2 - 0.3], [-len * 0.2, 1.02, -d / 2 - 0.3], [-len * 0.2, 1.04, -d / 2 - 0.2]], 0.01, 10, 8), M.chrome);
  for (let i = 0; i < 6; i++) k.add(tumbler(), M.glass, len * 0.1 + (i % 3) * 0.09, 0.9, -d / 2 - 0.05 - Math.floor(i / 3) * 0.09, 0, Math.PI);
  // Beer tower with three taps (chrome column, lathe handles in brand colours).
  const tx = opts.tapX ?? len * 0.18;
  k.push(tx, h + 0.03, -0.08);
  k.add(roundedBox(0.5, 0.02, 0.2, 0.008), M.steel, 0, 0.01, 0.05);
  for (let i = 0; i < 12; i++) k.add(roundedBox(0.012, 0.006, 0.18, 0.002), M.steel, -0.22 + i * 0.04, 0.024, 0.05);
  k.add(lathe([[0.04, 0], [0.04, 0.02], [0.035, 0.03], [0.035, 0.36], [0.045, 0.38], [0, 0.38]], 18, 'tapcol'), M.chrome, -0.16, 0, 0);
  k.add(lathe([[0.04, 0], [0.04, 0.02], [0.035, 0.03], [0.035, 0.36], [0.045, 0.38], [0, 0.38]], 18, 'tapcol'), M.chrome, 0.16, 0, 0);
  k.add(roundedBox(0.4, 0.07, 0.07, 0.03), M.chrome, 0, 0.36, 0);
  const handleCols = [M.greenPaint, M.redPaint, M.woodPale];
  for (let i = 0; i < 3; i++) {
    const x = -0.13 + i * 0.13;
    k.add(CYL(0.012, 0.012, 0.06, 10), M.chrome, x, 0.31, 0.05, 0, Math.PI / 2);
    k.add(lathe([[0.008, 0], [0.012, 0.02], [0.008, 0.03], [0.008, 0.05]], 10, 'spout'), M.chrome, x, 0.27, 0.08, 0, Math.PI);
    k.add(lathe([[0.012, 0], [0.016, 0.03], [0.02, 0.12], [0.017, 0.15], [0, 0.16]], 12, 'taph'), handleCols[i], x, 0.38, 0.05);
  }
  k.pop();
  // Cash register (a chunky retro one) and the bric-a-brac on the top.
  k.push(-len * 0.38, h + 0.03, -0.1, 0.25);
  k.add(roundedBox(0.36, 0.14, 0.32, 0.03), M.creamPaint, 0, 0.07, 0);
  k.add(roundedBox(0.34, 0.14, 0.18, 0.03), M.creamPaint, 0, 0.2, -0.07, 0, -0.35);
  k.add(roundedBox(0.2, 0.07, 0.03, 0.01), M.screenGlow, 0, 0.3, -0.12);
  for (let i = 0; i < 12; i++) k.add(roundedBox(0.035, 0.015, 0.035, 0.006), i % 4 === 3 ? M.redPaint : M.black, -0.1 + (i % 4) * 0.065, 0.15, 0.03 + Math.floor(i / 4) * 0.045, 0, -0.35);
  k.pop();
  for (let i = 0; i < 5; i++) pintGlass(k, M, -len * 0.05 + i * 0.07 - 0.1, h + 0.03, -0.18 + (i % 2) * 0.03, 0);
  // Coasters and a bowl of peanuts along the front.
  for (let i = 0; i < Math.floor(len / 0.9); i++) {
    const x = -len / 2 + 0.5 + i * 0.9;
    k.add(CYL(0.045, 0.045, 0.004, 16), M.cork, x, h + 0.032, 0.18);
    if (r.chance(0.35)) k.add(lathe([[0, 0], [0.04, 0], [0.06, 0.035], [0.056, 0.036], [0.036, 0.004], [0, 0.004]], 16, 'bowl'), M.ceramic, x + 0.3, h + 0.03, 0.12);
  }
  return { topY: h + 0.03, depth: d };
}

// Back bar: cabinets, a mirror, lit glass shelves full of bottles, a chalkboard menu.
export function backBar(k, M, len = 4.6, menu = null) {
  const r = createRng(17);
  k.add(roundedBox(len, 0.92, 0.5, 0.02), M.woodDark, 0, 0.46, 0);
  const doors = Math.round(len / 0.6);
  for (let i = 0; i < doors; i++) {
    const x = -len / 2 + (i + 0.5) * len / doors;
    k.add(roundedBox(len / doors - 0.05, 0.74, 0.02, 0.01), M.woodMid, x, 0.48, 0.255);
    k.add(CYL(0.008, 0.008, 0.08, 8), M.brass, x + (i % 2 ? -1 : 1) * (len / doors / 2 - 0.08), 0.62, 0.275);
  }
  k.add(roundedBox(len + 0.04, 0.04, 0.54, 0.012), M.woodDark, 0, 0.94, 0.01);
  // Mirror back panel in a wooden frame.
  k.add(roundedBox(len, 1.5, 0.04, 0.01), M.woodDark, 0, 1.75, -0.2);
  k.add(roundedBox(len - 0.16, 1.36, 0.01, 0.004), M.mirror, 0, 1.75, -0.175);
  // Three shelves, each with a warm LED strip glowing under the front edge.
  const glassShelf = M.glassClear;
  for (let s = 0; s < 3; s++) {
    const y = 1.18 + s * 0.42;
    k.add(roundedBox(len - 0.2, 0.02, 0.26, 0.006), s === 0 ? M.woodDark : glassShelf, 0, y, -0.06);
    k.add(roundedBox(len - 0.22, 0.008, 0.01, 0.003), M.ledWarm, 0, y - 0.014, 0.065);
    // Bottles: a crowded, irregular row.
    let x = -len / 2 + 0.16;
    while (x < len / 2 - 0.16) {
      const shape = r.int(0, 4);
      const glass = [M.glassGreen, M.glassBrown, M.glassClear, M.glassBrown, M.glassBlue][r.int(0, 4)];
      bottle(k, M, x, y + 0.01, -0.06 + r.range(-0.04, 0.04), shape, glass, r.int(0, 7), r.range(-0.6, 0.6));
      x += r.range(0.085, 0.13);
    }
  }
  k.add(roundedBox(len + 0.1, 0.08, 0.36, 0.02), M.woodDark, 0, 2.54, -0.08);
  if (menu) {
    const t = chalkboardTexture(menu.title, menu.lines);
    k.add(PLANE(0.8, 1.0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), len / 2 + 0.55, 1.9, -0.15);
  }
  return {};
}

// Beer keg (stainless, two rolling rings).
export function keg(k, M) {
  k.add(lathe([[0, 0], [0.2, 0], [0.205, 0.03], [0.2, 0.06], [0.205, 0.12], [0.215, 0.14], [0.205, 0.16], [0.205, 0.44], [0.215, 0.46], [0.205, 0.48], [0.2, 0.54], [0.205, 0.57], [0.18, 0.59], [0.04, 0.6], [0.03, 0.62], [0, 0.62]], 24, 'keg'), M.steel);
}

// Crate of empty bottles.
export function bottleCrate(k, M, mat = M.plasticGreen) {
  k.add(roundedBox(0.4, 0.28, 0.3, 0.02), mat, 0, 0.14, 0);
  for (let i = 0; i < 12; i++) k.add(bottleGeo(2), M.glassBrown, -0.15 + (i % 4) * 0.1, 0.06, -0.1 + Math.floor(i / 4) * 0.1);
}

// Pool table: turned legs, a wooden frame with diamond sights, felt bed and cushions,
// leather pockets and a rack of balls; the cue rests on the felt.
export function poolTable(k, M, felt = M.felt) {
  const L = 2.3, W = 1.28, h = 0.8;
  k.add(roundedBox(L, 0.2, W, 0.03), M.woodDark, 0, h - 0.13, 0);
  k.add(roundedBox(L - 0.26, 0.03, W - 0.26, 0.004), felt, 0, h - 0.04, 0);
  for (const s of [-1, 1]) {
    k.add(roundedBox(L - 0.36, 0.05, 0.05, 0.02), felt, 0, h - 0.01, s * (W / 2 - 0.15));
    k.add(roundedBox(0.05, 0.05, W - 0.4, 0.02), felt, s * (L / 2 - 0.15), h - 0.01, 0);
    k.add(roundedBox(L, 0.05, 0.12, 0.025), M.woodDark, 0, h, s * (W / 2 - 0.06));
    k.add(roundedBox(0.12, 0.05, W, 0.025), M.woodDark, s * (L / 2 - 0.06), h, 0);
    for (let i = 1; i < 8; i++) if (i !== 4) k.add(roundedBox(0.012, 0.003, 0.02, 0.001), M.ceramic, -L / 2 + i * L / 8, h + 0.026, s * (W / 2 - 0.06));
    for (let i = 1; i < 4; i++) k.add(roundedBox(0.02, 0.003, 0.012, 0.001), M.ceramic, s * (L / 2 - 0.06), h + 0.026, -W / 2 + i * W / 4);
  }
  for (const [x, z] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) {
    k.add(CYL(0.065, 0.06, 0.06, 16), M.black, x * (L / 2 - 0.1), h - 0.02, z * (W / 2 - 0.1));
    k.add(ring(0.065, 0.012), M.leatherBrown, x * (L / 2 - 0.1), h + 0.01, z * (W / 2 - 0.1));
  }
  const leg = lathe([[0.09, 0], [0.1, 0.04], [0.07, 0.1], [0.06, 0.2], [0.085, 0.3], [0.09, 0.4], [0.07, 0.5], [0.075, 0.57], [0.1, 0.6], [0, 0.6]], 16, 'poolleg');
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [0, 1], [0, -1]]) k.add(leg, M.woodDark, x * (L / 2 - 0.16), 0, z * (W / 2 - 0.16));
  // Balls in a triangle at the foot spot, the white at the head; vertex-coloured.
  const cols = [0xf0c020, 0x2a4ab8, 0xc82a2a, 0x6a2a8a, 0xf07a1a, 0x1a7a3a, 0x8a1a1a, 0x101010, 0xf0c020, 0x2a4ab8, 0xc82a2a, 0x6a2a8a, 0xf07a1a, 0x1a7a3a, 0x8a1a1a];
  const br = 0.028;
  let n = 0;
  for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) {
    const x = L * 0.22 + row * br * 1.75, z = (j - row / 2) * br * 2.02;
    k.add(ballGeo(cols[n % cols.length], n >= 8), M.balls, x, h - 0.025 + br, z, n * 0.7);
    n++;
  }
  k.add(ballGeo(0xf8f4ea, false), M.balls, -L * 0.25, h - 0.025 + br, 0.05);
  // Cue lying on the table and chalk on the rail.
  k.add(CYL(0.006, 0.014, 1.45, 10), M.woodPale, -0.1, h - 0.012, -0.32, 0.15, 0, Math.PI / 2);
  k.add(roundedBox(0.022, 0.022, 0.022, 0.004), M.bluePaint, L / 2 - 0.06, h + 0.035, 0.3);
  contactShadow(k, L + 0.5, W + 0.5);
  // Hanging billiard lamp: a long green enamel hood.
  return { L, W, h, ballY: h - 0.025 + br };
}

function ballGeo(color, stripe) {
  return g1(`ball:${color}:${stripe}`, () => {
    const g = new THREE.SphereGeometry(0.028, 14, 10);
    const c = new THREE.Color(color), w = new THREE.Color(0xf8f4ea);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const y = g.attributes.position.getY(i) / 0.028;
      const cc = stripe && Math.abs(y) > 0.45 ? w : c;
      col.set([cc.r, cc.g, cc.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
}

// Jukebox: an arched cabinet with glowing colour tubes up the sides and over the arch, a
// chrome speaker grille, the record carousel behind glass and rows of selection buttons.
// Returns the tube material to animate (hue cycling) and the record carousel to spin.
export function jukebox(k, M, parent) {
  const W = 0.78, D = 0.6, H = 1.52;
  const arch = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI * (i / 18); arch.push([Math.cos(a) * W / 2, H - W / 2 + Math.sin(a) * W / 2]); }
  const outline = [[W / 2, 0], ...arch, [-W / 2, 0]];
  k.add(extrudeShape(outline, D, 0.02, 24), M.woodDark, 0, 0, 0);
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff6a20, emissiveIntensity: 3, roughness: 0.3, transparent: true, opacity: 0.95 });
  // The glowing bezel: a tube that follows the arch and runs down both sides.
  const bezel = [[W / 2 - 0.06, 0.15, D / 2 + 0.005]];
  for (let i = 0; i <= 18; i++) { const a = Math.PI * (i / 18); bezel.push([Math.cos(a) * (W / 2 - 0.06), H - W / 2 + Math.sin(a) * (W / 2 - 0.06), D / 2 + 0.005]); }
  bezel.push([-W / 2 + 0.06, 0.15, D / 2 + 0.005]);
  k.mesh(parent, tube(bezel, 0.028, 60, 10), tubeMat);
  // Record window (dark glass) with the carousel inside.
  k.add(extrudeShape(roundRectPoints(0.5, 0.36, 0.06), 0.02, 0.005), M.glassClear, 0, H - 0.5, D / 2 - 0.005);
  k.add(roundedBox(0.52, 0.38, 0.02, 0.01), M.black, 0, H - 0.5, D / 2 - 0.04);
  const carousel = k.group(parent, 0, H - 0.52, D / 2 - 0.12);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU, rec = new THREE.Mesh(CYL(0.11, 0.11, 0.004, 24), M.black);
    rec.rotation.x = Math.PI / 2; rec.position.set(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04); rec.rotation.z = a;
    const lab = new THREE.Mesh(CYL(0.035, 0.035, 0.006, 16), [M.redPaint, M.creamPaint, M.bluePaint][i % 3]); lab.rotation.x = Math.PI / 2; lab.position.copy(rec.position);
    carousel.add(rec, lab);
  }
  // Title strips and selection buttons under the window.
  k.add(roundedBox(0.56, 0.16, 0.05, 0.02), M.chrome, 0, H - 0.83, D / 2 - 0.01, 0, -0.3);
  for (let i = 0; i < 10; i++) k.add(roundedBox(0.04, 0.025, 0.03, 0.008), i % 2 ? M.creamPaint : M.redPaint, -0.2 + i * 0.045, H - 0.83, D / 2 + 0.03, 0, -0.3);
  const strips = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, emissive: 0xfff0c0, emissiveIntensity: 0.6, roughness: 0.6 });
  k.add(roundedBox(0.5, 0.1, 0.01, 0.003), strips, 0, H - 0.72, D / 2 + 0.01, 0, -0.15);
  // Speaker grille: chrome bars over dark cloth.
  k.add(roundedBox(0.56, 0.5, 0.02, 0.01), M.black, 0, 0.42, D / 2 - 0.01);
  for (let i = 0; i < 9; i++) k.add(CYL(0.008, 0.008, 0.5, 8), M.chrome, -0.24 + i * 0.06, 0.42, D / 2 + 0.01);
  k.add(roundedBox(0.62, 0.04, 0.04, 0.015), M.chrome, 0, 0.7, D / 2);
  k.add(roundedBox(0.62, 0.04, 0.04, 0.015), M.chrome, 0, 0.15, D / 2);
  k.add(roundedBox(W + 0.04, 0.06, D + 0.04, 0.02), M.black, 0, 0.03, 0);
  contactShadow(k, 1.1, 0.9);
  return { tubeMat, carousel, strips };
}

// Ceiling fan: brass motor housing on a down-rod, five pitched wooden blades on irons and a
// frosted light bowl. The rotor group spins.
export function ceilingFan(k, M, parent, ceilingY, drop = 0.45) {
  const y = ceilingY - drop;
  k.add(lathe([[0, ceilingY], [0.08, ceilingY], [0.085, ceilingY - 0.02], [0.06, ceilingY - 0.07], [0.015, ceilingY - 0.09], [0, ceilingY - 0.09]], 18, 'fancanopy' + ceilingY), M.brass);
  k.add(CYL(0.012, 0.012, drop - 0.1, 8), M.brass, 0, ceilingY - 0.05 - (drop - 0.1) / 2, 0);
  const rotor = k.group(parent, 0, y, 0);
  const housing = new THREE.Mesh(lathe([[0, 0.08], [0.06, 0.075], [0.11, 0.04], [0.12, 0], [0.11, -0.03], [0.07, -0.05], [0, -0.055]], 24, 'fanmotor'), M.brass);
  rotor.add(housing);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU, arm = new THREE.Group();
    arm.rotation.y = a;
    const iron = new THREE.Mesh(roundedBox(0.2, 0.012, 0.035, 0.005), M.brass); iron.position.set(0.17, -0.01, 0);
    const blade = new THREE.Mesh(roundedBox(0.58, 0.01, 0.14, 0.004), M.woodMid); blade.position.set(0.52, -0.02, 0); blade.rotation.x = 0.2;
    blade.castShadow = true;
    arm.add(iron, blade);
    rotor.add(arm);
  }
  const bowl = new THREE.Mesh(lathe([[0.1, -0.05], [0.095, -0.1], [0.06, -0.15], [0, -0.16]], 18, 'fanbowl'), M.paperShade);
  rotor.add(bowl);
  return rotor;
}

// Pendant lamp: cord, enamel shade (dark outside, warm inside) and a glowing bulb.
export function pendantLamp(k, M, ceilingY, drop = 0.9, shadeMat = M.lampShade, wide = false) {
  const y = ceilingY - drop;
  k.add(CYL(0.004, 0.004, drop, 6), M.black, 0, ceilingY - drop / 2, 0);
  k.add(lathe([[0.03, ceilingY], [0.035, ceilingY - 0.01], [0, ceilingY - 0.01]], 10, 'rose'), M.black, 0, 0, 0);
  const prof = wide ? [[0.03, 0.08], [0.07, 0.06], [0.2, -0.02], [0.32, -0.09], [0.33, -0.1]] : [[0.025, 0.1], [0.04, 0.08], [0.1, 0.02], [0.16, -0.06], [0.17, -0.075]];
  k.add(lathe(prof, 24, 'shade' + wide), shadeMat, 0, y, 0);
  k.add(lathe(prof.map(([r, yy]) => [r - 0.004, yy - 0.003]), 24, 'shadein' + wide), M.shadeInner, 0, y, 0);
  k.add(SPHERE(0.035, 12, 10), M.bulb, 0, y - 0.03, 0);
  return { lightY: y - 0.08 };
}

// A long billiard lamp hood (two bulbs) on chains.
export function billiardLamp(k, M, ceilingY, len = 1.4, drop = 1.6) {
  const y = ceilingY - drop;
  for (const s of [-1, 1]) k.add(CYL(0.004, 0.004, drop, 6), M.brass, s * len * 0.35, ceilingY - drop / 2, 0);
  k.add(roundedBox(len, 0.12, 0.34, 0.05, 3), M.lampShade, 0, y, 0);
  k.add(roundedBox(len - 0.04, 0.02, 0.3, 0.008), M.shadeInner, 0, y - 0.05, 0);
  for (const s of [-1, 0, 1]) k.add(SPHERE(0.03, 10, 8), M.bulb, s * len * 0.32, y - 0.06, 0);
  return { lightY: y - 0.1 };
}

// Wall sconce: brass arm and a frosted tulip shade.
export function sconce(k, M) {
  k.add(roundedBox(0.08, 0.14, 0.02, 0.008), M.brass, 0, 0, 0.01);
  k.add(tube([[0, 0, 0.02], [0, 0.04, 0.1], [0, 0.1, 0.13]], 0.008, 8, 6), M.brass);
  k.add(lathe([[0.02, 0], [0.05, 0.04], [0.065, 0.1], [0.06, 0.11]], 16, 'tulip'), M.paperShade, 0, 0.08, 0.13);
  k.add(SPHERE(0.025, 10, 8), M.bulb, 0, 0.13, 0.13);
}

// ------------------------------------------------------------------------------- walls
// Framed poster on the wall (front faces +z).
export function poster(k, M, kind, w = 0.5, h = 0.7, frame = M.black) {
  k.add(roundedBox(w + 0.04, h + 0.04, 0.02, 0.006), frame, 0, 0, 0.01);
  k.add(PLANE(w, h), new THREE.MeshStandardMaterial({ map: posterTexture(kind), roughness: 0.55 }), 0, 0, 0.022);
  k.add(PLANE(w, h), M.glass, 0, 0, 0.026);
}

// Neon sign on a dark acrylic back plate. Returns the material (to flicker).
export function neonSign(k, M, parent, text, color, w = 1.4, h = 0.35, plate = true) {
  if (plate) k.add(roundedBox(w + 0.06, h + 0.04, 0.02, 0.008), M.black, 0, 0, 0.01);
  const mat = neonMaterial(neonTubeTexture(text, color, { w: 512, h: Math.round(512 * h / w) }), 0xffffff, 2.6);
  const m = k.mesh(parent, PLANE(w, h), mat, 0, 0, 0.03);
  m.castShadow = false; m.receiveShadow = false;
  return mat;
}

// Wall clock with real moving hands.
export function wallClock(k, M, parent) {
  k.add(roundedCylinder(0.17, 0.04, 0.012, 32), M.woodDark, 0, 0, 0, 0, Math.PI / 2);
  const face = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#f4eee0'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
    g.fillStyle = '#1a1a1a'; g.font = 'bold 30px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - Math.PI / 2; g.fillText(String(i), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); }
    g.font = 'italic 14px Georgia'; g.fillText('SANGGARA', 128, 170);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const fm = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshStandardMaterial({ map: face, roughness: 0.6 }));
  k.matrix(0, 0, 0.042).decompose(fm.position, fm.quaternion, fm.scale); parent.add(fm);
  const hands = k.group(parent, 0, 0, 0.047);
  const hour = new THREE.Mesh(roundedBox(0.012, 0.08, 0.004, 0.002), M.black); hour.geometry = hour.geometry.clone().translate(0, 0.035, 0);
  const min = new THREE.Mesh(roundedBox(0.008, 0.12, 0.004, 0.002), M.black); min.geometry = min.geometry.clone().translate(0, 0.055, 0); min.position.z = 0.004;
  hands.add(hour, min);
  return { hour, min };
}

// Window looking out onto the dusk street: frame, mullions, glowing sky, half-open blinds.
export function duskWindow(k, M, w = 1.2, h = 1.3, blinds = true, frame = M.woodDark) {
  k.add(PLANE(w, h), M.windowDusk, 0, 0, -0.04);
  k.add(roundedBox(w + 0.12, 0.08, 0.1, 0.02), frame, 0, -h / 2 - 0.04, 0);
  k.add(roundedBox(w + 0.12, 0.06, 0.08, 0.02), frame, 0, h / 2 + 0.03, 0);
  k.add(roundedBox(0.06, h, 0.08, 0.02), frame, -w / 2 - 0.03, 0, 0);
  k.add(roundedBox(0.06, h, 0.08, 0.02), frame, w / 2 + 0.03, 0, 0);
  k.add(roundedBox(0.035, h, 0.05, 0.01), frame, 0, 0, 0);
  k.add(roundedBox(w, 0.035, 0.05, 0.01), frame, 0, h * 0.18, 0);
  k.add(PLANE(w, h), M.glass, 0, 0, 0.0);
  if (blinds) {
    const n = Math.round(h * 0.55 / 0.045);
    for (let i = 0; i < n; i++) k.add(roundedBox(w + 0.04, 0.004, 0.04, 0.002), M.creamPaint, 0, h / 2 - 0.03 - i * 0.045, 0.06, 0, 0.6);
    k.add(roundedBox(w + 0.06, 0.04, 0.05, 0.01), M.creamPaint, 0, h / 2 + 0.02, 0.06);
  }
}

// A panelled door leaf on a hinge, in a moulded frame. Returns the pivot group (rotate y to
// open). opts: { w, h, mat, glass (porthole), sign (text), signColor, swing (+1/-1) }.
export function hingedDoor(k, M, parent, opts = {}) {
  const w = opts.w ?? 0.9, h = opts.h ?? 2.1, mat = opts.mat ?? M.woodTeak, t = 0.045;
  // Casing (architrave) around the opening.
  const cas = opts.casing ?? M.woodDark;
  k.add(roundedBox(0.09, h + 0.06, 0.04, 0.012), cas, -w / 2 - 0.045, h / 2 + 0.03, 0.02);
  k.add(roundedBox(0.09, h + 0.06, 0.04, 0.012), cas, w / 2 + 0.045, h / 2 + 0.03, 0.02);
  k.add(roundedBox(w + 0.26, 0.1, 0.05, 0.015), cas, 0, h + 0.08, 0.025);
  if (opts.backCasing !== false) {
    k.add(roundedBox(0.09, h + 0.06, 0.04, 0.012), cas, -w / 2 - 0.045, h / 2 + 0.03, -0.17);
    k.add(roundedBox(0.09, h + 0.06, 0.04, 0.012), cas, w / 2 + 0.045, h / 2 + 0.03, -0.17);
    k.add(roundedBox(w + 0.26, 0.1, 0.05, 0.015), cas, 0, h + 0.08, -0.17);
  }
  const pivot = k.group(parent, -w / 2, 0, -0.04);
  const leaf = new THREE.Group(); leaf.position.x = w / 2; pivot.add(leaf);
  const add = (g, m, x, y, z, rx = 0) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.rotation.x = rx; me.castShadow = true; me.receiveShadow = true; leaf.add(me); return me; };
  add(roundedBox(w - 0.01, h - 0.01, t, 0.01), mat, 0, h / 2, 0);
  // Raised panels on both faces (or a round porthole window).
  for (const s of [-1, 1]) {
    if (opts.glass) {
      add(new THREE.TorusGeometry(0.15, 0.022, 8, 28), M.brass, 0, h * 0.7, s * (t / 2 + 0.005));
      add(new THREE.CircleGeometry(0.15, 28), M.glassClear, 0, h * 0.7, s * (t / 2 + 0.002)).rotation.y = s > 0 ? 0 : Math.PI;
      add(roundedBox(w * 0.62, h * 0.3, 0.014, 0.006), mat, 0, h * 0.25, s * (t / 2 + 0.004));
    } else {
      add(roundedBox(w * 0.62, h * 0.36, 0.014, 0.006), mat, 0, h * 0.7, s * (t / 2 + 0.004));
      add(roundedBox(w * 0.62, h * 0.3, 0.014, 0.006), mat, 0, h * 0.26, s * (t / 2 + 0.004));
    }
    // Lever handle and rose.
    add(CYL(0.025, 0.025, 0.01, 14), M.brass, w / 2 - 0.08, 1.0, s * (t / 2 + 0.005), Math.PI / 2);
    const lever = add(roundedBox(0.12, 0.018, 0.018, 0.008), M.brass, w / 2 - 0.12, 1.0, s * (t / 2 + 0.04));
    lever.geometry = lever.geometry;
    add(CYL(0.008, 0.008, 0.04, 8), M.brass, w / 2 - 0.08, 1.0, s * (t / 2 + 0.022), Math.PI / 2);
  }
  // Kick plate.
  add(roundedBox(w - 0.08, 0.18, 0.004, 0.002), M.brass, 0, 0.1, t / 2 + 0.003);
  if (opts.sign) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
    g.fillStyle = opts.signBg || '#f0e8d0'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90);
    g.fillStyle = opts.signColor || '#2a1a0a'; g.font = 'bold 44px Georgia'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opts.sign, 128, 50);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    add(new THREE.PlaneGeometry(0.3, 0.11), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5 }), 0, 1.55, t / 2 + 0.012);
  }
  return pivot;
}

// Potted plant: terracotta pot and a fan of leaf blades (monstera-ish).
export function pottedPlant(k, M, scale = 1, seed = 1) {
  const r = createRng(seed);
  k.push(0, 0, 0, 0, 0, 0, scale);
  k.add(lathe([[0, 0], [0.13, 0], [0.15, 0.03], [0.17, 0.3], [0.19, 0.32], [0.19, 0.35], [0.17, 0.35], [0, 0.33]], 20, 'pot'), M.terracotta);
  k.add(CYL(0.16, 0.16, 0.01, 16), M.soil, 0, 0.33, 0);
  const leaf = g1('leafblade', () => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.12, 0.08, 0.14, 0.3, 0, 0.42); s.bezierCurveTo(-0.14, 0.3, -0.12, 0.08, 0, 0);
    const g = new THREE.ShapeGeometry(s, 8);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, -Math.abs(x) * 0.6 + y * y * 0.4); }
    g.computeVertexNormals(); return g;
  });
  for (let i = 0; i < 11; i++) {
    const a = r.next() * TAU, tilt = r.range(0.4, 1.1), len = r.range(0.35, 0.6);
    k.add(CYL(0.006, 0.008, len, 5), M.leaf, Math.sin(a) * len * 0.3, 0.34 + len * 0.45, Math.cos(a) * len * 0.3, a, tilt * 0.6);
    k.add(leaf, M.leaf, Math.sin(a) * len * 0.62, 0.34 + len * 0.85, Math.cos(a) * len * 0.62, a, -Math.PI / 2 + tilt + 0.4, 0, 1, 1, 1);
  }
  k.pop();
}

// Dartboard on a cabinet backing.
export function dartboard(k, M) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#101010'; g.beginPath(); g.arc(128, 128, 127, 0, TAU); g.fill();
  for (let i = 0; i < 20; i++) {
    const a0 = (i - 0.5) / 20 * TAU - Math.PI / 2, a1 = (i + 0.5) / 20 * TAU - Math.PI / 2;
    for (const [r0, r1, cA, cB] of [[14, 60, '#f0e8c8', '#141414'], [60, 66, '#c82a2a', '#2a8a3a'], [66, 96, '#f0e8c8', '#141414'], [96, 102, '#c82a2a', '#2a8a3a']]) {
      g.fillStyle = i % 2 ? cA : cB; g.beginPath(); g.arc(128, 128, r1, a0, a1); g.arc(128, 128, r0, a1, a0, true); g.fill();
    }
  }
  g.fillStyle = '#2a8a3a'; g.beginPath(); g.arc(128, 128, 14, 0, TAU); g.fill(); g.fillStyle = '#c82a2a'; g.beginPath(); g.arc(128, 128, 6, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  k.add(roundedBox(0.62, 0.62, 0.04, 0.01), M.woodDark, 0, 0, 0.02);
  k.add(roundedCylinder(0.23, 0.04, 0.01, 32), M.black, 0, 0, 0.04, 0, Math.PI / 2);
  const face = g1('dartface', () => new THREE.CircleGeometry(0.22, 40));
  k.add(face, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), 0, 0, 0.082);
  for (let i = 0; i < 3; i++) k.add(CYL(0.003, 0.003, 0.1, 6), M.chrome, 0.03 * i - 0.04, 0.03 - i * 0.04, 0.13, 0, Math.PI / 2);
}

// Speaker cabinet (bar music), wall-mounted.
export function speakerBox(k, M) {
  k.add(roundedBox(0.3, 0.46, 0.26, 0.02), M.black, 0, 0, 0);
  k.add(CYL(0.1, 0.1, 0.01, 20), M.rubber, 0, -0.07, 0.13, 0, Math.PI / 2);
  k.add(CYL(0.04, 0.04, 0.01, 16), M.rubber, 0, 0.13, 0.13, 0, Math.PI / 2);
}

// Coat rack.
export function coatRack(k, M) {
  k.add(lathe([[0, 0], [0.2, 0], [0.2, 0.02], [0.05, 0.05], [0.025, 0.1], [0.02, 1.7], [0.03, 1.75], [0, 1.78]], 16, 'coatrack'), M.woodDark);
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; k.add(tube([[0, 1.62, 0], [Math.cos(a) * 0.12, 1.66, Math.sin(a) * 0.12], [Math.cos(a) * 0.15, 1.72, Math.sin(a) * 0.15]], 0.01, 8, 6), M.brass); }
}

export { CYL, SPHERE, PLANE };
