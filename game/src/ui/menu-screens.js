// Title screen with story briefing and cast, pause menu with stats, and the settings screen
// (graphics quality, volumes, mouse sensitivity, invert Y). Keyboard and mouse navigable.
import { WEATHER_STATES } from '../world/weather-system.js';
import { CAST } from '../missions/story-cast.js';
import { STORY_ARC, MISSIONS } from '../missions/mission-scripts.js';
import { formatMoney } from '../core/math-utils.js';
import { ENTERABLE, enterableDistrict, enterableLegendIcon } from '../interiors/enterable-places.js';
import { CONTROL_MAP, KEYBOARD_HELP, PAD_SHOULDERS } from '../core/control-router.js';

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
      else if (this.current === 'help') { e.preventDefault(); this.closeHelp(); }
      return;
    }
    if (this.current === 'settings') { this.settingsKey(e); return; }
    if (this.current === 'help' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.closeHelp(); return; }
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
      { id: 'help', label: 'CONTROLS', sub: 'Keyboard & mouse · touch · gamepad' },
    ], (id) => {
      if (id === 'settings') this.openSettings('title');
      else if (id === 'help') this.openHelp('title');
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
      <div style="margin-top:8px;font-size:12px;opacity:.75">${MISSIONS.length} story missions · street races · martabak deliveries · angkot fares · 12 golden shells · 16 vehicles · 6 radio stations · 6 districts</div>`;
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
      { id: 'help', label: 'CONTROLS' },
      { id: 'title', label: 'BACK TO TITLE' },
    ], (id) => {
      if (id === 'resume') this.cb.onResume();
      else if (id === 'help') this.openHelp('pause');
      else if (id === 'settings') this.openSettings('pause');
      else this.cb.onPauseAction(id);
    });
    $('pause-stats').innerHTML = `
      <div>Rank <b>${stats.rank}</b></div>
      <div>Money <b>${formatMoney(stats.money)}</b></div>
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
      <label>Voice volume <input id="set-voice" type="range" min="0" max="1" step="0.05" value="${s.voice}"></label>
      <label>Touch controls <select id="set-touch">${[['auto', 'Auto (touch screens)'], ['on', 'Always on'], ['off', 'Off']].map(([k, l]) => `<option value="${k}" ${k === s.touch ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button id="set-layout" style="width:auto">TOUCH CONTROLS LAYOUT…</button>
      <label>Mouse sensitivity <input id="set-sens" type="range" min="0.3" max="2.5" step="0.1" value="${s.sensitivity}"></label>
      <label>Invert Y axis <input id="set-invert" type="checkbox" ${s.invertY ? 'checked' : ''}></label>
      <label>Weather <select id="set-weather">${[['auto', 'Changing (auto)'], ...Object.entries(WEATHER_STATES).map(([k, v]) => [k, v.label])].map(([k, l]) => `<option value="${k}" ${k === s.weather ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label>Time of day <select id="set-time">${[['cycle', 'Day/night cycle'], ['golden', 'Golden hour'], ['dawn', 'Dawn'], ['noon', 'Noon'], ['sunset', 'Sunset'], ['night', 'Night']].map(([k, l]) => `<option value="${k}" ${k === s.timeMode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <button id="set-back">BACK</button>`;
    const read = () => ({
      quality: $('set-quality').value, master: +$('set-master').value, music: +$('set-music').value, sfx: +$('set-sfx').value, voice: +$('set-voice').value, touch: $('set-touch').value,
      sensitivity: +$('set-sens').value, invertY: $('set-invert').checked, weather: $('set-weather').value, timeMode: $('set-time').value,
    });
    $('settings-form').querySelectorAll('input,select').forEach((el) => el.addEventListener('change', () => this.cb.onSettings(read())));
    $('set-back').addEventListener('click', () => this.closeSettings());
    $('set-layout').addEventListener('click', () => {
      $('settings-screen').classList.add('hidden');
      this.current = 'layout';
      this.cb.onEditLayout(() => { $('settings-screen').classList.remove('hidden'); this.current = 'settings'; });
    });
  }

  // Keyboard / gamepad navigation of the settings form: up/down picks a row, left/right changes
  // the value (slider step, next option, checkbox), Enter/Cross toggles or presses buttons.
  settingsKey(e) {
    const rows = [...$('settings-form').children];
    if (!rows.length) return;
    let i = rows.findIndex((r) => r.classList.contains('focus'));
    const ctl = (r) => (r.tagName === 'BUTTON' ? r : r.querySelector('input,select'));
    const fire = (el) => el.dispatchEvent(new Event('change'));
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyS') {
      const d = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1;
      i = i < 0 ? 0 : (i + d + rows.length) % rows.length;
      rows.forEach((r) => r.classList.remove('focus'));
      rows[i].classList.add('focus');
      rows[i].scrollIntoView?.({ block: 'nearest' });
      e.preventDefault();
      return;
    }
    if (i < 0) return;
    const el = ctl(rows[i]);
    if (!el) return;
    const dir = e.code === 'ArrowRight' || e.code === 'KeyD' ? 1 : e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 0;
    if (dir) {
      e.preventDefault();
      if (el.type === 'range') {
        const step = +el.step || 0.1;
        el.value = String(Math.min(+el.max, Math.max(+el.min, +el.value + dir * step)));
        fire(el);
      } else if (el.tagName === 'SELECT') {
        el.selectedIndex = (el.selectedIndex + dir + el.options.length) % el.options.length;
        fire(el);
      } else if (el.type === 'checkbox') { el.checked = !el.checked; fire(el); }
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (el.tagName === 'BUTTON') el.click();
      else if (el.type === 'checkbox') { el.checked = !el.checked; fire(el); }
      else if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; fire(el); }
    }
  }

  // Keyboard & mouse, touch and gamepad side by side, on foot and in a vehicle.
  openHelp(from) {
    this.helpFrom = from;
    this.current = 'help';
    $(from === 'title' ? 'title-screen' : 'pause-screen').classList.add('hidden');
    $('help-screen').classList.remove('hidden');
    const rows = (list) => `<table>${list.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    const ids = ['cross', 'circle', 'square', 'triangle', 'l', 'r', 'up', 'down', 'left', 'right', 'select', 'start'];
    const touch = (ctx) => rows([['Left stick', ctx === 'foot' ? 'Move' : 'Steer'], ['Right side drag', 'Look around'], ...ids.map((id) => [CONTROL_MAP[id].symbol, CONTROL_MAP[id][ctx][1]]), ...(ctx === 'foot' ? [['TALK', 'Appears next to people you can talk to']] : [])]);
    const padName = { cross: 'A / ✕', circle: 'B / ○', square: 'X / □', triangle: 'Y / △', l: 'LT', r: 'RT', up: 'D-pad ▲', down: 'D-pad ▼', left: 'D-pad ◀', right: 'D-pad ▶', select: 'Back / View', start: 'Start / Menu' };
    const pad = (ctx) => rows([['Left stick', ctx === 'foot' ? 'Move' : 'Steer'], ['Right stick', 'Look'], ['L3 (press stick)', 'Talk'],
      ...(ctx === 'vehicle' ? [['RT / LT', 'Gas / brake (analog)']] : []),
      ...ids.filter((id) => ctx === 'foot' || (id !== 'l' && id !== 'r')).map((id) => [padName[id], CONTROL_MAP[id][ctx][1]]),
      ['LB', PAD_SHOULDERS[ctx][4][1]], ['RB', PAD_SHOULDERS[ctx][5][1]]]);
    const places = ENTERABLE.map((e) => `<span class="help-place"><b style="color:${e.color}">${e.glyph} · ${e.label}</b> ${e.kind.toLowerCase()} in ${enterableDistrict(e)} — ${e.what}</span>`).join('');
    $('help-body').innerHTML = `<div class="help-pin"><img src="${enterableLegendIcon()}" alt=""><div><h3>📌 PLACES YOU CAN ENTER · MASUK</h3>
      ${places}
      <p>Find them by the <b>house icons</b> on the minimap (they wait on the rim when far away) and the city map (M), the <b>glowing beacon</b> over each door and the <b>MASUK</b> sign on the pavement. Walk up to the door and press <b>E</b> · <b>ENTER</b> button · <b>D-pad ▲</b>. The door stays shut while the police are after you.</p></div></div>
      <div class="help-cols">
      <div class="help-col"><h3>KEYBOARD & MOUSE</h3><h4>ON FOOT</h4>${rows(KEYBOARD_HELP.foot)}<h4>IN A VEHICLE</h4>${rows(KEYBOARD_HELP.vehicle)}</div>
      <div class="help-col"><h3>TOUCH SCREEN</h3><h4>ON FOOT</h4>${touch('foot')}<h4>IN A VEHICLE</h4>${touch('vehicle')}<h4>LAYOUT</h4>Settings → Touch controls layout: drag, pinch to resize, fade or hide any control.</div>
      <div class="help-col"><h3>GAMEPAD</h3><h4>ON FOOT</h4>${pad('foot')}<h4>IN A VEHICLE</h4>${pad('vehicle')}<h4>MENUS & MAP</h4>D-pad / stick navigate · A confirm · B back · stick moves the map cursor</div>
    </div><button id="help-back">BACK</button>`;
    $('help-back').addEventListener('click', () => this.closeHelp());
  }

  closeHelp() {
    $('help-screen').classList.add('hidden');
    if (this.helpFrom === 'title') { $('title-screen').classList.remove('hidden'); this.current = 'title'; }
    else { $('pause-screen').classList.remove('hidden'); this.current = 'pause'; }
  }

  closeSettings() {
    $('settings-screen').classList.add('hidden');
    if (this.settingsFrom === 'title') { $('title-screen').classList.remove('hidden'); this.current = 'title'; }
    else { $('pause-screen').classList.remove('hidden'); this.current = 'pause'; }
  }
}
