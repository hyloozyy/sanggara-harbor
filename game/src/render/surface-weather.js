// Weather on surfaces, injected into every PBR material's shader: rain darkens and glosses
// upward faces with puddles that mirror the sky, snow settles on roofs, roads and leaves,
// and the dry season bleaches and yellows grass and foliage. One set of shared uniforms
// drives the whole city, so changing the weather never recompiles anything.
import * as THREE from 'three';

export const SURFACE_WEATHER = {
  uWet: { value: 0 },
  uSnow: { value: 0 },
  uDry: { value: 0 },
  uCamWorld: { value: new THREE.Matrix4() },
};

const INJECT = /* glsl */`
  {
    vec3 wUpV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float wUp = clamp(dot(normal, wUpV), 0.0, 1.0);
    vec3 wPos = (uCamWorld * vec4(-vViewPosition, 1.0)).xyz;
    vec2 pq = wPos.xz * 0.13;
    vec2 pi = floor(pq), pf = fract(pq); pf = pf * pf * (3.0 - 2.0 * pf);
    float h00 = fract(sin(dot(pi, vec2(127.1, 311.7))) * 43758.5);
    float h10 = fract(sin(dot(pi + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5);
    float h01 = fract(sin(dot(pi + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5);
    float h11 = fract(sin(dot(pi + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5);
    float pn = mix(mix(h00, h10, pf.x), mix(h01, h11, pf.x), pf.y);
    float flatK = smoothstep(0.75, 0.97, wUp);
    float wetK = uWet * uWetMask * smoothstep(0.15, 0.8, wUp);
    float puddle = uWet * uWetMask * flatK * smoothstep(0.55, 0.72, pn + uWet * 0.12);
    diffuseColor.rgb *= 1.0 - 0.42 * wetK - 0.25 * puddle;
    roughnessFactor = mix(roughnessFactor, 0.12, wetK * 0.85);
    roughnessFactor = mix(roughnessFactor, 0.015, puddle);
    float snowK = uSnow * uSnowMask * smoothstep(0.3, 0.75, wUp) * (0.75 + 0.25 * pn);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.98), snowK);
    roughnessFactor = mix(roughnessFactor, 0.78, snowK);
    float dryK = uDry * uDryMask;
    float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum * 1.25, lum * 1.05, lum * 0.55), dryK * 0.75);
  }
`;

// Patch one material (idempotent). Masks: wet (1 ground/roof, less on paint), snow, dry (grass).
export function weatherizeMaterial(m, { wet = 1, snow = 1, dry = 0 } = {}) {
  if (!m || !m.isMeshStandardMaterial || m.userData.weatherized) return m;
  m.userData.weatherized = true;
  const masks = { uWetMask: { value: m.userData.wetMask ?? wet }, uSnowMask: { value: m.userData.snowMask ?? snow }, uDryMask: { value: m.userData.dryMask ?? dry } };
  m.userData.weatherMasks = masks;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, SURFACE_WEATHER, masks);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWet; uniform float uSnow; uniform float uDry; uniform mat4 uCamWorld;\nuniform float uWetMask; uniform float uSnowMask; uniform float uDryMask;')
      .replace('#include <lights_physical_fragment>', INJECT + '\n#include <lights_physical_fragment>');
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|wx';
  m.needsUpdate = true;
  return m;
}

// Patch everything in a subtree that is not patched yet.
export function weatherizeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh && o.userData.noWeather) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) weatherizeMaterial(m);
  });
}
