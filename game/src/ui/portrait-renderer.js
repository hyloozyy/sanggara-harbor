// Dialogue portraits: the speaker's own 3D head and shoulders, rendered from the live character
// (same mesh, skeleton pose, atlas, hair and clothes) into a small canvas when a conversation
// starts. The character is lifted into a little studio scene for one frame (warm key light, soft
// fill, teal rim), rendered into a multisampled HDR target, tone mapped and graded by a small
// pass into an 8-bit target and read back. Cast members who are not on screen (phone calls) are
// built once from their look and cached. Costs one tiny render when a speaker first talks.
import * as THREE from 'three';
import { Character } from '../characters/character.js';

const SIZE = 256;

const GRADE_FRAG = /* glsl */`
  uniform sampler2D tInput; uniform float exposure;
  varying vec2 vUv;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main() {
    vec4 c = texture2D(tInput, vUv);
    vec3 col = aces(c.rgb * exposure);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.97);
    col = pow(col, vec3(1.0 / 2.2));
    gl_FragColor = vec4(col, smoothstep(0.02, 0.5, c.a));
  }
`;

export class PortraitRenderer {
  constructor(gfx) {
    this.gfx = gfx;
    this.scene = new THREE.Scene();
    this.holder = new THREE.Group();
    this.holder.matrixAutoUpdate = false;
    this.scene.add(this.holder);
    // Studio lights move with the camera each render (key front-left, rim behind-right).
    this.hemi = new THREE.HemisphereLight(0xf4f0ff, 0x3a2c34, 1.0);
    this.key = new THREE.DirectionalLight(0xfff0e2, 2.3);
    this.rim = new THREE.DirectionalLight(0xd8ecff, 1.3);
    this.fill = new THREE.DirectionalLight(0xffb080, 0.6);
    this.scene.add(this.hemi, this.key, this.rim, this.fill, this.key.target, this.rim.target, this.fill.target);
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.05, 8);
    this.hdr = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
    this.ldr = new THREE.WebGLRenderTarget(SIZE, SIZE);
    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.gradeMat = new THREE.ShaderMaterial({
      uniforms: { tInput: { value: this.hdr.texture }, exposure: { value: 1.1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: GRADE_FRAG, depthTest: false, depthWrite: false,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.gradeMat));
    this.pixels = new Uint8Array(SIZE * SIZE * 4);
    this.stand = new Map(); // cast key -> Character built offscreen
    this.v = new THREE.Vector3(); this.f = new THREE.Vector3(); this.t = new THREE.Vector3();
  }

  // A posed Character for a cast member who is not in the world (phone calls).
  standIn(key, look) {
    if (!this.stand.has(key)) {
      const c = new Character(look, 0, 0, { atlasSize: 256 });
      c.anim = 'idle';
      for (let i = 0; i < 24; i++) c.updateVisual(1 / 15, 0);
      c.mesh.updateMatrixWorld(true);
      this.stand.set(key, c);
    }
    return this.stand.get(key);
  }

  // Render `character`'s portrait into a new canvas. side: +1 = the face turns to screen right
  // (portrait on the left of the box), -1 = to the left. Returns null if it cannot render.
  render(character, side = 1) {
    const model = character?.model;
    const head = model?.head;
    const root = character?.mesh;
    if (!head || !root) return null;
    const r = this.gfx.renderer;
    const parent = root.parent;
    const detail = model.detail;
    try {
      // Near geometry and the up-to-date pose in world space.
      model.setDetail?.('near');
      if (parent) parent.updateMatrixWorld(true); else root.updateMatrixWorld(true);
      head.getWorldPosition(this.v);
      const scale = root.scale.y || 1;
      const h = character.heading ?? 0;
      // Three-quarter view: the camera sits in front of the face, swung to one side.
      const yaw = h + side * 0.42;
      this.f.set(Math.sin(yaw), 0, Math.cos(yaw));
      this.t.copy(this.v).addScaledVector(new THREE.Vector3(0, 1, 0), 0.085 * scale); // the head bone sits at the skull base
      const dist = 1.02 * scale;
      this.camera.position.copy(this.t).addScaledVector(this.f, dist).add(new THREE.Vector3(0, 0.03 * scale, 0));
      this.camera.lookAt(this.t.x, this.t.y - 0.06 * scale, this.t.z);
      this.camera.updateMatrixWorld(true);
      // Lights relative to the camera.
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const back = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2); // towards camera
      this.key.position.copy(this.t).addScaledVector(back, 2).addScaledVector(right, -1.4 * side).add(new THREE.Vector3(0, 1.4, 0));
      this.key.target.position.copy(this.t);
      this.rim.position.copy(this.t).addScaledVector(back, -2).addScaledVector(right, 1.6 * side).add(new THREE.Vector3(0, 0.9, 0));
      this.rim.target.position.copy(this.t);
      this.fill.position.copy(this.t).addScaledVector(back, 1.5).addScaledVector(right, 1.8 * side).add(new THREE.Vector3(0, -0.3, 0));
      this.fill.target.position.copy(this.t);
      for (const l of [this.key, this.rim, this.fill]) { l.updateMatrixWorld(); l.target.updateMatrixWorld(); }

      // Lift the character into the studio for this one render, in the same world placement.
      this.holder.matrix.copy(parent ? parent.matrixWorld : new THREE.Matrix4());
      this.holder.matrixWorld.copy(this.holder.matrix);
      const index = parent ? parent.children.indexOf(root) : -1;
      const wasVisible = root.visible; root.visible = true;
      this.holder.add(root);
      const prevTarget = r.getRenderTarget(), prevTone = r.toneMapping, prevAuto = r.autoClear;
      const prevColor = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
      const prevShadow = r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate = false;
      r.toneMapping = THREE.NoToneMapping;
      r.autoClear = true;
      r.setClearColor(0x000000, 0);
      r.setRenderTarget(this.hdr);
      r.render(this.scene, this.camera);
      r.setRenderTarget(this.ldr);
      r.render(this.quadScene, this.quadCam);
      r.readRenderTargetPixels(this.ldr, 0, 0, SIZE, SIZE, this.pixels);
      r.setRenderTarget(prevTarget);
      r.toneMapping = prevTone; r.autoClear = prevAuto; r.setClearColor(prevColor, prevAlpha);
      r.shadowMap.autoUpdate = prevShadow;
      root.visible = wasVisible;
      if (parent) {
        parent.add(root);
        // Keep the original draw order.
        const kids = parent.children; kids.splice(kids.indexOf(root), 1); kids.splice(Math.max(0, index), 0, root);
      } else this.holder.remove(root);
    } catch (e) {
      console.warn('[portrait]', e);
      if (parent && root.parent !== parent) parent.add(root);
      return null;
    } finally {
      model.setDetail?.(detail);
    }
    // Flip rows into a canvas.
    const out = document.createElement('canvas');
    out.width = SIZE; out.height = SIZE;
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(SIZE, SIZE);
    const row = SIZE * 4;
    for (let y = 0; y < SIZE; y++) img.data.set(this.pixels.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row);
    ctx.putImageData(img, 0, 0);
    return out;
  }
}
