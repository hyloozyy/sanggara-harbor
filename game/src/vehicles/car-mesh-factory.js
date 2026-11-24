// Builds every vehicle mesh. Four-wheelers get a smooth lofted body (see car-body-loft.js and
// car-designs.js) in clearcoat paint with tinted see-through glass, dark trim, alloy wheels with
// brake discs, shaped head and tail lamps, a grille, door seams and handles, mirrors, an
// interior with seats and a steering wheel, and per-model extras and liveries. Two- and
// three-wheelers come from bike-mesh.js.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { mergeGeometries } from '../assets/mesh-batcher.js';
import { loftBody } from './car-body-loft.js';
import { CAR_DESIGNS } from './car-designs.js';
import { wheelGeometries, carTextures, lamp, box, roundedBox, mirror, steeringWheel, partMesh } from './car-details.js';
import { buildTwoWheeler, buildBajaj } from './bike-mesh.js';

function scaledDesign(spec) {
  const d = CAR_DESIGNS[spec.design || spec.key];
  const maxW = Math.max(...d.stations.map((s) => s.w));
  const maxT = Math.max(...d.stations.map((s) => s.top));
  const kx = spec.width / 2 / (maxW + 0.025), ky = spec.height / maxT;
  const stations = d.stations.map((s) => ({ ...s, w: s.w * kx, wt: s.wt * kx, bot: s.bot * ky, belt: s.belt * ky, top: s.top * ky }));
  return { ...d, stations, kx, ky };
}

// Where the body surface is at height y (front: dir = 1, rear: dir = -1), as z in metres.
function endZ(body, L, x, y, dir) {
  for (let zf = 0.5; zf > 0.2; zf -= 0.002) {
    const s = body.sample(zf * dir);
    if (Math.abs(x) <= s.w * 0.97 && y >= s.bot && y <= Math.max(s.belt, s.top) + 0.01) return zf * dir * L;
  }
  return 0.45 * dir * L;
}

function makeWheel(spec, front, x, z, side) {
  const r = spec.wheelRadius, w = spec.tyreWidth ?? (spec.heavy ? 0.3 : 0.24);
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  const spin = new THREE.Group();
  pivot.add(spin);
  const g = wheelGeometries(r, w, spec.spokes ?? 5);
  const tyre = partMesh(g.tyre, assets.material('rubber'), 0, 0, 0, true);
  const rim = partMesh(g.rim, assets.material('rim'));
  const disc = partMesh(g.disc, assets.material('metal-dark'), -side * 0.02, 0, 0);
  if (side < 0) { rim.scale.x = -1; }
  spin.add(tyre, rim);
  pivot.add(disc);
  return { pivot, spin, front, x, z };
}

// Static parts get merged into one mesh per material.
function mergeStatic(body, keep) {
  const buckets = new Map();
  body.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(body.matrixWorld).invert();
  const visit = (o) => {
    for (const child of [...o.children]) {
      if (keep.has(child) || child.userData.keep) continue;
      if (child.isMesh) {
        const m = new THREE.Matrix4().multiplyMatrices(inv, child.matrixWorld);
        if (!buckets.has(child.material)) buckets.set(child.material, []);
        buckets.get(child.material).push({ geometry: child.geometry, matrix: m, cast: child.castShadow });
        o.remove(child);
      } else if (child.isGroup) { visit(child); if (!child.children.length) o.remove(child); }
    }
  };
  visit(body);
  for (const [material, list] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(list), material);
    m.castShadow = list.some((p) => p.cast);
    m.receiveShadow = true;
    body.add(m);
  }
}

