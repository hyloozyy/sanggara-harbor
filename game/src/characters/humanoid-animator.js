// Procedural animation for the skinned humans.
//
// Every frame a target pose is built (locomotion first, then layers for aiming, talking,
// punching, reloading, riding and so on) and the bones follow it through critically damped
// springs, so state changes cross-fade over ~0.2-0.3 s and nothing ever snaps. Legs and, where
// it matters, arms are then placed with analytic two-bone IK:
//   * feet are planned like real footsteps: a planted foot is pinned to the ground (it never
//     slides, even when the body turns), a swinging foot travels on an arc from where it lifted
//     to where the gait wants it to land; heel strike, roll over the ball and toe-off; little
//     shuffle steps settle the feet when stopping or turning on the spot;
//   * the pelvis rides on the legs (it can only be as high as the planted feet allow), bobs,
//     sways over the standing leg, drops on the swing side and twists with the stride; the
//     shoulders counter-rotate, the arms swing with relaxed elbows, the head stays level;
//   * riders hold the grips and rest their feet on the pegs or the floorboard (one foot down
//     when stopped), drivers keep their hands on the wheel as it turns.
import * as THREE from 'three';
import { damp, clamp } from '../core/math-utils.js';
import { B } from './body-geometry.js';

const NB = 23;
const TAU = Math.PI * 2;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const frac = (x) => x - Math.floor(x);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Bones driven by springs (the face, hair and root are handled separately).
const BODY = [B.hips, B.spine, B.chest, B.neck, B.head, B.armL, B.foreL, B.handL, B.armR, B.foreR, B.handR, B.legL, B.shinL, B.footL, B.legR, B.shinR, B.footR];

// --------------------------------------------------------------------------- temporaries
const qChest = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), qd = new THREE.Quaternion();
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), vd = new THREE.Vector3(), ve = new THREE.Vector3();
const ma = new THREE.Matrix4(), mb = new THREE.Matrix4();
const eu = new THREE.Euler();
const AZ = new THREE.Vector3(0, 0, 1), NEG_Z = new THREE.Vector3(0, 0, -1);

function initState(m) {
  const A = m.anim;
  A.cur = new Float32Array(NB * 3); A.vel = new Float32Array(NB * 3); A.tgt = new Float32Array(NB * 3); A.k = new Float32Array(NB);
  const hr = m.hips.userData.rest;
  A.hp = [hr.x, hr.y, hr.z]; A.hv = [0, 0, 0]; A.ht = [hr.x, hr.y, hr.z];
  A.thigh = m.shinL.userData.rest.length(); A.shin = m.footL.userData.rest.length();
  A.upper = m.foreL.userData.rest.length(); A.fore = m.handL.userData.rest.length();
  A.hipOff = m.legL.userData.rest.clone();
  A.feet = [mkFoot(1), mkFoot(-1)];
  A.odo = { x: 0, z: 0 };
  A.phase = 0; A.gaitOn = false; A.stepCool = 0;
  A.ikLeg = 1; A.ikLegT = 1;
  A.ikArm = [0, 0]; A.armT = [new THREE.Vector3(), new THREE.Vector3()]; A.armPole = [new THREE.Vector3(), new THREE.Vector3()]; A.handRot = [null, null];
  A.legT = [new THREE.Vector3(), new THREE.Vector3()]; A.legPole = [new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 1)]; A.footQ = [new THREE.Quaternion(), new THREE.Quaternion()];
  A.accF = 0; A.accS = 0; A.prevV = null; A.speedS = 0; A.look = 0; A.lookP = 0;
  A.bank = 0; A.gest = 0; A.air = 0; A.land = 0; A.prep = 0;
  A.seed = (m.look?.seed || 0) % 1000;
  A.fresh = true;
}

function mkFoot(side) {
  return { side, planted: true, ax: 0, az: 0, ayaw: 0, u: 0, rate: 3, sx: side * 0.1, sy: 0.085, sz: 0, syaw: 0, spitch: 0, lift: 0.06, gait: false, lx: side * 0.1, ly: 0.085, lz: 0, yaw: 0, pitch: 0, us: 0.5, init: false };
}

// Target helpers.
function T(A, b, x, y, z, k) { const i = b * 3; A.tgt[i] = x; A.tgt[i + 1] = y; A.tgt[i + 2] = z; if (k) A.k[b] = k; }
function Tx(A, b) { return A.tgt[b * 3]; }
function Ty(A, b) { return A.tgt[b * 3 + 1]; }
function Tz(A, b) { return A.tgt[b * 3 + 2]; }
function Tadd(A, b, x, y, z) { const i = b * 3; A.tgt[i] += x; A.tgt[i + 1] += y; A.tgt[i + 2] += z; }
function K(A, b, k) { A.k[b] = Math.max(A.k[b], k); }
function mixT(A, b, x, y, z, w) { const i = b * 3; A.tgt[i] = lerp(A.tgt[i], x, w); A.tgt[i + 1] = lerp(A.tgt[i + 1], y, w); A.tgt[i + 2] = lerp(A.tgt[i + 2], z, w); }

// Exact critically damped spring (stable at any frame rate).
function spring(cur, vel, tgt, i, w, dt) {
  const y = cur[i] - tgt[i], e = Math.exp(-w * dt), j = vel[i] + w * y;
  cur[i] = tgt[i] + (y + j * dt) * e;
  vel[i] = (vel[i] - w * j * dt) * e;
}

// ===========================================================================================
export function animateHumanoid(m, state, speed, dt, extra = {}) {
  if (!m.anim) return;
  dt = Math.min(dt, 0.1);
  const A = m.anim;
  if (!A.cur) initState(m);
  A.breath = (A.breath || 0) + dt * (speed > 3 || state === 'flee' ? 3.0 : 1.25);
  A.idleShift = (A.idleShift || 0) + dt;
  faceUpdate(m, A, dt, extra);
  A.tgt.fill(0);
  A.k.fill(13);
  A.ikArmT = [0, 0];
  A.handRot[0] = A.handRot[1] = null;
  A.headFree = true;

  if (state === 'drive' || state === 'ride') seatedPose(m, A, state === 'ride', dt, extra);
  else if (state === 'dead') downPose(m, A, dt, extra);
  else { locomotion(m, A, state, speed, dt, extra); layers(m, A, state, dt, extra); }
  if (A.headFree) stabiliseHead(A, extra);

  // Springs.
  const cur = A.cur, vel = A.vel, tgt = A.tgt;
  const fresh = A.fresh; A.fresh = false;
  for (const b of BODY) {
    const w = A.k[b], i = b * 3;
    for (let c = 0; c < 3; c++) {
      if (fresh) { cur[i + c] = tgt[i + c]; vel[i + c] = 0; } else spring(cur, vel, tgt, i + c, w, dt);
    }
    const bone = m.bones[b];
    bone.rotation.set(cur[i], cur[i + 1], cur[i + 2]);
  }
  if (A.kick) { // impulses from hits and landings: added to the spring velocities once
    for (const [b, x, y, z] of A.kick) { vel[b * 3] += x; vel[b * 3 + 1] += y; vel[b * 3 + 2] += z; }
    A.kick = null;
  }
  for (let c = 0; c < 3; c++) {
    const w = c === 1 ? A.hipK ?? 24 : 16;
    if (fresh) { A.hp[c] = A.ht[c]; A.hv[c] = 0; } else spring(A.hp, A.hv, A.ht, c, w, dt);
  }
  if (A.hipCap != null && A.hp[1] > A.hipCap) { A.hp[1] = A.hipCap; A.hv[1] = Math.min(0, A.hv[1]); }
  m.hips.position.set(A.hp[0], A.hp[1], A.hp[2]);

  // IK passes.
  A.ikLeg = fresh ? A.ikLegT : damp(A.ikLeg, A.ikLegT, A.ikLegRate || 12, dt);
  if (A.ikLeg > 0.002) { m.hips.updateMatrix(); for (let s = 0; s < 2; s++) legIK(m, A, s, A.ikLeg); }
  for (let s = 0; s < 2; s++) {
    A.ikArm[s] = fresh ? A.ikArmT[s] : damp(A.ikArm[s], A.ikArmT[s], A.ikArmRate || 9, dt);
    if (A.ikArm[s] > 0.002) armIK(m, A, s, A.ikArm[s]);
  }

  // Hair and ponytail: a damped spring lagging behind the head.
  const run = smooth(2.2, 4, A.speedS);
  const target = 0.2 + 0.5 * run + 0.25 * smooth(0.1, 1, A.speedS) + (A.air || 0) * 0.4;
  A.tailV = (A.tailV || 0) + ((target - (A.tail || 0)) * 40 - (A.tailV || 0) * 7 + Math.cos(A.phase * TAU * 2) * 6 * smooth(0.1, 2, A.speedS)) * dt;
  A.tail = (A.tail || 0) + A.tailV * dt;
  m.hairTail.rotation.x = A.tail;
  m.hairTail.rotation.z = Math.sin(A.phase * TAU) * 0.12 * smooth(0.1, 2, A.speedS) - (A.bank || 0) * 0.5;
}

