// A drivable vehicle: arcade bicycle-model physics with weight transfer, handbrake drifting,
// collisions against the city, damage with smoke, fire and explosions, lights and sirens.
import * as THREE from 'three';
import { buildVehicleMesh } from './car-mesh-factory.js';
import { assets } from '../assets/asset-library.js';
import { clamp, damp, wrapAngle } from '../core/math-utils.js';
import { groundHeightAt } from '../city/city-layout.js';
import { events } from '../core/event-bus.js';

let nextId = 1;
let blobGeo = null, blobMat = null;
function contactShadowGeometry() { return blobGeo || (blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)); }
function contactShadowMaterial() {
  if (!blobMat) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  }
  return blobMat;
}
const burnt = () => assets.material('metal-dark');

export class Vehicle {
  constructor(spec, modelKey, color, x, z, heading) {
    this.id = nextId++;
    this.spec = spec;
    this.modelKey = modelKey;
    this.color = color;
    const built = buildVehicleMesh(spec, color);
    Object.assign(this, { mesh: built.root, body: built.body, wheels: built.wheels, seat: built.seat, sirens: built.sirens });
    this.brakeMeshes = built.brakeMeshes;
    this.headMeshes = built.headMeshes;
    this.mesh.userData.vehicle = this;
    // Soft contact shadow that grounds the car even where the sun's shadow falls elsewhere.
    const blob = new THREE.Mesh(contactShadowGeometry(), contactShadowMaterial());
    blob.scale.set(spec.width * 1.35, 1, spec.length * 1.15);
    blob.position.y = 0.03;
    blob.renderOrder = 1;
    this.mesh.add(blob);
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.heading = heading;
    this.angVel = 0;
    this.steer = 0;
    this.speed = 0;          // forward speed (m/s), signed
    this.lateral = 0;
    this.health = spec.health;
    this.wrecked = false;
    this.burnTimer = 0;
    this.driver = null;      // 'player', or an NPC driver record
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.sirenOn = false;
    this.sirenPhase = Math.random() * 6;
    this.wheelSpin = 0;
    this.radius = spec.length / 2;
    this.drifting = false;
    this.lastImpact = 0;
    this.pitch = 0; this.roll = 0;
    this.y = 0;
    this.isPolice = !!spec.police;
    this.braking = false;
    this.syncMesh();
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  // Circles approximating the body footprint, for collisions.
  footprint() {
    const s = this.spec, n = s.twoWheel ? 2 : 3, r = s.twoWheel ? 0.45 : s.width / 2;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (s.length - r * 2);
      out.push({ x: this.pos.x + fx * t, z: this.pos.z + fz * t, r, t });
    }
    return out;
  }

