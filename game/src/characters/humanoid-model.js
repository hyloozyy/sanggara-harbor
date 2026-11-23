// Articulated low-detail people: hips, torso, head with hair, two-segment arms and legs with
// shoes, built from shared capsule geometry and coloured per person (clothes, skin, hair, hats).
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';

const G = {
  get torso() { return assets.geometry('h-torso', () => new THREE.CapsuleGeometry(0.17, 0.32, 4, 10).scale(1.12, 1, 0.72)); },
  get hips() { return assets.geometry('h-hips', () => new THREE.CapsuleGeometry(0.15, 0.08, 4, 10).scale(1.15, 1, 0.75)); },
  get head() { return assets.geometry('h-head', () => new THREE.SphereGeometry(0.115, 14, 10).scale(0.92, 1.08, 1)); },
  get hair() { return assets.geometry('h-hair', () => new THREE.SphereGeometry(0.124, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(0.95, 1.05, 1.05)); },
  get upperArm() { return assets.geometry('h-uarm', () => new THREE.CapsuleGeometry(0.055, 0.2, 3, 8).translate(0, -0.14, 0)); },
  get foreArm() { return assets.geometry('h-farm', () => new THREE.CapsuleGeometry(0.048, 0.2, 3, 8).translate(0, -0.13, 0)); },
  get hand() { return assets.geometry('h-hand', () => new THREE.SphereGeometry(0.05, 8, 6)); },
  get thigh() { return assets.geometry('h-thigh', () => new THREE.CapsuleGeometry(0.075, 0.3, 3, 8).translate(0, -0.21, 0)); },
  get shin() { return assets.geometry('h-shin', () => new THREE.CapsuleGeometry(0.06, 0.32, 3, 8).translate(0, -0.21, 0)); },
  get shoe() { return assets.geometry('h-shoe', () => new THREE.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.03, 0.05)); },
  get cap() { return assets.geometry('h-cap', () => new THREE.CylinderGeometry(0.12, 0.125, 0.1, 12).translate(0, 0.07, 0)); },
  get brim() { return assets.geometry('h-brim', () => new THREE.BoxGeometry(0.2, 0.02, 0.12).translate(0, 0.03, 0.12)); },
};

export const SKIN_TONES = [0xc68e64, 0xa8744e, 0x8d5b3a, 0xd9a47c, 0x7a4c2e, 0xe0b48e];
export const HAIR_COLORS = [0x15110e, 0x231a14, 0x2e2118, 0x0c0c0c, 0x4a3a2a];
export const SHIRT_COLORS = [0xe8e2d4, 0xc83a2a, 0x2a5fa8, 0x3a8a5a, 0xf0c040, 0x8a3a8a, 0x1a1a1a, 0xf08a5a, 0x5ac0c8, 0xb8a070, 0xffffff, 0x6a7a3a];
export const PANTS_COLORS = [0x2a2e3a, 0x1a1a1a, 0x5a4a3a, 0x3a4a6a, 0x8a7a5a, 0x202838];

function limb(parent, geo, mat, x, y, z) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  pivot.add(m);
  parent.add(pivot);
  return pivot;
}

export class HumanoidModel {
  constructor(look = {}) {
    const skin = assets.cloth(look.skin ?? SKIN_TONES[0]);
    const shirt = assets.cloth(look.shirt ?? SHIRT_COLORS[0]);
    const pants = assets.cloth(look.pants ?? PANTS_COLORS[0]);
    const shoes = assets.cloth(look.shoes ?? 0x1a1410);
    const hair = assets.cloth(look.hair ?? HAIR_COLORS[0]);
    const scale = look.scale ?? 1;

    this.root = new THREE.Group();
    this.root.scale.setScalar(scale);
    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.root.add(this.hips);
    const hipMesh = new THREE.Mesh(G.hips, pants);
    hipMesh.castShadow = true;
    this.hips.add(hipMesh);

    this.spine = new THREE.Group();
    this.spine.position.y = 0.08;
    this.hips.add(this.spine);
    const torso = new THREE.Mesh(G.torso, shirt);
    torso.position.y = 0.27;
    torso.castShadow = true;
    this.spine.add(torso);
    if (look.vest) {
      const vest = new THREE.Mesh(G.torso, assets.cloth(look.vest));
      vest.position.set(0, 0.29, 0); vest.scale.set(1.06, 0.8, 1.08);
      this.spine.add(vest);
    }

    this.neck = new THREE.Group();
    this.neck.position.y = 0.56;
    this.spine.add(this.neck);
    const head = new THREE.Mesh(G.head, skin);
    head.position.y = 0.12;
    head.castShadow = true;
    this.neck.add(head);
    const hairMesh = new THREE.Mesh(G.hair, hair);
    hairMesh.position.set(0, 0.135, -0.01);
    this.neck.add(hairMesh);
    if (look.cap) {
      const cap = new THREE.Mesh(G.cap, assets.cloth(look.cap));
      cap.position.y = 0.17;
      this.neck.add(cap);
      if (look.brim !== false) { const brim = new THREE.Mesh(G.brim, assets.cloth(look.cap)); brim.position.y = 0.17; this.neck.add(brim); }
    }

    this.armL = limb(this.spine, G.upperArm, shirt, 0.235, 0.48, 0);
    this.armR = limb(this.spine, G.upperArm, shirt, -0.235, 0.48, 0);
    this.foreL = limb(this.armL, G.foreArm, look.longSleeves ? shirt : skin, 0, -0.29, 0);
    this.foreR = limb(this.armR, G.foreArm, look.longSleeves ? shirt : skin, 0, -0.29, 0);
    const handL = new THREE.Mesh(G.hand, skin); handL.position.y = -0.27; this.foreL.add(handL);
    const handR = new THREE.Mesh(G.hand, skin); handR.position.y = -0.27; this.foreR.add(handR);
    this.handR = new THREE.Group(); this.handR.position.y = -0.27; this.foreR.add(this.handR);

    this.legL = limb(this.hips, G.thigh, pants, 0.1, -0.02, 0);
    this.legR = limb(this.hips, G.thigh, pants, -0.1, -0.02, 0);
    this.shinL = limb(this.legL, G.shin, pants, 0, -0.43, 0);
    this.shinR = limb(this.legR, G.shin, pants, 0, -0.43, 0);
    const shoeL = new THREE.Mesh(G.shoe, shoes); shoeL.position.y = -0.42; this.shinL.add(shoeL);
    const shoeR = new THREE.Mesh(G.shoe, shoes); shoeR.position.y = -0.42; this.shinR.add(shoeR);

    this.phase = Math.random() * 10;
    this.heldItem = null;
  }

  // Attach a weapon (or nothing) to the right hand.
  hold(mesh) {
    if (this.heldItem) this.handR.remove(this.heldItem);
    this.heldItem = mesh;
    if (mesh) this.handR.add(mesh);
  }

  setShadows(on) { this.root.traverse((o) => { if (o.isMesh) o.castShadow = on; }); }
}

export function randomLook(rng, overrides = {}) {
  return {
    skin: rng.pick(SKIN_TONES), hair: rng.pick(HAIR_COLORS), shirt: rng.pick(SHIRT_COLORS), pants: rng.pick(PANTS_COLORS),
    shoes: rng.pick([0x1a1410, 0x3a2a1a, 0xe8e8e8, 0x2a2a3a]), cap: rng.chance(0.2) ? rng.pick([0x1a1a1a, 0xc83a2a, 0x2a5fa8, 0xe8e0c8]) : null,
    scale: rng.range(0.92, 1.06), ...overrides,
  };
}
