// The human body as smooth skinned surfaces, built from anatomy rather than from boxes:
//   * a torso whose every cross-section is a superellipse with its own width, front and back
//     depth (pelvis, glutes, waist, ribcage, chest, the trapezius sloping from the neck to the
//     shoulders), plus pectorals or a bust, shoulder blades, the spine groove, clavicles, a belly;
//   * arms and legs as tubes with muscle profiles (deltoid, biceps, triceps, forearm, a flat
//     wrist; thigh, kneecap, calf, ankle bones) that bend at the elbows and knees;
//   * hands with a palm and five fingers on their own bones (two per finger), so they can rest
//     curled, grip a wheel or a glass, or open for a wave or a handshake;
//   * a head sculpted on a grid that is dense where the face needs it: skull, brow ridge, eye
//     sockets, cheekbones, a nose with a bridge, tip and wings, lips that really part (the mouth
//     line is a doubled row: the upper lip follows the head, the lower the jaw), chin, jaw
//     corners; eyeballs (sclera, iris, pupil) behind almond-shaped openings, upper lids that
//     blink, lash lines, ears, teeth and a dark mouth inside; bones for the eyes (gaze), the
//     brows and the mouth corners (expressions);
//   * shoes lofted from heel to toe with a flat sole.
// Every part is built at two levels of detail ('near' and 'far', see humanoid-model.js).
import * as THREE from 'three';
import { regionUV, headU, headV, aroundU } from './atlas-layout.js';
import { smooth, V } from './skinned-part-builder.js';

export const FINGERS = ['thumb', 'index', 'mid', 'ring', 'pinky'];
export const B = {
  root: 0, hips: 1, spine: 2, chest: 3, neck: 4, head: 5, jaw: 6, lidL: 7, lidR: 8,
  armL: 9, foreL: 10, handL: 11, armR: 12, foreR: 13, handR: 14,
  legL: 15, shinL: 16, footL: 17, legR: 18, shinR: 19, footR: 20, hairTail: 21, mouth: 22,
};
{
  let i = 23;
  for (const side of ['L', 'R']) for (const f of FINGERS) { B[f + side + '1'] = i++; B[f + side + '2'] = i++; }
  for (const k of ['browL', 'browR', 'cornerL', 'cornerR', 'eyeL', 'eyeR', 'skirtF', 'skirtB']) B[k] = i++;
}
export const BONE_NAMES = Object.keys(B);
const PARENT = {
  hips: 'root', spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', jaw: 'head', lidL: 'head', lidR: 'head',
  armL: 'chest', foreL: 'armL', handL: 'foreL', armR: 'chest', foreR: 'armR', handR: 'foreR',
  legL: 'hips', shinL: 'legL', footL: 'shinL', legR: 'hips', shinR: 'legR', footR: 'shinR', hairTail: 'head', mouth: 'head',
  browL: 'head', browR: 'head', cornerL: 'head', cornerR: 'head', eyeL: 'head', eyeR: 'head', skirtF: 'hips', skirtB: 'hips',
};
for (const side of ['L', 'R']) for (const f of FINGERS) { PARENT[f + side + '1'] = 'hand' + side; PARENT[f + side + '2'] = f + side + '1'; }
export { PARENT };

const W = (b, w = 1) => [B[b], w];
const bell = (u) => (Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 2);
const gauss = (u) => Math.exp(-u * u);
const sgnPow = (q, k) => Math.sign(q) * Math.abs(q) ** k;

// Body proportions for a build key "gender:build" (geometry is cached per key).
export function proportions(gender, build) {
  const f = gender === 'f';
  const P = {
    f, build,
    chestRx: f ? 0.152 : 0.17, chestRz: f ? 0.112 : 0.122, waistRx: f ? 0.122 : 0.142, waistRz: f ? 0.096 : 0.104,
    hipRx: f ? 0.172 : 0.16, hipRz: f ? 0.118 : 0.112, shoulderX: f ? 0.168 : 0.186, legX: f ? 0.088 : 0.092,
    limb: f ? 0.9 : 1.0, belly: 0, bust: f ? 0.024 : 0, neckR: f ? 0.054 : 0.065, hand: f ? 0.91 : 1.0,
  };
  if (build === 'slim') { P.chestRx *= 0.94; P.chestRz *= 0.95; P.waistRx *= 0.92; P.waistRz *= 0.92; P.hipRx *= 0.95; P.limb *= 0.9; P.shoulderX -= 0.006; }
  if (build === 'heavy') { P.chestRx += 0.02; P.chestRz += 0.03; P.waistRx += 0.045; P.waistRz += 0.055; P.hipRx += 0.022; P.belly = 0.035; P.limb *= 1.14; P.shoulderX += 0.012; P.neckR += 0.008; }
  if (build === 'strong') { P.chestRx += 0.016; P.chestRz += 0.012; P.waistRx += 0.006; P.limb *= 1.12; P.shoulderX += 0.012; P.neckR += 0.006; }
  return P;
}

// ---------------------------------------------------------------- head shape (the skull)
export const HEAD_C = [0, 1.695, 0.008];
export function headShape(P) {
  const f = P.f;
  return (d) => {
    let x = d.x * (f ? 0.077 : 0.081), y = d.y * (f ? 0.118 : 0.123), z = d.z * 0.101;
    const low = smooth(0.0, -0.95, d.y), jawLow = smooth(-0.3, -1.0, d.y);
    x *= 1 - (f ? 0.08 : 0.05) * low - (f ? 0.26 : 0.2) * jawLow * jawLow;   // jaw taper, mostly below the jaw angle
    if (d.z < 0) z *= 1 - 0.5 * low * smooth(-0.2, -0.9, d.z) + 0.06 * smooth(-0.3, 0.6, d.y); // skull back, neck under it
    if (d.z > 0) z *= 1 - 0.12 * low * smooth(0.6, 0.95, Math.abs(d.x) + 0.3); // chin narrower than the jaw corners
    const front = smooth(0.35, 0.95, d.z);
    z -= 0.005 * front;                                                 // flatter face
    z += 0.006 * front * Math.exp(-(((d.y - 0.26) / 0.09) ** 2)) * smooth(0.75, 0.2, Math.abs(d.x)); // brow ridge
    for (const ex of [-0.38, 0.38]) z -= 0.008 * front * Math.exp(-(((d.x - ex) / 0.15) ** 2 + ((d.y - 0.06) / 0.12) ** 2)); // eye sockets
    for (const cx of [-0.62, 0.62]) { const g = Math.exp(-(((d.x - cx) / 0.2) ** 2 + ((d.y + 0.08) / 0.16) ** 2)); x += Math.sign(cx) * 0.004 * g; z += 0.0035 * g; } // cheekbones
    for (const cx of [-0.8, 0.8]) x += Math.sign(cx) * (f ? 0.003 : 0.0055) * Math.exp(-(((d.x - cx) / 0.2) ** 2 + ((d.y + 0.62) / 0.14) ** 2)) * smooth(-0.3, 0.3, d.z); // jaw corners
    return V(x + HEAD_C[0], y + HEAD_C[1], z + HEAD_C[2]);
  };
}

