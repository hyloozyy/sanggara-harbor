// A person as one skinned mesh: body, head, hair and clothes share a skeleton and a painted
// atlas, so each human costs two draw calls. Geometry is built once per body/outfit
// combination in the asset library and shared; the atlas (face and clothes) is per person.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { weatherizeMaterial } from '../render/surface-weather.js';
import { SkinnedPartBuilder } from './skinned-part-builder.js';
import { B, BONE_NAMES, PARENT, proportions, bindJoints, headShape, facePoint, HEAD_C, addTorso, addArms, addLegs, addHead } from './body-geometry.js';
import { addHair, addHeadwear, addHijab, addSkirt, addTorsoShell, addCollar, addHood, addApron, addBag, addGlasses } from './wear-geometry.js';
import { paintCharacterAtlas } from './character-atlas.js';
import { normaliseLook, generateLook, SKIN_TONES, HAIR_COLORS } from './character-generator.js';

export { SKIN_TONES, HAIR_COLORS };
export const SHIRT_COLORS = [0xe8e2d4, 0xc83a2a, 0x2a5fa8, 0x3a8a5a, 0xf0c040, 0x8a3a8a, 0x1a1a1a, 0xf08a5a, 0x5ac0c8, 0xb8a070, 0xffffff, 0x6a7a3a];
export const PANTS_COLORS = [0x2a2e3a, 0x1a1a1a, 0x5a4a3a, 0x3a4a6a, 0x8a7a5a, 0x202838];

function geometryKey(L) {
  const outer = L.outer ? `${L.outer.kind}:${L.outer.length || ''}` : '-';
  const hat = L.headwear && L.hair !== 'hijab' ? L.headwear : '-';
  const hair = ['helmet', 'hardhat'].includes(hat) ? 'crop' : L.hair;
  const collar = ['polo', 'shirt', 'batik', 'uniform'].includes(L.top.kind) ? 'c' : '-';
  return `human:${L.gender}:${L.build}:${hair}:${hat}:${outer}:${collar}:${L.bag || '-'}:${L.glasses ? 'g' : '-'}`;
}

function buildGeometry(L) {
  const P = proportions(L.gender, L.build);
  const shape = headShape(P);
  const J = bindJoints(P, shape);
  const b = new SkinnedPartBuilder();
  addTorso(b, P, J);
  addArms(b, P, J);
  addLegs(b, P, J);
  addHead(b, P, J, shape);
  const hat = L.headwear && L.hair !== 'hijab' ? L.headwear : null;
  const covered = hat === 'helmet' || hat === 'hardhat';
  if (L.hair === 'hijab') addHijab(b, shape);
  else addHair(b, covered ? 'crop' : L.hair, shape, P);
  addHeadwear(b, hat, shape);
  const o = L.outer;
  if (o) {
    if (o.kind === 'skirt' || o.kind === 'sarong') addSkirt(b, P, o.length || 'knee', o.kind === 'sarong' ? 0.6 : 1);
    if (o.kind === 'jacket' || o.kind === 'hoodie') addTorsoShell(b, P, 1.5, 0.93, 0.012);
    if (o.kind === 'hivis' || o.kind === 'tactical') addTorsoShell(b, P, 1.47, 1.0, o.kind === 'tactical' ? 0.02 : 0.01);
    if (o.kind === 'hoodie') addHood(b, P);
    if (o.kind === 'apron') addApron(b, P);
    if (o.kind === 'jacket') addCollar(b, P, 'outer', true);
  }
  if (['polo', 'shirt', 'batik', 'uniform'].includes(L.top.kind) && !(o && (o.kind === 'jacket' || o.kind === 'hoodie'))) addCollar(b, P, 'trim', true);
  if (L.bag) addBag(b, P, L.bag);
  if (L.glasses) addGlasses(b, J);
  const g = b.build();
  const loc = (p) => [p.x - HEAD_C[0], p.y - HEAD_C[1], p.z - HEAD_C[2]];
  g.userData = {
    joints: J, P,
    face: {
      shape,
      eyeL: [J.lidL[0] - HEAD_C[0], J.lidL[1] - HEAD_C[1], J.lidL[2] - HEAD_C[2] + 0.004],
      eyeR: [J.lidR[0] - HEAD_C[0], J.lidR[1] - HEAD_C[1], J.lidR[2] - HEAD_C[2] + 0.004],
      mouth: loc(facePoint(shape, 0, -0.068)),
      nose: loc(facePoint(shape, 0, -0.032)),
    },
  };
  return g;
}

// Hand-held props, shared by everyone.
function propMesh(kind) {
  if (kind === 'phone') {
    const m = new THREE.Mesh(assets.geometry('prop-phone', () => new THREE.BoxGeometry(0.008, 0.13, 0.065)), assets.material('glass-dark'));
    m.position.set(0, -0.06, 0.02);
    return m;
  }
  if (kind === 'umbrella') {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(assets.geometry('prop-umb-shaft', () => new THREE.CylinderGeometry(0.008, 0.008, 0.9, 5).translate(0, 0.38, 0)), assets.material('lamp-pole'));
    const canopy = new THREE.Mesh(assets.geometry('prop-umb-canopy', () => {
      const c = new THREE.ConeGeometry(0.55, 0.22, 10, 1, true);
      c.translate(0, 0.86, 0);
      return c;
    }), assets.material('umbrella'));
    canopy.castShadow = true;
    g.add(shaft, canopy);
    g.position.set(0, -0.06, 0.02);
    g.userData.canopy = canopy;
    return g;
  }
  return null;
}

