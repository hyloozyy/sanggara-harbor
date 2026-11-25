// Builds every vehicle mesh. A four-wheeler is a smooth parametric body (car-body.js) in
// clearcoat factory paint, with flush tinted glass and a visible interior (headliner, seats,
// dashboard, steering wheel), gloss-black window frames and pillars, door seams and handles,
// body-coloured mirrors, a patterned grille, projector headlamps with LED daytime strips,
// red tail lamps behind clear lenses, plates, exhausts, wipers and wheel-arch liners, on alloy
// (or steel) wheels with treaded tyres, brake discs and calipers. Police, taxi, ambulance and
// angkot keep their liveries and roof equipment.
//
// Everything is built ONCE per model and level of detail and shared by every car of that
// model; a car only owns small Mesh objects, its paint is a shared material per colour, and its
// body geometry is copied only when it gets dented. Per car: about a dozen draw calls.
// Two- and three-wheelers come from bike-mesh.js.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { makeCanvas, toTexture } from '../assets/canvas-tools.js';
import { BodySurface, tessellate, K, KV } from './car-body.js';
import { ribbon, patch, endQuad, endDisc, joinRaw } from './car-surface-tools.js';
import { CAR_DESIGNS } from './car-designs.js';
import { carPaint } from './car-paint.js';
import { PartList, FIN, multiMaterial, rawGeometry, roundBox, cylGeo, torusGeo, tubeGeo, ellipseLoft, mat4, wheelGeometry, caliperGeometry, mirrorX } from './car-parts.js';
import { buildTwoWheeler, buildBajaj } from './bike-mesh.js';

const LOD_FAR = 30;

// ------------------------------------------------------------------ materials & textures
let M = null;
function materials() {
  if (M) return M;
  const label = (lines, bg, fg, w = 512, h = 128, opts = {}) => {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    if (opts.stripes) for (const [col, y0, y1] of opts.stripes) { x.fillStyle = col; x.fillRect(0, h * y0, w, h * (y1 - y0)); }
    if (opts.checker) { const s = h * 0.16; for (let i = 0; i * s < w; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? opts.checker[0] : opts.checker[1]; x.fillRect(i * s, h * opts.checkerY + j * s, s, s); } }
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [text, size, y, font = 'bold'] of lines) { x.font = `${font} ${Math.round(h * size)}px "Trebuchet MS", "DejaVu Sans", sans-serif`; x.fillText(text, w / 2, h * y); }
    if (opts.border) { x.strokeStyle = opts.border; x.lineWidth = h * 0.06; x.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1); }
    return toTexture(c, { repeat: false });
  };
  const decal = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.3, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false, ...extra });
  const plateTex = label([['SG 4417 RK', 0.56, 0.47], ['04 · 29', 0.17, 0.86, 'normal']], '#111214', '#f2f2ee', 256, 64, { border: '#d8d8d4' });
  M = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0b1116, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.58, envMapIntensity: 1.9, specularIntensity: 1, depthWrite: false }),
    glassFar: new THREE.MeshStandardMaterial({ color: 0x0c1218, metalness: 0.4, roughness: 0.08, envMapIntensity: 1.6 }),
    lens: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 2.2, depthWrite: false }),
    plate: new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.35, metalness: 0.2 }),
    police: decal(label([['POLICE', 0.42, 0.42], ['SANGGARA · 110', 0.13, 0.78]], null, '#13307e', 512, 128, { stripes: [['rgba(20,48,140,0.95)', 0.0, 0.08], ['rgba(242,194,48,0.95)', 0.08, 0.14]] })),
    tactical: decal(label([['POLICE TACTICAL UNIT', 0.3, 0.45]], null, '#f2c230', 512, 128, { stripes: [['rgba(242,194,48,0.95)', 0.82, 0.9]] })),
    ambulance: decal(label([['AMBULANCE', 0.36, 0.4], ['RS SANGGARA 118', 0.12, 0.74]], null, '#c81e1e', 512, 128, { checker: ['#c81e1e', 'rgba(255,255,255,0)'], checkerY: 0.0 })),
    taxiDoor: decal(label([['OMBAK TAXI', 0.46, 0.5]], null, '#f2c230', 512, 96)),
    angkotStripe: decal(label([['KOTA LAMA · PASAR IKAN · 04', 0.5, 0.5]], 'rgba(255,255,255,0.92)', '#1b1b1b', 1024, 64)),
    truck: decal(label([['KERBAU EXPRESS', 0.36, 0.42], ['logistik pelabuhan · sejak 1987', 0.12, 0.66, 'normal']], null, '#b02a1a', 1024, 256, { stripes: [['rgba(28,74,138,0.95)', 0.8, 0.9]] })),
    taxiSign: (() => { const t = label([['TAXI', 0.62, 0.52]], '#f2c230', '#1a1a1a', 256, 96); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.4 }); })(),
    route: (() => { const t = label([['04  KOTA LAMA - PASAR IKAN', 0.36, 0.52]], '#101010', '#ffd24a', 640, 96); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.1 }); })(),
    lightbarClear: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25, depthWrite: false }),
  };
  return M;
}

// ------------------------------------------------------------------ design scaling
export function scaledDesign(spec) {
  const d = CAR_DESIGNS[spec.design || spec.key];
  const fl = d.flare ?? 0.022;
  const maxW = Math.max(...d.stations.map((s) => s.w + (s.bulge ?? 0.03)));
  const maxT = Math.max(...d.stations.map((s) => s.top)) + 0.04;
  const kx = (spec.width / 2 - fl) / maxW, ky = spec.height / maxT;
  const stations = d.stations.map((s) => ({ ...s, w: s.w * kx, wt: s.wt * kx, bulge: (s.bulge ?? 0.03) * kx, bot: s.bot * ky, belt: s.belt * ky, top: s.top * ky }));
  const hw = spec.width / 2 - fl;
  const q = (quad) => quad && quad.map(([x, y]) => [x * hw, y * ky]);
  const scaleLamp = (l) => l && { ...l, quad: q(l.quad) };
  return {
    ...d, stations, kx, ky, hw,
    head: scaleLamp(d.head), tail: scaleLamp(d.tail), grille: scaleLamp(d.grille), intake: scaleLamp(d.intake),
    fog: d.fog && { x: d.fog.x * hw, y: d.fog.y * ky, r: d.fog.r },
    plateF: d.plateF * ky, plateR: d.plateR * ky, diffuser: d.diffuser && d.diffuser * ky,
    arches: [{ z: spec.wheelbase / 2, r: spec.wheelRadius + 0.07, y: spec.wheelRadius, flare: fl }, { z: -spec.wheelbase / 2, r: spec.wheelRadius + 0.07, y: spec.wheelRadius, flare: fl }],
  };
}

