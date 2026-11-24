// Weather particles that live in a box around the camera and are animated entirely on the GPU:
// wind-slanted rain streaks, ring splashes on the ground, tumbling snowflakes and warm dust
// drifting through the dry-season haze. Intensities fade them in and out smoothly.
import * as THREE from 'three';

const BOX = new THREE.Vector3(56, 30, 56);

const RAIN_VERT = /* glsl */`
  attribute vec3 seed; attribute float tip;
  uniform vec3 camPos; uniform vec3 box; uniform float time; uniform vec2 wind; uniform float amount; uniform float speed;
  varying float vA;
  void main() {
    vec3 p = seed * box;
    p.y = mod(p.y - time * speed, box.y);
    p.x = mod(p.x - camPos.x + time * wind.x, box.x) - box.x * 0.5 + camPos.x;
    p.z = mod(p.z - camPos.z + time * wind.y, box.z) - box.z * 0.5 + camPos.z;
    p.y += camPos.y - box.y * 0.4;
    vec3 vel = normalize(vec3(wind.x, -speed, wind.y));
    p -= vel * tip * 0.9;
    float visible = step(fract(seed.x * 13.7 + seed.z * 7.1), amount);
    vA = visible * (0.35 + 0.35 * tip);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA *= smoothstep(2.0, 0.5, -mv.z / 40.0);
  }
`;
const RAIN_FRAG = /* glsl */`
  uniform vec3 color; varying float vA;
  void main() { if (vA < 0.01) discard; gl_FragColor = vec4(color, vA); }
`;

const FLAKE_VERT = /* glsl */`
  attribute vec3 seed;
  uniform vec3 camPos; uniform vec3 box; uniform float time; uniform vec2 wind; uniform float amount; uniform float speed; uniform float size; uniform float pixelRatio;
  varying float vA; varying float vPhase;
  void main() {
    vec3 p = seed * box;
    float sway = sin(time * 0.9 + seed.x * 40.0) * 0.8;
    p.y = mod(p.y - time * speed * (0.7 + seed.z * 0.6), box.y);
    p.x = mod(p.x - camPos.x + time * wind.x + sway, box.x) - box.x * 0.5 + camPos.x;
    p.z = mod(p.z - camPos.z + time * wind.y + cos(time * 0.7 + seed.y * 30.0) * 0.8, box.z) - box.z * 0.5 + camPos.z;
    p.y += camPos.y - box.y * 0.4;
    vA = step(fract(seed.x * 13.7 + seed.z * 7.1), amount);
    vPhase = seed.y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * pixelRatio * (300.0 / max(1.0, -mv.z)) * (0.6 + seed.y * 0.8);
    vA *= smoothstep(45.0, 8.0, -mv.z);
  }
`;
const FLAKE_FRAG = /* glsl */`
  uniform vec3 color; uniform float opacity; varying float vA; varying float vPhase;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.1, length(c)) * vA * opacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(color, a);
  }
`;

const SPLASH_VERT = /* glsl */`
  attribute vec3 seed;
  uniform vec3 camPos; uniform float time; uniform float amount; uniform float pixelRatio; uniform float ground;
  varying float vA; varying float vT;
  void main() {
    float cycle = 0.45;
    float t = fract(time / cycle + seed.y);
    float k = floor(time / cycle + seed.y);
    vec2 off = fract(vec2(seed.x * 91.7 + k * 0.618, seed.z * 37.3 + k * 0.414)) * 36.0 - 18.0;
    vec3 p = vec3(camPos.x + off.x, ground + 0.03, camPos.z + off.y);
    vT = t;
    vA = step(fract(seed.x * 5.3 + seed.z * 11.9), amount) * (1.0 - t);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = pixelRatio * (40.0 * (0.3 + t)) / max(1.0, -mv.z) * 6.0;
  }
`;
const SPLASH_FRAG = /* glsl */`
  varying float vA; varying float vT;
  void main() {
    vec2 c = (gl_PointCoord - 0.5) * vec2(1.0, 3.0);
    float r = length(c);
    float ring = smoothstep(0.08, 0.0, abs(r - 0.35 * (0.4 + vT)));
    float a = ring * vA * 0.55;
    if (a < 0.01) discard;
    gl_FragColor = vec4(0.85, 0.9, 1.0, a);
  }
`;

