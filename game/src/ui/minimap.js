// The radar: a pre-painted map of Sanggara (sea, beach, hills, districts, roads, quay) drawn into a
// circular minimap that rotates with the camera, with blips for police, the helicopter, enemies,
// the objective (clamped to the rim), activities and the wanted search zone; plus the full map.
import { GRID, ROAD_HALF, BLOCKS, DISTRICTS, SEA_SOUTH_Z, HARBOR_EDGE_X, PLACES } from '../city/city-layout.js';

const WORLD = 840, ORIGIN = -420, PX = 1.6; // map canvas pixels per metre
const toMap = (v) => (v - ORIGIN) * PX;

function paintMap() {
  const c = document.createElement('canvas');
  c.width = c.height = WORLD * PX;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1d4a5e'; ctx.fillRect(0, 0, c.width, c.height);                     // sea
  ctx.fillStyle = '#2c4a2a'; ctx.fillRect(0, 0, c.width, toMap(-372)); ctx.fillRect(0, 0, toMap(-372), c.height); // hills
  ctx.fillStyle = '#3a3c44'; ctx.fillRect(toMap(-372), toMap(-372), (HARBOR_EDGE_X + 372) * PX, (SEA_SOUTH_Z + 372) * PX);
  ctx.fillStyle = '#b89a68'; ctx.fillRect(toMap(-380), toMap(GRID[8] + ROAD_HALF), (GRID[8] + ROAD_HALF + 380) * PX, (SEA_SOUTH_Z - GRID[8] - ROAD_HALF) * PX); // beach
  ctx.fillStyle = '#4a4e56'; ctx.fillRect(toMap(GRID[8] + ROAD_HALF), toMap(-372), (HARBOR_EDGE_X - GRID[8] - ROAD_HALF) * PX, 700 * PX); // quay
  for (const b of BLOCKS) {
    const d = DISTRICTS[b.district];
    ctx.fillStyle = '#6a6d74';
    ctx.fillRect(toMap(b.slab.minX), toMap(b.slab.minZ), (b.slab.maxX - b.slab.minX) * PX, (b.slab.maxZ - b.slab.minZ) * PX);
    ctx.fillStyle = '#30343c';
    ctx.fillRect(toMap(b.lot.minX), toMap(b.lot.minZ), (b.lot.maxX - b.lot.minX) * PX, (b.lot.maxZ - b.lot.minZ) * PX);
    ctx.fillStyle = d.color + '38';
    ctx.fillRect(toMap(b.lot.minX), toMap(b.lot.minZ), (b.lot.maxX - b.lot.minX) * PX, (b.lot.maxZ - b.lot.minZ) * PX);
  }
  ctx.fillStyle = '#d8dce2';
  for (const g of GRID) {
    ctx.fillRect(toMap(g - ROAD_HALF), toMap(GRID[0] - ROAD_HALF), ROAD_HALF * 2 * PX, (GRID[8] - GRID[0] + ROAD_HALF * 2) * PX);
    ctx.fillRect(toMap(GRID[0] - ROAD_HALF), toMap(g - ROAD_HALF), (GRID[8] - GRID[0] + ROAD_HALF * 2) * PX, ROAD_HALF * 2 * PX);
  }
  // Container rows.
  ctx.fillStyle = '#8a5a3a';
  for (const x of [331, 336.5, 342]) ctx.fillRect(toMap(x - 2.6), toMap(-350), 5.2 * PX, 590 * PX);
  return c;
}

export class Minimap {
  constructor(canvas, bigCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.big = bigCanvas;
    this.map = paintMap();
    this.zoom = 1.25;         // minimap pixels per map pixel
    this.time = 0;
  }