// ------------------------------------------------------------------ grid lines & regions
export function bodyLayout(D, surf) {
  const g = D.glass, lines = [];
  const C = (name, u, soft = false) => lines.push({ name, f: () => u, soft, u });
  const lerpV = (a, b) => (v) => (v <= KV.win0 ? a : v >= KV.win1 ? b : a + (b - a) * (v - KV.win0) / (KV.win1 - KV.win0));
  const cap = surf.capU;
  C('tailEnd', -0.5 - cap); C('noseEnd', 0.5 + cap);
  for (const t of [0.12, 0.25, 0.38, 0.5, 0.62, 0.78, 0.9]) { C(`tc${t}`, -0.5 - cap * t, true); C(`nc${t}`, 0.5 + cap * t, true); }
  C('tail0', -0.5); C('nose0', 0.5);
  C('cowl', g.cowl); C('roofF', g.roofF);
  const hasRear = g.roofR != null && g.deck != null && g.roofR - g.deck > 0.003;
  if (hasRear) { C('roofR', g.roofR); C('deck', g.deck); }
  lines.push({ name: 'dF', f: lerpV(g.dlo.f[0], g.dlo.f[1]), lo: Math.min(...g.dlo.f), hi: Math.max(...g.dlo.f) });
  lines.push({ name: 'dR', f: lerpV(g.dlo.r[0], g.dlo.r[1]), lo: Math.min(...g.dlo.r), hi: Math.max(...g.dlo.r) });
  const pillars = [...g.pillars].sort((a, b) => a[0] - b[0]);
  pillars.forEach(([b, t, hw], i) => {
    lines.push({ name: `p${i}a`, f: lerpV(b - hw, t - hw), lo: Math.min(b, t) - hw, hi: Math.max(b, t) - hw });
    lines.push({ name: `p${i}b`, f: lerpV(b + hw, t + hw), lo: Math.min(b, t) + hw, hi: Math.max(b, t) + hw });
  });
  if (D.bed) { C('bedR', D.bed[0]); C('bedF', D.bed[1]); }
  // Dense columns around the wheel arches (sin spacing bunches them at the steep edges).
  for (const a of D.arches) {
    for (let k = -6; k <= 6; k++) C(`arch${a.z}:${k}`, (a.z + a.r * Math.sin((k / 6) * Math.PI / 2) * 0.999 - surf.zMid) / surf.bodyL, true);
    for (const e of [-1.12, 1.12]) C(`archE${a.z}:${e}`, (a.z + a.r * e - surf.zMid) / surf.bodyL, true);
  }
  // Drop soft lines that would cross a leaning line or crowd another line.
  const hard = lines.filter((l) => !l.soft);
  const keep = lines.filter((l) => {
    if (!l.soft) return true;
    if (Math.abs(l.u) > 0.5 + cap) return false;
    for (const h of hard) {
      const lo = h.lo ?? h.u, hi = h.hi ?? h.u;
      if (l.u > lo - 0.004 && l.u < hi + 0.004) return false;
    }
    return true;
  });
  const regions = [{ cls: 'trim', from: 'tail0', to: 'nose0', v0: 0, v1: 2 }];
  regions.push({ cls: 'glass', from: 'roofF', to: 'cowl', v0: KV.rail, v1: 99 });
  if (hasRear) regions.push({ cls: 'glass', from: 'deck', to: 'roofR', v0: KV.rail, v1: 99 });
  if (D.bed) regions.push({ cls: 'hole', from: 'bedR', to: 'bedF', v0: KV.glass0, v1: 99 });
  const seq = ['dR', ...pillars.flatMap((_, i) => [`p${i}a`, `p${i}b`]), 'dF'];
  for (let i = 0; i < seq.length; i += 2) regions.push({ cls: 'glass', from: seq[i], to: seq[i + 1], v0: KV.win0, v1: KV.win1 });
  return { lines: keep, regions, pillars, hasRear, windows: seq };
}

// ------------------------------------------------------------------ helpers
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
// A matrix placing a part on the surface at (u, v): x along the outward normal, z along the car.
function onSurface(surf, u, v, off = 0, extra = null) {
  const p = V3(surf.point(u, v)), n = V3(surf.normal(u, v));
  const fwd = new THREE.Vector3(0, 0, 1).addScaledVector(n, -n.z).normalize();
  const up = new THREE.Vector3().crossVectors(fwd, n).normalize();
  if (n.x < 0) up.negate();
  const m = new THREE.Matrix4().makeBasis(n, up, fwd).setPosition(p.addScaledVector(n, off));
  if (extra) m.multiply(extra);
  return m;
}
const addRaw = (list, raw, fin) => { if (raw.points.length) list.addRaw(raw.points, raw.normals, raw.tris, fin); };

// Merge built geometries that carry the multi-material attributes.
function mergeBuilt(items) {
  const L = new PartList();
  for (const { geo, matrix } of items) {
    const base = L.count, p = geo.attributes.position, n = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3(), w = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      L.pos.push(v.x, v.y, v.z); L.nor.push(w.x, w.y, w.z);
      L.uv.push(geo.attributes.uv.getX(i), geo.attributes.uv.getY(i));
      L.col.push(geo.attributes.color.getX(i), geo.attributes.color.getY(i), geo.attributes.color.getZ(i));
      L.rm.push(geo.attributes.rm.getX(i), geo.attributes.rm.getY(i));
    }
    const ix = geo.index.array, flip = matrix.determinant() < 0;
    for (let i = 0; i < ix.length; i += 3) flip ? L.idx.push(base + ix[i], base + ix[i + 2], base + ix[i + 1]) : L.idx.push(base + ix[i], base + ix[i + 1], base + ix[i + 2]);
  }
  return L.build();
}

// ------------------------------------------------------------------ template
const templates = new Map();
function template(spec, lod) {
  const key = `${spec.key}:${lod}`;
  if (!templates.has(key)) templates.set(key, buildTemplate(spec, lod));
  return templates.get(key);
}

