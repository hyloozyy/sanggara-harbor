// Voices for every spoken line. Each speaker gets a voice profile (gender, age, pitch, pace).
// When the browser has an English speech voice (local voices first, so it works offline) the line
// is spoken with speechSynthesis, picking a different voice / pitch / rate per character; without
// one, a WebAudio "voice babble" is synthesised: formant-filtered syllables, one per syllable of
// the text, with the speaker's pitch and intonation (rising on questions), panned and attenuated
// by where the speaker stands. Either way the speaker's mouth follows: speech boundary events and
// a syllable rhythm drive the jaw, the babble schedule drives it exactly.

const FEMALE_HINTS = /female|woman|zira|samantha|victoria|karen|moira|tessa|fiona|susan|hazel|libby|aria|jenny|sonia|natasha|serena|allison|ava|kate|emma|amy|joanna|salli|kimberly|ivy|kendra|veena|catherine/i;
const VOWELS = { a: [780, 1250], e: [520, 1850], i: [320, 2250], o: [520, 920], u: [350, 820], y: [330, 2100] };

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

// Voice profile from a gender/age and a seed.
export function voiceProfile(gender = 'm', age = 'adult', seed = 1, extra = {}) {
  const r = (k) => ((hash(seed + ':' + k) % 1000) / 1000);
  const f = gender === 'f';
  const base = f ? 205 : 112;
  const ageMul = age === 'old' ? (f ? 0.88 : 0.9) : age === 'young' ? 1.08 : 1;
  return {
    gender, age, seed,
    f0: base * ageMul * (0.88 + r('f0') * 0.26),
    pitch: (f ? 1.1 : 0.85) * (age === 'young' ? 1.08 : age === 'old' ? 0.9 : 1) * (0.92 + r('p') * 0.18),
    rate: (age === 'old' ? 0.9 : age === 'young' ? 1.08 : 1) * (0.94 + r('r') * 0.14),
    breathy: r('b'), radio: false, ...extra,
  };
}

export const CAST_VOICES = {
  raka: voiceProfile('m', 'adult', 'raka', { f0: 118, pitch: 0.92 }),
  dimas: voiceProfile('m', 'young', 'dimas', { f0: 132, pitch: 1.05, rate: 1.12 }),
  lastri: voiceProfile('f', 'old', 'lastri', { f0: 188, pitch: 1.0, rate: 0.95 }),
  harun: voiceProfile('m', 'old', 'harun', { f0: 100, pitch: 0.8, rate: 0.88 }),
  rusdi: voiceProfile('m', 'adult', 'rusdi', { f0: 88, pitch: 0.7, rate: 0.86 }),
  bayu: voiceProfile('m', 'adult', 'bayu', { f0: 122, pitch: 0.95, rate: 1.1 }),
  wulan: voiceProfile('f', 'adult', 'wulan', { f0: 196, pitch: 1.05, rate: 1.0 }),
  warga: voiceProfile('m', 'adult', 'warga'),
  radio: voiceProfile('m', 'adult', 'radio', { radio: true, f0: 115, rate: 1.15 }),
};

// Syllables of a text, with pauses for spaces and punctuation: [{ dur, gap, vowel, consonant }].
function syllabify(text, rate) {
  const out = [];
  for (const raw of text.split(/(\s+|[,.!?;:—-]+)/)) {
    if (!raw) continue;
    if (/^[,.!?;:—-]+$/.test(raw)) { if (out.length) out[out.length - 1].gap += /[.!?]/.test(raw) ? 0.28 : 0.16; continue; }
    if (/^\s+$/.test(raw)) { if (out.length) out[out.length - 1].gap += 0.05; continue; }
    const groups = raw.toLowerCase().match(/[^aeiouy]*[aeiouy]+/g) || [raw];
    for (const g of groups) {
      const vowel = g.match(/[aeiouy]/)?.[0] || 'a';
      out.push({ dur: (0.085 + Math.min(4, g.length) * 0.022) / rate, gap: 0.012, vowel, consonant: /^[^aeiouy]/.test(g) ? g[0] : null });
    }
  }
  return out;
}

