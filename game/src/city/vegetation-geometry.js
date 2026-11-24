// Vegetation meshes built once per variant and instanced along the streets:
//  - coconut palms: curved, leaning, tapering trunks with a flared base and leaf-scar rings,
//    a crown shank, sixteen arched fronds in three tiers (V-folded leaflet cards), brown dead
//    fronds hanging below and a cluster of coconuts;
//  - tropical shade trees: a trunk that forks into limbs and twigs, with clumps of crossed
//    leaf cards at every twig tip, tinted lighter on top and darker underneath.
import * as THREE from 'three';
import { mergeGeometries } from '../assets/mesh-batcher.js';
import { createRng } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A tube along `curve` whose radius follows radius(t); UV v in metres along the length.
function taperedTube(curve, radius, segs = 14, radial = 8, ring = null) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nrm = [], uv = [], idx = [];
  const len = curve.getLength();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t);
    const N = frames.normals[i], Bn = frames.binormals[i];
    let r = radius(t);
    if (ring) r *= 1 + ring(t * len);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const n = N.clone().multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      nrm.push(n.x, n.y, n.z);
      uv.push(j / radial, t * len);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function colorize(g, color) {
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

// One frond: a strip three vertices wide (V-folded) along an arched path.
function frond(origin, yaw, elev, length, droop, width, color, rng) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const segs = 10;
  const dir = V(Math.cos(elev) * Math.sin(yaw), Math.sin(elev), Math.cos(elev) * Math.cos(yaw));
  const side = V(Math.cos(yaw), 0, -Math.sin(yaw));
  let p = origin.clone(), d = dir.clone();
  const twist = rng.range(-0.3, 0.3);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.06)) * (i === 0 ? 0.2 : 1);
    const up = d.clone().cross(side).normalize().negate();
    const s = side.clone().applyAxisAngle(d, twist * t);
    const fold = w * 0.28;
    const pts = [p.clone().addScaledVector(s, -w / 2).addScaledVector(up, fold), p.clone(), p.clone().addScaledVector(s, w / 2).addScaledVector(up, fold)];
    pts.forEach((q, k) => {
      pos.push(q.x, q.y, q.z);
      nrm.push(up.x, up.y, up.z);
      uv.push(k / 2, t);
      const shade = 0.8 + 0.2 * t + (k === 1 ? 0.05 : 0);
      col.push(color.r * shade, color.g * shade, color.b * shade);
    });
    // Advance along an arch that bends down more and more.
    const step = length / segs;
    p = p.addScaledVector(d, step);
    d.y -= droop * step * (0.3 + t * 1.3);
    d.normalize();
  }
  for (let i = 0; i < segs; i++) for (let k = 0; k < 2; k++) {
    const a = i * 3 + k, b = a + 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

export function palmVariant(seed) {
  const rng = createRng(seed);
  const H = rng.range(7.6, 9.6), lean = rng.range(0.9, 2.4), bend = rng.range(-0.6, 0.6);
  const top = V(lean, H, bend);
  const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0.15, H * 0.3, bend * 0.1), V(lean * 0.45, H * 0.65, bend * 0.4), top]);
  const trunk = taperedTube(curve, (t) => 0.2 * (1 - 0.3 * t) + 0.12 * Math.max(0, 1 - t * 9), 18, 9, (s) => 0.04 * Math.max(0, Math.sin(s * Math.PI * 2 / 0.34)) ** 4);
  // Crown shank: a swollen green-brown cylinder where the fronds sprout.
  const shank = colorize(new THREE.CylinderGeometry(0.2, 0.26, 0.9, 9).translate(top.x, top.y + 0.2, top.z), new THREE.Color(0.55, 0.5, 0.32));
  const parts = [];
  const green = new THREE.Color(1, 1, 1), brown = new THREE.Color(1.25, 0.85, 0.45);
  const origin = top.clone().add(V(0, 0.55, 0));
  const tiers = [[6, 0.75, 4.2, 0.12], [6, 0.25, 5.0, 0.2], [5, -0.2, 4.6, 0.3]];
  tiers.forEach(([n, elev, len, droop], ti) => {
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + ti * 0.5 + rng.range(-0.25, 0.25);
      parts.push(frond(origin, yaw, elev + rng.range(-0.15, 0.15), len * rng.range(0.85, 1.1), droop, rng.range(1.5, 1.9), green, rng));
    }
  });
  for (let i = 0; i < 2; i++) parts.push(frond(origin.clone().add(V(0, -0.3, 0)), rng.range(0, 6.28), -1.2, 3.2, 0.05, 1.1, brown, rng));
  const nut = new THREE.SphereGeometry(0.17, 7, 5);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + rng.next();
    const g = colorize(nut.clone().scale(1, 1.15, 1).translate(top.x + Math.cos(a) * 0.28, top.y + 0.05 - (i % 2) * 0.15, top.z + Math.sin(a) * 0.28), new THREE.Color(0.55, 0.5, 0.18));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(0.5), 2));
    parts.push(g);
  }
  shank.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(shank.attributes.position.count * 2).fill(0.5), 2));
  const crownParts = parts.map((geometry) => ({ geometry: geometry.index ? geometry : geometry, matrix: new THREE.Matrix4() }));
  return { trunk, crown: mergeGeometries(crownParts), shank };
}