// ===========================================================================================
// Locomotion: footstep planner, pelvis and torso, arm swing.
function locomotion(m, A, state, speedIn, dt, extra) {
  const G = m.gait;
  const sc = extra.scale || m.root.scale.y || 1;
  const h = extra.heading ?? m.root.rotation.y;
  const ch = Math.cos(h), sh = Math.sin(h);
  let vx, vz;
  if (extra.vel) { vx = extra.vel.x; vz = extra.vel.z; } else { vx = sh * speedIn; vz = ch * speedIn; }
  const sRaw = Math.hypot(vx, vz);
  if (extra.vel && Math.abs(sRaw - speedIn) > 0.3 && speedIn > 0.01 && sRaw > 0.01) { vx *= speedIn / sRaw; vz *= speedIn / sRaw; } // speed override (screenshots)
  else if (extra.vel && sRaw < 0.01 && speedIn > 0.05) { vx = sh * speedIn; vz = ch * speedIn; }
  A.odo.x += vx * dt; A.odo.z += vz * dt;
  const s0 = Math.hypot(vx, vz);
  // Local velocity (body frame, model units) and smoothed accelerations for leaning.
  const lvx = (vx * ch - vz * sh) / sc, lvz = (vx * sh + vz * ch) / sc;
  if (A.prevV) {
    A.accF = damp(A.accF, clamp((lvz - A.prevV[1]) / Math.max(dt, 1e-3), -12, 12), 5, dt);
    A.accS = damp(A.accS, clamp((lvx - A.prevV[0]) / Math.max(dt, 1e-3), -12, 12), 5, dt);
  }
  A.prevV = [lvx, lvz];
  A.speedS = damp(A.speedS, s0, 9, dt);
  const s = A.speedS;
  const walk = smooth(0.12, 1.1, s), jog = smooth(2.2, 3.9, s), sprint = smooth(5.0, 6.8, s);
  const idle = 1 - walk;
  const panic = state === 'flee' || extra.panic ? 1 : 0;
  const turn = clamp(extra.turnRate || 0, -8, 8);
  const aim = state === 'aim' || state === 'aim-walk' || extra.aiming;

  // Gait parameters (model units): cycle length grows with speed, the stance share shrinks.
  const C = (0.86 + 0.42 * Math.min(s, 3.4) + 0.24 * Math.max(0, s - 3.4)) * (G.stride || 1);
  const beta = lerp(0.62, 0.38, jog) - 0.08 * sprint;
  const width = 0.098 - 0.035 * jog;
  const lift = 0.075 + 0.24 * jog + 0.16 * sprint;
  const crouch = (extra.crouch ? 0.15 : 0) + (A.prep || 0) * 0.16;

  // Gait on/off with hysteresis; starting off, the trailing foot steps first.
  const sl = Math.hypot(lvx, lvz);
  let dx = 0, dz = 1;
  if (sl > 0.05) { dx = lvx / sl; dz = lvz / sl; }
  A.dirX = damp(A.dirX ?? 0, dx, 10, dt); A.dirZ = damp(A.dirZ ?? 1, dz, 10, dt);
  const dl = Math.hypot(A.dirX, A.dirZ) || 1; const ux = A.dirX / dl, uz = A.dirZ / dl;
  const F = A.feet;
  if (!F[0].init) {
    for (const f of F) { const lx = f.side * 0.1, lz = f.side * 0.02; f.ax = A.odo.x + (lx * ch + lz * sh) * sc; f.az = A.odo.z + (-lx * sh + lz * ch) * sc; f.ayaw = h + f.side * 0.12; f.init = true; f.planted = true; }
  }
  const toLocal = (f) => { const ex = f.ax - A.odo.x, ez = f.az - A.odo.z; return [(ex * ch - ez * sh) / sc, (ex * sh + ez * ch) / sc]; };
  if (!A.gaitOn && s0 > 0.3) {
    A.gaitOn = true;
    // Which foot is further behind (along the travel direction) lifts first.
    const b0 = toLocal(F[0]), b1 = toLocal(F[1]);
    const lead = (b0[0] * ux + b0[1] * uz) < (b1[0] * ux + b1[1] * uz) ? 0 : 1;
    A.phase = frac(beta + 0.001 - lead * 0.5);
    A.startLead = lead;
  } else if (A.gaitOn && s0 < 0.15 && s < 0.5) A.gaitOn = false;
  const prevPhase = A.phase;
  if (A.gaitOn) A.phase = frac(A.phase + s0 / (C * sc) * dt);
  A.stepCool -= dt;

  const air = extra.airborne ? 1 : 0;
  const startLead = A.startLead; A.startLead = -1;
  // Landing: re-plant both feet under the body.
  if (A.wasAir && !air) {
    A.land = 1;
    for (const f of F) { const lx = f.side * 0.11, lz = f.side * 0.04 + uz * 0.1 * walk; f.ax = A.odo.x + (lx * ch + lz * sh) * sc; f.az = A.odo.z + (-lx * sh + lz * ch) * sc; f.ayaw = h + f.side * 0.1; f.planted = true; }
    A.hv[1] -= 1.2 + Math.min(2.5, Math.abs(extra.landVy || 0) * 0.15);
    A.kick = [[B.spine, 2.2, 0, 0], [B.chest, 1.5, 0, 0], [B.armL, -1.5, 0, 1], [B.armR, -1.5, 0, -1]];
  }
  A.wasAir = air;

  let support = 0, supL = 0, supR = 0;
  for (let i = 0; i < 2; i++) {
    const f = F[i];
    const phi = frac(A.phase + i * 0.5), pphi = frac(prevPhase + i * 0.5);
    let [lx, lz] = f.planted ? toLocal(f) : [f.lx, f.lz];
    // Neutral stance spot and the gait's landing target.
    const nx = f.side * (0.1 + 0.015 * idle), nz = f.side * 0.025;
    const reach = beta * C * 0.5;
    const landX = f.side * width + ux * reach * 0.85, landZ = uz * reach + 0.03 * walk * uz;
    if (f.planted) {
      let lift0 = false;
      if (A.gaitOn) {
        const crossed = pphi < beta && phi >= beta || (A.phase < prevPhase && pphi < beta && phi < pphi);
        if (crossed || startLead === i) lift0 = true;
      }
      // Overstretched (pushed, or turning hard): step now.
      const hd = Math.hypot(lx - f.side * 0.09, lz);
      const other = F[1 - i];
      if (!A.gaitOn && other.planted && A.stepCool <= 0) {
        const yawErr = Math.abs(wrap(f.ayaw - h - f.side * 0.12));
        const err = Math.hypot(lx - nx, lz - nz) + yawErr * 0.22;
        const oErr = (() => { const [ox, oz] = toLocal(other); return Math.hypot(ox - other.side * 0.1, oz - other.side * 0.025) + Math.abs(wrap(other.ayaw - h - other.side * 0.12)) * 0.22; })();
        if (err > 0.13 && err >= oErr) lift0 = true;
      }
      if (hd > 0.62 && other.planted) lift0 = true;
      if (air) lift0 = false;
      if (lift0) {
        f.planted = false; f.u = 0; f.gait = A.gaitOn;
        f.sx = f.lx; f.sy = f.ly; f.sz = f.lz; f.syaw = f.yaw; f.spitch = f.pitch;
        A.stepCool = 0.16;
      } else {
        // Stance: pinned to the ground, the foot rolls heel → flat → ball.
        f.us = A.gaitOn ? (phi < beta ? phi / beta : 1) : 0.5;
        const g = A.gaitOn ? walk : 0;
        const heel = lerp(-0.26, -0.06, jog), toe = lerp(0.62, 0.85, jog);
        const pitch = g * (heel * (1 - smooth(0, 0.16, f.us)) + toe * smooth(0.55, 1, f.us) * (f.us > 0.55 ? 1 : 0));
        f.pitch = damp(f.pitch, pitch, 28, dt);
        f.yaw = wrap(f.ayaw - h);
        const [ox, oy, oz] = pivotOffset(f.pitch);
        f.lx = lx + Math.sin(f.yaw) * oz; f.lz = lz + Math.cos(f.yaw) * oz; f.ly = 0.085 + oy;
        const w = Math.sin(Math.PI * f.us) * (A.gaitOn ? 1 : 0);
        support += w; if (i === 0) supL = w; else supR = w;
        void ox;
      }
    }
    if (!f.planted) {
      // Swing: an arc from the lift-off point to the landing spot.
      const gaitRate = s0 / (C * sc * (1 - beta));
      f.rate = Math.max(1 / 0.3, gaitRate);
      if (air) { /* hold the swing while airborne */ }
      else if (A.gaitOn && f.gait) f.u = Math.max(f.u, phi >= beta ? (phi - beta) / (1 - beta) : 1);
      else f.u = Math.min(1, f.u + f.rate * dt);
      f.u = Math.min(1, f.u);
      const u = f.u;
      const tx = A.gaitOn ? landX : nx, tz = A.gaitOn ? landZ : nz;
      const landPitch = A.gaitOn ? lerp(-0.26, -0.06, jog) * walk : 0;
      const tyaw = A.gaitOn ? f.side * 0.07 : f.side * 0.12;
      const [, oy, oz] = pivotOffset(landPitch);
      const ez = A.gaitOn ? smooth(0.08 + 0.1 * jog, 1, u) : smooth(0, 1, u);
      f.lx = lerp(f.sx, tx, smooth(0, 1, u));
      f.lz = lerp(f.sz, tz + oz, ez);
      const hgt = (A.gaitOn ? lift : 0.06) * Math.pow(Math.sin(Math.PI * Math.pow(u, A.gaitOn ? 0.75 - 0.2 * jog : 1)), 1.2);
      f.ly = lerp(f.sy, 0.085 + oy, smooth(0, 1, u)) + hgt;
      f.yaw = lerp(f.syaw, tyaw, smooth(0, 1, u));
      const mid = A.gaitOn ? lerp(-0.12, 0.6, jog) : 0;
      f.pitch = u < 0.5 ? lerp(f.spitch, mid, smooth(0, 0.5, u)) : lerp(mid, landPitch, smooth(0.5, 1, u));
      if (u >= 1) {
        f.planted = true;
        const ax = tx, az = tz; // the flat-foot anchor (before the heel pivot)
        f.ax = A.odo.x + (ax * ch + az * sh) * sc; f.az = A.odo.z + (-ax * sh + az * ch) * sc;
        f.ayaw = h + tyaw;
        f.us = 0;
      }
    }
  }

  // ---- pelvis
  const hr = m.hips.userData.rest;
  const Lsum = A.thigh + A.shin;
  const hipShiftX = (supL - supR) * 0.024 * walk * (1 - jog) * (G.sway ?? 0.7) + idle * Math.sin(A.idleShift * 0.23 + A.seed) * 0.02;
  let need = hr.y - 0.012 * idle - crouch;
  let needHard = hr.y + 0.2;
  for (const f of F) {
    if (!f.planted && !(A.gaitOn && f.u < 0.15)) continue;
    const ddx = f.lx - (f.side * Math.abs(A.hipOff.x) + hipShiftX), ddz = f.lz;
    const r2 = Math.max(0, (Lsum * 0.982) ** 2 - ddx * ddx - ddz * ddz);
    need = Math.min(need, f.ly + Math.sqrt(r2) - A.hipOff.y);
    needHard = Math.min(needHard, f.ly + Math.sqrt(Math.max(0, (Lsum * 0.999) ** 2 - ddx * ddx - ddz * ddz)) - A.hipOff.y);
  }
  const comp = (0.04 * jog + 0.03 * sprint) * support * (G.bounce ?? 1);
  const flight = A.gaitOn && support < 0.05 && jog > 0.3 ? 0.015 * jog : 0;
  const breathe = Math.sin(A.breath);
  A.ht[0] = hr.x + hipShiftX;
  A.ht[1] = need - comp + flight;
  A.ht[2] = hr.z - clamp(A.accF, -6, 6) * 0.004;
  A.hipK = 26;
  A.hipCap = air ? null : needHard;

  // Pelvis rotation: twist with the stride, drop on the swing side, bank into turns.
  const stepD = F[0].lz - F[1].lz;
  const twist = clamp(-stepD * (0.24 + 0.05 * jog), -0.28, 0.28) * walk;
  const roll = (supL - supR) * 0.06 * walk * (1 - jog) * (G.sway ?? 0.7) + idle * Math.sin(A.idleShift * 0.23 + A.seed) * 0.035;
  A.bank = damp(A.bank, clamp(-turn * s / 9.8, -0.35, 0.35) * 0.8 + clamp(-A.accS * 0.02, -0.15, 0.15), 6, dt);
  const accLean = clamp(A.accF * 0.03, -0.22, 0.25) * (aim ? 0.3 : 1);
  const lean = 0.035 * walk + 0.13 * jog + 0.1 * sprint + (G.slouch || 0) + panic * 0.08 + accLean;
  T(A, B.hips, 0.04 * jog + accLean * 0.3, twist, roll + A.bank * 0.6, 18);
  T(A, B.spine, lean * 0.55 + idle * breathe * 0.01, -twist * 0.55, -roll * 0.6 + A.bank * 0.25, 14);
  T(A, B.chest, lean * 0.45 + idle * breathe * 0.016 + (G.slouch || 0) * 0.5, -twist * 1.25, -roll * 0.35 + A.bank * 0.15, 13);

  // ---- legs: IK targets (and an FK pose for when the IK is faded out)
  A.ikLegT = air ? 0 : 1;
  A.ikLegRate = air ? 14 : 18;
  for (let i = 0; i < 2; i++) {
    const f = F[i];
    A.legT[i].set(f.lx, f.ly, f.lz);
    A.legPole[i].set(f.side * 0.12 + Math.sin(f.yaw) * 0.8, 0, Math.cos(f.yaw));
    eu.set(f.pitch, f.yaw, 0, 'YXZ');
    A.footQ[i].setFromEuler(eu);
  }
  // FK fallback (airborne): knees tuck, the leading leg reaches for the ground.
  A.air = damp(A.air || 0, air, 10, dt);
  const up = (extra.vy || 0) > 0 ? 1 : 0;
  const ak = Math.max(A.air, 1 - A.ikLeg);
  T(A, B.legL, -0.75 * ak, 0, 0.05, 14); T(A, B.shinL, (0.95 + up * 0.35) * ak, 0, 0, 14); T(A, B.footL, -0.15 * ak, 0, 0, 14);
  T(A, B.legR, -0.2 * ak, 0, -0.05, 14); T(A, B.shinR, 0.6 * ak, 0, 0, 14); T(A, B.footR, 0.15 * ak, 0, 0, 14);
  A.land = Math.max(0, (A.land || 0) - dt * 3.2);

  // ---- arms: swing against the legs, elbows bend with speed
  const swingA = (0.36 * walk + 0.42 * jog + 0.35 * sprint) * (G.swing || 1) * (1 + panic * 0.3);
  const dn = clamp(stepD / Math.max(0.25, beta * C), -1.2, 1.2);
  const fwdBias = -0.05 - 0.08 * jog - 0.04 * sprint;
  const elbowBase = 0.26 + 0.1 * walk + 0.95 * jog + 0.25 * sprint + panic * 0.25 + idle * breathe * 0.02;
  const armOut = 0.1 + idle * 0.04 + jog * 0.05;
  const swL = dn * swingA, swR = -dn * swingA;
  A.arms = [
    { x: swL + fwdBias + idle * breathe * 0.008, z: armOut, fx: -(elbowBase + Math.max(0, -swL) * (0.35 + 0.5 * jog)), fy: 0.1 * jog },
    { x: swR + fwdBias - idle * breathe * 0.008, z: -armOut, fx: -(elbowBase + Math.max(0, -swR) * (0.35 + 0.5 * jog)), fy: -0.1 * jog },
  ];
  if (panic) {
    const t = A.idleShift * 7;
    A.arms[0].x -= 0.45 + Math.sin(t) * 0.25; A.arms[1].x -= 0.45 + Math.cos(t * 1.1) * 0.25;
    A.arms[0].z += 0.3; A.arms[1].z -= 0.3;
  }
  A.armK = 11 + 16 * jog;
  A.wrist = [-0.16 - 0.15 * jog - dn * 0.08 * walk, -0.16 - 0.15 * jog + dn * 0.08 * walk];

  // Look direction: idle glances, look-at targets, the head leads turns.
  const shiftT = A.idleShift * 0.23 + A.seed;
  const glance = idle * Math.sin(shiftT * 0.7 + 1.3) * 0.35 * (Math.sin(shiftT * 0.31) > 0.2 ? 1 : 0.2);
  const lookYaw = clamp((extra.lookYaw ?? glance) + clamp(turn * 0.12, -0.4, 0.4), -1.25, 1.25);
  A.look = damp(A.look, lookYaw, 5, dt);
  A.lookP = damp(A.lookP, extra.lookPitch || 0, 5, dt);
  A.speedSmoothed = s;
  A.jog = jog; A.walk = walk;
}

