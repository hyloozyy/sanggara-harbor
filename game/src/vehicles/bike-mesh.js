// Two- and three-wheelers: the step-through Bebek scooter (curved leg shield, floorboard,
// rounded rear cowl, dual seat), the Kilat sport motorbike (tank, fairing with a screen,
// tail section, exposed engine, exhaust) and the Bajaj three-wheeled taxi (canvas canopy cab,
// single front wheel, handlebar steering). Wheels turn and steer like the cars'.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { wheelGeometries, lamp, box, roundedBox, partMesh } from './car-details.js';
import { mergeGeometries } from '../assets/mesh-batcher.js';

// A smooth closed shell lofted along z through elliptical sections [z, cy, rx, ry].
function shell(sections, segs = 14) {
  const pos = [], idx = [];
  for (const [z, cy, rx, ry] of sections) {
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rx, cy + Math.sin(a) * ry, z);
    }
  }
  const n = sections.length;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < segs; j++) {
    const a = i * segs + j, b = i * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  for (const [ri, flip] of [[0, true], [n - 1, false]]) {
    const ci = pos.length / 3;
    pos.push(0, sections[ri][1], sections[ri][0]);
    for (let j = 0; j < segs; j++) { const a = ri * segs + j, b = ri * segs + (j + 1) % segs; idx.push(...(flip ? [ci, b, a] : [ci, a, b])); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function bikeWheel(spec, front, z) {
  const r = spec.wheelRadius;
  const pivot = new THREE.Group();
  pivot.position.set(0, r, z);
  const spin = new THREE.Group();
  pivot.add(spin);
  const g = wheelGeometries(r, spec.tyreWidth ?? 0.11, spec.spokes ?? 6);
  spin.add(partMesh(g.tyre, assets.material('rubber'), 0, 0, 0, true), partMesh(g.rim, assets.material('rim'), -0.02, 0, 0), partMesh(g.disc, assets.material('chrome'), 0.03, 0, 0));
  return { pivot, spin, front, x: 0, z };
}

function finish(root, body, wheels, seat, lights) {
  const keep = new Set([...lights.head, ...lights.tail]);
  const buckets = new Map();
  body.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  body.traverse((o) => {
    if (!o.isMesh || keep.has(o) || o.userData.keep) return;
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push({ geometry: o.geometry, matrix: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
  });
  for (const list of buckets.values()) void list;
  const remove = [];
  body.traverse((o) => { if (o.isMesh && !keep.has(o) && !o.userData.keep) remove.push(o); });
  for (const o of remove) o.parent.remove(o);
  for (const [material, list] of buckets) { const m = new THREE.Mesh(mergeGeometries(list), material); m.castShadow = true; body.add(m); }
  for (const w of wheels) root.add(w.pivot);
  return { root, body, wheels, seat, sirens: null, brakeMeshes: lights.tail, headMeshes: lights.head, wipers: [] };
}

export function buildTwoWheeler(spec, color) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const paint = assets.carPaint(color), dark = assets.material('metal-dark'), chrome = assets.material('chrome'), rubber = assets.material('rubber');
  const L = spec.length, wb = spec.wheelbase, r = spec.wheelRadius;
  const lights = { head: [], tail: [] };
  const zf = wb / 2, zr = -wb / 2;
  if (spec.body === 'scooter') {
    // Rear cowl over the engine, the seat on top, a curved leg shield in front of the knees.
    body.add(partMesh(shell([[-0.85, 0.66, 0.04, 0.04], [-0.78, 0.66, 0.15, 0.13], [-0.55, 0.64, 0.2, 0.2], [-0.25, 0.6, 0.19, 0.2], [-0.05, 0.52, 0.12, 0.12], [0.0, 0.5, 0.03, 0.03]]), paint, 0, 0, 0, true));
    body.add(partMesh(shell([[-0.78, 0.88, 0.04, 0.03], [-0.7, 0.89, 0.15, 0.06], [-0.3, 0.9, 0.17, 0.07], [-0.05, 0.86, 0.13, 0.05], [0.0, 0.85, 0.03, 0.02]]), rubber, 0, 0, 0, true));
    body.add(box(dark, 0.3, 0.05, 0.62, 0, 0.36, 0.12));                                      // floorboard
    body.add(partMesh(shell([[0.34, 0.72, 0.03, 0.3], [0.4, 0.75, 0.2, 0.36], [0.5, 0.78, 0.22, 0.38], [0.56, 0.8, 0.12, 0.3], [0.58, 0.82, 0.02, 0.05]], 16), paint, 0, 0, 0, true));
    body.add(partMesh(shell([[0.45, 0.8, 0.05, 0.05], [0.5, 0.95, 0.07, 0.08], [0.55, 1.06, 0.08, 0.06], [0.56, 1.1, 0.03, 0.03]]), paint, 0, 0, 0, true)); // steering column cover
    body.add(box(chrome, 0.68, 0.04, 0.04, 0, 1.1, 0.52));
    for (const s of [-1, 1]) body.add(box(rubber, 0.11, 0.05, 0.05, s * 0.3, 1.1, 0.52));
    body.add(partMesh(shell([[0.62, 0.42, 0.04, 0.03], [0.66, 0.45, 0.1, 0.05], [0.85, 0.42, 0.1, 0.04], [0.9, 0.4, 0.04, 0.02]]), paint)); // front mudguard
    body.add(box(chrome, 0.06, 0.06, 0.5, 0.12, 0.3, -0.45));                                     // exhaust
  } else {
    // Sport motorbike: frame, tank, fairing and screen, tail, engine block.
    body.add(partMesh(shell([[-0.25, 0.92, 0.04, 0.03], [-0.15, 0.95, 0.16, 0.1], [0.1, 0.98, 0.19, 0.13], [0.3, 0.92, 0.15, 0.1], [0.38, 0.88, 0.05, 0.04]]), paint, 0, 0, 0, true));
    body.add(partMesh(shell([[0.35, 0.72, 0.05, 0.05], [0.45, 0.78, 0.2, 0.22], [0.62, 0.82, 0.2, 0.18], [0.78, 0.86, 0.1, 0.1], [0.82, 0.88, 0.02, 0.02]], 16), paint, 0, 0, 0, true));
    const screen = partMesh(shell([[0.58, 1.02, 0.02, 0.01], [0.62, 1.06, 0.14, 0.08], [0.68, 1.1, 0.1, 0.05], [0.7, 1.12, 0.02, 0.01]]), assets.material('car-glass'));
    screen.userData.keep = true; body.add(screen);
    body.add(partMesh(shell([[-0.95, 0.98, 0.03, 0.02], [-0.85, 0.97, 0.1, 0.06], [-0.55, 0.92, 0.14, 0.09], [-0.3, 0.88, 0.15, 0.08], [-0.2, 0.86, 0.04, 0.03]]), paint, 0, 0, 0, true));
    body.add(partMesh(shell([[-0.5, 0.95, 0.03, 0.02], [-0.45, 0.96, 0.13, 0.04], [-0.2, 0.95, 0.15, 0.05], [-0.15, 0.94, 0.04, 0.02]]), rubber));
    body.add(roundedBox(dark, 0.3, 0.32, 0.42, 0, 0.5, 0.05, 0.05));
    body.add(box(chrome, 0.08, 0.08, 0.6, 0.14, 0.42, -0.45));
    body.add(box(chrome, 0.6, 0.035, 0.035, 0, 0.98, 0.5));
    for (const s of [-1, 1]) { const f = box(chrome, 0.04, 0.6, 0.04, s * 0.09, 0.62, 0.62); f.rotation.x = -0.4; body.add(f); }
  }
  // Rear swingarm for both.
  for (const s of [-1, 1]) body.add(box(dark, 0.03, 0.05, 0.6, s * 0.11, r + 0.04, zr + 0.3));
  const hl = lamp('head', assets.material('headlight'), 0, spec.body === 'scooter' ? 1.0 : 0.85, spec.body === 'scooter' ? 0.6 : 0.82, 0.14, 0.08, 1, 'swept');
  const tl = lamp('tail', assets.material('taillight'), 0, spec.body === 'scooter' ? 0.72 : 0.96, spec.body === 'scooter' ? -0.86 : -0.95, 0.14, 0.05, -1, 'slim');
  hl.rotation.y = 0; tl.rotation.y = Math.PI;
  hl.userData.keep = tl.userData.keep = true;
  lights.head.push(...hl.children); lights.tail.push(...tl.children);
  body.add(hl, tl);
  void L;
  const wheels = [bikeWheel(spec, true, zf), bikeWheel(spec, false, zr)];
  return finish(root, body, wheels, new THREE.Vector3(0, spec.body === 'scooter' ? 0.62 : 0.66, spec.body === 'scooter' ? -0.3 : -0.32), lights);
}

export function buildBajaj(spec, color) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const paint = assets.carPaint(color), dark = assets.material('metal-dark'), chrome = assets.material('chrome');
  const canvas = assets.cloth(0x1c1c1c);
  const lights = { head: [], tail: [] };
  // Tub: lofted rounded body, wider at the back where the passengers sit.
  body.add(partMesh(shell([[-1.2, 0.55, 0.3, 0.2], [-1.15, 0.6, 0.6, 0.3], [-0.6, 0.62, 0.65, 0.32], [-0.1, 0.6, 0.55, 0.3], [0.5, 0.55, 0.32, 0.25], [0.95, 0.6, 0.22, 0.28], [1.05, 0.65, 0.05, 0.1]], 18), paint, 0, 0, 0, true));
  // Canopy roof on four posts.
  body.add(partMesh(shell([[-1.2, 1.6, 0.05, 0.02], [-1.15, 1.62, 0.6, 0.08], [0.2, 1.64, 0.6, 0.08], [0.6, 1.58, 0.45, 0.07], [0.7, 1.55, 0.05, 0.02]], 18), canvas, 0, 0, 0, true));
  for (const [x, z] of [[-0.55, -1.05], [0.55, -1.05], [-0.42, 0.55], [0.42, 0.55]]) body.add(box(dark, 0.04, 0.85, 0.04, x, 1.2, z));
  const screen = partMesh(assets.geometry('bajaj-screen', () => new THREE.PlaneGeometry(0.75, 0.55)), assets.material('car-glass'), 0, 1.25, 0.62);
  screen.rotation.x = -0.15; screen.userData.keep = true; body.add(screen);
  body.add(roundedBox(assets.cloth(0x3a2a20), 1.1, 0.15, 0.5, 0, 0.88, -0.75, 0.05));
  body.add(roundedBox(assets.cloth(0x3a2a20), 1.1, 0.5, 0.12, 0, 1.1, -1.05, 0.05));
  body.add(roundedBox(assets.cloth(0x3a2a20), 0.4, 0.12, 0.4, 0, 0.88, 0.15, 0.05));
  body.add(box(chrome, 0.7, 0.04, 0.04, 0, 1.05, 0.5));
  const hl = lamp('head', assets.material('headlight'), 0, 0.85, 1.02, 0.18, 0.18, 1, 'round');
  hl.rotation.y = 0;
  hl.userData.keep = true; lights.head.push(...hl.children); body.add(hl);
  for (const s of [-1, 1]) { const t = lamp('tail', assets.material('taillight'), s * 0.5, 0.6, -1.2, 0.08, 0.06, -1, 'slim'); t.rotation.y = Math.PI; t.userData.keep = true; lights.tail.push(...t.children); body.add(t); }
  const wheels = [bikeWheel(spec, true, 0.75)];
  for (const s of [-1, 1]) { const w = bikeWheel(spec, false, -0.75); w.pivot.position.x = s * 0.62; w.x = s * 0.62; wheels.push(w); }
  return finish(root, body, wheels, new THREE.Vector3(0, 0.82, 0.1), lights);
}
