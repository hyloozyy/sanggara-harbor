// Geometry helpers for furnished interiors: rounded (bevelled) boxes with smooth edge normals,
// turned (lathe) profiles for bottles, glasses, stools and lamps, curved tubes for chrome rails
// and bent wood, and a small kit that places parts and batches the static ones per material.
import * as THREE from 'three';
import { MeshBatcher } from '../assets/mesh-batcher.js';

const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };

// A box with every edge and corner rounded to radius r (seg segments per bevel). The vertex
// grid of a segmented box is redistributed so the bevel bands get the vertices, then each one
// is projected onto the rounded surface; normals come from the projection, so lighting rolls
// smoothly over the edges. UVs are scaled to metres (u along width or depth, v along height).
export function roundedBox(w, h, d, r = 0.02, seg = 2) {
  const key = `rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${seg}`;
  return cached(key, () => {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const n = seg * 2 + 1;
    const g = new THREE.BoxGeometry(w, h, d, n, n, n);
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const half = [w / 2, h / 2, d / 2], inner = half.map((x) => x - r);
    const p = [0, 0, 0], c = [0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
      p[0] = pos.getX(i); p[1] = pos.getY(i); p[2] = pos.getZ(i);
      for (let a = 0; a < 3; a++) {
        // Node index along this axis (0..n) from the uniform grid.
        const f = (p[a] / (half[a] * 2) + 0.5) * n, k = Math.round(f);
        p[a] = k <= seg ? -half[a] + (k / seg) * r : inner[a] + ((k - seg - 1) / seg) * r;
        c[a] = Math.max(-inner[a], Math.min(inner[a], p[a]));
      }
      const dx = p[0] - c[0], dy = p[1] - c[1], dz = p[2] - c[2], l = Math.hypot(dx, dy, dz);
      if (l > 1e-6) {
        pos.setXYZ(i, c[0] + dx / l * r, c[1] + dy / l * r, c[2] + dz / l * r);
        nor.setXYZ(i, dx / l, dy / l, dz / l);
      } else pos.setXYZ(i, p[0], p[1], p[2]);
      // Metre-scaled UVs from the face orientation.
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (ny > 0.7) uv.setXY(i, x + half[0], z + half[2]);
      else if (nx > 0.7) uv.setXY(i, z + half[2], y + half[1]);
      else uv.setXY(i, x + half[0], y + half[1]);
    }
    g.computeBoundingSphere();
    return g;
  });
}

// Turned profile: points [[radius, y], ...] from bottom to top, revolved.
export function lathe(points, segments = 20, key = null) {
  // Profiles written top-down are reversed so the normals always face outwards.
  const make = () => {
    const pts = points[0][1] > points[points.length - 1][1] ? [...points].reverse() : points;
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), segments);
  };
  return key ? cached('lathe:' + key + ':' + segments, make) : make();
}

// Smooth closed-cap cylinder (rounded rims) of radius r and height h, standing on y = 0.
export function roundedCylinder(r, h, bevel = 0.01, segments = 24) {
  return cached(`rc:${r}:${h}:${bevel}:${segments}`, () => {
    const pts = [[0, 0]];
    const steps = 4;
    for (let i = 0; i <= steps; i++) { const a = -Math.PI / 2 + (i / steps) * Math.PI / 2; pts.push([r - bevel + Math.cos(a) * bevel, bevel + Math.sin(a) * bevel]); }
    for (let i = 0; i <= steps; i++) { const a = (i / steps) * Math.PI / 2; pts.push([r - bevel + Math.cos(a) * bevel, h - bevel + Math.sin(a) * bevel]); }
    pts.push([0, h]);
    return lathe(pts, segments);
  });
}

// Tube through points (a chrome rail, a bent leg, a cable).
export function tube(points, radius = 0.015, segs = 32, radial = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, segs, radius, radial, closed);
}

// Torus ring lying flat (footrests, rims), radius R, tube r.
export function ring(R, r, segs = 40) { return cached(`ring:${R}:${r}:${segs}`, () => new THREE.TorusGeometry(R, r, 8, segs).rotateX(Math.PI / 2)); }

// An extruded outline (shape points in x/y) with a rounded bevel, depth along z, centred.
export function extrudeShape(pts, depth, bevel = 0.01, curveSegments = 12) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments });
  g.translate(0, 0, -depth / 2 + bevel);
  g.computeVertexNormals();
  return g;
}

// A rounded-rectangle outline as points (for table tops, mirrors, signs).
export function roundRectPoints(w, h, r, steps = 6) {
  const pts = [];
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= steps; i++) { const a = a0 + (i / steps) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// Placement kit: static parts go into a batcher (merged per material at the end), moving parts
// become their own meshes. Everything is placed in a parent frame (x, z, rotation) so a piece
// of furniture can be built once in its own coordinates and dropped anywhere in the room.
export class Kit {
  constructor() { this.batch = new MeshBatcher(); this.frames = [new THREE.Matrix4()]; this.dynamic = []; }

  get frame() { return this.frames[this.frames.length - 1]; }

  // Enter a local frame at (x, y, z) turned by ry (and optionally rx/rz).
  push(x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    const m = new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(s, s, s));
    this.frames.push(this.frame.clone().multiply(m));
    return this;
  }

  pop() { this.frames.pop(); return this; }

  matrix(x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    return this.frame.clone().multiply(_m);
  }

  // Static part.
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    this.batch.add(geo, mat, this.matrix(x, y, z, ry, rx, rz, sx, sy, sz));
  }

  // A mesh of its own (animated, or needing its own material instance), parented to `parent`.
  mesh(parent, geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1) {
    const mesh = new THREE.Mesh(geo, mat);
    this.matrix(x, y, z, ry, rx, rz, s).decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // A group placed in the current frame (for animated assemblies like fan blades or doors).
  group(parent, x = 0, y = 0, z = 0, ry = 0) {
    const g = new THREE.Group();
    this.matrix(x, y, z, ry).decompose(g.position, g.quaternion, g.scale);
    parent.add(g);
    return g;
  }

  // World-space point of a local coordinate in the current frame.
  point(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.frame); }

  // World-space heading of a local direction angle.
  heading(ry = 0) { _q.setFromRotationMatrix(this.frame); _e.setFromQuaternion(_q, 'YXZ'); return _e.y + ry; }

  // Merge the static parts; see-through pieces (glass, contact shadows) cast no shadow.
  build(opts) {
    const g = this.batch.build(opts);
    for (const m of g.children) if (m.material.transparent) { m.castShadow = false; if (!m.material.depthWrite) m.renderOrder = 1; }
    return g;
  }
}
