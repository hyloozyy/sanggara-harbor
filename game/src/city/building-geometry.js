// Geometry builders for architecture: facade boxes with per-floor UVs, hip roofs, domes, tanks.
import * as THREE from 'three';
import { FACADE_BAYS, FACADE_FLOORS } from '../assets/facade-textures.js';

// Four walls (no top/bottom) whose UVs tile one window bay per `bayW` metres and one floor per `floorH`.
export function facadeBoxGeometry(w, h, d, bayW = 3.4, floorH = 3.5, uShift = 0, vShift = 0) {
  const positions = [], normals = [], uvs = [], index = [];
  const hw = w / 2, hd = d / 2;
  const faces = [
    { o: [-hw, hd], dir: [1, 0], len: w, n: [0, 0, 1] },
    { o: [hw, hd], dir: [0, -1], len: d, n: [1, 0, 0] },
    { o: [hw, -hd], dir: [-1, 0], len: w, n: [0, 0, -1] },
    { o: [-hw, -hd], dir: [0, 1], len: d, n: [-1, 0, 0] },
  ];
  let base = 0, uRun = uShift;
  const uScale = 1 / (bayW * FACADE_BAYS), vScale = 1 / (floorH * FACADE_FLOORS);
  for (const f of faces) {
    const x0 = f.o[0], z0 = f.o[1], x1 = x0 + f.dir[0] * f.len, z1 = z0 + f.dir[1] * f.len;
    const u0 = uRun, u1 = uRun + f.len * uScale;
    const v0 = vShift, v1 = vShift + h * vScale;
    positions.push(x0, 0, z0, x1, 0, z1, x1, h, z1, x0, h, z0);
    for (let k = 0; k < 4; k++) normals.push(...f.n);
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
    uRun = u1 + 0.37;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

// Flat roof cap with world-scaled UVs.
export function roofCapGeometry(w, d, tile = 8) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
  return g;
}

// Hip roof: a four-sided pyramid stretched to the footprint.
export function hipRoofGeometry(w, d, h) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true);
  g.rotateY(Math.PI / 4);
  g.scale(w * 1.08, h, d * 1.08);
  g.translate(0, h / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 2);
  return g;
}

// Pitched (gable) roof along x: a triangular prism.
export function gableRoofGeometry(w, d, h) {
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2 - 0.6, 0); shape.lineTo(0, h); shape.lineTo(d / 2 + 0.6, 0); shape.lineTo(-d / 2 - 0.6, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w + 1, bevelEnabled: false });
  g.translate(0, 0, -(w + 1) / 2);
  g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 4, uv.getY(i) / 4);
  return g;
}

// Sawtooth factory roof made of repeated gables.
export function sawtoothRoofGeometry(w, d, h, teeth) {
  const shape = new THREE.Shape();
  const step = d / teeth;
  shape.moveTo(-d / 2, 0);
  for (let i = 0; i < teeth; i++) { shape.lineTo(-d / 2 + i * step, h); shape.lineTo(-d / 2 + (i + 1) * step, 0); }
  shape.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 6, uv.getY(i) / 6);
  return g;
}

export function domeGeometry(r) {
  const g = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  return g;
}

export const unitBox = () => new THREE.BoxGeometry(1, 1, 1);
export const unitCylinder = (seg = 12) => new THREE.CylinderGeometry(0.5, 0.5, 1, seg);
