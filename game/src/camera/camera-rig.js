// Third-person camera: mouse orbit on foot with an over-the-shoulder aim mode, a chase camera
// in vehicles that swings behind the car and widens with speed, wall avoidance and screen shake.
import * as THREE from 'three';
import { clamp, damp, angleDamp, wrapAngle } from '../core/math-utils.js';

export class CameraRig {
  constructor(camera, collision) {
    this.camera = camera;
    this.collision = collision;
    this.yaw = Math.PI;      // camera looks along +z when yaw = 0 (we sit behind the target)
    this.pitch = 0.18;
    this.distance = 4.6;
    this.shake = 0;
    this.sensitivity = 0.0024;
    this.invertY = false;
    this.fov = 62;
    this.idleMouse = 0;
    this.target = new THREE.Vector3();
    this.current = new THREE.Vector3();
    this.lookPoint = new THREE.Vector3();
    this.mode = 'foot';
    this.override = null;    // scripted camera for cut-scenes and screenshots
  }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  // Direction the camera faces on the ground plane (for camera-relative movement).
  get forward() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  update(dt, player, input) {
    if (this.override) { this.applyOverride(); return; }
    const mdx = input.mouseDX, mdy = input.mouseDY;
    const sens = this.sensitivity * Math.min(1, this.fov / 62); // finer aim through a scope
    this.yaw -= mdx * sens;
    this.pitch = clamp(this.pitch + mdy * sens * (this.invertY ? -1 : 1), -0.6, 1.1);
    this.idleMouse = Math.abs(mdx) + Math.abs(mdy) > 0 ? 0 : this.idleMouse + dt;

    const v = player.vehicle;
    let dist, height, shoulder = 0, fov = 62, lookH;
    if (v) {
      this.mode = 'vehicle';
      const speed = Math.abs(v.speed);
      // Swing behind the car's travel direction when the mouse is idle.
      if (this.idleMouse > 1.2 && speed > 2) {
        const travel = v.speed >= -0.5 ? v.heading : wrapAngle(v.heading + Math.PI);
        this.yaw = angleDamp(this.yaw, travel, 2.6, dt);
        this.pitch = damp(this.pitch, 0.2, 2, dt);
      }
      const big = v.spec.length > 4.8 ? 1.6 : v.spec.twoWheel ? -2.5 : 0;
      dist = 6.6 + big + speed * 0.05;
      height = 2.0;
      lookH = 1.4;
      fov = 64 + Math.min(14, speed * 0.28);
      this.target.set(v.pos.x, v.y, v.pos.z);
    } else {
      this.mode = player.aiming ? 'aim' : 'foot';
      dist = player.aiming ? 2.7 : 4.4;
      shoulder = player.aiming ? 1.0 : 0.35;
      height = 1.62;
      lookH = 1.55;
      const zoom = player.aiming ? (player.arsenal?.weapon?.zoom || 1) : 1;
      fov = player.aiming ? 50 / zoom : 62;
      if (zoom > 1) { dist = 1.6; shoulder = 0.55; }
      this.target.set(player.pos.x, player.pos.y, player.pos.z);
    }
    this.distance = damp(this.distance, dist, 6, dt);
    this.fov = damp(this.fov, fov, 6, dt);

    // Smooth follow of the pivot.
    if (this.current.lengthSq() === 0) this.current.copy(this.target);
    this.current.x = damp(this.current.x, this.target.x, v ? 12 : 20, dt);
    this.current.y = damp(this.current.y, this.target.y, 10, dt);
    this.current.z = damp(this.current.z, this.target.z, v ? 12 : 20, dt);

    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = -fz, rz = fx; // camera right
    const pivotX = this.current.x + rx * shoulder, pivotZ = this.current.z + rz * shoulder, pivotY = this.current.y + height;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let dx = -fx * cp, dy = sp, dz = -fz * cp;
    // Pull in when a wall is between the pivot and the camera.
    const hit = this.collision.raycast(pivotX, pivotY, pivotZ, dx, dy, dz, this.distance + 0.4);
    const d = Math.max(0.8, Math.min(this.distance, hit - 0.4));
    let camX = pivotX + dx * d, camY = Math.max(0.4, pivotY + dy * d), camZ = pivotZ + dz * d;

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const s = this.shake * this.shake * 0.35;
      camX += (Math.random() - 0.5) * s; camY += (Math.random() - 0.5) * s; camZ += (Math.random() - 0.5) * s;
    }
    this.camera.position.set(camX, camY, camZ);
    this.lookPoint.set(pivotX + fx * 10 * cp, pivotY - sp * 4 + (lookH - height), pivotZ + fz * 10 * cp);
    this.camera.lookAt(this.lookPoint);
    if (Math.abs(this.camera.fov - this.fov) > 0.05) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }

  applyOverride() {
    const o = this.override;
    this.camera.position.set(o.x, o.y, o.z);
    this.camera.lookAt(o.tx, o.ty, o.tz);
    if (o.fov && this.camera.fov !== o.fov) { this.camera.fov = o.fov; this.camera.updateProjectionMatrix(); }
  }

  // World-space aim ray from the screen centre.
  aimRay() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return { origin: this.camera.position.clone(), dir };
  }
}
