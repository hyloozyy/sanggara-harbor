// Hair, headwear and layered clothing as geometry on the same skinned mesh: hairstyles that
// follow the skull (crop, undercut, curly, bob, long, ponytail, bun), headscarves, caps,
// helmets, hard hats, peci and fishermen's hats, plus skirts, sarongs, vests, jackets,
// collars, hoods, aprons, bags and glasses.
import { regionUV } from './atlas-layout.js';
import { B, HEAD_C, torsoRings } from './body-geometry.js';
import { smooth, V } from './skinned-part-builder.js';

const HEAD = [[B.head, 1]];
const rel = (p) => V(p.x - HEAD_C[0], p.y - HEAD_C[1], p.z - HEAD_C[2]);
const out = (shape, d, off) => { const p = shape(d); const n = rel(p).normalize(); return p.addScaledVector(n, off); };
const hairUV = (d) => regionUV('hair', 0.5 + Math.atan2(d.x, d.z) / (Math.PI * 2), 0.5 + d.y * 0.5);
const noise3 = (d) => Math.sin(d.x * 23.1 + d.y * 7.3) * Math.sin(d.y * 19.7 - d.z * 5.1) * Math.sin(d.z * 17.3 + d.x * 3.7);

// Where the hairline runs: high on the forehead, down to the nape at the back.
function hairline(d, front = 0.42, back = -0.5) {
  const t = smooth(-0.9, 0.85, d.z);
  let thr = back + (front - back) * t;
  if (Math.abs(d.x) > 0.75 && d.z > -0.1 && d.z < 0.5) thr = Math.max(thr, 0.12); // around the ears
  return d.y > thr;
}

function neckBlend(y, top, bottom) {
  const t = smooth(top, bottom, y);
  return [[B.head, 1 - t], [B.neck, t * 0.5], [B.chest, t * 0.5]];
}

// --------------------------------------------------------------------- hair
export function addHair(b, style, shape, P) {
  if (!style || style === 'bald' || style === 'none') return;
  const cap = (off, vol, opt = {}) => b.ellipsoid({
    lat: 16, lon: 24, uvFn: hairUV, weightFn: () => HEAD,
    keep: (d) => hairline(d, (opt.front ?? 0.42) - 0.05, (opt.back ?? -0.5) - 0.05),
    map: (d) => {
      // The shell thins to nothing at the hairline, where the painted hair takes over (no step).
      const fr = opt.front ?? 0.42, bk = opt.back ?? -0.5, tt = smooth(-0.9, 0.85, d.z);
      const thr = bk + (fr - bk) * tt;
      const thin = smooth(thr - 0.05, thr + 0.16, d.y);
      let o = (off + vol * smooth(0.1, 0.95, d.y) + (opt.fringe ? opt.fringe * smooth(0.3, 0.9, d.z) * smooth(0.2, 0.6, d.y) : 0)) * (0.15 + 0.85 * thin);
      if (opt.curly) o += opt.curly * (0.6 + 0.4 * noise3(d));
      if (opt.sides) o *= 1 - opt.sides * smooth(0.55, 0.9, Math.abs(d.x)) * smooth(0.5, 0.1, d.y);
      return out(shape, d, o);
    },
  });
  switch (style) {
    case 'crop': cap(0.005, 0.008); break;
    case 'undercut': cap(0.003, 0.024, { fringe: 0.01, sides: 0.8, front: 0.45 }); break;
    case 'curly': cap(0.012, 0.012, { curly: 0.012, front: 0.38 }); break;
    case 'spiky': cap(0.006, 0.018, { curly: 0.006, front: 0.44 }); break;
    case 'bob': cap(0.008, 0.008, { fringe: 0.006, front: 0.5 }); curtain(b, shape, 1.635, 0.098, false); break;
    case 'long': cap(0.007, 0.007, { front: 0.48 }); curtain(b, shape, 1.33, 0.125, true); break;
    case 'ponytail': cap(0.004, 0.004, { front: 0.46 }); tail(b); break;
    case 'bun': cap(0.004, 0.004, { front: 0.46 }); bun(b); break;
    case 'grey-crop': cap(0.004, 0.005, { front: 0.5 }); break;
    default: cap(0.005, 0.008);
  }
}

