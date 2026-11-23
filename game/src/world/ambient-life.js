// Small things that make the coast feel alive: surf foam that breathes along the shoreline and
// flocks of seagulls wheeling over the beach and the harbour.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { createRng } from '../core/rng.js';

const rng = createRng(5151);

export class AmbientLife {
  constructor(scene) {
    // Foam: a long additive strip just where the sand slope meets the water.
    const foamMat = new THREE.MeshBasicMaterial({ map: assets.texture('glow'), color: 0xfff4e8, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    this.foam = [];
    for (let i = 0; i < 3; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(720, 2.2 - i * 0.5).rotateX(-Math.PI / 2), foamMat.clone());
      strip.position.set(-30, -0.62 + i * 0.01, 361.5 + i * 1.4);
      strip.material.map = foamMat.map;
      strip.renderOrder = 3;
      scene.add(strip);
      this.foam.push(strip);
    }
    // Gulls: a bent wing pair, instanced, each on its own circling path.
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.55, 0.12, 0, 0, 0, -0.15, 0, 0, 0.25, 0.55, 0.12, 0, 0, 0, -0.15], 3));
    wing.computeVertexNormals();
    this.gulls = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0xf4efe8, side: THREE.DoubleSide, fog: true }), 36);
    this.gulls.frustumCulled = false;
    this.paths = [];
    for (let i = 0; i < 36; i++) {
      const center = rng.pick([[-150, 345], [60, 350], [350, -150], [360, 260], [220, 230]]);
      this.paths.push({ cx: center[0] + rng.range(-30, 30), cz: center[1] + rng.range(-20, 20), r: rng.range(12, 35), y: rng.range(14, 30), speed: rng.range(0.15, 0.35) * (rng.chance(0.5) ? 1 : -1), phase: rng.range(0, Math.PI * 2), flap: rng.range(5, 8) });
    }
    scene.add(this.gulls);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.update(0);
  }

  update(t) {
    this.foam.forEach((f, i) => {
      const k = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 1.7);
      f.material.opacity = 0.12 + 0.3 * k;
      f.position.z = 361.5 + i * 1.4 + Math.sin(t * 0.9 + i * 1.7) * 0.8;
    });
    this.paths.forEach((p, i) => {
      const a = p.phase + t * p.speed;
      const x = p.cx + Math.cos(a) * p.r, z = p.cz + Math.sin(a) * p.r, y = p.y + Math.sin(t * 0.7 + i) * 1.5;
      const heading = Math.atan2(-Math.sin(a) * p.speed, Math.cos(a) * p.speed);
      this.e.set(0, heading, -Math.sign(p.speed) * 0.35);
      this.q.setFromEuler(this.e);
      const flap = 1 + Math.sin(t * p.flap + i) * 0.6;
      this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(1.4, 1.4 * flap, 1.4));
      this.gulls.setMatrixAt(i, this.m);
    });
    this.gulls.instanceMatrix.needsUpdate = true;
  }
}
