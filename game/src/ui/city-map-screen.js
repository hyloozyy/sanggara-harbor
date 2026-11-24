// The full-screen city map (M, Select, or the pause menu): the whole of Sanggara drawn from the same
// city data as the minimap, with the six districts outlined in their colours and labelled, street
// names when zoomed in, landmarks, activities, the next story mission, police and the player.
// Pan by dragging, zoom with the wheel or a pinch, move a cursor with a gamepad stick. Hovering
// a district highlights it; clicking a district or a landmark opens a detail card (lore, a
// thumbnail rendered once from the 3D city, what is there, who controls it, police presence,
// the weather, Raka's progress) with a "Set waypoint" button; right-click drops a waypoint.
import * as THREE from 'three';
import { GRID, BLOCKS, DISTRICTS, PLACES, EW_STREETS, NS_STREETS, districtAt } from '../city/city-layout.js';
import { DISTRICT_LORE, PLACE_INFO, DANGER, POLICE_PRESENCE } from '../city/district-lore.js';
import { MISSIONS } from '../missions/mission-scripts.js';
import { WEATHER_STATES } from '../world/weather-system.js';

const ORIGIN = -420, PX = 1.6;
const $ = (id) => document.getElementById(id);

// Outline edges of each district: cell sides whose neighbour belongs to another district.
function districtEdges() {
  const cell = new Map(BLOCKS.map((b) => [`${b.i},${b.j}`, b]));
  const out = {};
  for (const b of BLOCKS) {
    const x0 = GRID[b.i], x1 = GRID[b.i + 1], z0 = GRID[b.j], z1 = GRID[b.j + 1];
    const e = out[b.district] ||= [];
    const other = (i, j) => cell.get(`${i},${j}`)?.district !== b.district;
    if (other(b.i - 1, b.j)) e.push([x0, z0, x0, z1]);
    if (other(b.i + 1, b.j)) e.push([x1, z0, x1, z1]);
    if (other(b.i, b.j - 1)) e.push([x0, z0, x1, z0]);
    if (other(b.i, b.j + 1)) e.push([x0, z1, x1, z1]);
  }
  return out;
}