// Hair falling behind the head down to the chin or the shoulder blades.
function curtain(b, shape, bottom, width, long) {
  const rings = [];
  const top = 1.8;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, y = top + (bottom - top) * t;
    const rx = (0.084 + t * (width - 0.084)) * (1 - 0.15 * Math.sin(t * Math.PI) * (long ? 0 : 1));
    const rz = long ? 0.09 - t * 0.055 : 0.098 - t * 0.02;
    const cz = long ? -0.012 - t * 0.075 : -0.016 - t * 0.02;
    rings.push({ c: [0, y, cz], rx, rz });
  }
  rings.unshift({ c: [0, top + 0.012, -0.012], rx: 0.03, rz: 0.03 });
  rings.push({ c: [0, bottom - 0.005, rings[rings.length - 1].c[2]], rx: width * 0.6, rz: 0.01 });
  b.sweep(rings, { segments: 18, uvFn: (u, v) => regionUV('hair', u, v), weightFn: (p) => neckBlend(p.y, 1.62, bottom), uRange: [0.12, 0.88] });
}

function tail(b) {
  const pts = [[0, 1.79, -0.075], [0, 1.775, -0.11], [0, 1.73, -0.13], [0, 1.66, -0.135], [0, 1.58, -0.125], [0, 1.53, -0.115]];
  const rad = [0.012, 0.026, 0.03, 0.026, 0.018, 0.004];
  const rings = pts.map((c, i) => ({ c, rx: rad[i], rz: rad[i] * 0.85 }));
  b.sweep(rings, { segments: 10, uvFn: (u, v) => regionUV('hair', u, v), weightFn: (p) => (p.y > 1.77 ? HEAD : [[B.hairTail, 1]]) });
  // Hair tie.
  b.sweep([{ c: [0, 1.785, -0.1], rx: 0.016, rz: 0.014 }, { c: [0, 1.775, -0.115], rx: 0.017, rz: 0.015 }, { c: [0, 1.765, -0.125], rx: 0.016, rz: 0.014 }],
    { segments: 8, uvFn: () => regionUV('dark', 0.5, 0.5), weightFn: () => HEAD });
}

function bun(b) {
  b.ellipsoid({ lat: 8, lon: 12, uvFn: hairUV, weightFn: () => HEAD, map: (d) => V(d.x * 0.042, 1.79 + d.y * 0.036, -0.09 + d.z * 0.038) });
}