function buildTemplate(spec, lod) {
  const hi = lod === 0;
  const L = spec.length, W = spec.width, wb = spec.wheelbase, wr = spec.wheelRadius;
  const tw = spec.tyreWidth ?? (spec.heavy ? 0.28 : 0.235);
  const D = scaledDesign(spec);
  const surf = new BodySurface(D, L);
  const lay = bodyLayout(D, surf);
  const g = D.glass;
  const grid = tessellate(surf, lay.lines, lay.regions, hi ? { target: 0.095, rowSegs: [1, 2, 2, 2, 3, 3, 2, 2, 1, 3, 1, 2, 3] } : { target: 0.24, rowSegs: [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2] });
  const pp = new PartList();   // extra painted parts
  const mp = new PartList();   // everything else in the multi material
  const st = (u) => surf.station(u);
  const zOf = (u) => surf.zOf(u);
  const frontZ = (x, y) => surf.endPoint(x, y, 1)?.p.z ?? L / 2;
  const rearZ = (x, y) => surf.endPoint(x, y, -1)?.p.z ?? -L / 2;
  const lerpV = (a, b, v) => (v <= KV.win0 ? a : v >= KV.win1 ? b : a + (b - a) * (v - KV.win0) / (KV.win1 - KV.win0));
  const dF = (v) => lerpV(g.dlo.f[0], g.dlo.f[1], v), dR = (v) => lerpV(g.dlo.r[0], g.dlo.r[1], v);

  // ---------------- glazing frames, pillars, seams
  const frameFin = D.chromeDLO ? 'chrome' : 'gloss';
  {
    // Side daylight opening outline and pillar blackouts.
    const v0 = KV.win0, v1 = KV.win1;
    const outline = [[dR(v0), v0], [dF(v0), v0], [dF(v1), v1], [dR(v1), v1]];
    addRaw(mp, ribbon(surf, outline, hi ? 0.032 : 0.04, 0.0025, { closed: true }), frameFin);
    if (D.chromeDLO) addRaw(mp, ribbon(surf, outline, 0.012, 0.004, { closed: true }), 'gloss');
    for (const [b, t, hw] of lay.pillars) {
      addRaw(mp, patch(surf, (v) => lerpV(b - hw, t - hw, v) - 0.004, (v) => lerpV(b + hw, t + hw, v) + 0.004, v0 - 0.4, v1 + 0.5, 0.002, { nu: 2, nv: hi ? 4 : 2 }), 'gloss');
    }
    // Windscreen and rear glass black frit bands.
    const across = (u0, u1) => [[u0, KV.rail], [u1, KV.rail], [u1, K], [u1, 2 * K - KV.rail], [u0, 2 * K - KV.rail], [u0, K]];
    addRaw(mp, ribbon(surf, across(Math.min(g.cowl, 0.5 - 0.004), g.roofF), 0.045, 0.0025, { closed: true, mirror: false }), 'gloss');
    if (lay.hasRear) addRaw(mp, ribbon(surf, across(Math.max(g.deck, -0.5 + 0.004), g.roofR), 0.04, 0.0025, { closed: true, mirror: false }), 'gloss');
    // A-pillars dark between the windscreen and the side glass.
    addRaw(mp, patch(surf, (v) => g.roofF, (v) => dF(v) + 0.003, KV.win1, KV.rail + 0.15, 0.0018, { nu: 3, nv: 2 }), 'gloss');
  }
  if (hi) {
    // Door shut lines and handles.
    const doors = D.doors || [];
    for (const u of doors) addRaw(mp, ribbon(surf, [[u, KV.sill + 0.5], [u, KV.glass0 - 0.1]], 0.0055, 0.0012), 'gloss');
    for (let i = 0; i < doors.length - 1; i++) {
      const u = doors[i + 1] + 0.055, y = st(u).belt - 0.09 * D.ky;
      const v = surf.vAtY(u, y, KV.rocker, KV.deck);
      for (const side of [1, -1]) {
        const vv = side > 0 ? v : 2 * K - v;
        const m = onSurface(surf, u, vv, 0.012);
        (D.chromeDLO ? mp : pp).add(roundBox(0.026, 0.034, 0.17, 0.012), D.chromeDLO ? 'chrome' : FIN.gloss, m);
        mp.add(roundBox(0.012, 0.05, 0.2, 0.012), 'gloss', onSurface(surf, u, vv, 0.0));
      }
    }
    // Bonnet and boot shut lines.
    const uh = 0.5 - 0.035;
    addRaw(mp, ribbon(surf, [[uh, KV.shoulder + 0.4], [uh, K], [uh, 2 * K - KV.shoulder - 0.4]], 0.005, 0.0012, { mirror: false }), 'gloss');
    addRaw(mp, ribbon(surf, [[uh, KV.deck + 0.6], [g.cowl - 0.01, KV.deck + 0.6]], 0.005, 0.0012), 'gloss');
    if (lay.hasRear && g.deck > -0.45) {
      const ub = -0.47;
      addRaw(mp, ribbon(surf, [[ub, KV.shoulder + 0.5], [ub, K], [ub, 2 * K - KV.shoulder - 0.5]], 0.005, 0.0012, { mirror: false }), 'gloss');
      addRaw(mp, ribbon(surf, [[ub, KV.deck + 0.6], [g.deck + 0.01, KV.deck + 0.6]], 0.005, 0.0012), 'gloss');
    }
    // Wipers parked at the base of the windscreen.
    const uw = g.cowl - 0.012;
    for (const [a, b] of [[KV.rail + 0.7, K + 0.9], [K + 0.25, 2 * K - KV.rail - 0.6]]) {
      addRaw(mp, ribbon(surf, [[uw, a], [uw - 0.012, (a + b) / 2], [uw - 0.004, b]], 0.016, 0.014, { mirror: false }), 'gloss');
    }
  }
  // Mirrors on the doors just behind the A-pillar.
  if (D.mirror != null) {
    const u = D.mirror, s = st(u);
    for (const side of [1, -1]) {
      const v = KV.glass0 + 0.3, p = surf.point(u, side > 0 ? v : 2 * K - v);
      const x = p[0] + side * 0.085, y = p[1] + 0.07 * D.ky, z = p[2];
      pp.add(ellipseLoft([[-0.05, 0, 0.003, 0.003], [-0.042, 0, 0.075, 0.045], [-0.01, 0, 0.1, 0.058], [0.025, 0, 0.09, 0.05], [0.045, 0, 0.04, 0.025], [0.05, 0, 0.003, 0.003]], hi ? 14 : 8, { power: 2.4 }), FIN.gloss, mat4(x, y, z, 0, 0, 0));
      mp.add(roundBox(0.17, 0.09, 0.008, 0.02), 'mirror', mat4(x, y, z - 0.047));
      mp.add(roundBox(0.08, 0.045, 0.06, 0.015), 'gloss', mat4(p[0] + side * 0.02, y - 0.035, z + 0.01));
      void s;
    }
  }

  // ---------------- nose: grille, intake, lamps, fog lamps, plate
  const raws = { head: [], tail: [], lens: [], plate: [] };
  const n = hi ? 1 : 0.5;
  const res = (a, b) => ({ nx: Math.max(2, Math.round(a * n)), ny: Math.max(1, Math.round(b * n)) });
  const frameQuad = (q, dir, fin, off, t = 0.06) => {
    for (const r of [[0, 1, 0, t], [0, 1, 1 - t, 1], [0, t * 0.4, 0, 1], [1 - t * 0.4, 1, 0, 1]]) addRaw(mp, endQuad(surf, q, dir, off, { ...res(10, 1), mirror: false, sub: r }), fin);
  };
  if (D.grille) {
    const q = D.grille.quad;
    addRaw(mp, endQuad(surf, q, 1, 0.003, { ...res(10, 4), mirror: false }), 'mesh');
    const style = D.grille.style;
    if (style === 'mesh') {
      for (let i = 1; i < 6; i++) addRaw(mp, endQuad(surf, q, 1, 0.007, { ...res(10, 1), mirror: false, sub: [0, 1, i / 6 - 0.03, i / 6 + 0.03] }), 'darkAlloy');
      if (hi) for (let i = 1; i < 12; i++) addRaw(mp, endQuad(surf, q, 1, 0.006, { nx: 1, ny: 3, mirror: false, sub: [i / 12 - 0.012, i / 12 + 0.012, 0, 1] }), 'darkAlloy');
    } else if (style === 'bars') {
      for (let i = 1; i < 5; i++) addRaw(mp, endQuad(surf, q, 1, 0.009, { ...res(10, 1), mirror: false, sub: [0, 1, i / 5 - 0.045, i / 5 + 0.045] }), D.grille.frame === 'chrome' ? 'chrome' : 'gloss');
    } else {
      for (let i = 1; i < 7; i++) addRaw(mp, endQuad(surf, q, 1, 0.008, { ...res(10, 1), mirror: false, sub: [0, 1, i / 7 - 0.04, i / 7 + 0.04] }), 'gloss');
    }
    frameQuad(q, 1, D.grille.frame === 'chrome' ? 'chrome' : 'gloss', 0.011);
  }
  if (D.intake) {
    const q = D.intake.quad;
    addRaw(mp, endQuad(surf, q, 1, 0.003, { ...res(10, 3), mirror: !!D.intake.side }), 'mesh');
    if (hi) for (let i = 1; i < 4; i++) addRaw(mp, endQuad(surf, q, 1, 0.006, { ...res(10, 1), mirror: !!D.intake.side, sub: [0, 1, i / 4 - 0.05, i / 4 + 0.05] }), 'trim');
  }
  if (D.fog) {
    addRaw(mp, endDisc(surf, D.fog.x, D.fog.y, D.fog.r + 0.02, 1, 0.004, { seg: hi ? 16 : 8 }), 'gloss');
    addRaw(mp, endDisc(surf, D.fog.x, D.fog.y, D.fog.r, 1, 0.008, { seg: hi ? 16 : 8 }), 'reflector');
  }
  if (D.skidPlate) addRaw(mp, endQuad(surf, [[-0.4 * D.hw, 0.5 * D.ky], [0.4 * D.hw, 0.5 * D.ky], [0.36 * D.hw, 0.44 * D.ky], [-0.36 * D.hw, 0.44 * D.ky]], 1, 0.007, { ...res(8, 1), mirror: false }), 'steel');
  // Headlamps: housing, projector lenses and a daytime-running LED strip (glowing), clear cover.
  const hd = D.head;
  const mirrorQ = (q) => q.map(([x, y]) => [-x, y]);
  const headSide = [];
  for (const side of [1, -1]) {
    const q = side > 0 ? hd.quad : mirrorQ(hd.quad);
    addRaw(mp, endQuad(surf, q, 1, 0.004, { ...res(10, 4), mirror: false }), 'lampInner');
    const glow = [];
    const np = hd.projectors ?? 2;
    for (let i = 0; i < np; i++) {
      const a = np === 1 ? 0.62 : 0.3 + 0.55 * i / (np - 1), b = hd.round ? 0.5 : 0.45;
      const top = [q[0][0] + (q[1][0] - q[0][0]) * a, q[0][1] + (q[1][1] - q[0][1]) * a];
      const bot = [q[3][0] + (q[2][0] - q[3][0]) * a, q[3][1] + (q[2][1] - q[3][1]) * a];
      const cx = top[0] + (bot[0] - top[0]) * b, cy = top[1] + (bot[1] - top[1]) * b;
      const r = hd.round ? Math.abs(top[1] - bot[1]) * 0.42 : Math.min(0.038, Math.abs(top[1] - bot[1]) * 0.36);
      addRaw(mp, endDisc(surf, cx, cy, r * 1.35, 1, 0.006, { seg: hi ? 16 : 8, mirror: false }), 'reflector');
      glow.push(endDisc(surf, cx, cy, r, 1, 0.009, { seg: hi ? 16 : 8, mirror: false }));
    }
    if (hd.drl === 'top') glow.push(endQuad(surf, q, 1, 0.008, { ...res(12, 1), mirror: false, sub: [0.04, 0.97, 0.06, 0.2] }));
    else if (hd.drl === 'bottom') glow.push(endQuad(surf, q, 1, 0.008, { ...res(12, 1), mirror: false, sub: [0.04, 0.97, 0.8, 0.94] }));
    headSide.push(joinRaw(...glow));
    raws.lens.push(endQuad(surf, q, 1, 0.013, { ...res(10, 4), mirror: false }));
    // Amber indicator under the outer end of the lamp.
    const ox = q[1][0], oy = Math.min(q[1][1], q[2][1]);
    const ix0 = ox - side * 0.05;
    const iq = [[ix0 - side * 0.11, oy - 0.03], [ix0, oy - 0.03], [ix0 - side * 0.01, oy - 0.06], [ix0 - side * 0.11, oy - 0.06]];
    addRaw(mp, endQuad(surf, iq, 1, 0.005, { nx: 3, ny: 1, mirror: false }), 'amber');
  }
  // Tail lamps (glowing red; brighter when braking) with LED segments, reverse lights and cover.
  const tl = D.tail;
  raws.tail.push(endQuad(surf, tl.quad, -1, 0.004, { ...res(12, 4), mirror: true }));
  if (hi) for (let i = 1; i < 4; i++) addRaw(mp, endQuad(surf, tl.quad, -1, 0.007, { nx: 12, ny: 1, mirror: true, sub: [0, 1, i / 4 - 0.035, i / 4 + 0.035] }), 'redLens');
  addRaw(mp, endQuad(surf, tl.quad, -1, 0.008, { nx: 3, ny: 2, mirror: true, sub: tl.bar ? [0.02, 0.12, 0.25, 0.75] : [0.02, 0.22, 0.3, 0.7] }), 'reverse');
  raws.lens.push(endQuad(surf, tl.quad, -1, 0.012, { ...res(12, 4), mirror: true }));
  // Number plates and their recess.
  const pw = 0.26, ph = 0.06;
  const plateQ = (y) => [[-pw, y + ph], [pw, y + ph], [pw, y - ph], [-pw, y - ph]];
  raws.plate.push(endQuad(surf, plateQ(D.plateF), 1, 0.012, { nx: 6, ny: 1, mirror: false }));
  raws.plate.push(endQuad(surf, plateQ(D.plateR), -1, 0.012, { nx: 6, ny: 1, mirror: false }));
  addRaw(mp, endQuad(surf, [[-pw - 0.02, D.plateR + ph + 0.02], [pw + 0.02, D.plateR + ph + 0.02], [pw + 0.02, D.plateR - ph - 0.02], [-pw - 0.02, D.plateR - ph - 0.02]], -1, 0.004, { nx: 6, ny: 1, mirror: false }), 'trim');
  // Rear diffuser, reflectors and exhaust tips.
  if (D.diffuser) {
    const y = D.diffuser;
    addRaw(mp, endQuad(surf, [[-0.72 * D.hw, y + 0.05], [0.72 * D.hw, y + 0.05], [0.76 * D.hw, y - 0.06], [-0.76 * D.hw, y - 0.06]], -1, 0.004, { ...res(12, 2), mirror: false }), 'trim');
    addRaw(mp, endQuad(surf, [[0.8 * D.hw, y + 0.06], [0.92 * D.hw, y + 0.06], [0.92 * D.hw, y + 0.03], [0.8 * D.hw, y + 0.03]], -1, 0.006, { nx: 2, ny: 1 }), 'redLens');
  }
  for (const ex of D.exhaust || []) {
    const x = ex * D.hw, y = Math.max((D.diffuser ?? 0.34 * D.ky) - 0.02, st(-0.49).bot - 0.03);
    const z = Math.max(rearZ(x, y + 0.06), rearZ(x, y + 0.12)) + 0.04;
    const r = D.exhaustBig ? 0.045 : 0.034;
    mp.add(cylGeo(r, r, 0.1, hi ? 14 : 8, true), 'exhaust', mat4(x, y, z - 0.03, Math.PI / 2, 0, 0));
    mp.add(cylGeo(r * 0.8, r * 0.8, 0.012, hi ? 14 : 8), 'gloss', mat4(x, y, z - 0.01, Math.PI / 2, 0, 0));
  }

  if (D.rearBumper) {
    const y = D.rearBumper * D.ky - 0.08, z = rearZ(0, y + 0.1);
    mp.add(roundBox(W * 0.94, 0.13, 0.16, 0.03), 'steel', mat4(0, y, z - 0.02));
    mp.add(roundBox(W * 0.3, 0.02, 0.1, 0.008), 'trim', mat4(0, y + 0.068, z - 0.05));
  }
  // ---------------- wheel arches: liners (and black cladding for SUVs)
  const tx = W / 2 - tw / 2 - 0.035;
  for (const a of D.arches) for (const side of [1, -1]) {
    const inner = tx - tw / 2 - 0.05, outer = W / 2 - 0.01;
    const lin = new THREE.CylinderGeometry(a.r - 0.012, a.r - 0.012, outer - inner, hi ? 20 : 10, 1, true, -0.45, Math.PI + 0.9);
    lin.rotateZ(Math.PI / 2);
    mp.add(lin, 'trim', mat4(side * (inner + outer) / 2, a.y, a.z), { flip: true });
    const disc = new THREE.CircleGeometry(a.r, hi ? 16 : 8, 0, Math.PI);
    mp.add(disc, 'trim', mat4(side * inner, a.y, a.z, 0, side * Math.PI / 2, 0));
  }
  if (D.cladding) {
    for (const a of D.arches) {
      const u0 = (a.z - a.r * 1.08 - surf.zMid) / surf.bodyL, u1 = (a.z + a.r * 1.08 - surf.zMid) / surf.bodyL;
      const path = [];
      for (let i = 0; i <= 14; i++) path.push([u0 + (u1 - u0) * i / 14, KV.sill + 0.35]);
      addRaw(mp, ribbon(surf, path, 0.075, 0.006, { samples: true }), 'trim');
    }
    const [ar, af] = [...D.arches].sort((a, b) => a.z - b.z);
    const ua = (ar.z + ar.r - surf.zMid) / surf.bodyL, ub = (af.z - af.r - surf.zMid) / surf.bodyL;
    addRaw(mp, patch(surf, ua, ub, KV.floor + 0.6, KV.rocker - 0.3, 0.004, { nu: 8, nv: 3 }), 'trim');
  } else if (D.sill) {
    const [ar, af] = [...D.arches].sort((a, b) => a.z - b.z);
    const ua = (ar.z + ar.r - surf.zMid) / surf.bodyL, ub = (af.z - af.r - surf.zMid) / surf.bodyL;
    addRaw(mp, patch(surf, ua + 0.004, ub - 0.004, KV.floor + 0.7, KV.sill - 0.1, 0.002, { nu: 6, nv: 2 }), 'gloss');
  }

  // ---------------- interior: headliner/door cards shell, seats, dashboard, steering wheel
  const seatU = D.seat ?? 0;
  const sSeat = st(seatU);
  const cabinW = sSeat.wt;
  const floorY = sSeat.bot + 0.1;
  const seatY = sSeat.bot + 0.16;
  const seatZ = zOf(seatU);
  let steerGroup = null;
  if (hi) {
    const u0 = Math.max(-0.495, Math.min(g.dlo.r[0], g.dlo.r[1], lay.hasRear ? g.deck : 1, D.bed ? D.bed[1] + 0.02 : 1) - 0.01);
    const u1 = Math.min(0.495, g.cowl + 0.01);
    const vs = [KV.rocker, KV.line, KV.shoulder, KV.deck, KV.glass0, KV.win0, 9.5, KV.win1, KV.rail, 11.5, KV.roof, 12.5, K];
    const ring = [...vs, ...vs.slice(0, -1).reverse().map((v) => 2 * K - v)];
    const nu = 14, pts = [], nors = [], tris = [], fins = [];
    for (let i = 0; i <= nu; i++) {
      const u = u0 + (u1 - u0) * i / nu, c = surf.endCentre(u);
      for (const v of ring) {
        const p = surf.point(u, v), dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1;
        const k = Math.max(0.2, 1 - 0.045 / l);
        pts.push([c[0] + dx * k, Math.max(floorY, c[1] + dy * k), p[2]]);
        nors.push([-dx / l, -dy / l, 0]);
        fins.push(v > KV.rail - 0.01 && v < 2 * K - KV.rail + 0.01 ? 'headliner' : 'interior');
      }
    }
    const R = ring.length;
    for (let i = 0; i < nu; i++) for (let j = 0; j < R; j++) {
      const j2 = (j + 1) % R, a = i * R + j, b = i * R + j2, c = (i + 1) * R + j, d = (i + 1) * R + j2;
      tris.push([a, b, c], [b, d, c]);
    }
    // Inward winding check.
    const e1 = V3(pts[R]).sub(V3(pts[0])), e2 = V3(pts[1]).sub(V3(pts[0]));
    if (e1.cross(e2).dot(V3(nors[0])) < 0) for (const t of tris) { const q = t[1]; t[1] = t[2]; t[2] = q; }
    const base = mp.count;
    mp.addRaw(pts, nors, tris, 'interior');
    fins.forEach((f, i) => { const c = new THREE.Color(FIN[f][0]); mp.col.splice((base + i) * 3, 3, c.r, c.g, c.b); });
    // End bulkheads (dashboard firewall and rear shelf).
    for (const [i, dir] of [[0, -1], [nu, 1]]) {
      const cpts = [], cn = [], ct = [];
      const c = pts.slice(i * R, i * R + R);
      const cx = c.reduce((s, p) => s + p[0], 0) / R, cy = c.reduce((s, p) => s + p[1], 0) / R;
      cpts.push([cx, cy, c[0][2]]); cn.push([0, 0, -dir]);
      c.forEach((p) => { cpts.push(p); cn.push([0, 0, -dir]); });
      for (let j = 0; j < R; j++) ct.push(dir > 0 ? [0, 1 + j, 1 + (j + 1) % R] : [0, 1 + (j + 1) % R, 1 + j]);
      const f1 = V3(cpts[1]).sub(V3(cpts[0])).cross(V3(cpts[2]).sub(V3(cpts[0])));
      if (f1.z * -dir < 0) for (const t of ct) { const q = t[1]; t[1] = t[2]; t[2] = q; }
      mp.addRaw(cpts, cn, ct, 'interior');
    }
    // Seats.
    // Headroom under the glass at z (crown height minus a margin).
    const roofAt = (z) => { const u = Math.max(-0.5, Math.min(0.5, (z - surf.zMid) / surf.bodyL)); return Math.min(surf.point(u, K)[1], surf.point(u, KV.rail)[1] + 0.05) - 0.07; };
    const seat = (x, z, w = 0.5) => {
      const fin = D.seatTan ? 'seatTan' : 'seat';
      const room = Math.min(roofAt(z - 0.3), roofAt(z - 0.4)) - seatY;
      const back = Math.max(0.3, Math.min(0.62, room - 0.18));
      mp.add(roundBox(w, 0.13, 0.5, 0.05), fin, mat4(x, seatY + 0.06, z, -0.06));
      mp.add(roundBox(w, back, 0.13, 0.05), fin, mat4(x, seatY + 0.09 + back / 2, z - 0.27, -0.2));
      if (room > back + 0.2) mp.add(roundBox(w * 0.52, 0.15, 0.1, 0.04), fin, mat4(x, seatY + 0.18 + back, z - 0.33, -0.2));
    };
    const rows = D.rows ?? 2;
    if (rows >= 1) for (const sx of [-1, 1]) seat(sx * cabinW * 0.5, seatZ);
    const bench = (z) => { const s2 = st((z - surf.zMid) / surf.bodyL); seat(0, z, Math.min(1.25, s2.wt * 1.75)); };
    if (rows >= 2) bench(seatZ - 0.88);
    if (rows >= 3) bench(seatZ - 1.68);
    if (D.bench) {
      // Angkot-style side benches facing each other.
      const zb = zOf(Math.min(g.dlo.r[0], 0) * 0.5 - 0.05);
      for (const sx of [-1, 1]) {
        mp.add(roundBox(0.38, 0.12, L * 0.42, 0.04), 'vinyl', mat4(sx * (cabinW - 0.22), seatY + 0.02, zb));
        mp.add(roundBox(0.1, 0.5, L * 0.42, 0.04), 'vinyl', mat4(sx * (cabinW - 0.04), seatY + 0.32, zb));
      }
      for (const sx of [-1, 1]) seat(sx * cabinW * 0.5, seatZ);
    }
    // Dashboard, console and steering wheel.
    const dashZ = Math.min(seatZ + 0.75, zOf(g.cowl) - 0.3);
    const sd = st((dashZ - surf.zMid) / surf.bodyL);
    const dashTop = Math.min(sd.belt + 0.05, roofAt(dashZ + 0.15) - 0.02);
    mp.add(roundBox(sd.wt * 1.85, 0.2, 0.42, 0.08), 'dash', mat4(0, dashTop - 0.1, dashZ, 0.1));
    mp.add(roundBox(0.18, 0.2, 0.62, 0.05), 'dash', mat4(0, floorY + 0.12, seatZ + 0.25));
    const sw = new THREE.Group();
    sw.position.set(-cabinW * 0.5, sSeat.belt + 0.04, seatZ + 0.48);
    sw.rotation.x = -0.42;
    sw.updateMatrix();
    mp.add(torusGeo(0.18, 0.017, 6, 22), 'dash', sw.matrix.clone());
    mp.add(roundBox(0.3, 0.035, 0.03, 0.012), 'dash', sw.matrix.clone());
    mp.add(cylGeo(0.06, 0.06, 0.05, 12), 'dash', sw.matrix.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)));
    mp.add(cylGeo(0.025, 0.025, 0.4, 8), 'dash', sw.matrix.clone().multiply(mat4(0, 0, 0.2, Math.PI / 2, 0, 0)));
    steerGroup = sw;
  }

  // ---------------- model extras
  const roofU = lay.hasRear ? (g.roofF + g.roofR) / 2 : (g.roofF + Math.max(-0.4, g.roofR ?? -0.4)) / 2;
  const roofY = surf.point(roofU, K)[1];
  if (D.roofRails) {
    for (const side of [1, -1]) {
      const pts = [];
      const ua = (g.roofR ?? -0.45) + 0.02, ub = g.roofF - 0.02;
      for (let i = 0; i <= 8; i++) { const u = ua + (ub - ua) * i / 8, p = surf.point(u, side > 0 ? KV.roof - 0.2 : 2 * K - KV.roof + 0.2); pts.push([p[0], p[1] + 0.06, p[2]]); }
      mp.add(tubeGeo(pts, 0.018, hi ? 16 : 6, hi ? 6 : 4), 'darkAlloy');
      for (const i of [0, 8]) mp.add(roundBox(0.04, 0.07, 0.12, 0.015), 'trim', mat4(pts[i][0], pts[i][1] - 0.035, pts[i][2]));
    }
  }
  if (D.spoiler) {
    const ub = lay.hasRear ? Math.max(-0.495, g.deck - 0.16) : -0.49;
    if (D.spoiler === 'lip' || D.spoiler === 'duck') {
      const p = surf.point(ub, K);
      const wing = ellipseLoft([[-W * 0.42, 0, 0.003, 0.003], [-W * 0.4, 0, 0.09, 0.02], [W * 0.4, 0, 0.09, 0.02], [W * 0.42, 0, 0.003, 0.003]], 8);
      pp.add(wing, FIN.gloss, mat4(0, p[1] + (D.spoiler === 'duck' ? 0.03 : 0.06), p[2] - 0.02, 0, Math.PI / 2, 0));
      if (D.spoiler === 'lip') for (const side of [1, -1]) mp.add(roundBox(0.03, 0.07, 0.08, 0.01), 'gloss', mat4(side * W * 0.3, p[1] + 0.025, p[2]));
    }
  }
  if (D.hoodScoop) {
    const u = (g.cowl + 0.5) / 2, p = surf.point(u, K);
    pp.add(ellipseLoft([[-0.32, 0, 0.12, 0.01], [-0.25, 0.02, 0.2, 0.045], [0.1, 0.02, 0.21, 0.05], [0.16, 0.0, 0.18, 0.02]], 14), FIN.gloss, mat4(0, p[1] - 0.01, p[2]));
    mp.add(roundBox(0.3, 0.04, 0.02, 0.01), 'mesh', mat4(0, p[1] + 0.03, p[2] + 0.165));
  }
  if (D.stripes) {
    const segs = [[g.cowl + 0.01, 0.5 + surf.capU * 0.45], [g.roofR + 0.005, g.roofF - 0.005], [-0.5 - surf.capU * 0.45, g.deck - 0.01]];
    for (const [a, b] of segs) addRaw(mp, patch(surf, a, b, K - 0.75, K - 0.3, 0.0016, { nu: hi ? 16 : 6, nv: 1 }), 'white');
  }
  if (D.pushBar) {
    const y0 = 0.42 * D.ky, y1 = 0.78 * D.ky, z = frontZ(0, 0.6 * D.ky) + 0.12;
    for (const side of [1, -1]) {
      mp.add(tubeGeo([[side * 0.28 * W, y0, z - 0.14], [side * 0.3 * W, y0, z], [side * 0.3 * W, y1, z], [side * 0.27 * W, y1 + 0.05, z - 0.12]], 0.025, 10, 6), 'trim');
    }
    for (const y of [y0 + 0.08, y1 - 0.04]) mp.add(cylGeo(0.022, 0.022, W * 0.6, 8), 'trim', mat4(0, y, z, 0, 0, Math.PI / 2));
    mp.add(roundBox(W * 0.5, 0.14, 0.04, 0.02), 'trim', mat4(0, (y0 + y1) / 2, z + 0.01));
  }
  if (D.sideStep) for (const side of [1, -1]) {
    const [ar, af] = [...D.arches].sort((a, b) => a.z - b.z);
    const z0 = ar.z + ar.r + 0.05, z1 = af.z - af.r - 0.05;
    mp.add(roundBox(0.12, 0.04, z1 - z0, 0.015), 'steel', mat4(side * (W / 2 - 0.05), D.stations[2].bot - 0.06, (z0 + z1) / 2));
  }
  if (D.bed) {
    // Load bed: a dark liner tub sunk into the body with steel rails along the tops.
    const [b0, b1] = D.bed, nu = hi ? 10 : 4, pts = [], nors = [], tris = [];
    for (let i = 0; i <= nu; i++) {
      const u = b0 + (b1 - b0) * i / nu, s = st(u);
      const pr = surf.point(u, KV.glass0), pl = surf.point(u, 2 * K - KV.glass0);
      const fy = s.bot + 0.28;
      const ring = [[pr[0] - 0.005, pr[1], pr[2]], [pr[0] - 0.04, fy, pr[2]], [pl[0] + 0.04, fy, pl[2]], [pl[0] + 0.005, pl[1], pl[2]]];
      ring.forEach((p) => pts.push(p));
      nors.push([-1, 0, 0], [0, 1, 0], [0, 1, 0], [1, 0, 0]);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < 3; j++) { const a = i * 4 + j, c = a + 4; tris.push([a, c, a + 1], [a + 1, c, c + 1]); }
    const t0 = tris[0], f0 = V3(pts[t0[1]]).sub(V3(pts[t0[0]])).cross(V3(pts[t0[2]]).sub(V3(pts[t0[0]])));
    if (f0.dot(V3(nors[t0[0]])) < 0) for (const t of tris) { const q = t[1]; t[1] = t[2]; t[2] = q; }
    mp.addRaw(pts, nors, tris, 'bedLiner');
    for (const [i, dir] of [[0, 1], [nu, -1]]) {
      const r = pts.slice(i * 4, i * 4 + 4);
      const ct = dir > 0 ? [[0, 1, 2], [0, 2, 3]] : [[0, 2, 1], [0, 3, 2]];
      const f = V3(r[ct[0][1]]).sub(V3(r[0])).cross(V3(r[ct[0][2]]).sub(V3(r[0])));
      if (f.z * dir < 0) for (const t of ct) { const q = t[1]; t[1] = t[2]; t[2] = q; }
      mp.addRaw(r, r.map(() => [0, 0, dir]), ct, 'bedLiner');
    }
    for (const side of [1, -1]) {
      const pa = surf.point(b0 + 0.005, side > 0 ? KV.glass0 - 0.3 : 2 * K - KV.glass0 + 0.3), pb = surf.point(b1, side > 0 ? KV.glass0 - 0.3 : 2 * K - KV.glass0 + 0.3);
      mp.add(tubeGeo([[pa[0] - side * 0.02, pa[1] + 0.03, pa[2]], [pb[0] - side * 0.02, pb[1] + 0.03, pb[2]]], 0.014, 2, 6), 'steel');
    }
  }
  if (D.cargo) {
    const c = D.cargo, z0 = zOf(c.from) - 0.02, z1 = zOf(c.to), len = z1 - z0, top = c.top * D.ky, base = D.stations[1].belt + 0.02;
    const bw = W * c.w;
    mp.add(roundBox(bw, top - base, len, 0.05, 2), 'white', mat4(0, (top + base) / 2, (z0 + z1) / 2));
    for (let i = 1; i < 10; i++) for (const side of [1, -1]) mp.add(boxRib(), 'steel', mat4(side * (bw / 2 + 0.005), (top + base) / 2, z0 + len * i / 10, 0, 0, 0, 1, top - base - 0.06, 1));
    mp.add(roundBox(bw + 0.03, 0.06, len + 0.03, 0.02), 'steel', mat4(0, top, (z0 + z1) / 2));
    mp.add(roundBox(bw + 0.03, 0.08, len + 0.03, 0.02), 'steel', mat4(0, base + 0.02, (z0 + z1) / 2));
    mp.add(roundBox(0.01, top - base - 0.1, 0.02, 0.004), 'gloss', mat4(0, (top + base) / 2, z0 - 0.003));
    for (const side of [1, -1]) {
      mp.add(cylGeo(0.012, 0.012, top - base - 0.2, 6), 'steel', mat4(side * 0.12, (top + base) / 2, z0 - 0.02));
      for (const y of [0.25, 0.5, 0.75]) mp.add(roundBox(0.08, 0.04, 0.03, 0.01), 'steel', mat4(side * (bw / 2 - 0.05), base + (top - base) * y, z0 - 0.01));
    }
    // Chassis rails and the rear under-run bar.
    for (const side of [1, -1]) mp.add(roundBox(0.08, 0.16, len * 0.95, 0.02), 'frame', mat4(side * 0.45, wr + 0.1, (z0 + z1) / 2));
    mp.add(roundBox(W * 0.9, 0.08, 0.08, 0.02), 'frame', mat4(0, 0.45, z0 + 0.1));
    raws.cargo = { z0, z1, top, base, bw };
  }
  // Roof equipment positions.
  const equip = { roofY, roofZ: zOf(roofU) };

  // ---------------- shell assembly (grid + painted parts + multi parts share one vertex buffer)
  const nGrid = grid.pos.length / 3;
  const all = [];
  for (const [k, ix] of Object.entries(grid.groups)) if (k !== 'hole') all.push(...ix);
  const gtmp = new THREE.BufferGeometry();
  gtmp.setAttribute('position', new THREE.BufferAttribute(grid.pos, 3));
  gtmp.setIndex(all);
  gtmp.computeVertexNormals();
  const gridN = gtmp.attributes.normal.array;
  const total = nGrid + pp.count + mp.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2), col = new Float32Array(total * 3), rm = new Float32Array(total * 2);
  pos.set(grid.pos, 0); nor.set(gridN, 0); uv.set(grid.uv, 0);
  const trimC = new THREE.Color(FIN.trim[0]);
  for (let i = 0; i < nGrid; i++) { col[i * 3] = trimC.r; col[i * 3 + 1] = trimC.g; col[i * 3 + 2] = trimC.b; rm[i * 2] = FIN.trim[1]; rm[i * 2 + 1] = FIN.trim[2]; }
  let o = nGrid;
  for (const list of [pp, mp]) {
    pos.set(list.pos, o * 3); nor.set(list.nor, o * 3); col.set(list.col, o * 3); rm.set(list.rm, o * 2);
    for (let i = 0; i < list.count; i++) {
      // Painted parts get position-based UVs for the paint flake.
      if (list === pp) { uv[(o + i) * 2] = list.pos[i * 3 + 2] + list.pos[i * 3] * 0.7; uv[(o + i) * 2 + 1] = list.pos[i * 3 + 1] + list.pos[i * 3] * 0.7; }
      else { uv[(o + i) * 2] = list.uv[i * 2]; uv[(o + i) * 2 + 1] = list.uv[i * 2 + 1]; }
    }
    o += list.count;
  }
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nor, 3), uv: new THREE.BufferAttribute(uv, 2),
    color: new THREE.BufferAttribute(col, 3), rm: new THREE.BufferAttribute(rm, 2),
  };
  const paintIdx = [...(grid.groups.paint || []), ...pp.idx.map((i) => i + nGrid)];
  const glassIdx = grid.groups.glass || [];
  const multiIdx = [...(grid.groups.trim || []), ...mp.idx.map((i) => i + nGrid + pp.count)];
  const shell = makeShell(attrs, { paint: paintIdx, glass: glassIdx, multi: multiIdx });

  // ---------------- lamps, lenses, plates (separate small meshes)
  const geoOf = (r) => rawGeometry(r.points, r.normals, r.tris, r.uvs);
  const lamps = {
    headR: geoOf(headSide[0]), headL: geoOf(headSide[1]),
    tail: geoOf(joinRaw(...raws.tail)), lens: geoOf(joinRaw(...raws.lens)), plate: geoOf(joinRaw(...raws.plate)),
  };

  // ---------------- liveries
  const decals = [];
  const T = materials();
  const decalPatch = (mat, u0, u1, v0, v1, nu = 12) => decals.push({ geo: geoOf(patch(surf, u0, u1, v0, v1, 0.0035, { nu: hi ? nu : 4, nv: hi ? 3 : 1, uvFlip: true })), mat });
  if (spec.police && spec.body !== 'van') decalPatch(T.police, -0.3, 0.2, KV.sill + 0.2, KV.shoulder - 0.15, 14);
  if (spec.police && spec.body === 'van') decalPatch(T.tactical, -0.42, 0.12, KV.rocker, KV.shoulder);
  if (spec.ambulance) decalPatch(T.ambulance, -0.45, 0.16, KV.sill + 0.3, KV.shoulder, 14);
  if (spec.roofSign) decalPatch(T.taxiDoor, -0.13, 0.17, KV.line - 0.3, KV.shoulder - 0.05);
  if (D.stripe) decalPatch(T.angkotStripe, -0.48, 0.42, KV.line - 0.35, KV.line + 0.15, 18);
  if (raws.cargo) {
    const c = raws.cargo;
    const plane = new THREE.PlaneGeometry(c.z1 - c.z0 - 0.4, (c.top - c.base) * 0.62);
    for (const side of [1, -1]) {
      const gp = plane.clone().rotateY(side * Math.PI / 2).translate(side * (c.bw / 2 + 0.012), (c.top + c.base) / 2, (c.z0 + c.z1) / 2);
      decals.push({ geo: gp, mat: T.truck });
    }
  }
  if (D.rearWindows) {
    // Dark glass in the back doors of vans.
    addRaw(mp, endQuad(surf, [[0.08 * D.hw, 1.95 * D.ky], [0.8 * D.hw, 1.95 * D.ky], [0.8 * D.hw, 1.45 * D.ky], [0.08 * D.hw, 1.45 * D.ky]], -1, 0.004, { nx: 4, ny: 2 }), 'gloss');
  }

  // ---------------- wheels
  const caliperFin = D.caliper ?? (spec.police ? 'caliperGrey' : 'caliperGrey');
  const wheelStyle = { spokes: spec.spokes ?? 5, rimRatio: D.rimRatio ?? (spec.heavy ? 0.62 : 0.66), seg: hi ? 26 : 12, steel: !!D.steelWheels, finish: D.steelWheels ? 'darkAlloy' : (spec.key === 'macan' || spec.key === 'sentosa') ? 'chrome' : 'alloy' };
  const ri = wr * wheelStyle.rimRatio;
  const wheelR = wheelGeometry(wr, tw, wheelStyle);
  const wheelL = mirrorX(wheelR);
  const rearAxle = mergeBuilt([{ geo: wheelR, matrix: new THREE.Matrix4().makeTranslation(tx, 0, 0) }, { geo: wheelR, matrix: new THREE.Matrix4().makeTranslation(-tx, 0, 0).multiply(new THREE.Matrix4().makeScale(-1, 1, 1)) }]);
  const caliper = caliperGeometry(wr, tw, ri, caliperFin);
  const wheels = { right: wheelR, left: wheelL, rearAxle, caliperR: caliper, caliperL: mirrorX(caliper), tx };

  return {
    shell, lamps, decals, wheels, equip, D, surf,
    seat: new THREE.Vector3(-cabinW * 0.48, seatY - 0.02, seatZ),
    steer: steerGroup ? steerGroup.position.clone() : null,
  };
}

