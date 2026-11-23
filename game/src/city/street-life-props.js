// Street life on the sidewalks: rows of parked scooters outside shophouses and lit food carts
// (gerobak) with awnings and lamps, merged into static batches.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { buildVehicleMesh } from '../vehicles/car-mesh-factory.js';
import { VEHICLE_MODELS } from '../vehicles/vehicle-catalog.js';
import { createRng } from '../core/rng.js';
import { BLOCKS, CURB_HEIGHT, SIDEWALK } from './city-layout.js';

const rng = createRng(3131);
const LIVELY = new Set(['kota-lama', 'pasar-ikan', 'pantai-senja']);

// Copy every mesh of an object hierarchy into the batcher at a transform.
function stamp(batch, root, matrix) {
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    batch.add(o.geometry, o.material, matrix.clone().multiply(o.matrixWorld));
  });
}

function buildCart(color) {
  const g = new THREE.Group();
  const B = (sx, sy, sz, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); g.add(m); };
  const wood = assets.material('wood');
  B(1.6, 0.9, 0.8, assets.cloth(color), 0, 0.75, 0);                 // cabinet
  B(1.5, 0.5, 0.7, assets.material('glass-dark'), 0, 1.45, 0);         // glass display
  B(1.9, 0.06, 1.1, assets.cloth(0xf4efe4), 0, 2.15, 0);               // awning
  B(0.05, 0.9, 0.05, wood, -0.75, 1.7, 0.35); B(0.05, 0.9, 0.05, wood, 0.75, 1.7, 0.35);
  B(0.05, 0.9, 0.05, wood, -0.75, 1.7, -0.35); B(0.05, 0.9, 0.05, wood, 0.75, 1.7, -0.35);
  B(0.18, 0.18, 0.18, assets.emissive(0xffd08a, 7), 0, 2.0, 0);       // hanging lamp
  B(1.2, 0.3, 0.02, assets.emissive(0xffe6a0, 1.4), 0, 1.45, 0.36);   // lit sign strip
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10).rotateZ(Math.PI / 2), assets.material('rubber'));
  wheel.position.set(0.85, 0.3, 0); g.add(wheel);
  return g;
}

export function buildStreetLife(collision) {
  const batch = new MeshBatcher();
  const scooterSpec = VEHICLE_MODELS.bebek;
  const scooters = scooterSpec.colors.map((c) => buildVehicleMesh(scooterSpec, c).root);
  const carts = [0x2a7fd4, 0xd84a2a, 0x2aa05a, 0xe0b020].map(buildCart);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  for (const b of BLOCKS) {
    if (!LIVELY.has(b.district)) continue;
    const s = b.slab;
    // Each side: outward normal angle, a point generator along the side.
    const sides = [
      { rot: 0, at: (t, inset) => [s.minX + t, s.maxZ - inset], len: s.maxX - s.minX },
      { rot: Math.PI, at: (t, inset) => [s.minX + t, s.minZ + inset], len: s.maxX - s.minX },
      { rot: Math.PI / 2, at: (t, inset) => [s.maxX - inset, s.minZ + t], len: s.maxZ - s.minZ },
      { rot: -Math.PI / 2, at: (t, inset) => [s.minX + inset, s.minZ + t], len: s.maxZ - s.minZ },
    ];
    for (const side of sides) {
      if (rng.chance(0.35)) continue;
      // A row of scooters parked nose-in against the shops.
      const start = rng.range(10, side.len - 22), count = rng.int(3, 7);
      for (let k = 0; k < count; k++) {
        const [x, z] = side.at(start + k * 0.95, SIDEWALK - 0.9);
        q.setFromAxisAngle(up, side.rot + Math.PI + rng.range(-0.15, 0.15));
        m.compose(new THREE.Vector3(x, CURB_HEIGHT, z), q, one);
        stamp(batch, rng.pick(scooters), m);
      }
      const [cx0, cz0] = side.at(start + count * 0.5, SIDEWALK - 0.9);
      collision.addCenteredBox(cx0, cz0, side.rot === 0 || side.rot === Math.PI ? count : 1.8, side.rot === 0 || side.rot === Math.PI ? 1.8 : count, 1.1, 'scooters');
      // A food cart by the kerb.
      if (rng.chance(0.6)) {
        const [x, z] = side.at(rng.range(8, side.len - 8), 0.9);
        q.setFromAxisAngle(up, side.rot);
        m.compose(new THREE.Vector3(x, CURB_HEIGHT, z), q, one);
        stamp(batch, rng.pick(carts), m);
        collision.addCenteredBox(x, z, 1.4, 1.4, 2, 'cart');
      }
    }
  }
  return batch.build({ name: 'street-life', castShadow: true });
}
