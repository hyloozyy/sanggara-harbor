// Positional sound for the whole city, on top of the AudioEngine's buses. Every one-shot (shots,
// impacts, crashes, explosions, doors, horns, grunts, footsteps) goes through a PannerNode placed
// where it happened, with distance falloff, and the listener follows the camera. Moving sources
// (nearby traffic engines, police sirens, the helicopter) are pitched by a doppler factor from their
// speed towards or away from the listener. Each vehicle model has its own engine voice (scooter
// buzz, two-stroke bajaj, diesel truck, V8 muscle, high-revving sports car...) with gear shifts.
// The district ambience crossfades: traffic hum, gulls and ship horns at the harbour, market crowd
// and melodic vendor calls, waves on the beach, industrial clanks, birds in the hills; rain drums on
// the roof when you sit in a car.
import { districtAt, BEACH_START_Z, isOnRoad, BLOCKS } from '../city/city-layout.js';

const C = 343;
export const ENGINE_PROFILES = {
  scooter: { base: 92, saw: 0.2, sq: 0.8, noise: 0.25, cut: 2600, gears: 1, am: 0 },
  motorbike: { base: 78, saw: 0.7, sq: 0.4, noise: 0.2, cut: 3200, gears: 6, am: 0 },
  bajaj: { base: 58, saw: 0.2, sq: 0.9, noise: 0.35, cut: 1500, gears: 3, am: 0.6 },
  sports: { base: 52, saw: 0.9, sq: 0.3, noise: 0.15, cut: 2400, gears: 6, am: 0 },
  muscle: { base: 31, saw: 0.6, sq: 0.8, noise: 0.2, cut: 900, gears: 4, am: 0.45 },
  truck: { base: 26, saw: 0.5, sq: 0.6, noise: 0.45, cut: 700, gears: 5, am: 0.25 },
  van: { base: 30, saw: 0.5, sq: 0.5, noise: 0.35, cut: 800, gears: 5, am: 0.15 },
  car: { base: 38, saw: 0.7, sq: 0.4, noise: 0.18, cut: 1200, gears: 5, am: 0.05 },
};
export function engineProfile(spec) {
  const b = spec.body;
  if (b === 'scooter' || b === 'motorbike' || b === 'bajaj' || b === 'sports' || b === 'muscle' || b === 'truck') return ENGINE_PROFILES[b];
  if (b === 'van' || b === 'minibus' || b === 'ambulance' || b === 'pickup' || b === 'suv') return ENGINE_PROFILES.van;
  return ENGINE_PROFILES.car;
}
const HORNS = { scooter: [[620, 'square'], [740, 'square']], motorbike: [[560, 'square']], bajaj: [[700, 'square']], truck: [[220, 'sawtooth'], [277, 'sawtooth'], [330, 'sawtooth']], van: [[300, 'sawtooth'], [370, 'sawtooth']] };

export class SoundWorld {
  constructor(audio) {
    this.a = audio;
    this.listener = { x: 0, y: 2, z: 0, vx: 0, vz: 0 };
    this.engines = [];      // pooled positional engine voices for nearby traffic
    this.sirens = [];       // pooled siren voices
    this.amb = null;
    this.stepDist = 0;
    this.lastImpact = 0;
    this.t = 0;
  }

  get ctx() { return this.a.ctx; }

  // A panner at (x, y, z) feeding the effects bus; it disconnects itself after `life` seconds.
  panner(x, y, z, { ref = 6, rolloff = 1.1, life = 3, dest } = {}) {
    const c = this.ctx;
    const p = c.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.rolloffFactor = rolloff; p.maxDistance = 600;
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
    p.connect(dest || this.a.sfx);
    if (life) setTimeout(() => { try { p.disconnect(); } catch { /* gone */ } }, life * 1000);
    return p;
  }

