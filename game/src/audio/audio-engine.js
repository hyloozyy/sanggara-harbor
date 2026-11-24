// WebAudio mixer and synthesized sound effects: gunshots per weapon, explosions, punches,
// crashes, the player's engine note, horns, two-tone police sirens, helicopter rotor thump,
// pickups, checkpoints, UI blips and harbour ambience. Nothing is loaded from files.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volumes = { master: 0.8, sfx: 0.9, music: 0.6, voice: 0.9 };
  }

  // Must be called from a user gesture.
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = this.volumes.master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.volumes.sfx; this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = this.volumes.music; this.music.connect(this.master);
    this.voice = ctx.createGain(); this.voice.gain.value = this.volumes.voice; this.voice.connect(this.master);
    this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.buildEngine();
    this.buildSiren();
    this.buildRotor();
    this.buildAmbience();
  }

  setVolume(kind, v) {
    this.volumes[kind] = v;
    if (!this.ctx) return;
    ({ master: this.master, sfx: this.sfx, music: this.music, voice: this.voice })[kind].gain.value = v;
  }

  get now() { return this.ctx.currentTime; }

  // Pause menu / map: the world goes quiet (effects and voices fade), the menus still click.
  setWorldPaused(on) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfx.gain.setTargetAtTime(on ? 0 : this.volumes.sfx, t, 0.08);
    this.voice.gain.setTargetAtTime(on ? 0 : this.volumes.voice, t, 0.08);
    this.music.gain.setTargetAtTime(on ? this.volumes.music * 0.35 : this.volumes.music * (this.ducked ? 0.45 : 1), t, 0.2);
    this.worldPaused = on;
  }

  // The radio dips while someone is talking.
  duckMusic(on) {
    if (!this.ctx || this.ducked === on || this.worldPaused) return;
    this.ducked = on;
    this.music.gain.setTargetAtTime(this.volumes.music * (on ? 0.45 : 1), this.ctx.currentTime, 0.25);
  }

  noise(duration, { filter = 'lowpass', freq = 2000, q = 1, gain = 0.5, attack = 0.002, decay = duration, dest = this.sfx, when = 0 } = {}) {
    const c = this.ctx, t = this.now + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = duration > 1.9;
    const f = c.createBiquadFilter(); f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random()); src.stop(t + duration + 0.05);
    return { f, g };
  }

  tone(freq, duration, { type = 'sine', gain = 0.3, attack = 0.005, slide = 0, dest = this.sfx, when = 0 } = {}) {
    const c = this.ctx, t = this.now + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0008, t + duration);
    o.connect(g).connect(dest); o.start(t); o.stop(t + duration + 0.05);
  }

  distanceGain(d) { return Math.max(0, 1 - d / 180) ** 1.6; }

  gunshot(kind, distance = 0) {
    if (!this.ctx) return;
    const v = this.distanceGain(distance);
    if (v < 0.01) return;
    const far = distance > 40;
    const spec = { pistol: [2600, 0.18, 0.7], smg: [3200, 0.1, 0.5], shotgun: [1400, 0.35, 1.0] }[kind] || [2600, 0.2, 0.6];
    this.noise(spec[1], { freq: far ? spec[0] * 0.4 : spec[0], gain: spec[2] * v, decay: spec[1] });
    this.tone(far ? 70 : 140, spec[1] * 1.4, { type: 'triangle', gain: 0.5 * v, slide: 0.4 });
    if (!far) this.noise(0.6, { freq: 600, gain: 0.08 * v, attack: 0.03, decay: 0.6, when: 0.04 }); // street echo
  }

  explosion(distance = 0) {
    if (!this.ctx) return;
    const v = Math.max(0.15, this.distanceGain(distance * 0.6));
    this.noise(2.2, { freq: 420, gain: 1.2 * v, decay: 2.2 });
    this.tone(55, 1.4, { type: 'sine', gain: 0.9 * v, slide: 0.5 });
    this.noise(0.4, { freq: 3000, gain: 0.5 * v, decay: 0.4 });
  }

  punch() { if (!this.ctx) return; this.noise(0.12, { freq: 900, gain: 0.6, decay: 0.12 }); this.tone(90, 0.12, { gain: 0.4, slide: 0.6 }); }
  whoosh() { if (!this.ctx) return; this.noise(0.18, { filter: 'bandpass', freq: 1200, q: 2, gain: 0.15, attack: 0.05, decay: 0.18 }); }
  crash(strength = 1) { if (!this.ctx) return; this.noise(0.5, { freq: 1800, gain: Math.min(1, 0.3 + strength * 0.05), decay: 0.5 }); this.tone(70, 0.3, { type: 'square', gain: 0.15, slide: 0.5 }); }
  bulletImpact() { if (!this.ctx) return; this.tone(1800 + Math.random() * 1500, 0.08, { type: 'triangle', gain: 0.06, slide: 0.5 }); }
  pickup() { if (!this.ctx) return; [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', gain: 0.18, when: i * 0.06 })); }
  checkpoint() { if (!this.ctx) return; [880, 1175].forEach((f, i) => this.tone(f, 0.25, { type: 'square', gain: 0.08, when: i * 0.08 })); }
  uiBlip() { if (!this.ctx) return; this.tone(1200, 0.06, { type: 'square', gain: 0.05 }); }
  reload() { if (!this.ctx) return; this.noise(0.06, { filter: 'highpass', freq: 3000, gain: 0.25, decay: 0.06 }); this.noise(0.06, { filter: 'highpass', freq: 2500, gain: 0.25, decay: 0.06, when: 0.35 }); }
  horn() { if (!this.ctx) return; this.tone(392, 0.45, { type: 'sawtooth', gain: 0.12 }); this.tone(494, 0.45, { type: 'sawtooth', gain: 0.1 }); }
  missionJingle(success) {
    if (!this.ctx) return;
    const notes = success ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(f, 0.5, { type: 'triangle', gain: 0.2, when: i * 0.14, dest: this.music }));
  }
  voiceBlip(seed = 0) {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) this.tone(160 + ((seed * 37 + i * 53) % 90), 0.07, { type: 'triangle', gain: 0.04, when: i * 0.08 });
  }
  wantedSting(up) { if (!this.ctx) return; this.tone(up ? 330 : 660, 0.35, { type: 'square', gain: 0.07, slide: up ? 2 : 0.5 }); }

  // --- continuous sounds ----------------------------------------------------
  buildEngine() {
    const c = this.ctx;
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 40;
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 20;
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 400;
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();
    // Tyre squeal.
    this.squeal = c.createBufferSource(); this.squeal.buffer = this.noiseBuffer; this.squeal.loop = true;
    const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 2400; sf.Q.value = 8;
    this.squealGain = c.createGain(); this.squealGain.gain.value = 0;
    this.squeal.connect(sf).connect(this.squealGain).connect(this.sfx); this.squeal.start();
  }

  updateEngine(vehicle) {
    if (!this.ctx) return;
    const t = this.now;
    if (!vehicle || vehicle.wrecked) {
      this.engGain.gain.setTargetAtTime(0, t, 0.1); this.squealGain.gain.setTargetAtTime(0, t, 0.1); return;
    }
    const sp = Math.abs(vehicle.speed), max = vehicle.spec.maxSpeed;
    const gears = 5, gearSize = max / gears;
    const gear = Math.min(gears - 1, Math.floor(sp / gearSize));
    const rpm = 0.25 + 0.75 * ((sp - gear * gearSize) / gearSize);
    const base = vehicle.spec.twoWheel ? 70 : 38;
    const f = base + rpm * base * 2.2 + Math.abs(vehicle.controls.throttle) * 8;
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f / 2, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(300 + rpm * 900 + Math.abs(vehicle.controls.throttle) * 500, t, 0.05);
    this.engGain.gain.setTargetAtTime(0.09 + Math.abs(vehicle.controls.throttle) * 0.06, t, 0.1);
    this.squealGain.gain.setTargetAtTime(vehicle.drifting ? Math.min(0.12, Math.abs(vehicle.lateral) * 0.02) : 0, t, 0.05);
  }

  buildSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'sawtooth'; this.sirenOsc.frequency.value = 700;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200;
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(f).connect(this.sirenGain).connect(this.sfx);
    this.sirenOsc.start();
    this.sirenT = 0;
  }

  updateSiren(dt, nearestDistance) {
    if (!this.ctx) return;
    this.sirenT += dt;
    const wail = 650 + 350 * (0.5 + 0.5 * Math.sin(this.sirenT * 2.4));
    this.sirenOsc.frequency.setTargetAtTime(wail, this.now, 0.02);
    const g = nearestDistance === Infinity ? 0 : 0.07 * this.distanceGain(nearestDistance);
    this.sirenGain.gain.setTargetAtTime(g, this.now, 0.15);
  }

  buildRotor() {
    const c = this.ctx;
    this.rotorSrc = c.createBufferSource(); this.rotorSrc.buffer = this.noiseBuffer; this.rotorSrc.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    this.rotorAmp = c.createGain(); this.rotorAmp.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 11;
    const lfoGain = c.createGain(); lfoGain.gain.value = 0.5;
    const thump = c.createGain(); thump.gain.value = 0.5;
    lfo.connect(lfoGain).connect(thump.gain);
    this.rotorSrc.connect(f).connect(thump).connect(this.rotorAmp).connect(this.sfx);
    this.rotorSrc.start(); lfo.start();
  }

  updateRotor(distance) {
    if (!this.ctx) return;
    this.rotorAmp.gain.setTargetAtTime(distance === Infinity ? 0 : 0.9 * this.distanceGain(distance * 0.7), this.now, 0.2);
  }

  // Thunder rolling in `delay` seconds after a flash: a crack for close strikes, then a long rumble.
  thunder(delay = 1, strength = 1) {
    if (!this.ctx) return;
    const when = Math.min(8, delay);
    if (delay < 1.6) this.noise(0.35, { filter: 'highpass', freq: 900, gain: 0.35 * strength, attack: 0.005, decay: 0.35, when });
    this.noise(4.5, { filter: 'lowpass', freq: 160 + Math.random() * 120, q: 0.7, gain: 0.9 * strength, attack: 0.08 + delay * 0.05, decay: 4.5, when: when + 0.05 });
    this.noise(3.2, { filter: 'lowpass', freq: 70, q: 0.5, gain: 0.8 * strength, attack: 0.3, decay: 3.2, when: when + 0.4 });
  }

  // Continuous weather soundscape: rain (drizzle hiss to downpour roar), wind gusts, dry-season
  // cicadas and night insects; snow muffles the city hum.
  weatherAmbience({ rain = 0, wind = 0, dry = 0, snow = 0, night = 0 }) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this.wx) {
      const loop = (freqType, freq, q = 0.7) => {
        const src = c.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true; src.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = c.createBiquadFilter(); f.type = freqType; f.frequency.value = freq; f.Q.value = q;
        const gn = c.createGain(); gn.gain.value = 0;
        src.connect(f).connect(gn).connect(this.sfx); src.start();
        return { f, gn };
      };
      const hiss = loop('highpass', 1400), roar = loop('lowpass', 520), wind = loop('bandpass', 380, 1.4);
      const cic = c.createOscillator(); cic.type = 'triangle'; cic.frequency.value = 4300;
      const am = c.createOscillator(); am.type = 'square'; am.frequency.value = 28;
      const amG = c.createGain(); amG.gain.value = 0.5;
      const cicG = c.createGain(); cicG.gain.value = 0;
      const amBias = c.createConstantSource(); amBias.offset.value = 0.5;
      const mod = c.createGain(); mod.gain.value = 0;
      am.connect(amG).connect(mod.gain); amBias.connect(mod.gain);
      cic.connect(mod).connect(cicG).connect(this.sfx);
      cic.start(); am.start(); amBias.start();
      this.wx = { hiss, roar, wind, cicG, gust: 0 };
    }
    const w = this.wx, t = this.now;
    w.gust += 0.016;
    const gust = 0.6 + 0.4 * Math.sin(w.gust * 0.7) * Math.sin(w.gust * 0.23 + 1);
    w.hiss.gn.gain.setTargetAtTime(0.16 * rain, t, 0.5);
    w.roar.gn.gain.setTargetAtTime(0.22 * rain * rain, t, 0.5);
    w.wind.gn.gain.setTargetAtTime(0.06 * wind * gust + 0.02 * snow, t, 0.4);
    w.wind.f.frequency.setTargetAtTime(260 + 260 * gust, t, 0.4);
    w.cicG.gain.setTargetAtTime(0.012 * dry + 0.006 * night * (1 - rain), t, 0.8);
    if (this.ambGain) this.ambGain.gain.setTargetAtTime(0.035 * (1 - snow * 0.7), t, 1);
  }

  buildAmbience() {
    const c = this.ctx;
    const src = c.createBufferSource(); src.buffer = this.noiseBuffer; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    this.ambGain = c.createGain(); this.ambGain.gain.value = 0.035;
    src.connect(f).connect(this.ambGain).connect(this.sfx);
    src.start();
  }
}
