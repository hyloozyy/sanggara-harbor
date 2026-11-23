// Streets: marked asphalt strips, intersections, zebra crossings, raised paver sidewalks with curbs,
// and the ground of each lot (grass, pavers or yard concrete depending on the district).
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { GRID, BLOCK_PITCH, ROAD_HALF, CURB_HEIGHT, BLOCKS } from './city-layout.js';

function stripGeometry(width, length, vRepeat) {
  const g = new THREE.PlaneGeometry(width, length);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i) * vRepeat);
  return g;
}

function tiledPlane(w, d, tile) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  return g;
}

export function buildRoads(groundStyleForBlock) {
  const batch = new MeshBatcher();
  const roadMat = assets.material('road');
  const asphaltMat = assets.material('asphalt');
  const crossMat = assets.material('crosswalk');
  const m = new THREE.Matrix4();
  const segLen = BLOCK_PITCH - ROAD_HALF * 2;
  const segGeo = stripGeometry(ROAD_HALF * 2, segLen, segLen / 12);
  const crossGeo = new THREE.PlaneGeometry(ROAD_HALF * 2 - 1.2, 3.2).rotateX(-Math.PI / 2);
  const isecGeo = tiledPlane(ROAD_HALF * 2, ROAD_HALF * 2, 11);
  const first = GRID[0], last = GRID[GRID.length - 1];

  for (const g of GRID) {
    for (let k = 0; k < GRID.length - 1; k++) {
      const mid = GRID[k] + BLOCK_PITCH / 2;
      // North-south strip at x = g.
      m.makeTranslation(g, 0.02, mid);
      batch.add(segGeo, roadMat, m);
      // East-west strip at z = g (rotate so v runs along x).
      m.makeRotationY(Math.PI / 2).setPosition(mid, 0.02, g);
      batch.add(segGeo, roadMat, m);
    }
    for (const h of GRID) {
      m.makeTranslation(g, 0.021, h);
      batch.add(isecGeo, asphaltMat, m);
      // Zebra crossings on each approach that exists.
      const approaches = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [ax, az] of approaches) {
        const nx = g + ax * (ROAD_HALF + 2), nz = h + az * (ROAD_HALF + 2);
        if (nx < first - 1 || nx > last + 1 || nz < first - 1 || nz > last + 1) continue;
        m.makeRotationY(ax !== 0 ? Math.PI / 2 : 0).setPosition(nx, 0.035, nz);
        batch.add(crossGeo, crossMat, m);
      }
    }
  }

  // Sidewalk slabs with curbs, and lot ground inside them.
  const curbMat = assets.material('curb');
  const walkMat = assets.material('sidewalk');
  for (const b of BLOCKS) {
    const s = b.slab, w = s.maxX - s.minX, d = s.maxZ - s.minZ;
    m.makeTranslation(b.cx, CURB_HEIGHT, b.cz);
    batch.add(tiledPlane(w, d, 4), walkMat, m);
    const curb = new THREE.BoxGeometry(1, CURB_HEIGHT, 1);
    for (const [x, z, sx, sz] of [[b.cx, s.minZ, w, 0.25], [b.cx, s.maxZ, w, 0.25], [s.minX, b.cz, 0.25, d], [s.maxX, b.cz, 0.25, d]]) {
      m.compose(new THREE.Vector3(x, CURB_HEIGHT / 2, z), new THREE.Quaternion(), new THREE.Vector3(sx, 1, sz));
      batch.add(curb, curbMat, m);
    }
    const style = groundStyleForBlock(b);
    if (style) {
      const l = b.lot;
      m.makeTranslation(b.cx, CURB_HEIGHT + 0.012, b.cz);
      batch.add(tiledPlane(l.maxX - l.minX, l.maxZ - l.minZ, style === 'grass' ? 6 : 8), assets.material(style), m);
    }
  }

  // Ground under everything out to the coast and hills.
  const groundGeo = tiledPlane(752, 752, 14);
  m.makeTranslation(-4, 0, -4);
  batch.add(groundGeo, asphaltMat, m);

  const group = batch.build({ castShadow: false, receiveShadow: true, name: 'roads' });
  return group;
}