// Ankle offset when the foot pivots on the heel (pitch < 0) or the ball (pitch > 0): [x, y, z]
// along the foot.
function pivotOffset(p) {
  if (p >= 0) {
    const c = Math.cos(p), s = Math.sin(p);
    return [0, 0.085 * c + 0.12 * s - 0.085, 0.085 * s - 0.12 * c + 0.12];
  }
  const c = Math.cos(p), s = Math.sin(p);
  return [0, 0.085 * c - 0.05 * s - 0.085, 0.085 * s + 0.05 * c - 0.05];
}

// ===========================================================================================
// Layers on top of locomotion.
function layers(m, A, state, dt, extra) {
  const walk = A.walk, idle = 1 - walk;
  let [aL, aR] = A.arms;
  let rate = A.armK;
  const hr = m.hips.userData.rest;
  const aimOn = state === 'aim' || state === 'aim-walk' || extra.aiming;

  if (aimOn) {
    const two = extra.twoHanded, pitch = extra.pitch || 0;
    aR = { x: -Math.PI / 2 + pitch, z: 0.12, fx: -0.05, fy: 0 };
    aL = two ? { x: -Math.PI / 2 + 0.25 + pitch, z: -0.62, fx: -0.55, fy: 0 } : { x: aL.x * 0.4, z: 0.12, fx: -0.35, fy: 0 };
    const twist = Ty(A, B.hips);
    T(A, B.spine, Tx(A, B.spine) * 0.5, (two ? 0.15 : 0.06) - twist * 0.9, 0, 18);
    T(A, B.chest, Tx(A, B.chest) * 0.5 + pitch * 0.15, (two ? 0.22 : 0.1) - twist * 0.2, 0, 20);
    A.headYaw = two ? -0.34 : -0.14; A.headPitch = pitch * 0.35;
    rate = 22;
  } else if (state === 'punch') {
    const t = clamp(extra.punchT ?? 0, 0, 1);
    const kind = extra.melee || 'fists';
    if (kind === 'fists') {
      // Wind-up (coil, fist back), strike (hip and shoulder drive through), recover.
      const wind = smooth(0, 0.18, t) * (1 - smooth(0.18, 0.4, t));
      const hit = smooth(0.16, 0.38, t) * (1 - smooth(0.55, 1, t));
      aR = { x: -0.55 - hit * 1.05 + wind * 0.25, z: 0.05 + wind * 0.15, fx: -1.7 + hit * 1.55, fy: 0.2 };
      aL = { x: -1.0 + hit * 0.25, z: -0.15, fx: -1.95, fy: -0.2 };
      T(A, B.hips, Tx(A, B.hips), -0.15 * wind + 0.3 * hit, Tz(A, B.hips), 30);
      T(A, B.spine, 0.08 + hit * 0.06, -0.2 * wind + 0.4 * hit, 0, 30);
      T(A, B.chest, 0.06, -0.35 * wind + 0.55 * hit, 0, 30);
      rate = 34;
    } else {
      // Two-handed overhead swing for the bat and the golok.
      const wind = smooth(0, 0.3, t) * (1 - smooth(0.3, 0.5, t));
      const hit = smooth(0.28, 0.5, t) * (1 - smooth(0.6, 1, t));
      aR = { x: -1.3 - wind * 1.3 + hit * 0.9, z: 0.35 - wind * 0.2 + hit * 0.25, fx: -1.2 + wind * 0.2 + hit * 0.9, fy: 0.3 };
      aL = { x: -1.0 - wind * 0.9 + hit * 0.6, z: -0.6, fx: -1.4, fy: -0.4 };
      T(A, B.spine, 0.05 + hit * 0.15, 0.3 * wind - 0.4 * hit, 0, 26);
      T(A, B.chest, 0.04 - wind * 0.1 + hit * 0.2, 0.45 * wind - 0.6 * hit, 0, 26);
      rate = 30;
    }
  } else if (state === 'cower') {
    aL = { x: -2.5, z: -0.45, fx: -1.6, fy: 0 }; aR = { x: -2.5, z: 0.45, fx: -1.6, fy: 0 };
    T(A, B.spine, 0.5, 0, 0, 9); T(A, B.chest, 0.3, 0, 0, 9);
    A.headPitch = 0.45; A.headYaw = Math.sin(A.idleShift * 1.7) * 0.15;
    A.ht[1] = Math.min(A.ht[1], hr.y - 0.44);
    A.hipK = 10;
    rate = 9;
  } else if (state === 'hands-up') {
    const tremble = Math.sin(A.idleShift * 23) * 0.02;
    aL = { x: -2.75 + tremble, z: 0.55, fx: -0.65, fy: 0 }; aR = { x: -2.75 - tremble, z: -0.55, fx: -0.65, fy: 0 };
    T(A, B.spine, -0.04, 0, 0, 10); T(A, B.chest, -0.06, 0, 0, 10);
    A.ht[1] -= 0.03;
    rate = 8;
  } else if (state === 'phone') {
    aR = { x: -0.35, z: -0.55, fx: -2.35, fy: 0 };
    A.headYaw = 0.25; A.headRoll = 0.12; A.headPitch = 0.1;
  } else if (state === 'talk') {
    const g = Math.sin(A.breath * 1.7);
    aL = { x: -0.35 + g * 0.12, z: 0.12, fx: -1.2, fy: 0 }; aR = { x: -0.2 - g * 0.08, z: -0.12, fx: -0.9 + g * 0.2, fy: 0 };
    rate = 6;
  } else if (state === 'listen' || (state === 'idle' && extra.listening)) {
    // Listening: weight on one leg, a hand on the hip or arms loosely folded, small nods.
    const v = A.seed % 3;
    if (v === 0) { aR = { x: 0.1, z: -0.55, fx: -1.5, fy: -0.6 }; }
    else if (v === 1) { aL = { x: -0.45, z: -0.05, fx: -1.9, fy: -0.9 }; aR = { x: -0.45, z: 0.05, fx: -1.9, fy: 0.9 }; }
    A.headPitch = (A.headPitch || 0) + Math.max(0, Math.sin(A.idleShift * 2.1)) * 0.06;
    rate = 6;
  }

  // Conversation gestures: open palms and beats on the stressed syllables while speaking.
  const gestOk = (state === 'idle' || state === 'talk' || state === 'listen' || (state === 'walk' && A.speedS < 0.6)) && !aimOn;
  A.gest = damp(A.gest, gestOk && (extra.talk || 0) > 0.04 ? 1 : 0, 2.5, dt);
  if (A.gest > 0.01) {
    const g = A.gest, t = A.idleShift + A.seed % 7;
    const beat = Math.sin(t * 2.3) * 0.5 + Math.sin(t * 3.7 + 1) * 0.25 + (extra.talk || 0) * 0.35;
    const lAct = Math.max(0, Math.sin(t * 0.9 + 2));
    aR = mixArm(aR, { x: -0.42 - beat * 0.22, z: -0.22 - Math.max(0, Math.sin(t * 1.3)) * 0.15, fx: -1.25 - beat * 0.3, fy: 0.5 }, g);
    aL = mixArm(aL, { x: -0.12 - lAct * 0.35 + beat * 0.08, z: 0.12 + lAct * 0.1, fx: -0.5 - lAct * 0.8, fy: -0.4 * lAct }, g);
    A.headPitch = (A.headPitch || 0) + g * Math.sin(t * 3.1) * 0.05;
    A.headRoll = (A.headRoll || 0) + g * Math.sin(t * 1.1) * 0.04;
    Tadd(A, B.chest, g * beat * 0.025, g * Math.sin(t * 0.7) * 0.06, 0);
    rate = Math.min(rate, 9);
  }

  // Greetings and replies: wave, nod, handshake, shrug (extra.gesture = { kind, t: 0..1 }).
  const ge = extra.gesture;
  if (ge && ge.t < 1 && !aimOn) {
    const w = smooth(0, 0.15, ge.t) * (1 - smooth(0.85, 1, ge.t));
    if (ge.kind === 'wave') {
      const sw = Math.sin(ge.t * TAU * 3.2);
      aR = mixArm(aR, { x: -0.35, z: -1.75 - sw * 0.08, fx: -1.7, fy: 0.2 + sw * 0.45 }, w);
      A.headRoll = (A.headRoll || 0) + 0.08 * w;
      rate = 14;
    } else if (ge.kind === 'nod') {
      A.headPitch = (A.headPitch || 0) + w * Math.max(0, Math.sin(ge.t * TAU * 2)) * 0.28;
    } else if (ge.kind === 'shrug') {
      aL = mixArm(aL, { x: -0.2, z: 0.35, fx: -1.5, fy: -0.9 }, w); aR = mixArm(aR, { x: -0.2, z: -0.35, fx: -1.5, fy: 0.9 }, w);
      Tadd(A, B.chest, -0.04 * w, 0, 0);
      A.headRoll = (A.headRoll || 0) + 0.12 * w;
      A.shrug = w;
    } else if (ge.kind === 'handshake' && extra.handTarget) {
      // Right hand meets the other person's at a point between the two; it pumps twice.
      A.ikArmT[1] = w;
      const p = extra.handTarget;
      A.armT[1].set(p.x, p.y + Math.sin(ge.t * TAU * 2.5) * 0.035 * smooth(0.3, 0.5, ge.t) * (1 - smooth(0.7, 0.85, ge.t)), p.z);
      A.armPole[1].set(-0.6, -0.7, -0.4);
      eu.set(-Math.PI / 2 + 0.25, -0.2, -Math.PI / 2 * 0.15, 'YXZ'); A.handRot[1] = qd.setFromEuler(eu).clone();
      Tadd(A, B.chest, 0.06 * w, 0.12 * w, 0);
      A.headPitch = (A.headPitch || 0) + w * Math.max(0, Math.sin(ge.t * TAU * 1.5)) * 0.12;
    }
  }

  // Holster/draw: the gun hand drops to the hip and comes back up with the new weapon.
  if (extra.drawT != null && extra.drawT < 1) {
    const k = Math.sin(extra.drawT * Math.PI);
    aR = { x: aR.x * (1 - k) + 0.25 * k, z: aR.z * (1 - k) - 0.3 * k, fx: aR.fx * (1 - k) - 0.85 * k, fy: aR.fy };
    rate = Math.max(rate, 20);
  }

  // Reload: gun up to the chest, the support hand fetches a magazine from the belt.
  if (extra.reloadT != null && state !== 'punch') {
    const t = extra.reloadT;
    const lowered = aimOn ? 0 : 1;
    aR = { x: -0.8 - (1 - lowered) * 0.3, z: 0.22, fx: -1.15, fy: 0.3 };
    let l;
    if (t < 0.25) l = { x: -0.85, z: -0.45, fx: -1.6, fy: 0 };
    else if (t < 0.5) l = { x: 0.15, z: 0.22, fx: -0.7, fy: 0 };
    else if (t < 0.8) l = { x: -0.9, z: -0.5, fx: -1.75, fy: 0 };
    else l = { x: -0.95 - Math.sin((t - 0.8) * 15) * 0.15, z: -0.48, fx: -1.7, fy: 0 };
    aL = l;
    A.headPitch = 0.4; A.headYaw = -0.12;
    rate = 15;
  }

  // Recoil: the arms and chest kick up and settle back (spring impulse feel).
  if (extra.recoil > 0.01) {
    aR.x -= extra.recoil * 0.45; aR.fx -= extra.recoil * 0.25;
    if (extra.twoHanded) aL.x -= extra.recoil * 0.4;
    Tadd(A, B.chest, -extra.recoil * 0.12, 0, 0); K(A, B.chest, 40);
    rate = Math.max(rate, 40);
  }

  // Reaching for a door handle or down to pick something up.
  if (extra.reach > 0.01) {
    const k = extra.reach;
    if (extra.reachLow) {
      A.ht[1] -= 0.32 * k;
      Tadd(A, B.spine, 0.55 * k, 0, 0); Tadd(A, B.chest, 0.1 * k, 0, 0);
      A.headPitch = (A.headPitch || 0) + 0.2 * k;
      if (extra.reachArm !== false) aR = mixArm(aR, { x: -0.9, z: -0.1, fx: -0.2, fy: 0 }, k);
      A.hipK = 18;
    } else {
      aL = mixArm(aL, { x: -1.15, z: 0.25, fx: -0.45, fy: 0 }, k);
      Tadd(A, B.chest, 0.08 * k, 0.2 * k, 0);
    }
    rate = Math.max(rate, 14);
  }

  // Crouch-and-spring before a jump; arms swing back, then forward on takeoff.
  A.prep = damp(A.prep || 0, extra.jumpPrep ? 1 : 0, 30, dt);
  if (A.prep > 0.02) { Tadd(A, B.spine, 0.25 * A.prep, 0, 0); aL.x += 0.5 * A.prep; aR.x += 0.5 * A.prep; }
  if (A.air > 0.02 && !aimOn) {
    const k = A.air;
    aL = mixArm(aL, { x: -0.6, z: 0.5, fx: -0.6, fy: 0 }, k); aR = mixArm(aR, { x: -0.4, z: -0.5, fx: -0.6, fy: 0 }, k);
    Tadd(A, B.spine, 0.08 * k, 0, 0);
  }
  if (A.land > 0) { const k = Math.sin(A.land * Math.PI) * 0.8; Tadd(A, B.spine, 0.18 * k, 0, 0); A.ht[1] -= 0.05 * k; }

  // Stagger from a heavy blow: torso thrown back, arms out for balance (the feet step back
  // by themselves because the body is pushed).
  if (extra.stagger > 0) {
    const k = smooth(0, 0.25, extra.stagger);
    Tadd(A, B.spine, -0.25 * k, 0, 0.1 * k); Tadd(A, B.chest, -0.2 * k, 0.15 * k, 0);
    aL = mixArm(aL, { x: -0.9, z: 0.9, fx: -0.6, fy: 0 }, k); aR = mixArm(aR, { x: -0.6, z: -1.0, fx: -0.8, fy: 0 }, k);
    A.headPitch = (A.headPitch || 0) - 0.25 * k;
  }

  if (extra.umbrella && !aimOn && state !== 'punch' && state !== 'cower' && state !== 'hands-up') aL = { x: -0.62, z: 0.12, fx: -1.25, fy: 0 };
  if (extra.flinch > 0) { const k = clamp(extra.flinch * 4, 0, 1); Tadd(A, B.chest, -0.3 * k, 0.15 * k, 0); A.headPitch = (A.headPitch || 0) - 0.35 * k; }
  if (A.shrug) { A.shrug = 0; }

  T(A, B.armL, aL.x, 0, aL.z, rate); T(A, B.foreL, aL.fx, aL.fy, 0, rate);
  T(A, B.armR, aR.x, 0, aR.z, rate); T(A, B.foreR, aR.fx, aR.fy, 0, rate);
  T(A, B.handL, A.wrist[0], 0, 0.08, rate); T(A, B.handR, A.wrist[1], 0, -0.08, rate);
  void idle;
}

