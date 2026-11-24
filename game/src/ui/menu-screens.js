// Title screen with story briefing and cast, pause menu with stats, and the settings screen
// (graphics quality, volumes, mouse sensitivity, invert Y). Keyboard and mouse navigable.
import { CAST } from '../missions/story-cast.js';
import { STORY_ARC, MISSIONS } from '../missions/mission-scripts.js';
import { formatRupiah } from '../core/math-utils.js';

const $ = (id) => document.getElementById(id);

function buttons(container, items, onPick) {
  container.innerHTML = '';
  items.forEach((it, i) => {
    const b = document.createElement('button');
    b.innerHTML = `${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}`;
    b.disabled = !!it.disabled;
    b.addEventListener('click', () => onPick(it.id));
    b.addEventListener('mouseenter', () => { container.querySelectorAll('button').forEach((x) => x.classList.remove('focus')); b.classList.add('focus'); });
    if (i === 0) b.classList.add('focus');
    container.appendChild(b);
  });
}

export class MenuScreens {
  constructor(callbacks) {
    this.cb = callbacks;
    this.current = null;
    addEventListener('keydown', (e) => this.onKey(e));
  }

  onKey(e) {
    if (!this.current) return;
    const menu = this.current === 'title' ? $('title-menu') : this.current === 'pause' ? $('pause-menu') : null;
    if (e.code === 'Escape') {
      if (this.current === 'pause') { e.preventDefault(); this.cb.onResume(); }
      else if (this.current === 'settings') { e.preventDefault(); this.closeSettings(); }
      return;
    }
    if (!menu) return;
    const items = [...menu.querySelectorAll('button:not(:disabled)')];
    let i = items.findIndex((b) => b.classList.contains('focus'));
    if (e.code === 'ArrowDown' || e.code === 'KeyS') i = (i + 1) % items.length;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') i = (i - 1 + items.length) % items.length;
    else if (e.code === 'Enter' || e.code === 'Space') { items[Math.max(0, i)]?.click(); return; }
    else return;
    items.forEach((b) => b.classList.remove('focus'));
    items[i].classList.add('focus');
  }

  showTitle({ canContinue, saveLabel, completed = [] }) {
    this.current = 'title';
    $('title-screen').classList.remove('hidden');
    buttons($('title-menu'), [
      ...(canContinue ? [{ id: 'continue', label: 'CONTINUE', sub: saveLabel }] : []),
      { id: 'new', label: 'NEW STORY', sub: 'Chapter 1 — Homecoming' },
      { id: 'free', label: 'FREE ROAM', sub: 'Open city, no active mission' },
      { id: 'settings', label: 'SETTINGS' },
    ], (id) => {
      if (id === 'settings') this.openSettings('title');
      else this.cb.onStart(id);
    });
    $('title-briefing').innerHTML = `
      <h3>PELABUHAN SANGGARA · DUSK</h3>
      <h2>The harbour city that never sleeps</h2>
      <div>${STORY_ARC}</div>
      <div class="quote">"Bright lights, dark business." — Dimas</div>
      <ul class="chapters">${MISSIONS.map((m) => {
        const done = completed.includes(m.id);
        const next = !done && MISSIONS.find((x) => !completed.includes(x.id)) === m;
        return `<li class="${done ? 'done' : next ? 'next' : ''}"><b>${m.chapter}</b>${m.title}${done ? ' ✔' : next ? ' ◄' : ''}</li>`;
      }).join('')}</ul>
      <div class="cast">${['dimas', 'lastri', 'harun', 'rusdi'].map((k) => `<div><b>${CAST[k].full}</b>${CAST[k].role}</div>`).join('')}</div>
      <div style="margin-top:8px;font-size:12px;opacity:.75">${MISSIONS.length} story missions · street races · martabak deliveries · angkot fares · 12 golden shells · 9 vehicles · 4 radio stations · 6 districts</div>`;
  }

  hideTitle() { $('title-screen').classList.add('hidden'); this.current = null; }

  showPause(stats) {
    this.current = 'pause';
    $('pause-screen').classList.remove('hidden');
    buttons($('pause-menu'), [
      { id: 'resume', label: 'RESUME' },
      { id: 'save', label: 'SAVE GAME' },
      { id: 'load', label: 'LOAD GAME', disabled: !stats.hasSave },
      { id: 'map', label: 'CITY MAP' },
      { id: 'settings', label: 'SETTINGS' },
      { id: 'title', label: 'BACK TO TITLE' },
    ], (id) => {
      if (id === 'resume') this.cb.onResume();
      else if (id === 'settings') this.openSettings('pause');
      else this.cb.onPauseAction(id);
    });
    $('pause-stats').innerHTML = `
      <div>Rank <b>${stats.rank}</b></div>
      <div>Money <b>${formatRupiah(stats.money)}</b></div>
      <div>Story missions <b>${stats.missions} / ${MISSIONS.length}</b></div>
      <div>Cars stolen <b>${stats.carsStolen}</b></div>
      <div>Enemies down <b>${stats.kills}</b></div>
      <div>Highest wanted <b>${'★'.repeat(stats.maxWanted) || '—'}</b></div>
      <div>Races / deliveries <b>${stats.races} / ${stats.deliveries}</b></div>
      <div>Distance travelled <b>${(stats.distance / 1000).toFixed(1)} km</b></div>`;
  }

  hidePause() { $('pause-screen').classList.add('hidden'); if (this.current === 'pause') this.current = null; }

  openSettings(from) {
    this.settingsFrom = from;
    this.current = 'settings';
    $(from === 'title' ? 'title-screen' : 'pause-screen').classList.add('hidden');
    $('settings-screen').classList.remove('hidden');
    const s = this.cb.getSettings();
    $('settings-form').innerHTML = `
      <label>Graphics quality <select id="set-quality">${['low', 'medium', 'high'].map((q) => `<option ${q === s.quality ? 'selected' : ''}>${q}</option>`).join('')}</select></label>
      <label>Master volume <input id="set-master" type="range" min="0" max="1" step="0.05" value="${s.master}"></label>
      <label>Music / radio volume <input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}"></label>
      <label>Effects volume <input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}"></label>
      <label>Mouse sensitivity <input id="set-sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}"></label>
      <label>Invert Y axis <input id="set-invert" type="checkbox" ${s.invertY ? 'checked' : ''}></label>
      <button id="set-back">BACK</button>`;
    const read = () => ({
      quality: $('set-quality').value, master: +$('set-master').value, music: +$('set-music').value, sfx: +$('set-sfx').value,
      sensitivity: +$('set-sens').value, invertY: $('set-invert').checked,
    });
    $('settings-form').querySelectorAll('input,select').forEach((el) => el.addEventListener('change', () => this.cb.onSettings(read())));
    $('set-back').addEventListener('click', () => this.closeSettings());
  }

  closeSettings() {
    $('settings-screen').classList.add('hidden');
    if (this.settingsFrom === 'title') { $('title-screen').classList.remove('hidden'); this.current = 'title'; }
    else { $('pause-screen').classList.remove('hidden'); this.current = 'pause'; }
  }
}
