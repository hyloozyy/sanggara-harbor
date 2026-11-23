// The coast and the horizon: the beach of Pantai Senja, the animated sea, the green hills behind
// the city with villas on their slopes, and islands on the horizon.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { createRng } from '../core/rng.js';
import { SEA_SOUTH_Z, HARBOR_EDGE_X, GRID, ROAD_HALF } from './city-layout.js';

const rng = createRng(1717);

export class Sea {
  constructor() {
    const mat = assets.material('water');
    this.material = mat;
    const geo = new THREE.PlaneGeometry(5000, 5000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 260, uv.getY(i) * 260);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = -0.7;
    this.mesh.receiveShadow = true;
    this.mesh.name = 'sea';
  }

  update(t) {
    const n = this.material.normalMap;
    n.offset.set(t * 0.012, t * 0.02);
  }
}

function hillHeight(x, z) {
  // Distance into the hills from the city edge (north or west), with rolling noise.
  const dn = Math.max(0, -372 - z), dw = Math.max(0, -372 - x);
  const d = Math.max(dn, dw);
  const base = Math.min(1, d / 260) ** 1.3 * 115;
  const wobble = Math.sin(x * 0.013) * 14 + Math.sin(z * 0.017 + 1.3) * 12 + Math.sin((x + z) * 0.031) * 6;
  return d <= 0 ? -1 : base + wobble * Math.min(1, d / 80);
}

function buildHills(batch) {
  const mat = assets.material('hill');
  const make = (cx, cz, w, d) => {
    const g = new THREE.PlaneGeometry(w, d, 80, 40);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
      pos.setY(i, hillHeight(x, z));
      uv.setXY(i, x / 18, z / 18);
    }
    g.computeVertexNormals();
    batch.add(g, mat, new THREE.Matrix4().makeTranslation(cx, 0, cz));
  };
  make(-150, -372 - 260, 1500, 520);
  make(-372 - 260, 190, 520, 1100);
  // Villas and trees dotted on the slopes.
  const villaMat = assets.facadeMaterial('villa', 0);
  const roofMat = assets.material('clay-roof');
  const leaves = assets.material('leaves');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
  const blob = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 160; i++) {
    const north = rng.chance(0.6);
    const x = north ? rng.range(-800, 600) : rng.range(-560, -390);
    const z = north ? rng.range(-560, -390) : rng.range(-380, 600);
    const y = hillHeight(x, z);
    if (y < 2) continue;
    if (rng.chance(0.35)) {
      const w = rng.range(8, 14), d = rng.range(7, 11), h = rng.range(5, 8);
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2 - 1, z), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
      batch.add(box, villaMat, m);
      const r = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h - 1 + 1.6, z), new THREE.Quaternion(), new THREE.Vector3(w * 1.1, 3.2, d * 1.1));
      batch.add(cone, roofMat, r);
    } else {
      for (let k = 0; k < 4; k++) {
        const s = rng.range(3, 6);
        const tx = x + rng.range(-10, 10), tz = z + rng.range(-10, 10);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(tx, hillHeight(tx, tz) + s * 0.7, tz), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.1, s));
        batch.add(blob, leaves, m);
      }
    }
  }
}

function buildBeach(batch) {
  const sand = assets.material('sand');
  const w = GRID[8] + ROAD_HALF - (-380);
  const depth = SEA_SOUTH_Z + 30 - (GRID[8] + ROAD_HALF);
  const g = new THREE.PlaneGeometry(w, depth, 40, 12);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const z0 = GRID[8] + ROAD_HALF;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i) + z0 + depth / 2;
    const into = z - (SEA_SOUTH_Z - 18);
    pos.setY(i, 0.04 - Math.max(0, into) * 0.09);
    uv.setXY(i, (pos.getX(i)) / 10, z / 10);
  }
  g.computeVertexNormals();
  batch.add(g, sand, new THREE.Matrix4().makeTranslation((-380 + GRID[8] + ROAD_HALF) / 2, 0, z0 + depth / 2));
  // Promenade wall between boulevard and sand.
  const wall = new THREE.BoxGeometry(w, 0.6, 0.6);
  batch.add(wall, assets.material('white-plaster'), new THREE.Matrix4().makeTranslation((-380 + GRID[8]) / 2, 0.3, z0 + 0.3));
  // Beach umbrellas and loungers.
  const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5).translate(0, 1.2, 0);
  const shade = new THREE.ConeGeometry(1.5, 0.6, 10, 1, true).translate(0, 2.4, 0);
  const lounger = new THREE.BoxGeometry(0.7, 0.25, 1.9).translate(0, 0.3, 0);
  const colors = [0xe8452c, 0x2c8fe8, 0xf2c230, 0x2ab07a, 0xffffff];
  for (let x = -350; x < 300; x += rng.range(9, 16)) {
    const z = rng.range(345, 358);
    batch.add(pole, assets.material('chrome'), new THREE.Matrix4().makeTranslation(x, 0, z));
    batch.add(shade, assets.cloth(rng.pick(colors)), new THREE.Matrix4().makeTranslation(x, 0, z));
    batch.add(lounger, assets.cloth(0xf0e8d8), new THREE.Matrix4().makeTranslation(x + 1.2, 0, z + 0.5));
  }
  // Wooden jukung outrigger boats pulled up on the sand.
  for (let i = 0; i < 10; i++) addFishingBoat(batch, rng.range(-340, 280), 0.2, rng.range(362, 368), rng.range(-0.3, 0.3) + Math.PI / 2);
}

