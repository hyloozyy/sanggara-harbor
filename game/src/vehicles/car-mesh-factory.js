// Builds car meshes from side profiles: beveled extruded bodies with wheel arches, glass cabins with
// pillars and roof, glowing head/tail lights, bumpers, mirrors, turning and steering wheels,
// police light bars, taxi signs and the angkot's stripe and route board.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { makeCanvas, toTexture } from '../assets/canvas-tools.js';
import { mergeGeometries } from '../assets/mesh-batcher.js';

const PROFILES = {
  sedan: { tail: 0.86, deck: 0.96, nose: 0.72, cab: [-0.27, 0.17], rake: [0.58, 0.72], beltPad: 0 },
  hatch: { tail: 0.98, deck: 0.98, nose: 0.74, cab: [-0.47, 0.2], rake: [0.22, 0.7], beltPad: 0 },
  sports: { tail: 0.78, deck: 0.82, nose: 0.56, cab: [-0.3, 0.16], rake: [0.62, 0.58], beltPad: 0 },
  pickup: { tail: 1.0, deck: 1.05, nose: 0.92, cab: [-0.08, 0.2], rake: [0.06, 0.5], beltPad: 0, bed: true },
  minibus: { tail: 1.0, deck: 1.02, nose: 0.9, cab: [-0.48, 0.38], rake: [0.04, 0.42], beltPad: 0 },
  van: { tail: 1.05, deck: 1.08, nose: 0.95, cab: [-0.48, 0.36], rake: [0.04, 0.45], beltPad: 0 },
};

function bodyShape(L, p, wb, wr) {
  const s = new THREE.Shape();
  const bottom = 0.26, ra = wr + 0.07;
  s.moveTo(-L / 2, bottom);
  s.lineTo(-L / 2, p.tail - 0.12);
  s.quadraticCurveTo(-L / 2, p.tail, -L / 2 + 0.25, p.deck);
  s.lineTo(L / 2 - 0.45, p.deck - 0.05);
  s.quadraticCurveTo(L / 2 - 0.05, p.deck - 0.08, L / 2, p.nose);
  s.lineTo(L / 2, bottom);
  s.lineTo(wb / 2 + ra, bottom);
  s.absarc(wb / 2, wr, ra, 0, Math.PI, false);
  s.lineTo(-wb / 2 + ra, bottom);
  s.absarc(-wb / 2, wr, ra, 0, Math.PI, false);
  s.lineTo(-L / 2, bottom);
  return s;
}

function quadShape(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.lineTo(pts[0][0], pts[0][1]);
  return s;
}

// Extrude a side profile across the car's width; result has length along +z (front) and width along x.
function extrudeAcross(shape, width, bevel = 0.06) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 10,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  return m;
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(mat, sx, sy, sz, x, y, z, cast = false) {
  const m = mesh(boxGeo, mat, x, y, z, cast);
  m.scale.set(sx, sy, sz);
  return m;
}

