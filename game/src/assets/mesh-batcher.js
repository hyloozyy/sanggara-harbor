// Collects many transformed geometries and merges them into one mesh per material,
// cutting the city down to a few hundred draw calls.
import * as THREE from 'three';

export function mergeGeometries(list) {
  let vertexCount = 0, indexCount = 0;
  const prepared = list.map(({ geometry, matrix }) => {
    const g = geometry.index ? geometry : geometry;
    const pos = g.attributes.position;
    vertexCount += pos.count;
    indexCount += g.index ? g.index.count : pos.count;
    return { g, matrix };
  });
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0, hasColor = false;
  for (const { g, matrix } of prepared) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color;
    if (col) hasColor = true;
    nm.getNormalMatrix(matrix);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      positions.set([v.x, v.y, v.z], (vo + i) * 3);
      if (nor) { n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); normals.set([n.x, n.y, n.z], (vo + i) * 3); }
      if (uv) { uvs[(vo + i) * 2] = uv.getX(i); uvs[(vo + i) * 2 + 1] = uv.getY(i); }
      if (col) colors.set([col.getX(i), col.getY(i), col.getZ(i)], (vo + i) * 3);
      else colors.set([1, 1, 1], (vo + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) index[io++] = g.index.getX(i) + vo;
    else for (let i = 0; i < pos.count; i++) index[io++] = vo + i;
    vo += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (hasColor) out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

export class MeshBatcher {
  constructor() { this.buckets = new Map(); }

  add(geometry, material, matrix) {
    if (!this.buckets.has(material)) this.buckets.set(material, []);
    this.buckets.get(material).push({ geometry, matrix: matrix.clone() });
  }

  addAt(geometry, material, x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
      new THREE.Vector3(sx, sy, sz),
    );
    this.add(geometry, material, m);
  }

  build({ castShadow = true, receiveShadow = true, name = 'batch' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [material, list] of this.buckets) {
      // Split very large buckets to keep indices and culling sensible.
      for (let start = 0; start < list.length; start += 400) {
        const mesh = new THREE.Mesh(mergeGeometries(list.slice(start, start + 400)), material);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
      }
    }
    this.buckets.clear();
    return group;
  }
}
