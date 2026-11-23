// Car radio with four stations of procedurally composed music, scheduled ahead on the WebAudio
// clock: dangdut with kendang and suling, lo-fi beats, keroncong plucks, and fast "funky kota".

const STATIONS = [
  { id: 'dangdut', name: 'Gelombang Dangdut 98.7', dj: 'DJ Mbak Yuyun', bpm: 128, scale: [0, 1, 4, 5, 7, 8, 10], root: 57,
    songs: ['Goyang Dermaga', 'Cinta di Ujung Pelabuhan', 'Kapal Tak Kembali', 'Senja Berdua'] },
  { id: 'lofi', name: 'Ombak Lo-Fi 101.3', dj: 'Kak Rendra', bpm: 78, scale: [0, 2, 3, 5, 7, 9, 10], root: 52,
    songs: ['Hujan di Kota Lama', 'Kopi Jam Dua', 'Lampu Jalan Oranye', 'Angin Laut'] },
  { id: 'keroncong', name: 'Keroncong Kota Lama 89.5', dj: 'Pak Sastro', bpm: 104, scale: [0, 2, 4, 5, 7, 9, 11], root: 55,
    songs: ['Bandar Tua', 'Rindu Pelabuhan', 'Sepeda Ontel', 'Bulan di Atas Menara'] },
  { id: 'funky', name: 'Pulse Sanggara 105.9', dj: 'MC Kilat', bpm: 150, scale: [0, 3, 5, 7, 10], root: 45,
    songs: ['Ngebut Sampai Pagi', 'Sirene Remix', 'Gas Pol Senja', 'Lampu Merah Lari'] },
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
    if (!a.ctx || !this.on || this.silent) return;
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
    const a = this.audio, m = a.music;
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
    } else if (st.id === 'funky') {
      if (s16 % 4 === 0) T(55, 0.2, { type: 'sine', gain: 0.5, slide: 0.4 });
      if (s16 % 4 === 2) T(this.note(st, chordRoot, -1), dur * 1.5, { type: 'sawtooth', gain: 0.09 });
      if (s16 % 2 === 1) N(0.04, { filter: 'highpass', freq: 8000, gain: 0.06 });
      if (s16 === 4 || s16 === 12) N(0.12, { filter: 'bandpass', freq: 2200, gain: 0.14 });
      if (this.r(step % 16) > 0.5) T(this.note(st, Math.floor(this.r(step % 8 + 5) * 6) + chordRoot, 1), dur * 0.9, { type: 'square', gain: 0.035 });
    }
  }
}