// Surface point of the skull at head-local (x, y): march the shape along the front.
export function facePoint(shape, lx, ly) {
  let best = null, bd = 1e9;
  for (let i = 0; i <= 48; i++) {
    for (let j = 0; j <= 48; j++) {
      const th = (0.15 + 0.85 * i / 48) * Math.PI, ph = (-0.45 + 0.9 * j / 48) * Math.PI;
      const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      const p = shape(d);
      const e = (p.x - HEAD_C[0] - lx) ** 2 + (p.y - HEAD_C[1] - ly) ** 2;
      if (e < bd && d.z > 0) { bd = e; best = p; }
    }
  }
  return best;
}

// Face layout (head-local metres) shared by the geometry, the bones and the painter.
const faceCache = new Map();
export function faceLayout(P) {
  const key = P.f ? 'f' : 'm';
  if (faceCache.has(key)) return faceCache.get(key);
  const shape = headShape(P);
  const ry = P.f ? 0.118 : 0.123;
  const F = {
    ry, ex: P.f ? 0.0315 : 0.0325, ey: 0.006, re: 0.0118,
    aw: 0.0114, ah: P.f ? 0.0046 : 0.0041, tilt: 0.0009,
    ym: -0.0665, lipW: P.f ? 0.0225 : 0.0245, ntip: -0.033, nb: -0.046,
  };
  // The mouth row sits exactly on a grid row: its polar angle.
  F.thM = Math.acos(F.ym / ry);
  const lz = (x, y) => facePoint(shape, x, y).z - HEAD_C[2];
  F.eyeSkull = lz(F.ex, F.ey);
  F.ez = F.eyeSkull + 0.0022 - F.re;           // eyeball centre (local z)
  F.mz = lz(0, F.ym);                          // skull front at the mouth line
  faceCache.set(key, F);
  return F;
}

// Displacement of the face (local dz) at local (lx, ly) on the skull's front.
function faceDz(lx, ly, lz, F) {
  const ax = Math.abs(lx);
  let dz = 0;
  // Nose: nasion → bridge → tip, a rounded bulb, then back under to the base; nostril wings.
  const top = F.ey + 0.022;
  if (ly < top + 0.004 && ly > F.nb - 0.006) {
    let h, w;
    if (ly > F.ntip) { const t = clamp01((top - ly) / (top - F.ntip)); h = 0.0025 + 0.0175 * t ** 1.25; w = 0.0062 + 0.0058 * t * t; }
    else { const t = clamp01((F.ntip - ly) / (F.ntip - F.nb + 0.002)); h = 0.02 * (1 - t * t * (3 - 2 * t)) + 0.0015; w = 0.012 + 0.003 * t; }
    h *= smooth(top + 0.004, top - 0.004, ly);
    dz += h * bell(lx / w);
  }
  for (const s of [-1, 1]) dz += 0.0082 * Math.exp(-(((lx - s * 0.0128) / 0.0058) ** 2) - (((ly - (F.ntip - 0.0075)) / 0.0062) ** 2));
  // Lips: a forward dental arch, upper and lower lip volumes, the mouth line, the groove under
  // the lower lip and the chin.
  const lat = bell(lx / F.lipW) ** 0.45;
  dz += 0.0045 * gauss(lx / 0.03) * gauss((ly - F.ym) / 0.022);
  dz += 0.0042 * lat * gauss((ly - (F.ym + 0.0048)) / 0.0042);
  dz += 0.0052 * lat * gauss((ly - (F.ym - 0.0058)) / 0.0048);
  dz -= 0.0018 * lat * gauss((ly - F.ym) / 0.0011);
  dz += 0.0012 * gauss(lx / 0.0035) * smooth(F.nb, F.nb - 0.004, ly) * smooth(F.ym + 0.012, F.ym + 0.009, ly) * 0; // (philtrum kept flat)
  dz -= 0.0024 * bell(lx / 0.026) * gauss((ly - (F.ym - 0.0175)) / 0.0042);
  dz += 0.004 * gauss(lx / 0.018) * gauss((ly - (F.ym - 0.036)) / 0.012);
  // Nasolabial folds and the cheek fullness beside them.
  for (const s of [-1, 1]) {
    const ax0 = s * 0.017, ay0 = F.nb + 0.004, bx = s * (F.lipW + 0.009), by = F.ym - 0.005;
    const vx = bx - ax0, vy = by - ay0, t = clamp01(((lx - ax0) * vx + (ly - ay0) * vy) / (vx * vx + vy * vy));
    const dd = Math.hypot(lx - ax0 - vx * t, ly - ay0 - vy * t);
    dz -= 0.0016 * gauss(dd / 0.0032);
    dz += 0.0022 * gauss((lx - s * 0.042) / 0.016) * gauss((ly - (F.ym + 0.012)) / 0.02);
  }
  // Eyes: the lids hug the eyeball, an almond opening shows it.
  for (const s of [-1, 1]) {
    const dx = lx - s * F.ex, dy = ly - F.ey, r = Math.hypot(dx, dy);
    if (r > F.re * 1.6) continue;
    const ball = F.ez + Math.sqrt(Math.max(0, F.re * F.re - r * r));
    const hug = smooth(F.re * 0.98, F.re * 0.45, r);
    const z0 = lz + dz;
    let z = z0 + (ball + 0.0021 - z0) * hug;
    const u = dx / F.aw;
    if (Math.abs(u) < 1.05) {
      const k = Math.max(0, 1 - u * u);
      const tl = F.tilt * s * u;
      const up = F.ah * k ** 0.72 + tl, lo = -F.ah * 0.72 * k ** 0.85 + tl;
      const open = smooth(-0.0007, 0.0007, up - dy) * smooth(-0.0007, 0.0007, dy - lo);
      z -= open * 0.011;
    }
    // A soft upper-lid fold and the hollow under the brow.
    z += 0.0008 * gauss((dy - F.ah - 0.0045) / 0.0018) * bell(dx / 0.016);
    dz += z - z0;
  }
  return dz;
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The face surface: skull plus the displaced features on its front.
export function faceShape(P) {
  const shape = headShape(P), F = faceLayout(P);
  return (d) => {
    const p = shape(d);
    if (d.z > 0.05 && d.y < 0.6) {
      const lx = p.x - HEAD_C[0], ly = p.y - HEAD_C[1], lz = p.z - HEAD_C[2];
      p.z += faceDz(lx, ly, lz, F) * smooth(0.05, 0.45, d.z);
    }
    return p;
  };
}

// Bind-pose joint positions (model space, metres, facing +z, feet on y = 0).
export function bindJoints(P) {
  const F = faceLayout(P);
  const H = HEAD_C;
  const J = {
    root: [0, 0, 0], hips: [0, 0.98, 0], spine: [0, 1.07, 0], chest: [0, 1.25, 0], neck: [0, 1.5, -0.012], head: [0, 1.575, -0.004],
    armL: [P.shoulderX, 1.455, -0.01], foreL: [P.shoulderX, 1.165, -0.012], handL: [P.shoulderX, 0.915, 0],
    armR: [-P.shoulderX, 1.455, -0.01], foreR: [-P.shoulderX, 1.165, -0.012], handR: [-P.shoulderX, 0.915, 0],
    legL: [P.legX, 0.93, 0], shinL: [P.legX, 0.5, 0.005], footL: [P.legX, 0.085, -0.01],
    legR: [-P.legX, 0.93, 0], shinR: [-P.legX, 0.5, 0.005], footR: [-P.legX, 0.085, -0.01],
    hairTail: [0, 1.765, -0.09], skirtF: [0, 0.93, 0.02], skirtB: [0, 0.93, -0.02],
  };
  J.jaw = [0, H[1] - 0.028, H[2] - 0.012];
  J.mouth = [0, H[1] + F.ym, H[2] + F.mz + 0.004];
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    J['lid' + k] = [s * F.ex, H[1] + F.ey, H[2] + F.ez];
    J['eye' + k] = [s * F.ex, H[1] + F.ey, H[2] + F.ez];
    J['brow' + k] = [s * (F.ex + 0.002), H[1] + F.ey + 0.026, H[2] + F.eyeSkull + 0.008];
    J['corner' + k] = [s * F.lipW, H[1] + F.ym, H[2] + F.mz + 0.002];
  }
  // Hands: the fingers hang down from the knuckles; the thumb sits forward on the palm.
  const hs = P.hand;
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const [hx, hy, hz] = J['hand' + k];
    for (const f of HAND) {
      const kx = hx - s * f.kx * hs, ky = hy - f.ky * hs, kz = hz + f.kz * hs;
      J[f.n + k + '1'] = [kx, ky, kz];
      if (f.n === 'thumb') J[f.n + k + '2'] = [kx - s * 0.007 * hs, ky - 0.033 * hs, kz + 0.008 * hs];
      else J[f.n + k + '2'] = [kx, ky - f.l1 * hs, kz];
    }
  }
  return J;
}