let ribGeo = null;
function boxRib() { return ribGeo || (ribGeo = new THREE.BoxGeometry(0.02, 1, 0.04)); }

function makeShell(attrs, groups) {
  const out = {};
  const allIdx = [...groups.paint, ...groups.glass, ...groups.multi];
  for (const [k, ix] of Object.entries(groups)) {
    const g = new THREE.BufferGeometry();
    for (const [n, a] of Object.entries(attrs)) g.setAttribute(n, a);
    g.setIndex(ix);
    g.computeBoundingSphere();
    out[k] = g;
  }
  out.allIndex = allIdx;
  return out;
}

// ------------------------------------------------------------------ instancing
function shellMeshes(shell, paint, far) {
  const m = materials();
  const paintMesh = new THREE.Mesh(shell.paint, paint);
  const glassMesh = new THREE.Mesh(shell.glass, far ? m.glassFar : m.glass);
  const multiMesh = new THREE.Mesh(shell.multi, multiMaterial());
  paintMesh.castShadow = true;
  paintMesh.receiveShadow = multiMesh.receiveShadow = true;
  glassMesh.renderOrder = 2;
  const group = new THREE.Group();
  group.add(paintMesh, multiMesh, glassMesh);
  group.userData.shell = { shell, paintMesh, glassMesh, multiMesh };
  return group;
}

