// The human body as smooth skinned surfaces: a torso swept through anatomical cross-sections
// (pelvis, waist, ribcage, chest, shoulders, neck), continuous arm and leg tubes that bend at
// the elbows and knees, a sculpted head (skull, jaw, chin, brow ridge, cheekbones, eye
// sockets) with nose, ears, eyeballs, eyelids and a mouth, hands with fingers and shoes.
import { regionUV, headU, headV, aroundU } from './atlas-layout.js';
import { smooth, V } from './skinned-part-builder.js';

export const B = {
  root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, jaw: 6, lidL: 7, lidR: 8,
  armL: 9, foreL: 10, handL: 11, armR: 12, foreR: 13, handR: 14,
  legL: 15, shinL: 16, footL: 17, legR: 18, shinR: 19, footR: 20, hairTail: 21, mouth: 22,
};
export const BONE_NAMES = Object.keys(B);
const PARENT = {
  hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', lidL: 'head', lidR: 'head',
  armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR',
  legL: 'hips', shinL: 'legL', footL: 'shinL', legR: 'hips', shinR: 'legR', footR: 'shinR', hairTail: 'head', mouth: 'head',
};

// Body proportions for a build key "gender:build" (geometry is cached per key).
export function proportions(gender, build) {
  const f = gender === 'f';
  const P = {
    f, build,
    chestRx: f ? 0.152 : 0.17, chestRz: f ? 0.112 : 0.122, waistRx: f ? 0.122 : 0.142, waistRz: f ? 0.096 : 0.104,
    hipRx: f ? 0.172 : 0.16, hipRz: f ? 0.118 : 0.112, shoulderX: f ? 0.17 : 0.186, legX: f ? 0.088 : 0.092,
    limb: f ? 1.0 : 1.14, belly: 0, bust: f ? 0.024 : 0, neckR: f ? 0.054 : 0.063,
  };
  if (build === 'slim') { P.chestRx *= 0.93; P.waistRx *= 0.92; P.waistRz *= 0.92; P.hipRx *= 0.95; P.limb *= 0.9; P.shoulderX -= 0.008; }
  if (build === 'heavy') { P.chestRx += 0.02; P.chestRz += 0.03; P.waistRx += 0.045; P.waistRz += 0.055; P.hipRx += 0.022; P.belly = 0.035; P.limb *= 1.16; P.shoulderX += 0.012; P.neckR += 0.008; }
  if (build === 'strong') { P.chestRx += 0.016; P.chestRz += 0.012; P.waistRx += 0.006; P.limb *= 1.12; P.shoulderX += 0.012; P.neckR += 0.006; }
  return P;
}

// Bind-pose joint positions (model space, metres, facing +z, feet on y = 0).
export function bindJoints(P, shape = headShape(P)) {
  const J = {
    root: [0, 0, 0], hips: [0, 0.98, 0], spine: [0, 1.07, 0], chest: [0, 1.25, 0], neck: [0, 1.5, -0.005], head: [0, 1.575, 0.0],
    jaw: [0, 1.656, 0.084], lidL: [0.031, 1.727, 0.071], lidR: [-0.031, 1.727, 0.071],
    armL: [P.shoulderX, 1.455, -0.01], foreL: [P.shoulderX, 1.165, -0.012], handL: [P.shoulderX, 0.915, 0],
    armR: [-P.shoulderX, 1.455, -0.01], foreR: [-P.shoulderX, 1.165, -0.012], handR: [-P.shoulderX, 0.915, 0],
    legL: [P.legX, 0.93, 0], shinL: [P.legX, 0.5, 0.005], footL: [P.legX, 0.085, -0.01],
    legR: [-P.legX, 0.93, 0], shinR: [-P.legX, 0.5, 0.005], footR: [-P.legX, 0.085, -0.01],
    hairTail: [0, 1.765, -0.09],
  };
  const m = facePoint(shape, 0, -0.068);
  J.jaw = [0, m.y - 0.012, m.z - 0.02];
  J.mouth = [0, m.y, m.z + 0.0012];
  for (const [k, s] of [['lidL', 1], ['lidR', -1]]) {
    const ex = s * (P.f ? 0.032 : 0.033);
    const e = facePoint(shape, ex, 0.011);
    J[k] = [ex, e.y, e.z - 0.0068];
  }
  return J;
}
export { PARENT };

