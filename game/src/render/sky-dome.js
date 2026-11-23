// Procedural golden-hour sky: gradient, sun disc with glow, drifting fbm clouds lit from below.
import * as THREE from 'three';

const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const SKY_FRAG = /* glsl */`
  uniform vec3 sunDir; uniform vec3 zenith; uniform vec3 midSky; uniform vec3 horizon; uniform vec3 sunColor;
  uniform float time; uniform float cloudAmount;
  varying vec3 vDir;

  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }

  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(horizon, midSky, smoothstep(-0.02, 0.22, h));
    col = mix(col, zenith, smoothstep(0.18, 0.85, h));
    // Below the horizon: hazy sea-coloured band.
    col = mix(col, horizon * 0.55, smoothstep(0.0, -0.25, h));
    float sd = max(dot(d, sunDir), 0.0);
    col += sunColor * pow(sd, 6.0) * 0.55;
    col += sunColor * pow(sd, 64.0) * 1.4;
    col += sunColor * smoothstep(0.9993, 0.9997, sd) * 30.0;
    // Clouds on a virtual plane.
    if (h > 0.01) {
      vec2 uv = d.xz / (h + 0.08) * 1.6 + vec2(time * 0.004, time * 0.0015);
      float c = fbm(uv * 1.3);
      c = smoothstep(0.52 - cloudAmount * 0.25, 0.85, c) * smoothstep(0.01, 0.12, h);
      float lit = pow(sd, 3.0);
      vec3 cloudCol = mix(vec3(0.55, 0.32, 0.42), vec3(1.9, 0.95, 0.5), lit * 0.85 + 0.15 * (1.0 - h));
      col = mix(col, cloudCol, c * 0.85);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSkyDome(sunDirection) {
  const material = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      sunDir: { value: sunDirection.clone().normalize() },
      zenith: { value: new THREE.Color(0.09, 0.13, 0.32) },
      midSky: { value: new THREE.Color(0.55, 0.42, 0.62) },
      horizon: { value: new THREE.Color(1.45, 0.7, 0.38) },
      sunColor: { value: new THREE.Color(1.6, 0.85, 0.42) },
      time: { value: 0 },
      cloudAmount: { value: 0.65 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky-dome';
  return mesh;
}

// Bakes the sky into a prefiltered environment map so metal, glass, paint and water reflect the dusk.
export function bakeSkyEnvironment(renderer, sunDirection) {
  const envScene = new THREE.Scene();
  const sky = createSkyDome(sunDirection);
  sky.material.uniforms.cloudAmount.value = 0.4;
  envScene.add(sky);
  // A dark ground disc so reflections show a horizon line instead of sky below.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 32), new THREE.MeshBasicMaterial({ color: 0x2a1c1c }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -40;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02, 1, 3000);
  pmrem.dispose();
  sky.geometry.dispose();
  return rt.texture;
}
