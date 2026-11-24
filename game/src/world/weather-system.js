// Weather and time of day for the whole city. Weather moves between states (clear golden
// hour, cloudy, light rain, tropical downpour with lightning, dry-season haze, sea fog and a
// rare freak snowfall) with smooth transitions of every parameter, and drives the sun and
// moon, sky, clouds, stars, fog, exposure, wet and snowy surfaces, lit windows and street
// lamps at night, rain/snow/dust particles, lightning with delayed thunder, the weather
// soundscape and a periodically re-baked reflection environment.
import * as THREE from 'three';
import { TimeOfDay, DEFAULT_HOUR } from './time-of-day.js';
import { Precipitation } from '../effects/precipitation.js';
import { SURFACE_WEATHER, weatherizeTree } from '../render/surface-weather.js';
import { bakeSkyEnvironment } from '../render/sky-dome.js';
import { assets } from '../assets/asset-library.js';

export const WEATHER_STATES = {
  clear: { label: 'Clear', icon: '☀', cloud: 0.35, overcast: 0, rain: 0, snow: 0, dust: 0, haze: 0, fog: 1, light: 1, wind: 0.25, wet: 0, lightning: 0, dry: 0, weight: 30 },
  cloudy: { label: 'Cloudy', icon: '☁', cloud: 0.85, overcast: 0.4, light: 0.66, fog: 0.8, wind: 0.45, weight: 20 },
  drizzle: { label: 'Light rain', icon: '☂', cloud: 0.95, overcast: 0.75, rain: 0.35, light: 0.5, fog: 0.55, wind: 0.5, wet: 0.75, weight: 15 },
  storm: { label: 'Tropical downpour', icon: '⛈', cloud: 1, overcast: 1, rain: 1, light: 0.3, fog: 0.3, wind: 1, wet: 1, lightning: 1, weight: 10 },
  dry: { label: 'Dry season haze', icon: '☼', cloud: 0.08, haze: 1, dust: 0.7, light: 1.05, fog: 0.55, wind: 0.55, dry: 1, weight: 12 },
  fog: { label: 'Sea fog', icon: '≋', cloud: 0.7, overcast: 0.6, light: 0.55, fog: 0.14, wind: 0.1, wet: 0.25, weight: 8 },
  snow: { label: 'Freak snowfall', icon: '❄', cloud: 0.95, overcast: 0.85, snow: 1, light: 0.62, fog: 0.35, wind: 0.3, weight: 2 },
};
const KEYS = ['cloud', 'overcast', 'rain', 'snow', 'dust', 'haze', 'fog', 'light', 'wind', 'lightning', 'dry'];
const full = (s) => Object.fromEntries(KEYS.map((k) => [k, s[k] ?? (k === 'fog' || k === 'light' ? 1 : 0)]));

const GREY = new THREE.Color(0.55, 0.58, 0.62);
const HAZE = new THREE.Color(0.85, 0.66, 0.46);
const tmpC = new THREE.Color();

export class WeatherSystem {
  constructor(gfx, audio, { state = 'clear', hour = DEFAULT_HOUR, auto = true } = {}) {
    this.gfx = gfx;
    this.audio = audio;
    this.clock = new TimeOfDay(hour);
    this.state = state;
    this.auto = auto;
    this.cur = full(WEATHER_STATES[state]);
    this.target = full(WEATHER_STATES[state]);
    this.wetness = WEATHER_STATES[state].wet ?? 0;
    this.snowCover = state === 'snow' ? 1 : 0;
    this.timer = 160 + Math.random() * 120;
    this.flash = 0;
    this.flashQueue = [];
    this.lightningTimer = 4;
    this.fx = new Precipitation(gfx.scene);
    this.lampMats = [];
    this.poolMats = [];
    this.bakeTimer = 0;
    this.lastBake = null;
    this.baseFog = { near: 160, far: 1150 };
    this.baseExposure = gfx.post.compositeMat.uniforms.exposure.value;
    this.baseEnvIntensity = gfx.scene.environmentIntensity ?? 0.85;
  }

