// The heads-up display: wanted stars, money and rank, weapon box with ammo and slots, crew
// favours, mission panel with stages, police response list, district banner, subtitles,
// notifications, speedometer with car condition, radio, health/armour, crosshair and overlays.
import { formatMoney } from '../core/math-utils.js';
import { districtAt, streetAt, DISTRICTS } from '../city/city-layout.js';
import { WEAPONS, WEAPON_ORDER } from '../combat/weapon-catalog.js';
import { paintWeaponIcon } from '../combat/weapon-meshes.js';
import { drawSpeedometer } from './speedometer.js';
import { EventBanner } from './event-banner.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {};
    for (const id of ['wanted-stars', 'money-display', 'rank-name', 'xp-fill', 'weapon-icon', 'weapon-name', 'weapon-ammo', 'weapon-slots', 'crew-abilities',
      'mission-panel', 'mission-chapter', 'mission-title', 'mission-stages', 'mission-objective', 'police-panel', 'police-units', 'notifications',
      'district-banner', 'district-name', 'street-name', 'crosshair', 'hit-marker', 'damage-flash',
      'interaction-hint', 'vehicle-panel', 'vehicle-name', 'speedometer', 'car-damage', 'radio-display', 'radio-name', 'radio-song', 'race-panel',
      'weapon-wheel']) this.el[id] = $(id);
    this.iconCanvas = document.createElement('canvas');
    this.iconCanvas.width = 128; this.iconCanvas.height = 60;
    this.el['weapon-icon'].appendChild(this.iconCanvas);
    this.cache = {};
    this.district = null;
    this.bannerTimer = 0;
    this.moneyShown = null;
    this.banner = new EventBanner(this.root);
    this.dialogueBox = null; // set by the session (needs the renderer for portraits)
    this.wastedShown = null;
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
    this.banner.show('title', { chapter: m.chapter, title: m.title.toUpperCase(), sub: '', detail: `<span class="eb-brief">${m.briefing}</span>`, seconds: 4.8 });
  }

  missionResult(success, m, reason = '') {
    if (success) this.banner.show('passed', { detail: `<span class="eb-num">+${formatMoney(m.reward.money)}</span><span class="eb-dot">·</span><span class="eb-num">+${m.reward.xp} XP</span><span class="eb-small">${m.title}</span>`, seconds: 5 });
    else this.banner.show('failed', { detail: reason ? `<span class="eb-small">${reason}</span>` : '', seconds: 4.5 });
  }

  activityResult(success, title, detail) {
    this.banner.show(success ? 'activity-ok' : 'activity-bad', { title, sub: '', detail: `<span class="eb-small">${detail}</span>`, seconds: 4 });
  }

  wantedUp(level, reason) { this.banner.wantedUp(level, reason); }

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
    this.setText('money-display', formatMoney(this.moneyShown));
    this.setText('rank-name', `${s.rank} · ${s.xp} XP`);
    this.el['xp-fill'].style.width = `${Math.round(s.rankProgress * 100)}%`;

    // Weapon box.
    const w = WEAPONS[s.weapon];
    if (this.cache.icon !== s.weapon) { this.cache.icon = s.weapon; paintWeaponIcon(this.iconCanvas, s.weapon); }
    this.setText('weapon-name', w.name);
    this.setText('weapon-ammo', w.melee ? '—' : s.reloading ? 'ISI…' : `${s.mag} / ${s.reserve}`);
    this.setHtml('weapon-slots', WEAPON_ORDER.map((id, i) => s.owned.includes(id) ? `<div class="${id === s.weapon ? 'active' : ''}">${i + 1} ${WEAPONS[id].short}</div>` : '').join(''));
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
      const first = this.district === null;
      this.district = d;
      this.setText('district-name', DISTRICTS[d].name);
      if (first) this.bannerTimer = 4;
      else this.banner.district(DISTRICTS[d].name.toUpperCase(), (streetAt(s.px, s.pz) || 'PELABUHAN SANGGARA').toUpperCase());
    }
    this.setText('street-name', (streetAt(s.px, s.pz) || '').toUpperCase());
    if (s.forceBanner) this.bannerTimer = Math.max(this.bannerTimer, 1);
    this.bannerTimer -= dt;
    this.el['district-banner'].classList.toggle('show', this.bannerTimer > 0);

    // Dialogue box with portraits (typewriter subtitles).
    this.dialogueBox?.update(dt, s.dialogue, s.talkPartner);

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
    // WASTED / BUSTED: banner, grade and a fade to black just before the respawn.
    if (s.wasted !== this.wastedShown) {
      this.wastedShown = s.wasted;
      if (s.wasted) this.banner.show(s.wasted === 'BUSTED' ? 'busted' : 'wasted', { seconds: 99 });
      else { this.banner.hideBig(); this.banner.setGrade(null); }
    }
    this.banner.blackout(s.wasted ? Math.max(0, Math.min(1, (0.75 - s.wastedT) / 0.45)) : Math.max(0, (Number(this.banner.black.dataset.a) || 0) - dt * 2.2));
    this.banner.update(dt);
  }

  showWeaponWheel(on, owned, current) {
    this.toggle('weapon-wheel', on);
    if (!on) return;
    const html = WEAPON_ORDER.map((id, i) => {
      const a = -Math.PI / 2 + i * Math.PI * 2 / WEAPON_ORDER.length;
      const x = 180 + Math.cos(a) * 140, y = 180 + Math.sin(a) * 140;
      return `<div class="slot ${id === current ? 'active' : ''}" style="left:${x}px;top:${y}px;opacity:${owned.includes(id) ? 1 : 0.3}">${i + 1}<br>${WEAPONS[id].name}</div>`;
    }).join('');
    this.setHtml('weapon-wheel', html);
  }
}