let decalCache = null;
function decals() {
  if (decalCache) return decalCache;
  const mk = (text, bg, fg, w = 512, h = 96) => {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg; ctx.font = `bold ${Math.round(h * 0.62)}px "Trebuchet MS", "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 2);
    return toTexture(c, { repeat: false });
  };
  decalCache = {
    police: new THREE.MeshStandardMaterial({ map: mk('POLISI SANGGARA', '#1a3f9e', '#ffffff'), roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }),
    taxi: new THREE.MeshStandardMaterial({ map: mk('TAKSI', '#f2c230', '#1a1a1a', 256, 96), emissiveMap: mk('TAKSI', '#f2c230', '#1a1a1a', 256, 96), emissive: 0xffffff, emissiveIntensity: 1.6 }),
    angkot: new THREE.MeshStandardMaterial({ map: mk('04  KOTA LAMA - PASAR IKAN', '#101010', '#ffd24a'), emissiveMap: mk('04  KOTA LAMA - PASAR IKAN', '#101010', '#ffd24a'), emissive: 0xffffff, emissiveIntensity: 1.2 }),
    plate: new THREE.MeshStandardMaterial({ map: mk('SG 4417 RK', '#111111', '#f0f0f0', 256, 64), roughness: 0.5 }),
  };
  return decalCache;
}

// Bake the body's static parts into one mesh per material (lights and sirens stay separate
// because their materials change at run time).
function mergeStaticParts(body, keep) {
  const buckets = new Map();
  for (const child of [...body.children]) {
    if (!child.isMesh || keep.has(child)) continue;
    child.updateMatrix();
    if (!buckets.has(child.material)) buckets.set(child.material, []);
    buckets.get(child.material).push({ geometry: child.geometry, matrix: child.matrix.clone(), cast: child.castShadow });
    body.remove(child);
  }
  for (const [material, list] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(list), material);
    m.castShadow = list.some((p) => p.cast);
    m.receiveShadow = true;
    body.add(m);
  }
}

function makeWheel(spec, front, x, z) {
  const r = spec.wheelRadius, w = spec.twoWheel ? 0.12 : 0.24;
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  const spin = new THREE.Group();
  pivot.add(spin);
  const tire = assets.geometry(`tire:${r}:${w}`, () => new THREE.CylinderGeometry(r, r, w, 18).rotateZ(Math.PI / 2));
  const rim = assets.geometry(`rim:${r}:${w}`, () => new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12).rotateZ(Math.PI / 2));
  const spoke = assets.geometry(`spoke:${r}:${w}`, () => new THREE.BoxGeometry(w + 0.04, r * 1.1, 0.07));
  spin.add(mesh(tire, assets.material('rubber')));
  // Rim and spokes share one merged geometry so a wheel costs two draw calls.
  const hub = assets.geometry(`hub:${r}:${w}`, () => mergeGeometries([
    { geometry: rim, matrix: new THREE.Matrix4() },
    ...[0, 1, 2].map((i) => ({ geometry: spoke, matrix: new THREE.Matrix4().makeRotationX((i / 3) * Math.PI) })),
  ]));
  spin.add(mesh(hub, assets.material('rim'), 0, 0, 0, false));
  return { pivot, spin, front, x, z };
}

function buildScooter(spec, color) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = assets.carPaint(color);
  const L = spec.length;
  body.add(box(paint, 0.42, 0.42, 0.9, 0, 0.62, -0.35, true));      // rear body cowl
  body.add(box(assets.material('rubber'), 0.34, 0.12, 0.7, 0, 0.9, -0.3, true)); // seat
  body.add(box(assets.material('metal-dark'), 0.3, 0.12, 0.6, 0, 0.36, 0.15));   // footboard
  const fork = box(paint, 0.3, 0.75, 0.22, 0, 0.75, 0.6, true);
  fork.rotation.x = -0.35; body.add(fork);
  body.add(box(assets.material('chrome'), 0.75, 0.05, 0.05, 0, 1.12, 0.48));     // handlebar
  body.add(box(assets.material('headlight'), 0.14, 0.1, 0.06, 0, 1.0, 0.74));
  body.add(box(assets.material('taillight'), 0.18, 0.06, 0.05, 0, 0.78, -0.82));
  mergeStaticParts(body, new Set());
  const wheels = [makeWheel(spec, true, 0, L / 2 - 0.3), makeWheel(spec, false, 0, -L / 2 + 0.3)];
  for (const w of wheels) root.add(w.pivot);
  return { root, body, wheels, seat: new THREE.Vector3(0, 0.62, -0.25), sirens: null, brakeMeshes: [], headMeshes: [] };
}

export function buildVehicleMesh(spec, color) {
  if (spec.body === 'scooter') return buildScooter(spec, color);
  const p = PROFILES[spec.body];
  const L = spec.length, W = spec.width, H = spec.height, wb = spec.wheelbase, wr = spec.wheelRadius;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = assets.carPaint(color);
  const lower = mesh(assets.geometry(`body:${spec.body}:${L}:${W}`, () => extrudeAcross(bodyShape(L, p, wb, wr), W, 0.07)), paint);
  lower.receiveShadow = true;
  body.add(lower);

  // Glass greenhouse, roof slab and pillars.
  const x0 = L * p.cab[0], x1 = L * p.cab[1];
  const belt = p.deck - 0.02, roofY = H;
  const [rr, rf] = p.rake;
  const cabin = quadShape([[x0, belt], [x1, belt], [x1 - rf, roofY - 0.04], [x0 + rr, roofY - 0.04]]);
  body.add(mesh(assets.geometry(`cab:${spec.body}:${L}:${W}`, () => extrudeAcross(cabin, W * 0.86, 0.03)), assets.material('glass-dark')));
  const roof = quadShape([[x0 + rr - 0.04, roofY - 0.07], [x1 - rf + 0.04, roofY - 0.07], [x1 - rf, roofY], [x0 + rr, roofY]]);
  body.add(mesh(assets.geometry(`roof:${spec.body}:${L}:${W}`, () => extrudeAcross(roof, W * 0.88, 0.03)), paint));
  const ph = roofY - belt;
  // Window pillars: a thin post on each side, leaning with the glass.
  const pillar = (x, angle) => {
    for (const sx of [-1, 1]) {
      const m = box(paint, 0.07, Math.hypot(ph, Math.tan(angle) * ph) * 1.02, 0.1, sx * W * 0.425, belt + ph / 2, x);
      m.rotation.x = angle;
      body.add(m);
    }
  };
  pillar(x1 - rf / 2, -Math.atan2(rf, ph));
  pillar(x0 + rr / 2, Math.atan2(rr, ph));
  const midCount = spec.body === 'minibus' || spec.body === 'van' ? 3 : spec.body === 'pickup' ? 0 : 1;
  for (let i = 1; i <= midCount; i++) pillar(x0 + rr + ((x1 - rf) - (x0 + rr)) * (i / (midCount + 1)), 0);

  if (p.bed) {
    const bx0 = -L / 2 + 0.1, bx1 = x0 - 0.12, bl = bx1 - bx0;
    body.add(box(paint, W - 0.04, 0.45, 0.08, 0, p.deck + 0.2, bx0 + 0.04, true));
    body.add(box(paint, 0.08, 0.45, bl, W / 2 - 0.06, p.deck + 0.2, bx0 + bl / 2, true));
    body.add(box(paint, 0.08, 0.45, bl, -W / 2 + 0.06, p.deck + 0.2, bx0 + bl / 2, true));
    body.add(box(assets.material('metal-dark'), W - 0.2, 0.05, bl, 0, p.deck + 0.01, bx0 + bl / 2));
  }

  // Bumpers, grille, mirrors, plates.
  const dark = assets.material('metal-dark');
  body.add(box(dark, W * 0.98, 0.2, 0.18, 0, 0.36, L / 2 + 0.02));
  body.add(box(dark, W * 0.98, 0.2, 0.18, 0, 0.36, -L / 2 - 0.02));
  body.add(box(assets.material('rubber'), W * 0.42, 0.14, 0.05, 0, p.nose - 0.16, L / 2 + 0.01));
  for (const s of [-1, 1]) body.add(box(paint, 0.16, 0.1, 0.12, s * (W / 2 + 0.05), belt + 0.1, x1 - 0.05));
  const plate = mesh(new THREE.PlaneGeometry(0.52, 0.13), decals().plate, 0, 0.5, -L / 2 - 0.115, false);
  plate.rotation.y = Math.PI;
  body.add(plate);
  body.add(mesh(new THREE.PlaneGeometry(0.52, 0.13), decals().plate, 0, 0.36, L / 2 + 0.115, false));

  // Lights.
  const headMeshes = [], brakeMeshes = [];
  for (const s of [-1, 1]) {
    const hl = box(assets.material('headlight'), W * 0.2, 0.1, 0.06, s * W * 0.32, p.nose - 0.06, L / 2 - 0.01);
    body.add(hl); headMeshes.push(hl);
    const tl = box(assets.material('taillight'), W * 0.2, 0.11, 0.06, s * W * 0.33, p.tail - 0.14, -L / 2 + 0.01);
    body.add(tl); brakeMeshes.push(tl);
  }

  // Liveries and roof equipment.
  let sirens = null;
  if (spec.police) {
    const red = assets.material('siren-red').clone(), blue = assets.material('siren-blue').clone();
    body.add(box(dark, W * 0.62, 0.08, 0.3, 0, roofY + 0.04, (x0 + rr + x1 - rf) / 2));
    body.add(box(red, W * 0.28, 0.13, 0.26, -W * 0.15, roofY + 0.14, (x0 + rr + x1 - rf) / 2));
    body.add(box(blue, W * 0.28, 0.13, 0.26, W * 0.15, roofY + 0.14, (x0 + rr + x1 - rf) / 2));
    sirens = { red, blue };
    for (const s of [-1, 1]) {
      const d = mesh(new THREE.PlaneGeometry(L * 0.5, 0.2), decals().police, s * (W / 2 + 0.005), p.deck - 0.33, 0.1, false);
      d.rotation.y = s * Math.PI / 2;
      body.add(d);
    }
    if (spec.body !== 'van') body.add(box(assets.cloth(0x1a3f9e), W + 0.01, 0.06, L * 0.8, 0, p.deck - 0.18, 0));
    body.add(box(assets.cloth(0x111111), W * 0.9, 0.06, 0.5, 0, roofY + 0.005, x0 + rr + 0.3));
  }
  if (spec.roofSign) {
    const sign = mesh(new THREE.BoxGeometry(0.7, 0.24, 0.24), decals().taxi, 0, roofY + 0.13, (x0 + rr + x1 - rf) / 2, false);
    body.add(sign);
  }
  if (spec.body === 'minibus') {
    body.add(box(assets.cloth(0xffffff), W + 0.012, 0.12, L * 0.92, 0, p.deck - 0.25, 0));
    body.add(box(assets.cloth(0x18306a), W + 0.014, 0.05, L * 0.92, 0, p.deck - 0.16, 0));
    const board = mesh(new THREE.PlaneGeometry(W * 0.9, 0.22), decals().angkot, 0, roofY - 0.18, x1 - rf + 0.02, false);
    board.rotation.x = -Math.atan2(rf, ph);
    body.add(board);
    body.add(box(assets.material('chrome'), W * 0.8, 0.05, L * 0.5, 0, roofY + 0.12, -0.2));
  }

  const keep = new Set([...headMeshes, ...brakeMeshes]);
  if (sirens) body.children.forEach((c) => { if (c.material === sirens.red || c.material === sirens.blue) keep.add(c); });
  mergeStaticParts(body, keep);

  const wheels = [];
  const tx = W / 2 - 0.16;
  for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const w = makeWheel(spec, front, sx * tx, sz * wb / 2);
    root.add(w.pivot);
    wheels.push(w);
  }
  return { root, body, wheels, seat: new THREE.Vector3(-W * 0.22, 0.28, x0 + (x1 - x0) * 0.45), sirens, brakeMeshes, headMeshes };
}
