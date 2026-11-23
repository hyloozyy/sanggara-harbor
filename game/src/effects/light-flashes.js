// A fixed pool of dynamic point lights (fixed count so shaders never recompile) used for muzzle
// flashes, explosions and the red/blue wash of the nearest police sirens; plus bullet tracers.
import * as THREE from 'three';

export class LightFlashes {
  constructor(scene, count = 4) {
    this.lights = [];
    for (let i = 0; i < count; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 30, 2);
      l.userData = { life: 0, max: 0, base: 0 };
      scene.add(l);
      this.lights.push(l);
    }
    this.sirenLights = [new THREE.PointLight(0xff2020, 0, 26, 1.6), new THREE.PointLight(0x2050ff, 0, 26, 1.6)];
    for (const l of this.sirenLights) scene.add(l);
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffd890, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.scene = scene;
  }

  flash(x, y, z, color, intensity, life, distance = 30) {
    const l = this.lights.reduce((a, b) => (a.userData.life <= b.userData.life ? a : b));
    l.position.set(x, y, z);
    l.color.set(color);
    l.distance = distance;
    l.userData.life = life; l.userData.max = life; l.userData.base = intensity;
    l.intensity = intensity;
  }

  tracer(ax, ay, az, bx, by, bz) {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz)]);
    const line = new THREE.Line(g, this.tracerMat.clone());
    line.userData.life = 0.07;
    line.frustumCulled = false;
    this.scene.add(line);
    this.tracers.push(line);
  }

  // Siren wash follows the two nearest active police cars.
  updateSirens(policeCars, camPos, time) {
    const active = policeCars.filter((v) => v.sirenOn && !v.wrecked)
      .sort((a, b) => a.pos.distanceToSquared(camPos) - b.pos.distanceToSquared(camPos));
    this.sirenLights.forEach((l, i) => {
      const car = active[Math.min(i, active.length - 1)];
      if (!car) { l.intensity = 0; return; }
      l.position.set(car.pos.x, 2.4, car.pos.z);
      const phase = Math.sin(car.sirenPhase + (i === 0 ? 0 : Math.PI));
      l.intensity = Math.max(0, phase) * 60;
    });
    void time;
  }

  update(dt) {
    for (const l of this.lights) {
      if (l.userData.life > 0) {
        l.userData.life -= dt;
        l.intensity = Math.max(0, l.userData.base * (l.userData.life / l.userData.max));
      } else l.intensity = 0;
    }
    for (const t of [...this.tracers]) {
      t.userData.life -= dt;
      t.material.opacity = Math.max(0, t.userData.life / 0.07);
      if (t.userData.life <= 0) {
        this.scene.remove(t); t.geometry.dispose(); t.material.dispose();
        this.tracers.splice(this.tracers.indexOf(t), 1);
      }
    }
  }
}