function mixArm(a, b, w) { return { x: lerp(a.x, b.x, w), z: lerp(a.z, b.z, w), fx: lerp(a.fx, b.fx, w), fy: lerp(a.fy || 0, b.fy || 0, w) }; }

// The head stays level: it cancels the torso's pitch, twist and roll, then looks where it wants.
function stabiliseHead(A, extra) {
  const P = Tx(A, B.hips) + Tx(A, B.spine) + Tx(A, B.chest);
  const Y = Ty(A, B.hips) + Ty(A, B.spine) + Ty(A, B.chest);
  const R = Tz(A, B.hips) + Tz(A, B.spine) + Tz(A, B.chest);
  const look = (A.look || 0) + (A.headYaw || 0), pitch = (A.lookP || 0) + (A.headPitch || 0) - 0.04 * (A.jog || 0);
  const roll = A.headRoll || 0;
  T(A, B.neck, -P * 0.32 + pitch * 0.4, -Y * 0.45 + look * 0.45, -R * 0.4 + roll * 0.4, 10);
  T(A, B.head, -P * 0.4 + pitch * 0.6, -Y * 0.55 + look * 0.55, -R * 0.55 + roll * 0.6, 11);
  A.headYaw = 0; A.headPitch = 0; A.headRoll = 0;
  void extra;
}