// Knuckle positions (from the wrist joint, model metres), finger segment lengths and radii.
const HAND = [
  { n: 'thumb', kx: 0.008, ky: 0.032, kz: 0.022, l1: 0.032, l2: 0.027, r: 0.0098 },
  { n: 'index', kx: 0.001, ky: 0.09, kz: 0.026, l1: 0.039, l2: 0.037, r: 0.0079 },
  { n: 'mid', kx: 0, ky: 0.094, kz: 0.0085, l1: 0.043, l2: 0.041, r: 0.0082 },
  { n: 'ring', kx: 0.001, ky: 0.091, kz: -0.0085, l1: 0.04, l2: 0.038, r: 0.0077 },
  { n: 'pinky', kx: 0.002, ky: 0.083, kz: -0.0245, l1: 0.031, l2: 0.029, r: 0.0067 },
];

export function headUV(p) {
  const x = p.x - HEAD_C[0], y = p.y - HEAD_C[1], z = p.z - HEAD_C[2];
  return regionUV('head', headU(Math.atan2(x, z)), headV(y));
}

// ---------------------------------------------------------------- torso
// Cross-section key frames: [y, half width, front depth, back depth, centre z, exponent].
const TORSO_M = [
  [0.83, 0.03, 0.03, 0.03, -0.004, 2], [0.855, 0.12, 0.075, 0.09, -0.006, 2.2], [0.9, 0.158, 0.094, 0.112, -0.006, 2.3], [0.95, 0.164, 0.1, 0.108, -0.004, 2.3],
  [1.0, 0.157, 0.104, 0.094, -0.002, 2.2], [1.06, 0.146, 0.105, 0.085, 0, 2.1], [1.12, 0.149, 0.106, 0.086, 0.001, 2.1], [1.18, 0.156, 0.11, 0.09, 0.002, 2.15],
  [1.24, 0.163, 0.114, 0.095, 0.004, 2.2], [1.3, 0.168, 0.116, 0.099, 0.004, 2.25], [1.36, 0.171, 0.11, 0.1, 0.002, 2.35], [1.41, 0.172, 0.098, 0.096, -0.002, 2.5],
  [1.45, 0.172, 0.08, 0.088, -0.006, 2.6], [1.48, 0.158, 0.062, 0.076, -0.01, 2.5], [1.51, 0.126, 0.052, 0.068, -0.014, 2.3], [1.535, 0.091, 0.052, 0.062, -0.016, 2.1],
  [1.56, 0.064, 0.056, 0.058, -0.016, 2], [1.6, 0.059, 0.057, 0.057, -0.01, 2], [1.645, 0.056, 0.055, 0.055, -0.004, 2], [1.675, 0.034, 0.034, 0.034, -0.002, 2],
];
const TORSO_F = [
  [0.83, 0.03, 0.03, 0.03, -0.004, 2], [0.855, 0.125, 0.075, 0.095, -0.008, 2.2], [0.9, 0.17, 0.094, 0.124, -0.008, 2.3], [0.95, 0.173, 0.098, 0.116, -0.006, 2.3],
  [1.0, 0.158, 0.098, 0.096, -0.003, 2.2], [1.06, 0.132, 0.092, 0.08, 0, 2.1], [1.12, 0.127, 0.092, 0.078, 0.001, 2.1], [1.18, 0.135, 0.098, 0.08, 0.002, 2.15],
  [1.24, 0.143, 0.103, 0.084, 0.003, 2.2], [1.3, 0.148, 0.106, 0.088, 0.003, 2.25], [1.36, 0.152, 0.102, 0.088, 0.002, 2.35], [1.41, 0.154, 0.09, 0.085, -0.002, 2.5],
  [1.45, 0.154, 0.073, 0.078, -0.006, 2.6], [1.48, 0.14, 0.057, 0.069, -0.01, 2.5], [1.51, 0.11, 0.048, 0.061, -0.013, 2.3], [1.535, 0.078, 0.047, 0.056, -0.015, 2.1],
  [1.56, 0.054, 0.05, 0.052, -0.015, 2], [1.6, 0.05, 0.05, 0.05, -0.01, 2], [1.645, 0.048, 0.048, 0.048, -0.004, 2], [1.675, 0.03, 0.03, 0.03, -0.002, 2],
];