// ---------------------------------------------------------------- head shape
export const HEAD_C = [0, 1.695, 0.008];
export function headShape(P) {
  const f = P.f;
  return (d) => {
    let x = d.x * (f ? 0.078 : 0.082), y = d.y * (f ? 0.12 : 0.124), z = d.z * 0.103;
    const low = smooth(0.0, -0.95, d.y);
    x *= 1 - (f ? 0.36 : 0.28) * low;                                   // jaw taper
    if (d.z < 0) z *= 1 - 0.5 * low * smooth(-0.2, -0.9, d.z) + 0.06 * smooth(-0.3, 0.6, d.y); // skull back, neck under it
    if (d.z > 0) z *= 1 - 0.12 * low * smooth(0.6, 0.95, Math.abs(d.x) + 0.3); // chin narrower than the jaw corners
    const front = smooth(0.35, 0.95, d.z);
    z -= 0.004 * front;                                                 // flatter face
    z += 0.0065 * front * Math.exp(-(((d.y - 0.24) / 0.09) ** 2)) * smooth(0.75, 0.2, Math.abs(d.x)); // brow ridge
    for (const ex of [-0.37, 0.37]) z -= 0.007 * front * Math.exp(-(((d.x - ex) / 0.13) ** 2 + ((d.y - 0.1) / 0.1) ** 2)); // eye sockets
    for (const cx of [-0.62, 0.62]) { const g = Math.exp(-(((d.x - cx) / 0.18) ** 2 + ((d.y + 0.05) / 0.16) ** 2)); x += Math.sign(cx) * 0.004 * g; z += 0.003 * g; } // cheekbones
    z += 0.006 * front * Math.exp(-(((d.y + 0.72) / 0.12) ** 2)) * smooth(0.4, 0.0, Math.abs(d.x)); // chin point
    z += 0.004 * front * Math.exp(-(((d.y + 0.42) / 0.1) ** 2)) * smooth(0.35, 0.0, Math.abs(d.x)); // lips
    return V(x + HEAD_C[0], y + HEAD_C[1], z + HEAD_C[2]);
  };
}

// Surface point of the face at head-local (x, y): march the shape along the front.
export function facePoint(shape, lx, ly) {
  let best = null, bd = 1e9;
  for (let i = 0; i <= 40; i++) {
    for (let j = 0; j <= 40; j++) {
      const th = (0.15 + 0.7 * i / 40) * Math.PI, ph = (-0.45 + 0.9 * j / 40) * Math.PI;
      const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      const p = shape(d);
      const e = (p.x - HEAD_C[0] - lx) ** 2 + (p.y - HEAD_C[1] - ly) ** 2;
      if (e < bd && d.z > 0) { bd = e; best = p; }
    }
  }
  return best;
}

export function headUV(p) {
  const x = p.x - HEAD_C[0], y = p.y - HEAD_C[1], z = p.z - HEAD_C[2];
  return regionUV('head', headU(Math.atan2(x, z)), headV(y));
}

// ---------------------------------------------------------------- weights
const W = (b, w = 1) => [B[b], w];
function torsoWeights(P, J) {
  return (p) => {
    const y = p.y, ax = Math.abs(p.x), side = p.x >= 0 ? 'L' : 'R';
    const w = [];
    const hs = smooth(0.96, 1.1, y), sc = smooth(1.18, 1.32, y), cn = smooth(1.47, 1.56, y);
    w.push(W('hips', 1 - hs), W('spine', hs * (1 - sc)), W('chest', sc * (1 - cn)), W('neck', cn));
    // Shoulder caps follow the arms a little; the crotch follows the thighs.
    const sh = smooth(P.shoulderX - 0.08, P.shoulderX + 0.01, ax) * smooth(1.3, 1.42, y) * (1 - cn) * 0.45;
    if (sh > 0) w.push(W('arm' + side, sh));
    const cr = smooth(0.93, 0.85, y) * smooth(0.02, 0.09, ax) * 0.55;
    if (cr > 0) w.push(W('leg' + side, cr));
    return w;
  };
}

