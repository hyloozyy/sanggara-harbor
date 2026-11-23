// Procedural animation for HumanoidModel: idle breathing, walk and run cycles, aiming stances,
// punches, sitting behind a wheel or on a scooter, cowering, and falling down when hit.
import { damp } from '../core/math-utils.js';

export function animateHumanoid(m, state, speed, dt, extra = {}) {
  const k = 14;
  const set = (obj, axis, v, rate = k) => { obj.rotation[axis] = damp(obj.rotation[axis], v, rate, dt); };
  let legA = 0, kneeA = 0, armA = 0, bob = 0, lean = 0, rate = 0;

  if (state === 'drive' || state === 'ride') {
    const ride = state === 'ride';
    set(m.legL, 'x', ride ? -1.2 : -1.45); set(m.legR, 'x', ride ? -1.2 : -1.45);
    set(m.shinL, 'x', ride ? 1.5 : 1.35); set(m.shinR, 'x', ride ? 1.5 : 1.35);
    set(m.legL, 'z', ride ? -0.25 : 0); set(m.legR, 'z', ride ? 0.25 : 0);
    const steer = extra.steer || 0;
    set(m.armL, 'x', -1.05 - steer * 0.25); set(m.armR, 'x', -1.05 + steer * 0.25);
    set(m.foreL, 'x', -0.5); set(m.foreR, 'x', -0.5);
    set(m.armL, 'z', 0.15); set(m.armR, 'z', -0.15);
    set(m.spine, 'x', ride ? 0.25 : -0.05);
    set(m.neck, 'y', steer * 0.3);
    m.hips.position.y = 0.0;
    return;
  }

  if (state === 'dead') {
    set(m.armL, 'z', 1.2, 6); set(m.armR, 'z', -1.2, 6);
    set(m.legL, 'x', 0.1, 6); set(m.legR, 'x', -0.2, 6);
    set(m.shinL, 'x', 0.2, 6); set(m.shinR, 'x', 0.4, 6);
    return;
  }

  if (state === 'walk' || state === 'run' || state === 'flee' || state === 'aim-walk') {
    const running = state !== 'walk' && state !== 'aim-walk';
    rate = running ? 1.6 : 1.9;
    m.phase += dt * speed * (running ? 1.75 : 2.6) / Math.max(0.6, rate * 0.6);
    legA = running ? 0.85 : 0.5;
    kneeA = running ? 1.3 : 0.6;
    armA = running ? 0.9 : 0.45;
    bob = running ? 0.07 : 0.035;
    lean = running ? 0.2 : 0.04;
  } else {
    m.phase += dt * 1.5;
  }
  const s = Math.sin(m.phase);
  const moving = legA > 0;
  set(m.legL, 'x', -s * legA); set(m.legR, 'x', s * legA);
  set(m.legL, 'z', 0); set(m.legR, 'z', 0);
  set(m.shinL, 'x', moving ? Math.max(0, Math.sin(m.phase + 1.6)) * kneeA : 0.02);
  set(m.shinR, 'x', moving ? Math.max(0, Math.sin(m.phase + 1.6 + Math.PI)) * kneeA : 0.02);
  m.hips.position.y = 0.95 + (moving ? Math.abs(Math.cos(m.phase)) * bob : Math.sin(m.phase) * 0.004) - (extra.crouch ? 0.15 : 0);
  set(m.spine, 'x', lean);
  set(m.neck, 'y', 0);

  // Arms: aiming overrides the swing.
  if (state === 'aim' || state === 'aim-walk' || extra.aiming) {
    const two = extra.twoHanded;
    set(m.armR, 'x', -Math.PI / 2 + (extra.pitch || 0), 22); set(m.armR, 'z', 0.08, 22);
    set(m.foreR, 'x', 0, 22);
    set(m.armL, 'x', two ? -Math.PI / 2 + 0.15 + (extra.pitch || 0) : s * armA * 0.5, 22);
    set(m.armL, 'z', two ? -0.55 : 0, 22);
    set(m.foreL, 'x', two ? -0.35 : -0.2, 22);
    set(m.spine, 'y', two ? 0.35 : 0.15, 22);
  } else if (state === 'punch') {
    const t = extra.punchT ?? 0; // 0..1
    const thrust = Math.sin(Math.min(1, t) * Math.PI);
    set(m.armR, 'x', -0.4 - thrust * 1.25, 30); set(m.foreR, 'x', -1.2 + thrust * 1.1, 30);
    set(m.armL, 'x', -0.9, 20); set(m.foreL, 'x', -1.6, 20);
    set(m.armR, 'z', 0); set(m.armL, 'z', 0);
    set(m.spine, 'y', -0.4 + thrust * 0.7, 30);
  } else if (state === 'cower') {
    set(m.armL, 'x', -2.6); set(m.armR, 'x', -2.6);
    set(m.armL, 'z', -0.4); set(m.armR, 'z', 0.4);
    set(m.foreL, 'x', -1.4); set(m.foreR, 'x', -1.4);
    set(m.spine, 'x', 0.35); set(m.spine, 'y', 0);
    m.hips.position.y = 0.8;
    set(m.legL, 'x', -0.6); set(m.legR, 'x', -0.6); set(m.shinL, 'x', 1.0); set(m.shinR, 'x', 1.0);
  } else if (state === 'phone') {
    set(m.armR, 'x', -0.6); set(m.foreR, 'x', -2.2); set(m.armR, 'z', -0.4);
    set(m.armL, 'x', s * 0.05); set(m.foreL, 'x', -0.15);
    set(m.spine, 'y', 0);
  } else {
    set(m.armL, 'x', -s * armA); set(m.armR, 'x', s * armA);
    set(m.armL, 'z', -0.06); set(m.armR, 'z', 0.06);
    set(m.foreL, 'x', moving ? -0.5 : -0.15); set(m.foreR, 'x', moving ? -0.5 : -0.15);
    set(m.spine, 'y', 0);
  }
}
