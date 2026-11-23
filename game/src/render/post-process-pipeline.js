// HDR rendering with a hand-written bloom (threshold + dual filter mip chain) and a filmic
// composite (ACES tone mapping, warm dusk grade, vignette, grain, sRGB encode).
import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */`
  uniform sampler2D tInput; uniform float threshold; uniform float knee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tInput, vUv).rgb;
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float w = max(soft, br - threshold) / max(br, 1e-4);
    gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0);
  }
`;

const DOWN_FRAG = /* glsl */`
  uniform sampler2D tInput; uniform vec2 texel;
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tInput, vUv).rgb * 4.0;
    s += texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2( 1.0, -1.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2(-1.0,  1.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2( 1.0,  1.0)).rgb;
    gl_FragColor = vec4(s / 8.0, 1.0);
  }
`;

const UP_FRAG = /* glsl */`
  uniform sampler2D tInput; uniform vec2 texel; uniform float weight;
  varying vec2 vUv;
  void main() {
    vec3 s = vec3(0.0);
    s += texture2D(tInput, vUv + texel * vec2(-2.0, 0.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2( 2.0, 0.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2(0.0, -2.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2(0.0,  2.0)).rgb;
    s += texture2D(tInput, vUv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
    s += texture2D(tInput, vUv + texel * vec2( 1.0, -1.0)).rgb * 2.0;
    s += texture2D(tInput, vUv + texel * vec2(-1.0,  1.0)).rgb * 2.0;
    s += texture2D(tInput, vUv + texel * vec2( 1.0,  1.0)).rgb * 2.0;
    gl_FragColor = vec4(s / 12.0 * weight, 1.0);
  }
`;

const COMPOSITE_FRAG = /* glsl */`
  uniform sampler2D tScene; uniform sampler2D tBloom;
  uniform float bloomStrength; uniform float exposure; uniform float vignette; uniform float time;
  uniform float saturation; uniform vec3 shadowTint; uniform float damageVignette;
  varying vec2 vUv;

  vec3 acesFilm(vec3 x) {
    x *= 0.6;
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }

  void main() {
    vec3 col = texture2D(tScene, vUv).rgb;
    vec3 bloom = texture2D(tBloom, vUv).rgb;
    col += bloom * bloomStrength;
    col *= exposure;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col, col * shadowTint, smoothstep(0.25, 0.0, lum) * 0.6);
    col = acesFilm(col);
    float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l2), col, saturation);
    vec2 d = vUv - 0.5;
    float v = 1.0 - dot(d, d) * vignette;
    col *= clamp(v, 0.0, 1.0);
    col = mix(col, vec3(0.55, 0.02, 0.02), damageVignette * smoothstep(0.15, 0.55, length(d)));
    col = linearToSrgb(col);
    col += (hash(vUv * 731.0) - 0.5) / 255.0 * 2.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeTarget(w, h, samples = 0) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: samples >= 0,
    samples: Math.max(0, samples),
  });
}

export class PostProcessPipeline {
  constructor(renderer, { samples = 4, mips = 5 } = {}) {
    this.renderer = renderer;
    this.enabled = true;
    this.bloomStrength = 0.6;
    this.samples = samples;
    this.mipCount = mips;
    this.quad = new THREE.Mesh(new THREE.BufferGeometry(), null);
    this.quad.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const mat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT, fragmentShader: frag, uniforms,
      depthTest: false, depthWrite: false, toneMapped: false, ...extra,
    });
    this.brightMat = mat(BRIGHT_FRAG, { tInput: { value: null }, threshold: { value: 1.25 }, knee: { value: 0.5 } });
    this.downMat = mat(DOWN_FRAG, { tInput: { value: null }, texel: { value: new THREE.Vector2() } });
    this.upMat = mat(UP_FRAG, { tInput: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } },
      { blending: THREE.AdditiveBlending, transparent: true });
    this.compositeMat = mat(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, bloomStrength: { value: this.bloomStrength },
      exposure: { value: 1.12 }, vignette: { value: 1.25 }, time: { value: 0 }, saturation: { value: 1.12 },
      shadowTint: { value: new THREE.Vector3(0.92, 0.94, 1.1) }, damageVignette: { value: 0 },
    });
    this.sceneTarget = null;
    this.mips = [];
  }

  setSize(w, h) {
    this.width = w; this.height = h;
    if (this.sceneTarget) this.sceneTarget.dispose();
    for (const m of this.mips) m.dispose();
    this.sceneTarget = makeTarget(w, h, this.samples);
    this.mips = [];
    let mw = Math.max(1, w >> 1), mh = Math.max(1, h >> 1);
    for (let i = 0; i < this.mipCount; i++) {
      this.mips.push(makeTarget(mw, mh, -1));
      mw = Math.max(1, mw >> 1); mh = Math.max(1, mh >> 1);
    }
  }

  pass(material, target, clear = true) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    if (clear) this.renderer.clear();
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  render(scene, camera, time = 0) {
    const r = this.renderer;
    if (!this.enabled) {
      r.setRenderTarget(null);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.render(scene, camera);
      return;
    }
    r.toneMapping = THREE.NoToneMapping;
    r.autoClear = true;
    r.setRenderTarget(this.sceneTarget);
    r.render(scene, camera);
    this.sceneStats = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    r.autoClear = false;

    this.brightMat.uniforms.tInput.value = this.sceneTarget.texture;
    this.pass(this.brightMat, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.downMat.uniforms.tInput.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, this.mips[i]);
    }
    for (let i = this.mips.length - 1; i > 0; i--) {
      const src = this.mips[i];
      this.upMat.uniforms.tInput.value = src.texture;
      this.upMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.upMat.uniforms.weight.value = 0.9;
      this.pass(this.upMat, this.mips[i - 1], false);
    }
    const u = this.compositeMat.uniforms;
    u.tScene.value = this.sceneTarget.texture;
    u.tBloom.value = this.mips[0].texture;
    u.bloomStrength.value = this.bloomStrength;
    u.time.value = time % 100;
    this.pass(this.compositeMat, null);
    r.autoClear = true;
  }
}