// ------------------------------------------------------------------ headwear
export function addHeadwear(b, kind, shape) {
  if (!kind) return;
  const shell = (off, keep, region = 'hat', group = 0) => b.ellipsoid({
    lat: 16, lon: 24, group, weightFn: () => HEAD, keep,
    uvFn: (d) => regionUV(region, 0.5 + Math.atan2(d.x, d.z) / (Math.PI * 2), 0.5 + d.y * 0.5),
    map: (d) => out(shape, d, off(d)),
  });
  const disc = (y, z, rx, rz, th, front = 0, region = 'hat', tilt = 0) => b.ellipsoid({
    lat: 6, lon: 20, weightFn: () => HEAD, uvFn: (d) => regionUV(region, 0.5 + d.x * 0.5, 0.5 + d.z * 0.5),
    map: (d) => { const zz = z + d.z * rz + front * Math.max(0, d.z) * rz; return V(d.x * rx, y + d.y * th + tilt * (zz - z), zz); },
  });
  switch (kind) {
    case 'cap': // baseball cap with a curved brim
      shell((d) => 0.013 + 0.004 * smooth(0.6, 1, d.y), (d) => d.y > 0.28 + 0.05 * d.z);
      disc(1.79, 0.07, 0.07, 0.055, 0.004, 0.6, 'hat', -0.18);
      break;
    case 'cap-back':
      shell((d) => 0.013 + 0.004 * smooth(0.6, 1, d.y), (d) => d.y > 0.28 - 0.05 * d.z);
      disc(1.792, -0.075, 0.07, 0.05, 0.004, -0.6, 'hat', 0.15);
      break;
    case 'police-cap':
      b.sweep([{ c: [0, 1.895, 0.0], rx: 0.004, rz: 0.004 }, { c: [0, 1.893, 0.0], rx: 0.108, rz: 0.118 }, { c: [0, 1.86, -0.005], rx: 0.1, rz: 0.11 }, { c: [0, 1.79, -0.005], rx: 0.085, rz: 0.1 }, { c: [0, 1.785, -0.005], rx: 0.004, rz: 0.004 }],
        { segments: 20, uvFn: (u, v) => regionUV('hat', u, v), weightFn: () => HEAD });
      disc(1.79, 0.075, 0.068, 0.045, 0.004, 0.4, 'dark', -0.35);
      break;
    case 'peci': // black velvet songkok
      b.sweep([{ c: [0, 1.85, -0.005], rx: 0.004, rz: 0.004 }, { c: [0, 1.849, -0.005], rx: 0.079, rz: 0.098 }, { c: [0, 1.78, -0.005], rx: 0.083, rz: 0.104 }, { c: [0, 1.775, -0.005], rx: 0.004, rz: 0.004 }],
        { segments: 20, uvFn: (u, v) => regionUV('hat', u, v), weightFn: () => HEAD });
      break;
    case 'helmet': // scooter helmet with a dark visor
      shell((d) => 0.03, (d) => !(d.z > 0.35 && d.y < 0.4 && d.y > -0.65 && Math.abs(d.x) < 0.75) && d.y > -0.55);
      b.ellipsoid({ lat: 8, lon: 14, group: 1, weightFn: () => HEAD, uvFn: () => regionUV('lens', 0.5, 0.5),
        keep: (d) => d.z > 0.3 && d.y < 0.45 && d.y > -0.45, map: (d) => out(shape, d, 0.034) });
      break;
    case 'hardhat':
      shell((d) => 0.022 + 0.01 * smooth(0.5, 1, d.y), (d) => d.y > 0.2);
      disc(1.762, 0.0, 0.118, 0.13, 0.005, 0.35, 'hat');
      break;
    case 'straw': // conical caping hat
      b.sweep([{ c: [0, 1.96, 0], rx: 0.004, rz: 0.004 }, { c: [0, 1.93, 0], rx: 0.06, rz: 0.06 }, { c: [0, 1.84, 0], rx: 0.2, rz: 0.2 }, { c: [0, 1.81, 0], rx: 0.25, rz: 0.25 }, { c: [0, 1.8, 0], rx: 0.004, rz: 0.004 }],
        { segments: 22, uvFn: (u, v) => regionUV('hat', u, v), weightFn: () => HEAD });
      break;
    case 'hijab': break; // drawn by addHijab
    default: break;
  }
}

export function addHijab(b, shape) {
  const opening = (d) => d.z > 0.3 && (d.x / 0.66) ** 2 + ((d.y + 0.14) / 0.66) ** 2 < 1;
  b.ellipsoid({ lat: 18, lon: 26, weightFn: () => HEAD, keep: (d) => !opening(d),
    uvFn: (d) => regionUV('hat', 0.5 + Math.atan2(d.x, d.z) / (Math.PI * 2), 0.55 + d.y * 0.45),
    map: (d) => { const o = 0.011 + 0.007 * smooth(0.2, -0.8, d.y) + 0.004 * smooth(0.4, 1, d.y); return out(shape, d, o); } });
  // The drape over the shoulders is built by garment-geometry.js (addHijabDrape).
}