// ===========================================================================================
// Falling and lying (dead or knocked down). extra.down = { t (s since the fall began), dir
// (+1 falls backwards, -1 forwards), side, getUp (0..1) }.
function downPose(m, A, dt, extra) {
  const d = extra.down || { t: 2, dir: 1, side: 0.3 };
  const t = d.t, dir = d.dir, sd = d.side || 0;
  const hr = m.hips.userData.rest;
  A.ikLegT = 0; A.ikLegRate = 10;
  // 0-0.3 s the knees buckle, then the body topples and settles (Character tips the root).
  const buck = smooth(0, 0.3, t) * (1 - smooth(0.35, 0.8, t));
  const lie = smooth(0.3, 0.9, t);
  const v = A.seed % 4;
  A.ht[0] = hr.x; A.ht[1] = hr.y - 0.32 * buck; A.ht[2] = hr.z; A.hipK = 14; A.hipCap = null;
  const k = 7 + 5 * (1 - lie);
  if (dir > 0) {
    // On the back: arms flung out, one knee up or both legs loose, head rolled to a side.
    T(A, B.hips, 0, 0, sd * 0.2 * lie, k);
    T(A, B.spine, 0.25 * buck - 0.05 * lie, 0, -sd * 0.1, k); T(A, B.chest, 0.15 * buck - 0.05 * lie, sd * 0.1, 0, k);
    T(A, B.neck, 0.1 * buck, sd * 0.5 * lie, 0, k); T(A, B.head, 0.1 * buck - 0.1 * lie, sd * 0.4 * lie, sd * 0.25 * lie, k);
    // (Lying on the back, forward is up: the arms fall out to the sides onto the ground.)
    T(A, B.armL, -0.8 * buck * (1 - lie) - (v & 1 ? 0.15 : 0.05) * lie, 0, 0.4 * (1 - lie) + (v & 1 ? 1.35 : 0.75) * lie, k); T(A, B.foreL, -0.5 * (1 - lie) - (v & 1 ? 0.6 : 0.2) * lie, 0, 0, k);
    T(A, B.armR, -0.6 * buck * (1 - lie) - (v & 2 ? 0.05 : 0.2) * lie, 0, -0.3 * (1 - lie) - (v & 2 ? 0.5 : 1.2) * lie, k); T(A, B.foreR, -0.6 * (1 - lie) - (v & 2 ? 0.15 : 0.9) * lie, 0, 0, k);
    T(A, B.legL, -1.0 * buck - (v === 0 ? 0.55 : 0.05) * lie, 0, 0.12 * lie, k); T(A, B.shinL, 1.6 * buck + (v === 0 ? 1.1 : 0.12) * lie, 0, 0, k);
    T(A, B.legR, -0.9 * buck - 0.1 * lie, 0, -0.15 * lie, k); T(A, B.shinR, 1.5 * buck + 0.2 * lie, 0, 0, k);
    T(A, B.footL, 0.3 * lie, 0, 0, k); T(A, B.footR, 0.4 * lie, 0.2, 0, k);
  } else {
    // Face down: hands out in front as if bracing, legs trailing.
    T(A, B.hips, 0, 0, sd * 0.15 * lie, k);
    T(A, B.spine, 0.25 * buck + 0.05 * lie, 0, 0, k); T(A, B.chest, 0.15 * buck, 0, 0, k);
    T(A, B.neck, -0.2 * lie, sd * 0.9 * lie, 0, k); T(A, B.head, -0.2 * lie, sd * 0.4 * lie, 0, k);
    T(A, B.armL, -0.8 * buck - 2.2 * lie, 0, 0.3 + 0.25 * lie, k); T(A, B.foreL, -0.4 - 0.6 * lie, 0, 0, k);
    T(A, B.armR, -0.8 * buck - (v & 1 ? 0.3 : 2.0) * lie, 0, -0.3 - 0.2 * lie, k); T(A, B.foreR, -0.4 - 0.5 * lie, 0, 0, k);
    T(A, B.legL, -1.0 * buck + 0.05 * lie, 0, 0.1 * lie, k); T(A, B.shinL, 1.6 * buck + (v === 1 ? 0.9 : 0.15) * lie, 0, 0, k);
    T(A, B.legR, -0.9 * buck, 0, -0.08 * lie, k); T(A, B.shinR, 1.5 * buck + 0.1 * lie, 0, 0, k);
    T(A, B.footL, 0.9 * lie, 0, 0, k); T(A, B.footR, 0.8 * lie, 0, 0, k);
  }
  T(A, B.handL, -0.3, 0, 0.1, k); T(A, B.handR, -0.3, 0, -0.1, k);
  // Getting up: roll to the knees and push up with the hands.
  const g = extra.down?.getUp || 0;
  if (g > 0) {
    const kneel = Math.sin(Math.min(1, g) * Math.PI);
    mixT(A, B.legL, -1.4, 0, 0.1, kneel); mixT(A, B.shinL, 2.0, 0, 0, kneel);
    mixT(A, B.legR, -0.6, 0, -0.1, kneel); mixT(A, B.shinR, 1.6, 0, 0, kneel);
    mixT(A, B.spine, 0.5, 0, 0, kneel); mixT(A, B.armL, -0.9, 0, 0.2, kneel); mixT(A, B.armR, -0.9, 0, -0.2, kneel);
    mixT(A, B.foreL, -0.2, 0, 0, kneel); mixT(A, B.foreR, -0.2, 0, 0, kneel);
    A.ht[1] = lerp(A.ht[1], hr.y - 0.45, kneel);
  }
  A.headFree = false;
  A.speedS = 0;
  A.feet[0].init = A.feet[1].init = false;
  A.gaitOn = false;
}

