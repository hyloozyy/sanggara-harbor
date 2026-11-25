// Vehicle lab (debug/cars.html): the game's renderer, sky and lighting with only the vehicles on
// a plain asphalt lot, so the car models can be checked quickly without loading the city.
//   ?view=lineup            every model in two rows
//   ?view=close&model=key   one model, camera at &angle (deg, 0 = front) &dist &h
//   &brake=1 brake lights on, &steer=0.5 front wheels turned
import * as THREE from 'three';
import { GameRenderer } from '../render/game-renderer.js';
import { assets } from '../assets/asset-library.js';
import { registerProceduralTextures } from '../assets/texture-catalog.js';
import { VEHICLE_MODELS } from '../vehicles/vehicle-catalog.js';
import { Vehicle } from '../vehicles/vehicle.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const gfx = new GameRenderer(canvas, params.get('quality') || 'high', { keepFrames: true });
registerProceduralTextures();
const scene = gfx.scene;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), (() => { try { return assets.material('asphalt'); } catch { return new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.8 }); } })());
ground.receiveShadow = true;
scene.add(ground);

const view = params.get('view') || 'lineup';
const keys = Object.keys(VEHICLE_MODELS);
const cars = [];
const place = (key, x, z, heading, colorIndex = 0) => {
  const spec = VEHICLE_MODELS[key];
  const v = new Vehicle(spec, key, spec.colors[colorIndex % spec.colors.length], x, z, heading);
  if (params.get('brake') === '1') v.braking = true, v.controls.throttle = -1;
  v.steer = Number(params.get('steer') || 0);
  v.syncMesh();
  scene.add(v.mesh);
  cars.push(v);
  return v;
};
const cam = gfx.camera;
let focus = new THREE.Vector3();
if (view === 'lineup') {
  const half = Math.ceil(keys.length / 2);
  keys.forEach((k, i) => {
    const row = Math.floor(i / half), col = i % half;
    place(k, (col - (half - 1) / 2) * 4.6, row * 7.5, Math.PI + 0.6, Number(params.get('color') || 0));
  });
  cam.fov = 34;
  cam.position.set(0, 10, -27);
  focus.set(0, 0.4, 3.2);
} else if (view === 'sheet') {
  // Every model in its own viewport cell, all from the same angle (&angle, &h).
  keys.forEach((k, i) => place(k, i * 14, 0, 0, Number(params.get('color') || 0)));
} else {
  const key = params.get('model') || 'lestari';
  const v = place(key, 0, 0, 0, Number(params.get('color') || 0));
  const a = THREE.MathUtils.degToRad(Number(params.get('angle') ?? 35));
  const d = Number(params.get('dist') || Math.max(4.5, v.spec.length * 1.25));
  const h = Number(params.get('h') || 1.6);
  cam.fov = 40;
  cam.position.set(Math.sin(a) * d, h, Math.cos(a) * d);
  focus.set(0, v.spec.height * 0.45, 0);
}
if (params.get('top') === '1') { cam.position.set(0.001, 14, 0); cam.fov = 22; }
if (params.get('side') === '1') { cam.position.set(14, 0.8, 0); cam.fov = 22; focus.set(0, 0.8, 0); }
if (params.get('front') === '1') { cam.position.set(0, 1.0, 14); cam.fov = 14; focus.set(0, 0.8, 0); }
cam.updateProjectionMatrix();
cam.lookAt(focus);
// Debug: show only one part (paint, glass, multi) of the shells.
const only = params.get('only');
if (only) for (const v of cars) v.mesh.traverse((o) => { const sh = o.userData.shell; if (sh) { sh.paintMesh.visible = only === 'paint'; sh.glassMesh.visible = only === 'glass'; sh.multiMesh.visible = only === 'multi'; } });
if (params.get('wire') === '1') for (const v of cars) v.mesh.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.wireframe = true; } });
gfx.lighting.follow(focus.x, focus.z);
assets.applyEnvironment(scene);
let tris = 0, calls = 0;
gfx.renderer.info.autoReset = false;
const frame = (t) => {
  gfx.renderer.info.reset();
  gfx.render(t / 1000);
  const info = gfx.renderer.info.render;
  tris = info.triangles; calls = info.calls;
};
let n = 0;
const sheet = (t) => {
  const r = gfx.renderer, cols = 4, rows = Math.ceil(cars.length / cols);
  const W = canvas.clientWidth, H = canvas.clientHeight, cw = W / cols, ch = H / rows;
  r.setScissorTest(true);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const a = THREE.MathUtils.degToRad(Number(params.get('angle') ?? 35));
  const c2 = new THREE.PerspectiveCamera(30, cw / ch, 0.1, 500);
  cars.forEach((v, i) => {
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    r.setViewport(x, y, cw, ch); r.setScissor(x, y, cw, ch);
    const d = Math.max(v.spec.length, 2.6) * 2.2;
    c2.position.set(v.pos.x + Math.sin(a) * d, Number(params.get('h') || 1.5) + v.spec.height * 0.3, Math.cos(a) * d);
    c2.lookAt(v.pos.x, v.spec.height * 0.42, 0);
    gfx.lighting.follow(v.pos.x, 0);
    r.render(scene, c2);
  });
  r.setScissorTest(false);
};
const loop = (t) => { if (view === 'sheet') { gfx.renderer.info.reset(); sheet(t); } else frame(t); if (++n < 3) requestAnimationFrame(loop); else { window.__labReady = true; document.getElementById('info').textContent = `${view} · ${calls} calls · ${tris} tris`; } };
requestAnimationFrame(loop);
window.__lab = { gfx, cars, scene, THREE };
