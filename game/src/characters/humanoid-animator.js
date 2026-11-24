// Procedural animation for the skinned humans. Locomotion is one continuous gait blended by
// a smoothed speed (idle → walk → jog → sprint), so starts, stops and speed changes never snap:
// stride length follows speed (feet don't slide), the pelvis bobs, sways and twists with the
// shoulders counter-rotating, arms swing, the head stays stable and looks at things, hair and
// ponytails lag behind. On top come idle breathing and weight shifts, blinking and lip-sync,
// aiming, punching, phoning, umbrellas, hands-up, cowering, panic running, falling, driving
// with hands on the wheel and riding scooters.
import { damp, clamp } from '../core/math-utils.js';

const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function rot(bone, x, y, z, rate, dt) {
  bone.rotation.x = damp(bone.rotation.x, x, rate, dt);
  bone.rotation.y = damp(bone.rotation.y, y, rate, dt);
  bone.rotation.z = damp(bone.rotation.z, z, rate, dt);
}

export function animateHumanoid(m, state, speed, dt, extra = {}) {
  if (!m.anim) return;
  dt = Math.min(dt, 0.1);
  const A = m.anim, G = m.gait;
  const K = 16; // default pose blend rate
  A.breath += dt * (state === 'run' || state === 'flee' ? 3.2 : 1.25);
  A.idleShift += dt;
  faceUpdate(m, A, dt, extra);

  if (state === 'drive' || state === 'ride') { seatedPose(m, state === 'ride', dt, extra); return; }

  const hipsRest = m.hips.userData.rest;
  if (state === 'dead') {
    // Knees buckle, arms go limp; the body's fall is done by Character on the root.
    rot(m.hips, 0, 0, 0, 8, dt);
    m.hips.position.y = damp(m.hips.position.y, hipsRest.y - 0.05, 6, dt);
    rot(m.spine, 0.15, 0, 0, 6, dt); rot(m.chest, 0.1, 0, 0, 6, dt); rot(m.neck, 0.3, 0.3, 0, 5, dt); rot(m.head, 0.2, 0, 0.2, 5, dt);
    rot(m.armL, -0.4, 0, 1.2, 5, dt); rot(m.armR, 0.2, 0, -1.0, 5, dt); rot(m.foreL, -0.6, 0, 0, 5, dt); rot(m.foreR, -0.3, 0, 0, 5, dt);
    rot(m.legL, -0.25, 0, 0.1, 6, dt); rot(m.legR, 0.1, 0, -0.15, 6, dt); rot(m.shinL, 0.5, 0, 0, 6, dt); rot(m.shinR, 0.2, 0, 0, 6, dt);
    rot(m.footL, 0.4, 0, 0, 6, dt); rot(m.footR, 0.3, 0, 0, 6, dt);
    A.speedS = 0;
    return;
  }

  // ------------------------------------------------------------ locomotion
  A.speedS = damp(A.speedS, speed, 7, dt);
  const s = A.speedS;
  const walk = smooth(0.08, 1.0, s), run = smooth(2.4, 4.6, s), sprint = smooth(5.6, 7.6, s);
  const panic = state === 'flee' ? 1 : 0;
  const h = m.root.scale.y || 1;
  const cycle = (1.38 + run * 1.05 + sprint * 0.45) * h * G.stride;
  m.phase += (Math.PI * 2 * s / cycle) * dt * (state === 'aim-walk' ? 1.1 : 1);
  if (s < 0.05) m.phase += dt * 0.0;
  const ph = m.phase;
  const sn = Math.sin(ph), cs = Math.cos(ph);

  const thighA = (0.42 * walk + 0.4 * run + 0.18 * sprint) * G.stride;
  const legPose = (p) => {
    const sp = Math.sin(p), cp = Math.cos(p);
    const hip = -sp * thighA - run * 0.18 * walk;                   // runners keep thighs forward
    const swing = Math.max(0, cp);                                  // leg travelling forward
    const knee = walk * (0.08 + 0.55 * Math.pow(swing, 1.4) + 0.12 * Math.max(0, sp)) + run * (0.35 + 1.15 * Math.pow(swing, 1.2) + 0.25 * Math.max(0, -sp)) + sprint * 0.35 * swing;
    const toeOff = walk * 0.35 * Math.max(0, -sp) * Math.max(0, cp + 0.3);
    const heel = walk * 0.18 * Math.max(0, sp) * Math.max(0, -cp + 0.2);
    const foot = -(hip + knee) * 0.92 + toeOff - heel + run * 0.25 * swing;
    return { hip, knee, foot };
  };
  const Lp = legPose(ph), Rp = legPose(ph + Math.PI);

  // Pelvis: bob, side sway towards the standing leg, hip drop, twist with the stride.
  const bob = (0.032 * walk * (1 - run) + 0.06 * run) * G.bounce;
  const bobY = walk * (1 - run) * (-bob * Math.abs(sn)) + run * (bob * (Math.abs(cs) - 0.5));
  const breathe = Math.sin(A.breath);
  const shiftT = A.idleShift * 0.23 + (m.look?.seed || 0);
  const idle = 1 - walk;
  const weightShift = idle * Math.sin(shiftT) * 0.018;
  const crouch = extra.crouch ? 0.15 : 0;
  m.hips.position.x = damp(m.hips.position.x, hipsRest.x + sn * 0.022 * walk * (1 - run) * G.sway + weightShift, 12, dt);
  m.hips.position.y = damp(m.hips.position.y, hipsRest.y + bobY - crouch - run * 0.03 - idle * Math.max(0, Math.sin(shiftT)) * 0.008, 20, dt);
  m.hips.position.z = hipsRest.z;
  const hipTwist = -sn * (0.13 * walk + 0.08 * run);
  const hipRoll = cs * 0.045 * walk * (1 - run) * G.sway + idle * Math.sin(shiftT) * 0.03;

  // Turning: lean into the curve.
  const turn = clamp(extra.turnRate || 0, -4, 4);
  A.turn = damp(A.turn, turn, 6, dt);
  const bank = -A.turn * 0.035 * (walk + run);

  rot(m.hips, 0.03 * run, hipTwist, hipRoll + bank, 18, dt);
  const lean = 0.05 * walk + 0.16 * run + 0.1 * sprint + G.slouch + panic * 0.06 + (extra.accel || 0) * 0.02;
  rot(m.spine, lean * 0.6 + idle * breathe * 0.012, -hipTwist * 0.5, -hipRoll * 0.6, 16, dt);
  rot(m.chest, lean * 0.4 + idle * breathe * 0.018 + G.slouch * 0.5, -hipTwist * 1.25, -hipRoll * 0.3 - bank * 0.4, 16, dt);

  // Head: stabilised against the torso twist, plus look-at and idle glances.
  const glance = idle * Math.sin(shiftT * 0.7 + 1.3) * 0.35 * (Math.sin(shiftT * 0.31) > 0.2 ? 1 : 0.2);
  const lookYaw = clamp(extra.lookYaw ?? glance, -1.2, 1.2);
  A.look = damp(A.look, lookYaw, 4, dt);
  const headPitch = -lean * 0.65 + (extra.lookPitch || 0) + (G.slouch * -0.3);
  rot(m.neck, headPitch * 0.4, A.look * 0.45 + hipTwist * 0.35, 0, 10, dt);
  rot(m.head, headPitch * 0.6 + bobY * 1.5, A.look * 0.55, -bank * 0.5, 10, dt);

  // Legs.
  rot(m.legL, Lp.hip, 0, 0.02 + idle * 0.015, 22, dt); rot(m.shinL, Lp.knee + idle * Math.max(0, -Math.sin(shiftT)) * 0.08, 0, 0, 22, dt); rot(m.footL, Lp.foot, 0, 0, 22, dt);
  rot(m.legR, Rp.hip, 0, -0.02 - idle * 0.015, 22, dt); rot(m.shinR, Rp.knee + idle * Math.max(0, Math.sin(shiftT)) * 0.08, 0, 0, 22, dt); rot(m.footR, Rp.foot, 0, 0, 22, dt);
  if (crouch) { rot(m.legL, -0.5, 0, 0, 12, dt); rot(m.legR, -0.5, 0, 0, 12, dt); rot(m.shinL, 0.9, 0, 0, 12, dt); rot(m.shinR, 0.9, 0, 0, 12, dt); rot(m.footL, -0.4, 0, 0, 12, dt); rot(m.footR, -0.4, 0, 0, 12, dt); }

  // Arms swing opposite the legs; elbows bend more with speed.
  const swingA = (0.32 * walk + 0.55 * run + 0.25 * sprint) * G.swing * (1 + panic * 0.4);
  const elbow = 0.18 + 0.2 * walk + 1.05 * run + panic * 0.3;
  const armOut = 0.09 + idle * 0.02 + run * 0.06;
  let aL = { x: sn * swingA - 0.04, z: armOut, fx: -(elbow + Math.max(0, -sn) * 0.35 * walk), fy: 0 };
  let aR = { x: -sn * swingA - 0.04, z: -armOut, fx: -(elbow + Math.max(0, sn) * 0.35 * walk), fy: 0 };
  if (panic) { aL.x -= 0.5 + Math.sin(ph * 2) * 0.3; aR.x -= 0.5 + Math.cos(ph * 2) * 0.3; aL.z += 0.35; aR.z -= 0.35; }
  if (idle > 0.5) { aL.x += breathe * 0.01; aR.x -= breathe * 0.01; }
  let rate = 16;

  if (state === 'aim' || state === 'aim-walk' || extra.aiming) {
    const two = extra.twoHanded, pitch = extra.pitch || 0;
    aR = { x: -Math.PI / 2 + pitch, z: 0.12, fx: -0.05, fy: 0 };
    aL = two ? { x: -Math.PI / 2 + 0.25 + pitch, z: -0.62, fx: -0.55, fy: 0 } : { x: aL.x * 0.5, z: armOut, fx: -0.3, fy: 0 };
    rot(m.chest, lean * 0.4, (two ? 0.35 : 0.15) - hipTwist, 0, 22, dt);
    rot(m.head, pitch * 0.4, two ? -0.3 : -0.12, 0, 18, dt);
    rate = 24;
  } else if (state === 'punch') {
    const t = extra.punchT ?? 0;
    const thrust = Math.sin(Math.min(1, t) * Math.PI);
    aR = { x: -0.5 - thrust * 1.15, z: 0.05, fx: -1.55 + thrust * 1.4, fy: 0 };
    aL = { x: -1.0, z: -0.1, fx: -1.9, fy: 0 };
    rot(m.chest, 0.1, -0.45 + thrust * 0.8, 0, 30, dt);
    rot(m.hips, 0, -0.15 + thrust * 0.25, 0, 30, dt);
    rate = 30;
  } else if (state === 'cower') {
    aL = { x: -2.5, z: -0.45, fx: -1.6, fy: 0 }; aR = { x: -2.5, z: 0.45, fx: -1.6, fy: 0 };
    rot(m.spine, 0.45, 0, 0, 10, dt); rot(m.chest, 0.3, 0, 0, 10, dt); rot(m.neck, 0.4, 0, 0, 10, dt);
    m.hips.position.y = damp(m.hips.position.y, hipsRest.y - 0.42, 8, dt);
    rot(m.legL, -1.25, 0, 0.15, 10, dt); rot(m.legR, -1.2, 0, -0.15, 10, dt); rot(m.shinL, 2.1, 0, 0, 10, dt); rot(m.shinR, 2.1, 0, 0, 10, dt);
    rot(m.footL, -0.7, 0, 0, 10, dt); rot(m.footR, -0.7, 0, 0, 10, dt);
    rate = 10;
  } else if (state === 'hands-up') {
    aL = { x: -2.9, z: 0.5, fx: -0.5, fy: 0 }; aR = { x: -2.9, z: -0.5, fx: -0.5, fy: 0 };
    rate = 9;
  } else if (state === 'phone') {
    aR = { x: -0.35, z: -0.55, fx: -2.35, fy: 0 };
    rot(m.head, 0.1, 0.25, 0.12, 6, dt);
  } else if (state === 'talk') {
    const g = Math.sin(A.breath * 1.7);
    aL.x = -0.35 + g * 0.12; aL.fx = -1.2; aR.x = -0.2 - g * 0.08; aR.fx = -0.9 + g * 0.2;
    rate = 6;
  }
  if (extra.umbrella && !extra.aiming && state !== 'punch' && state !== 'cower' && state !== 'hands-up') aL = { x: -0.62, z: 0.12, fx: -1.25, fy: 0 };
  if (extra.flinch > 0) { rot(m.chest, -0.35 * extra.flinch * 4, 0.2, 0, 30, dt); rot(m.head, -0.4 * extra.flinch * 4, 0, 0, 30, dt); }

  rot(m.armL, aL.x, 0, aL.z, rate, dt); rot(m.foreL, aL.fx, aL.fy, 0, rate, dt);
  rot(m.armR, aR.x, 0, aR.z, rate, dt); rot(m.foreR, aR.fx, aR.fy, 0, rate, dt);
  rot(m.handL, -0.1 - 0.15 * run, 0, 0.05, K, dt); rot(m.handR, -0.1 - 0.15 * run, 0, -0.05, K, dt);

  // Hair and ponytail: a damped spring lagging behind the head.
  const target = 0.2 + 0.5 * run + 0.25 * walk;
  A.tailV += ((target - A.tail) * 40 - A.tailV * 7 + Math.cos(ph * 2) * 6 * (walk + run)) * dt;
  A.tail += A.tailV * dt;
  m.hairTail.rotation.x = A.tail;
  m.hairTail.rotation.z = Math.sin(ph) * 0.12 * (walk + run);
}

