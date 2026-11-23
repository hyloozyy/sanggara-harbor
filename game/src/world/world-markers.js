// Things that float in the world to guide play: glowing objective rings with light pillars,
// bobbing arrows over targets, checkpoint gates for races, and spinning pickups (cash, health,
// armour, weapons) that the player collects by walking or driving through them.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { buildWeaponMesh } from '../combat/weapon-meshes.js';
import { events } from '../core/event-bus.js';

const COLORS = { objective: 0xffc040, enemy: 0xff3030, vehicle: 0x40c0ff, race: 0x40ffc0, friend: 0x60ff80 };

function ringMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
}

export class WorldMarkers {
  constructor(scene) {
    this.scene = scene;
    this.markers = [];
    this.pickups = [];
    this.time = 0;
  }

  // Ground ring + light pillar at a location.
  addZone(x, z, { radius = 3, color = COLORS.objective, label = '', kind = 'objective' } = {}) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.2, 32, 1, true), ringMaterial(color));
    ring.position.y = 0.6;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.35, radius * 0.6, 40, 16, 1, true), ringMaterial(color));
    pillar.material.opacity = 0.12;
    pillar.position.y = 20;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 32).rotateX(-Math.PI / 2), ringMaterial(color));
    disc.material.opacity = 0.25;
    disc.position.y = 0.2;
    g.add(ring, pillar, disc);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const m = { kind, x, z, radius, group: g, ring, label, color };
    this.markers.push(m);
    return m;
  }

  // Arrow that follows an object (character body or vehicle).
  addArrow(target, color = COLORS.enemy) {
    const geo = new THREE.ConeGeometry(0.45, 0.9, 4).rotateX(Math.PI);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, fog: false }));
    this.scene.add(mesh);
    const m = { kind: 'arrow', target, group: mesh, color };
    this.markers.push(m);
    return m;
  }

  remove(m) {
    if (!m) return;
    this.scene.remove(m.group);
    const i = this.markers.indexOf(m);
    if (i >= 0) this.markers.splice(i, 1);
  }

  clear(kind = null) {
    for (const m of [...this.markers]) if (!kind || m.kind === kind) this.remove(m);
  }

  addPickup(type, x, z, amount = 0) {
    let mesh;
    if (type === 'cash') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.28), assets.emissive(0x58d068, 1.5));
    else if (type === 'health') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), assets.emissive(0xff4040, 1.5));
    else if (type === 'armour') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.2), assets.emissive(0x4080ff, 1.5));
    else if (type === 'shell') { mesh = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1.2), assets.emissive(0xffc040, 2.2)); }
    else if (type === 'ledger') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.55), assets.emissive(0x8a4a1a, 1.2));
    else { mesh = new THREE.Group(); const w = buildWeaponMesh(type); if (w) { w.scale.setScalar(2.2); w.rotation.set(0, 0, Math.PI / 2); mesh.add(w); } }
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24).rotateX(Math.PI / 2), ringMaterial(type === 'cash' ? 0x60ff80 : type === 'health' ? 0xff6060 : type === 'armour' ? 0x60a0ff : 0xffd060));
    const g = new THREE.Group();
    g.add(mesh, halo);
    g.position.set(x, 0.9, z);
    this.scene.add(g);
    const p = { type, x, z, amount, group: g, mesh, ttl: type === 'cash' ? 60 : Infinity };
    this.pickups.push(p);
    return p;
  }

  update(dt, player) {
    this.time += dt;
    for (const m of this.markers) {
      if (m.kind === 'arrow') {
        const t = m.target;
        const p = t.pos;
        const alive = t.alive !== false && !(t.wrecked);
        m.group.visible = alive;
        m.group.position.set(p.x, (t.spec ? 3.2 : 2.6) + Math.sin(this.time * 4) * 0.2 + (t.y || p.y || 0), p.z);
        m.group.rotation.y += dt * 2;
      } else {
        m.ring.scale.y = 1 + Math.sin(this.time * 3) * 0.15;
        m.group.children[0].material.opacity = 0.45 + Math.sin(this.time * 3) * 0.15;
      }
    }
    for (const p of [...this.pickups]) {
      p.group.rotation.y += dt * 2;
      p.group.position.y = 0.9 + Math.sin(this.time * 3 + p.x) * 0.15;
      p.ttl -= dt;
      const d = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      if (d < (player.vehicle ? 2.5 : 1.3) || p.ttl <= 0) {
        this.scene.remove(p.group);
        this.pickups.splice(this.pickups.indexOf(p), 1);
        if (p.ttl > 0) events.emit('pickup', p);
      }
    }
  }
}

export const MARKER_COLORS = COLORS;
