// Street furniture, instanced: sodium street lamps, traffic signals, palms on the boulevard,
// shade trees, power poles with sagging cables, billboards and neon signs.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { mergeGeometries } from '../assets/mesh-batcher.js';
import { createRng } from '../core/rng.js';
import { palmVariant, treeVariant } from './vegetation-geometry.js';
import { GRID, ROAD_HALF, CURB_HEIGHT, BLOCK_PITCH, districtAt } from './city-layout.js';

const rng = createRng(808);

function instanced(geometry, material, transforms, { castShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  transforms.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot || 0);
    s.setScalar(t.scale || 1);
    p.set(t.x, t.y || 0, t.z);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function lampGeometries() {
  const pole = new THREE.CylinderGeometry(0.09, 0.14, 8, 8).translate(0, 4, 0);
  const arm = new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6).rotateZ(Math.PI / 2).translate(1.0, 7.9, 0);
  const housing = new THREE.BoxGeometry(0.9, 0.18, 0.4).translate(2.0, 7.85, 0);
  const glow = new THREE.BoxGeometry(0.7, 0.06, 0.3).translate(2.0, 7.74, 0);
  return {
    pole: mergeGeometries([pole, arm, housing].map((geometry) => ({ geometry, matrix: new THREE.Matrix4() }))),
    glow,
  };
}

export class TrafficSignals {
  constructor() {
    this.phase = 0;            // 0: north-south green, 1: east-west green
    this.timer = 0;
    this.cycle = 14;
    this.mats = {
      nsRed: assets.material('traffic-red').clone(), nsGreen: assets.material('traffic-green').clone(),
      ewRed: assets.material('traffic-red').clone(), ewGreen: assets.material('traffic-green').clone(),
    };
    this.apply();
  }

  // True when traffic moving along the given axis ('ns' or 'ew') may enter intersections.
  isGreen(axis) {
    const amber = this.timer > this.cycle - 2.5;
    return !amber && ((axis === 'ns') === (this.phase === 0));
  }

  update(dt) {
    this.timer += dt;
    if (this.timer >= this.cycle) { this.timer = 0; this.phase = 1 - this.phase; this.apply(); }
  }

  apply() {
    const on = (m, v) => { m.emissiveIntensity = v ? 6 : 0.05; };
    on(this.mats.nsGreen, this.phase === 0); on(this.mats.nsRed, this.phase !== 0);
    on(this.mats.ewGreen, this.phase === 1); on(this.mats.ewRed, this.phase !== 1);
  }
}