export function buildVehicleMesh(spec, color) {
  if (spec.body === 'scooter' || spec.body === 'motorbike') return buildTwoWheeler(spec, color);
  if (spec.body === 'bajaj') return buildBajaj(spec, color);
  const T0 = template(spec, 0), T1 = template(spec, 1);
  const mats = materials();
  const paint = carPaint(color);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const lod = new THREE.LOD();
  lod.addLevel(shellMeshes(T0.shell, paint, false), 0);
  lod.addLevel(shellMeshes(T1.shell, paint, true), LOD_FAR);
  body.add(lod);
  const headR = new THREE.Mesh(T0.lamps.headR, assets.material('headlight'));
  const headL = new THREE.Mesh(T0.lamps.headL, assets.material('headlight'));
  const tail = new THREE.Mesh(T0.lamps.tail, assets.material('taillight'));
  const lens = new THREE.Mesh(T0.lamps.lens, mats.lens);
  lens.renderOrder = 3;
  const plate = new THREE.Mesh(T0.lamps.plate, mats.plate);
  body.add(headR, headL, tail, lens, plate);
  for (const d of T0.decals) body.add(new THREE.Mesh(d.geo, d.mat));

  // Roof equipment.
  let sirens = null;
  const W = spec.width, { roofY, roofZ } = T0.equip;
  if (spec.police || spec.ambulance) {
    const red = assets.material('siren-red').clone(), blue = assets.material(spec.ambulance ? 'siren-red' : 'siren-blue').clone();
    const bar = new THREE.Group();
    const base = new THREE.Mesh(roundBox(W * 0.7, 0.05, 0.3, 0.02), multiMaterialFor('trim'));
    const r = new THREE.Mesh(roundBox(W * 0.3, 0.085, 0.24, 0.035), red);
    const b = new THREE.Mesh(roundBox(W * 0.3, 0.085, 0.24, 0.035), blue);
    r.position.set(-W * 0.17, 0.06, 0); b.position.set(W * 0.17, 0.06, 0);
    const cover = new THREE.Mesh(roundBox(W * 0.68, 0.11, 0.28, 0.045), mats.lightbarClear);
    cover.position.y = 0.06;
    bar.add(base, r, b, cover);
    for (const side of [1, -1]) { const foot = new THREE.Mesh(roundBox(0.06, 0.05, 0.2, 0.015), multiMaterialFor('trim')); foot.position.set(side * W * 0.33, -0.03, 0); bar.add(foot); }
    bar.position.set(0, roofY + 0.03, roofZ);
    body.add(bar);
    sirens = { red, blue };
  }
  if (spec.roofSign) {
    const sign = new THREE.Mesh(signGeometry(), mats.taxiSign);
    sign.position.set(0, roofY + 0.1, roofZ + 0.1);
    body.add(sign);
  }
  if (spec.key === 'angkot') {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.78, 0.18), mats.route);
    const s = T0.surf, uF = T0.D.glass.roofF;
    const p = s.point(uF + 0.01, K);
    board.position.set(0, p[1] + 0.12, p[2] + 0.02);
    body.add(board);
    const rack = new THREE.Mesh(roundBox(W * 0.72, 0.04, spec.length * 0.45, 0.015), multiMaterialFor('steel'));
    rack.position.set(0, roofY + 0.08, -0.1 * spec.length);
    body.add(rack);
  }

  // Wheels: steerable fronts with their calipers, one spinning mesh per rear axle.
  const wheels = [];
  const wr = spec.wheelRadius, wb = spec.wheelbase, tx = T0.wheels.tx;
  const wmat = multiMaterial('wheel');
  const lodWheel = (hiGeo, loGeo) => {
    const l = new THREE.LOD();
    const a = new THREE.Mesh(hiGeo, wmat), b = new THREE.Mesh(loGeo, wmat);
    a.castShadow = b.castShadow = true;
    l.addLevel(a, 0); l.addLevel(b, LOD_FAR);
    return l;
  };
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * tx, wr, wb / 2);
    const spin = new THREE.Group();
    spin.add(lodWheel(side > 0 ? T0.wheels.right : T0.wheels.left, side > 0 ? T1.wheels.right : T1.wheels.left));
    pivot.add(spin);
    pivot.add(new THREE.Mesh(side > 0 ? T0.wheels.caliperR : T0.wheels.caliperL, multiMaterial()));
    root.add(pivot);
    wheels.push({ pivot, spin, front: true, x: side * tx, z: wb / 2 });
  }
  {
    const pivot = new THREE.Group();
    pivot.position.set(0, wr, -wb / 2);
    const spin = new THREE.Group();
    spin.add(lodWheel(T0.wheels.rearAxle, T1.wheels.rearAxle));
    pivot.add(spin);
    for (const side of [1, -1]) { const c = new THREE.Mesh(side > 0 ? T0.wheels.caliperR : T0.wheels.caliperL, multiMaterial()); c.position.x = side * tx; pivot.add(c); }
    root.add(pivot);
    wheels.push({ pivot, spin, front: false, x: 0, z: -wb / 2 });
  }
  return {
    root, body, wheels, sirens, brakeMeshes: [tail], headMeshes: [headR, headL], wipers: [], steering: null,
    seat: T0.seat.clone(),
  };
}

