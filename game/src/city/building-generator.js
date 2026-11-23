// Fills every block with district-appropriate architecture: glass towers downtown, colonial rows in
// Kota Lama, shophouses with shopfronts, beach hotels, warehouses, hillside villas with pools.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { MeshBatcher } from '../assets/mesh-batcher.js';
import { createRng } from '../core/rng.js';
import { CURB_HEIGHT } from './city-layout.js';
import { SHOP_PANEL_COUNT } from '../assets/signage-textures.js';
import {
  facadeBoxGeometry, roofCapGeometry, hipRoofGeometry, gableRoofGeometry, sawtoothRoofGeometry, unitBox, unitCylinder,
} from './building-geometry.js';

const rng = createRng(1945);
const BOX = unitBox();
const CYL = unitCylinder(14);
const tmp = new THREE.Matrix4();
const q = new THREE.Quaternion();
const yAxis = new THREE.Vector3(0, 1, 0);

function put(batch, geo, mat, x, y, z, sx, sy, sz, rot = 0) {
  q.setFromAxisAngle(yAxis, rot);
  tmp.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  batch.add(geo, mat, tmp);
}

// Shopfront strip on one side of a building: picks atlas panels so neighbours differ.
function shopfront(batch, x, z, w, side, height = 4.4) {
  const mat = assets.material('shopfront');
  const panels = Math.max(1, Math.round(w / 7));
  const pw = w / panels;
  for (let p = 0; p < panels; p++) {
    const idx = rng.int(0, SHOP_PANEL_COUNT - 1);
    const u0 = (idx % 4) / 4, v0 = 1 - (Math.floor(idx / 4) + 1) / 2;
    const g = new THREE.PlaneGeometry(pw, height);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / 4, v0 + uv.getY(i) / 2);
    const off = -w / 2 + pw * (p + 0.5);
    const rot = side;
    const dx = Math.sin(rot) * off, dz = Math.cos(rot) * off;
    // side is the outward facing angle; panels run perpendicular to it
    const px = x + Math.cos(rot) * off, pz = z - Math.sin(rot) * off;
    q.setFromAxisAngle(yAxis, rot);
    tmp.compose(new THREE.Vector3(px, CURB_HEIGHT + height / 2, pz), q, new THREE.Vector3(1, 1, 1));
    batch.add(g, mat, tmp);
    void dx; void dz;
  }
}

// One rectangular building with optional shopfronts on the sides that face streets.
function building(batch, collision, spec) {
  const { x, z, w, d, h, style, palette, roof = 'flat', shops = [], tanks = true } = spec;
  const mat = assets.facadeMaterial(style, palette);
  const floorH = style === 'warehouse' ? 4.5 : style === 'glass' ? 3.8 : 3.5;
  const geo = facadeBoxGeometry(w, h, d, style === 'warehouse' ? 4 : 3.4, floorH, rng.next(), rng.int(0, 7) / 8);
  tmp.makeTranslation(x, CURB_HEIGHT, z);
  batch.add(geo, mat, tmp);
  const top = CURB_HEIGHT + h;
  if (roof === 'flat') {
    tmp.makeTranslation(x, top, z);
    batch.add(roofCapGeometry(w, d), assets.material('roof'), tmp);
    // Parapet.
    const pm = assets.material('concrete');
    put(batch, BOX, pm, x, top + 0.45, z - d / 2 + 0.15, w, 0.9, 0.3);
    put(batch, BOX, pm, x, top + 0.45, z + d / 2 - 0.15, w, 0.9, 0.3);
    put(batch, BOX, pm, x - w / 2 + 0.15, top + 0.45, z, 0.3, 0.9, d);
    put(batch, BOX, pm, x + w / 2 - 0.15, top + 0.45, z, 0.3, 0.9, d);
    if (tanks) rooftopClutter(batch, x, top, z, w, d, h);
  } else if (roof === 'hip') {
    tmp.makeTranslation(x, top, z);
    batch.add(hipRoofGeometry(w, d, Math.min(w, d) * 0.32), assets.material('clay-roof'), tmp);
  } else if (roof === 'gable') {
    tmp.makeTranslation(x, top, z);
    batch.add(gableRoofGeometry(w, d, Math.min(w, d) * 0.3), assets.material(style === 'warehouse' ? 'corrugated' : 'clay-roof'), tmp);
  } else if (roof === 'sawtooth') {
    tmp.makeTranslation(x, top, z);
    batch.add(sawtoothRoofGeometry(w, d, 3, Math.max(2, Math.round(d / 8))), assets.material('corrugated'), tmp);
  }
  for (const side of shops) {
    const len = side === 0 || side === Math.PI ? w : d;
    const ox = Math.sin(side) * ((side === 0 || side === Math.PI ? d : w) / 2 + 0.06);
    const oz = Math.cos(side) * ((side === 0 || side === Math.PI ? d : w) / 2 + 0.06);
    shopfront(batch, x + ox, z + oz, len - 0.6, side);
  }
  collision.addCenteredBox(x, z, w, d, h + CURB_HEIGHT);
}

