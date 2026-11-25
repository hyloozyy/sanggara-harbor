// Shared on-foot body for the player, pedestrians, police and gangsters: movement with collision,
// health and armour, hit reactions (flinch, knock-down), ragdoll-style falling, and animation.
import * as THREE from 'three';
import { HumanoidModel } from './humanoid-model.js';
import { animateHumanoid } from './humanoid-animator.js';
import { groundHeightAt } from '../city/city-layout.js';
import { damp, angleDamp, clamp, smoothstep } from '../core/math-utils.js';
import { events } from '../core/event-bus.js';

let nextId = 1;

export class Character {
  constructor(look, x, z, { health = 100, faction = 'civilian', name = null, atlasSize = 256 } = {}) {
    this.id = nextId++;
    this.model = new HumanoidModel(look, { atlasSize });
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
    if (this.stagger > 0) { wishX *= 0.15; wishZ *= 0.15; }
    if (this.jumpPrep > 0) {
      this.jumpPrep -= dt;
      if (this.jumpPrep <= 0) { this.jumpPrep = 0; if (this.grounded && this.alive && this.knock <= 0) { this.vy = 6.2; this.grounded = false; this.pos.y += 0.02; } }
    }
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
    if (this.grounded && !this.wasGrounded) this.landVy = this.lastVy || 0;
    this.wasGrounded = this.grounded; this.lastVy = this.vy;
    if (world) world.collision.resolveCircle(this.pos, this.radius, this.pos.y + 0.3);
    if (faceHeading !== null) this.heading = angleDamp(this.heading, faceHeading, turnRate, dt);
    else if (Math.hypot(wishX, wishZ) > 0.3) this.heading = angleDamp(this.heading, Math.atan2(wishX, wishZ), turnRate, dt);
  }

  // A short crouch before the takeoff (the legs load up), then the jump itself.
  jump() { if (this.grounded && this.alive && !(this.jumpPrep > 0)) this.jumpPrep = 0.09; }