export function addFishingBoat(batch, x, y, z, rot) {
  const hullColor = rng.pick([0x1f78c8, 0xe0402a, 0x2aa060, 0xf0c020, 0xffffff]);
  const hull = new THREE.CylinderGeometry(0.7, 0.35, 7, 8, 1).rotateZ(Math.PI / 2).scale(1, 0.7, 1);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
  const base = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.5, z), q, new THREE.Vector3(1, 1, 1));
  batch.add(hull, assets.cloth(hullColor), base);
  const stripe = new THREE.BoxGeometry(6.4, 0.12, 1.5).translate(0, 0.42, 0);
  batch.add(stripe, assets.cloth(0xffffff), base);
  // Outriggers.
  const boom = new THREE.CylinderGeometry(0.05, 0.05, 5, 4).rotateX(Math.PI / 2);
  const float = new THREE.CylinderGeometry(0.12, 0.12, 5, 5).rotateZ(Math.PI / 2);
  for (const ox of [-1.4, 1.4]) batch.add(boom, assets.material('wood'), base.clone().multiply(new THREE.Matrix4().makeTranslation(ox, 0.5, 0)));
  for (const oz of [-2.4, 2.4]) batch.add(float, assets.material('wood'), base.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.15, oz)));
}

function buildIslands(batch) {
  const mat = assets.material('hill');
  for (const [x, z, r, h] of [[-600, 1100, 220, 70], [250, 1300, 300, 110], [1200, 700, 260, 90], [1300, -300, 200, 60], [900, 1200, 150, 45]]) {
    const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * (0.8 + Math.sin(pos.getX(i) * 5 + x) * 0.2));
    g.computeVertexNormals();
    batch.add(g, mat, new THREE.Matrix4().compose(new THREE.Vector3(x, -2, z), new THREE.Quaternion(), new THREE.Vector3(r, h, r * 0.6)));
  }
  // Lighthouse on the harbour mole.
  const tower = new THREE.CylinderGeometry(1.6, 2.4, 22, 12).translate(0, 11, 0);
  batch.add(tower, assets.material('white-plaster'), new THREE.Matrix4().makeTranslation(470, 0, 470));
  const band = new THREE.CylinderGeometry(1.95, 2.05, 3, 12).translate(0, 9, 0);
  batch.add(band, assets.cloth(0xc8301f), new THREE.Matrix4().makeTranslation(470, 0, 470));
  const lamp = new THREE.CylinderGeometry(1.4, 1.4, 2, 10).translate(0, 23, 0);
  batch.add(lamp, assets.emissive(0xfff0c0, 12), new THREE.Matrix4().makeTranslation(470, 0, 470));
  const mole = new THREE.BoxGeometry(14, 3, 200).translate(0, -0.6, 0);
  batch.add(mole, assets.material('concrete-dark'), new THREE.Matrix4().makeTranslation(470, 0, 380));
}

export function buildCoast() {
  const batch = new MeshBatcher();
  buildHills(batch);
  buildBeach(batch);
  buildIslands(batch);
  const group = batch.build({ name: 'coast', castShadow: true });
  const sea = new Sea();
  group.add(sea.mesh);
  void HARBOR_EDGE_X;
  return { group, sea };
}
