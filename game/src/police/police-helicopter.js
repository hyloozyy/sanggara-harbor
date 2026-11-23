// Police helicopter "Elang-1": a modelled airframe with spinning rotors, navigation lights and a
// searchlight cone that sweeps for the player, circling overhead and tracking from the sky.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { damp, angleDamp } from '../core/math-utils.js';

function buildHelicopterMesh() {
  const root = new THREE.Group();
  const white = assets.carPaint(0xf0f0ea), blue = assets.carPaint(0x1a3f9e), dark = assets.material('metal-dark');
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 12).scale(1, 0.9, 1.7), white);
  cabin.castShadow = true;
  root.add(cabin);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.2).rotateX(Math.PI / 2.4), assets.material('glass-dark'));
  glass.position.set(0, 0.1, 1.1);
  root.add(glass);
  const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.42, 18, 4, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.12).scale(1, 0.9, 1.7), blue);
  root.add(stripe);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 5.2, 8).rotateX(Math.PI / 2), white);
  boom.position.set(0, 0.35, -4.2);
  boom.castShadow = true;
  root.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.9), blue);
  fin.position.set(0, 1.0, -6.6);
  root.add(fin);
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.6, 6).rotateX(Math.PI / 2), dark);
    skid.position.set(s * 1.0, -1.45, 0.2);
    root.add(skid);
    for (const z of [-0.8, 1.0]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), dark); st.position.set(s * 0.9, -1.2, z); root.add(st); }
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 6), dark);
  mast.position.y = 1.45;
  root.add(mast);
  const rotor = new THREE.Group();
  rotor.position.y = 1.7;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 5.6), dark);
    blade.position.z = 2.8;
    const arm = new THREE.Group();
    arm.rotation.y = (i / 4) * Math.PI * 2;
    arm.add(blade);
    rotor.add(arm);
  }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false }));
  rotor.add(disc);
  root.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.25, 1.0, -6.6);
  for (let i = 0; i < 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.14), dark); b.rotation.x = i * Math.PI / 2; tail.add(b); }
  root.add(tail);
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), assets.emissive(0xff2020, 10));
  red.position.set(-1.1, 0, -0.5);
  const green = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), assets.emissive(0x20ff40, 10));
  green.position.set(1.1, 0, -0.5);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), assets.emissive(0xffffff, 0).clone());
  strobe.position.set(0, -1.1, 0);
  root.add(red, green, strobe);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.4, 10), assets.emissive(0xfff6e0, 12));
  lamp.position.set(0, -1.2, 1.4);
  root.add(lamp);
  return { root, rotor, tail, strobe };
}

export class PoliceHelicopter {
  constructor(scene, x, z) {
    const m = buildHelicopterMesh();
    Object.assign(this, m);
    this.scene = scene;
    this.pos = new THREE.Vector3(x, 60, z);
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.orbit = Math.random() * Math.PI * 2;
    this.callsign = 'ELANG-1';
    this.health = 600;
    this.alive = true;
    this.spotted = false;
    scene.add(this.root);

    // Searchlight: a real spotlight plus a visible additive beam cone.
    this.spot = new THREE.SpotLight(0xfff2d8, 900, 140, 0.2, 0.45, 1.2);
    this.spot.castShadow = false;
    scene.add(this.spot, this.spot.target);
    const coneGeo = new THREE.ConeGeometry(7, 1, 24, 1, true).translate(0, -0.5, 0);
    this.beam = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.beam.frustumCulled = false;
    scene.add(this.beam);
    this.aim = new THREE.Vector3(x, 0, z);
    this.time = 0;
  }

  update(dt, target, searchCenter, sees) {
    this.time += dt;
    // Orbit the player when tracking, sweep the search area when not.
    this.orbit += dt * 0.25;
    const c = sees ? target : searchCenter;
    const r = sees ? 28 : 45;
    const goal = new THREE.Vector3(c.x + Math.cos(this.orbit) * r, 42 + Math.sin(this.time * 0.4) * 3, c.z + Math.sin(this.orbit) * r);
    const to = goal.clone().sub(this.pos);
    const desired = to.clampLength(0, 26);
    this.vel.x = damp(this.vel.x, desired.x, 1.2, dt);
    this.vel.y = damp(this.vel.y, desired.y, 1.2, dt);
    this.vel.z = damp(this.vel.z, desired.z, 1.2, dt);
    this.pos.addScaledVector(this.vel, dt);
    const look = Math.atan2(c.x - this.pos.x, c.z - this.pos.z);
    this.heading = angleDamp(this.heading, look, 1.5, dt);
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.vel.length() * 0.012, this.heading, -this.vel.x * 0.004, 'YXZ');
    this.rotor.rotation.y += dt * 38;
    this.tail.rotation.x += dt * 50;
    this.strobe.material.emissiveIntensity = (this.time % 1.2) < 0.08 ? 30 : 0;

    // Searchlight follows the target (with lag), or sweeps a figure-eight while searching.
    const aimGoal = sees ? new THREE.Vector3(target.x, 0, target.z)
      : new THREE.Vector3(searchCenter.x + Math.sin(this.time * 0.7) * 22, 0, searchCenter.z + Math.sin(this.time * 1.4) * 14);
    this.aim.lerp(aimGoal, 1 - Math.exp(-3 * dt));
    const src = new THREE.Vector3(0, -1.2, 1.4).applyEuler(this.root.rotation).add(this.pos);
    this.spot.position.copy(src);
    this.spot.target.position.copy(this.aim);
    const dir = this.aim.clone().sub(src);
    const len = dir.length();
    this.beam.position.copy(src);
    this.beam.scale.set(1, len, 1);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize());
  }

  // Does the searchlight currently light the player?
  illuminates(x, z) { return Math.hypot(this.aim.x - x, this.aim.z - z) < 9; }

  dispose() {
    this.scene.remove(this.root, this.spot, this.spot.target, this.beam);
  }
}