  draw(dt, state) {
    this.time += dt;
    const { ctx, canvas } = this;
    const W = canvas.width, R = W / 2;
    const { px, pz, yaw, heading, speed } = state;
    const zoom = this.zoom * (1 - Math.min(0.45, (speed || 0) / 90));
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(R, R, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#16303c'; ctx.fillRect(0, 0, W, W);
    ctx.translate(R, R);
    ctx.rotate(Math.PI + yaw);
    ctx.scale(zoom, zoom);
    ctx.translate(-toMap(px), -toMap(pz));
    ctx.drawImage(this.map, 0, 0);
    const s = 1 / zoom;

    if (state.searchZone) {
      const z = state.searchZone;
      ctx.fillStyle = `rgba(80,140,255,${0.18 + 0.08 * Math.sin(this.time * 6)})`;
      ctx.beginPath(); ctx.arc(toMap(z.x), toMap(z.z), z.r * PX, 0, Math.PI * 2); ctx.fill();
    }
    if (state.route) {
      ctx.strokeStyle = 'rgba(255,200,64,0.85)'; ctx.lineWidth = 5 * s; ctx.setLineDash([9 * s, 6 * s]);
      ctx.beginPath(); ctx.moveTo(toMap(px), toMap(pz)); for (const p of state.route) ctx.lineTo(toMap(p.x), toMap(p.z)); ctx.stroke();
      ctx.setLineDash([]);
    }
    const blip = (x, z, color, r = 5, shape = 'dot') => {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      if (shape === 'square') ctx.rect(toMap(x) - r * s, toMap(z) - r * s, r * 2 * s, r * 2 * s);
      else ctx.arc(toMap(x), toMap(z), r * s, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    };
    for (const a of state.activities || []) blip(a.x, a.z, a.color, 5, 'square');
    for (const v of state.police || []) blip(v.x, v.z, Math.sin(this.time * 10) > 0 ? '#ff3a3a' : '#3a7aff', 5);
    for (const e of state.enemies || []) blip(e.x, e.z, '#ff4040', 4);
    if (state.heli) { blip(state.heli.x, state.heli.z, '#9fd0ff', 7); }
    ctx.restore();

    // Objective marker, clamped to the rim when off-map.
    if (state.objective) {
      const o = state.objective;
      const rel = this.project(o.x - px, o.z - pz, yaw, zoom);
      const d = Math.hypot(rel.x, rel.y), lim = R - 12;
      const k = d > lim ? lim / d : 1;
      const x = R + rel.x * k, y = R + rel.y * k;
      ctx.fillStyle = o.kind === 'enemy' ? '#ff4a3a' : o.kind === 'vehicle' ? '#40c0ff' : '#ffc040';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.kind === 'mission' ? '!' : '★', x, y + 0.5);
    }
    // Player arrow (points along the player's heading relative to the camera).
    ctx.save();
    ctx.translate(R, R);
    ctx.rotate(-(heading - yaw));
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // North marker on the rim.
    const n = this.project(0, -1000, yaw, 1);
    const nd = Math.hypot(n.x, n.y);
    ctx.fillStyle = '#ffc35a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('U', R + n.x / nd * (R - 11), R + n.y / nd * (R - 11));
  }

  // World offset -> minimap pixel offset.
  project(dx, dz, yaw, zoom) {
    const a = Math.PI + yaw;
    const x = dx * PX * zoom, y = dz * PX * zoom;
    return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
  }

  drawBig(state) {
    const c = this.big, ctx = c.getContext('2d');
    ctx.drawImage(this.map, 0, 0, c.width, c.height);
    const k = c.width / this.map.width;
    const P = (x, z) => [toMap(x) * k, toMap(z) * k];
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    for (const [id, d] of Object.entries(DISTRICTS)) {
      const b = BLOCKS.filter((bl) => bl.district === id);
      if (!b.length) continue;
      const cx = b.reduce((s, q) => s + q.cx, 0) / b.length, cz = b.reduce((s, q) => s + q.cz, 0) / b.length;
      const [x, y] = P(cx, cz);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(d.name.toUpperCase(), x + 1, y + 1);
      ctx.fillStyle = d.color; ctx.fillText(d.name.toUpperCase(), x, y);
    }
    ctx.font = '12px sans-serif';
    for (const a of state.activities || []) {
      const [x, y] = P(a.x, a.z);
      ctx.fillStyle = a.color; ctx.fillRect(x - 6, y - 6, 12, 12);
      ctx.fillStyle = '#fff'; ctx.fillText(a.name, x, y - 10);
    }
    if (state.objective) { const [x, y] = P(state.objective.x, state.objective.z); ctx.fillStyle = '#ffc040'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
    const [x, y] = P(state.px, state.pz);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    void PLACES;
  }
}