export function buildVehicleMesh(spec, color) {
  if (spec.body === 'scooter' || spec.body === 'motorbike') return buildTwoWheeler(spec, color);
  if (spec.body === 'bajaj') return buildBajaj(spec, color);
  const L = spec.length, W = spec.width, wb = spec.wheelbase, wr = spec.wheelRadius;
  const d = scaledDesign(spec);
  const T = carTextures();
  const bodyGeo = assets.geometry(`loft:${spec.key}`, () => loftBody({ ...d, arches: [{ z: wb / 2, r: wr + 0.075, y: wr }, { z: -wb / 2, r: wr + 0.075, y: wr }] }, L));
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const paint = assets.carPaint(color);
  const trimMat = assets.material('car-trim');
  const lower = partMesh(bodyGeo.paint, paint, 0, 0, 0, true); lower.receiveShadow = true;
  const glass = partMesh(bodyGeo.glass, assets.material('car-glass'));
  const trim = partMesh(bodyGeo.trim, trimMat, 0, 0, 0, true);
  lower.userData.keep = true; glass.userData.keep = true; trim.userData.keep = true;
  body.add(lower, glass, trim);
  const at = (zf) => bodyGeo.sample(zf);
  const dark = assets.material('metal-dark'), chrome = assets.material('chrome');

  // Interior: seats, dashboard and steering wheel, seen through the glass.
  const seatZ = (d.seatZ ?? 0) * L;
  const sAt = at(seatZ / L);
  const seatY = sAt.bot + 0.18;
  const cabinW = sAt.wt;
  if (sAt.top - sAt.belt > 0.2) {
    for (const sx of [-1, 1]) {
      body.add(roundedBox(T.interior, 0.46, 0.14, 0.5, sx * cabinW * 0.48, seatY + 0.05, seatZ, 0.05, false));
      body.add(roundedBox(T.interior, 0.46, 0.6, 0.14, sx * cabinW * 0.48, seatY + 0.38, seatZ - 0.26, 0.05, false));
    }
    if (L > 4) body.add(roundedBox(T.interior, cabinW * 1.7, 0.5, 0.14, 0, seatY + 0.33, seatZ - 0.95, 0.05, false));
    const dashZ = seatZ + 0.62;
    body.add(roundedBox(T.interior, cabinW * 1.85, 0.2, 0.36, 0, sAt.belt + 0.02, dashZ, 0.05, false));
  }
  const wheel = steeringWheel(-cabinW * 0.48, sAt.belt + 0.1, seatZ + 0.42);
  body.add(wheel);

  // Grille, lamps and plates on the nose and tail.
  const front = (x, y) => endZ(bodyGeo, L, x, y, 1);
  const rear = (x, y) => endZ(bodyGeo, L, x, y, -1);
  const gr = d.grille;
  const gy = gr.y * d.ky, gz = front(0, gy) - 0.01;
  body.add(box(T.grille, gr.w * W * 0.5 * 2 * 0.5 * 2 * 0.5, gr.h * d.ky, 0.06, 0, gy, gz));
  if (gr.chrome) {
    const gw = gr.w * W * 0.5, gh = gr.h * d.ky;
    body.add(box(chrome, gw + 0.04, 0.025, 0.05, 0, gy + gh / 2, gz + 0.01), box(chrome, gw + 0.04, 0.025, 0.05, 0, gy - gh / 2, gz + 0.01));
    for (const s of [-1, 1]) body.add(box(chrome, 0.025, gh, 0.05, s * gw / 2, gy, gz + 0.01));
  }
  const headMeshes = [], brakeMeshes = [];
  const hd = d.head, tl = d.tail;
  for (const s of [-1, 1]) {
    const hx = s * hd.x * W / 2, hy = hd.y * d.ky;
    const h = lamp('head', assets.material('headlight'), hx, hy, front(hx, hy) - 0.015, hd.w * W / 2 * 1.2, hd.h * d.ky, 1, hd.style);
    h.userData.keep = true;
    h.children.forEach((c) => headMeshes.push(c));
    body.add(h);
    // Amber indicator below the lamp.
    body.add(box(assets.material('indicator'), 0.12, 0.04, 0.04, hx * 0.98, hy - hd.h * d.ky * 0.9, front(hx, hy - 0.08) - 0.01));
    const tx = s * tl.x * W / 2, ty = tl.y * d.ky;
    const t = lamp('tail', assets.material('taillight'), tl.bar ? 0 : tx, ty, rear(tl.bar ? 0.2 : tx, ty) + 0.015, tl.bar ? W * 0.4 : tl.w * W / 2 * 1.2, tl.h * d.ky * (tl.vertical ? 1 : 1), -1, 'slim');
    if (tl.bar && s > 0) continue;
    t.userData.keep = true;
    t.children.forEach((c) => brakeMeshes.push(c));
    body.add(t);
  }
  const plateF = partMesh(assets.geometry('plate', () => new THREE.PlaneGeometry(0.52, 0.12)), T.plate, 0, gy - gr.h * d.ky * 0.5 - 0.09, front(0, gy - 0.12) + 0.02);
  const plateR = partMesh(assets.geometry('plate', () => new THREE.PlaneGeometry(0.52, 0.12)), T.plate, 0, tl.y * d.ky - 0.22, rear(0, tl.y * d.ky - 0.22) - 0.02);
  plateR.rotation.y = Math.PI;
  body.add(plateF, plateR);

  // Doors: seams and handles on both flanks; mirrors at the base of the A pillars.
  for (const zf of d.doors || []) {
    const s = at(zf);
    for (const side of [-1, 1]) {
      const x = side * (s.w + (s.bulge ?? 0.025) * 0.75 + 0.002);
      body.add(box(trimMat, 0.006, (s.belt - s.bot) * 0.8, 0.008, x, (s.bot + s.belt) * 0.52, zf * L));
      body.add(box(chrome, 0.02, 0.025, 0.13, x + side * 0.004, s.belt - 0.09, zf * L - 0.2));
    }
  }
  if (d.mirror != null) {
    const s = at(d.mirror);
    for (const side of [-1, 1]) body.add(mirror(paint, side, side * (s.w + 0.02), s.belt + 0.07, d.mirror * L));
  }
  if (d.chromeBelt) for (const side of [-1, 1]) { const s = at(0); body.add(box(chrome, 0.012, 0.018, L * 0.5, side * (s.wt + (s.w - s.wt) * 0.9), s.belt + 0.03, -0.03 * L)); }

  // Model extras.
  const roofAt = (zf) => at(zf).top;
  if (d.roofRails) for (const side of [-1, 1]) { const s = at(-0.1); body.add(box(chrome, 0.04, 0.05, L * 0.5, side * s.wt * 0.85, s.top + 0.06, -0.1 * L)); }
  if (d.spoiler) { const z = -0.47 * L, s = at(-0.47); body.add(box(paint, W * 0.85, 0.03, 0.22, 0, s.belt + 0.14, z, true)); for (const side of [-1, 1]) body.add(box(dark, 0.04, 0.14, 0.1, side * W * 0.3, s.belt + 0.07, z)); }
  if (d.hoodScoop) { const s = at(0.3); body.add(roundedBox(dark, 0.5, 0.08, 0.6, 0, s.top + 0.02, 0.3 * L, 0.03)); }
  if (d.stripes) for (const sx of [-0.12, 0.12]) for (let zf = -0.48; zf < 0.49; zf += 0.04) { const s = at(zf); body.add(box(T.stripe, 0.12, 0.012, 0.04 * L + 0.01, sx * W, s.top + 0.035 * (s.top - s.belt) + 0.004, zf * L)); }
  if (d.pushBar) { const z = front(0, 0.45 * d.ky) + 0.12; body.add(box(dark, W * 0.5, 0.05, 0.05, 0, 0.55 * d.ky, z), box(dark, W * 0.5, 0.05, 0.05, 0, 0.8 * d.ky, z)); for (const s of [-1, 1]) body.add(box(dark, 0.05, 0.4, 0.05, s * W * 0.2, 0.67 * d.ky, z)); }
  if (d.bed) {
    const [b0, b1] = d.bed, s = at((b0 + b1) / 2), len = (b1 - b0) * L;
    body.add(box(dark, s.w * 1.7, 0.02, len - 0.1, 0, s.belt + 0.005, (b0 + b1) / 2 * L));
    for (const side of [-1, 1]) body.add(box(chrome, 0.04, 0.04, len, side * (s.w - 0.02), s.belt + 0.02, (b0 + b1) / 2 * L));
  }
  if (d.cargo) {
    const c = d.cargo, len = (c.to - c.from) * L, top = c.top * d.ky;
    const cargo = roundedBox(assets.material('metal-paint-white'), W * c.w, top - 1.0 * d.ky, len, 0, (top + 1.0 * d.ky) / 2 + 0.02, (c.from + c.to) / 2 * L, 0.05);
    body.add(cargo);
    for (const side of [-1, 1]) {
      const dcl = partMesh(assets.geometry('truck-decal', () => new THREE.PlaneGeometry(1, 1)), T.truck, side * (W * c.w / 2 + 0.006), (top + 1.0 * d.ky) / 2, (c.from + c.to) / 2 * L);
      dcl.scale.set(len * 0.9, (top - 1.0 * d.ky) * 0.7, 1);
      dcl.rotation.y = side * Math.PI / 2;
      body.add(dcl);
    }
  }

  // Liveries and roof equipment.
  let sirens = null;
  const cab = at(0);
  const roofZ = ((d.glass?.a?.[0] ?? 0) + (d.glass?.c?.[1] ?? 0)) / 2 * L;
  const roofY = roofAt(roofZ / L);
  if (spec.police || spec.ambulance) {
    const red = assets.material('siren-red').clone(), blue = assets.material(spec.ambulance ? 'siren-red' : 'siren-blue').clone();
    const bar = new THREE.Group();
    bar.add(roundedBox(dark, W * 0.66, 0.06, 0.28, 0, 0, 0, 0.02, false));
    const r = roundedBox(red, W * 0.3, 0.1, 0.24, -W * 0.17, 0.08, 0, 0.03, false);
    const b = roundedBox(blue, W * 0.3, 0.1, 0.24, W * 0.17, 0.08, 0, 0.03, false);
    r.userData.keep = true; b.userData.keep = true;
    bar.add(r, b, roundedBox(T.lightbarClear, W * 0.66, 0.12, 0.27, 0, 0.08, 0, 0.04, false));
    bar.children[3].userData.keep = true;
    bar.position.set(0, roofY + 0.02, roofZ);
    bar.userData.keep = true;
    body.add(bar);
    sirens = { red, blue };
    const decal = spec.ambulance ? T.ambulance : T.police;
    for (const side of [-1, 1]) {
      const s = at(-0.05);
      const dc = partMesh(assets.geometry('livery-plane', () => new THREE.PlaneGeometry(1, 1)), decal, side * (s.w + (s.bulge ?? 0.025) + 0.004), (s.bot + s.belt) * 0.55, -0.05 * L);
      dc.scale.set(L * 0.5, (s.belt - s.bot) * 0.42, 1);
      dc.rotation.y = side * Math.PI / 2;
      body.add(dc);
    }
  }
  if (spec.roofSign) {
    const sign = partMesh(assets.geometry('taxi-sign', () => new THREE.BoxGeometry(0.62, 0.2, 0.22)), T.taxiSign, 0, roofY + 0.11, roofZ);
    sign.userData.keep = true;
    body.add(sign);
    for (const side of [-1, 1]) {
      const s = at(0.02);
      const dc = partMesh(assets.geometry('livery-plane', () => new THREE.PlaneGeometry(1, 1)), T.taxiDoor, side * (s.w + (s.bulge ?? 0.025) + 0.004), s.belt - 0.15, 0.02 * L);
      dc.scale.set(L * 0.3, 0.12, 1);
      dc.rotation.y = side * Math.PI / 2;
      body.add(dc);
    }
  }
  if (spec.key === 'angkot') {
    for (const side of [-1, 1]) {
      const s = at(0);
      body.add(box(assets.material('metal-paint-white'), 0.01, 0.1, L * 0.92, side * (s.w + 0.02), s.belt - 0.2, 0));
    }
    const fz = 0.38 * L, s = at(0.38);
    const board = partMesh(assets.geometry('angkot-board', () => new THREE.PlaneGeometry(1, 1)), T.angkot, 0, s.top + 0.12, fz);
    board.scale.set(W * 0.8, 0.2, 1); board.userData.keep = true;
    body.add(board);
    body.add(box(chrome, W * 0.75, 0.04, L * 0.5, 0, at(-0.1).top + 0.1, -0.1 * L));
  }
  // Wipers rest at the base of the windscreen.
  const wipers = [];
  if (d.glass?.a) {
    const zf = d.glass.a[1] - 0.01, s = at(zf);
    for (const sx of [-0.25, 0.2]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * W, s.belt + 0.03, zf * L);
      const arm = box(dark, 0.42, 0.015, 0.02, 0.21, 0, 0);
      pivot.add(arm);
      pivot.rotation.z = 0.05;
      pivot.rotation.x = -0.5;
      pivot.userData.keep = true; arm.userData.keep = true;
      body.add(pivot);
      wipers.push(pivot);
    }
  }

  const keep = new Set([...headMeshes, ...brakeMeshes]);
  mergeStatic(body, keep);

  const wheels = [];
  const tx = W / 2 - (spec.tyreWidth ?? 0.24) * 0.5 - 0.06;
  for (const [sx, sz, isFront] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
    const w = makeWheel(spec, isFront, sx * tx, sz * wb / 2, sx);
    root.add(w.pivot);
    wheels.push(w);
  }
  void cab;
  return {
    root, body, wheels, sirens, brakeMeshes, headMeshes, wipers, steering: wheel,
    seat: new THREE.Vector3(-cabinW * 0.48, seatY - 0.02, seatZ),
  };
}