// Smooth interpolation through key rows (Catmull-Rom on uneven spacing).
function keyAt(keys, y, col) {
  if (y <= keys[0][0]) return keys[0][col];
  const n = keys.length;
  if (y >= keys[n - 1][0]) return keys[n - 1][col];
  let i = 0;
  while (keys[i + 1][0] < y) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const t = (y - k1[0]) / (k2[0] - k1[0]);
  const m1 = (k2[col] - k0[col]) / (k2[0] - k0[0] || 1) * (k2[0] - k1[0]);
  const m2 = (k3[col] - k1[col]) / (k3[0] - k1[0] || 1) * (k2[0] - k1[0]);
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * k1[col] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[col] + (t3 - t2) * m2;
}

// Point on the torso at height y, angle phi (0 = front, +pi/2 = the body's left, +x), pushed
// out by `inflate` (garments). Shared by the body and every garment over it.
export function torsoPoint(P, y, phi, inflate = 0) {
  const K = P.f ? TORSO_F : TORSO_M;
  const base = P.f ? [0.152, 0.112, 0.122, 0.096, 0.172, 0.118, 0.168] : [0.17, 0.122, 0.142, 0.104, 0.16, 0.112, 0.186];
  // Build scaling: hips below 1.0, waist around 1.1, chest above 1.2, shoulders above 1.42.
  const wHip = smooth(1.06, 0.96, y), wChest = smooth(1.14, 1.24, y), wWaist = 1 - wHip - wChest;
  const sx = wHip * P.hipRx / base[4] + wChest * P.chestRx / base[0] + wWaist * P.waistRx / base[2];
  const sz = wHip * P.hipRz / base[5] + wChest * P.chestRz / base[1] + wWaist * P.waistRz / base[3];
  const sh = smooth(1.38, 1.47, y) * smooth(1.53, 1.5, y);
  const neck = smooth(1.52, 1.56, y);
  let X = keyAt(K, y, 1) * (sx * (1 - sh) + sh * P.shoulderX / base[6]);
  let Zf = keyAt(K, y, 2) * sz, Zb = keyAt(K, y, 3) * sz;
  if (neck > 0) { const nr = P.neckR / (P.f ? 0.05 : 0.059) * 0.97; X = X * (1 - neck) + keyAt(K, y, 1) * nr * neck; Zf = Zf * (1 - neck) + keyAt(K, y, 2) * nr * neck; Zb = Zb * (1 - neck) + keyAt(K, y, 3) * nr * neck; }
  const cz = keyAt(K, y, 4), n = keyAt(K, y, 5);
  const s = Math.sin(phi), c = Math.cos(phi);
  let x = X * sgnPow(s, 2 / n), z = (c >= 0 ? Zf : Zb) * sgnPow(c, 2 / n);
  // Surface details as offsets along the outward direction.
  let o = inflate;
  const ax = Math.abs(x), front = smooth(0.1, 0.6, c), back = smooth(-0.1, -0.6, c);
  if (P.f) {
    const bu = P.bust / 0.024;
    o += 0.036 * bu * front * gauss((ax - 0.072) / 0.05) * gauss((y - 1.305) / 0.055) * (y < 1.305 ? 1 : 0.85);
    o += 0.012 * bu * front * gauss(x / 0.07) * gauss((y - 1.3) / 0.05);
  } else {
    o += 0.011 * front * gauss((ax - 0.07) / 0.055) * gauss((y - 1.365) / 0.055) * (y < 1.33 ? smooth(1.27, 1.33, y) : 1);
  }
  o -= 0.004 * front * gauss(x / 0.012) * gauss((y - 1.25) / 0.1);                     // sternum line
  o += 0.004 * front * gauss((y - 1.475) / 0.01) * smooth(0.02, 0.05, ax) * smooth(0.16, 0.12, ax); // clavicles
  o -= 0.006 * front * gauss(x / 0.014) * gauss((y - 1.49) / 0.012);                   // sternal notch
  o += 0.008 * back * gauss((ax - 0.08) / 0.045) * gauss((y - 1.37) / 0.06);           // shoulder blades
  o -= 0.006 * back * gauss(x / 0.012) * smooth(0.98, 1.08, y) * smooth(1.48, 1.4, y); // spine groove
  o += (P.f ? 0.024 : 0.018) * back * gauss((ax - 0.062) / 0.055) * gauss((y - 0.905) / 0.05); // glutes
  o -= 0.01 * back * gauss(x / 0.01) * smooth(0.97, 0.9, y);                            // cleft
  o += P.belly * 1.1 * front * gauss(x / 0.11) * gauss((y - 1.06) / 0.09);              // belly
  o += 0.004 * front * gauss((ax - 0.05) / 0.03) * gauss((y - 0.95) / 0.03) * (P.f ? 0.3 : 1); // hip bones
  o += (P.f ? 0 : 0.004) * front * gauss(x / 0.01) * gauss((y - 1.585) / 0.01);         // Adam's apple
  const len = Math.hypot(x / Math.max(X, 1e-3), z / Math.max(c >= 0 ? Zf : Zb, 1e-3)) || 1;
  const nx = x / (X * X || 1), nz = z / (((c >= 0 ? Zf : Zb) ** 2) || 1), nl = Math.hypot(nx, nz) || 1;
  void len;
  x += (nx / nl) * o; z += (nz / nl) * o;
  return V(x, y, z + cz);
}

// Compatibility: elliptic rings approximating the torso (some garments still use them).
export function torsoRings(P) {
  const ys = [1.635, 1.59, 1.545, 1.515, 1.488, 1.43, 1.36, 1.3, 1.24, 1.17, 1.1, 1.03, 0.96, 0.9, 0.86, 0.835, 0.825];
  return ys.map((y) => {
    const a = torsoPoint(P, y, Math.PI / 2), f = torsoPoint(P, y, 0), b = torsoPoint(P, y, Math.PI);
    return { c: [0, y, (f.z + b.z) / 2], rx: Math.max(0.004, a.x), rz: Math.max(0.004, (f.z - b.z) / 2) };
  });
}

