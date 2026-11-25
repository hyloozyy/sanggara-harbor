// Interior lab (debug/interior.html): one room with its people in the game's renderer, no city.
//   ?room=bar|home|shop|clinic   &view=<name> or &cam=x,y,z,tx,ty,tz   &fov=<deg>
//   &t=<s> simulated seconds   &sit=<seat index> seats Raka   &juke=1 jukebox playing
//   &npc=<i>&n=<frames>&step=<s>&cols=<c>&angle=<deg>&dist=<m>&h=<m>  contact sheet of one person
import * as THREE from 'three';
import { GameRenderer } from '../render/game-renderer.js';
import { registerProceduralTextures } from '../assets/texture-catalog.js';
import { Character } from '../characters/character.js';
import { PLAYER_LOOK } from '../characters/player-controller.js';
import { BarInterior } from '../interiors/bar-interior.js';
import { HomeInterior } from '../interiors/home-interior.js';
import { ShopInterior } from '../interiors/shop-interior.js';
import { ClinicInterior } from '../interiors/clinic-interior.js';

const ROOMS = { bar: BarInterior, home: HomeInterior, shop: ShopInterior, clinic: ClinicInterior };
const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) ? Number(params.get(k)) : d);
const canvas = document.getElementById('c');
registerProceduralTextures();
const gfx = new GameRenderer(canvas, params.get('quality') || 'medium', { keepFrames: true });
const room = new ROOMS[params.get('room') || 'bar']();
room.build(gfx.renderer);
gfx.activeScene = room.scene;
const raka = new Character(PLAYER_LOOK, room.entry.x, room.entry.z, { name: 'Raka', atlasSize: 512 });
raka.pos.y = 0; raka.heading = room.entry.heading;
room.scene.add(raka.mesh);
const game = {
  player: { body: raka, pos: raka.pos },
  interiors: { jukeboxOn: params.get('juke') === '1', babble(n, line) { n.body.talk = 0.6; void line; } },
  weather: { clock: { hour: num('hour', 20.5) } },
};
let seat = null;
if (params.has('sit')) { seat = room.seats[num('sit', 0)]; seat.occupant = 'player'; raka.pos.set(seat.x, 0, seat.z); raka.heading = seat.heading; }
if (params.has('px')) { raka.pos.set(num('px', 0), 0, num('pz', 0)); raka.heading = num('ph', 0); }
if (params.has('trip')) { const n = room.npcs[num('trip', 1)]; n.clear(); room.restroomTrip(n); }
if (params.has('gest')) { const n = room.npcs[num('npc', 0)]; n.clear(); n.planFn = null; for (let i = 0; i < 6; i++) n.gesture(params.get('gest'), num('gdur', 2.6)); }
const DT = 1 / 60;
let time = 0;
function step(dt) {
  time += dt;
  room.update(dt, game);
  // Babbling people move their jaws a little.
  for (const n of room.npcs) if (n.task?.type === 'chat') n.body.talk = Math.max(n.body.talk || 0, 0.3 + 0.3 * Math.abs(Math.sin(time * 9)));
  if (seat) raka.sit = { k: Math.min(1, time / 0.9), seatY: seat.seatY, footY: seat.footY, footZ: seat.footZ, arms: seat.arms, footPitch: seat.kind === 'stool' ? 0.25 : 0 };
  raka.move(dt, room.world, 0, 0, null);
  raka.updateVisual(dt, 0);
}
const simTo = (t) => { while (time < t - 1e-6) step(DT); };
const VIEWS = room.views || {};
function aimCamera(c2, aspect) {
  c2.aspect = aspect; c2.near = 0.05;
  c2.fov = num('fov', 55);
  const npc = params.has('npc') ? (params.get('npc') === 'raka' ? { body: raka } : room.npcs[num('npc', 0)]) : null;
  if (npc) {
    const b = npc.body, f = { x: b.pos.x, y: b.pos.y + num('fy', 1.0), z: b.pos.z };
    const bearing = b.heading + THREE.MathUtils.degToRad(num('angle', 30));
    const d = num('dist', 2.6);
    c2.fov = num('fov', 40);
    c2.position.set(f.x + Math.sin(bearing) * d, num('h', 1.4), f.z + Math.cos(bearing) * d);
    c2.lookAt(f.x, f.y, f.z);
  } else {
    const v = params.get('cam') ? params.get('cam').split(',').map(Number) : (VIEWS[params.get('view') || 'overview'] || [0, 2.5, 4, 0, 1, 0]);
    c2.position.set(v[0], v[1], v[2]); c2.lookAt(v[3], v[4], v[5]);
  }
  c2.updateProjectionMatrix();
}
const n = num('n', 1), stepS = num('step', 0.1), t0 = num('t', 3);
const cols = num('cols', Math.min(n, 4)), rows = Math.ceil(n / cols);
let frames = 0;
function renderAll(now) {
  const r = gfx.renderer, W = canvas.clientWidth, H = canvas.clientHeight;
  if (n === 1) { simTo(t0); aimCamera(gfx.camera, W / H); gfx.render(now / 1000); return; }
  const cw = W / cols, ch = H / rows;
  const c2 = new THREE.PerspectiveCamera(40, cw / ch, 0.05, 200);
  r.setScissorTest(true);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  for (let i = 0; i < n; i++) {
    simTo(t0 + i * stepS);
    const x = (i % cols) * cw, y = H - (Math.floor(i / cols) + 1) * ch;
    r.setViewport(x, y, cw, ch); r.setScissor(x, y, cw, ch);
    aimCamera(c2, cw / ch);
    r.render(room.scene, c2);
  }
  r.setScissorTest(false);
}
const loop = (now) => {
  if (frames === 0) { aimCamera(gfx.camera, canvas.clientWidth / canvas.clientHeight); gfx.render(now / 1000); }
  else renderAll(now);
  if (++frames < 2) requestAnimationFrame(loop);
  else {
    window.__labReady = true;
    const info = gfx.renderer.info;
    document.getElementById('info').textContent = `${room.id} t=${t0} · ${info.render.calls} calls · ${(info.render.triangles / 1000).toFixed(0)}k tris`;
  }
};
requestAnimationFrame(loop);
window.__lab = { gfx, room, raka, THREE, step };