export class VoiceDirector {
  constructor(audio) {
    this.audio = audio;
    this.synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
    this.voices = [];
    this.current = null;
    this.useSpeech = true;
    this.listener = null; // { x, z, yaw } of the camera, for panning babble
    if (this.synth) {
      const load = () => { this.voices = this.synth.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang)); };
      load();
      try { this.synth.addEventListener('voiceschanged', load); } catch { /* old browsers */ }
    }
  }

  // Local voices first; remote ones only while online.
  pickVoice(profile) {
    const usable = this.voices.filter((v) => v.localService || navigator.onLine);
    if (!usable.length) return null;
    const local = usable.filter((v) => v.localService);
    const pool = local.length ? local : usable;
    const fem = pool.filter((v) => FEMALE_HINTS.test(v.name)), male = pool.filter((v) => !FEMALE_HINTS.test(v.name));
    const group = (profile.gender === 'f' ? fem : male).length ? (profile.gender === 'f' ? fem : male) : pool;
    return group[hash(profile.seed) % group.length];
  }

  get busy() { return !!this.current && (this.current.mode === 'speech' ? this.current.speaking : this.audio.ctx && this.audio.ctx.currentTime < this.current.end); }

  stop() {
    if (this.current?.mode === 'speech') try { this.synth.cancel(); } catch { /* ignore */ }
    if (this.current?.nodes) for (const n of this.current.nodes) try { n.stop(); } catch { /* already stopped */ }
    if (this.current?.character) this.current.character.talk = 0;
    this.current = null;
  }

  // Speak a line; returns the estimated duration in seconds.
  speak(text, profile, character = null, position = null) {
    this.stop();
    const vol = (this.audio.volumes.voice ?? 0.9) * (this.audio.volumes.master ?? 0.8);
    const voice = this.useSpeech && this.synth && !profile.radio ? this.pickVoice(profile) : null;
    if (voice && vol > 0.01) {
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang;
      u.pitch = Math.max(0.1, Math.min(2, profile.pitch)); u.rate = Math.max(0.5, Math.min(1.6, profile.rate));
      let attenuation = 1;
      if (position && this.listener) attenuation = Math.max(0.25, 1 - Math.hypot(position.x - this.listener.x, position.z - this.listener.z) / 30);
      u.volume = Math.min(1, vol * attenuation * 1.1);
      const cur = { mode: 'speech', character, speaking: true, started: performance.now(), pulse: 0, rate: u.rate };
      u.onboundary = () => { cur.pulse = performance.now(); };
      u.onend = u.onerror = () => { cur.speaking = false; if (cur.character) cur.character.talk = 0; };
      this.current = cur;
      try { this.synth.speak(u); } catch { cur.speaking = false; }
      const words = text.split(/\s+/).length;
      return words / (2.7 * u.rate) + 0.4;
    }
    return this.babble(text, profile, character, position);
  }

  // Formant babble: a glottal sawtooth through two vowel formant band-passes per syllable,
  // a noise burst for consonants, pitch declining over the phrase and rising for questions.
  babble(text, profile, character, position) {
    const a = this.audio, c = a.ctx;
    const syl = syllabify(text, profile.rate);
    const total = syl.reduce((s, x) => s + x.dur + x.gap, 0);
    if (!c) { this.current = { mode: 'babble', character, schedule: [], t0: performance.now() / 1000, end: Infinity, wall: true, total }; return total; }
    const t0 = c.currentTime + 0.03;
    const out = c.createGain();
    out.gain.value = 0.55;
    let dest = a.voice || a.master;
    let tail = out;
    if (profile.radio) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
      const sh = c.createWaveShaper(); const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 3); } sh.curve = curve;
      tail.connect(bp); bp.connect(sh); tail = sh;
      a.noise(total + 0.3, { filter: 'bandpass', freq: 2500, q: 0.6, gain: 0.03, dest });
    }
    if (position && this.listener && c.createStereoPanner) {
      const dx = position.x - this.listener.x, dz = position.z - this.listener.z, d = Math.hypot(dx, dz);
      const right = Math.cos(this.listener.yaw) * dx - Math.sin(this.listener.yaw) * dz;
      const pan = c.createStereoPanner(); pan.pan.value = Math.max(-0.8, Math.min(0.8, -right / Math.max(4, d)));
      const att = c.createGain(); att.gain.value = Math.max(0.15, 1 - d / 35);
      tail.connect(pan).connect(att); tail = att;
    }
    tail.connect(dest);
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    const vib = c.createOscillator(); vib.frequency.value = 5.2; const vibG = c.createGain(); vibG.gain.value = profile.f0 * 0.012;
    vib.connect(vibG).connect(osc.frequency);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 9;
    const g1 = c.createGain(), g2 = c.createGain(); g2.gain.value = 0.55;
    const env = c.createGain(); env.gain.value = 0;
    osc.connect(f1).connect(g1).connect(env); osc.connect(f2).connect(g2).connect(env);
    env.connect(out);
    const question = /\?\s*$/.test(text), exclaim = /!\s*$/.test(text);
    const schedule = [];
    let t = t0;
    syl.forEach((s, i) => {
      const k = i / Math.max(1, syl.length - 1);
      let f = profile.f0 * (1.08 - 0.16 * k) * (1 + (hash(text + i) % 100) / 1400);
      if (question && k > 0.75) f *= 1 + (k - 0.75) * 1.4;
      if (exclaim && i === 0) f *= 1.12;
      const [F1, F2] = VOWELS[s.vowel] || VOWELS.a;
      const fm = profile.gender === 'f' ? 1.15 : 1;
      osc.frequency.setValueAtTime(f, t);
      f1.frequency.setValueAtTime(F1 * fm, t); f2.frequency.setValueAtTime(F2 * fm, t);
      const peak = 0.22 * (exclaim ? 1.2 : 1);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + Math.min(0.03, s.dur * 0.3));
      env.gain.setValueAtTime(peak * 0.85, t + s.dur * 0.7);
      env.gain.linearRampToValueAtTime(0.0001, t + s.dur);
      if (s.consonant && /[sztfckpx]/.test(s.consonant)) a.noise(0.05, { filter: 'highpass', freq: /[sz]/.test(s.consonant) ? 4200 : 2200, gain: 0.05, decay: 0.05, dest: out, when: t - c.currentTime });
      schedule.push([t, t + s.dur, { a: 1, o: 0.8, e: 0.6, u: 0.45, i: 0.4, y: 0.4 }[s.vowel] || 0.6]);
      t += s.dur + s.gap;
    });
    osc.start(t0); vib.start(t0); osc.stop(t + 0.1); vib.stop(t + 0.1);
    this.current = { mode: 'babble', character, schedule, end: t, nodes: [osc, vib] };
    return t - t0;
  }

  // Called every frame: moves the speaker's jaw.
  update() {
    const cur = this.current;
    if (!cur || !cur.character) return;
    let level = 0;
    if (cur.mode === 'speech') {
      if (cur.speaking) {
        const now = performance.now();
        const ph = (now - cur.started) / 1000 * 4.6 * cur.rate * Math.PI;
        const pulse = Math.max(0, 1 - (now - cur.pulse) / 220);
        level = 0.25 + 0.55 * Math.abs(Math.sin(ph)) * (0.6 + 0.4 * Math.sin(ph * 0.37 + 1)) + pulse * 0.3;
      }
    } else if (this.audio.ctx) {
      const now = this.audio.ctx.currentTime;
      for (const [a, b, open] of cur.schedule) if (now >= a && now <= b) { level = open * Math.sin(((now - a) / (b - a)) * Math.PI); break; }
    }
    cur.character.talk = Math.max(cur.character.talk || 0, Math.min(1, level));
  }
}