export function torsoWeights(P) {
  return (p) => {
    const y = p.y, ax = Math.abs(p.x), side = p.x >= 0 ? 'L' : 'R';
    const w = [];
    const hs = smooth(0.96, 1.1, y), sc = smooth(1.18, 1.32, y), cn = smooth(1.49, 1.57, y), hd = smooth(1.62, 1.665, y);
    w.push(W('hips', 1 - hs), W('spine', hs * (1 - sc)), W('chest', sc * (1 - cn)), W('neck', cn * (1 - hd)), W('head', cn * hd));
    // Shoulder caps follow the arms a little; the crotch follows the thighs.
    const sh = smooth(P.shoulderX - 0.075, P.shoulderX + 0.01, ax) * smooth(1.3, 1.42, y) * (1 - cn) * 0.5;
    if (sh > 0) w.push(W('arm' + side, sh));
    const cr = smooth(0.94, 0.85, y) * smooth(0.02, 0.09, ax) * 0.6;
    if (cr > 0) w.push(W('leg' + side, cr));
    return w;
  };
}

export function addTorso(b, P, J, lod = 'near') {
  const rows = lod === 'near' ? 44 : 18, cols = lod === 'near' ? 36 : 14;
  const y0 = 0.83, y1 = 1.675;
  const wf = torsoWeights(P);
  const pts = [], uvs = [], ws = [];
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const y = y1 + (y0 - y1) * t;
    const row = [], ur = [], wr = [];
    for (let j = 0; j <= cols; j++) {
      const u = j / cols, phi = (u - 0.5) * Math.PI * 2;
      const p = torsoPoint(P, y, phi);
      row.push(p); ur.push(regionUV('torso', u, (y - 0.825) / (1.635 - 0.825))); wr.push(wf(p));
    }
    pts.push(row); uvs.push(ur); ws.push(wr);
  }
  b.surface(pts, uvs, ws, { seam: true });
}

// ---------------------------------------------------------------- limbs
function limbWeights(top, mid, end, yTop, yMid, yEnd, parent, blendTop = 0.05) {
  return (p) => {
    const y = p.y;
    const w = [];
    const pt = smooth(yTop - blendTop, yTop + 0.03, y) * 0.6;
    const m = smooth(yMid + 0.04, yMid - 0.03, y), e = smooth(yEnd + 0.025, yEnd - 0.02, y);
    w.push(W(top, (1 - m) * (1 - pt)), W(mid, m * (1 - e)), W(end, e));
    if (pt > 0) w.push(W(parent, pt));
    return w;
  };
}

// A limb tube from key rows [y, side radius (outer, +x for the left limb), inner radius,
// front, back, centre x shift (outwards), centre z shift].
function limbTube(b, side, x0, z0, keys, scale, region, weightFn, lod, rows) {
  const s = side === 'L' ? 1 : -1;
  const yTop = keys[0][0], yBot = keys[keys.length - 1][0];
  keys = [...keys].sort((p, q) => p[0] - q[0]);              // keyAt wants ascending heights
  const cols = lod === 'near' ? 20 : 9;
  rows = lod === 'near' ? rows : Math.ceil(rows / 2.5);
  b.tube({
    rows, cols, sideRef: V(1, 0, 0),
    centre: (t) => { const y = yTop + (yBot - yTop) * t; return V(x0 + s * keyAt(keys, y, 5) * scale, y, z0 + keyAt(keys, y, 6) * scale); },
    shape: (t, phi) => {
      const y = yTop + (yBot - yTop) * t;
      const sn = Math.sin(phi), cs = Math.cos(phi);
      const outer = sn * s >= 0;
      const rx = keyAt(keys, y, outer ? 1 : 2) * scale, rz = keyAt(keys, y, cs >= 0 ? 3 : 4) * scale;
      return { x: rx * sgnPow(sn, 2 / 2.2), z: rz * sgnPow(cs, 2 / 2.2) };
    },
    uvFn: (u, t, p) => regionUV(region, u, (p.y - yBot) / (yTop - yBot)),
    weightFn: (p) => weightFn(p),
  });
}

export function addArms(b, P, J, lod = 'near') {
  for (const side of ['L', 'R']) {
    const [x, y0, z0] = J['arm' + side];
    const ye = J['fore' + side][1], yw = J['hand' + side][1];
    const L = P.limb;
    // [y, outer, inner, front, back, dx, dz]
    const keys = [
      [y0 + 0.032, 0.014, 0.012, 0.014, 0.014, -0.006, 0], [y0 + 0.02, 0.034, 0.028, 0.036, 0.038, -0.002, 0], [y0 - 0.002, 0.047, 0.039, 0.048, 0.05, 0.003, 0],
      [y0 - 0.035, 0.053, 0.042, 0.051, 0.05, 0.006, 0], [y0 - 0.09, 0.046, 0.042, 0.047, 0.046, 0.003, 0], [y0 - 0.16, 0.041, 0.04, 0.047, 0.044, 0.001, 0.001],
      [ye + 0.06, 0.038, 0.038, 0.042, 0.04, 0, 0], [ye + 0.018, 0.035, 0.036, 0.036, 0.04, 0, -0.002], [ye - 0.022, 0.038, 0.039, 0.04, 0.04, 0, 0],
      [ye - 0.07, 0.04, 0.04, 0.043, 0.039, 0, 0.002], [ye - 0.14, 0.033, 0.032, 0.038, 0.034, 0, 0.004], [yw + 0.035, 0.021, 0.02, 0.029, 0.026, 0, 0.006],
      [yw + 0.008, 0.019, 0.018, 0.027, 0.025, 0, 0.006], [yw - 0.012, 0.011, 0.011, 0.015, 0.015, 0, 0.006],
    ];
    limbTube(b, side, x, z0, keys, L, 'arm', limbWeights('arm' + side, 'fore' + side, 'hand' + side, y0, ye, yw + 0.01, 'chest', 0.06), lod, 34);
    addHand(b, side, J, P, lod);
  }
}