export function buildStreetProps(collision) {
  const group = new THREE.Group();
  group.name = 'street-props';
  const lamps = [], palms = [], trees = [], poles = [];
  const edge = ROAD_HALF + 0.7;

  // Lamps along every road segment, alternating sides; palms on the beach boulevard, shade trees elsewhere.
  for (const g of GRID) {
    for (let k = 0; k < GRID.length - 1; k++) {
      for (let t = 14; t < BLOCK_PITCH - 10; t += 26) {
        const along = GRID[k] + t;
        for (const side of [-1, 1]) {
          const ns = { x: g + side * edge, z: along, rot: side > 0 ? Math.PI : 0 };
          const ew = { x: along, z: g + side * edge, rot: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
          for (const p of [ns, ew]) {
            const isNS = p === ns;
            if ((t / 26 + (side > 0 ? 1 : 0)) % 2 < 1) lamps.push({ ...p, y: CURB_HEIGHT });
            const pd = districtAt(p.x, p.z);
            const tx = isNS ? p.x + side * 1.4 : p.x + 9, tz = isNS ? p.z + 9 : p.z + side * 1.4;
            if (pd === 'pantai-senja' || (pd === 'bukit-hijau' && rng.chance(0.5))) {
              palms.push({ x: tx, y: CURB_HEIGHT, z: tz, rot: rng.range(0, Math.PI * 2), scale: rng.range(0.85, 1.2) });
            } else if (pd !== 'kawasan-industri' && pd !== 'pusat-niaga' && rng.chance(0.35)) {
              trees.push({ x: tx, y: CURB_HEIGHT, z: tz, rot: rng.range(0, 6), scale: rng.range(0.8, 1.15) });
            } else if (pd === 'pusat-niaga' && rng.chance(0.4)) {
              trees.push({ x: tx, y: CURB_HEIGHT, z: tz, rot: rng.range(0, 6), scale: rng.range(0.7, 0.9) });
            }
            if ((pd === 'kota-lama' || pd === 'pasar-ikan' || pd === 'kawasan-industri') && side > 0) poles.push({ ...p, ew: !isNS });
          }
        }
      }
    }
  }
  // Seafront palms along the beach.
  for (let x = -360; x < 320; x += 11) palms.push({ x: x + rng.range(-2, 2), y: 0.05, z: 333 + rng.range(0, 4), rot: rng.range(0, 6), scale: rng.range(0.9, 1.3) });

  const lamp = lampGeometries();
  group.add(instanced(lamp.pole, assets.material('lamp-pole'), lamps));
  group.add(instanced(lamp.glow, assets.material('lamp-glow'), lamps, { castShadow: false }));
  // Warm pools of sodium light on the pavement under each lamp head (additive decals).
  const poolGeo = new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2).translate(2.0, 0.05, 0);
  const poolMat = new THREE.MeshBasicMaterial({ map: assets.texture('glow'), color: 0xffa860, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  poolMat.userData.lampPool = true;
  const pools = instanced(poolGeo, poolMat, lamps, { castShadow: false });
  pools.receiveShadow = false;
  pools.renderOrder = 2;
  group.add(pools);
  // Three palm and three shade-tree variants, each instanced.
  for (let v = 0; v < 3; v++) {
    const ps = palms.filter((_, i) => i % 3 === v), ts = trees.filter((_, i) => i % 3 === v);
    const palm = assets.geometry(`palm-v${v}`, () => palmVariant(101 + v * 17));
    group.add(instanced(palm.trunk, assets.material('palm-trunk'), ps));
    group.add(instanced(palm.shank, assets.material('palm-trunk'), ps));
    group.add(instanced(palm.crown, assets.material('palm-crown'), ps));
    const tree = assets.geometry(`tree-v${v}`, () => treeVariant(203 + v * 31));
    group.add(instanced(tree.wood, assets.material('trunk'), ts));
    group.add(instanced(tree.leaves, assets.material(v === 1 ? 'leaf-card-warm' : 'leaf-card'), ts));
  }
  for (const p of [...lamps, ...palms, ...trees]) collision.addCenteredBox(p.x, p.z, 0.35, 0.35, 8, 'pole');

  // Traffic signals: one pole per approach corner, heads facing oncoming traffic.
  const signals = new TrafficSignals();
  const signalPoles = [], heads = { ns: [], ew: [] };
  for (const gx of GRID) for (const gz of GRID) {
    const c = ROAD_HALF + 0.8;
    for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const x = gx + sx * c, z = gz + sz * c;
      signalPoles.push({ x, y: CURB_HEIGHT, z });
      // Corner (+,+) and (-,-) face north-south traffic, the others east-west.
      const axis = sx === sz ? 'ns' : 'ew';
      const rot = axis === 'ns' ? (sz > 0 ? 0 : Math.PI) : (sx > 0 ? Math.PI / 2 : -Math.PI / 2);
      heads[axis].push({ x, y: CURB_HEIGHT, z, rot });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6).translate(0, 2.1, 0);
  const headGeo = new THREE.BoxGeometry(0.38, 1.0, 0.3).translate(0, 4.0, 0);
  const redGeo = new THREE.SphereGeometry(0.11, 8, 6).translate(0, 4.28, 0.16);
  const greenGeo = new THREE.SphereGeometry(0.11, 8, 6).translate(0, 3.72, 0.16);
  group.add(instanced(poleGeo, assets.material('lamp-pole'), signalPoles));
  group.add(instanced(headGeo, assets.material('metal-dark'), [...heads.ns, ...heads.ew]));
  group.add(instanced(redGeo, signals.mats.nsRed, heads.ns, { castShadow: false }));
  group.add(instanced(greenGeo, signals.mats.nsGreen, heads.ns, { castShadow: false }));
  group.add(instanced(redGeo, signals.mats.ewRed, heads.ew, { castShadow: false }));
  group.add(instanced(greenGeo, signals.mats.ewGreen, heads.ew, { castShadow: false }));

  // Wooden power poles with drooping cables: a familiar tangle over the old streets.
  const ppGeo = new THREE.CylinderGeometry(0.12, 0.16, 9, 6).translate(0, 4.5, 0);
  const crossGeo = new THREE.BoxGeometry(1.6, 0.12, 0.12).translate(0, 8.4, 0);
  group.add(instanced(mergeGeometries([ppGeo, crossGeo].map((geometry) => ({ geometry, matrix: new THREE.Matrix4() }))), assets.material('trunk'), poles));
  const cablePts = [];
  for (const p of poles) {
    for (const off of [-0.7, 0.7]) {
      const ax = p.x + (p.ew ? 0 : off), az = p.z + (p.ew ? off : 0);
      const bx = ax + (p.ew ? 26 : 0), bz = az + (p.ew ? 0 : 26);
      for (let i = 0; i < 8; i++) {
        const t0 = i / 8, t1 = (i + 1) / 8;
        const y0 = 8.4 - Math.sin(t0 * Math.PI) * 1.2, y1 = 8.4 - Math.sin(t1 * Math.PI) * 1.2;
        cablePts.push(ax + (bx - ax) * t0, y0, az + (bz - az) * t0, ax + (bx - ax) * t1, y1, az + (bz - az) * t1);
      }
    }
  }
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
  group.add(new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x111111 })));

  group.add(buildBillboardsAndNeon(collision));
  return { group, signals };
}

