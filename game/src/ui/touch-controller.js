// On-screen controller for touch screens, laid out like a handheld emulator's touch overlay
// (original artwork): analog stick and D-pad on the left, four shape-symbol face buttons in a
// diamond on the right, L/R shoulders in the top corners, Select/Start bottom centre, a contextual
// TALK button, and a camera drag zone on the right half. Multi-touch via pointer events: every
// finger is tracked on its own, so moving, looking and shooting work together. Buttons light up
// and grow while held and can buzz (navigator.vibrate). A layout editor drags, resizes, fades and
// hides each control; layouts persist in localStorage.
import { CONTROL_MAP } from '../core/control-router.js';

const STORE = 'pelabuhan-sanggara-touch-v2';
const DEFAULT = {
  stick: { x: 0.13, y: 0.74, s: 1, o: 1, v: true },
  dpad: { x: 0.1, y: 0.42, s: 1, o: 1, v: true },
  triangle: { x: 0.885, y: 0.55, s: 1, o: 1, v: true },
  square: { x: 0.815, y: 0.68, s: 1, o: 1, v: true },
  circle: { x: 0.955, y: 0.68, s: 1, o: 1, v: true },
  cross: { x: 0.885, y: 0.81, s: 1, o: 1, v: true },
  l: { x: 0.07, y: 0.09, s: 1, o: 1, v: true },
  r: { x: 0.93, y: 0.09, s: 1, o: 1, v: true },
  select: { x: 0.44, y: 0.94, s: 1, o: 1, v: true },
  start: { x: 0.56, y: 0.94, s: 1, o: 1, v: true },
  talk: { x: 0.74, y: 0.47, s: 1, o: 1, v: true },
};
const NAMES = { stick: 'Analog stick', dpad: 'D-pad', triangle: 'Triangle', square: 'Square', circle: 'Circle', cross: 'Cross', l: 'L shoulder', r: 'R shoulder', select: 'Select', start: 'Start', talk: 'Talk' };

function loadLayout() {
  const base = { global: 0.65, vibrate: true, controls: structuredClone(DEFAULT) };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (raw) { base.global = raw.global ?? base.global; base.vibrate = raw.vibrate ?? true; for (const k of Object.keys(DEFAULT)) Object.assign(base.controls[k], raw.controls?.[k] || {}); }
  } catch { /* defaults */ }
  return base;
}