function seeds(n, perVertex = 1) {
  const a = new Float32Array(n * perVertex * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.random(), y = Math.random(), z = Math.random();
    for (let k = 0; k < perVertex; k++) a.set([x, y, z], (i * perVertex + k) * 3);
  }
  return a;
}

export class Precipitation {
  constructor(scene) {
    this.shared = { camPos: { value: new THREE.Vector3() }, box: { value: BOX.clone() }, time: { value: 0 }, wind: { value: new THREE.Vector2() }, pixelRatio: { value: 1 } };
    // Rain streaks: line segments, two vertices each.
    const N = 5200;
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 2 * 3), 3));
    rg.setAttribute('seed', new THREE.Float32BufferAttribute(seeds(N, 2), 3));
    const tip = new Float32Array(N * 2); for (let i = 0; i < N; i++) tip[i * 2 + 1] = 1;
    rg.setAttribute('tip', new THREE.Float32BufferAttribute(tip, 1));
    this.rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, fog: false,
      uniforms: { ...this.shared, amount: { value: 0 }, speed: { value: 24 }, color: { value: new THREE.Color(0.75, 0.8, 0.9) } },
    });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false; this.rain.renderOrder = 5;
    // Splashes.
    const S = 700;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(S * 3), 3));
    sg.setAttribute('seed', new THREE.Float32BufferAttribute(seeds(S), 3));
    this.splashMat = new THREE.ShaderMaterial({ vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG, transparent: true, depthWrite: false, uniforms: { ...this.shared, amount: { value: 0 }, ground: { value: 0.16 } } });
    this.splash = new THREE.Points(sg, this.splashMat);
    this.splash.frustumCulled = false; this.splash.renderOrder = 5;
    // Snow and dust share the flake shader.
    const flakes = (n, color, size, speed, opacity) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      g.setAttribute('seed', new THREE.Float32BufferAttribute(seeds(n), 3));
      const m = new THREE.ShaderMaterial({ vertexShader: FLAKE_VERT, fragmentShader: FLAKE_FRAG, transparent: true, depthWrite: false,
        uniforms: { ...this.shared, amount: { value: 0 }, speed: { value: speed }, size: { value: size }, color: { value: new THREE.Color(color) }, opacity: { value: opacity } } });
      const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 5;
      return p;
    };
    this.snow = flakes(4200, 0xf4f8ff, 0.09, 1.6, 0.95);
    this.dust = flakes(1400, 0xd8b080, 0.12, 0.25, 0.35);
    scene.add(this.rain, this.splash, this.snow, this.dust);
  }

  update(dt, camera, { rain = 0, snow = 0, dust = 0, wind = 0, ground = 0.16, pixelRatio = 1 }) {
    const u = this.shared;
    u.time.value += dt;
    u.camPos.value.copy(camera.position);
    u.wind.value.set(-2.5 * wind - 0.4, 1.2 * wind);
    u.pixelRatio.value = pixelRatio;
    this.rainMat.uniforms.amount.value = rain;
    this.rainMat.uniforms.speed.value = 20 + rain * 8;
    this.splashMat.uniforms.amount.value = rain * 0.9;
    this.splashMat.uniforms.ground.value = ground;
    this.snow.material.uniforms.amount.value = snow;
    this.dust.material.uniforms.amount.value = dust;
    this.rain.visible = rain > 0.01; this.splash.visible = rain > 0.05;
    this.snow.visible = snow > 0.01; this.dust.visible = dust > 0.01;
  }
}