// Water tanks (toren), AC units, antennas: the skyline detail of the city.
function rooftopClutter(batch, x, top, z, w, d, h) {
  const tankMats = [assets.cloth(0x2f6fb5), assets.cloth(0xe08a2a), assets.cloth(0xd8d4c8)];
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const tx = x + rng.range(-w / 2 + 2, w / 2 - 2), tz = z + rng.range(-d / 2 + 2, d / 2 - 2);
    put(batch, BOX, assets.material('metal-dark'), tx, top + 0.6, tz, 1.8, 1.2, 1.8);
    put(batch, CYL, rng.pick(tankMats), tx, top + 2.0, tz, 1.5, 1.8, 1.5);
  }
  for (let i = 0; i < rng.int(1, 4); i++) {
    put(batch, BOX, assets.material('metal-paint-white'), x + rng.range(-w / 2 + 1.5, w / 2 - 1.5), top + 0.5, z + rng.range(-d / 2 + 1.5, d / 2 - 1.5), 1.2, 0.9, 0.8);
  }
  if (h > 30 && rng.chance(0.6)) {
    put(batch, CYL, assets.material('metal-dark'), x + w * 0.2, top + 6, z - d * 0.2, 0.25, 12, 0.25);
    put(batch, BOX, assets.emissive(0xff2a1a, 8), x + w * 0.2, top + 12.2, z - d * 0.2, 0.5, 0.5, 0.5);
  }
}

function towerCrown(batch, x, top, z, w, d) {
  const color = rng.pick([0xffb347, 0x6fe3ff, 0xff6fb0, 0xfff1c0]);
  const m = assets.emissive(color, 5);
  put(batch, BOX, m, x, top + 0.95, z - d / 2 - 0.05, w + 0.2, 0.25, 0.2);
  put(batch, BOX, m, x, top + 0.95, z + d / 2 + 0.05, w + 0.2, 0.25, 0.2);
  put(batch, BOX, m, x - w / 2 - 0.05, top + 0.95, z, 0.2, 0.25, d + 0.2);
  put(batch, BOX, m, x + w / 2 + 0.05, top + 0.95, z, 0.2, 0.25, d + 0.2);
}

// Which sides of a lot face a street (angles: 0 = +z/south, PI/2 = +x/east, PI = north, -PI/2 = west).
function facingSides(bx, bz, block, w, d) {
  const l = block.lot, sides = [];
  if (bz + d / 2 > l.maxZ - 3) sides.push(0);
  if (bz - d / 2 < l.minZ + 3) sides.push(Math.PI);
  if (bx + w / 2 > l.maxX - 3) sides.push(Math.PI / 2);
  if (bx - w / 2 < l.minX + 3) sides.push(-Math.PI / 2);
  return sides;
}