export class TouchController {
  constructor(input, router) {
    this.input = input;
    this.router = router;
    this.layout = loadLayout();
    this.mode = 'auto';
    this.active = false;
    this.editing = false;
    this.pointers = new Map();
    this.talkAvailable = false;
    this.lastContext = null;
    this.root = document.createElement('div');
    this.root.id = 'touch-ui';
    this.root.className = 'hidden';
    this.look = document.createElement('div');
    this.look.className = 'touch-look';
    this.root.appendChild(this.look);
    this.els = {};
    for (const id of Object.keys(DEFAULT)) this.root.appendChild(this.makeControl(id));
    document.body.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) this.root.addEventListener(t, (e) => this.onUp(e));
    addEventListener('resize', () => this.applyLayout());
    this.applyLayout();
  }

  makeControl(id) {
    const el = document.createElement('div');
    el.className = `tc tc-${id}`;
    el.dataset.ctl = id;
    if (id === 'stick') el.innerHTML = '<div class="tc-knob"></div>';
    else if (id === 'dpad') el.innerHTML = ['up', 'down', 'left', 'right'].map((d) => `<div class="tc-dir tc-${d}" data-dir="${d}">${CONTROL_MAP[d].symbol}</div>`).join('');
    else el.innerHTML = `<span class="tc-sym">${CONTROL_MAP[id].symbol}</span><span class="tc-cap"></span>`;
    this.els[id] = el;
    return el;
  }

  // Touch UI shows on touch devices / small screens ('auto'), always ('on') or never ('off').
  wanted() {
    if (this.mode === 'on') return true;
    if (this.mode === 'off') return false;
    return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || innerWidth < 820;
  }

  setMode(mode) { this.mode = mode || 'auto'; this.refreshVisible(); }
  setActive(on) { if (this.active === on) return; this.active = on; if (!on) this.releaseAll(); this.refreshVisible(); }
  refreshVisible() {
    const show = this.editing || (this.active && this.wanted());
    this.root.classList.toggle('hidden', !show);
    document.body.classList.toggle('touch-mode', show);
  }
  get visible() { return !this.root.classList.contains('hidden'); }

  save() { try { localStorage.setItem(STORE, JSON.stringify(this.layout)); } catch { /* storage unavailable */ } }

  applyLayout() {
    const unit = Math.max(44, Math.min(84, Math.min(innerWidth, innerHeight) * 0.115));
    this.root.style.setProperty('--u', `${unit}px`);
    document.body.style.setProperty('--touch-u', `${unit}px`);
    this.root.style.setProperty('--global', this.layout.global);
    for (const [id, c] of Object.entries(this.layout.controls)) {
      const el = this.els[id];
      el.style.left = `${c.x * 100}%`;
      el.style.top = `${c.y * 100}%`;
      el.style.setProperty('--s', c.s);
      el.style.setProperty('--o', c.o);
      el.classList.toggle('tc-off', !c.v);
    }
    this.updateCaptions(true);
  }

  // Captions follow the context: the same button accelerates in a car and sprints on foot.
  updateCaptions(force = false) {
    const ctx = this.input.context;
    if (!force && ctx === this.lastContext) return;
    this.lastContext = ctx;
    for (const id of ['triangle', 'square', 'circle', 'cross', 'l', 'r', 'select', 'start']) {
      const cap = this.els[id].querySelector('.tc-cap');
      if (cap) cap.textContent = CONTROL_MAP[id][ctx === 'vehicle' ? 'vehicle' : 'foot'][1].replace(/ \(.*\)/, '').split(' / ')[0];
    }
  }

  setTalkAvailable(on) {
    if (on === this.talkAvailable) return;
    this.talkAvailable = on;
    this.els.talk.classList.toggle('tc-hide', !on);
  }

  // The contextual button says what it will do: TALK, ENTER, EXIT, SIT, STAND, USE.
  setTalkLabel(text) {
    if (text === this.talkLabel) return;
    this.talkLabel = text;
    const sym = this.els.talk?.querySelector('.tc-sym');
    if (sym) sym.textContent = text;
  }

  update() {
    if (!this.visible) return;
    this.updateCaptions();
    if (!this.editing) this.els.talk.classList.toggle('tc-hide', !this.talkAvailable);
  }

  buzz() { if (this.layout.vibrate && navigator.vibrate) try { navigator.vibrate(12); } catch { /* blocked */ } }

  // ------------------------------------------------------------------ pointers
  onDown(e) {
    const target = e.target.closest('[data-ctl], .touch-look');
    if (!target) return;
    e.preventDefault();
    try { this.root.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    if (this.editing) return this.editDown(e, target);
    const id = target.dataset?.ctl;
    if (!id) { this.pointers.set(e.pointerId, { kind: 'look', x: e.clientX, y: e.clientY }); return; }
    if (id === 'stick') {
      const r = target.getBoundingClientRect();
      this.pointers.set(e.pointerId, { kind: 'stick', cx: r.left + r.width / 2, cy: r.top + r.height / 2, rad: r.width * 0.42 });
      this.target = target;
      this.onMove(e);
      return;
    }
    let ctl = id, el = target;
    if (id === 'dpad') {
      const dir = e.target.closest('[data-dir]');
      if (!dir) { const r = target.getBoundingClientRect(); const dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; ctl = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
      else ctl = dir.dataset.dir;
      el = target.querySelector(`.tc-${ctl}`);
    }
    this.pointers.set(e.pointerId, { kind: 'btn', ctl, el });
    el.classList.add('tc-on');
    this.buzz();
    this.router.press('touch', ctl);
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    if (this.editing) return this.editMove(e, p);
    if (p.kind === 'look') {
      this.input.look((e.clientX - p.x) * 1.6, (e.clientY - p.y) * 1.6);
      p.x = e.clientX; p.y = e.clientY;
    } else if (p.kind === 'stick') {
      let dx = (e.clientX - p.cx) / p.rad, dy = (e.clientY - p.cy) / p.rad;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.els.stick.querySelector('.tc-knob').style.transform = `translate(${dx * 50}%, ${dy * 50}%)`;
      this.els.stick.classList.add('tc-on');
      const mag = Math.min(1, len), dead = mag < 0.12 ? 0 : 1;
      this.input.setAnalog('touch', { x: dx * dead, y: -dy * dead, throttle: 0 });
    }
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.editing) return this.editUp(e, p);
    if (p.kind === 'stick') {
      this.els.stick.querySelector('.tc-knob').style.transform = '';
      this.els.stick.classList.remove('tc-on');
      this.input.setAnalog('touch', { x: 0, y: 0, throttle: 0 });
    } else if (p.kind === 'btn') {
      p.el.classList.remove('tc-on');
      this.router.release('touch', p.ctl);
    }
  }

  releaseAll() {
    for (const [id, p] of this.pointers) this.onUp({ pointerId: id, ...p });
    this.pointers.clear();
    this.router.releaseAll('touch');
    this.input.setAnalog('touch', { x: 0, y: 0, throttle: 0 });
    for (const el of this.root.querySelectorAll('.tc-on')) el.classList.remove('tc-on');
    this.els.stick.querySelector('.tc-knob').style.transform = '';
  }

  // ------------------------------------------------------------------ layout editor
  openEditor(onClose) {
    this.releaseAll();
    this.editing = true;
    this.onEditorClose = onClose;
    this.root.classList.add('editing');
    this.els.talk.classList.remove('tc-hide');
    this.refreshVisible();
    const bar = document.createElement('div');
    bar.className = 'tc-editor';
    bar.innerHTML = `
      <div class="tc-ed-title">TOUCH CONTROLS LAYOUT <small>drag to move · pinch or slider to resize · tap to select</small></div>
      <label>All controls opacity <input type="range" id="tce-global" min="0.15" max="1" step="0.05" value="${this.layout.global}"></label>
      <label>Vibrate on press <input type="checkbox" id="tce-vib" ${this.layout.vibrate ? 'checked' : ''}></label>
      <div class="tc-ed-sel"><b id="tce-name">Select a control</b>
        <label>Size <input type="range" id="tce-size" min="0.5" max="2" step="0.05" value="1" disabled></label>
        <label>Opacity <input type="range" id="tce-op" min="0.2" max="1" step="0.05" value="1" disabled></label>
        <label>Show <input type="checkbox" id="tce-vis" checked disabled></label></div>
      <button id="tce-reset">RESET TO DEFAULT</button><button id="tce-done">DONE</button>`;
    this.root.appendChild(bar);
    this.editorBar = bar;
    const q = (id) => bar.querySelector('#' + id);
    q('tce-global').addEventListener('input', (e) => { this.layout.global = +e.target.value; this.applyLayout(); });
    q('tce-vib').addEventListener('change', (e) => { this.layout.vibrate = e.target.checked; });
    q('tce-size').addEventListener('input', (e) => { if (this.selected) { this.layout.controls[this.selected].s = +e.target.value; this.applyLayout(); } });
    q('tce-op').addEventListener('input', (e) => { if (this.selected) { this.layout.controls[this.selected].o = +e.target.value; this.applyLayout(); } });
    q('tce-vis').addEventListener('change', (e) => { if (this.selected) { this.layout.controls[this.selected].v = e.target.checked; this.applyLayout(); } });
    q('tce-reset').addEventListener('click', () => { this.layout.controls = structuredClone(DEFAULT); this.layout.global = 0.65; q('tce-global').value = 0.65; this.applyLayout(); this.select(this.selected); });
    q('tce-done').addEventListener('click', () => this.closeEditor());
    for (const el of bar.querySelectorAll('input,button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  closeEditor() {
    this.save();
    this.editing = false;
    this.root.classList.remove('editing');
    this.editorBar?.remove();
    this.select(null);
    this.pointers.clear();
    this.refreshVisible();
    this.onEditorClose?.();
  }

  select(id) {
    this.selected = id;
    for (const el of Object.values(this.els)) el.classList.remove('tc-sel');
    const bar = this.editorBar;
    if (!bar) return;
    const c = id && this.layout.controls[id];
    bar.querySelector('#tce-name').textContent = id ? NAMES[id] : 'Select a control';
    for (const k of ['tce-size', 'tce-op', 'tce-vis']) bar.querySelector('#' + k).disabled = !id;
    if (!id) return;
    this.els[id].classList.add('tc-sel');
    bar.querySelector('#tce-size').value = c.s;
    bar.querySelector('#tce-op').value = c.o;
    bar.querySelector('#tce-vis').checked = c.v;
  }

  editDown(e, target) {
    const id = target.dataset?.ctl;
    if (!id) return;
    const drags = [...this.pointers.values()].filter((p) => p.kind === 'drag' && p.id === id);
    if (drags.length === 1) {
      // Second finger on the same control: pinch to resize.
      const a = drags[0];
      this.pointers.set(e.pointerId, { kind: 'pinch', id, other: a, x: e.clientX, y: e.clientY, d0: Math.hypot(e.clientX - a.x, e.clientY - a.y), s0: this.layout.controls[id].s });
      return;
    }
    this.select(id);
    this.pointers.set(e.pointerId, { kind: 'drag', id, x: e.clientX, y: e.clientY });
  }

  editMove(e, p) {
    const c = this.layout.controls[p.id];
    if (p.kind === 'drag') {
      c.x = Math.max(0.03, Math.min(0.97, c.x + (e.clientX - p.x) / innerWidth));
      c.y = Math.max(0.04, Math.min(0.96, c.y + (e.clientY - p.y) / innerHeight));
      p.x = e.clientX; p.y = e.clientY;
    } else if (p.kind === 'pinch') {
      p.x = e.clientX; p.y = e.clientY;
      const d = Math.hypot(p.x - p.other.x, p.y - p.other.y);
      c.s = Math.max(0.5, Math.min(2, p.s0 * d / Math.max(10, p.d0)));
      if (this.editorBar) this.editorBar.querySelector('#tce-size').value = c.s;
    }
    this.applyLayout();
  }

  editUp() { /* nothing to release in the editor */ }
}
