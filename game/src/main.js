// Boot: renderer, input and audio, the loading screen, the title flyover behind the menu, then the
// game loop with pause, settings, map and save/load. ?shot=... stages a screenshot scene.
import { GameSession } from './game-session.js';
import { MenuScreens } from './ui/menu-screens.js';
import { hasSave, readSave, applySave, loadSettings, saveSettings } from './save/save-system.js';
import { GameRenderer } from './render/game-renderer.js';
import { Input, lockPointer } from './core/input.js';
import { AudioEngine } from './audio/audio-engine.js';
import { Radio } from './audio/radio-stations.js';
import { registerProceduralTextures } from './assets/texture-catalog.js';
import { stageScreenshot } from './debug/screenshot-director.js';
import { ControlRouter } from './core/control-router.js';
import { GamepadInput } from './core/gamepad.js';
import { TouchController } from './ui/touch-controller.js';
import { CityMapScreen } from './ui/city-map-screen.js';

registerProceduralTextures();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const settings = loadSettings();
const canvas = document.getElementById('game-canvas');
const gfx = new GameRenderer(canvas, shot ? (params.get('quality') || 'high') : settings.quality, { keepFrames: !!shot });
const input = new Input(canvas);
const router = new ControlRouter(input);
const gamepad = new GamepadInput(input, router);
const touch = new TouchController(input, router);
const audio = new AudioEngine();
const radio = new Radio(audio);
const fill = document.getElementById('loading-fill');

let session = null;
// Every button in the menus, map and conversations clicks.
document.addEventListener('click', (e) => { if (e.target.closest?.('button')) audio.uiClick?.(); }, true);
let state = 'loading';
let titleT = 0;

// Weather and time of day from the settings (or ?weather= / ?hour= in the address).
const TIME_MODES = { golden: 17.0, dawn: 6.2, noon: 12.5, sunset: 18.2, night: 22.5 };
function applyWorldSettings() {
  const w = session.weather;
  const urlWeather = params.get('weather'), urlHour = params.get('hour');
  const wx = urlWeather || (shot ? 'clear' : settings.weather);
  w.auto = wx === 'auto';
  if (!w.auto && w.state !== wx) w.setState(wx, true);
  const mode = urlHour ? 'fixed' : shot ? 'golden' : settings.timeMode;
  w.clock.frozen = mode !== 'cycle';
  if (urlHour) w.clock.hour = Number(urlHour);
  else if (TIME_MODES[mode] != null) w.clock.hour = TIME_MODES[mode];
  w.clock.compute();
}

function applySettings(s) {
  Object.assign(settings, s);
  saveSettings(settings);
  if (gfx.quality !== settings.quality) gfx.setQuality(settings.quality);
  audio.setVolume('master', settings.master);
  audio.setVolume('music', settings.music);
  audio.setVolume('sfx', settings.sfx);
  audio.setVolume('voice', settings.voice);
  touch.setMode(settings.touch);
  if (session) { session.cameraRig.sensitivity = 0.0024 * settings.sensitivity; session.cameraRig.invertY = settings.invertY; applyWorldSettings(); }
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
    session.hud.notify('WASD move · Mouse look · F enter/steal car · Left click shoot, right click aim');
    setTimeout(() => session.hud.notify('Yellow circle = mission · M map · Esc pause & save'), 4500);
    session.cameraRig.override = null;
    input.enabled = true;
    if (!touch.wanted()) lockPointer(canvas);
  },
  onResume() { menus.hidePause(); state = 'playing'; worldPaused(false); input.enabled = true; if (!touch.wanted()) lockPointer(canvas); },
  onPauseAction(id) {
    if (id === 'save') session.saveGame('Manual');
    else if (id === 'load') { applySave(session, readSave()); session.missions.refreshStartMarker(); menus.hidePause(); state = 'playing'; worldPaused(false); }
    else if (id === 'map') { menus.hidePause(); openMap(); }
    else if (id === 'title') location.reload();
  },
  getSettings: () => ({ ...settings }),
  onEditLayout: (done) => touch.openEditor(done),
  onSettings: applySettings,
});

