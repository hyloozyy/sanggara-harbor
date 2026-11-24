// The small physical details of gunfire: brass shell casings ejected to the right of the gun that
// bounce and settle on the ground (one instanced mesh), spent magazines that drop out of the gun on
// a reload and clatter to the floor, the reload animation itself (magazine out, fresh one in; the
// revolver's cylinder swings out; the shotgun pumps), and a wisp of muzzle smoke.
import * as THREE from 'three';
import { weaponMaterials } from './weapon-meshes.js';
import { groundHeightAt } from '../city/city-layout.js';

const MAX = 90;
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(1, 1, 1), tmpV = new THREE.Vector3();

export class WeaponFx {
  constructor(scene, sound) {
    this.scene = scene;
    this.sound = sound;
    const geo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.022, 6);
    this.casings = new THREE.InstancedMesh(geo, weaponMaterials().brass, MAX);
    this.casings.count = 0;
    this.casings.frustumCulled = false;
    this.casings.castShadow = false;
    scene.add(this.casings);
    this.list = [];
    this.mags = [];
    // Bullet marks on the ground: small dark chips with a dusty rim.
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), grd = g.createRadialGradient(16, 16, 1, 16, 16, 15);
    grd.addColorStop(0, 'rgba(10,8,6,0.95)'); grd.addColorStop(0.35, 'rgba(30,26,22,0.8)'); grd.addColorStop(0.6, 'rgba(120,110,95,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.14, 0.14).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 1 }), 64);
    this.marks.count = 0; this.marks.frustumCulled = false; this.markIndex = 0;
    scene.add(this.marks);
  }

  mark(x, y, z) {
    const i = this.markIndex++ % 64;
    tmpQ.setFromEuler(tmpE.set(0, Math.random() * 6.28, 0));
    this.marks.setMatrixAt(i, tmpM.compose(tmpV.set(x, y + 0.01, z), tmpQ, tmpS.setScalar(0.7 + Math.random() * 0.6)));
    this.marks.count = Math.min(64, this.markIndex);
    this.marks.instanceMatrix.needsUpdate = true;
  }

  // Eject a casing from the gun held by `shooter` (to its right and up).
  eject(shooter, big = false) {
    const item = shooter.model?.heldItem;
    if (!item) return;
    item.getWorldPosition(tmpV);
    const rx = Math.cos(shooter.heading), rz = -Math.sin(shooter.heading);
    const c = { x: tmpV.x, y: tmpV.y + 0.05, z: tmpV.z, vx: -rx * (1.6 + Math.random()), vy: 2 + Math.random() * 1.2, vz: -rz * (1.6 + Math.random()), rx: Math.random() * 6, ry: Math.random() * 6, spin: 12 + Math.random() * 10, life: 8, rest: false, big, bounces: 0 };
    if (this.list.length >= MAX) this.list.shift();
    this.list.push(c);
  }

  // A spent magazine falls from the gun.
  dropMag(item) {
    const mag = item?.getObjectByName('mag');
    if (!mag) return;
    const m = mag.clone();
    mag.getWorldPosition(m.position);
    mag.getWorldQuaternion(m.quaternion);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -0.2, (Math.random() - 0.5) * 0.6);
    m.userData.life = 6;
    this.scene.add(m);
    this.mags.push(m);
  }

  // Reload animation on the held weapon; t runs 0 -> 1 over the reload.
  animateReload(item, t, weaponId) {
    if (!item) return;
    const mag = item.getObjectByName('mag'), pump = item.getObjectByName('pump');
    if (weaponId === 'revolver' && mag) {
      const out = t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1;
      mag.position.copy(mag.userData.home).add(tmpV.set(out * 0.035, -out * 0.012, 0));
      mag.rotation.z = out * 1.2 + (t > 0.3 && t < 0.8 ? (t - 0.3) * 8 : 0);
    } else if (weaponId === 'shotgun' && pump) {
      const k = Math.abs(Math.sin(t * Math.PI * 4));
      pump.position.copy(pump.userData.home).add(tmpV.set(0, 0, -k * 0.06));
    } else if (mag) {
      // Out and down (0 - 0.3), hidden (0.3 - 0.55), the new one slides up and seats (0.55 - 0.85).
      if (t < 0.3) { mag.visible = true; mag.position.copy(mag.userData.home).add(tmpV.set(0, -t / 0.3 * 0.12, 0)); }
      else if (t < 0.55) mag.visible = false;
      else { mag.visible = true; const k = Math.min(1, (t - 0.55) / 0.3); mag.position.copy(mag.userData.home).add(tmpV.set(0, -(1 - k) * 0.14, 0)); }
    }
  }

  resetReload(item) {
    if (!item) return;
    for (const name of ['mag', 'pump']) {
      const o = item.getObjectByName(name);
      if (o && o.userData.home) { o.position.copy(o.userData.home); o.rotation.z = 0; o.visible = true; }
    }
  }

  update(dt) {
    let n = 0;
    for (const c of this.list) {
      c.life -= dt;
      if (!c.rest) {
        c.vy -= 9.8 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
        c.rx += c.spin * dt; c.ry += c.spin * 0.7 * dt;
        const gy = groundHeightAt(c.x, c.z) + 0.005;
        if (c.y < gy) {
          c.y = gy; c.bounces++;
          if (c.bounces === 1 && this.sound && Math.random() < 0.6) this.sound.tinkle?.(c.x, c.z);
          if (c.bounces > 2 || Math.abs(c.vy) < 0.6) { c.rest = true; c.rx = Math.PI / 2; } else { c.vy = -c.vy * 0.35; c.vx *= 0.5; c.vz *= 0.5; c.spin *= 0.5; }
        }
      }
      if (c.life <= 0) continue;
      tmpQ.setFromEuler(tmpE.set(c.rx, c.ry, 0));
      tmpS.setScalar(c.big ? 1.6 : 1);
      this.casings.setMatrixAt(n++, tmpM.compose(tmpV.set(c.x, c.y, c.z), tmpQ, tmpS));
    }
    this.list = this.list.filter((c) => c.life > 0);
    this.casings.count = n;
    this.casings.instanceMatrix.needsUpdate = true;
    for (const m of [...this.mags]) {
      const v = m.userData.v;
      m.userData.life -= dt;
      if (m.position.y > groundHeightAt(m.position.x, m.position.z) + 0.02) {
        v.y -= 9.8 * dt;
        m.position.addScaledVector(v, dt);
        m.rotation.x += dt * 3;
        if (m.position.y <= groundHeightAt(m.position.x, m.position.z) + 0.02) { m.position.y = groundHeightAt(m.position.x, m.position.z) + 0.02; this.sound?.clatter?.(m.position.x, m.position.z); }
      }
      if (m.userData.life <= 0) { this.scene.remove(m); this.mags.splice(this.mags.indexOf(m), 1); }
    }
  }
}