// Small parts in the multi material that are not merged (roof equipment): a geometry copy
// with flat attributes for the given finish.
const finGeoCache = new Map();
function multiMaterialFor(fin) {
  if (!finGeoCache.has(fin)) {
    const f = FIN[fin];
    finGeoCache.set(fin, new THREE.MeshStandardMaterial({ color: f[0], roughness: f[1], metalness: f[2] }));
  }
  return finGeoCache.get(fin);
}

let signGeo = null;
function signGeometry() {
  if (signGeo) return signGeo;
  const g = roundBox(0.62, 0.18, 0.22, 0.04).clone();
  // Map the label onto the front and back faces (planar projection along z).
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { uv.setXY(i, (p.getX(i) * Math.sign(p.getZ(i) || 1)) / 0.62 + 0.5, p.getY(i) / 0.18 + 0.5); }
  signGeo = g;
  return signGeo;
}

// ------------------------------------------------------------------ damage
// Dents push the body shell in around an impact. The shared template geometry is copied for
// this car on its first dent so other cars of the model stay pristine.
export function dentVehicleBody(vehicle, local, nx, nz, radius, depth, maxY) {
  vehicle.body.traverse((o) => {
    const sh = o.userData?.shell;
    if (!sh) return;
    if (!sh.own) {
      const src = sh.paintMesh.geometry;
      const attrs = {};
      for (const [n, a] of Object.entries(src.attributes)) attrs[n] = (n === 'position' || n === 'normal') ? a.clone() : a;
      for (const mesh of [sh.paintMesh, sh.glassMesh, sh.multiMesh]) {
        const g = new THREE.BufferGeometry();
        for (const [n, a] of Object.entries(attrs)) g.setAttribute(n, a);
        g.setIndex(mesh.geometry.index);
        g.boundingSphere = mesh.geometry.boundingSphere;
        mesh.geometry = g;
      }
      sh.own = true;
      sh.normalGeo = new THREE.BufferGeometry();
      sh.normalGeo.setAttribute('position', attrs.position);
      sh.normalGeo.setAttribute('normal', attrs.normal);
      sh.normalGeo.setIndex(sh.shell.allIndex);
      (vehicle.ownGeometries ||= []).push(sh.paintMesh.geometry, sh.glassMesh.geometry, sh.multiMesh.geometry);
    }
    const pos = sh.paintMesh.geometry.attributes.position;
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > maxY) continue;
      const dx = pos.getX(i) - local.x, dz = pos.getZ(i) - local.z;
      const d = Math.hypot(dx, (y - local.y) * 0.8, dz);
      if (d > radius) continue;
      const k = (1 - d / radius) ** 2 * depth;
      pos.setX(i, pos.getX(i) + nx * k);
      pos.setZ(i, pos.getZ(i) + nz * k);
      pos.setY(i, y - k * 0.25);
      moved = true;
    }
    if (moved) { pos.needsUpdate = true; sh.normalGeo.computeVertexNormals(); sh.paintMesh.geometry.attributes.normal.needsUpdate = true; }
  });
}

// Prebuild every model's shared geometry (optional warm-up).
export function prebuildVehicleTemplates(models) {
  for (const spec of Object.values(models)) if (!spec.twoWheel && spec.body !== 'bajaj') { template(spec, 0); template(spec, 1); }
}