  update(dt, world) {
    const s = this.spec;
    const c = this.wrecked ? { throttle: 0, steer: 0, handbrake: true } : this.controls;
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = Math.cos(this.heading), rz = -Math.sin(this.heading);
    let vF = this.vel.x * fx + this.vel.z * fz;
    let vL = this.vel.x * rx + this.vel.z * rz;
    const damageFactor = 0.55 + 0.45 * clamp(this.health / s.health, 0, 1);

    // Steering eases in and is reduced at speed.
    const steerTarget = c.steer * 0.62 / (1 + Math.abs(vF) / 12);
    this.steer = damp(this.steer, steerTarget, 8, dt);

    const prevF = vF;
    this.braking = false;
    if (c.throttle > 0.05) {
      if (vF < -0.5) { vF = Math.min(0, vF + 16 * dt); this.braking = true; }
      else vF += s.accel * damageFactor * c.throttle * Math.max(0, 1 - vF / (s.maxSpeed * damageFactor)) * dt;
    } else if (c.throttle < -0.05) {
      if (vF > 0.5) { vF = Math.max(0, vF - 18 * dt * -c.throttle); this.braking = true; }
      else vF = Math.max(-11, vF - s.accel * 0.55 * -c.throttle * dt);
    } else {
      const coast = Math.min(Math.abs(vF), (1.4 + Math.abs(vF) * 0.04) * dt);
      vF -= Math.sign(vF) * coast;
    }
    vF -= vF * Math.abs(vF) * 0.0006 * dt;

    let grip = s.grip;
    if (c.handbrake) {
      grip = 1.1;
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), 5 * dt);
      this.braking = true;
    } else {
      grip *= 1 - 0.45 * clamp(Math.abs(this.steer) * Math.abs(vF) / 14, 0, 1) * (Math.abs(vF) > 20 ? 1 : 0.3);
    }
    vL *= Math.exp(-grip * dt);
    this.drifting = Math.abs(vL) > 3.2 && Math.abs(vF) > 8;

    let yawTarget = vF * Math.tan(this.steer) / s.wheelbase * (c.handbrake ? 1.45 : 1);
    // Tyres can only give so much sideways grip (about 2.2 g); beyond that the car understeers,
    // unless the handbrake breaks traction on purpose.
    if (!c.handbrake && Math.abs(vF) > 1) {
      const maxYaw = (s.grip * 2.9) / Math.abs(vF);
      yawTarget = clamp(yawTarget, -maxYaw, maxYaw);
    }
    this.angVel = damp(this.angVel, yawTarget, c.handbrake ? 4 : 9, dt);
    this.heading = wrapAngle(this.heading + this.angVel * dt);

    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nrx = Math.cos(this.heading), nrz = -Math.sin(this.heading);
    this.vel.set(nfx * vF + nrx * vL, 0, nfz * vF + nrz * vL);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.speed = vF;
    this.lateral = vL;

    // Weight transfer for the body.
    const accel = (vF - prevF) / Math.max(dt, 1e-4);
    this.pitch = damp(this.pitch, clamp(-accel * 0.006, -0.06, 0.06), 6, dt);
    this.roll = damp(this.roll, clamp(-this.angVel * vF * 0.0035, -0.08, 0.08), 6, dt);

    if (world) this.collideWorld(world.collision);
    this.y = damp(this.y, groundHeightAt(this.pos.x, this.pos.z), 14, dt);

    this.wheelSpin += vF / s.wheelRadius * dt;
    if (this.sirenOn) this.sirenPhase += dt * 9;
    if (this.wrecked) this.burnTimer += dt;
    this.syncMesh();
  }

  collideWorld(collision) {
    const fp = this.footprint();
    let worst = null;
    for (const c of fp) {
      const p = { x: c.x, z: c.z };
      const hit = collision.resolveCircle(p, c.r, 0.5);
      if (hit) {
        this.pos.x += p.x - c.x;
        this.pos.z += p.z - c.z;
        if (!worst || hit.depth > worst.depth) worst = { ...hit, t: c.t };
      }
    }
    if (worst) {
      const vn = this.vel.x * worst.nx + this.vel.z * worst.nz;
      if (vn < 0) {
        this.vel.x -= worst.nx * vn * 1.35;
        this.vel.z -= worst.nz * vn * 1.35;
        this.vel.multiplyScalar(0.82);
        const impact = -vn;
        // Glancing blows spin the car a little.
        this.angVel += clamp(worst.t * impact * 0.05, -2, 2) * Math.sign(this.vel.x * worst.nz - this.vel.z * worst.nx || 1);
        if (impact > 5) this.damage(impact * impact * 0.55, 'crash', { x: this.pos.x - worst.nx * this.radius, z: this.pos.z - worst.nz * this.radius, impact });
      }
    }
  }

  damage(amount, cause = 'hit', at = null) {
    if (this.wrecked) return;
    this.health -= amount;
    this.lastImpact = amount;
    events.emit('vehicle-damaged', { vehicle: this, amount, cause, at });
    if (this.health / this.spec.health < 0.6 && this.headMeshes.length) {
      // A smashed headlight goes dark.
      const hl = this.headMeshes.pop();
      hl.material = assets.material('traffic-off');
    }
    if (this.health <= 0) this.explode();
  }

  explode() {
    if (this.wrecked) return;
    this.wrecked = true;
    this.health = 0;
    this.sirenOn = false;
    this.body.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) o.material = burnt(); });
    for (const m of [...this.brakeMeshes, ...this.headMeshes]) m.material = assets.material('traffic-off');
    this.vel.y = 0;
    events.emit('explosion', { x: this.pos.x, y: 1, z: this.pos.z, power: 1, source: this });
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, this.y, this.pos.z);
    this.mesh.rotation.y = this.heading;
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.spec.twoWheel ? clamp(-this.angVel * this.speed * 0.02, -0.5, 0.5) : this.roll;
    for (const w of this.wheels) {
      w.spin.rotation.x = this.wheelSpin;
      if (w.front) w.pivot.rotation.y = this.steer * 1.4;
    }
    if (this.spec.twoWheel) this.mesh.rotation.z = 0;
    const brakeOn = this.braking || this.controls.throttle < -0.05;
    for (const m of this.brakeMeshes) m.material = assets.material(brakeOn && !this.wrecked ? 'brakelight' : 'taillight');
    if (this.sirens) {
      const on = this.sirenOn;
      const a = Math.sin(this.sirenPhase) > 0;
      this.sirens.red.emissiveIntensity = on ? (a ? 14 : 0.2) : 0.1;
      this.sirens.blue.emissiveIntensity = on ? (a ? 0.2 : 16) : 0.1;
    }
  }
}
