// Golden-hour lighting rig: low warm sun with a soft shadow box that follows the action,
// a sky/ground hemisphere fill and distance fog that melts the city into the haze.
import * as THREE from 'three';

export const SUN_DIRECTION = new THREE.Vector3(-0.62, 0.34, 0.72).normalize();

export class DuskLighting {
  constructor(scene, { shadowSize = 2048, shadows = true } = {}) {
    this.scene = scene;
    this.sun = new THREE.DirectionalLight(0xffb878, 3.9);
    this.sun.castShadow = shadows;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const cam = this.sun.shadow.camera;
    cam.left = -110; cam.right = 110; cam.top = 110; cam.bottom = -110;
    cam.near = 10; cam.far = 700;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 3;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xb0a8c4, 0x5a3a28, 1.1);
    scene.add(this.hemi);
    this.fill = new THREE.DirectionalLight(0x8a8ad0, 0.3); // cool bounce from the east sky
    this.fill.position.set(300, 200, -200);
    scene.add(this.fill);

    scene.fog = new THREE.Fog(0xc07a62, 160, 1150);
    this.focus = new THREE.Vector3();
    this.direction = SUN_DIRECTION.clone(); // moved by the time of day
  }

  setShadowQuality(size, enabled) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.mapSize.set(size, size);
  }

  // Keep the shadow frustum centred on the player, snapped to texels to avoid shimmering.
  follow(x, z) {
    const texel = 220 / this.sun.shadow.mapSize.x;
    const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel;
    this.focus.set(fx, 0, fz);
    this.sun.target.position.copy(this.focus);
    this.sun.position.copy(this.focus).addScaledVector(this.direction, 400);
  }
}