  setListener(cam, forward, dt) {
    const c = this.ctx;
    if (!c) return;
    const L = c.listener, x = cam.position.x, y = cam.position.y, z = cam.position.z;
    const fx = forward.x || 0, fy = forward.y || 0, fz = forward.z || 0, fl = Math.hypot(fx, fy, fz) || 1;
    forward = { x: fx / fl, y: fy / fl, z: fz / fl };
    if (!Number.isFinite(x + y + z + forward.x + forward.z)) return;
    const l = this.listener;
    if (dt > 0) { l.vx = (x - l.x) / dt; l.vz = (z - l.z) / dt; }
    l.x = x; l.y = y; l.z = z;
    if (L.positionX) {
      L.positionX.value = x; L.positionY.value = y; L.positionZ.value = z;
      L.forwardX.value = forward.x; L.forwardY.value = forward.y; L.forwardZ.value = forward.z;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(x, y, z); L.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0); }
  }

  dist(x, z) { return Math.hypot(x - this.listener.x, z - this.listener.z); }

  // Doppler factor for a source at (x, z) moving with (vx, vz).
  doppler(x, z, vx, vz) {
    const l = this.listener, dx = x - l.x, dz = z - l.z, d = Math.hypot(dx, dz) || 1;
    const vr = ((vx - l.vx) * dx + (vz - l.vz) * dz) / d; // positive = moving away
    return Math.max(0.7, Math.min(1.35, C / (C + vr)));
  }

  // ------------------------------------------------------------------ one-shots
  gunshot(kind, x, y, z) {
    if (!this.ctx) return;
    const d = this.dist(x, z);
    if (d > 260) return;
    const dest = this.panner(x, y, z, { ref: 10, rolloff: 0.8, life: 2.5 });
    const spec = {
      pistol: { crack: 2600, len: 0.16, body: 140, g: 0.75 }, revolver: { crack: 1900, len: 0.28, body: 95, g: 1.0 },
      smg: { crack: 3200, len: 0.09, body: 160, g: 0.5 }, rifle: { crack: 3000, len: 0.18, body: 110, g: 0.9 },
      shotgun: { crack: 1400, len: 0.34, body: 70, g: 1.05 }, sniper: { crack: 2200, len: 0.4, body: 60, g: 1.2 },
    }[kind] || { crack: 2600, len: 0.18, body: 130, g: 0.7 };
    const far = d > 60;
    this.a.noise(spec.len, { freq: far ? spec.crack * 0.35 : spec.crack, gain: spec.g, decay: spec.len, dest });
    this.a.tone(far ? spec.body * 0.6 : spec.body, spec.len * 1.6, { type: 'triangle', gain: 0.55, slide: 0.35, dest });
    // Street echo: two late, darker reflections off the buildings.
    const echo = this.panner(x, y + 6, z, { ref: 20, rolloff: 0.5, life: 3 });
    this.a.noise(0.5, { freq: 700, gain: 0.12 * spec.g, attack: 0.02, decay: 0.5, when: 0.12 + d / 900, dest: echo });
    this.a.noise(0.7, { freq: 420, gain: 0.07 * spec.g, attack: 0.04, decay: 0.7, when: 0.38 + d / 700, dest: echo });
    if (kind === 'sniper' || kind === 'rifle') this.a.tone(55, 0.6, { type: 'sine', gain: 0.25, slide: 0.6, when: 0.05, dest: echo });
  }

  impact(surface, x, y, z) {
    if (!this.ctx || this.dist(x, z) > 70) return;
    const now = this.ctx.currentTime;
    if (now - this.lastImpact < 0.03) return;
    this.lastImpact = now;
    const dest = this.panner(x, y, z, { ref: 3, life: 1.5 });
    const A = this.a;
    if (surface === 'metal') { A.tone(1800 + Math.random() * 1600, 0.25, { type: 'triangle', gain: 0.12, slide: 0.85, dest }); A.noise(0.05, { filter: 'highpass', freq: 4000, gain: 0.2, decay: 0.05, dest }); }
    else if (surface === 'glass') this.glass(x, y, z, 0.6);
    else if (surface === 'flesh') { A.noise(0.08, { freq: 500, gain: 0.35, decay: 0.08, dest }); A.tone(110, 0.08, { gain: 0.25, slide: 0.6, dest }); }
    else { A.noise(0.12, { filter: 'bandpass', freq: surface === 'ground' ? 900 : 1600, q: 1.2, gain: 0.3, decay: 0.12, dest }); if (Math.random() < 0.3) A.tone(2400 + Math.random() * 2000, 0.18, { type: 'sine', gain: 0.05, slide: 0.4, dest }); }
  }

  glass(x, y, z, amount = 1) {
    if (!this.ctx) return;
    const dest = this.panner(x, y, z, { ref: 4, life: 2 });
    this.a.noise(0.08, { filter: 'highpass', freq: 3500, gain: 0.35 * amount, decay: 0.08, dest });
    for (let i = 0; i < 4 + amount * 6; i++) this.a.tone(3000 + Math.random() * 5000, 0.08 + Math.random() * 0.2, { type: 'sine', gain: 0.05 * amount, when: 0.02 + Math.random() * 0.35, dest });
  }

  crash(strength, x, y, z) {
    if (!this.ctx || this.dist(x, z) > 120) return;
    const dest = this.panner(x, y, z, { ref: 8, life: 2 });
    const g = Math.min(1, 0.3 + strength * 0.05);
    this.a.noise(0.5, { freq: 1800, gain: g, decay: 0.5, dest });
    this.a.noise(0.25, { filter: 'bandpass', freq: 380, q: 2, gain: g * 0.9, decay: 0.25, dest });
    this.a.tone(70, 0.35, { type: 'square', gain: 0.18, slide: 0.5, dest });
    for (let i = 0; i < 3; i++) this.a.tone(500 + Math.random() * 900, 0.4, { type: 'triangle', gain: 0.05 * g, slide: 0.8, when: Math.random() * 0.1, dest }); // panels
    if (strength > 12) this.glass(x, y + 0.8, z, 0.7);
  }

  explosion(x, y, z) {
    if (!this.ctx) return;
    const dest = this.panner(x, y, z, { ref: 25, rolloff: 0.6, life: 4 });
    this.a.noise(1.6, { freq: 500, gain: 1.0, attack: 0.005, decay: 1.6, dest });
    this.a.tone(45, 1.2, { type: 'sine', gain: 0.9, slide: 0.4, dest });
    this.a.noise(0.4, { freq: 3000, gain: 0.5, decay: 0.4, dest });
    for (let i = 0; i < 5; i++) this.a.noise(0.1, { filter: 'highpass', freq: 2500, gain: 0.08, decay: 0.1, when: 0.4 + Math.random() * 1.2, dest }); // debris
  }

  punch(x, y, z) { if (!this.ctx) return; const dest = this.panner(x, y, z, { ref: 3, life: 1 }); this.a.noise(0.12, { freq: 900, gain: 0.6, decay: 0.12, dest }); this.a.tone(90, 0.12, { gain: 0.4, slide: 0.6, dest }); }

  // Synthesised pain / effort grunt: a short voiced "uh" falling in pitch.
  grunt(x, y, z, { female = false, pain = 1 } = {}) {
    const c = this.ctx;
    if (!c || this.dist(x, z) > 40) return;
    const dest = this.panner(x, y, z, { ref: 3, life: 1.2 });
    const t = c.currentTime, f0 = (female ? 230 : 120) * (0.9 + Math.random() * 0.25);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + 0.3);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = female ? 900 : 650; f.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25 * pain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(f).connect(g).connect(dest); o.start(t); o.stop(t + 0.35);
    this.a.noise(0.12, { filter: 'bandpass', freq: 1400, gain: 0.05, decay: 0.12, dest });
  }

  door(x, y, z, open) {
    if (!this.ctx) return;
    const dest = this.panner(x, y, z, { ref: 3, life: 1.5 });
    if (open) { this.a.noise(0.05, { filter: 'highpass', freq: 2500, gain: 0.3, decay: 0.05, dest }); this.a.tone(320, 0.06, { type: 'square', gain: 0.05, dest }); }
    else { this.a.noise(0.18, { freq: 260, gain: 0.7, decay: 0.18, dest }); this.a.tone(85, 0.15, { gain: 0.45, slide: 0.7, dest }); this.a.noise(0.04, { filter: 'highpass', freq: 3000, gain: 0.15, decay: 0.04, when: 0.02, dest }); }
  }

  horn(vehicle) {
    if (!this.ctx) return;
    const p = engineProfile(vehicle.spec);
    const key = vehicle.spec.body === 'scooter' ? 'scooter' : vehicle.spec.body === 'motorbike' ? 'motorbike' : vehicle.spec.body === 'bajaj' ? 'bajaj' : p === ENGINE_PROFILES.truck ? 'truck' : p === ENGINE_PROFILES.van ? 'van' : null;
    const notes = HORNS[key] || [[392, 'sawtooth'], [494, 'sawtooth']];
    const dest = this.panner(vehicle.pos.x, 1, vehicle.pos.z, { ref: 8, life: 2 });
    const len = key === 'truck' ? 0.9 : key === 'scooter' ? 0.25 : 0.45;
    for (const [f, type] of notes) this.a.tone(f, len, { type, gain: 0.1, attack: 0.01, dest });
  }

  gearShift() { if (!this.ctx) return; this.a.noise(0.06, { filter: 'bandpass', freq: 900, q: 2, gain: 0.12, decay: 0.06 }); this.a.tone(150, 0.05, { type: 'square', gain: 0.04 }); }

  // Footsteps by surface: asphalt / pavers, sand, wood (piers), grass, puddles when wet.
  footstep(x, z, { running = false, wet = 0, ground = null } = {}) {
    if (!this.ctx) return;
    const surface = ground || this.surfaceAt(x, z);
    const A = this.a, g = running ? 1 : 0.65;
    const dest = this.panner(x, 0.1, z, { ref: 2, life: 1 });
    if (wet > 0.45 && surface !== 'sand' && surface !== 'wood') { A.noise(0.14, { filter: 'bandpass', freq: 1100 + Math.random() * 500, q: 1.5, gain: 0.16 * g, decay: 0.14, dest }); A.noise(0.05, { filter: 'highpass', freq: 3500, gain: 0.06 * g, decay: 0.05, when: 0.03, dest }); return; }
    if (surface === 'sand') A.noise(0.16, { filter: 'bandpass', freq: 700 + Math.random() * 300, q: 0.8, gain: 0.12 * g, attack: 0.02, decay: 0.16, dest });
    else if (surface === 'wood') { A.tone(170 + Math.random() * 40, 0.09, { type: 'triangle', gain: 0.12 * g, dest }); A.noise(0.05, { freq: 1500, gain: 0.08 * g, decay: 0.05, dest }); }
    else if (surface === 'grass') A.noise(0.1, { filter: 'highpass', freq: 2500, gain: 0.06 * g, attack: 0.02, decay: 0.1, dest });
    else { A.noise(0.05, { filter: 'bandpass', freq: 1900 + Math.random() * 600, q: 1.4, gain: 0.16 * g, decay: 0.05, dest }); A.tone(95, 0.05, { gain: 0.08 * g, slide: 0.7, dest }); }
  }

  surfaceAt(x, z) {
    if (x > 350 || z > 366) return 'wood';
    if (z > BEACH_START_Z && !isOnRoad(x, z)) return 'sand';
    if (!isOnRoad(x, z) && districtAt(x, z) === 'bukit-hijau') {
      const b = BLOCKS.find((q) => x > q.lot.minX && x < q.lot.maxX && z > q.lot.minZ && z < q.lot.maxZ);
      if (b) return 'grass';
    }
    return 'asphalt';
  }

  tinkle(x, z) { if (!this.ctx || this.dist(x, z) > 25) return; const dest = this.panner(x, 0.1, z, { ref: 1.5, life: 1 }); for (let i = 0; i < 3; i++) this.a.tone(5200 + Math.random() * 2400, 0.06, { type: 'sine', gain: 0.03, when: i * (0.05 + Math.random() * 0.05), dest }); }
  clatter(x, z) { if (!this.ctx || this.dist(x, z) > 25) return; const dest = this.panner(x, 0.1, z, { ref: 2, life: 1 }); this.a.noise(0.08, { filter: 'bandpass', freq: 1800, q: 2, gain: 0.2, decay: 0.08, dest }); this.a.tone(700, 0.1, { type: 'square', gain: 0.03, when: 0.05, dest }); }
  reload(kind) { if (!this.ctx) return; const A = this.a; A.noise(0.05, { filter: 'highpass', freq: 3000, gain: 0.25, decay: 0.05 }); if (kind === 'shotgun') { for (let i = 0; i < 4; i++) A.noise(0.07, { filter: 'bandpass', freq: 1300, q: 2, gain: 0.25, decay: 0.07, when: 0.3 + i * 0.4 }); return; } if (kind === 'revolver') { A.tone(2600, 0.05, { type: 'square', gain: 0.04 }); for (let i = 0; i < 6; i++) A.tone(3800, 0.03, { type: 'triangle', gain: 0.04, when: 0.4 + i * 0.12 }); A.noise(0.06, { filter: 'highpass', freq: 2000, gain: 0.3, decay: 0.06, when: 1.8 }); return; } A.noise(0.07, { filter: 'bandpass', freq: 900, q: 1.5, gain: 0.3, decay: 0.07, when: 0.5 }); A.noise(0.06, { filter: 'highpass', freq: 2500, gain: 0.3, decay: 0.06, when: 0.9 }); A.tone(1400, 0.04, { type: 'square', gain: 0.05, when: 0.95 }); }
  swing(x, y, z) { if (!this.ctx) return; const dest = this.panner(x, y, z, { ref: 3, life: 1 }); this.a.noise(0.22, { filter: 'bandpass', freq: 900, q: 1.5, gain: 0.2, attack: 0.08, decay: 0.22, dest }); }

  money() { if (!this.ctx) return; [1320, 1760, 2640].forEach((f, i) => this.a.tone(f, 0.22, { type: 'square', gain: 0.05, when: i * 0.05 })); this.a.noise(0.15, { filter: 'highpass', freq: 5000, gain: 0.08, decay: 0.15, when: 0.1 }); }
  uiClick() { if (!this.ctx) return; this.a.tone(900, 0.04, { type: 'square', gain: 0.04 }); this.a.tone(1350, 0.05, { type: 'triangle', gain: 0.04, when: 0.03 }); }
  missionStart() { if (!this.ctx) return; [392, 523, 659].forEach((f, i) => this.a.tone(f, 0.6, { type: 'sawtooth', gain: 0.07, attack: 0.02, when: i * 0.12, dest: this.a.music })); this.a.tone(98, 1.4, { type: 'sine', gain: 0.25, dest: this.a.music }); }

  // ------------------------------------------------------------------ continuous voices
  makeEngineVoice(positional) {
    const c = this.ctx;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square';
    const g1 = c.createGain(), g2 = c.createGain();
    const n = c.createBufferSource(); n.buffer = this.a.noiseBuffer; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 1.2;
    const ng = c.createGain();
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    const am = c.createGain(); am.gain.value = 1;
    const lfo = c.createOscillator(); lfo.type = 'sine'; const lfoG = c.createGain(); lfoG.gain.value = 0;
    lfo.connect(lfoG).connect(am.gain);
    const out = c.createGain(); out.gain.value = 0;
    o1.connect(g1).connect(lp); o2.connect(g2).connect(lp); n.connect(nf).connect(ng).connect(lp);
    lp.connect(am).connect(out);
    let pan = null;
    if (positional) { pan = this.panner(0, 1, 0, { ref: 7, rolloff: 1.2, life: 0 }); out.connect(pan); } else out.connect(this.a.sfx);
    o1.start(); o2.start(); n.start(); lfo.start();
    return { o1, o2, g1, g2, nf, ng, lp, lfo, lfoG, out, pan, gear: 0, owner: null };
  }

  driveEngineVoice(v, vehicle, { throttle, gain, dopplerK = 1, onShift = null }) {
    const t = this.ctx.currentTime, p = engineProfile(vehicle.spec);
    const sp = Math.abs(vehicle.speed), max = vehicle.spec.maxSpeed;
    const gearSize = max / p.gears;
    const gear = Math.min(p.gears - 1, Math.floor(sp / gearSize));
    if (gear !== v.gear) { if (gear > v.gear && onShift) onShift(); v.gear = gear; v.shiftT = t; }
    const rpm = p.gears === 1 ? 0.2 + 0.8 * sp / max : 0.22 + 0.78 * ((sp - gear * gearSize) / gearSize);
    const f = (p.base + rpm * p.base * 2.3 + throttle * p.base * 0.2) * dopplerK;
    v.o1.frequency.setTargetAtTime(f, t, 0.05); v.o2.frequency.setTargetAtTime(f / 2, t, 0.05);
    v.g1.gain.value = p.saw; v.g2.gain.value = p.sq * 0.6;
    v.nf.frequency.setTargetAtTime(f * 6, t, 0.05); v.ng.gain.value = p.noise * (0.5 + throttle);
    v.lp.frequency.setTargetAtTime(p.cut * (0.45 + rpm * 0.6 + throttle * 0.35), t, 0.05);
    v.lfo.frequency.setTargetAtTime(Math.max(4, f / 4), t, 0.05); v.lfoG.gain.value = p.am * 0.5;
    const dip = v.shiftT && t - v.shiftT < 0.12 ? 0.45 : 1; // the lift between gears
    v.out.gain.setTargetAtTime(gain * dip, t, dip < 1 ? 0.02 : 0.08);
  }

  // Player's engine (direct), nearby traffic (positional + doppler), sirens, helicopter.
  updateVehicles(dt, playerVehicle, vehicles, policeCars, heli) {
    const c = this.ctx;
    if (!c) return;
    this.t += dt;
    if (!this.playerEngine) this.playerEngine = this.makeEngineVoice(false);
    const pe = this.playerEngine;
    if (playerVehicle && !playerVehicle.wrecked) {
      if (pe.owner !== playerVehicle) { pe.owner = playerVehicle; pe.gear = 0; }
      const thr = Math.abs(playerVehicle.controls.throttle);
      this.driveEngineVoice(pe, playerVehicle, { throttle: thr, gain: 0.1 + thr * 0.07, onShift: () => this.gearShift() });
    } else pe.out.gain.setTargetAtTime(0, c.currentTime, 0.1);

    // Three nearest moving AI vehicles get an engine voice.
    while (this.engines.length < 3) this.engines.push(this.makeEngineVoice(true));
    const near = vehicles.filter((v) => v !== playerVehicle && !v.wrecked && v.driverModel && this.dist(v.pos.x, v.pos.z) < 55)
      .sort((a, b) => this.dist(a.pos.x, a.pos.z) - this.dist(b.pos.x, b.pos.z)).slice(0, 3);
    this.engines.forEach((voice, i) => {
      const v = near[i];
      if (!v) { voice.out.gain.setTargetAtTime(0, c.currentTime, 0.2); voice.owner = null; return; }
      if (voice.owner !== v) { voice.owner = v; voice.gear = 0; }
      this.place(voice.pan, v.pos.x, 0.8, v.pos.z);
      const k = this.doppler(v.pos.x, v.pos.z, v.vel.x, v.vel.z);
      this.driveEngineVoice(voice, v, { throttle: Math.abs(v.controls?.throttle || 0.3), gain: 0.07, dopplerK: k });
    });

    // Sirens: wail, yelp and hi-lo patterns per car, positional with doppler.
    while (this.sirens.length < 2) this.sirens.push(this.makeSirenVoice());
    const wailing = policeCars.filter((v) => v.sirenOn && !v.wrecked).sort((a, b) => this.dist(a.pos.x, a.pos.z) - this.dist(b.pos.x, b.pos.z)).slice(0, 2);
    this.sirens.forEach((s, i) => {
      const v = wailing[i];
      if (!v) { s.out.gain.setTargetAtTime(0, c.currentTime, 0.2); return; }
      this.place(s.pan, v.pos.x, 1.6, v.pos.z);
      const k = this.doppler(v.pos.x, v.pos.z, v.vel.x, v.vel.z);
      const tt = this.t + v.id * 3.7, cycle = tt % 16;
      let f;
      if (cycle < 8) f = 650 + 420 * (0.5 - 0.5 * Math.cos(tt * 0.8));                        // wail
      else if (cycle < 12) f = 700 + 520 * ((tt * 4) % 1);                                      // yelp
      else f = Math.floor(tt * 1.6) % 2 ? 960 : 720;                                            // hi-lo
      s.osc.frequency.setTargetAtTime(f * k, c.currentTime, 0.015);
      s.out.gain.setTargetAtTime(0.08, c.currentTime, 0.1);
    });

    // Helicopter rotor.
    if (!this.rotor) this.rotor = this.makeRotorVoice();
    if (heli) { this.place(this.rotor.pan, heli.pos.x, heli.pos.y ?? 40, heli.pos.z); this.rotor.out.gain.setTargetAtTime(1.0, c.currentTime, 0.3); }
    else this.rotor.out.gain.setTargetAtTime(0, c.currentTime, 0.3);
  }

  place(p, x, y, z) { if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z); }

  makeSirenVoice() {
    const c = this.ctx;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 700;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    const out = c.createGain(); out.gain.value = 0;
    const pan = this.panner(0, 1, 0, { ref: 14, rolloff: 0.9, life: 0 });
    osc.connect(f).connect(out).connect(pan); osc.start();
    return { osc, out, pan };
  }

  makeRotorVoice() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.a.noiseBuffer; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
    const thump = c.createGain(); thump.gain.value = 0.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 11; const lg = c.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg).connect(thump.gain);
    const whine = c.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 1450; const wg = c.createGain(); wg.gain.value = 0.015;
    const out = c.createGain(); out.gain.value = 0;
    const pan = this.panner(0, 40, 0, { ref: 30, rolloff: 0.7, life: 0 });
    src.connect(f).connect(thump).connect(out); whine.connect(wg).connect(out); out.connect(pan);
    src.start(); lfo.start(); whine.start();
    return { out, pan };
  }

  // ------------------------------------------------------------------ ambience
  // District beds crossfade with where the listener is; one-shot calls are scattered around them.
  updateAmbience(dt, { x, z, night = 0, rain = 0, inCar = false, inCarRain = 0 }) {
    const c = this.ctx;
    if (!c) return;
    if (!this.amb) {
      const loop = (type, freq, q = 0.8) => {
        const src = c.createBufferSource(); src.buffer = this.a.noiseBuffer; src.loop = true; src.playbackRate.value = 0.7 + Math.random() * 0.5;
        const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(this.a.sfx); src.start();
        return { f, g };
      };
      this.amb = { traffic: loop('lowpass', 260), waves: loop('lowpass', 700), crowd: loop('bandpass', 900, 1.6), industry: loop('bandpass', 140, 3), wavePhase: 0, next: 0 };
    }
    const A = this.amb, t = c.currentTime;
    const d = districtAt(x, z);
    const beach = Math.max(0, Math.min(1, (z - 300) / 50));
    const harbour = Math.max(0, Math.min(1, (x - 280) / 70));
    A.wavePhase += dt;
    const swell = 0.5 + 0.5 * Math.sin(A.wavePhase * 0.55) * Math.sin(A.wavePhase * 0.21 + 2);
    const day = 1 - night * 0.7;
    A.traffic.g.gain.setTargetAtTime((d === 'pusat-niaga' ? 0.05 : d === 'bukit-hijau' ? 0.012 : 0.03) * (1 - rain * 0.4) * (inCar ? 0.4 : 1), t, 1);
    A.waves.g.gain.setTargetAtTime(0.09 * Math.max(beach, harbour * 0.5) * (0.4 + swell), t, 0.4);
    A.crowd.g.gain.setTargetAtTime((d === 'pasar-ikan' || d === 'kota-lama' ? 0.022 : 0.004) * day * (1 - rain * 0.7) * (inCar ? 0.3 : 1), t, 1);
    A.crowd.f.frequency.setTargetAtTime(800 + 300 * Math.sin(A.wavePhase * 1.7), t, 0.3);
    A.industry.g.gain.setTargetAtTime(d === 'kawasan-industri' ? 0.035 : 0, t, 1);
    // Scattered one-shots near the listener.
    A.next -= dt;
    if (A.next <= 0) {
      A.next = 1.5 + Math.random() * 3.5;
      const ox = x + (Math.random() - 0.5) * 60, oz = z + (Math.random() - 0.5) * 60;
      if ((d === 'pasar-ikan' || harbour > 0.3) && rain < 0.5) { if (Math.random() < 0.6) this.gull(ox, oz); else if (Math.random() < 0.25) this.shipHorn(x + 120, z + 60); }
      if ((d === 'kota-lama' || d === 'pasar-ikan') && night < 0.6 && rain < 0.4 && Math.random() < 0.45) this.vendorCall(ox, oz);
      if (d === 'kawasan-industri' && Math.random() < 0.7) this.clank(ox, oz);
      if (d === 'bukit-hijau' && rain < 0.4 && Math.random() < 0.7) this.bird(ox, oz, night);
      if (beach > 0.3 && Math.random() < 0.3 && night < 0.5) this.gull(ox, oz);
    }
    // Rain drumming on the roof while sitting in a car.
    if (inCar && inCarRain > 0.05) {
      const n = Math.floor(inCarRain * 30 * dt + Math.random());
      for (let i = 0; i < n; i++) this.a.noise(0.03, { filter: 'bandpass', freq: 2200 + Math.random() * 2500, q: 2, gain: 0.05 + Math.random() * 0.06, decay: 0.03, when: Math.random() * dt });
      if (!this.roof) { const r = this.a.ctx.createBufferSource(); r.buffer = this.a.noiseBuffer; r.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380; const g = c.createGain(); g.gain.value = 0; r.connect(f).connect(g).connect(this.a.sfx); r.start(); this.roof = g; }
    }
    if (this.roof) this.roof.gain.setTargetAtTime(inCar ? 0.12 * inCarRain : 0, t, 0.3);
  }

  gull(x, z) {
    const dest = this.panner(x, 18, z, { ref: 10, life: 2 });
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) { const f = 1300 + Math.random() * 500; this.a.tone(f, 0.22, { type: 'sawtooth', gain: 0.025, slide: 0.65, when: i * 0.26, dest }); this.a.tone(f * 1.5, 0.18, { type: 'sine', gain: 0.02, slide: 0.7, when: i * 0.26 + 0.02, dest }); }
  }

  shipHorn(x, z) { const dest = this.panner(x, 10, z, { ref: 60, rolloff: 0.4, life: 5 }); this.a.tone(92, 2.6, { type: 'sawtooth', gain: 0.12, attack: 0.2, dest }); this.a.tone(138, 2.6, { type: 'sawtooth', gain: 0.06, attack: 0.2, dest }); }

  // Abstract melodic street-vendor call: a few sung syllables on a pentatonic contour.
  vendorCall(x, z) {
    const dest = this.panner(x, 1.6, z, { ref: 8, life: 3 });
    const base = 200 + Math.random() * 120, steps = [0, 2, 4, 7, 9];
    const notes = 3 + Math.floor(Math.random() * 3);
    let when = 0;
    for (let i = 0; i < notes; i++) {
      const f = base * 2 ** (steps[Math.floor(Math.random() * steps.length)] / 12);
      const len = i === notes - 1 ? 0.6 : 0.22;
      this.a.tone(f, len, { type: 'triangle', gain: 0.05, attack: 0.03, when, dest });
      this.a.tone(f * 2, len, { type: 'sine', gain: 0.015, attack: 0.03, when, dest });
      when += len + 0.04;
    }
  }

  clank(x, z) { const dest = this.panner(x, 3, z, { ref: 10, life: 2 }); const f = 300 + Math.random() * 500; for (const k of [1, 2.76, 5.4]) this.a.tone(f * k, 0.6 / k + 0.1, { type: 'sine', gain: 0.04 / k, dest }); this.a.noise(0.04, { filter: 'highpass', freq: 2000, gain: 0.1, decay: 0.04, dest }); }

  bird(x, z, night) {
    const dest = this.panner(x, 8, z, { ref: 8, life: 2 });
    if (night > 0.6) { for (let i = 0; i < 2; i++) this.a.tone(520, 0.25, { type: 'sine', gain: 0.03, when: i * 0.5, dest }); return; } // owl-ish
    const f = 2600 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) this.a.tone(f * (1 + (i % 2) * 0.15), 0.07, { type: 'sine', gain: 0.03, slide: 1.3, when: i * 0.1, dest });
  }
}