// The hand: a palm (thicker at the heel and the thumb ball, arched across the knuckles) with
// fingers and a thumb on their own bones.
function addHand(b, side, J, P, lod) {
  const s = side === 'L' ? 1 : -1, hs = P.hand;
  const [hx, hy, hz] = J['hand' + side];
  const skin = (u, v) => regionUV('skin', 0.1 + u * 0.8, 0.1 + v * 0.8);
  const hand = W('hand' + side), fore = W('fore' + side);
  const near = lod === 'near';
  // Palm: lofted from the wrist to the knuckles, wide across (z) and thin (x); the heel of the
  // hand and the ball of the thumb bulge on the palm side (-s*x); the knuckle end is rounded.
  const pl = 0.094 * hs;
  b.tube({
    rows: near ? 12 : 5, cols: near ? 18 : 8, sideRef: V(1, 0, 0),
    centre: (t) => V(hx - s * 0.0015, hy + 0.006 - t * pl, hz + 0.003 * hs),
    shape: (t, phi) => {
      const sn = Math.sin(phi), cs = Math.cos(phi);
      let w = (0.031 + 0.011 * smooth(0, 0.7, t)) * hs, th = (0.0175 - 0.0055 * smooth(0, 0.8, t)) * hs;
      const palmSide = sn * s < 0;
      if (palmSide) th *= 1 + 0.35 * gauss((t - 0.35) / 0.25) * smooth(-0.2, 0.7, cs) + 0.15 * gauss((t - 0.25) / 0.2) * smooth(0.2, -0.7, cs);
      let k = 1;
      if (t > 0.84) k = Math.sqrt(Math.max(0.03, 1 - ((t - 0.84) / 0.16) ** 2));
      // Superellipse: boxy across the back of the hand, rounder at the edges.
      return { x: th * sgnPow(sn, 0.88) * (0.4 + 0.6 * k), z: w * sgnPow(cs, 0.78) * (0.75 + 0.25 * k) };
    },
    uvFn: (u, t) => skin(u, t),
    weightFn: (p) => { const k = smooth(hy - 0.01, hy + 0.012, p.y); return [[hand[0], 1 - k * 0.5], [fore[0], k * 0.5]]; },
  });
  for (const f of HAND) {
    const k1 = J[f.n + side + '1'], k2 = J[f.n + side + '2'];
    const b1 = W(f.n + side + '1'), b2 = W(f.n + side + '2');
    const thumb = f.n === 'thumb';
    // Centre line: from inside the palm, through the knuckle, to the tip.
    const start = thumb ? V(hx - s * 0.004 * hs, hy - 0.012 * hs, hz + 0.014 * hs) : V(k1[0], k1[1] + 0.014 * hs, k1[2]);
    const K1 = V(...k1), K2 = V(...k2);
    const dir2 = K2.clone().sub(K1).normalize();
    const tip = K2.clone().addScaledVector(dir2, f.l2 * hs);
    const segs = [start, K1, K2, tip];
    const total = [0, start.distanceTo(K1), K1.distanceTo(K2), K2.distanceTo(tip)].reduce((a, v, i, arr) => { a.push((a[i - 1] || 0) + v); return a; }, []);
    const L = total[3];
    const at = (t) => {
      const d = t * L;
      let i = 0; while (i < 2 && total[i + 1] < d) i++;
      const u = (d - total[i]) / (total[i + 1] - total[i] || 1);
      return segs[i].clone().lerp(segs[i + 1], u);
    };
    const r0 = f.r * hs;
    b.tube({
      rows: near ? 11 : 4, cols: near ? 9 : 5, front: thumb ? V(0, 0, 1) : V(0, 0, 1), sideRef: V(1, 0, 0),
      centre: at,
      shape: (t, phi) => {
        const d = t * L;
        let r = r0 * (1 - 0.18 * smooth(total[1], L, d));
        if (d > total[1] - 0.004 && d < total[1] + 0.006) r *= 1.07;              // knuckle
        if (Math.abs(d - total[2]) < 0.005) r *= 1.05;                            // middle joint
        const tipK = smooth(L - 0.011 * hs, L, d);
        r *= Math.sqrt(Math.max(0.02, 1 - tipK * tipK));
        if (t < 0.08) r *= 0.6 + 5 * t;
        const sn = Math.sin(phi), cs = Math.cos(phi);
        const flat = sn * s > 0 ? 0.86 : 1;                                       // flatter on the back (nail side)
        return { x: r * sn * flat, z: r * cs * (thumb ? 1.05 : 1.08) };
      },
      uvFn: (u, t) => skin(u, t),
      weightFn: (p, t) => {
        const d = t * L;
        const a = smooth(total[1] - 0.006, total[1] + 0.006, d), c = smooth(total[2] - 0.005, total[2] + 0.005, d);
        return [[hand[0], 1 - a], [b1[0], a * (1 - c)], [b2[0], c]];
      },
    });
  }
}

export function addLegs(b, P, J, lod = 'near') {
  for (const side of ['L', 'R']) {
    const [x, y0] = J['leg' + side];
    const yk = J['shin' + side][1], ya = J['foot' + side][1];
    const L = P.limb * (P.f ? 1.06 : 1);
    // [y, outer, inner, front, back, dx, dz]
    const keys = [
      [y0 + 0.07, 0.04, 0.04, 0.045, 0.045, -0.006, 0], [y0 + 0.035, 0.08, 0.072, 0.084, 0.088, 0, 0], [y0 - 0.04, 0.088, 0.083, 0.089, 0.09, 0.002, 0],
      [y0 - 0.14, 0.081, 0.08, 0.087, 0.08, 0.002, 0.002], [y0 - 0.26, 0.07, 0.072, 0.076, 0.068, 0.001, 0.004], [yk + 0.085, 0.058, 0.064, 0.064, 0.056, 0, 0.006],
      [yk + 0.025, 0.051, 0.053, 0.06, 0.05, 0, 0.008], [yk - 0.035, 0.049, 0.05, 0.052, 0.056, 0, 0.003], [yk - 0.11, 0.053, 0.055, 0.046, 0.068, 0, -0.006],
      [yk - 0.2, 0.045, 0.046, 0.043, 0.054, 0, -0.005], [ya + 0.12, 0.035, 0.035, 0.036, 0.038, 0, -0.003], [ya + 0.05, 0.03, 0.03, 0.031, 0.033, 0, -0.004],
      [ya + 0.012, 0.031, 0.031, 0.029, 0.031, 0, -0.004], [ya - 0.012, 0.016, 0.016, 0.016, 0.016, 0, -0.004],
    ];
    limbTube(b, side, x, 0, keys, L, 'leg', limbWeights('leg' + side, 'shin' + side, 'foot' + side, y0, yk, ya + 0.02, 'hips', 0.07), lod, 40);
    addShoe(b, side, J, P, lod);
  }
}

