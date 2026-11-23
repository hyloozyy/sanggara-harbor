// GPU point-sprite particles in two pools (additive fire/sparks and alpha-blended smoke/dust/
// water/blood), with emitters for explosions, tyre smoke, engine smoke, impacts and spray.
import * as THREE from 'three';
import { rng } from '../core/rng.js';

const VERT = /* glsl */`
  attribute float size; attribute float alpha; attribute vec3 tint;
  varying float vAlpha; varying vec3 vTint;
  void main() {
    vAlpha = alpha; vTint = tint;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (520.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */`
  varying float vAlpha; varying vec3 vTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    if (a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(vTint, a * vAlpha);
  }
`;

class ParticlePool {
  constructor(max, additive) {
    this.max = max;
    this.items = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.tint = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3));
    this.points = new THREE.Points(this.geo, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
  }

  add(p) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push(p);
  }

  update(dt) {
    const keep = [];
    for (const p of this.items) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= p.gravity * dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag; p.vy *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; }
      keep.push(p);
    }
    this.items = keep;
    const n = keep.length;
    for (let i = 0; i < n; i++) {
      const p = keep[i], t = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.size[i] = p.size0 + (p.size1 - p.size0) * t;
      this.alpha[i] = p.alpha * (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9);
      const c = p.color0, c1 = p.color1 || c;
      this.tint[i * 3] = c[0] + (c1[0] - c[0]) * t;
      this.tint[i * 3 + 1] = c[1] + (c1[1] - c[1]) * t;
      this.tint[i * 3 + 2] = c[2] + (c1[2] - c[2]) * t;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'size', 'alpha', 'tint']) this.geo.attributes[a].needsUpdate = true;
  }
}

function particle(o) {
  return { age: 0, vx: 0, vy: 0, vz: 0, gravity: 0, drag: 0.5, floor: -10, alpha: 1, size0: 1, size1: 1, ...o };
}

export class ParticleSystem {
  constructor(scene) {
    this.glow = new ParticlePool(900, true);
    this.soft = new ParticlePool(1100, false);
    scene.add(this.glow.points, this.soft.points);
  }

  update(dt) { this.glow.update(dt); this.soft.update(dt); }

  explosion(x, y, z, power = 1) {
    for (let i = 0; i < 70 * power; i++) {
      const a = rng.range(0, Math.PI * 2), e = rng.range(-0.2, 1), s = rng.range(4, 16) * power;
      this.glow.add(particle({ x, y, z, vx: Math.cos(a) * s * Math.cos(e), vy: Math.sin(e) * s + 3, vz: Math.sin(a) * s * Math.cos(e), life: rng.range(0.4, 1.1), size0: rng.range(2.5, 4.5) * power, size1: 0.8, color0: [9, 4.5, 1.2], color1: [3, 0.6, 0.1], drag: 2.2, gravity: -1 }));
    }
    for (let i = 0; i < 45 * power; i++) {
      const a = rng.range(0, Math.PI * 2), s = rng.range(1, 6);
      this.soft.add(particle({ x: x + rng.range(-1, 1), y: y + rng.range(0, 2), z: z + rng.range(-1, 1), vx: Math.cos(a) * s, vy: rng.range(2, 7), vz: Math.sin(a) * s, life: rng.range(2.5, 5), size0: 3, size1: rng.range(9, 15) * power, color0: [0.25, 0.2, 0.18], color1: [0.5, 0.42, 0.4], alpha: 0.75, drag: 1.2, gravity: -0.6 }));
    }
    this.sparks(x, y, z, 50 * power, 18);
  }

  sparks(x, y, z, count = 12, speed = 9, nx = 0, nz = 0) {
    for (let i = 0; i < count; i++) {
      const a = rng.range(0, Math.PI * 2), s = rng.range(0.3, 1) * speed;
      this.glow.add(particle({ x, y, z, vx: Math.cos(a) * s + nx * speed * 0.6, vy: rng.range(1, 6), vz: Math.sin(a) * s + nz * speed * 0.6, life: rng.range(0.2, 0.6), size0: 0.35, size1: 0.1, color0: [8, 5, 2], color1: [4, 1, 0.2], gravity: 14, drag: 0.3, floor: 0.05 }));
    }
  }

  muzzle(x, y, z, dx, dz) {
    for (let i = 0; i < 4; i++) this.glow.add(particle({ x: x + dx * i * 0.1, y, z: z + dz * i * 0.1, life: 0.06, size0: 0.32 - i * 0.05, size1: 0.1, color0: [6, 4, 1.6] }));
    this.soft.add(particle({ x, y, z, vx: dx * 1.5, vy: 0.6, vz: dz * 1.5, life: 0.8, size0: 0.3, size1: 1.4, color0: [0.6, 0.58, 0.55], alpha: 0.35 }));
  }

  dust(x, y, z, count = 4) {
    for (let i = 0; i < count; i++) this.soft.add(particle({ x, y, z, vx: rng.range(-1, 1), vy: rng.range(0.5, 2), vz: rng.range(-1, 1), life: rng.range(0.6, 1.2), size0: 0.3, size1: 1.2, color0: [0.55, 0.5, 0.45], alpha: 0.6 }));
  }

  blood(x, y, z, dx, dz) {
    for (let i = 0; i < 8; i++) this.soft.add(particle({ x, y, z, vx: dx * rng.range(1, 4) + rng.range(-1, 1), vy: rng.range(0, 2.5), vz: dz * rng.range(1, 4) + rng.range(-1, 1), life: rng.range(0.3, 0.7), size0: 0.25, size1: 0.12, color0: [0.45, 0.02, 0.02], gravity: 9, floor: 0.05 }));
  }

  tyreSmoke(x, z, amount = 1) {
    this.soft.add(particle({ x: x + rng.range(-0.3, 0.3), y: 0.3, z: z + rng.range(-0.3, 0.3), vx: rng.range(-0.6, 0.6), vy: rng.range(0.4, 1.2), vz: rng.range(-0.6, 0.6), life: rng.range(1.2, 2.2), size0: 0.8, size1: 3.6 * amount, color0: [0.75, 0.73, 0.72], alpha: 0.45 }));
  }

  engineSmoke(x, y, z, heavy) {
    this.soft.add(particle({ x, y, z, vx: rng.range(-0.3, 0.3), vy: rng.range(1.2, 2.6), vz: rng.range(-0.3, 0.3), life: rng.range(1.4, 2.6), size0: 0.6, size1: heavy ? 4.5 : 2.5, color0: heavy ? [0.12, 0.11, 0.1] : [0.6, 0.6, 0.6], alpha: heavy ? 0.7 : 0.4, gravity: -0.3 }));
  }

  fire(x, y, z, scale = 1) {
    this.glow.add(particle({ x: x + rng.range(-0.4, 0.4) * scale, y, z: z + rng.range(-0.4, 0.4) * scale, vx: rng.range(-0.3, 0.3), vy: rng.range(1.5, 3.5), vz: rng.range(-0.3, 0.3), life: rng.range(0.4, 0.8), size0: 1.6 * scale, size1: 0.3, color0: [8, 3.2, 0.6], color1: [3, 0.4, 0.05], gravity: -1 }));
  }

  splash(x, z) {
    for (let i = 0; i < 20; i++) this.soft.add(particle({ x, y: -0.5, z, vx: rng.range(-2, 2), vy: rng.range(3, 7), vz: rng.range(-2, 2), life: rng.range(0.6, 1.2), size0: 0.4, size1: 1.2, color0: [0.8, 0.9, 0.95], alpha: 0.8, gravity: 12 }));
  }

  // Static sparkle on the objective marker etc. is handled by markers; this one is for pickups.
  pickupGlint(x, y, z, color = [2, 2.4, 1]) {
    this.glow.add(particle({ x: x + rng.range(-0.3, 0.3), y, z: z + rng.range(-0.3, 0.3), vy: rng.range(0.5, 1.5), life: 0.8, size0: 0.25, size1: 0.05, color0: color }));
  }
}
