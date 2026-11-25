// Motion lab (debug/motion.html): the game's renderer and lighting with only the motion stage
// (people walking, running, talking, fighting, falling, riding and driving) on a plain lot.
//   ?focus=<actor>   walker|jogger|sprinter|talk|gunman|fight|faller|scooter|bike|car|all
//   &t=<s>           simulated seconds before the first frame
//   &n=<frames>&step=<s>&cols=<c>   contact sheet of n frames, step seconds apart
//   &angle=<deg>     camera bearing relative to the actor's heading (90 = from its left side)
//   &dist=<m>&h=<m>&fov=<deg>&fy=<m> (focus height)
//   ?people=<n>&part=face|head|hands|body|feet&who=<i>&roles=auto,police,..  a line-up of generated
//   townspeople; with &n tiles, tile i shows person who+i (close-ups of faces, hands, clothes)
import * as THREE from 'three';
import { GameRenderer } from '../render/game-renderer.js';
import { assets } from '../assets/asset-library.js';
import { registerProceduralTextures } from '../assets/texture-catalog.js';
import { createMotionStage } from './motion-stage.js';
import { Character } from '../characters/character.js';
import { generateLook } from '../characters/character-generator.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? Number(params.get(k)) : d);
const canvas = document.getElementById('c');
const gfx = new GameRenderer(canvas, params.get('quality') || 'medium', { keepFrames: true });
registerProceduralTextures();
const scene = gfx.scene;
const OX = 3000, OZ = 0;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), (() => { try { return assets.material('asphalt'); } catch { return new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8 }); } })());
ground.position.set(OX, 0, OZ);
ground.receiveShadow = true;
scene.add(ground);
assets.applyEnvironment(scene);

const stage = createMotionStage(scene, OX, OZ);
if (params.get('ghost') === '1') for (const v of stage.vehicles) v.mesh.traverse((o) => { const sh = o.userData.shell; if (sh) { sh.glassMesh.visible = false; sh.paintMesh.visible = false; sh.multiMesh.visible = false; } });
if (params.get('glass') === '0') for (const v of stage.vehicles) v.mesh.traverse((o) => { const sh = o.userData.shell; if (sh) sh.glassMesh.visible = false; });
// People line-up for close-ups.
const lineup = [];
if (params.has('people')) {
  const roles = (params.get('roles') || 'auto,auto,market,auto,worker,auto,police,auto,gang,auto,rider,auto').split(',');
  const count = num('people', 12), seed0 = num('seed', 7000);
  for (let i = 0; i < count; i++) {
    const c = new Character(generateLook(seed0 + i * 37, roles[i % roles.length]), OX - 30 + i * 1.6, OZ + 40, { atlasSize: 512 });
    c.heading = 0; c.anim = params.get('anim') || 'idle';
    if (params.get('prop')) c.model.showProp(params.get('prop'), true);
    scene.add(c.mesh); lineup.push(c);
    stage.actors['p' + i] = { ch: c, focus: () => ({ x: c.pos.x, y: c.pos.y + 1.0, z: c.pos.z }) };
  }
  const step0 = stage.step;
  stage.step = (dt) => { step0(dt); for (const c of lineup) { if (c.anim === 'walk') c.move(dt, null, 0, 1.3); else c.move(dt, null, 0, 0, 0); if (params.get('talk')) c.talk = Math.max(0, Math.sin(stage.time * 13)) * 0.8; c.updateVisual(dt); } };
}
const PART = { face: [1.63, 0.62, 22], head: [1.6, 0.9, 26], hands: [0.95, 0.9, 30], body: [1.0, 3.2, 32], feet: [0.15, 1.1, 30], torso: [1.3, 1.5, 30] };
const focus = params.get('focus') || (lineup.length ? 'p' + num('who', 0) : 'all');
const DT = 1 / 60;
const simTo = (t) => { while (stage.time < t - 1e-6) stage.step(DT); };

const cam = gfx.camera;
function aimCamera(c2, aspect) {
  c2.aspect = aspect;
  c2.fov = num('fov', focus === 'all' ? 45 : 32);
  if (focus === 'all') {
    c2.position.set(OX + 6, 14, OZ - 22); c2.lookAt(OX + 6, 0.5, OZ + 5);
  } else {
    const a = stage.actors[c2.userData?.focus || focus];
    const f = a.focus();
    const part = PART[params.get('part')];
    if (part) { f.y = a.ch.pos.y + part[0] * (a.ch.mesh.scale.y || 1); }
    if (params.has('fy')) f.y = num('fy', 1);
    const hd = a.ch ? a.ch.heading : a.v.heading;
    const fixed = params.get('fixed') === '1';
    const bearing = (fixed ? 0 : hd) + THREE.MathUtils.degToRad(num('angle', 90));
    const d = num('dist', part ? part[1] : a.v ? 5.5 : 4.2);
    if (part && !params.has('fov')) c2.fov = part[2];
    c2.position.set(f.x + Math.sin(bearing) * d, params.has('h') ? num('h', 1.3) : part ? f.y + 0.02 : 1.3, f.z + Math.cos(bearing) * d);
    c2.lookAt(f.x, f.y, f.z);
    gfx.lighting.follow(f.x, f.z);
  }
  c2.updateProjectionMatrix();
}

const n = num('n', 1), step = num('step', 0.1), t0 = num('t', 2);
const cols = num('cols', Math.min(n, 4)), rows = Math.ceil(n / cols);
let frames = 0;
function renderAll(time) {
  const r = gfx.renderer;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (n === 1) {
    simTo(t0);
    aimCamera(cam, W / H);
    gfx.render(time / 1000);
    return;
  }
  const cw = W / cols, ch = H / rows;
  const c2 = new THREE.PerspectiveCamera(32, cw / ch, 0.1, 500);
  r.setScissorTest(true);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  for (let i = 0; i < n; i++) {
    const seq = !lineup.length || params.has('seq');
    simTo(t0 + (seq ? i : 0) * step);
    c2.userData.focus = seq ? null : 'p' + (num('who', 0) + i) % lineup.length;
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    r.setViewport(x, y, cw, ch); r.setScissor(x, y, cw, ch);
    aimCamera(c2, cw / ch);
    r.render(scene, c2);
  }
  r.setScissorTest(false);
}
const loop = (time) => {
  if (frames === 0) { aimCamera(cam, canvas.clientWidth / canvas.clientHeight); gfx.render(time / 1000); } // shader warm-up
  else renderAll(time);
  if (++frames < 2) requestAnimationFrame(loop);
  else {
    window.__labReady = true;
    let dbg = '';
    const a = stage.actors[focus];
    if (params.get('dbg') && a?.v?.driverModel) { const m = a.v.driverModel; dbg = ` hips ${m.hips.position.toArray().map((x) => x.toFixed(2))} mount ${a.v.mount?.toFixed(2)} ht ${m.anim.ht?.map((x) => x.toFixed(2))} stand ${m.rigCache?.stand?.map((x) => x.toFixed(2))}`; }
    document.getElementById('info').textContent = `${focus} t=${t0}${n > 1 ? ` · ${n} frames × ${step}s` : ''}${dbg}`;
  }
};
requestAnimationFrame(loop);
window.__lab = { gfx, stage, scene, THREE };