// A shoe lofted from heel to toe: flat sole, rounded heel counter, collar round the ankle,
// instep sloping down to a rounded toe box.
function addShoe(b, side, J, P, lod) {
  const [fx, , fz] = J['foot' + side];
  const s = side === 'L' ? 1 : -1;
  const foot = W('foot' + side);
  const Lf = P.f ? 0.232 : 0.252, heel = fz - 0.062;
  const boot = P.boot ? 1 : 0;
  const wAt = (t) => keyAt([[0, 0.03], [0.12, 0.034], [0.35, 0.037], [0.62, 0.046], [0.8, 0.045], [0.93, 0.036], [1, 0.03]], t, 1) * (P.f ? 0.92 : 1);
  const hAt = (t) => keyAt([[0, 0.072 + boot * 0.06], [0.2, 0.098 + boot * 0.07], [0.32, 0.096 + boot * 0.06], [0.5, 0.072], [0.7, 0.054], [0.88, 0.044], [1, 0.03]], t, 1);
  b.tube({
    rows: lod === 'near' ? 22 : 8, cols: lod === 'near' ? 18 : 8, front: V(0, 1, 0), sideRef: V(1, 0, 0),
    centre: (t) => V(fx + s * 0.004 * smooth(0.4, 0.9, t), hAt(t) / 2, heel + t * Lf),
    shape: (t, phi) => {
      let k = 1;
      if (t < 0.1) k = Math.sqrt(Math.max(0.02, 1 - ((0.1 - t) / 0.1) ** 2));
      if (t > 0.86) k = Math.sqrt(Math.max(0.02, 1 - ((t - 0.86) / 0.14) ** 2));
      const sn = Math.sin(phi), cs = Math.cos(phi);
      const hh = hAt(t) / 2, ww = wAt(t);
      // Flat sole, rounder top.
      const zz = cs < 0 ? -hh * Math.abs(cs) ** 0.35 : hh * cs ** 0.8;
      const vz = t > 0.86 || t < 0.1 ? zz * (0.35 + 0.65 * k) - (1 - k) * hh * 0.4 : zz;
      return { x: ww * sgnPow(sn, 0.7) * k, z: vz };
    },
    uvFn: (u, t, p) => regionUV('shoe', u, Math.min(1, p.y / 0.1)),
    weightFn: (p) => { const k = smooth(0.1, 0.16, p.y) * 0.5; return [[foot[0], 1 - k], [B['shin' + side], k]]; },
  });
}

// ---------------------------------------------------------------- head
// Rows (polar angle) and columns (around) are packed where the face needs detail: around the
// eyes, the nose and the lips. The mouth line is a doubled row.
function denseSamples(n, density, lo, hi, steps = 2000) {
  const cum = [0];
  for (let i = 1; i <= steps; i++) { const a = lo + (hi - lo) * (i - 0.5) / steps; cum.push(cum[i - 1] + density(a)); }
  const total = cum[steps], out = [];
  for (let k = 0; k < n; k++) {
    const target = total * k / (n - 1);
    let i = 0; while (i < steps && cum[i + 1] < target) i++;
    const f = (target - cum[i]) / (cum[i + 1] - cum[i] || 1);
    out.push(lo + (hi - lo) * (i + f) / steps);
  }
  return out;
}

