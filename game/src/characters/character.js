// Shared on-foot body for the player, pedestrians, police and gangsters: movement with collision,
// health and armour, hit reactions (flinch, knock-down), ragdoll-style falling, and animation.
import * as THREE from 'three';
import { HumanoidModel } from './humanoid-model.js';
import { animateHumanoid } from './humanoid-animator.js';
import { groundHeightAt } from '../city/city-layout.js';
import { damp, angleDamp, clamp } from '../core/math-utils.js';
import { events } from '../core/event-bus.js';

let nextId = 1;

export class Character {
  constructor(look, x, z, { health = 100, faction = 'civilian', name = null } = {}) {
    this.id = nextId++;
    this.model = new HumanoidModel(look);
    this.mesh = this.model.root;
    this.mesh.userData.character = this;
    this.pos = new THREE.Vector3(x, groundHeightAt(x, z), z);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.radius = 0.38;
    this.health = health;
    this.maxHealth = health;
    this.armour = 0;
    this.faction = faction;
    this.name = name;
    this.alive = true;
    this.state = 'idle';
    this.anim = 'idle';
    this.vy = 0;
    this.grounded = true;
    this.knock = 0;          // knock-down timer
    this.fallT = 0;
    this.flinch = 0;
    this.punchT = 1;
    this.aiming = false;
    this.twoHanded = false;
    this.aimPitch = 0;
    this.vehicle = null;
    this.deadTime = 0;
  }

  get headY() { return this.pos.y + 1.68 * this.mesh.scale.y; }
  get chestY() { return this.pos.y + 1.25 * this.mesh.scale.y; }

  // Move with desired horizontal velocity; handles gravity, collision and facing.
  move(dt, world, wishX, wishZ, faceHeading = null, turnRate = 12) {
    if (this.knock > 0 || !this.alive) { wishX = 0; wishZ = 0; }
    const accel = this.grounded ? 14 : 3;
    this.vel.x = damp(this.vel.x, wishX, accel, dt);
    this.vel.z = damp(this.vel.z, wishZ, accel, dt);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    const ground = groundHeightAt(this.pos.x, this.pos.z);
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= ground) { this.pos.y = damp(this.pos.y, ground, 30, dt); if (this.pos.y < ground) this.pos.y = ground; this.vy = 0; this.grounded = true; }
    else this.grounded = this.pos.y - ground < 0.05;
    if (world) world.collision.resolveCircle(this.pos, this.radius, this.pos.y + 0.3);
    if (faceHeading !== null) this.heading = angleDamp(this.heading, faceHeading, turnRate, dt);
    else if (Math.hypot(wishX, wishZ) > 0.3) this.heading = angleDamp(this.heading, Math.atan2(wishX, wishZ), turnRate, dt);
  }

  jump() { if (this.grounded && this.alive) { this.vy = 6.2; this.grounded = false; } }

  // Damage with armour absorbing first; returns true if this hit killed.
  hit(amount, from = null, { knockback = 0, cause = 'bullet', attacker = null } = {}) {
    if (!this.alive) return false;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, amount * 0.7);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.flinch = 0.25;
    if (from && knockback > 0) {
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
      this.vel.x += dx / d * knockback; this.vel.z += dz / d * knockback;
      if (knockback > 5) { this.knock = 1.2; this.vy = Math.min(5, knockback * 0.35); }
    }
    events.emit('character-hit', { character: this, amount, cause, attacker });
    if (this.health <= 0) { this.die(attacker, cause); return true; }
    return false;
  }

  die(attacker = null, cause = 'bullet') {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.state = 'dead';
    this.fallT = 0;
    this.deadTime = 0;
    events.emit('character-died', { character: this, attacker, cause });
  }

  // Pose the mesh: animation state plus falls and flinches.
  updateVisual(dt, speedOverride = null) {
    const speed = speedOverride ?? Math.hypot(this.vel.x, this.vel.z);
    if (!this.alive) {
      this.deadTime += dt;
      this.fallT = Math.min(1, this.fallT + dt * 2.2);
      animateHumanoid(this.model, 'dead', 0, dt);
      this.mesh.rotation.set(-Math.PI / 2 * easeOutBounce(this.fallT), this.heading, 0, 'YXZ');
      this.mesh.position.set(this.pos.x, this.pos.y + 0.18 * this.fallT, this.pos.z);
      return;
    }
    if (this.knock > 0) {
      this.knock -= dt;
      const t = clamp(this.knock / 1.2, 0, 1);
      const lie = Math.sin(t * Math.PI) * 1.4;
      this.mesh.rotation.set(-lie, this.heading, 0, 'YXZ');
      this.mesh.position.set(this.pos.x, this.pos.y + lie * 0.12, this.pos.z);
      animateHumanoid(this.model, 'dead', 0, dt);
      return;
    }
    this.flinch = Math.max(0, this.flinch - dt);
    this.punchT = Math.min(1.2, this.punchT + dt * 3.2);
    let anim = this.anim;
    if (anim === 'auto') anim = speed > 4.2 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
    if (this.punchT < 1) anim = 'punch';
    if (this.aiming && anim !== 'punch') anim = speed > 0.4 ? 'aim-walk' : 'aim';
    animateHumanoid(this.model, anim, speed, dt, { aiming: this.aiming, twoHanded: this.twoHanded, pitch: this.aimPitch, punchT: this.punchT });
    this.mesh.rotation.set(this.flinch * 0.6, this.heading, 0, 'YXZ');
    this.mesh.position.copy(this.pos);
  }
}

function easeOutBounce(t) {
  if (t < 0.7) return (t / 0.7) ** 2;
  const u = (t - 0.7) / 0.3;
  return 1 - Math.sin(u * Math.PI) * 0.08;
}
