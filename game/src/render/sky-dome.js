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
  uniform float time; uniform float cloudAmount; uniform vec3 cloudLit; uniform vec3 cloudShade; uniform float night; uniform float flash; uniform float overcast;
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
    col += sunColor * smoothstep(0.9993, 0.9997, sd) * 18.0 * (1.0 - overcast);
    // Stars on clear nights.
    if (h > 0.0 && night > 0.01) {
      vec2 sp = d.xz / (h + 0.3) * 220.0;
      float st = step(0.9965, hash(floor(sp))) * smoothstep(0.02, 0.3, h);
      col += vec3(0.9, 0.92, 1.0) * st * night * (1.0 - cloudAmount) * 1.6;
    }
    // Clouds on a virtual plane.
    if (h > 0.01) {
      vec2 uv = d.xz / (h + 0.08) * 1.6 + vec2(time * 0.004, time * 0.0015);
      float c = fbm(uv * 1.3);
      c = smoothstep(0.52 - cloudAmount * 0.42, 0.85 - cloudAmount * 0.3, c) * smoothstep(0.01, 0.12, h);
      c = max(c, overcast * 0.92);
      float lit = pow(sd, 3.0) * (1.0 - overcast * 0.8);
      vec3 cloudCol = mix(cloudShade, cloudLit, lit * 0.85 + 0.15 * (1.0 - h));
      cloudCol *= 0.8 + 0.35 * fbm(uv * 3.1 + 7.0);
      col = mix(col, cloudCol, c * 0.9);
    }
    col += vec3(0.75, 0.8, 1.0) * flash * (0.6 + 0.8 * smoothstep(0.0, 0.4, h));
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
      zenith: { value: new THREE.Color(0.14, 0.2, 0.42) },
      midSky: { value: new THREE.Color(0.68, 0.5, 0.58) },
      horizon: { value: new THREE.Color(1.45, 0.7, 0.38) },
      sunColor: { value: new THREE.Color(1.6, 0.85, 0.42) },
      time: { value: 0 },
      cloudAmount: { value: 0.65 },
      cloudLit: { value: new THREE.Color(1.9, 0.95, 0.5) },
      cloudShade: { value: new THREE.Color(0.55, 0.32, 0.42) },
      night: { value: 0 }, flash: { value: 0 }, overcast: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = 'sky-dome';
  return mesh;
}

// Bakes the sky into a prefiltered environment map so metal, glass, paint and water reflect the dusk.
export function bakeSkyEnvironment(renderer, sunDirection, fromUniforms = null, groundColor = 0x2a1c1c) {
  const envScene = new THREE.Scene();
  const sky = createSkyDome(sunDirection);
  sky.material.uniforms.cloudAmount.value = 0.4;
  if (fromUniforms) for (const [k, u] of Object.entries(fromUniforms)) { const t = sky.material.uniforms[k]; if (!t) continue; if (u.value?.isColor || u.value?.isVector3) t.value.copy(u.value); else t.value = u.value; }
  sky.material.uniforms.flash.value = 0;
  envScene.add(sky);
  // A dark ground disc so reflections show a horizon line instead of sky below.
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1500, 32), new THREE.MeshBasicMaterial({ color: groundColor }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -40;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.02, 1, 3000);
  pmrem.dispose();
  sky.geometry.dispose(); sky.material.dispose();
  ground.geometry.dispose(); ground.material.dispose();
  rt.texture.userData.renderTarget = rt;
  return rt.texture;
}
