// The working port of Pasar Ikan: concrete quay, ship-to-shore gantry cranes, stacked containers,
// a moored container ship, the marina pier with fishing boats and the syndicate's yacht.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { createRng } from '../core/rng.js';
import { GRID, ROAD_HALF } from './city-layout.js';
import { addFishingBoat } from './coast-builder.js';

const rng = createRng(2727);
const BOX = new THREE.BoxGeometry(1, 1, 1);

function box(batch, mat, x, y, z, sx, sy, sz, rot = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(sx, sy, sz));
  batch.add(BOX, mat, m);
}

function gantryCrane(batch, x, z) {
  const red = assets.material('crane-red'), white = assets.material('metal-paint-white');
  // Four legs straddling the quay edge, a portal beam, and the boom reaching out over the water.
  for (const lx of [-9, 9]) for (const lz of [-7, 7]) box(batch, red, x + lx, 18, z + lz, 1.4, 36, 1.4);
  for (const lz of [-7, 7]) box(batch, red, x, 35, z + lz, 20, 2, 1.6);
  for (const lx of [-9, 9]) box(batch, red, x + lx, 20, z, 1.2, 1.2, 14);
  box(batch, white, x + 16, 38.5, z, 62, 2.4, 3.2);           // boom out over the ship
  box(batch, white, x - 12, 38.5, z, 14, 2.4, 3.2);           // back reach
  box(batch, red, x - 16, 36.5, z, 6, 4, 6);                  // counterweight / machinery house
  box(batch, white, x + 4, 36.2, z, 4, 3, 4);                 // trolley cab
  for (const lx of [-9, 9]) box(batch, white, x + lx, 45, z, 1, 14, 1); // A-frame
  box(batch, assets.emissive(0xff2a1a, 10), x + 46, 40, z, 0.7, 0.7, 0.7);
  box(batch, assets.emissive(0xffe0a0, 6), x + 4, 34.4, z, 3, 0.3, 3);
}

function containerShip(batch, x, z0, z1) {
  const len = z1 - z0, mid = (z0 + z1) / 2;
  const hull = assets.cloth(0x203648), red = assets.cloth(0x8a2418);
  box(batch, hull, x, 3, mid, 30, 10, len);
  box(batch, red, x, -1.5, mid, 30.2, 3, len + 0.2);
  // Tapered bow.
  const bow = new THREE.CylinderGeometry(15, 15, 10, 3, 1).rotateY(Math.PI / 6);
  const bm = new THREE.Matrix4().compose(new THREE.Vector3(x, 3, z0 - 4), new THREE.Quaternion(), new THREE.Vector3(1, 1, 0.55));
  batch.add(bow, hull, bm);
  // Superstructure at the stern.
  box(batch, assets.material('metal-paint-white'), x, 16, z1 - 10, 24, 16, 10);
  box(batch, assets.facadeMaterial('office', 0), x, 25, z1 - 10, 26, 3, 11);
  box(batch, assets.cloth(0x1a1a1a), x, 30, z1 - 12, 3, 6, 3);
  // Deck containers.
  const colors = [0xb83a24, 0x2a5f9e, 0x3a8a4a, 0xd8a02a, 0x7a7a80, 0xe86a1a, 0x1f8a8a];
  for (let z = z0 + 6; z < z1 - 22; z += 6.4) {
    const tiers = rng.int(1, 4);
    for (let t = 0; t < tiers; t++) for (let r = -2; r <= 2; r++) {
      box(batch, containerMat(rng.pick(colors)), x + r * 5.2, 8 + 2.7 * t + 1.35, z, 5, 2.6, 6.1);
    }
  }
}

const containerMats = new Map();
function containerMat(hex) {
  if (!containerMats.has(hex)) {
    const t = assets.texture('corrugated');
    containerMats.set(hex, new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, color: hex, roughness: 0.6, metalness: 0.4 }));
  }
  return containerMats.get(hex);
}

