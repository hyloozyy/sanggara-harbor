// The parts that make a lofted body read as a real car: alloy wheels with rounded tyre
// sidewalls, brake discs and spokes; headlamps and tail lamps shaped per model; grilles with a
// mesh pattern and chrome surrounds; door seams and handles; mirrors; interiors with seats,
// dashboard and steering wheel; roof rails, spoilers, push bars, light bars and liveries.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { makeCanvas, toTexture } from '../assets/canvas-tools.js';
import { mergeGeometries } from '../assets/mesh-batcher.js';

const M = () => new THREE.Matrix4();

export function partMesh(geo, mat, x = 0, y = 0, z = 0, cast = false) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  return m;
}

// ------------------------------------------------------------------ wheels
export function wheelGeometries(r, w, spokes = 5) {
  return assets.geometry(`wheel2:${r.toFixed(3)}:${w.toFixed(3)}:${spokes}`, () => {
    // Tyre: lathe of a rounded sidewall profile around the axle (x axis).
    const pts = [];
    const ri = r * 0.66;
    for (let i = 0; i <= 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * Math.PI;
      pts.push(new THREE.Vector2(r - 0.035 + Math.cos(a) * 0.035 + (Math.abs(Math.sin(a)) < 0.7 ? 0 : 0), Math.sin(a) * w * 0.5));
    }
    pts.unshift(new THREE.Vector2(ri, -w * 0.45)); pts.push(new THREE.Vector2(ri, w * 0.45));
    const tyre = new THREE.LatheGeometry(pts, 22).rotateZ(Math.PI / 2);
    // Rim: lip, spokes, hub and a brake disc behind.
    const parts = [];
    const lip = new THREE.TorusGeometry(ri * 0.98, 0.018, 6, 22).rotateY(Math.PI / 2);
    parts.push({ geometry: lip, matrix: M().makeTranslation(w * 0.38, 0, 0) });
    const dish = new THREE.CylinderGeometry(ri * 0.95, ri * 0.95, 0.02, 22).rotateZ(Math.PI / 2);
    parts.push({ geometry: dish, matrix: M().makeTranslation(w * 0.12, 0, 0) });
    const spoke = new THREE.BoxGeometry(0.03, ri * 0.85, ri * 0.16).translate(0, ri * 0.48, 0);
    for (let i = 0; i < spokes; i++) parts.push({ geometry: spoke, matrix: M().makeTranslation(w * 0.33, 0, 0).multiply(M().makeRotationX((i / spokes) * Math.PI * 2)) });
    const hub = new THREE.CylinderGeometry(ri * 0.2, ri * 0.24, 0.05, 12).rotateZ(Math.PI / 2);
    parts.push({ geometry: hub, matrix: M().makeTranslation(w * 0.36, 0, 0) });
    const rim = mergeGeometries(parts);
    const disc = new THREE.CylinderGeometry(ri * 0.72, ri * 0.72, 0.025, 18).rotateZ(Math.PI / 2);
    return { tyre, rim, disc };
  });
}