const umbrellaMats = new Map();
function umbrellaMaterial(col) {
  if (!umbrellaMats.has(col)) umbrellaMats.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, side: THREE.DoubleSide }));
  return umbrellaMats.get(col);
}
const UMBRELLA_COLORS = [0x1a1a1a, 0xc83a2a, 0x2a5fa8, 0x3a8a5a, 0xf0c040, 0x8a3a8a, 0xe8e2d4];

export class HumanoidModel {
  constructor(look = {}, { atlasSize = 256 } = {}) {
    const L = normaliseLook(look);
    this.look = L;
    const key = geometryKey(L);
    const geo = assets.geometry(key, () => buildGeometry(L));
    const { joints: J } = geo.userData;
    this.atlas = paintCharacterAtlas(L, geo.userData.face, atlasSize);
    const env = assets.environment;
    this.matte = new THREE.MeshStandardMaterial({ map: this.atlas, roughness: 0.8, metalness: 0, envMap: env, envMapIntensity: 0.55 });
    this.gloss = new THREE.MeshStandardMaterial({ map: this.atlas, roughness: 0.16, metalness: 0, envMap: env, envMapIntensity: 1.1 });
    weatherizeMaterial(this.matte, { wet: 0.5, snow: 0.35 });

    const bones = BONE_NAMES.map((name) => { const bone = new THREE.Bone(); bone.name = name; return bone; });
    for (const name of BONE_NAMES) {
      const bone = bones[B[name]];
      const p = J[name];
      if (name === 'root') { bone.position.set(0, 0, 0); continue; }
      const q = J[PARENT[name]];
      bone.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      bones[B[PARENT[name]]].add(bone);
      bone.userData.rest = bone.position.clone();
    }
    this.mesh = new THREE.SkinnedMesh(geo, [this.matte, this.gloss]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = true;
    this.mesh.add(bones[0]);
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new THREE.Skeleton(bones));

    this.root = new THREE.Group();
    this.root.add(this.mesh);
    this.root.scale.setScalar(L.height ?? 1);
    for (const name of BONE_NAMES) if (name !== 'root') this[name] = bones[B[name]];
    this.rootBone = bones[0];
    this.bones = bones;
    // Held items sit in the palm.
    this.grip = new THREE.Group(); this.grip.position.set(0, -0.06, 0.012); this.handR.add(this.grip);
    this.gripL = new THREE.Group(); this.gripL.position.set(0, -0.06, 0.012); this.handL.add(this.gripL);
    this.phase = Math.random() * 10;
    this.heldItem = null;
    this.props = {};
    this.gait = L.gait || { stride: 1, bounce: 1, swing: 1, tempo: 1, slouch: 0, sway: 0.7 };
    this.anim = { blink: Math.random() * 3, talk: 0, look: 0, lookP: 0, tail: 0, tailV: 0, speedS: 0, turn: 0, lastHeading: null, breath: Math.random() * 6, idleShift: Math.random() * 10, hairSwing: 0 };
  }

  get name() { return this.look.name; }

  // Attach a weapon (or nothing) to the right hand.
  hold(mesh) {
    if (this.heldItem) this.grip.remove(this.heldItem);
    this.heldItem = mesh;
    if (mesh) this.grip.add(mesh);
  }

  // Show or hide a carried prop ('phone' in the right hand, 'umbrella' in the left).
  showProp(kind, on) {
    if (!on) { if (this.props[kind]) this.props[kind].visible = false; return; }
    if (!this.props[kind]) {
      const m = propMesh(kind);
      if (!m) return;
      if (kind === 'umbrella') {
        const col = UMBRELLA_COLORS[(this.look.seed || 0) % UMBRELLA_COLORS.length];
        m.userData.canopy.material = umbrellaMaterial(col);
        this.gripL.add(m);
      } else this.grip.add(m);
      this.props[kind] = m;
    }
    this.props[kind].visible = true;
  }

  setShadows(on) { this.mesh.castShadow = on; }

  dispose() {
    this.atlas.dispose();
    this.matte.dispose();
    this.gloss.dispose();
    this.mesh.skeleton.dispose();
  }
}

// A random townsperson (kept for callers that pass an rng).
export function randomLook(rng, overrides = {}) {
  return generateLook(Math.floor(rng.next() * 1e9), overrides.role || 'auto', overrides);
}

export const SCARF_COLORS = [0xe8d8c0, 0x2a4a7a, 0x8a2a4a, 0x3a6a5a, 0xd8a8b8, 0x1a1a1a, 0xc8a040];
