// The heads-up display: wanted stars, money and rank, weapon box with ammo and slots, crew
// favours, mission panel with stages, police response list, district banner, subtitles,
// notifications, speedometer with car condition, radio, health/armour, crosshair and overlays.
import { formatRupiah } from '../core/math-utils.js';
import { districtAt, streetAt, DISTRICTS } from '../city/city-layout.js';
import { WEAPONS, WEAPON_ORDER } from '../combat/weapon-catalog.js';
import { paintWeaponIcon } from '../combat/weapon-meshes.js';
import { drawSpeedometer } from './speedometer.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {};
    for (const id of ['wanted-stars', 'money-display', 'rank-name', 'xp-fill', 'weapon-icon', 'weapon-name', 'weapon-ammo', 'weapon-slots', 'crew-abilities',
      'mission-panel', 'mission-chapter', 'mission-title', 'mission-stages', 'mission-objective', 'police-panel', 'police-units', 'notifications',
      'district-banner', 'district-name', 'street-name', 'dialogue-line', 'dialogue-speaker', 'dialogue-text', 'crosshair', 'hit-marker', 'damage-flash',
      'interaction-hint', 'vehicle-panel', 'vehicle-name', 'speedometer', 'car-damage', 'radio-display', 'radio-name', 'radio-song', 'race-panel',
      'mission-result', 'wasted-screen', 'weapon-wheel']) this.el[id] = $(id);
    this.iconCanvas = document.createElement('canvas');
    this.iconCanvas.width = 128; this.iconCanvas.height = 60;
    this.el['weapon-icon'].appendChild(this.iconCanvas);
    this.cache = {};
    this.district = null;
    this.bannerTimer = 0;
    this.resultTimer = 0;
    this.moneyShown = null;
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  setText(id, text) { if (this.cache[id] !== text) { this.cache[id] = text; this.el[id].textContent = text; } }
  setHtml(id, html) { if (this.cache[id] !== html) { this.cache[id] = html; this.el[id].innerHTML = html; } }
  toggle(id, on) { this.el[id].classList.toggle('hidden', !on); }

  notify(text, kind = '') {
    const n = document.createElement('div');
    n.className = 'note ' + kind;
    n.textContent = text;
    this.el.notifications.appendChild(n);
    while (this.el.notifications.children.length > 3) this.el.notifications.firstChild.remove();
    setTimeout(() => n.remove(), 4200);
  }

  missionTitleCard(m) {
    this.resultHtml(`<div class="small">${m.chapter}</div><div class="big">${m.title.toUpperCase()}</div><div class="small">${m.briefing}</div>`, 4.5);
  }

  missionResult(success, m, reason = '') {
    this.resultHtml(success
      ? `<div class="big">MISSION COMPLETE</div><div class="small">${m.title} · +${formatRupiah(m.reward.money)} · +${m.reward.xp} XP</div>`
      : `<div class="big" style="color:#ff6a5a">MISSION FAILED</div><div class="small">${reason}</div>`, 4.5);
  }

  activityResult(success, title, detail) {
    this.resultHtml(`<div class="big" style="${success ? '' : 'color:#ff6a5a'}">${title}</div><div class="small">${detail}</div>`, 4);
  }

  resultHtml(html, seconds) {
    this.el['mission-result'].innerHTML = html;
    this.toggle('mission-result', true);
    this.resultTimer = seconds;
  }

  damageFlash(amount) {
    this.el['damage-flash'].style.boxShadow = `inset 0 0 160px rgba(220,0,0,${Math.min(0.8, amount / 40)})`;
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { this.el['damage-flash'].style.boxShadow = 'inset 0 0 160px rgba(220,0,0,0)'; }, 160);
  }

  hitMarker() {
    this.el['hit-marker'].classList.add('show');
    clearTimeout(this.hitT);
    this.hitT = setTimeout(() => this.el['hit-marker'].classList.remove('show'), 120);
  }

  update(dt, s) {
    // Wanted stars.
    let stars = '';
    for (let i = 1; i <= 5; i++) stars += `<span class="${i <= s.wanted ? 'on' : ''}">★</span>`;
    this.setHtml('wanted-stars', stars);
    this.el['wanted-stars'].classList.toggle('blink', s.wantedBlink);

    // Money counts up toward the real total.
    if (this.moneyShown === null) this.moneyShown = s.money;
    this.moneyShown += (s.money - this.moneyShown) * Math.min(1, dt * 6);
    if (Math.abs(s.money - this.moneyShown) < 1) this.moneyShown = s.money;
    this.setText('money-display', formatRupiah(this.moneyShown));
    this.setText('rank-name', `${s.rank} · ${s.xp} XP`);
    this.el['xp-fill'].style.width = `${Math.round(s.rankProgress * 100)}%`;

    // Weapon box.
    const w = WEAPONS[s.weapon];
    if (this.cache.icon !== s.weapon) { this.cache.icon = s.weapon; paintWeaponIcon(this.iconCanvas, s.weapon); }
    this.setText('weapon-name', w.name);
    this.setText('weapon-ammo', w.melee ? '—' : s.reloading ? 'ISI…' : `${s.mag} / ${s.reserve}`);
    this.setHtml('weapon-slots', WEAPON_ORDER.map((id, i) => `<div class="${id === s.weapon ? 'active' : ''} ${s.owned.includes(id) ? '' : 'locked'}">${i + 1} ${WEAPONS[id].short}</div>`).join(''));
    this.setHtml('crew-abilities', s.crew.map((c) => `<div class="crew ${c.cooldown > 0 ? 'cooldown' : ''}"><b>[${c.label}] ${c.name}</b>${c.cooldown > 0 ? Math.ceil(c.cooldown) + ' s' : c.ability}</div>`).join(''));

    // Mission panel.
    const mp = s.mission;
    this.toggle('mission-panel', !!mp);
    if (mp) {
      this.setText('mission-chapter', mp.chapter);
      this.setText('mission-title', mp.title);
      this.setHtml('mission-stages', mp.stages.map((st) => `<li class="${st.state}">${st.text}</li>`).join(''));
      this.setText('mission-objective', mp.objective);
    }

    // Police response list.
    const units = s.police;
    this.toggle('police-panel', units.length > 0);
    if (units.length) {
      this.setHtml('police-units', units.slice(0, 6).map((u) => `<li class="${u.kind}"><span>${u.callsign}</span><span class="state">${u.state}${u.dist ? ` · ${u.dist} m` : ''}</span></li>`).join(''));
    }

    // District banner when entering a new district.
    const d = districtAt(s.px, s.pz);
    if (d !== this.district) {
      this.district = d;
      this.setText('district-name', DISTRICTS[d].name);
      this.bannerTimer = 4;
    }
    this.setText('street-name', (streetAt(s.px, s.pz) || '').toUpperCase());
    if (s.forceBanner) this.bannerTimer = Math.max(this.bannerTimer, 1);
    this.bannerTimer -= dt;
    this.el['district-banner'].classList.toggle('show', this.bannerTimer > 0);

    // Subtitles.
    const line = s.dialogue;
    this.el['dialogue-line'].classList.toggle('show', !!line);
    if (line) {
      this.setText('dialogue-speaker', line.name + ':');
      this.el['dialogue-speaker'].style.color = line.color;
      this.setText('dialogue-text', line.text);
    }

    // Vehicle panel and radio.
    this.toggle('vehicle-panel', !!s.vehicle);
    if (s.vehicle) {
      this.setText('vehicle-name', s.vehicle.name.toUpperCase());
      drawSpeedometer(this.el.speedometer, s.vehicle.kmh, s.vehicle.maxKmh, s.vehicle.gear, s.vehicle.drifting);
      const cond = Math.max(0, s.vehicle.condition);
      const bar = this.el['car-damage'].querySelector('.fill');
      bar.style.width = `${Math.round(cond * 100)}%`;
      bar.style.backgroundPosition = `${Math.round((1 - cond) * -60)}px 0`;
    }
    this.toggle('radio-display', !!s.radio);
    if (s.radio) { this.setText('radio-name', s.radio.name); this.setText('radio-song', `♪ ${s.radio.song} — ${s.radio.dj}`); }

    // Vitals.
    $('health-bar').querySelector('.fill').style.width = `${Math.max(0, s.health) * 100}%`;
    $('armour-bar').querySelector('.fill').style.width = `${Math.max(0, s.armour) * 100}%`;

    $('gps-readout').textContent = s.gps || '';

    // Crosshair, hints, overlays.
    this.el.crosshair.classList.toggle('show', s.aiming);
    this.el.crosshair.classList.toggle('target', !!s.aimTarget);
    this.el['interaction-hint'].classList.toggle('show', !!s.hint);
    if (s.hint) this.setHtml('interaction-hint', s.hint);
    this.toggle('race-panel', !!s.activity);
    if (s.activity) this.setHtml('race-panel', s.activity);
    if (this.resultTimer > 0) { this.resultTimer -= dt; if (this.resultTimer <= 0) this.toggle('mission-result', false); }
    this.toggle('wasted-screen', !!s.wasted);
    if (s.wasted) this.setText('wasted-screen', s.wasted);
  }

  showWeaponWheel(on, owned, current) {
    this.toggle('weapon-wheel', on);
    if (!on) return;
    const html = WEAPON_ORDER.map((id, i) => {
      const a = -Math.PI / 2 + i * Math.PI / 2;
      const x = 180 + Math.cos(a) * 125, y = 180 + Math.sin(a) * 125;
      return `<div class="slot ${id === current ? 'active' : ''}" style="left:${x}px;top:${y}px;opacity:${owned.includes(id) ? 1 : 0.3}">${i + 1}<br>${WEAPONS[id].name}</div>`;
    }).join('');
    this.setHtml('weapon-wheel', html);
  }
}