function worldPaused(on) { audio.setWorldPaused?.(on); session?.voices.pause(on); }

let mapScreen = null;
function openMap() {
  state = 'map';
  worldPaused(true);
  input.releaseLock();
  mapScreen.open();
  document.getElementById('big-map-legend').innerHTML = '<b>MAP OF SANGGARA</b><br><i style="background:#ffd23a;border-radius:50%"></i>Next story mission · <i style="background:#ffc35a"></i>Story place<br><i style="background:#40ffc0"></i>Activity · <i style="background:#ff5a5a"></i>Gang turf · <i style="background:#e8e2d4"></i>Landmark<br><i style="background:#e65aff"></i>Waypoint · <i style="background:#ff3a3a;border-radius:50%"></i>Police<br>Click a district or place for details · right-click: waypoint<br>Drag to pan · wheel / pinch to zoom · M / Esc close';
}

function closeMap() { mapScreen.close(); state = 'playing'; worldPaused(false); if (!touch.wanted()) lockPointer(canvas); }

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  worldPaused(true);
  input.releaseLock();
  const st = session.progression.stats;
  menus.showPause({ ...st, rank: session.progression.rank.name, money: session.progression.money, hasSave: hasSave() });
}

addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return; // already handled by a menu (e.g. Esc that just resumed)
  if (state === 'playing' && session.talk.choosing) return; // the conversation handles its own keys
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

// Watch the frame rate for the first seconds and step the graphics down if the GPU struggles.
const perf = { frames: 0, time: 0, done: !!localStorage.getItem('pelabuhan-sanggara-settings-v1') };
function autoQuality(rawDt) {
  if (perf.done || state === 'loading') return;
  perf.frames++; perf.time += rawDt;
  if (perf.time < 4) return;
  const fps = perf.frames / perf.time;
  const order = ['high', 'medium', 'low'];
  const i = order.indexOf(gfx.quality);
  if (fps < 34 && i < order.length - 1) {
    gfx.setQuality(order[i + 1]);
    settings.quality = order[i + 1];
    perf.frames = 0; perf.time = 0;
    if (i + 1 === order.length - 1) perf.done = true;
  } else perf.done = true;
}

let last = performance.now();
function frame(now) {
  const raw = (now - last) / 1000;
  const dt = Math.min(0.05, raw);
  last = now;
  autoQuality(Math.min(raw, 0.5));
  if (session) input.context = session.player.vehicle ? 'vehicle' : 'foot';
  gamepad.menuMode = state !== 'playing' || !!session?.talk.choosing;
  gamepad.update(dt);
  touch.setActive(state === 'playing');
  touch.update();
  if (state === 'title') {
    titleCamera(dt);
    session.cameraRig.update(dt, session.player, input);
    session.traffic.update(dt, { pos: session.gfx.camera.position.clone().setY(0), vehicle: null }, null);
    session.vehicles.update(dt);
    session.sea.update(now / 1000);
    session.ambient.update(now / 1000);
    session.lights.update(dt);
    session.weather.update(dt, gfx.camera);
  } else if (state === 'map') {
    mapScreen.update(dt, gamepad.mapCursor);
    gamepad.mapCursor = null;
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
  session.onTalkAvailable = (on) => touch.setTalkAvailable(on);
  mapScreen = new CityMapScreen(session, session.minimap);
  mapScreen.onClose = () => closeMap();
  window.__game = { session, gfx, input, touch, gamepad, mapScreen };
  await step(1);
  applySettings(settings);
  document.getElementById('loading-screen').classList.add('hidden');
  if (shot) {
    state = 'shot';
    document.getElementById('title-screen').classList.add('hidden');
    window.__game = { session, gfx };
    await stageScreenshot(shot, { session, gfx, menus, params });
    return;
  }
  state = 'title';
  const save = readSave();
  menus.showTitle({ canContinue: !!save, saveLabel: save ? `${save.label || 'Save'} · ${new Date(save.savedAt).toLocaleString('en-GB')}` : '', completed: save?.missions?.completed || [] });
  session.traffic.populate(-40, 160, 18);
  input.enabled = false;
  requestAnimationFrame(frame);
}

boot();
