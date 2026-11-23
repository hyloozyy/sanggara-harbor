// Small hand-held weapon models built from boxes and cylinders, plus a HUD icon painter.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';

function part(geo, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  return m;
}

// Weapon points along +z from the hand (hand frame: arm points down -y; we rotate so barrel follows the forearm).
export function buildWeaponMesh(id) {
  if (id === 'fists') return null;
  const g = new THREE.Group();
  const metal = assets.material('metal-dark'), wood = assets.material('wood'), chrome = assets.material('chrome');
  const B = (sx, sy, sz) => new THREE.BoxGeometry(sx, sy, sz);
  if (id === 'pistol') {
    g.add(part(B(0.04, 0.05, 0.2), metal, 0, 0, 0.06));
    g.add(part(B(0.035, 0.1, 0.05), metal, 0, -0.06, -0.01, 0.2));
  } else if (id === 'smg') {
    g.add(part(B(0.05, 0.07, 0.36), metal, 0, 0, 0.1));
    g.add(part(B(0.03, 0.16, 0.04), metal, 0, -0.1, 0.12));
    g.add(part(B(0.035, 0.09, 0.05), metal, 0, -0.06, -0.02, 0.2));
    g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 6).rotateX(Math.PI / 2), chrome, 0, 0.01, 0.33));
  } else if (id === 'shotgun') {
    g.add(part(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8).rotateX(Math.PI / 2), metal, 0, 0.02, 0.28));
    g.add(part(B(0.05, 0.06, 0.26), wood, 0, -0.03, 0.18));
    g.add(part(B(0.05, 0.08, 0.26), wood, 0, -0.05, -0.12, 0.25));
  }
  // Orient: hand group's -y is along the forearm; barrel should point along -y.
  g.rotation.x = Math.PI / 2;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// Silhouette icon for the HUD weapon box.
export function paintWeaponIcon(canvas, id) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f6efe2';
  ctx.save();
  ctx.scale(canvas.width / 64, canvas.height / 30);
  if (id === 'fists') {
    ctx.beginPath(); ctx.roundRect(20, 6, 24, 18, 5); ctx.fill();
    ctx.fillStyle = '#333'; for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 6, 7, 1, 8);
  } else if (id === 'pistol') {
    ctx.fillRect(14, 8, 34, 7); ctx.fillRect(16, 13, 9, 13); ctx.fillRect(25, 15, 6, 2);
  } else if (id === 'smg') {
    ctx.fillRect(8, 9, 44, 8); ctx.fillRect(52, 11, 8, 3); ctx.fillRect(26, 16, 6, 12); ctx.fillRect(12, 16, 7, 9); ctx.fillRect(2, 10, 7, 4);
  } else if (id === 'shotgun') {
    ctx.fillRect(14, 10, 48, 4); ctx.fillRect(20, 14, 26, 4); ctx.beginPath(); ctx.moveTo(2, 20); ctx.lineTo(16, 12); ctx.lineTo(20, 16); ctx.lineTo(6, 26); ctx.fill();
  }
  ctx.restore();
}
