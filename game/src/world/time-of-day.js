// The clock of Pelabuhan Sanggara: the sun's path across the sky from dawn to dusk, a cool
// moon at night, and the colour palette (sun, sky gradient, hemisphere fill, fog, exposure)
// interpolated from keyframes by the sun's elevation. Starts at golden hour by default.
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);
const V3 = (r, g, b) => new THREE.Color(r, g, b);

// Keyframes by sin(sun elevation).
const KEYS = [
  { e: -0.3, sun: C(0x7f8cc0), sunI: 0.42, sky: C(0x2a3456), ground: C(0x0e0e16), hemiI: 0.55, fog: C(0x10141f), zen: V3(0.006, 0.01, 0.03), mid: V3(0.02, 0.03, 0.07), hor: V3(0.06, 0.07, 0.12), disc: V3(0.25, 0.27, 0.35), exp: 1.3, night: 1 },
  { e: -0.06, sun: C(0x8a7cb8), sunI: 0.75, sky: C(0x5a5a8c), ground: C(0x2a1c22), hemiI: 0.75, fog: C(0x3e3450), zen: V3(0.04, 0.06, 0.16), mid: V3(0.26, 0.18, 0.34), hor: V3(0.95, 0.42, 0.3), disc: V3(1.0, 0.45, 0.3), exp: 1.15, night: 0.8 },
  { e: 0.06, sun: C(0xff9a5a), sunI: 2.6, sky: C(0x9a8ab8), ground: C(0x4a3024), hemiI: 0.95, fog: C(0xb0604e), zen: V3(0.1, 0.14, 0.34), mid: V3(0.6, 0.38, 0.5), hor: V3(1.6, 0.6, 0.3), disc: V3(1.8, 0.7, 0.3), exp: 1.02, night: 0.35 },
  { e: 0.33, sun: C(0xffb878), sunI: 3.9, sky: C(0xb0a8c4), ground: C(0x5a3a28), hemiI: 1.1, fog: C(0xc07a62), zen: V3(0.14, 0.2, 0.42), mid: V3(0.68, 0.5, 0.58), hor: V3(1.45, 0.7, 0.38), disc: V3(1.6, 0.85, 0.42), exp: 1.0, night: 0 },
  { e: 0.62, sun: C(0xfff0dc), sunI: 4.3, sky: C(0xa8c4ec), ground: C(0x6a5a48), hemiI: 1.25, fog: C(0xa6b8cc), zen: V3(0.12, 0.28, 0.66), mid: V3(0.42, 0.6, 0.88), hor: V3(0.9, 0.92, 0.96), disc: V3(1.5, 1.35, 1.1), exp: 0.92, night: 0 },
  { e: 1.0, sun: C(0xfff6ea), sunI: 4.5, sky: C(0xa0c0ee), ground: C(0x6a5a48), hemiI: 1.3, fog: C(0xa0b6cc), zen: V3(0.1, 0.26, 0.64), mid: V3(0.4, 0.58, 0.88), hor: V3(0.86, 0.9, 0.96), disc: V3(1.5, 1.4, 1.2), exp: 0.9, night: 0 },
];

export const DEFAULT_HOUR = 17.0;
const SUNSET_AZ = Math.atan2(-0.62, 0.72); // the golden-hour sun over the sea, as the city was lit

export class TimeOfDay {
  constructor(hour = DEFAULT_HOUR) {
    this.hour = hour;
    this.speed = 1 / 90;          // game hours per real second (a day in 36 minutes)
    this.frozen = false;
    this.sunDir = new THREE.Vector3();
    this.lightDir = new THREE.Vector3(); // sun by day, moon by night
    this.palette = {};
    for (const k of Object.keys(KEYS[0])) this.palette[k] = KEYS[0][k]?.clone ? KEYS[0][k].clone() : 0;
    this.compute();
  }

  update(dt) {
    if (!this.frozen) this.hour = (this.hour + dt * this.speed) % 24;
    this.compute();
  }

  // 0 at sunrise (06:10) .. 1 at sunset (18:30)
  get dayT() { return (this.hour - 6.15) / 12.35; }

  compute() {
    const t = this.dayT;
    const el = Math.sin(t * Math.PI) * 0.94;         // sin(elevation)
    const az = SUNSET_AZ + Math.PI * (1 - Math.min(1.2, Math.max(-0.2, t)));
    const ce = Math.sqrt(Math.max(0, 1 - el * el));
    this.sunDir.set(Math.sin(az) * ce, el, Math.cos(az) * ce).normalize();
    this.elevation = el;
    // The moon rides opposite and fairly high.
    if (el < -0.02) this.lightDir.set(0.35, 0.72, -0.6).normalize();
    else this.lightDir.copy(this.sunDir).setY(Math.max(0.04, el)).normalize();
    // Palette.
    const e = Math.max(KEYS[0].e, Math.min(1, el));
    let i = 0;
    while (i < KEYS.length - 2 && e > KEYS[i + 1].e) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const f = Math.min(1, Math.max(0, (e - a.e) / (b.e - a.e)));
    for (const k of Object.keys(a)) {
      if (k === 'e') continue;
      if (a[k].isColor) this.palette[k].copy(a[k]).lerp(b[k], f);
      else this.palette[k] = a[k] + (b[k] - a[k]) * f;
    }
    // Night fades in a little before the sun is fully down.
    this.night = this.palette.night;
  }

  label() {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