function limbWeights(top, mid, end, yTop, yMid, yEnd, parent, blendTop = 0.05) {
  return (p) => {
    const y = p.y;
    const w = [];
    const pt = smooth(yTop - blendTop, yTop + 0.02, y) * 0.6;
    const m = smooth(yMid + 0.035, yMid - 0.035, y), e = smooth(yEnd + 0.025, yEnd - 0.02, y);
    w.push(W(top, (1 - m) * (1 - pt)), W(mid, m * (1 - e)), W(end, e));
    if (pt > 0) w.push(W(parent, pt));
    return w;
  };
}

// ---------------------------------------------------------------- parts
export function torsoRings(P) {
  const bz = P.belly, bu = P.bust;
  const ring = (y, rx, rz, cz = 0) => ({ c: [0, y, cz], rx, rz });
  const rings = [
    ring(1.635, P.neckR * 0.92, P.neckR * 0.95, 0.0),
    ring(1.59, P.neckR, P.neckR * 1.02, -0.004),
    ring(1.545, P.neckR * 1.1, P.neckR * 1.06, -0.008),
    ring(1.515, P.chestRx * 0.66, P.chestRz * 0.74, -0.012),
    ring(1.488, P.chestRx * 0.99, P.chestRz * 0.84, -0.012),
    ring(1.43, P.chestRx * 1.06, P.chestRz * 0.95, -0.008),
    ring(1.36, P.chestRx, P.chestRz + bu * 0.8, 0.0 + bu * 0.7),
    ring(1.3, P.chestRx * 0.97, P.chestRz + bu, 0.004 + bu * 0.8),
    ring(1.24, P.chestRx * 0.93, P.chestRz * 0.96 + bu * 0.3, 0.005 + bz * 0.3),
    ring(1.17, (P.chestRx + P.waistRx) * 0.5, (P.chestRz + P.waistRz) * 0.5 + bz * 0.6, 0.004 + bz * 0.6),
    ring(1.1, P.waistRx, P.waistRz + bz, 0.003 + bz * 0.9),
    ring(1.03, (P.waistRx + P.hipRx) * 0.5, P.waistRz * 1.04 + bz * 0.7, 0.002 + bz * 0.6),
    ring(0.96, P.hipRx, P.hipRz, -0.004),
    ring(0.9, P.hipRx * 0.97, P.hipRz * 0.98, -0.008),
    ring(0.86, P.hipRx * 0.86, P.hipRz * 0.88, -0.006),
    ring(0.835, P.hipRx * 0.55, P.hipRz * 0.6, -0.004),
    ring(0.825, 0.01, 0.01, -0.004),
  ];
  return rings;
}

export function addTorso(b, P, J) {
  const rings = torsoRings(P);
  const top = 1.635, bottom = 0.825;
  b.sweep(rings, {
    segments: 22,
    uvFn: (u, v, p) => regionUV('torso', u, (p.y - bottom) / (top - bottom)),
    weightFn: torsoWeights(P, J),
  });
}

export function addArms(b, P, J) {
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const x = J['arm' + side][0], z0 = J['arm' + side][2];
    const L = P.limb;
    const y0 = J['arm' + side][1], ye = J['fore' + side][1], yw = J['hand' + side][1];
    const r = (y, rx, rz, dx = 0, dz = 0) => ({ c: [x + dx * s, y, z0 + dz], rx: rx * L, rz: rz * L });
    const rings = [
      r(y0 + 0.02, 0.01, 0.01), r(y0 + 0.012, 0.032, 0.034), r(y0 - 0.02, 0.047, 0.05), r(y0 - 0.07, 0.05, 0.049, 0.003),
      r(y0 - 0.14, 0.047, 0.046, 0.002), r(ye + 0.06, 0.042, 0.04), r(ye + 0.015, 0.039, 0.037), r(ye - 0.02, 0.04, 0.038, 0, -0.002),
      r(ye - 0.07, 0.043, 0.039, 0, 0.004), r(ye - 0.15, 0.035, 0.03, 0, 0.006), r(yw + 0.03, 0.029, 0.022, 0, 0.008), r(yw + 0.005, 0.028, 0.02, 0, 0.008), r(yw - 0.01, 0.01, 0.01, 0, 0.008),
    ];
    const len = rings[0].c[1] - rings[rings.length - 1].c[1];
    b.sweep(rings, {
      segments: 12,
      uvFn: (u, v, p) => regionUV('arm', u, (p.y - rings[rings.length - 1].c[1]) / len),
      weightFn: limbWeights('arm' + side, 'fore' + side, 'hand' + side, y0, ye, yw + 0.01, 'chest', 0.06),
    });
    addHand(b, side, J, L);
  }
}

