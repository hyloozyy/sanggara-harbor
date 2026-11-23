// Hand-placed landmarks: the Alun-Alun town square of Kota Lama with its great domed hall,
// slender towers, a colonial clock tower, giant banyan trees and a fountain.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { CURB_HEIGHT } from './city-layout.js';
import { facadeBoxGeometry, domeGeometry, hipRoofGeometry } from './building-geometry.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);

function put(batch, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  batch.add(geo, mat, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)));
}

export function buildAlunAlun(block, collision) {
  const batch = new MeshBatcher();
  const { cx, cz, lot } = block;
  const plaster = assets.material('white-plaster');
  const y0 = CURB_HEIGHT;

  // Domed hall on the north side of the square.
  const hx = cx, hz = lot.minZ + 14;
  const hall = facadeBoxGeometry(26, 11, 20, 3.4, 3.6, 0, 0);
  batch.add(hall, assets.facadeMaterial('colonial', 0), new THREE.Matrix4().makeTranslation(hx, y0, hz));
  put(batch, BOX, plaster, hx, y0 + 11.4, hz, 27, 0.8, 21);
  put(batch, CYL, plaster, hx, y0 + 13.5, hz, 12, 4, 12);
  put(batch, domeGeometry(1), assets.material('dome-green'), hx, y0 + 15.4, hz, 7.5, 9, 7.5);
  put(batch, CYL, assets.material('dome-gold'), hx, y0 + 25, hz, 0.25, 2.2, 0.25);
  put(batch, new THREE.SphereGeometry(0.5, 10, 8), assets.material('dome-gold'), hx, y0 + 26.3, hz, 0.8, 0.8, 0.8);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    put(batch, domeGeometry(1), assets.material('dome-green'), hx + sx * 11, y0 + 11.8, hz + sz * 8, 2.4, 2.6, 2.4);
  }
  // Two slender towers with balconies and small domes.
  for (const sx of [-1, 1]) {
    const tx = hx + sx * 17, tz = hz + 6;
    put(batch, CYL, plaster, tx, y0 + 13, tz, 2.6, 26, 2.6);
    put(batch, CYL, plaster, tx, y0 + 20, tz, 3.6, 0.8, 3.6);
    put(batch, CYL, assets.emissive(0x7fffd0, 3), tx, y0 + 20.6, tz, 2.9, 0.25, 2.9);
    put(batch, domeGeometry(1), assets.material('dome-green'), tx, y0 + 26, tz, 1.5, 2.4, 1.5);
    collision.addCenteredBox(tx, tz, 2.6, 2.6, 30);
  }
  collision.addCenteredBox(hx, hz, 26, 20, 14);

  // Colonial clock tower on the south side.
  const ctx_ = cx + 18, ctz = lot.maxZ - 10;
  batch.add(facadeBoxGeometry(6, 18, 6, 3, 3.6, 0.2, 0), assets.facadeMaterial('colonial', 1), new THREE.Matrix4().makeTranslation(ctx_, y0, ctz));
  batch.add(hipRoofGeometry(6.4, 6.4, 5), assets.material('clay-roof'), new THREE.Matrix4().makeTranslation(ctx_, y0 + 18, ctz));
  for (const [ox, oz, ry] of [[0, 3.05, 0], [0, -3.05, Math.PI], [3.05, 0, Math.PI / 2], [-3.05, 0, -Math.PI / 2]]) {
    const face = new THREE.CircleGeometry(1.5, 24);
    batch.add(face, assets.emissive(0xfff4d8, 2.2), new THREE.Matrix4().compose(new THREE.Vector3(ctx_ + ox, y0 + 15, ctz + oz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
  }
  collision.addCenteredBox(ctx_, ctz, 6, 6, 23);

  // Fountain in the middle.
  put(batch, CYL, assets.material('concrete'), cx, y0 + 0.4, cz + 6, 12, 0.8, 12);
  put(batch, CYL, assets.material('pool'), cx, y0 + 0.82, cz + 6, 11, 0.05, 11);
  put(batch, CYL, assets.material('concrete'), cx, y0 + 2, cz + 6, 1.2, 3.2, 1.2);
  collision.addCenteredBox(cx, cz + 6, 11, 11, 1);

  // Twin banyan trees (beringin) with wide canopies.
  const canopy = new THREE.IcosahedronGeometry(1, 2);
  for (const sx of [-1, 1]) {
    const bx = cx + sx * 20, bz = cz + 10;
    put(batch, CYL, assets.material('trunk'), bx, y0 + 3, bz, 1.6, 6, 1.6);
    put(batch, canopy, assets.material('leaves'), bx, y0 + 8, bz, 9, 4.5, 9);
    put(batch, canopy, assets.material('leaves'), bx + 3, y0 + 9.5, bz - 2, 6, 3.5, 6);
    collision.addCenteredBox(bx, bz, 1.6, 1.6, 6);
  }
  // Benches.
  for (let i = 0; i < 8; i++) put(batch, BOX, assets.material('wood'), cx - 24 + i * 7, y0 + 0.45, cz + 22, 2.2, 0.15, 0.6);

  const group = batch.build({ name: 'alun-alun' });
  return group;
}

// Menara Sanggara: the tallest tower in the city, stepping back in three tiers to a lit crown and
// a spire with an aircraft beacon — the skyline's signature.
export function buildMenaraSanggara(block, collision) {
  const batch = new MeshBatcher();
  const { cx, cz } = block;
  const glass = assets.facadeMaterial('glass', 0);
  const y0 = CURB_HEIGHT;
  // Podium with shopfront glow.
  put(batch, BOX, assets.material('concrete'), cx, y0 + 6, cz, 58, 12, 58);
  batch.add(facadeBoxGeometry(56, 12, 56, 3.4, 4, 0.1, 0.25), assets.facadeMaterial('office', 1), new THREE.Matrix4().makeTranslation(cx, y0, cz));
  const tiers = [[34, 90], [27, 60], [19, 40]];
  let y = y0 + 12;
  tiers.forEach(([w, h], i) => {
    batch.add(facadeBoxGeometry(w, h, w, 3.4, 3.8, i * 0.3, 0), glass, new THREE.Matrix4().makeTranslation(cx, y, cz));
    put(batch, BOX, assets.material('metal-dark'), cx, y + h, cz, w + 1.2, 1.2, w + 1.2);
    const band = assets.emissive(i === 2 ? 0x6fe3ff : 0xffc070, 6);
    for (const [ox, oz, sx, sz] of [[0, w / 2 + 0.7, w + 1.4, 0.2], [0, -w / 2 - 0.7, w + 1.4, 0.2], [w / 2 + 0.7, 0, 0.2, w + 1.4], [-w / 2 - 0.7, 0, 0.2, w + 1.4]]) {
      put(batch, BOX, band, cx + ox, y + h + 0.2, cz + oz, sx, 0.35, sz);
    }
    y += h + 1.2;
  });
  // Crown lantern and spire.
  put(batch, CYL, assets.emissive(0x9ff0ff, 4), cx, y + 5, cz, 12, 10, 12);
  put(batch, CYL, assets.material('metal-dark'), cx, y + 10.5, cz, 13, 1, 13);
  put(batch, CYL, assets.material('chrome'), cx, y + 30, cz, 0.9, 40, 0.9);
  put(batch, new THREE.SphereGeometry(0.5, 8, 6), assets.emissive(0xff2a1a, 14), cx, y + 50.5, cz, 1.2, 1.2, 1.2);
  collision.addCenteredBox(cx, cz, 58, 58, 12);
  collision.addCenteredBox(cx, cz, 34, 34, y);
  return batch.build({ name: 'menara-sanggara' });
}