// ===========================================================================================
// Seated: driving a car (hands on the wheel) or riding a two-wheeler (hands on the grips,
// feet on the pegs, one foot down when stopped). extra.rig carries the vehicle's handles in
// this model's space; extra.mount (0..1) blends from standing beside the vehicle to seated.
function seatedPose(m, A, ride, dt, extra) {
  const steer = extra.steer || 0;
  const rig = extra.rig;
  const mount = extra.mount ?? 1;
  const vs = Math.abs(extra.vSpeed || 0);
  const hr = m.hips.userData.rest;
  A.speedS = 0; A.gaitOn = false;
  A.feet[0].init = A.feet[1].init = false;
  const seatK = smooth(0.3, 0.85, mount);           // hips over the seat
  const gripK = smooth(0.0, 0.3, mount);           // hands on the controls
  const g = rig ? rig.ground : -0.62;               // ground height in this model's space
  const stand = rig?.stand || [-0.62, 0, 0.05];      // where the person stands beside the vehicle
  // Hips: from standing beside the vehicle (straight legs) into the seat.
  const standY = g + hr.y - 0.02, seatY = rig?.hipY ?? 0;
  const arc = Math.sin(seatK * Math.PI) * (ride ? 0.12 : 0.04);
  A.ht[0] = lerp(stand[0], 0, seatK); A.ht[1] = lerp(standY, seatY, seatK) + arc; A.ht[2] = lerp(stand[2], 0, seatK);
  A.hipK = 14; A.hipCap = null;
  if (ride) {
    const upright = rig?.seated ? 1 : 0;                       // bajaj: sitting up, feet on the floor
    const tuck = smooth(6, 22, vs) * (1 - upright);
    const stopped = (1 - smooth(0.6, 2.2, vs)) * (1 - upright);
    T(A, B.hips, (0.15 - 0.2 * upright) * seatK + 0.1 * tuck, steer * 0.05, 0, 10);
    const sport = rig && !rig.stepThrough ? 1 : 0;           // sport bike: forward over the tank
    T(A, B.spine, (0.2 + 0.22 * sport - 0.12 * upright + 0.2 * tuck) * seatK, -steer * 0.06, 0, 10);
    T(A, B.chest, (0.08 + 0.18 * tuck) * seatK, -steer * 0.08, steer * 0.05, 10);
    A.headPitch = -(0.32 - 0.3 * upright + 0.38 * tuck) * seatK; A.headYaw = steer * 0.35 + Math.sin(A.idleShift * 0.4 + A.seed) * 0.25 * stopped;
    T(A, B.neck, -0.1 * seatK, A.headYaw * 0.4, 0, 9); T(A, B.head, A.headPitch, A.headYaw * 0.6, 0, 9);
    A.headFree = false;
    // Legs: IK to the pegs; the left foot goes down to the road when stopped.
    A.ikLegT = 1; A.ikLegRate = 10;
    if (rig) {
      const pL = rig.pegs[0], pR = rig.pegs[1];
      const downL = stopped * seatK;
      // Swinging a leg over the seat (motorbike) or stepping through (scooter) while mounting.
      const over = Math.sin(smooth(0.25, 0.75, mount) * Math.PI);
      const stepL = [lerp(stand[0] + 0.12, pL[0], smooth(0.35, 0.8, mount)), 0, lerp(stand[2] + 0.05, pL[2], smooth(0.35, 0.8, mount))];
      stepL[1] = lerp(g + 0.085, pL[1], smooth(0.35, 0.8, mount)) + over * (rig.stepThrough ? 0.25 : 0.6);
      if (rig.stepThrough) stepL[2] += over * 0.2; else stepL[2] -= over * 0.35;
      const groundL = [0.34, g + 0.085, 0.05];
      A.legT[0].set(lerp(stepL[0], groundL[0], downL), lerp(stepL[1], groundL[1], downL), lerp(stepL[2], groundL[2], downL));
      const sR = smooth(0.7, 1, mount);
      A.legT[1].set(lerp(stand[0] - 0.12, pR[0], sR), lerp(g + 0.085, pR[1], sR) + Math.sin(sR * Math.PI) * 0.1, lerp(stand[2] - 0.02, pR[2], sR));
      A.legPole[0].set(0.5, 0.2, 1); A.legPole[1].set(-0.5, 0.2, 1);
      eu.set(rig.stepThrough ? 0.05 : 0.25 - 0.25 * downL, 0.12, 0, 'YXZ'); A.footQ[0].setFromEuler(eu);
      eu.set(rig.stepThrough ? 0.05 : 0.25, -0.12, 0, 'YXZ'); A.footQ[1].setFromEuler(eu);
      // Hands on the grips (they move with the bars).
      for (let s = 0; s < 2; s++) {
        A.ikArmT[s] = gripK;
        A.armT[s].set(...rig.grips[s]);
        A.armPole[s].set(s === 0 ? 0.6 : -0.6, -0.5, -0.6);
        eu.set(-Math.PI / 2 + 0.1, s === 0 ? -0.15 : 0.15, s === 0 ? Math.PI / 2 : -Math.PI / 2, 'ZXY');
        A.handRot[s] = (A.handRot[s] || new THREE.Quaternion()).setFromEuler(eu);
      }
    } else {
      T(A, B.legL, -1.25, 0, 0.28, 12); T(A, B.legR, -1.25, 0, -0.28, 12);
      T(A, B.shinL, 1.55, 0, 0, 12); T(A, B.shinR, 1.55, 0, 0, 12);
      A.ikLegT = 0;
    }
    T(A, B.armL, -1.05, 0, -0.05, 10); T(A, B.armR, -1.05, 0, 0.05, 10);
    T(A, B.foreL, -0.35, 0, 0, 10); T(A, B.foreR, -0.35, 0, 0, 10);
  } else {
    // Car: upright with a slight recline, legs forward to the pedals, hands on the wheel.
    T(A, B.hips, -0.1 * seatK, 0, 0, 10);
    T(A, B.spine, -0.05 * seatK, 0, 0, 10);
    T(A, B.chest, 0.04 * seatK, steer * 0.06, 0, 10);
    A.headYaw = steer * 0.3 + (extra.lookYaw || 0); A.headPitch = 0.05;
    A.headFree = true;
    A.ikLegT = 0;
    // Legs: from standing (outside) swinging in, then forward to the pedals.
    const inK = smooth(0.55, 1, mount);
    T(A, B.legL, lerp(0, -1.4, seatK), lerp(0, 0, inK), lerp(0, 0.08, inK), 10);
    T(A, B.legR, lerp(0, -1.45, seatK), 0, lerp(0, -0.04, inK), 10);
    T(A, B.shinL, lerp(0.05, 1.25, seatK), 0, 0, 10); T(A, B.shinR, lerp(0.05, 1.3, seatK), 0, 0, 10);
    T(A, B.footL, lerp(0, 0.15, seatK), 0, 0, 10); T(A, B.footR, lerp(0, 0.05, seatK), 0, 0, 10);
    if (rig?.wheel) {
      // Hands at ten-to-two on the rim, travelling round it with the steering.
      const w = rig.wheel, rot = (rig.wheelTurn ?? steer * 2.4);
      for (let s = 0; s < 2; s++) {
        const a0 = s === 0 ? 0.55 : Math.PI - 0.55;
        const a = a0 - rot;
        // Hands let go and re-grip rather than crossing over at full lock.
        const ax = Math.cos(a), ay = Math.sin(a);
        A.ikArmT[s] = gripK * (ay > -0.6 ? 1 : 0.0);
        A.armT[s].set(w.c[0] + w.x[0] * ax * w.r + w.u[0] * ay * w.r, w.c[1] + w.x[1] * ax * w.r + w.u[1] * ay * w.r, w.c[2] + w.x[2] * ax * w.r + w.u[2] * ay * w.r - 0.02);
        A.armPole[s].set(s === 0 ? 0.7 : -0.7, -0.7, -0.2);
        eu.set(-Math.PI / 2 + 0.6, s === 0 ? -0.3 : 0.3, (s === 0 ? 1 : -1) * (Math.PI / 2 - 0.35) - rot * 0.6, 'ZXY');
        A.handRot[s] = (A.handRot[s] || new THREE.Quaternion()).setFromEuler(eu);
      }
      A.ikArmRate = 14;
    }
    const a = steer * 0.9;
    T(A, B.armL, -0.95 - Math.sin(a) * 0.32, 0, -0.32 + Math.cos(a) * 0.05 - 0.05, 12);
    T(A, B.armR, -0.95 + Math.sin(a) * 0.32, 0, 0.32 - Math.cos(a) * 0.05 + 0.05, 12);
    T(A, B.foreL, -0.75 + Math.sin(a) * 0.15, 0, 0, 12); T(A, B.foreR, -0.75 - Math.sin(a) * 0.15, 0, 0, 12);
    T(A, B.handL, -0.3, 0, 0.3, 12); T(A, B.handR, -0.3, 0, -0.3, 12);
  }
  // Standing part of the mount blends towards a neutral standing pose.
  if (mount < 1) {
    const st = 1 - seatK;
    for (const b of [B.hips, B.spine, B.chest]) mixT(A, b, 0.02, 0, 0, st);
    if (!ride) for (const b of [B.legL, B.legR, B.shinL, B.shinR]) mixT(A, b, 0, 0, 0, st);
  }
}