// ----------------------------------------------------------------- clothing
export function addSkirt(b, P, length, flare = 1) {
  const bottomY = length === 'long' ? 0.11 : length === 'midi' ? 0.33 : 0.5;
  const rings = [];
  const top = 1.06;
  for (let i = 0; i <= 7; i++) {
    const t = i / 7, y = top + (bottomY - top) * t;
    const hip = smooth(0, 0.18, t);
    rings.push({ c: [0, y, -0.004 + t * 0.01], rx: P.waistRx + 0.012 + (P.hipRx - P.waistRx + 0.02) * hip + t * 0.045 * flare, rz: P.waistRz + 0.014 + 0.03 * hip + t * 0.05 * flare + P.belly });
  }
  b.sweep(rings, {
    segments: 22, uvFn: (u, v, p) => regionUV('outer', u, 0.3 + 0.7 * (p.y - bottomY) / (top - bottomY)),
    weightFn: (p) => {
      // Cloth hangs between the legs: each vertex follows both thighs, mostly the nearer one,
      // so the front and back panels stretch across a stride instead of splitting.
      const t = smooth(0.98, bottomY + 0.05, p.y);
      const mixL = smooth(-0.13, 0.13, p.x);
      const lw = t * 0.78;
      const shin = t * smooth(0.5, 0.25, p.y) * 0.3;
      return [[B.hips, 1 - lw], [B.legL, (lw - shin) * mixL], [B.legR, (lw - shin) * (1 - mixL)], [B.shinL, shin * mixL], [B.shinR, shin * (1 - mixL)]];
    },
  });
}

// A layer over the torso (vests, jackets, aprons-on-a-body) built from the body's own rings.
export function addTorsoShell(b, P, yTop, yBottom, inflate, region = 'outer') {
  const rings = torsoRings(P).filter((r) => r.c[1] <= yTop && r.c[1] >= yBottom).map((r) => ({ c: [...r.c], rx: r.rx + inflate, rz: r.rz + inflate * 1.1 }));
  const first = rings[0], last = rings[rings.length - 1];
  rings.unshift({ c: [first.c[0], first.c[1] + 0.004, first.c[2]], rx: first.rx * 0.82, rz: first.rz * 0.82 });
  rings.push({ c: [last.c[0], last.c[1] - 0.004, last.c[2]], rx: last.rx - 0.004, rz: last.rz - 0.004 });
  b.sweep(rings, {
    segments: 22, uvFn: (u, v, p) => regionUV(region, u, 0.3 + 0.7 * (p.y - yBottom) / (yTop - yBottom)),
    weightFn: (p) => {
      const y = p.y, hs = smooth(0.96, 1.1, y), sc = smooth(1.18, 1.32, y);
      const side = p.x >= 0 ? 'L' : 'R';
      const sh = smooth(P.shoulderX - 0.08, P.shoulderX + 0.01, Math.abs(p.x)) * smooth(1.3, 1.42, y) * 0.4;
      return [[B.hips, 1 - hs], [B.spine, hs * (1 - sc)], [B.chest, sc], [B['arm' + side], sh]];
    },
  });
}

export function addCollar(b, P, region = 'trim', open = true) {
  const r = P.neckR;
  const rings = [{ c: [0, 1.565, -0.008], rx: r + 0.012, rz: r + 0.01 }, { c: [0, 1.535, -0.006], rx: r + 0.02, rz: r + 0.018 }, { c: [0, 1.505, 0], rx: r + 0.045, rz: r + 0.03 }];
  b.sweep(rings, { segments: 18, uvFn: (u, v) => regionUV(region, u, v), weightFn: () => [[B.chest, 0.6], [B.neck, 0.4]], uRange: open ? [0.56, 1.44] : [0, 1] });
}

export function addHood(b, P) {
  const rings = [
    { c: [0, 1.6, -0.1], rx: 0.03, rz: 0.03 }, { c: [0, 1.585, -0.1], rx: 0.1, rz: 0.05 }, { c: [0, 1.55, -0.085], rx: 0.13, rz: 0.07 },
    { c: [0, 1.5, -0.07], rx: 0.13, rz: 0.06 }, { c: [0, 1.47, -0.07], rx: 0.03, rz: 0.03 },
  ];
  b.sweep(rings, { segments: 16, uvFn: (u, v) => regionUV('outer', u, v * 0.25), weightFn: () => [[B.chest, 1]] });
}