  // Damage with armour absorbing first; returns true if this hit killed.
  hit(amount, from = null, { knockback = 0, cause = 'bullet', attacker = null } = {}) {
    if (!this.alive) return false;
    if (this.faction === 'player') amount *= this.damageScale ?? 0.5; // the hero is tougher than everyone else
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, amount * 0.7);
      this.armour -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    this.flinch = 0.25;
    if (from) {
      // Remember where the blow came from: the body recoils away from it and falls that way.
      const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
      const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
      this.hitBack = (dx * fx + dz * fz) / d < 0.2 ? 1 : -1;      // +1: pushed backwards
      this.hitSide = (dx * fz - dz * fx) / d;
      const k = Math.min(1, 0.35 + amount / 40);
      this.model.anim.kick = [[3, -3.5 * k * this.hitBack, this.hitSide * 2 * k, 0], [5, -2.5 * k * this.hitBack, this.hitSide * 3 * k, 0], [2, -1.2 * k * this.hitBack, 0, this.hitSide * 1.2 * k]];
      if (knockback > 0) {
        this.vel.x += dx / d * knockback; this.vel.z += dz / d * knockback;
        if (knockback > 5) { this.knock = this.knockTotal = 1.5; this.vy = Math.min(5, knockback * 0.35); }
        else if (knockback >= 2) this.stagger = 0.55;
      }
    }
    events.emit('character-hit', { character: this, amount, cause, attacker });
    if (this.health <= 0) { this.die(attacker, cause); return true; }
    return false;
  }

  // Set the head's look direction towards a world point (null to look ahead).
  lookAt(x, z, y = null) {
    if (x == null) { this.lookYaw = undefined; this.lookPitch = 0; return; }
    const a = Math.atan2(x - this.pos.x, z - this.pos.z) - this.heading;
    this.lookYaw = Math.atan2(Math.sin(a), Math.cos(a));
    if (Math.abs(this.lookYaw) > 1.6) this.lookYaw = undefined;
    this.lookPitch = y == null ? 0 : Math.atan2(this.headY - y, Math.hypot(x - this.pos.x, z - this.pos.z)) * 0.6;
  }

  dispose() { this.model.dispose(); }

  die(attacker = null, cause = 'bullet') {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.state = 'dead';
    this.fallT = 0;
    this.deadTime = 0;
    this.fallDir = this.hitBack ?? (Math.random() < 0.6 ? 1 : -1);
    this.fallSide = clamp((this.hitSide ?? 0) + (Math.random() - 0.5) * 0.6, -1, 1);
    events.emit('character-died', { character: this, attacker, cause });
  }

  // Pose the mesh: animation state plus falls and flinches.
  updateVisual(dt, speedOverride = null) {
    const speed = speedOverride ?? Math.hypot(this.vel.x, this.vel.z);
    const sc = this.mesh.scale.y || 1;
    if (!this.alive) {
      // Collapse: the knees give, the body tips over (accelerating like a falling pole), hits
      // the ground with a small rebound and the limbs settle.
      this.deadTime += dt;
      this.fallT = Math.min(1, this.fallT + dt * 2.2);
      const t = this.deadTime, dir = this.fallDir ?? 1;
      animateHumanoid(this.model, 'dead', 0, dt, { dead: true, down: { t, dir, side: this.fallSide || 0 } });
      const th = toppleAngle(t - 0.22);
      if (!this.landedThud && th > 1.5) { this.landedThud = true; this.model.anim.kick = [[3, dir * 4, 0, 0], [5, dir * 5, 0, 0], [9, 0, 0, 4], [12, 0, 0, -4], [15, -3, 0, 0], [18, -3, 0, 0]]; }
      this.mesh.rotation.set(-dir * th, this.heading, (this.fallSide || 0) * 0.12 * (th / 1.57), 'YXZ');
      this.mesh.position.set(this.pos.x, this.pos.y + (dir > 0 ? 0.1 : 0.12) * Math.sin(th) * sc, this.pos.z);
      return;
    }
    if (this.knock > 0) {
      // Knocked down: thrown off the feet, a beat on the ground, then up again.
      this.knock -= dt;
      const total = this.knockTotal || 1.2;
      const e = total - Math.max(0, this.knock);
      const getUp = smoothstep(total - 0.6, total, e);
      const dir = this.hitBack ?? 1;
      const th = Math.min(1.5, toppleAngle(e * 1.6)) * (1 - smoothstep(0.15, 1, getUp));
      animateHumanoid(this.model, 'dead', 0, dt, { down: { t: 0.3 + e * 1.5, dir, side: this.hitSide || 0, getUp } });
      this.mesh.rotation.set(-dir * th, this.heading, 0, 'YXZ');
      this.mesh.position.set(this.pos.x, this.pos.y + 0.1 * Math.sin(th) * sc, this.pos.z);
      return;
    }
    if (!this.mesh.visible) { this.mesh.position.copy(this.pos); return; } // far away: not drawn, not posed
    this.flinch = Math.max(0, this.flinch - dt);
    this.stagger = Math.max(0, (this.stagger || 0) - dt);
    this.punchT = Math.min(1.2, this.punchT + dt * 3.2);
    let anim = this.anim;
    if (anim === 'auto') anim = speed > 4.2 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
    if (this.punchT < 1) anim = 'punch';
    if (this.aiming && anim !== 'punch') anim = speed > 0.4 ? 'aim-walk' : 'aim';
    const turnRate = this.lastHeading == null || dt <= 0 ? 0 : Math.atan2(Math.sin(this.heading - this.lastHeading), Math.cos(this.heading - this.lastHeading)) / dt;
    this.lastHeading = this.heading;
    this.talk = Math.max(0, (this.talk || 0) - dt * 4);
    if (this.gesture) { this.gesture.t += dt / (this.gesture.dur || 1.4); if (this.gesture.t >= 1) this.gesture = null; }
    let handTarget = null;
    if (this.gesture?.kind === 'handshake' && this.gesture.with) {
      // Meet halfway between the two right hands, in this body's model space.
      const o = this.gesture.with;
      const mx = (this.pos.x + o.pos.x) / 2, mz = (this.pos.z + o.pos.z) / 2;
      const ex = mx - this.pos.x, ez = mz - this.pos.z, c = Math.cos(this.heading), s = Math.sin(this.heading);
      handTarget = { x: (ex * c - ez * s) / sc - 0.08, y: 1.02, z: (ex * s + ez * c) / sc };
    }
    animateHumanoid(this.model, anim, speed, dt, {
      vel: this.vel, heading: this.heading, scale: sc,
      aiming: this.aiming, twoHanded: this.twoHanded, pitch: this.aimPitch, punchT: this.punchT, melee: this.meleeKind, turnRate, flinch: this.flinch,
      talk: this.talk, umbrella: this.umbrella && !this.aiming, lookYaw: this.lookYaw, lookPitch: this.lookPitch,
      airborne: !this.grounded && Math.abs(this.vy) > 0.6, vy: this.vy, landVy: this.landVy, jumpPrep: this.jumpPrep > 0,
      drawT: this.drawT, reloadT: this.reloadT, recoil: this.recoil,
      reach: this.reach, reachLow: this.reachLow, reachArm: this.reachArm !== false,
      stagger: this.stagger, panic: this.panic, gesture: this.gesture, handTarget, listening: this.listening,
    });
    this.recoil = Math.max(0, (this.recoil || 0) - dt * 7);
    if (this.drawT != null && this.drawT < 1) this.drawT = Math.min(1, this.drawT + dt * 3.2);
    this.mesh.rotation.set(0, this.heading, 0, 'YXZ');
    this.mesh.position.copy(this.pos);
    this.fallSide = 0; this.landedThud = false;
  }

  // Play a short gesture: 'wave', 'nod', 'shrug' or 'handshake' (with another character).
  playGesture(kind, dur = 1.4, withChar = null) { this.gesture = { kind, t: 0, dur, with: withChar }; }
}

// Tip-over angle of a falling body t seconds after it starts to go: accelerates like a
// toppling pole, lands at 90 degrees with a small rebound.
function toppleAngle(t) {
  if (t <= 0) return 0;
  const T1 = 0.55;
  if (t < T1) { const u = t / T1; return 1.5708 * u * u * (0.6 + 0.4 * u); }
  const u = t - T1;
  return 1.5708 - 0.09 * Math.exp(-7 * u) * Math.abs(Math.sin(u * 14));
}