function seatedPose(m, ride, dt, extra) {
  const hr = m.hips.userData.rest;
  m.hips.position.set(0, damp(m.hips.position.y, 0, 12, dt), 0);
  void hr;
  const steer = extra.steer || 0;
  rot(m.hips, 0, 0, 0, 12, dt);
  rot(m.spine, ride ? 0.22 : -0.08, 0, 0, 10, dt);
  rot(m.chest, ride ? 0.1 : 0.02, steer * 0.08, 0, 10, dt);
  rot(m.neck, 0, steer * 0.25, 0, 8, dt);
  rot(m.head, ride ? -0.25 : 0, steer * 0.2, 0, 8, dt);
  rot(m.legL, ride ? -1.25 : -1.45, 0, ride ? 0.28 : 0.06, 12, dt); rot(m.legR, ride ? -1.25 : -1.45, 0, ride ? -0.28 : -0.06, 12, dt);
  rot(m.shinL, ride ? 1.55 : 1.3, 0, 0, 12, dt); rot(m.shinR, ride ? 1.55 : 1.3, 0, 0, 12, dt);
  rot(m.footL, ride ? -0.2 : 0.1, 0, 0, 12, dt); rot(m.footR, ride ? -0.2 : 0.1, 0, 0, 12, dt);
  if (ride) {
    rot(m.armL, -1.05 - steer * 0.15, 0, -0.05, 10, dt); rot(m.armR, -1.05 + steer * 0.15, 0, 0.05, 10, dt);
    rot(m.foreL, -0.35, 0, 0, 10, dt); rot(m.foreR, -0.35, 0, 0, 10, dt);
  } else {
    // Hands at ten-to-two on the wheel, travelling round it with the steering.
    const a = steer * 0.9;
    rot(m.armL, -0.95 - Math.sin(a) * 0.32, 0, -0.32 + Math.cos(a) * 0.05 - 0.05, 12, dt);
    rot(m.armR, -0.95 + Math.sin(a) * 0.32, 0, 0.32 - Math.cos(a) * 0.05 + 0.05, 12, dt);
    rot(m.foreL, -0.75 + Math.sin(a) * 0.15, 0, 0, 12, dt); rot(m.foreR, -0.75 - Math.sin(a) * 0.15, 0, 0, 12, dt);
    rot(m.handL, -0.3, 0, 0.3, 12, dt); rot(m.handR, -0.3, 0, -0.3, 12, dt);
  }
}

function faceUpdate(m, A, dt, extra) {
  // Blinks every few seconds (sometimes a double blink).
  A.blink -= dt;
  let lid = 0.28;
  if (A.blink < 0.14) lid = 0.28 + 1.0 * Math.sin(clamp(1 - A.blink / 0.14, 0, 1) * Math.PI);
  if (A.blink < 0) A.blink = Math.random() < 0.15 ? 0.3 : 2 + Math.random() * 4;
  if (extra.dead) lid = 1.2;
  m.lidL.rotation.x = lid; m.lidR.rotation.x = lid;
  // Lip-sync: the mouth opens with the voice level (or syllable noise while talking).
  const talk = extra.talk ?? 0;
  A.talk = damp(A.talk, talk, 18, dt);
  const open = A.talk;
  m.mouth.scale.set(1 - open * 0.15, 0.14 + open * 0.95, 1);
  m.jaw.rotation.x = open * 0.16;
}