// Crossed leaf cards around a point.
function leafClump(center, size, rng, parts, tint) {
  const n = 5;
  for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(size, size * 0.85);
    g.rotateX(rng.range(-1.2, 0.2) - Math.PI / 2 * (i === 0 ? 1 : 0.4));
    g.rotateY(rng.range(0, Math.PI));
    g.translate(center.x + rng.range(-0.4, 0.4) * size, center.y + rng.range(-0.25, 0.3) * size, center.z + rng.range(-0.4, 0.4) * size);
    // Lighter on top, darker beneath; normals point up-and-out so lighting reads as a canopy.
    const pos = g.attributes.position, nrm = g.attributes.normal, col = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const dy = pos.getY(k) - center.y;
      const sh = (0.75 + 0.3 * Math.max(-1, Math.min(1, dy / size))) * tint;
      col[k * 3] = sh * rng.range(0.92, 1.05); col[k * 3 + 1] = sh; col[k * 3 + 2] = sh * rng.range(0.85, 1);
      const out = V(pos.getX(k) - center.x * 0.6, 0.8, pos.getZ(k) - center.z * 0.6).normalize();
      nrm.setXYZ(k, out.x, out.y, out.z);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    parts.push({ geometry: g, matrix: new THREE.Matrix4() });
  }
}

export function treeVariant(seed) {
  const rng = createRng(seed);
  const wood = [], leaves = [];
  const branch = (from, dir, len, radius, depth) => {
    const mid = from.clone().addScaledVector(dir, len * 0.5).add(V(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2)));
    const end = from.clone().addScaledVector(dir, len);
    const curve = new THREE.CatmullRomCurve3([from, mid, end]);
    wood.push({ geometry: taperedTube(curve, (t) => radius * (1 - 0.45 * t), 5, 6), matrix: new THREE.Matrix4() });
    if (depth === 0) { leafClump(end, rng.range(1.5, 2.1), rng, leaves, rng.range(0.85, 1.1)); return; }
    const kids = depth === 2 ? 3 : 2 + (rng.chance(0.4) ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const a = (i / kids) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const out = depth === 2 ? 0.75 : 0.95;
      const nd = V(Math.cos(a) * out, rng.range(0.55, 0.95), Math.sin(a) * out).normalize().lerp(dir, 0.25).normalize();
      branch(end, nd, len * rng.range(0.6, 0.78), radius * 0.6, depth - 1);
    }
    if (depth === 1) leafClump(end, rng.range(1.7, 2.3), rng, leaves, 0.8);
  };
  branch(V(0, 0, 0), V(rng.range(-0.08, 0.08), 1, rng.range(-0.08, 0.08)).normalize(), rng.range(2.6, 3.2), 0.24, 2);
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves) };
}
