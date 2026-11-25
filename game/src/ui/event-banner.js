// Cinematic event banners: WASTED / BUSTED (greyscale and slow motion, set by the session),
// MISSION PASSED / FAILED, mission title cards, activity results, the wanted level going up and a
// new district. Each banner is plain DOM + CSS animation (zoom/blur-in, letter-spacing settle,
// light sweep, band behind the words), so it costs nothing while hidden. The colour grade of the
// 3D view is a CSS filter class on <body> (works with and without the post-processing chain).
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const BIG = {
  wasted: { word: 'WASTED', sub: 'TERBUNUH', grade: 'grade-wasted' },
  busted: { word: 'BUSTED', sub: 'DITANGKAP', grade: 'grade-busted' },
  passed: { word: 'MISSION PASSED', sub: 'MISI BERHASIL', grade: 'grade-passed' },
  failed: { word: 'MISSION FAILED', sub: 'MISI GAGAL', grade: 'grade-failed' },
};

export class EventBanner {
  constructor(root = document.getElementById('hud')) {
    this.big = document.createElement('div');
    this.big.id = 'event-banner';
    this.big.className = 'hidden';
    this.small = document.createElement('div');
    this.small.id = 'event-strip';
    this.small.className = 'hidden';
    this.black = document.createElement('div');
    this.black.id = 'event-blackout';
    root.append(this.big, this.small, this.black);
    this.bigT = 0; this.smallT = 0; this.grade = null; this.gradeT = 0;
    this.kind = null;
  }

  setGrade(cls, seconds = 0) {
    if (this.grade && this.grade !== cls) document.body.classList.remove(this.grade);
    this.grade = cls;
    this.gradeT = seconds;
    if (cls) document.body.classList.add(cls);
  }

  // kind: wasted | busted | passed | failed | title | activity-ok | activity-bad
  show(kind, { title, sub, detail, chapter, seconds = 4.5, grade = true } = {}) {
    const def = BIG[kind];
    const word = title || def?.word || '';
    const lines = [];
    if (chapter) lines.push(`<div class="eb-chapter">${esc(chapter)}</div>`);
    lines.push(`<div class="eb-word" data-text="${esc(word)}">${esc(word)}</div>`);
    if (sub ?? def?.sub) lines.push(`<div class="eb-sub">${esc(sub ?? def.sub)}</div>`);
    if (detail) lines.push(`<div class="eb-detail">${detail}</div>`);
    this.big.className = `eb-${kind}`;
    this.big.innerHTML = `<div class="eb-inner"><div class="eb-band"></div>${lines.join('')}</div>`;
    // Restart the CSS animations.
    void this.big.offsetWidth;
    this.big.classList.add('eb-in');
    this.kind = kind;
    this.bigT = seconds;
    // A big banner takes the stage: any small strip (wanted, district) steps aside.
    if (this.smallT > 0) { this.smallT = 0; this.small.className = 'hidden'; }
    if (grade && def?.grade) this.setGrade(def.grade, kind === 'wasted' || kind === 'busted' ? 0 : Math.min(seconds, 2.6));
  }

  hideBig() {
    if (!this.kind) return;
    this.big.classList.add('eb-out');
    this.kind = null;
    clearTimeout(this.outT);
    this.outT = setTimeout(() => { if (!this.kind) this.big.className = 'hidden'; }, 450);
  }

  wantedUp(level, reason) {
    if (this.kind) return;
    const stars = Array.from({ length: 5 }, (_, i) => `<span class="${i < level ? 'on' : ''}" style="animation-delay:${0.12 + i * 0.07}s">★</span>`).join('');
    this.small.className = 'es-wanted';
    this.small.innerHTML = `<div class="es-word">WANTED</div><div class="es-stars">${stars}</div><div class="es-sub">${esc(reason || 'The police want you')}</div>`;
    void this.small.offsetWidth;
    this.small.classList.add('es-in');
    this.smallT = 2.8;
  }

  district(name, sub) {
    if (this.kind) return;
    this.small.className = 'es-district';
    this.small.innerHTML = `<div class="es-kicker">${esc(sub || 'PELABUHAN SANGGARA')}</div><div class="es-word">${esc(name)}</div><div class="es-line"></div>`;
    void this.small.offsetWidth;
    this.small.classList.add('es-in');
    this.smallT = 3.4;
  }

  // Fade the screen to black (0..1), e.g. just before a respawn.
  blackout(a) { const v = a.toFixed(2); if (this.black.dataset.a !== v) { this.black.dataset.a = v; this.black.style.opacity = v; } }

  update(dt) {
    if (this.bigT > 0) { this.bigT -= dt; if (this.bigT <= 0) this.hideBig(); }
    if (this.smallT > 0) {
      this.smallT -= dt;
      if (this.smallT <= 0) { this.small.classList.add('es-out'); setTimeout(() => { if (this.smallT <= 0) this.small.className = 'hidden'; }, 500); }
    }
    if (this.gradeT > 0) { this.gradeT -= dt; if (this.gradeT <= 0) this.setGrade(null); }
  }
}