function addHand(b, side, J, L) {
  const s = side === 'L' ? 1 : -1;
  const [hx, hy, hz] = J['hand' + side];
  const bone = [[B['hand' + side], 1]];
  const skin = (d, p) => regionUV('skin', 0.5 + d.x * 0.4, 0.5 + d.y * 0.4);
  // Palm: a rounded slab, thin across x (palms face the thighs).
  b.ellipsoid({ lat: 8, lon: 12, uvFn: skin, weightFn: () => bone, map: (d) => {
    const e = (q, k) => Math.sign(q) * Math.abs(q) ** k;
    return V(hx + e(d.x, 0.8) * 0.017 * L - s * 0.004, hy - 0.045 + e(d.y, 0.7) * 0.045, hz + e(d.z, 0.7) * 0.04 * L);
  } });
  // Four fingers, gently curled, and a thumb on the front edge.
  for (let k = 0; k < 4; k++) {
    const fz = hz + (0.026 - k * 0.0175) * L, fl = [0.07, 0.078, 0.074, 0.06][k];
    const fr = 0.0085 * L;
    const rings = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5, curl = t * t * 0.022;
      rings.push({ c: [hx - s * 0.002 - s * curl * 0.2, hy - 0.08 - t * fl, fz + curl], rx: fr * (i === 5 ? 0.3 : 1 - t * 0.2), rz: fr * (i === 5 ? 0.3 : 1 - t * 0.15) });
    }
    rings.unshift({ c: [hx, hy - 0.072, fz], rx: fr * 0.4, rz: fr * 0.4 });
    b.sweep(rings, { segments: 6, uvFn: (u, v) => regionUV('skin', u, v), weightFn: () => bone });
  }
  const tr = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    tr.push({ c: [hx + s * (0.006 + t * 0.012), hy - 0.035 - t * 0.05, hz + 0.038 * L + t * 0.012], rx: 0.011 * L * (i === 4 ? 0.4 : 1 - t * 0.2), rz: 0.011 * L * (i === 4 ? 0.4 : 1) });
  }
  tr.unshift({ c: [hx, hy - 0.025, hz + 0.03 * L], rx: 0.004, rz: 0.004 });
  b.sweep(tr, { segments: 6, uvFn: (u, v) => regionUV('skin', u, v), weightFn: () => bone });
}

export function addLegs(b, P, J) {
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const [x, y0] = J['leg' + side];
    const yk = J['shin' + side][1], ya = J['foot' + side][1];
    const L = P.limb * (P.f ? 1.04 : 1);
    const r = (y, rx, rz, dx = 0, dz = 0) => ({ c: [x + dx * s, y, dz], rx: rx * L, rz: rz * L });
    const rings = [
      r(y0 + 0.06, 0.03, 0.03), r(y0 + 0.03, 0.08, 0.085, -0.004), r(y0 - 0.04, 0.089, 0.092, 0.002), r(y0 - 0.14, 0.083, 0.083, 0.003, 0.004),
      r(y0 - 0.26, 0.071, 0.071, 0.002, 0.006), r(yk + 0.07, 0.058, 0.058, 0, 0.008), r(yk + 0.02, 0.052, 0.054, 0, 0.012),
      r(yk - 0.04, 0.05, 0.052, 0, 0.004), r(yk - 0.12, 0.054, 0.058, 0, -0.008), r(yk - 0.2, 0.047, 0.049, 0, -0.006),
      r(ya + 0.1, 0.034, 0.035, 0, -0.002), r(ya + 0.035, 0.032, 0.034, 0, -0.004), r(ya - 0.005, 0.012, 0.012, 0, -0.004),
    ];
    const len = rings[0].c[1] - rings[rings.length - 1].c[1];
    b.sweep(rings, {
      segments: 12,
      uvFn: (u, v, p) => regionUV('leg', u, (p.y - rings[rings.length - 1].c[1]) / len),
      weightFn: limbWeights('leg' + side, 'shin' + side, 'foot' + side, y0, yk, ya + 0.02, 'hips', 0.07),
    });
    addShoe(b, side, J, P);
  }
}