function yacht(batch, x, z) {
  const white = assets.material('metal-paint-white');
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 0); hullShape.lineTo(28, 0); hullShape.quadraticCurveTo(36, 1.5, 38, 4.2); hullShape.lineTo(-1, 4.2); hullShape.lineTo(0, 0);
  const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 8, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2 });
  hull.translate(-19, -1.2, -4);
  hull.rotateY(-Math.PI / 2);
  batch.add(hull, white, new THREE.Matrix4().makeTranslation(x, 0, z));
  box(batch, assets.material('glass-dark'), x, 4.6, z + 2, 7, 2.2, 18);
  box(batch, white, x, 6.2, z + 3, 6.2, 1.2, 14);
  box(batch, assets.material('glass-dark'), x, 7.4, z + 4, 5, 1.6, 8);
  box(batch, assets.emissive(0x6fe3ff, 4), x, 3.2, z, 8.3, 0.15, 30);
}

export function buildHarbor(collision) {
  const batch = new MeshBatcher();
  const x0 = GRID[8] + ROAD_HALF, x1 = 372;
  const conc = assets.material('concrete-dark');
  // Quay apron and its sea wall.
  const apron = new THREE.PlaneGeometry(x1 - x0, 700).rotateX(-Math.PI / 2);
  const uv = apron.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x1 - x0) / 10, uv.getY(i) * 70);
  batch.add(apron, conc, new THREE.Matrix4().makeTranslation((x0 + x1) / 2, 0.03, -22));
  box(batch, conc, x1 + 1, -3, -22, 2, 6.2, 700);
  // Bollards and yellow safety line along the edge.
  for (let z = -360; z < 320; z += 12) box(batch, assets.cloth(0x2a2a2a), x1 - 0.8, 0.4, z, 0.5, 0.8, 0.5);
  box(batch, assets.emissive(0xd8b020, 0.4), x1 - 2.5, 0.05, -22, 0.3, 0.02, 690);

  for (const z of [-290, -190, -90]) {
    gantryCrane(batch, x1 - 6, z);
    for (const lz of [-7, 7]) collision.addCenteredBox(x1 - 15, z + lz, 1.4, 1.4, 36, 'crane');
  }
  containerShip(batch, x1 + 22, -320, -60);

  // Container stacks in the yard, leaving a driving lane by the quay edge and gaps for cross aisles.
  const colors = [0xb83a24, 0x2a5f9e, 0x3a8a4a, 0xd8a02a, 0x7a7a80, 0xe86a1a, 0x1f8a8a, 0xe8e8e0];
  for (let z = -350; z < 240; z += 6.6) {
    if (((z + 350) / 6.6 | 0) % 7 === 6) continue;
    for (const cx of [x0 + 6, x0 + 11.5, x0 + 17]) {
      if (rng.chance(0.18)) continue;
      const tiers = rng.int(1, 4);
      for (let t = 0; t < tiers; t++) box(batch, containerMat(rng.pick(colors)), cx, 1.3 + t * 2.6, z, 5.2, 2.6, 6.1);
      collision.addCenteredBox(cx, z, 5.2, 6.1, tiers * 2.6, 'container');
    }
  }
  // Marina pier at the corner with boats and the syndicate yacht.
  const pierMat = assets.material('wood');
  box(batch, pierMat, 352, 0.1, 300, 8, 0.4, 60);
  box(batch, pierMat, 385, 0.1, 330, 60, 0.4, 6);
  for (let z = 272; z < 330; z += 6) for (const sx of [-4, 4]) box(batch, pierMat, 352 + sx, -1.5, z, 0.4, 3.4, 0.4);
  for (let i = 0; i < 6; i++) addFishingBoat(batch, 376 + i * 9, -0.6, 322 + (i % 2) * 2, 0);
  yacht(batch, 392, 296);
  collision.addBox(372, 250, 420, 326, 6, 'water'); // keep cars out of the marina basin

  const group = batch.build({ name: 'harbor' });
  return group;
}