const GENERATORS = {
  'pusat-niaga'(batch, col, block) {
    const l = block.lot, W = l.maxX - l.minX;
    if (rng.chance(0.4)) {
      // Podium + one landmark tower.
      put(batch, BOX, assets.material('concrete'), block.cx, CURB_HEIGHT + 5, block.cz, W - 4, 10, W - 4);
      col.addCenteredBox(block.cx, block.cz, W - 4, W - 4, 10);
      for (const s of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
        const ox = Math.sin(s) * ((W - 4) / 2 + 0.06), oz = Math.cos(s) * ((W - 4) / 2 + 0.06);
        shopfront(batch, block.cx + ox, block.cz + oz, W - 6, s, 5);
      }
      const tw = rng.range(26, 34), th = rng.range(70, 135);
      const style = rng.chance(0.65) ? 'glass' : 'office';
      const pal = rng.int(0, 3);
      const mat = assets.facadeMaterial(style, pal);
      tmp.makeTranslation(block.cx, CURB_HEIGHT + 10, block.cz);
      batch.add(facadeBoxGeometry(tw, th, tw, 3.4, 3.8, rng.next(), 0), mat, tmp);
      tmp.makeTranslation(block.cx, CURB_HEIGHT + 10 + th, block.cz);
      batch.add(roofCapGeometry(tw, tw), assets.material('roof'), tmp);
      towerCrown(batch, block.cx, CURB_HEIGHT + 10 + th - 1, block.cz, tw, tw);
      // Setback crown.
      const cw = tw * 0.6;
      tmp.makeTranslation(block.cx, CURB_HEIGHT + 10 + th, block.cz);
      batch.add(facadeBoxGeometry(cw, 8, cw, 3.4, 3.8, 0.2, 0.5), mat, tmp);
      rooftopClutter(batch, block.cx, CURB_HEIGHT + 18 + th, block.cz, cw, cw, th);
      tmp.makeTranslation(block.cx, CURB_HEIGHT + 18 + th, block.cz);
      batch.add(roofCapGeometry(cw, cw), assets.material('roof'), tmp);
      col.addCenteredBox(block.cx, block.cz, tw, tw, th + 18);
      return;
    }
    const half = (W - 6) / 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const w = rng.range(half * 0.7, half), d = rng.range(half * 0.7, half);
      const x = block.cx + sx * (W / 4 + 0.5) + rng.range(-1, 1), z = block.cz + sz * (W / 4 + 0.5);
      const h = rng.range(22, 75);
      const style = rng.pick(['glass', 'office', 'office', 'apartment', 'glass']);
      building(batch, col, { x, z, w, d, h, style, palette: rng.int(0, 3), shops: style !== 'glass' ? facingSides(x, z, block, w, d) : [] });
      if (style === 'glass') towerCrown(batch, x, CURB_HEIGHT + h - 1, z, w, d);
    }
  },

  'kota-lama'(batch, col, block) {
    const l = block.lot;
    if (block.special) return;
    // Perimeter rows of colonial houses and shophouses around a leafy courtyard.
    const depth = 14;
    const rows = [
      { along: 'x', fixed: l.maxZ - depth / 2, side: 0 },
      { along: 'x', fixed: l.minZ + depth / 2, side: Math.PI },
      { along: 'z', fixed: l.maxX - depth / 2, side: Math.PI / 2 },
      { along: 'z', fixed: l.minX + depth / 2, side: -Math.PI / 2 },
    ];
    for (const r of rows) {
      const start = (r.along === 'x' ? l.minX : l.minZ) + (r.along === 'z' ? depth : 0);
      const end = (r.along === 'x' ? l.maxX : l.maxZ) - (r.along === 'z' ? depth : 0);
      let p = start;
      while (p < end - 4) {
        const len = Math.min(end - p, rng.range(9, 16));
        const mid = p + len / 2;
        const colonial = rng.chance(0.45);
        const h = colonial ? rng.range(8, 12) : rng.range(7.5, 14);
        const spec = {
          x: r.along === 'x' ? mid : r.fixed, z: r.along === 'x' ? r.fixed : mid,
          w: r.along === 'x' ? len - 0.3 : depth, d: r.along === 'x' ? depth : len - 0.3,
          h, style: colonial ? 'colonial' : 'ruko', palette: rng.int(0, 5),
          roof: colonial ? 'hip' : rng.chance(0.4) ? 'gable' : 'flat', shops: colonial && rng.chance(0.5) ? [] : [r.side],
        };
        building(batch, col, spec);
        p += len;
      }
    }
    courtyardTrees(batch, block, 3);
  },

  'pantai-senja'(batch, col, block) {
    const l = block.lot, W = l.maxX - l.minX;
    const seaSide = block.j === 7;
    if (seaSide) {
      // Beach hotels with balconies facing the sea, plus a low cafe row.
      for (const sx of [-1, 1]) {
        const w = rng.range(20, 26), d = 16, h = rng.range(22, 46);
        const x = block.cx + sx * W / 4, z = l.maxZ - d / 2 - 2;
        building(batch, col, { x, z, w, d, h, style: 'apartment', palette: rng.int(0, 2), shops: [0] });
        towerCrown(batch, x, CURB_HEIGHT + h - 1, z, w, d);
      }
      for (const sx of [-1, 1]) {
        building(batch, col, { x: block.cx + sx * W / 4, z: l.minZ + 7, w: 22, d: 12, h: 7.5, style: 'ruko', palette: rng.int(0, 5), roof: 'gable', shops: [Math.PI] });
      }
    } else {
      GENERATORS['kota-lama'](batch, col, block);
    }
  },

  'pasar-ikan'(batch, col, block) {
    const l = block.lot, W = l.maxX - l.minX;
    if (rng.chance(0.5)) {
      // Covered fish market hall: open sides, columns, corrugated roof.
      const w = W - 8, d = W * 0.55;
      const z = block.cz - W * 0.15;
      for (let i = 0; i <= 6; i++) for (const s of [-1, 1]) {
        put(batch, BOX, assets.material('metal-paint-white'), block.cx - w / 2 + (w / 6) * i, CURB_HEIGHT + 3.5, z + s * d / 2, 0.5, 7, 0.5);
      }
      tmp.makeTranslation(block.cx, CURB_HEIGHT + 7, z);
      batch.add(gableRoofGeometry(w, d, 4), assets.material('corrugated'), tmp);
      // Market stalls with tarps.
      for (let i = 0; i < 10; i++) {
        const sx = block.cx + rng.range(-w / 2 + 3, w / 2 - 3), sz = z + rng.range(-d / 2 + 3, d / 2 - 3);
        put(batch, BOX, assets.material('wood'), sx, CURB_HEIGHT + 0.5, sz, 3, 1, 1.6);
        put(batch, BOX, assets.cloth(rng.pick([0x2a7fd4, 0xe05a2a, 0x2aa05a, 0xe0c02a])), sx, CURB_HEIGHT + 2.4, sz, 3.4, 0.08, 2);
        put(batch, BOX, assets.cloth(0xb8c6cc), sx, CURB_HEIGHT + 1.1, sz, 2.6, 0.2, 1.2);
      }
      col.addCenteredBox(block.cx, z, w, 0.6, 7, 'pillars');
      building(batch, col, { x: block.cx, z: l.maxZ - 8, w: W - 6, d: 14, h: rng.range(8, 11), style: 'ruko', palette: rng.int(0, 5), shops: [0] });
    } else {
      building(batch, col, { x: block.cx - W / 4, z: block.cz, w: W / 2 - 4, d: W - 6, h: rng.range(9, 13), style: 'warehouse', palette: rng.int(0, 2), roof: 'gable', tanks: false });
      building(batch, col, { x: block.cx + W / 4, z: block.cz - W / 4, w: W / 2 - 4, d: W / 2 - 4, h: rng.range(10, 20), style: 'ruko', palette: rng.int(0, 5), shops: facingSides(block.cx + W / 4, block.cz - W / 4, block, W / 2 - 4, W / 2 - 4) });
      building(batch, col, { x: block.cx + W / 4, z: block.cz + W / 4, w: W / 2 - 4, d: W / 2 - 4, h: rng.range(8, 16), style: 'apartment', palette: rng.int(0, 2), shops: facingSides(block.cx + W / 4, block.cz + W / 4, block, W / 2 - 4, W / 2 - 4) });
    }
  },

  'kawasan-industri'(batch, col, block) {
    const l = block.lot, W = l.maxX - l.minX;
    building(batch, col, { x: block.cx - 8, z: block.cz - 6, w: W - 24, d: W - 22, h: rng.range(9, 14), style: 'warehouse', palette: rng.int(0, 2), roof: 'sawtooth', tanks: false });
    // Storage tanks and a chimney.
    const tx = l.maxX - 7, tz = l.maxZ - 7;
    for (let i = 0; i < 2; i++) {
      put(batch, CYL, assets.material('metal-paint-white'), tx, CURB_HEIGHT + 5, tz - i * 13, 10, 10, 10);
      col.addCenteredBox(tx, tz - i * 13, 9, 9, 10);
    }
    if (rng.chance(0.6)) {
      const cx = l.minX + 5, cz = l.maxZ - 5;
      put(batch, CYL, assets.material('concrete-dark'), cx, CURB_HEIGHT + 17, cz, 3, 34, 3);
      put(batch, CYL, assets.cloth(0xb02a1a), cx, CURB_HEIGHT + 31, cz, 3.1, 2, 3.1);
      put(batch, BOX, assets.emissive(0xff2a1a, 8), cx, CURB_HEIGHT + 34.3, cz, 0.5, 0.5, 0.5);
      col.addCenteredBox(cx, cz, 3, 3, 34);
      block.chimney = { x: cx, z: cz, top: 34 };
    }
    // Yard clutter: pallets and drums.
    for (let i = 0; i < 6; i++) {
      put(batch, CYL, assets.cloth(rng.pick([0x2a5fa0, 0xa02a2a, 0x3a3a3a])), l.minX + 4 + i * 1.2, CURB_HEIGHT + 0.5, l.minZ + 3, 0.9, 1, 0.9);
    }
  },

  'bukit-hijau'(batch, col, block) {
    const l = block.lot, W = l.maxX - l.minX;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (rng.chance(0.15)) continue;
      const x = block.cx + sx * W / 4, z = block.cz + sz * W / 4;
      const w = rng.range(12, 17), d = rng.range(10, 14), h = rng.range(6.5, 9);
      building(batch, col, { x, z, w, d, h, style: 'villa', palette: rng.int(0, 1), roof: rng.chance(0.6) ? 'hip' : 'flat', tanks: false });
      // Pool and garden wall.
      const px = x + sx * -1 * 0, pz = z - sz * (d / 2 + 5);
      put(batch, BOX, assets.material('pool'), px, CURB_HEIGHT + 0.06, pz, w * 0.6, 0.1, 4);
      put(batch, BOX, assets.material('white-plaster'), px, CURB_HEIGHT + 0.12, pz, w * 0.6 + 1, 0.12, 5);
    }
    courtyardTrees(batch, block, 6);
  },
};