export class CityMapScreen {
  constructor(session, minimap) {
    this.s = session;
    this.minimap = minimap;
    this.root = $('big-map');
    this.canvas = $('big-map-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.card = $('map-card');
    this.edges = districtEdges();
    this.centres = {};
    for (const id of Object.keys(DISTRICTS)) {
      const b = BLOCKS.filter((q) => q.district === id);
      this.centres[id] = { x: b.reduce((s, q) => s + q.cx, 0) / b.length, z: b.reduce((s, q) => s + q.cz, 0) / b.length };
    }
    this.view = { cx: 0, cz: 0, k: 1 };
    this.pointers = new Map();
    this.hover = null;
    this.cursor = null;     // gamepad cursor in CSS pixels
    this.thumbs = {};
    this.isOpen = false;
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    for (const t of ['pointerup', 'pointercancel']) c.addEventListener(t, (e) => this.onUp(e));
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); const w = this.toWorld(e.offsetX, e.offsetY); this.setWaypoint(w.x, w.z, 'Waypoint'); });
    addEventListener('keydown', (e) => { if (this.isOpen && e.code === 'Enter' && this.cursor) this.click(this.cursor.x, this.cursor.y); });
    $('map-close').addEventListener('click', () => this.onClose?.());
  }

  open() {
    this.isOpen = true;
    this.root.classList.remove('hidden');
    this.resize();
    const p = this.s.player.pos;
    const fit = Math.min(this.W, this.H) / 760;
    this.view = { cx: p.x * 0.5, cz: p.z * 0.5, k: fit * 1.15 };
    this.cursor = null;
    this.closeCard();
    this.draw();
  }

  close() { this.isOpen = false; this.root.classList.add('hidden'); this.pointers.clear(); }

  resize() {
    const r = this.root.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * dpr); this.canvas.height = Math.round(this.H * dpr);
    this.canvas.style.width = `${this.W}px`; this.canvas.style.height = `${this.H}px`;
    this.dpr = dpr;
  }

  toScreen(x, z) { const v = this.view; return [this.W / 2 + (x - v.cx) * v.k, this.H / 2 + (z - v.cz) * v.k]; }
  toWorld(sx, sy) { const v = this.view; return { x: v.cx + (sx - this.W / 2) / v.k, z: v.cz + (sy - this.H / 2) / v.k }; }

  zoomAt(sx, sy, f) {
    const before = this.toWorld(sx, sy);
    this.view.k = Math.max(0.5, Math.min(9, this.view.k * f));
    const after = this.toWorld(sx, sy);
    this.view.cx += before.x - after.x; this.view.cz += before.z - after.z;
    this.clampView();
  }

  clampView() { this.view.cx = Math.max(-400, Math.min(400, this.view.cx)); this.view.cz = Math.max(-400, Math.min(420, this.view.cz)); }

  // ------------------------------------------------------------------ input
  onDown(e) {
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY, moved: 0 });
    if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: this.view.k }; }
  }

  onMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) { this.hover = this.pick(e.offsetX, e.offsetY); this.canvas.style.cursor = this.hover ? 'pointer' : 'grab'; return; }
    const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
    p.x = e.offsetX; p.y = e.offsetY; p.moved += Math.abs(dx) + Math.abs(dy);
    if (this.pointers.size >= 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.zoomAt(mx, my, (this.pinch.k * d / Math.max(10, this.pinch.d)) / this.view.k);
      return;
    }
    this.view.cx -= dx / this.view.k; this.view.cz -= dy / this.view.k;
    this.clampView();
  }

  onUp(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (p && p.moved < 8 && e.type === 'pointerup' && e.button !== 2) this.click(p.sx, p.sy);
  }

  // What is under a screen point: a blip (landmark/activity/mission) or a district.
  pick(sx, sy) {
    let best = null, bd = 16;
    for (const b of this.blips()) {
      const [x, y] = this.toScreen(b.x, b.z);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bd) { bd = d; best = { type: 'place', ...b }; }
    }
    if (best) return best;
    const w = this.toWorld(sx, sy);
    if (w.x < GRID[0] - 40 || w.x > GRID[8] + 40 || w.z < GRID[0] - 40 || w.z > GRID[8] + 60) return null;
    return { type: 'district', id: districtAt(w.x, w.z) };
  }

  click(sx, sy) {
    const hit = this.pick(sx, sy);
    if (!hit) { this.closeCard(); return; }
    this.s.audio.uiClick?.();
    if (hit.type === 'district') this.districtCard(hit.id); else this.placeCard(hit);
  }

  blips() {
    const out = [];
    for (const [key, p] of Object.entries(PLACES)) out.push({ key, x: p.x, z: p.z, name: p.name, color: PLACE_INFO[key]?.kind === 'Gang' ? '#ff5a5a' : PLACE_INFO[key]?.kind === 'Activity' ? '#40ffc0' : PLACE_INFO[key]?.kind === 'Story' ? '#ffc35a' : '#e8e2d4' });
    const hospital = this.s.hospital;
    if (hospital) out.push({ key: 'hospital', x: hospital.x, z: hospital.z, name: hospital.name, color: '#ffffff' });
    const m = this.s.missions.nextMission;
    if (m && !this.s.missions.active) out.push({ key: 'mission', x: m.start.x, z: m.start.z, name: `${m.chapter}: ${m.title}`, color: '#ffd23a', mission: m });
    return out;
  }

  // ------------------------------------------------------------------ waypoint
  setWaypoint(x, z, label) {
    this.s.waypoint = { x, z, label };
    this.s.gpsTimer = 0;
    this.s.updateGps(0);
    this.s.hud.notify(`Waypoint set: ${label}`);
    this.s.audio.checkpoint?.();
  }

  // ------------------------------------------------------------------ cards
  closeCard() { this.card.classList.add('hidden'); this.cardFor = null; }

  districtCard(id) {
    const d = DISTRICTS[id], L = DISTRICT_LORE[id], s = this.s;
    const c = this.centres[id];
    const here = Object.entries(PLACES).filter(([, p]) => districtAt(p.x, p.z) === id);
    const missionsHere = MISSIONS.filter((m) => districtAt(m.start.x, m.start.z) === id);
    const done = missionsHere.filter((m) => s.missions.completed.has(m.id)).length;
    const next = s.missions.nextMission;
    const available = next && !s.missions.active && districtAt(next.start.x, next.start.z) === id ? next : null;
    const w = WEATHER_STATES[s.weather.state];
    const danger = Math.min(3, (L.gang.startsWith('Hiu') ? 2 : 1) + (s.wanted.level >= 3 ? 1 : 0) - (L.police >= 3 ? 1 : 0));
    const shells = s.worldEvents.shellsFound?.size ?? 0;
    this.cardFor = id;
    this.card.style.setProperty('--accent', d.color);
    this.card.innerHTML = `
      <div class="mc-head"><b>${d.name}</b><span>${L.subtitle} · ${d.tagline}</span></div>
      <canvas class="mc-thumb" width="320" height="170"></canvas>
      <p class="mc-lore">${L.lore}</p>
      <table class="mc-facts">
        <tr><td>Controlled by</td><td>${L.gang}</td></tr>
        <tr><td>Police</td><td>${POLICE_PRESENCE[L.police]}</td></tr>
        <tr><td>Danger</td><td class="mc-danger d${danger}">${DANGER[danger]}</td></tr>
        <tr><td>Weather now</td><td>${w.icon} ${w.label}</td></tr>
        <tr><td>Story here</td><td>${missionsHere.length ? `${done} / ${missionsHere.length} missions done` : 'No story missions'}</td></tr>
        <tr><td>Your standing</td><td>${s.progression.rank.name}${shells ? ` · ${shells} golden shells found citywide` : ''}</td></tr>
      </table>
      ${available ? `<div class="mc-mission">Mission available: <b>${available.chapter} — ${available.title}</b></div>` : ''}
      <div class="mc-list"><b>What's here</b>${here.length ? here.map(([k, p]) => `<div>• ${p.name}${PLACE_INFO[k] ? ` <i>${PLACE_INFO[k].kind}</i>` : ''}</div>`).join('') : '<div>Streets, shops and people.</div>'}</div>
      <div class="mc-buttons"><button id="mc-way">SET WAYPOINT</button><button id="mc-close">CLOSE</button></div>`;
    this.card.classList.remove('hidden');
    $('mc-way').addEventListener('click', () => this.setWaypoint(c.x, c.z, d.name));
    $('mc-close').addEventListener('click', () => this.closeCard());
    this.thumbnail(id, L.view);
  }

  placeCard(b) {
    const info = b.mission ? { kind: 'Story mission', text: b.mission.briefing } : PLACE_INFO[b.key] || { kind: 'Location', text: b.key === 'hospital' ? 'Sanggara Sehat Hospital. Where you wake up after a bad day, minus a few dollars.' : '' };
    const dist = Math.hypot(b.x - this.s.player.pos.x, b.z - this.s.player.pos.z);
    const did = districtAt(b.x, b.z);
    this.cardFor = b.key;
    this.card.style.setProperty('--accent', b.color);
    this.card.innerHTML = `
      <div class="mc-head"><b>${b.name}</b><span>${info.kind} · ${DISTRICTS[did].name}</span></div>
      <canvas class="mc-thumb" width="320" height="170"></canvas>
      <p class="mc-lore">${info.text}</p>
      <table class="mc-facts"><tr><td>Distance</td><td>${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}</td></tr></table>
      <div class="mc-buttons"><button id="mc-way">SET WAYPOINT</button><button id="mc-close">CLOSE</button></div>`;
    this.card.classList.remove('hidden');
    $('mc-way').addEventListener('click', () => this.setWaypoint(b.x, b.z, b.name));
    $('mc-close').addEventListener('click', () => this.closeCard());
    this.thumbnail('place:' + b.key, { x: b.x + 26, y: 18, z: b.z + 30, tx: b.x, tz: b.z });
  }

  // A small picture of the place, rendered once from the 3D city and kept.
  thumbnail(key, view) {
    const target = this.card.querySelector('.mc-thumb');
    const paint = () => { if (this.thumbs[key]) target.getContext('2d').drawImage(this.thumbs[key], 0, 0); };
    if (this.thumbs[key]) { paint(); return; }
    const g = target.getContext('2d');
    g.fillStyle = '#0c1220'; g.fillRect(0, 0, 320, 170);
    g.fillStyle = '#ffc35a'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('Rendering view…', 160, 90);
    setTimeout(() => {
      try {
        const gfx = this.s.gfx, cam = gfx.camera;
        const saved = { p: cam.position.clone(), q: cam.quaternion.clone(), fov: cam.fov };
        cam.position.set(view.x, view.y, view.z);
        cam.lookAt(new THREE.Vector3(view.tx, 2, view.tz));
        cam.fov = 55; cam.updateProjectionMatrix();
        gfx.lighting.follow(view.tx, view.tz);
        gfx.render(this.s.time);
        const out = document.createElement('canvas'); out.width = 320; out.height = 170;
        const src = gfx.canvas, sw = src.width, sh = src.height, crop = Math.min(sw, sh * 320 / 170);
        out.getContext('2d').drawImage(src, (sw - crop) / 2, (sh - crop * 170 / 320) / 2, crop, crop * 170 / 320, 0, 0, 320, 170);
        cam.position.copy(saved.p); cam.quaternion.copy(saved.q); cam.fov = saved.fov; cam.updateProjectionMatrix();
        gfx.lighting.follow(this.s.player.pos.x, this.s.player.pos.z);
        this.thumbs[key] = out;
        if (this.card.querySelector('.mc-thumb') === target) paint();
      } catch { /* the thumbnail is decoration */ }
    }, 30);
  }

  // ------------------------------------------------------------------ frame
  update(dt, padCursor) {
    if (!this.isOpen) return;
    if (padCursor && (Math.abs(padCursor.x) > 0.01 || Math.abs(padCursor.y) > 0.01 || Math.abs(padCursor.zoom) > 0.05)) {
      this.cursor ||= { x: this.W / 2, y: this.H / 2 };
      this.cursor.x += padCursor.x * 420 * dt; this.cursor.y += padCursor.y * 420 * dt;
      // Push the view when the cursor reaches the edge.
      const m = 60;
      if (this.cursor.x < m || this.cursor.x > this.W - m) this.view.cx += Math.sign(this.cursor.x - this.W / 2) * 300 * dt / this.view.k;
      if (this.cursor.y < m || this.cursor.y > this.H - m) this.view.cz += Math.sign(this.cursor.y - this.H / 2) * 300 * dt / this.view.k;
      this.cursor.x = Math.max(m * 0.5, Math.min(this.W - m * 0.5, this.cursor.x)); this.cursor.y = Math.max(m * 0.5, Math.min(this.H - m * 0.5, this.cursor.y));
      if (Math.abs(padCursor.zoom) > 0.05) this.zoomAt(this.cursor.x, this.cursor.y, 1 + padCursor.zoom * dt * 2);
      this.hover = this.pick(this.cursor.x, this.cursor.y);
      this.clampView();
    }
    this.time = (this.time || 0) + dt;
    this.draw();
  }

  draw() {
    const g = this.ctx, v = this.view, s = this.s;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = '#16303c'; g.fillRect(0, 0, this.W, this.H);
    const [ox, oy] = this.toScreen(ORIGIN, ORIGIN);
    g.imageSmoothingEnabled = true;
    g.drawImage(this.minimap.map, ox, oy, 840 * v.k, 840 * v.k);
    void PX;
    // Districts: hover fill, coloured outlines, names.
    const hoverId = this.hover?.type === 'district' ? this.hover.id : this.cardFor && DISTRICTS[this.cardFor] ? this.cardFor : null;
    for (const [id, d] of Object.entries(DISTRICTS)) {
      if (id === hoverId) {
        g.fillStyle = d.color + '3a';
        for (const b of BLOCKS) if (b.district === id) { const [x0, y0] = this.toScreen(GRID[b.i], GRID[b.j]); g.fillRect(x0, y0, 80 * v.k, 80 * v.k); }
      }
      g.strokeStyle = d.color; g.lineWidth = id === hoverId ? 4 : 2.2; g.lineCap = 'round';
      g.setLineDash(id === hoverId ? [] : [10, 5]);
      g.beginPath();
      for (const [x0, z0, x1, z1] of this.edges[id] || []) { const a = this.toScreen(x0, z0), b = this.toScreen(x1, z1); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
      g.stroke();
    }
    g.setLineDash([]);
    // Street names once zoomed in.
    if (v.k > 1.7) {
      g.font = `${Math.min(13, 4 + v.k * 2)}px sans-serif`; g.fillStyle = 'rgba(20,24,32,0.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      GRID.forEach((gz, i) => { for (let j = 0; j < 8; j += 3) { const [x, y] = this.toScreen((GRID[j] + GRID[j + 1]) / 2, gz); g.fillText(EW_STREETS[i], x, y); } });
      GRID.forEach((gx, i) => { for (let j = 1; j < 8; j += 3) { const [x, y] = this.toScreen(gx, (GRID[j] + GRID[j + 1]) / 2); g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); g.fillText(NS_STREETS[i], 0, 0); g.restore(); } });
    }
    for (const [id, d] of Object.entries(DISTRICTS)) {
      const c = this.centres[id], [x, y] = this.toScreen(c.x, c.z);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${Math.round(Math.max(14, Math.min(26, 10 + v.k * 6)))}px "Trebuchet MS", sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(d.name.toUpperCase(), x, y - 8);
      g.fillStyle = d.color; g.fillText(d.name.toUpperCase(), x, y - 8);
      g.font = `italic ${Math.round(Math.max(11, Math.min(15, 8 + v.k * 3)))}px sans-serif`;
      g.lineWidth = 3; g.strokeText(DISTRICT_LORE[id].subtitle, x, y + 12);
      g.fillStyle = '#f0ece0'; g.fillText(DISTRICT_LORE[id].subtitle, x, y + 12);
    }
    // GPS route to the waypoint or objective.
    const route = s.gpsRoute;
    if (route?.length) {
      g.strokeStyle = s.waypoint ? 'rgba(230,90,255,0.9)' : 'rgba(255,200,64,0.9)'; g.lineWidth = 4; g.setLineDash([10, 7]);
      g.beginPath(); const [px0, py0] = this.toScreen(s.player.pos.x, s.player.pos.z); g.moveTo(px0, py0);
      for (const p of route) { const [x, y] = this.toScreen(p.x, p.z); g.lineTo(x, y); }
      g.stroke(); g.setLineDash([]);
    }
    // Landmarks and activities.
    g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    for (const b of this.blips()) {
      const [x, y] = this.toScreen(b.x, b.z);
      const hot = this.hover?.type === 'place' && this.hover.key === b.key;
      g.fillStyle = b.color; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath();
      if (b.key === 'mission') { g.arc(x, y, hot ? 11 : 9, 0, Math.PI * 2); } else g.rect(x - (hot ? 8 : 6), y - (hot ? 8 : 6), hot ? 16 : 12, hot ? 16 : 12);
      g.fill(); g.stroke();
      if (b.key === 'mission') { g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.textBaseline = 'middle'; g.fillText('!', x, y + 1); g.font = '12px sans-serif'; g.textBaseline = 'bottom'; }
      if (v.k > 1.1 || hot) { g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.8)'; g.strokeText(b.name, x, y - 10); g.fillStyle = '#fff'; g.fillText(b.name, x, y - 10); }
    }
    // Police, objective, waypoint, player.
    const blink = Math.sin((this.time || 0) * 10) > 0;
    for (const p of s.police.policeCars) { if (p.wrecked) continue; const [x, y] = this.toScreen(p.pos.x, p.pos.z); g.fillStyle = blink ? '#ff3a3a' : '#3a7aff'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
    const obj = s.minimapState?.().objective;
    if (obj) { const [x, y] = this.toScreen(obj.x, obj.z); g.fillStyle = '#ffc040'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#000'; g.textBaseline = 'middle'; g.fillText('★', x, y + 1); }
    if (s.waypoint) {
      const [x, y] = this.toScreen(s.waypoint.x, s.waypoint.z);
      g.fillStyle = '#e65aff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y); g.arc(x, y - 18, 9, Math.PI * 0.8, Math.PI * 2.2); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y - 18, 3.5, 0, Math.PI * 2); g.fill();
    }
    const pl = s.player, [px, py] = this.toScreen(pl.pos.x, pl.pos.z);
    const hd = pl.vehicle ? pl.vehicle.heading : pl.body.heading;
    g.save(); g.translate(px, py); g.rotate(-hd + Math.PI);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 4); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // Gamepad cursor.
    if (this.cursor) {
      const { x, y } = this.cursor;
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.moveTo(x - 18, y); g.lineTo(x - 6, y); g.moveTo(x + 6, y); g.lineTo(x + 18, y); g.moveTo(x, y - 18); g.lineTo(x, y - 6); g.moveTo(x, y + 6); g.lineTo(x, y + 18); g.stroke();
    }
  }
}