// ===========================================================================================
// Two-bone IK.
// Leg s (0 = left, 1 = right): ankle target A.legT[s] in model space, knee pole A.legPole[s].
function legIK(m, A, s, w) {
  const leg = s === 0 ? m.legL : m.legR, shin = s === 0 ? m.shinL : m.shinR, foot = s === 0 ? m.footL : m.footR;
  // Target and pole into the hips frame.
  ma.copy(m.hips.matrix).invert();
  va.copy(A.legT[s]).applyMatrix4(ma);
  qa.copy(m.hips.quaternion).invert();
  vb.copy(A.legPole[s]).applyQuaternion(qa);
  solve2(leg.position, va, A.thigh, A.shin, vb, shin.userData.rest, foot.userData.rest, AZ, qb, qc);
  if (w < 0.999) { leg.quaternion.slerp(qb, w); shin.quaternion.slerp(qc, w); } else { leg.quaternion.copy(qb); shin.quaternion.copy(qc); }
  // Foot: world-space orientation from the planner, expressed under the shin.
  qd.copy(m.hips.quaternion).multiply(leg.quaternion).multiply(shin.quaternion).invert().multiply(A.footQ[s]);
  foot.quaternion.slerp(qd, w);
}

// Arm s: hand target A.armT[s] (model space), elbow pole A.armPole[s] (model space).
function armIK(m, A, s, w) {
  const arm = s === 0 ? m.armL : m.armR, fore = s === 0 ? m.foreL : m.foreR, hand = s === 0 ? m.handL : m.handR;
  m.hips.updateMatrix(); m.spine.updateMatrix(); m.chest.updateMatrix();
  mb.copy(m.hips.matrix).multiply(m.spine.matrix).multiply(m.chest.matrix);
  ma.copy(mb).invert();
  va.copy(A.armT[s]).applyMatrix4(ma);
  qChest.copy(m.hips.quaternion).multiply(m.spine.quaternion).multiply(m.chest.quaternion);
  qd.copy(qChest).invert();
  vb.copy(A.armPole[s]).applyQuaternion(qd);
  solve2(arm.position, va, A.upper, A.fore, vb, fore.userData.rest, hand.userData.rest, NEG_Z, qb, qc);
  arm.quaternion.slerp(qb, w); fore.quaternion.slerp(qc, w);
  if (A.handRot[s]) {
    qd.copy(qChest).multiply(arm.quaternion).multiply(fore.quaternion).invert().multiply(A.handRot[s]);
    hand.quaternion.slerp(qd, w);
  }
}