export function addApron(b, P) {
  const z0 = P.chestRz + P.belly + 0.012;
  const rows = [[1.36, 0.11, z0 - 0.015], [1.2, 0.13, P.waistRz + P.belly + 0.02], [1.02, 0.17, P.hipRz + 0.02], [0.8, 0.18, P.hipRz + 0.03], [0.6, 0.18, P.hipRz + 0.035]];
  const rings = rows.map(([y, w, z]) => ({ c: [0, y, z], rx: w, rz: 0.006 }));
  b.sweep(rings, { segments: 10, uvFn: (u, v) => regionUV('outer', u, v), weightFn: (p) => {
    const hs = smooth(0.96, 1.1, p.y), sc = smooth(1.18, 1.32, p.y), lg = smooth(0.95, 0.7, p.y) * 0.4;
    return [[B.hips, (1 - hs) * (1 - lg)], [B.spine, hs * (1 - sc)], [B.chest, sc], [p.x >= 0 ? B.legL : B.legR, lg]];
  } });
}

export function addBag(b, P, kind) {
  if (kind === 'backpack') {
    const z = -(P.chestRz + 0.06);
    b.ellipsoid({ lat: 8, lon: 12, uvFn: (d) => regionUV('bag', 0.5 + d.x * 0.5, 0.5 + d.y * 0.5), weightFn: () => [[B.chest, 1]],
      map: (d) => { const e = (q) => Math.sign(q) * Math.abs(q) ** 0.45; return V(e(d.x) * 0.13, 1.25 + e(d.y) * 0.17, z + e(d.z) * 0.06); } });
    return;
  }
  // Shoulder bag resting on the left hip.
  const x = P.hipRx + 0.04;
  b.ellipsoid({ lat: 8, lon: 12, uvFn: (d) => regionUV('bag', 0.5 + d.x * 0.5, 0.5 + d.y * 0.5), weightFn: () => [[B.hips, 1]],
    map: (d) => { const e = (q) => Math.sign(q) * Math.abs(q) ** 0.4; return V(x + e(d.x) * 0.03, 0.98 + e(d.y) * 0.09, 0.02 + e(d.z) * 0.12); } });
}

export function addGlasses(b, J, sun = true) {
  const [lx, ly, lz0] = J.lidL;
  const lz = lz0 + 0.0125;
  for (const s of [1, -1]) {
    const x = lx * s;
    // Frame ring and a lens disc.
    const rings = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      rings.push({ c: [x + Math.cos(a) * 0.021, ly + Math.sin(a) * 0.016, lz + 0.016], rx: 0.0022, rz: 0.0022 });
    }
    b.sweep(rings, { segments: 5, uvFn: () => regionUV('dark', 0.5, 0.5), weightFn: () => HEAD, group: 1 });
    if (sun) b.ellipsoid({ lat: 4, lon: 10, group: 1, uvFn: () => regionUV('lens', 0.5, 0.5), weightFn: () => HEAD,
      map: (d) => V(x + d.x * 0.02, ly + d.y * 0.015, lz + 0.016 + d.z * 0.002) });
    // Arm to the ear.
    b.sweep([{ c: [x + s * 0.021, ly + 0.004, lz + 0.014], rx: 0.002, rz: 0.002 }, { c: [s * 0.083, ly + 0.006, lz - 0.05], rx: 0.002, rz: 0.002 }, { c: [s * 0.084, ly - 0.01, lz - 0.085], rx: 0.002, rz: 0.002 }],
      { segments: 4, uvFn: () => regionUV('dark', 0.5, 0.5), weightFn: () => HEAD, group: 1 });
  }
  b.sweep([{ c: [lx - 0.021, ly + 0.004, lz + 0.016], rx: 0.002, rz: 0.002 }, { c: [0, ly + 0.008, lz + 0.022], rx: 0.002, rz: 0.002 }, { c: [-lx + 0.021, ly + 0.004, lz + 0.016], rx: 0.002, rz: 0.002 }],
    { segments: 4, uvFn: () => regionUV('dark', 0.5, 0.5), weightFn: () => HEAD, group: 1 });
}
