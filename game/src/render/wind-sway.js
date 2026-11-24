// Wind in the vegetation: a vertex-shader hook that bends palms, trees, fronds and grass with
// height (rooted at the ground), each instance on its own phase, with a slow sway plus a
// faster leaf flutter. Wind strength comes from the weather (gentle at dusk, wild in storms).
export const WIND = { uTime: { value: 0 }, uWind: { value: 0.25 } };

const VERT = /* glsl */`
  {
    vec3 wRoot = vec3(0.0);
    #ifdef USE_INSTANCING
      wRoot = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
    #endif
    float wPh = wRoot.x * 0.37 + wRoot.z * 0.23;
    float wH = max(0.0, position.y) * uSwayScale;
    float wBend = pow(wH, 1.4);
    float sway = sin(uTime * (0.9 + uWind * 0.8) + wPh) * 0.6 + sin(uTime * 2.3 + wPh * 1.7) * 0.25;
    float gust = 0.5 + 0.5 * sin(uTime * 0.31 + wPh * 0.2);
    float amp = uWind * (0.35 + 0.65 * gust) * uSwayAmp;
    transformed.x += (sway + uWind * 0.8) * amp * wBend;
    transformed.z += sin(uTime * 1.3 + wPh * 2.1) * 0.4 * amp * wBend;
    transformed.y -= abs(sway) * amp * wBend * 0.15;
    transformed += normal * sin(uTime * 7.0 + position.x * 3.0 + position.z * 3.0 + wPh) * uFlutter * uWind * wH * 0.02;
  }
`;

// amp: metres of bend per (height^1.4); flutter: leaf shimmer; scale: converts geometry y to metres.
export function addWindSway(m, { amp = 0.012, flutter = 0, scale = 1 } = {}) {
  if (m.userData.sway) return m;
  m.userData.sway = true;
  const prev = m.onBeforeCompile;
  const own = { uSwayAmp: { value: amp }, uFlutter: { value: flutter }, uSwayScale: { value: scale } };
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, WIND, own);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform float uSwayAmp; uniform float uFlutter; uniform float uSwayScale;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT);
  };
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|sway';
  m.needsUpdate = true;
  return m;
}
