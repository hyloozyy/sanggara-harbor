// Entry point (temporary viewer while the city is being built).
import { GameRenderer } from './render/game-renderer.js';
import { buildCity } from './city/city-builder.js';

const canvas = document.getElementById('game-canvas');
const gfx = new GameRenderer(canvas, 'tinggi');
const t0 = performance.now();
const city = buildCity();
gfx.scene.add(city.root);
console.log('city built in', Math.round(performance.now() - t0), 'ms');
document.getElementById('loading-screen').classList.add('hidden');
document.getElementById('title-screen').classList.add('hidden');
const p = new URLSearchParams(location.search);
const cam = (p.get('cam') || '0,40,260,0,10,0').split(',').map(Number);
gfx.camera.position.set(cam[0], cam[1], cam[2]);
gfx.camera.lookAt(cam[3], cam[4], cam[5]);
gfx.lighting.follow(cam[3], cam[5]);
let frames = 0;
function frame() {
  gfx.render(performance.now() / 1000);
  frames++;
  if (frames === 2) { window.__shotReady = true; console.log('info', gfx.renderer.info.render.calls, 'calls', gfx.renderer.info.render.triangles, 'tris'); }
  if (frames < 3) requestAnimationFrame(frame);
}
frame();