// Analytic two-bone solve in the parent frame: root at `root`, target `tgt`, bone lengths a, b,
// pole direction `pole`; `upRest`/`loRest` are the rest offsets of the child joints (bone
// axes), `restBend` the rest direction the middle joint bends towards. Outputs q1 (upper bone
// relative to the parent) and q2 (lower bone relative to the upper).
function solve2(root, tgt, a, b, pole, upRest, loRest, restBend, q1, q2) {
  vc.copy(tgt).sub(root);
  let D = vc.length();
  const n = vc.normalize();
  D = clamp(D, Math.abs(a - b) + 1e-3, a + b - 1e-4);
  const cosA = clamp((a * a + D * D - b * b) / (2 * a * D), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // Bend direction: the pole made perpendicular to the root→target line.
  ve.copy(pole).addScaledVector(n, -pole.dot(n));
  if (ve.lengthSq() < 1e-8) ve.copy(restBend).addScaledVector(n, -restBend.dot(n));
  ve.normalize();
  // Upper bone axis and its bend-facing side.
  const ux = n.x * cosA + ve.x * sinA, uy = n.y * cosA + ve.y * sinA, uz = n.z * cosA + ve.z * sinA;
  const px = ve.x * cosA - n.x * sinA, py = ve.y * cosA - n.y * sinA, pz = ve.z * cosA - n.z * sinA;
  basisQuat(upRest, restBend, qa);           // rest frame
  vd.set(ux, uy, uz); vb.set(px, py, pz);
  basisQuat(vd, vb, q1);                      // target frame
  q1.multiply(qa.invert());
  // Lower bone: from its rest axis to the direction elbow → target, in the upper bone's frame.
  const ex = root.x + ux * a, ey = root.y + uy * a, ez = root.z + uz * a;
  vd.set(root.x + n.x * D - ex, root.y + n.y * D - ey, root.z + n.z * D - ez).normalize();
  qa.copy(q1).invert();
  vd.applyQuaternion(qa);
  vb.copy(loRest).normalize();
  q2.setFromUnitVectors(vb, vd);
}

// Quaternion whose frame has `axis` (bone direction) as its first vector and `side`
// (orthogonalised) as its second.
const bX = new THREE.Vector3(), bY = new THREE.Vector3(), bZ = new THREE.Vector3(), bM = new THREE.Matrix4();
function basisQuat(axis, side, out) {
  bX.copy(axis).normalize();
  bY.copy(side).addScaledVector(bX, -side.dot(bX)).normalize();
  bZ.crossVectors(bX, bY);
  bM.makeBasis(bX, bY, bZ);
  return out.setFromRotationMatrix(bM);
}

// ===========================================================================================
function faceUpdate(m, A, dt, extra) {
  // Blinks every few seconds (sometimes a double blink); eyes close when dead.
  A.blink = (A.blink ?? 2) - dt;
  let lid = 0.28;
  if (A.blink < 0.14) lid = 0.28 + 1.0 * Math.sin(clamp(1 - A.blink / 0.14, 0, 1) * Math.PI);
  if (A.blink < 0) A.blink = Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 4;
  if (extra.dead) lid = 1.2;
  if (extra.squint) lid = Math.max(lid, 0.6);
  m.lidL.rotation.x = lid; m.lidR.rotation.x = lid;
  // Lip-sync: the mouth opens with the voice level; the jaw follows.
  const talk = extra.talk ?? 0;
  A.talk = damp(A.talk || 0, talk, 18, dt);
  const open = A.talk;
  const vowel = 0.5 + 0.5 * Math.sin((A.idleShift || 0) * 11.3); // rounder / wider mouth shapes
  m.mouth.scale.set(1 - open * (0.1 + 0.25 * vowel), 0.14 + open * 0.95, 1);
  m.jaw.rotation.x = open * 0.16;
}