export function addHead(b, P, J, lod = 'near') {
  const F = faceLayout(P);
  const shape = faceShape(P);
  const near = lod === 'near';
  const ry = F.ry;
  const thEye = Math.acos(F.ey / ry), thNose = Math.acos(-0.03 / ry);
  const band = (a, c, w) => Math.exp(-(((a - c) / w) ** 2));
  let ths = denseSamples(near ? 62 : 22, (a) => 1 + (near ? 1.6 : 0.6) * smooth(1.15, 1.45, a) * smooth(2.95, 2.6, a) + (near ? 5 : 0.5) * band(a, thEye, 0.12) + (near ? 2.5 : 0.3) * band(a, thNose, 0.15) + (near ? 4.5 : 0.4) * band(a, F.thM, 0.1), 0, Math.PI);
  // Snap the nearest row onto the mouth line and double it.
  let km = 0; for (let k = 1; k < ths.length; k++) if (Math.abs(ths[k] - F.thM) < Math.abs(ths[km] - F.thM)) km = k;
  ths[km] = F.thM;
  ths.splice(km + 1, 0, F.thM);
  const phEye = Math.asin(Math.min(0.99, F.ex / 0.08));
  const phs = denseSamples((near ? 76 : 28) + 1, (a) => 1 + (near ? 2.2 : 0.8) * smooth(1.2, 0.6, Math.abs(a)) + (near ? 3.5 : 0.3) * band(Math.abs(a), phEye, 0.22) + (near ? 2 : 0.3) * band(a, 0, 0.18), -Math.PI, Math.PI);
  const lipCols = (lx) => Math.abs(lx) < F.lipW * 0.94;
  const pts = [], uvs = [], ws = [], loc = [];
  for (let i = 0; i < ths.length; i++) {
    const th = ths[i];
    const row = [], ur = [], wr = [], lr = [];
    for (let j = 0; j < phs.length; j++) {
      const ph = phs[j];
      const d = V(Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph));
      const p = shape(d);
      if (i === km || i === km + 1) p.z += 0; // both copies share the position
      row.push(p); ur.push(headUV(p));
      wr.push(headWeights(p, d, F, i === km ? 'upper' : i === km + 1 ? 'lower' : null));
      lr.push(p.x - HEAD_C[0]);
    }
    // Keep the UV seam at the back of the head consistent.
    ur[0] = regionUV('head', 0, headV(row[0].y - HEAD_C[1])); ur[phs.length - 1] = regionUV('head', 1, headV(row[phs.length - 1].y - HEAD_C[1]));
    pts.push(row); uvs.push(ur); ws.push(wr); loc.push(lr);
  }
  b.surface(pts, uvs, ws, {
    seam: true,
    skip: (i, j) => i === km && lipCols(loc[i][j]) && lipCols(loc[i][j + 1]) && pts[i][j].z > HEAD_C[2],
  });

  const head = [[B.head, 1]];
  // Ears: a thin shell with a rim (helix), a hollow (concha) and a lobe, standing a little off
  // the head towards the back.
  for (const s of [1, -1]) {
    const ex = (P.f ? 0.073 : 0.077), ey = -0.012, ez = -0.01;
    b.ellipsoid({ lat: near ? 12 : 5, lon: near ? 16 : 7, uvFn: () => regionUV('skin', 0.5, 0.5), weightFn: () => head, map: (d) => {
      const a = d.z, v = d.y, c = d.x * s;                      // a: front-back, v: up-down, c: out (+) / in (-)
      const rr = Math.min(1, Math.hypot(a, v));
      const rim = 0.0024 * smooth(0.55, 0.92, rr);
      const concha = -0.004 * gauss(a / 0.45) * gauss((v + 0.1) / 0.45);
      const lobe = v < -0.55 ? 0.0015 : 0;
      const out = 0.004 + 0.012 * smooth(0.2, -1, a) * smooth(-0.6, 0.4, v);   // stands off at the back
      const th = c > 0 ? 0.0032 + rim + concha + lobe : -0.0022;
      return V(s * (ex + out * (0.5 + 0.5 * c) + th * Math.abs(c) * 1.0), HEAD_C[1] + ey + v * 0.031, HEAD_C[2] + ez + a * 0.017 - v * 0.004);
    } });
  }
  // Eyeballs (glossy) on their own bones, with upper lids (on the lid bones) and lash lines.
  for (const side of ['L', 'R']) {
    const [ex, ey, ez] = J['eye' + side];
    const er = F.re;
    b.ellipsoid({ lat: near ? 14 : 6, lon: near ? 18 : 8, group: 1, weightFn: () => [[B['eye' + side], 1]],
      uvFn: (d) => regionUV('eye', 0.5 + d.x * 0.5, 0.5 + d.y * 0.5),
      map: (d) => { const cornea = d.z > 0.8 ? 0.0012 * smooth(0.8, 0.98, d.z) : 0; return V(ex + d.x * er, ey + d.y * er, ez + d.z * (er + cornea)); } });
    if (!near) continue;
    const lidR = er + 0.0011;
    b.ellipsoid({ lat: 12, lon: 18, weightFn: () => [[B['lid' + side], 1]], uvFn: () => regionUV('skin', 0.5, 0.62),
      keep: (d) => d.y > -0.06 && d.z > -0.3,
      map: (d) => V(ex + d.x * lidR, ey + d.y * lidR, ez + d.z * lidR) });
    b.ellipsoid({ lat: 18, lon: 18, weightFn: () => [[B['lid' + side], 1]], uvFn: () => regionUV('hair', 0.5, 0.5),
      keep: (d) => d.y < 0.03 && d.y > -0.12 && d.z > 0.25,
      map: (d) => { const k = smooth(0.03, -0.12, d.y); return V(ex + d.x * (lidR + 0.0004), ey + d.y * lidR - k * 0.0006, ez + d.z * (lidR + 0.0004 + k * 0.0012)); } });
  }
  if (!near) return;
  // Inside the mouth: a dark cavity and the teeth, upper on the head, lower on the jaw.
  const mz = HEAD_C[2] + F.mz, my = HEAD_C[1] + F.ym;
  b.ellipsoid({ lat: 8, lon: 12, uvFn: () => regionUV('dark', 0.5, 0.7), weightFn: (p, d) => { const k = smooth(0.25, -0.25, d.y); return [[B.head, 1 - k], [B.jaw, k]]; },
    map: (d) => V(d.x * F.lipW * 0.92, my - 0.002 + d.y * 0.012, mz - 0.016 + d.z * 0.013) });
  for (const [up, y0, y1, bone] of [[1, my + 0.0035, my - 0.0045, B.head], [0, my - 0.0035, my - 0.0105, B.jaw]]) {
    const R = up ? 0.024 : 0.0225, cz = mz - 0.0045 - R;
    const rows = [], uv = [], w = [], nr = [];
    for (let i = 0; i < 3; i++) {
      const y = y0 + (y1 - y0) * i / 2;
      const r = [], u = [], ww = [], n = [];
      for (let j = 0; j <= 10; j++) {
        const a = (-0.95 + 1.9 * j / 10);
        r.push(V(Math.sin(a) * R, y, cz + Math.cos(a) * R)); u.push(regionUV('dark', 0.5, 0.1)); ww.push([[bone, 1]]); n.push(V(Math.sin(a), 0, Math.cos(a)));
      }
      rows.push(r); uv.push(u); w.push(ww); nr.push(n);
    }
    b.surface(rows, uv, w, { normals: nr });
  }
}

// Head skin weights: jaw (the mandible below a line from under the ear to the mouth), mouth
// corners, brows; `row` marks the two copies of the mouth line.
function headWeights(p, d, F, row) {
  const lx = p.x - HEAD_C[0], ly = p.y - HEAD_C[1], lz = p.z - HEAD_C[2];
  const ax = Math.abs(lx);
  const line = -0.034 + (F.ym + 0.034) * clamp01((lz + 0.03) / 0.115);
  let wJ = smooth(0.006, -0.012, ly - line) * smooth(-0.07, -0.035, lz);
  const inLips = ax < F.lipW && lz > 0.04;
  if (inLips) {
    const u = (ax / F.lipW) ** 2;
    if (row === 'lower') wJ = 1 - 0.5 * u;
    else if (row === 'upper') wJ = 0.5 * u;
    else if (ly < F.ym) wJ = Math.max(wJ, (1 - 0.5 * u) * smooth(F.ym + 0.0005, F.ym - 0.003, ly));
    else wJ = Math.min(wJ, 0.5 * u * smooth(F.ym + 0.012, F.ym, ly));
  }
  const front = smooth(0.2, 0.6, d.z);
  const wc = 0.85 * front * Math.exp(-(((ax - F.lipW) / 0.012) ** 2) - (((ly - F.ym) / 0.013) ** 2));
  const wbL = 0.95 * front * Math.exp(-(((lx - F.ex) / 0.024) ** 2) - (((ly - F.ey - 0.03) / 0.014) ** 2)) * (ly > F.ey + F.ah + 0.004 ? 1 : smooth(F.ey + F.ah, F.ey + F.ah + 0.004, ly));
  const wbR = 0.95 * front * Math.exp(-(((lx + F.ex) / 0.024) ** 2) - (((ly - F.ey - 0.03) / 0.014) ** 2)) * (ly > F.ey + F.ah + 0.004 ? 1 : smooth(F.ey + F.ah, F.ey + F.ah + 0.004, ly));
  const rest = Math.max(0, 1 - wc - wbL - wbR);
  const out = [[B.head, (1 - wJ) * rest], [B.jaw, wJ * rest], [B.browL, wbL], [B.browR, wbR], [lx >= 0 ? B.cornerL : B.cornerR, wc]];
  return out;
}

export const HEAD_WEIGHTS = [[B.head, 1]];
export { aroundU };
void THREE;