function buildBillboardsAndNeon(collision) {
  const group = new THREE.Group();
  const frameMat = assets.material('metal-dark');
  const boardMat = assets.material('billboard');
  const spots = [
    { x: -40, z: 243, rot: 0, h: 9 }, { x: 160 + 9, z: -40, rot: Math.PI / 2, h: 12 }, { x: -200, z: 90, rot: Math.PI / 2, h: 10 },
    { x: 280, z: 243, rot: 0, h: 9 }, { x: 40, z: -157, rot: Math.PI, h: 10 }, { x: 0 + 9, z: 300, rot: -Math.PI / 2, h: 9 },
  ];
  spots.forEach((s, i) => {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, s.h, 8), frameMat);
    post.position.y = s.h / 2; post.castShadow = true;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), boardMat);
    const idx = i % 4;
    const uv = board.geometry.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (idx % 2) / 2 + uv.getX(k) / 2, 1 - (Math.floor(idx / 2) + 1) / 2 + uv.getY(k) / 2);
    board.position.set(0, s.h + 3, 0.2);
    const back = new THREE.Mesh(new THREE.BoxGeometry(12.4, 6.4, 0.3), frameMat);
    back.position.set(0, s.h + 3, 0); back.castShadow = true;
    g.add(post, back, board);
    g.position.set(s.x, CURB_HEIGHT, s.z);
    g.rotation.y = s.rot;
    group.add(g);
    collision.addCenteredBox(s.x, s.z, 0.6, 0.6, s.h, 'pole');
  });
  const neon = [
    { text: 'HOTEL OMBAK', color: '#ff4fa0', x: -268, z: 296, rot: 0, y: 14 },
    { text: 'SEAFOOD 24 HOURS', color: '#4ff0ff', x: 205, z: 262, rot: Math.PI, y: 6 },
    { text: 'KARAOKE SENJA', color: '#c86bff', x: -110, z: 245, rot: Math.PI, y: 7 },
    { text: 'KOPI KAPAL', color: '#ffb347', x: 30, z: 166.5, rot: Math.PI, y: 5.6 },
    { text: 'LAUT DISCO', color: '#4f8bff', x: -58, z: 296, rot: 0, y: 12 },
    { text: 'DERMAGA BAR', color: '#ff6a3a', x: 270, z: 128, rot: Math.PI / 2, y: 6 },
  ];
  for (const n of neon) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), assets.neonMaterial(n.text, n.color));
    m.position.set(n.x, n.y, n.z);
    m.rotation.y = n.rot;
    group.add(m);
  }
  return group;
}