const treeGeo = assets.geometry('tree-canopy', () => new THREE.IcosahedronGeometry(1, 1));
function courtyardTrees(batch, block, count) {
  const l = block.lot;
  for (let i = 0; i < count; i++) {
    const x = block.cx + rng.range(-8, 8), z = block.cz + rng.range(-8, 8);
    const s = rng.range(2.6, 4.2);
    put(batch, CYL, assets.material('trunk'), x, CURB_HEIGHT + s * 0.8, z, 0.5, s * 1.6, 0.5);
    put(batch, treeGeo, assets.material('leaves'), x, CURB_HEIGHT + s * 1.9, z, s, s * 0.85, s);
  }
  void l;
}

// Builds all blocks, chunked 2x2 so frustum culling skips whole neighbourhoods.
export function buildBuildings(blocks, collision, specialBlocks = new Set()) {
  const group = new THREE.Group();
  group.name = 'buildings';
  const chunks = new Map();
  for (const block of blocks) {
    const key = `${block.i >> 1}:${block.j >> 1}`;
    if (!chunks.has(key)) chunks.set(key, new MeshBatcher());
    if (specialBlocks.has(`${block.i},${block.j}`)) block.special = true;
    const gen = GENERATORS[block.district];
    if (gen && !block.special) gen(chunks.get(key), collision, block);
  }
  for (const [key, batch] of chunks) group.add(batch.build({ name: 'chunk-' + key }));
  return group;
}