// ------------------------------------------------------------------ textures
let tex = null;
function textures() {
  if (tex) return tex;
  const grille = makeCanvas(128, 64), g = grille.getContext('2d');
  g.fillStyle = '#0c0d0f'; g.fillRect(0, 0, 128, 64);
  g.strokeStyle = '#3a3d42'; g.lineWidth = 2;
  for (let y = -8; y < 72; y += 8) for (let x = -8; x < 136; x += 12) { g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x + 6, y); g.lineTo(x + 12, y + 4); g.lineTo(x + 6, y + 8); g.closePath(); g.stroke(); }
  const label = (text, bg, fg, w = 512, h = 96, stripe = null) => {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (stripe) { x.fillStyle = stripe; x.fillRect(0, h * 0.78, w, h * 0.22); }
    x.fillStyle = fg; x.font = `bold ${Math.round(h * 0.5)}px "Trebuchet MS", "DejaVu Sans", sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h * 0.42);
    return toTexture(c, { repeat: false });
  };
  const decal = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, ...extra });
  tex = {
    grille: new THREE.MeshStandardMaterial({ map: toTexture(grille, { repeat: true }), roughness: 0.5, metalness: 0.6 }),
    police: decal(label('POLICE', '#14318a', '#ffffff', 512, 96, '#f2c230')),
    ambulance: decal(label('AMBULANCE', '#ffffff', '#c81e1e', 512, 96, '#f07a10')),
    taxiDoor: decal(label('OMBAK TAXI', '#f2c230', '#14243a', 512, 96)),
    taxiSign: new THREE.MeshStandardMaterial({ map: label('TAXI', '#f2c230', '#1a1a1a', 256, 96), emissiveMap: label('TAXI', '#f2c230', '#1a1a1a', 256, 96), emissive: 0xffffff, emissiveIntensity: 1.6 }),
    angkot: new THREE.MeshStandardMaterial({ map: label('04  KOTA LAMA - PASAR IKAN', '#101010', '#ffd24a'), emissiveMap: label('04  KOTA LAMA - PASAR IKAN', '#101010', '#ffd24a'), emissive: 0xffffff, emissiveIntensity: 1.2 }),
    truck: decal(label('KERBAU EXPRESS', '#e8e4da', '#b02a1a', 1024, 256, '#1c4a8a')),
    plate: decal(label('SG 4417 RK', '#111111', '#f0f0f0', 256, 64)),
    stripe: new THREE.MeshPhysicalMaterial({ color: 0xf4f4f0, roughness: 0.3, clearcoat: 1 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.9 }),
    lightbarClear: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false }),
  };
  return tex;
}
export { textures as carTextures };

// ------------------------------------------------------------------ lamps
// A lamp lens on the front or back surface of the car.
export function lamp(kind, mat, x, y, z, w, h, dirZ, style = 'swept') {
  const g = new THREE.Group();
  const lens = (sx, sy, ox = 0) => {
    const geo = assets.geometry(`lamp:${style}`, () => {
      if (style === 'round' || style === 'twin') return new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
      const s = new THREE.Shape();
      const r = 0.18;
      s.moveTo(-0.5 + r, -0.5); s.lineTo(0.5 - r, -0.5); s.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r); s.lineTo(0.5, 0.5 - r);
      s.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5); s.lineTo(-0.5 + (style === 'swept' ? 0.3 : r), 0.5); s.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r); s.lineTo(-0.5, -0.5 + r); s.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
      return new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.1, bevelSegments: 2, curveSegments: 4 });
    });
    const m = partMesh(geo, mat, ox, 0, 0);
    m.scale.set(sx, sy, style === 'round' || style === 'twin' ? 0.05 : 0.12);
    return m;
  };
  if (style === 'twin') { g.add(lens(h, h, -w * 0.3)); g.add(lens(h, h, w * 0.32)); }
  else if (style === 'round') g.add(lens(Math.max(w, h), Math.max(w, h)));
  else g.add(lens(w, h));
  g.position.set(x, y, z);
  if (dirZ < 0) g.rotation.y = Math.PI;
  g.rotation.y += -Math.sign(x) * 0.25 * (dirZ > 0 ? 1 : -1);
  g.userData.kind = kind;
  return g;
}

// ------------------------------------------------------------------ misc parts
export function box(mat, sx, sy, sz, x, y, z, cast = false) {
  const m = partMesh(assets.geometry('unit-box-r', () => new THREE.BoxGeometry(1, 1, 1)), mat, x, y, z, cast);
  m.scale.set(sx, sy, sz);
  return m;
}

export function roundedBox(mat, sx, sy, sz, x, y, z, r = 0.06, cast = true) {
  const geo = assets.geometry(`rbox:${sx.toFixed(2)}:${sy.toFixed(2)}:${sz.toFixed(2)}:${r}`, () => {
    const s = new THREE.Shape();
    const w = sz, h = sy;
    s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: sx - 2 * r, bevelEnabled: true, bevelSize: r * 0.9, bevelThickness: r, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(sx - 2 * r) / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });
  return partMesh(geo, mat, x, y, z, cast);
}

export function mirror(paint, side, x, y, z) {
  const g = new THREE.Group();
  g.add(roundedBox(paint, 0.2, 0.12, 0.08, side * 0.1, 0, 0, 0.03, true));
  g.add(box(assets.material('metal-dark'), 0.06, 0.03, 0.05, side * -0.02, -0.02, 0.02));
  g.add(box(assets.material('chrome'), 0.16, 0.09, 0.005, side * 0.1, 0, -0.045));
  g.position.set(x, y, z);
  return g;
}

export function steeringWheel(x, y, z) {
  const g = new THREE.Group();
  const ring = partMesh(assets.geometry('steer-ring', () => new THREE.TorusGeometry(0.17, 0.017, 6, 20)), assets.material('rubber'));
  const hub = box(assets.material('metal-dark'), 0.08, 0.08, 0.04, 0, 0, 0);
  const spoke = box(assets.material('metal-dark'), 0.3, 0.025, 0.02, 0, 0, 0);
  g.add(ring, hub, spoke);
  g.position.set(x, y, z);
  g.rotation.x = -0.45;
  return g;
}