function addShoe(b, side, J, P) {
  const [fx, , fz] = J['foot' + side];
  const bone = [[B['foot' + side], 1]];
  const len = P.f ? 0.125 : 0.135, wid = P.f ? 0.045 : 0.05;
  b.ellipsoid({ lat: 8, lon: 14, uvFn: (d) => regionUV('shoe', 0.5 + Math.atan2(d.x, d.z) / (Math.PI * 2), 0.5 + d.y * 0.5), weightFn: () => bone,
    map: (d) => {
      const e = (q, k) => Math.sign(q) * Math.abs(q) ** k;
      const zz = e(d.z, 0.6);
      const toe = smooth(0.2, 1, zz);
      const yy = e(d.y, 0.5);
      return V(fx + e(d.x, 0.6) * wid * (1 - 0.25 * toe), 0.042 + yy * 0.042 * (1 - 0.45 * toe) - (yy < 0 ? 0 : 0), fz + 0.045 + zz * len);
    } });
}

export function addHead(b, P, J, shape) {
  const head = [[B.head, 1]];
  b.ellipsoid({ lat: 22, lon: 30, map: shape, uvFn: (d, p) => headUV(p), weightFn: (p) => {
    // The lower lip and chin follow the jaw a little so talking moves the face.
    const lx = p.x - HEAD_C[0], ly = p.y - HEAD_C[1], lz = p.z - HEAD_C[2];
    const jw = smooth(-0.05, -0.085, ly) * smooth(0.04, 0.075, lz) * smooth(0.05, 0.02, Math.abs(lx)) * 0.7;
    return [[B.head, 1 - jw], [B.jaw, jw]];
  } });
  // Nose: bridge to tip with soft nostril wings.
  const nb = facePoint(shape, 0, 0.0);
  const nz = nb.z;
  b.ellipsoid({ lat: 8, lon: 12, uvFn: (d, p) => headUV(p), weightFn: () => head, map: (d) => {
    const t = (1 - d.y) * 0.5; // 0 top .. 1 bottom
    const w = (P.f ? 0.0095 : 0.011) + t * t * 0.008;
    const proj = 0.004 + t * 0.016;
    return V(HEAD_C[0] + d.x * w, HEAD_C[1] + 0.022 - t * 0.05, nz - 0.012 + Math.max(0, d.z) * proj + d.z * 0.006);
  } });
  // Ears.
  for (const s of [1, -1]) {
    b.ellipsoid({ lat: 6, lon: 10, uvFn: () => regionUV('skin', 0.5, 0.5), weightFn: () => head, map: (d) => V(
      HEAD_C[0] + s * ((P.f ? 0.077 : 0.081) + Math.max(0, d.x * s) * 0.012 + d.x * 0.004),
      HEAD_C[1] + 0.0 + d.y * 0.027,
      HEAD_C[2] - 0.006 + d.z * 0.017 - Math.max(0, d.x * s) * 0.004) });
  }
  // Eyes (glossy group) with eyelids that close over them.
  for (const side of ['L', 'R']) {
    const [ex, ey, ez] = J['lid' + side];
    const er = 0.0118;
    b.ellipsoid({ lat: 8, lon: 12, group: 1, weightFn: () => head,
      uvFn: (d) => regionUV('eye', 0.5 + d.x * 0.5, 0.5 + d.y * 0.5),
      map: (d) => V(ex + d.x * er, ey + d.y * er, ez + d.z * er) });
    b.ellipsoid({ lat: 6, lon: 12, weightFn: () => [[B['lid' + side], 1]], uvFn: () => regionUV('skin', 0.5, 0.5),
      keep: (d) => d.y > 0.1 || d.z < -0.2,
      map: (d) => V(ex + d.x * er * 1.18, ey + d.y * er * 1.15, ez + d.z * er * 1.16) });
  }
  // Mouth: a dark slit that opens with the jaw bone.
  const [mx, my, mz] = J.mouth;
  b.ellipsoid({ lat: 4, lon: 10, weightFn: () => [[B.mouth, 1]], uvFn: () => regionUV('dark', 0.5, 0.5),
    map: (d) => V(mx + d.x * (P.f ? 0.017 : 0.019), my + d.y * 0.009, mz + d.z * 0.003) });
}

export const HEAD_WEIGHTS = [[B.head, 1]];
export { aroundU };
