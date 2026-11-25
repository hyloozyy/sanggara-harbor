// The buildings Raka can walk into, shared by the door builder, the minimap, the city map, the
// help screen and the beacons over the doors: one colour and one letter per place, and the
// "house badge" icon every one of them uses (a little house with an open, lit door) so they read
// as "you can go in here" at a glance, distinct from the square activity blips.
import { PLACES, DISTRICTS, districtAt } from '../city/city-layout.js';

export const ENTERABLE = [
  { id: 'bar', label: 'Kafe Jangkar', kind: 'Bar', place: 'bar', color: '#ff5aa0', glyph: 'B', what: 'drinks, jukebox, pool' },
  { id: 'home', label: "Raka's Room", kind: 'Home', place: 'safehouse', color: '#60ff80', glyph: 'H', what: 'sleep & save, cook, TV' },
  { id: 'shop', label: 'Toko Berkah', kind: 'Shop', place: 'tokoBerkah', color: '#ffe060', glyph: 'S', what: 'food and drink' },
  { id: 'clinic', label: 'Klinik Sehat', kind: 'Clinic', place: 'clinic', color: '#5affc8', glyph: 'K', what: 'get patched up' },
];
export const ENTERABLE_BY_ID = Object.fromEntries(ENTERABLE.map((e) => [e.id, e]));
export const ENTERABLE_BY_PLACE = Object.fromEntries(ENTERABLE.map((e) => [e.place, e]));

export function enterableDistrict(e) {
  const p = PLACES[e.place];
  return DISTRICTS[districtAt(p.x, p.z)]?.name || '';
}

// Where the icon goes: the door on the facade once the interiors are built, else the place.
export function enterablePoint(e, game) {
  const d = game?.interiors?.doors?.find((q) => q.def.id === e.id);
  if (d) return { x: d.x + d.nx * 1.2, z: d.z + d.nz * 1.2 };
  return PLACES[e.place];
}

// House badge centred on (x, y); r is the half width in pixels.
export function drawEnterableIcon(g, x, y, r, color, glyph, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  // Soft glow so it pops out of the busy map.
  g.fillStyle = color + '55';
  g.beginPath(); g.arc(0, 0, r * 1.45, 0, Math.PI * 2); g.fill();
  // House: roof peak, eaves, walls.
  g.beginPath();
  g.moveTo(0, -r * 1.12);
  g.lineTo(r * 1.08, -r * 0.12); g.lineTo(r * 0.82, -r * 0.12);
  g.lineTo(r * 0.82, r * 0.95); g.lineTo(-r * 0.82, r * 0.95);
  g.lineTo(-r * 0.82, -r * 0.12); g.lineTo(-r * 1.08, -r * 0.12);
  g.closePath();
  g.fillStyle = color; g.fill();
  g.lineWidth = Math.max(1.2, r * 0.2); g.strokeStyle = '#0b0d12'; g.lineJoin = 'round'; g.stroke();
  // Lit doorway with the letter on it.
  g.fillStyle = '#1a1206';
  g.fillRect(-r * 0.42, -r * 0.05, r * 0.84, r * 1.0);
  g.fillStyle = '#ffe2a0';
  g.font = `bold ${Math.round(r * 0.95)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(glyph, 0, r * 0.47);
  g.restore();
}

// A small data URL of the badge for HTML legends.
let legendCache = null;
export function enterableLegendIcon() {
  if (legendCache) return legendCache;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  drawEnterableIcon(c.getContext('2d'), 16, 17, 10, '#ffb070', '');
  legendCache = c.toDataURL();
  return legendCache;
}
