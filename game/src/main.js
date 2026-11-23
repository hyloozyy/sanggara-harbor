// Boot: renderer, input and audio, the loading screen, the title flyover behind the menu, then the
// game loop with pause, settings, map and save/load. ?shot=... stages a screenshot scene.
import { GameRenderer } from './render/game-renderer.js';
import { Input } from './core/input.js';
import { AudioEngine } from './audio/audio-engine.js';
import { Radio } from './audio/radio-stations.js';
import { GameSession } from './game-session.js';
import { MenuScreens } from './ui/menu-screens.js';
import { hasSave, readSave, applySave, loadSettings, saveSettings } from './save/save-system.js';
import { stageScreenshot } from './debug/screenshot-director.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const settings = loadSettings();
const canvas = document.getElementById('game-canvas');
const gfx = new GameRenderer(canvas, shot ? 'tinggi' : settings.quality);
const input = new Input(canvas);
const audio = new AudioEngine();
const radio = new Radio(audio);
const fill = document.getElementById('loading-fill');

let session = null;
let state = 'loading';
let titleT = 0;

function applySettings(s) {
  Object.assign(settings, s);
  saveSettings(settings);
  if (gfx.quality !== settings.quality) gfx.setQuality(settings.quality);
  audio.setVolume('master', settings.master);
  audio.setVolume('music', settings.music);
  audio.setVolume('sfx', settings.sfx);
  if (session) { session.cameraRig.sensitivity = 0.0024 * settings.sensitivity; session.cameraRig.invertY = settings.invertY; }
}

const menus = new MenuScreens({
  onStart(mode) {
    audio.start();
    applySettings(settings);
    menus.hideTitle();
    if (mode === 'continue') applySave(session, readSave());
    session.start({ freeRoam: mode === 'free' });
    if (mode === 'new') session.missions.start(session.missions.nextMission);
    state = 'playing';
    session.cameraRig.override = null;
    input.enabled = true;
    canvas.requestPointerLock?.();
  },
  onResume() { menus.hidePause(); state = 'playing'; input.enabled = true; canvas.requestPointerLock?.(); },
  onPauseAction(id) {
    if (id === 'save') session.saveGame('Manual');
    else if (id === 'load') { applySave(session, readSave()); session.missions.refreshStartMarker(); menus.hidePause(); state = 'playing'; }
    else if (id === 'map') { menus.hidePause(); openMap(); }
    else if (id === 'title') location.reload();
  },
  getSettings: () => ({ ...settings }),
  onSettings: applySettings,
});

function openMap() {
  state = 'map';
  document.getElementById('big-map').classList.remove('hidden');
  session.minimap.drawBig(session.minimapState());
  document.getElementById('big-map-legend').innerHTML = '<b>PETA SANGGARA</b><br>■ Balap · Antar · Bengkel Cat · Toko Besi · Simpan · RS<br>● Tujuan misi<br>[M] tutup';
}

function closeMap() { document.getElementById('big-map').classList.add('hidden'); state = 'playing'; }

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  input.releaseLock();
  const st = session.progression.stats;
  menus.showPause({ ...st, rank: session.progression.rank.name, money: session.progression.money, hasSave: hasSave() });
}

addEventListener('keydown', (e) => {
  if (state === 'playing' && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); pause(); }
  else if (state === 'playing' && e.code === 'KeyM') openMap();
  else if (state === 'map' && (e.code === 'KeyM' || e.code === 'Escape')) closeMap();
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !shot) pause();
});

// Slow cinematic orbit over the city behind the title menu.
function titleCamera(dt) {
  titleT += dt;
  const a = 2.2 + titleT * 0.02;
  session.cameraRig.override = { x: -40 + Math.cos(a) * 190, y: 46 + Math.sin(titleT * 0.1) * 6, z: 210 + Math.sin(a) * 120, tx: 0, ty: 18, tz: 120 };
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'title') {
    titleCamera(dt);
    session.cameraRig.update(dt, session.player, input);
    session.traffic.update(dt, { pos: session.gfx.camera.position.clone().setY(0), vehicle: null }, null);
    session.vehicles.update(dt);
    session.sea.update(now / 1000);
    session.lights.update(dt);
  } else if (state === 'playing') {
    session.update(dt);
    session.hud.update(dt, session.hudState());
    session.minimap.draw(dt, session.minimapState());
  }
  if (state !== 'loading') gfx.render(now / 1000);
  input.endFrame();
  requestAnimationFrame(frame);
}

async function boot() {
  const step = (p) => { fill.style.width = `${Math.round(p * 100)}%`; return new Promise((r) => setTimeout(r, 0)); };
  await step(0.05);
  session = new GameSession(gfx, input, audio, radio, (p) => { fill.style.width = `${Math.round(p * 100)}%`; });
  await step(1);
  applySettings(settings);
  document.getElementById('loading-screen').classList.add('hidden');
  if (shot) {
    state = 'shot';
    document.getElementById('title-screen').classList.add('hidden');
    await stageScreenshot(shot, { session, gfx, menus, params });
    return;
  }
  state = 'title';
  const save = readSave();
  menus.showTitle({ canContinue: !!save, saveLabel: save ? `${save.label || 'Simpanan'} · ${new Date(save.savedAt).toLocaleString('id-ID')}` : '' });
  session.traffic.populate(-40, 160, 18);
  input.enabled = false;
  requestAnimationFrame(frame);
}

boot();