  // After the city is built: patch materials for wet/snow, find lamps and light pools.
  attachCity(root) {
    weatherizeTree(root);
    root.traverse((o) => {
      const mats = !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.userData.lampPool && !this.poolMats.includes(m)) this.poolMats.push(m);
      }
    });
    this.lampMats = [assets.material('lamp-glow')];
    this.apply(0);
    this.rebake();
  }

  setState(name, immediate = false) {
    if (!WEATHER_STATES[name]) return;
    this.state = name;
    this.target = full(WEATHER_STATES[name]);
    this.timer = 150 + Math.random() * 150;
    if (immediate) {
      this.cur = { ...this.target };
      this.wetness = WEATHER_STATES[name].wet ?? 0;
      this.snowCover = name === 'snow' ? 1 : 0;
      this.apply(0);
      this.rebake();
    }
  }

  pickNext() {
    const list = Object.entries(WEATHER_STATES).filter(([k]) => k !== this.state);
    let r = Math.random() * list.reduce((s, [, v]) => s + v.weight, 0);
    for (const [k, v] of list) { r -= v.weight; if (r <= 0) return k; }
    return 'clear';
  }

  get label() { return WEATHER_STATES[this.state].label; }
  get icon() { return WEATHER_STATES[this.state].icon; }
  get raining() { return this.cur.rain > 0.15; }
  get grip() { return 1 - 0.28 * this.wetness - 0.35 * this.snowCover; }

  update(dt, camera) {
    this.clock.update(dt);
    if (this.auto) { this.timer -= dt; if (this.timer <= 0) this.setState(this.pickNext()); }
    const k = 1 - Math.exp(-dt / 14);
    for (const key of KEYS) this.cur[key] += (this.target[key] - this.cur[key]) * k;
    const wetGoal = Math.max(WEATHER_STATES[this.state].wet ?? 0, this.cur.rain);
    this.wetness += (wetGoal - this.wetness) * (wetGoal > this.wetness ? 0.06 : 0.008) * dt * 6;
    const snowGoal = this.cur.snow > 0.3 ? 1 : 0;
    this.snowCover += (snowGoal - this.snowCover) * (snowGoal ? 0.012 : 0.02) * dt * 2;
    this.updateLightning(dt, camera);
    this.apply(dt, camera);
    this.bakeTimer -= dt;
    if (this.bakeTimer <= 0) { this.bakeTimer = 12; if (this.needsBake()) this.rebake(); }
  }

  updateLightning(dt, camera) {
    this.flash = Math.max(0, this.flash - dt * 7);
    for (const f of this.flashQueue) f.t -= dt;
    while (this.flashQueue.length && this.flashQueue[0].t <= 0) this.flash = Math.max(this.flash, this.flashQueue.shift().v);
    if (this.cur.lightning < 0.5) return;
    this.lightningTimer -= dt;
    if (this.lightningTimer > 0) return;
    this.lightningTimer = 5 + Math.random() * 12;
    const strength = 0.6 + Math.random() * 0.6;
    this.flashQueue.push({ t: 0, v: strength }, { t: 0.12, v: strength * 0.5 }, { t: 0.28, v: strength });
    const distance = 300 + Math.random() * 2200;          // metres; sound travels ~340 m/s
    this.audio.thunder?.(distance / 340, strength * Math.min(1, 900 / distance + 0.3));
    void camera;
  }

  apply(dt, camera = this.gfx.camera) {
    const g = this.gfx, L = g.lighting, sky = g.sky.material.uniforms, c = this.cur, tod = this.clock, p = tod.palette;
    const light = c.light;
    const dim = Math.max(0.25, light);
    // Sun / moon.
    L.direction.copy(tod.lightDir);
    L.sun.color.copy(p.sun).lerp(GREY, c.overcast * 0.6);
    L.sun.intensity = p.sunI * dim * (1 - c.overcast * 0.7) + this.flash * 2.5;
    L.hemi.color.copy(p.sky).lerp(GREY, c.overcast * 0.5);
    L.hemi.groundColor.copy(p.ground);
    L.hemi.intensity = p.hemiI * (0.7 + 0.3 * dim) * (1 + c.overcast * 0.25) + this.flash * 3;
    L.fill.intensity = 0.3 * (1 - tod.night) * dim;
    // Fog: thicker and greyer with rain and fog, warm and dusty in the dry season.
    const fog = g.scene.fog;
    fog.color.copy(p.fog).lerp(tmpC.copy(GREY).multiplyScalar(0.35 + 0.65 * (1 - tod.night) * dim), c.overcast * 0.7).lerp(HAZE.clone().multiplyScalar(0.5 + 0.5 * (1 - tod.night)), c.haze * 0.6);
    fog.near = this.baseFog.near * (0.15 + 0.85 * c.fog);
    fog.far = this.baseFog.far * (0.08 + 0.92 * c.fog);
    // Sky.
    sky.sunDir.value.copy(tod.sunDir);
    const desat = (dst, src) => { dst.copy(src); const l = dst.r * 0.3 + dst.g * 0.55 + dst.b * 0.15; tmpC.setRGB(l, l, l * 1.05); dst.lerp(tmpC, c.overcast * 0.75).multiplyScalar(0.45 + 0.55 * Math.max(dim, 1 - c.overcast)); dst.lerp(HAZE, c.haze * 0.25); };
    desat(sky.zenith.value, p.zen); desat(sky.midSky.value, p.mid); desat(sky.horizon.value, p.hor);
    sky.sunColor.value.copy(p.disc).multiplyScalar(1 - c.overcast * 0.85);
    sky.cloudAmount.value = c.cloud;
    sky.overcast.value = c.overcast * 0.9;
    sky.cloudLit.value.copy(p.disc).multiplyScalar(1.15 * (1 - c.overcast * 0.6)).lerp(tmpC.setRGB(0.5, 0.52, 0.56).multiplyScalar(0.3 + 0.7 * (1 - tod.night)), c.overcast * 0.7);
    sky.cloudShade.value.copy(p.mid).multiplyScalar(0.65).lerp(tmpC.setRGB(0.22, 0.24, 0.27).multiplyScalar(0.25 + 0.75 * (1 - tod.night)), c.overcast * 0.85);
    sky.night.value = tod.night * (1 - c.overcast);
    sky.flash.value = this.flash;
    // Exposure, environment, grade.
    const u = g.post.compositeMat.uniforms;
    u.exposure.value = this.baseExposure * p.exp * (1 + (1 - dim) * 0.25);
    u.saturation.value = 1.12 - c.overcast * 0.3 - c.haze * 0.1 + c.dry * 0.05;
    u.heat.value = c.haze * (1 - tod.night);
    u.flash.value = this.flash;
    g.scene.environmentIntensity = this.baseEnvIntensity * (0.35 + 0.65 * dim) * (1 - tod.night * 0.5);
    // Night lights: windows glow brighter after dusk, street lamps and light pools switch on.
    const dayness = Math.min(1, Math.max(0, (tod.elevation - 0.36) / 0.3)) * (1 - c.overcast * 0.4);
    const windowGlow = 1.05 - 0.9 * dayness + 0.55 * tod.night;
    assets.forEachMaterial((m, key) => { if (key.startsWith('facade:')) m.emissiveIntensity = windowGlow; });
    const lampsOn = 1 - Math.min(1, Math.max(0, (tod.elevation - 0.2) / 0.15)) * (1 - c.overcast * 0.6);
    for (const m of this.lampMats) m.emissiveIntensity = 0.3 + 8.7 * lampsOn;
    for (const m of this.poolMats) m.opacity = 0.32 * lampsOn * (1 + tod.night * 0.4);
    // Surfaces and particles.
    SURFACE_WEATHER.uWet.value = this.wetness;
    SURFACE_WEATHER.uSnow.value = this.snowCover;
    SURFACE_WEATHER.uDry.value = c.dry;
    if (camera) { camera.updateMatrixWorld(); SURFACE_WEATHER.uCamWorld.value.copy(camera.matrixWorld); }
    this.fx.update(dt, camera, { rain: c.rain, snow: c.snow, dust: c.dust, wind: c.wind, pixelRatio: g.renderer.getPixelRatio() });
    this.audio.weatherAmbience?.({ rain: c.rain, wind: c.wind, dry: c.dry * (1 - tod.night), snow: c.snow, night: tod.night });
  }

  needsBake() {
    const s = this.snapshot();
    const b = this.lastBake;
    if (!b) return true;
    return Math.abs(s.e - b.e) > 0.06 || Math.abs(s.o - b.o) > 0.12 || Math.abs(s.l - b.l) > 0.12 || Math.abs(s.h - b.h) > 0.15;
  }

  snapshot() { return { e: this.clock.elevation, o: this.cur.overcast, l: this.cur.light, h: this.cur.haze }; }

  // Re-render the reflection environment from the current sky.
  rebake() {
    const g = this.gfx;
    const old = g.environment;
    const ground = tmpC.copy(g.scene.fog.color).multiplyScalar(0.25).getHex();
    const tex = bakeSkyEnvironment(g.renderer, this.clock.sunDir, g.sky.material.uniforms, ground);
    g.environment = tex;
    g.scene.environment = tex;
    assets.setEnvironment(tex);
    const swap = (m) => { if (m && m.envMap === old) m.envMap = tex; };
    g.scene.traverse((o) => { if (!o.material) return; if (Array.isArray(o.material)) o.material.forEach(swap); else swap(o.material); });
    assets.forEachMaterial(swap);
    if (old && old.userData.renderTarget) old.userData.renderTarget.dispose();
    this.lastBake = this.snapshot();
  }
}
