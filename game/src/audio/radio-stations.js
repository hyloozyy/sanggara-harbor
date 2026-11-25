// Car radio with six stations of procedurally composed music, scheduled ahead on the WebAudio
// clock: dangdut with kendang and suling, lo-fi beats, keroncong plucks, fast "funky kota",
// neon synthwave, and a news-talk station whose presenters babble the city's headlines.
import { VoiceDirector, voiceProfile } from './voice-actor.js';

const HEADLINES = [
  'Good evening Sanggara, this is the evening news on Suara Kota.',
  'Police report another street race on the Pantai Senja boulevard last night.',
  'The fish market opens early tomorrow after a record catch.',
  'Commissioner Wulan promises more patrols in Kota Lama.',
  'Traffic is slow on Jalan Raya Sanggara near the station.',
  'Weather: a warm golden evening, with tropical showers possible later.',
  'A container ship arrives at the harbour on the morning tide.',
  'Residents of Bukit Hijau complain about noise from a private party.',
  'And now, a word from our sponsor, Martabak Bulan. Hot, sweet, and delivered fast!',
  'Callers tonight are talking about rising rents in Pusat Niaga.',
];

const STATIONS = [
  { id: 'dangdut', name: 'Gelombang Dangdut 98.7', dj: 'DJ Yuyun', bpm: 128, scale: [0, 1, 4, 5, 7, 8, 10], root: 57,
    songs: ['Dockside Sway', 'Love at the End of the Pier', 'The Ship That Never Came Back', 'Dusk for Two'] },
  { id: 'lofi', name: 'Ombak Lo-Fi 101.3', dj: 'Kak Rendra', bpm: 78, scale: [0, 2, 3, 5, 7, 9, 10], root: 52,
    songs: ['Rain in Kota Lama', 'Two AM Coffee', 'Orange Street Lamps', 'Sea Breeze'] },
  { id: 'keroncong', name: 'Keroncong Kota Lama 89.5', dj: 'Pak Sastro', bpm: 104, scale: [0, 2, 4, 5, 7, 9, 11], root: 55,
    songs: ['Old Port', 'Missing the Harbour', 'Vintage Bicycle', 'Moon over the Tower'] },
  { id: 'funky', name: 'Pulse Sanggara 105.9', dj: 'MC Kilat', bpm: 150, scale: [0, 3, 5, 7, 10], root: 45,
    songs: ['Speeding till Dawn', 'Siren Remix', 'Full Throttle Dusk', 'Running Red Lights'] },
  { id: 'synthwave', name: 'Neon Teluk 92.1', dj: 'Nova', bpm: 100, scale: [0, 2, 3, 5, 7, 8, 10], root: 45,
    songs: ['Harbour Lights 1986', 'Chrome Sunset', 'Night Drive to Bukit Hijau', 'Palms in the Rear-view'] },
  { id: 'news', name: 'Suara Kota Talk 88.0', dj: 'Bang Herman & Mbak Sinta', bpm: 60, scale: [0, 4, 7], root: 60,
    songs: ['Evening News', 'Call-in Hour', 'Traffic and Weather', 'City Talk'] },
];

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.index = 0;
    this.on = false;
    this.step = 0;
    this.nextTime = 0;
    this.songTime = 0;
    this.songIndex = 0;
    this.seed = 1;
    this.talk = new VoiceDirector(audio);
    this.talk.useSpeech = false;
    this.talkNext = 0;
    this.hosts = [voiceProfile('m', 'adult', 'herman', { radio: true, f0: 108, rate: 1.05 }), voiceProfile('f', 'adult', 'sinta', { radio: true, f0: 205, rate: 1.1 })];
  }

  get stations() { return STATIONS; }
  get station() { return STATIONS[this.index]; }
  get songTitle() { return this.station.songs[this.songIndex % this.station.songs.length]; }

  setOn(on) {
    if (on === this.on) return;
    this.on = on;
    if (on && this.audio.ctx) this.nextTime = this.audio.now + 0.1;
  }

  next() {
    this.index = (this.index + 1) % (STATIONS.length + 1);
    if (this.index === STATIONS.length) { this.on = false; return null; }
    this.on = true;
    this.songIndex = Math.floor(Math.random() * 4);
    this.seed = Math.floor(Math.random() * 1000);
    this.step = 0;
    if (this.audio.ctx) { this.nextTime = this.audio.now + 0.05; this.audio.noise(0.25, { filter: 'bandpass', freq: 3000, q: 0.5, gain: 0.12, dest: this.audio.music }); }
    return this.station;
  }

  get silent() { return this.index === STATIONS.length; }

  update(dt) {
    const a = this.audio;
    if (!a.ctx || !this.on || this.silent) { if (this.talk.current) this.talk.stop(); return; }
    if (this.station.id === 'news') {
      this.talk.dest = this.dest || a.music;
      if (a.now > this.talkNext) {
        const line = HEADLINES[Math.floor(Math.random() * HEADLINES.length)];
        const host = this.hosts[Math.floor(Math.random() * 2)];
        this.talkNext = a.now + this.talk.speak(line, host) + 0.6 + Math.random();
      }
      this.songTime += dt;
      return;
    }
    if (this.talk.current) this.talk.stop();
    this.songTime += dt;
    if (this.songTime > 75) { this.songTime = 0; this.songIndex++; this.seed++; }
    const st = this.station;
    const stepDur = 60 / st.bpm / 4;
    if (this.nextTime < a.now) this.nextTime = a.now + 0.05;
    while (this.nextTime < a.now + 0.25) {
      this.playStep(st, this.step, this.nextTime - a.now, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  // Deterministic pseudo-random per song + step so phrases repeat musically.
  r(n) { const x = Math.sin((this.seed * 131 + n) * 12.9898) * 43758.5453; return x - Math.floor(x); }

  note(st, degree, octave = 0) {
    const s = st.scale;
    const o = Math.floor(degree / s.length);
    return midi(st.root + s[((degree % s.length) + s.length) % s.length] + 12 * (o + octave));
  }

  playStep(st, step, when, dur) {
    const a = this.audio, m = this.dest || a.music;
    const s16 = step % 16, bar = Math.floor(step / 16) % 4;
    const chordRoot = [0, 3, 4, 2][bar];
    const T = (f, d, o) => a.tone(f, d, { dest: m, when, ...o });
    const N = (d, o) => a.noise(d, { dest: m, when, ...o });
    if (st.id === 'dangdut') {
      if (s16 === 0 || s16 === 10) T(110, 0.25, { type: 'sine', gain: 0.35, slide: 0.55 });          // "dut"
      if (s16 === 4 || s16 === 12 || s16 === 7) T(420, 0.08, { type: 'triangle', gain: 0.18, slide: 0.8 }); // "tak"
      if (s16 % 2 === 1) N(0.03, { filter: 'highpass', freq: 7000, gain: 0.05 });
      if (s16 % 4 === 0) T(this.note(st, chordRoot, -1), dur * 3, { type: 'triangle', gain: 0.16 });
      if (this.r(step % 64) > 0.45 && s16 % 2 === 0) T(this.note(st, Math.floor(this.r(step % 32 + 7) * 9) + chordRoot, 1), dur * 2.5, { type: 'sine', gain: 0.07, attack: 0.03 });
    } else if (st.id === 'lofi') {
      if (s16 === 0 || s16 === 9) T(60, 0.3, { type: 'sine', gain: 0.4, slide: 0.5 });
      if (s16 === 4 || s16 === 12) N(0.16, { filter: 'bandpass', freq: 1800, gain: 0.12 });
      if (s16 % 2 === 0) N(0.04, { filter: 'highpass', freq: 6000, gain: 0.03 });
      if (s16 === 0) for (const k of [0, 2, 4, 6]) T(this.note(st, chordRoot + k), dur * 14, { type: 'triangle', gain: 0.045, attack: 0.06 });
      if (s16 === 0 || s16 === 8) T(this.note(st, chordRoot, -1), dur * 7, { type: 'sine', gain: 0.18 });
      if (this.r(step % 32) > 0.7) T(this.note(st, Math.floor(this.r(step % 16 + 3) * 7) + 7), dur * 3, { type: 'sine', gain: 0.04 });
      if (Math.random() < 0.08) N(0.01, { filter: 'highpass', freq: 4000, gain: 0.03 }); // vinyl crackle
    } else if (st.id === 'keroncong') {
      if (s16 % 4 === 2) for (const k of [0, 2, 4]) T(this.note(st, chordRoot + k, 1), 0.12, { type: 'triangle', gain: 0.06, when: when + k * 0.012 }); // cak
      if (s16 % 4 === 3 || s16 % 4 === 1) T(this.note(st, chordRoot + 4, 1), 0.08, { type: 'triangle', gain: 0.04 }); // cuk
      if (s16 % 8 === 0 || s16 % 8 === 5) T(this.note(st, chordRoot, -1), 0.4, { type: 'triangle', gain: 0.2 });      // cello pizz
      if (s16 % 4 === 0) T(this.note(st, Math.floor(this.r(step % 48) * 8) + chordRoot, 1), dur * 4, { type: 'sine', gain: 0.06, attack: 0.05 });
    } else if (st.id === 'synthwave') {
      if (s16 % 4 === 0) T(50, 0.28, { type: 'sine', gain: 0.5, slide: 0.35 });                                   // kick
      if (s16 === 4 || s16 === 12) { N(0.35, { filter: 'bandpass', freq: 1700, gain: 0.16, decay: 0.35 }); N(0.9, { filter: 'bandpass', freq: 1200, gain: 0.04, attack: 0.05, decay: 0.9, when: when + 0.05 }); } // gated snare
      if (s16 % 2 === 0) T(this.note(st, chordRoot, -2) * (s16 % 4 === 2 ? 2 : 1), dur * 1.8, { type: 'sawtooth', gain: 0.08 });  // octave bass
      if (s16 === 0) for (const k of [0, 2, 4]) { T(this.note(st, chordRoot + k), dur * 15, { type: 'sawtooth', gain: 0.025, attack: 0.25 }); T(this.note(st, chordRoot + k) * 1.005, dur * 15, { type: 'sawtooth', gain: 0.02, attack: 0.25 }); } // pad
      if (s16 % 2 === 1) N(0.03, { filter: 'highpass', freq: 9000, gain: 0.035 });
      if (bar % 2 === 1 && s16 % 3 === 0) T(this.note(st, Math.floor(this.r(step % 24 + 11) * 7) + chordRoot, 1), dur * 2.5, { type: 'square', gain: 0.03, attack: 0.02 }); // lead
    } else if (st.id === 'funky') {
      if (s16 % 4 === 0) T(55, 0.2, { type: 'sine', gain: 0.5, slide: 0.4 });
      if (s16 % 4 === 2) T(this.note(st, chordRoot, -1), dur * 1.5, { type: 'sawtooth', gain: 0.09 });
      if (s16 % 2 === 1) N(0.04, { filter: 'highpass', freq: 8000, gain: 0.06 });
      if (s16 === 4 || s16 === 12) N(0.12, { filter: 'bandpass', freq: 2200, gain: 0.14 });
      if (this.r(step % 16) > 0.5) T(this.note(st, Math.floor(this.r(step % 8 + 5) * 6) + chordRoot, 1), dur * 0.9, { type: 'square', gain: 0.035 });
    }
  }
}
