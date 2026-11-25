// Two- and three-wheelers, built once per model and shared like the cars:
//  - Bebek 110 scooter: underbone frame, raked telescopic fork, curved leg shield and front
//    apron, floorboard, sculpted rear cowl over the CVT engine, two-tone seat, grab rail,
//    handlebar cowl with the headlight, mirrors on stalks, cast wheels with a front disc.
//  - Kilat 250R sport bike: twin-spar frame, upside-down fork, fuel tank, full fairing with
//    a tinted screen and twin lamps, split seat, sharp tail, exposed engine, swingarm, side
//    exhaust, clip-on bars and fairing mirrors.
//  - Bajaj three-wheeler: rounded tub, canvas canopy on a tube frame, single steered front
//    wheel with a mudguard, bench seat, windscreen.
// The fork, bars and headlamp turn with the front wheel; the wheels lean with the body.
import * as THREE from 'three';
import { carPaint } from './car-paint.js';
import { PartList, FIN, multiMaterial, roundBox, cylGeo, torusGeo, tubeGeo, ellipseLoft, mat4, wheelGeometry, caliperGeometry, rawGeometry } from './car-parts.js';
import { assets } from '../assets/asset-library.js';

const glassMat = () => (glassMat.m ||= new THREE.MeshPhysicalMaterial({ color: 0x10181e, roughness: 0.04, transparent: true, opacity: 0.55, envMapIntensity: 1.8, depthWrite: false }));

// A vertical loft: sections [y, zCentre, halfWidth, halfDepth].
function vLoft(sections, segs = 14, power = 2) {
  const g = ellipseLoft(sections.map(([y, z, w, d]) => [y, -z, w, d]), segs, { power });
  g.rotateX(-Math.PI / 2);
  return g;
}

// A lamp lens as its own geometry (emissive meshes are swapped on damage/braking).
function lensGeo(geo, matrix) {
  const g = geo.clone().applyMatrix4(matrix);
  return g;
}

const templates = new Map();

function scooterTemplate(spec) {
  const r = spec.wheelRadius, wb = spec.wheelbase, zf = wb / 2, zr = -wb / 2;
  const paint = new PartList(), parts = new PartList(), fPaint = new PartList(), fParts = new PartList();
  // Front assembly is built around the steering axis and shifted into the front pivot frame.
  const toPivot = new THREE.Matrix4().makeTranslation(0, -r, -zf);
  const F = (m) => toPivot.clone().multiply(m);
  // Fork legs and the steering column.
  for (const s of [-1, 1]) {
    fParts.add(tubeGeo([[s * 0.07, r, zf], [s * 0.065, r + 0.32, zf - 0.13]], 0.022, 2, 8), 'chrome', toPivot);
    fParts.add(tubeGeo([[s * 0.065, r + 0.3, zf - 0.12], [s * 0.06, 0.86, zf - 0.27]], 0.026, 2, 8), 'frame', toPivot);
  }
  // Front mudguard hugging the tyre.
  const guard = new THREE.TorusGeometry(r + 0.035, 0.05, 6, 16, Math.PI * 0.62);
  guard.scale(1, 1, 1.4);
  fPaint.add(guard, FIN.gloss, F(mat4(0, r, zf, 0, Math.PI / 2, Math.PI * 0.3)));
  // Handlebar cowl with headlight, bars, grips, levers and mirrors.
  fPaint.add(ellipseLoft([[-0.18, 0, 0.05, 0.04], [-0.12, 0.0, 0.2, 0.07], [0.04, 0.01, 0.22, 0.08], [0.12, 0.0, 0.16, 0.07], [0.16, -0.01, 0.06, 0.04]], 16, { power: 2.4 }), FIN.gloss, F(mat4(0, 1.02, zf - 0.33, -0.25)));
  for (const s of [-1, 1]) {
    fParts.add(cylGeo(0.012, 0.012, 0.2, 8), 'chrome', F(mat4(s * 0.29, 1.04, zf - 0.38, 0, 0, Math.PI / 2)));
    fParts.add(cylGeo(0.02, 0.02, 0.12, 10), 'rubber', F(mat4(s * 0.39, 1.04, zf - 0.39, 0, 0, Math.PI / 2)));
    fParts.add(roundBox(0.12, 0.012, 0.03, 0.005), 'darkAlloy', F(mat4(s * 0.37, 1.05, zf - 0.33, 0, s * 0.3, 0)));
    fParts.add(tubeGeo([[s * 0.17, 1.06, zf - 0.38], [s * 0.22, 1.2, zf - 0.42], [s * 0.25, 1.26, zf - 0.42]], 0.007, 4, 5), 'frame', toPivot);
    fParts.add(vLoft([[1.23, zf - 0.43, 0.002, 0.002], [1.25, zf - 0.43, 0.055, 0.016], [1.31, zf - 0.43, 0.06, 0.018], [1.33, zf - 0.43, 0.002, 0.002]], 10), 'gloss', F(mat4(s * 0.25, 0, 0)));
  }
  const headGeo = lensGeo(vLoft([[0.0, 0, 0.002, 0.002], [0.01, 0, 0.09, 0.012], [0.05, 0, 0.1, 0.014], [0.07, 0, 0.002, 0.002]], 14), F(mat4(0, 0.98, zf - 0.17, -0.2)));
  // Leg shield and front apron (sculpted, raked with the fork).
  paint.add(vLoft([[0.3, 0.44, 0.16, 0.06], [0.36, 0.44, 0.2, 0.1], [0.55, 0.41, 0.24, 0.12], [0.75, 0.37, 0.24, 0.12], [0.9, 0.32, 0.2, 0.1], [0.99, 0.28, 0.12, 0.07], [1.02, 0.27, 0.02, 0.02]], 18, 2.6), FIN.gloss);
  parts.add(vLoft([[0.38, 0.33, 0.19, 0.02], [0.88, 0.24, 0.17, 0.02]], 10, 3), 'trim');
  // Floorboard and the underbone frame below it.
  parts.add(roundBox(0.32, 0.05, 0.5, 0.02), 'trim', mat4(0, 0.36, 0.08));
  parts.add(tubeGeo([[0, 0.86, zf - 0.27], [0, 0.42, 0.3], [0, 0.3, 0.0], [0, 0.45, -0.3]], 0.03, 10, 8), 'frame');
  // Rear cowl over the engine, seat, tail and grab rail.
  paint.add(ellipseLoft([[-0.9, 0.7, 0.02, 0.02], [-0.86, 0.69, 0.12, 0.09], [-0.7, 0.66, 0.18, 0.14], [-0.4, 0.6, 0.19, 0.17], [-0.15, 0.54, 0.16, 0.15], [0.0, 0.48, 0.1, 0.1], [0.05, 0.46, 0.02, 0.02]], 18, { power: 2.5 }), FIN.gloss);
  parts.add(ellipseLoft([[-0.82, 0.8, 0.02, 0.01], [-0.76, 0.81, 0.13, 0.04], [-0.5, 0.84, 0.16, 0.06], [-0.2, 0.82, 0.16, 0.06], [-0.02, 0.77, 0.13, 0.045], [0.02, 0.75, 0.02, 0.01]], 16, { power: 2.6 }), 'seat');
  parts.add(ellipseLoft([[-0.79, 0.775, 0.13, 0.02], [-0.02, 0.745, 0.13, 0.02]], 14, { power: 3 }), 'trim');
  parts.add(tubeGeo([[0.14, 0.8, -0.55], [0.15, 0.82, -0.78], [0, 0.83, -0.86], [-0.15, 0.82, -0.78], [-0.14, 0.8, -0.55]], 0.012, 12, 6), 'darkAlloy');
  // Engine/CVT case on the left, exhaust on the right, rear shock.
  parts.add(roundBox(0.14, 0.22, 0.55, 0.06), 'engine', mat4(-0.12, 0.4, zr + 0.3));
  parts.add(cylGeo(0.05, 0.05, 0.42, 12), 'darkAlloy', mat4(0.15, 0.38, zr + 0.1, Math.PI / 2 + 0.1, 0, 0));
  parts.add(cylGeo(0.035, 0.035, 0.03, 10), 'exhaust', mat4(0.15, 0.36, zr - 0.12, Math.PI / 2 + 0.1, 0, 0));
  parts.add(tubeGeo([[0.13, 0.36, zr + 0.25], [0.15, 0.36, zr + 0.4], [0.12, 0.42, 0.0]], 0.018, 6, 6), 'exhaust');
  parts.add(cylGeo(0.022, 0.022, 0.3, 8), 'chrome', mat4(0.1, r + 0.17, zr + 0.06, -0.3, 0, 0));
  // Rear hugger, tail lamp housing, plate.
  const hug = new THREE.TorusGeometry(r + 0.03, 0.035, 5, 12, Math.PI * 0.5);
  hug.scale(1, 1, 1.6);
  parts.add(hug, 'trim', mat4(0, r, zr, 0, Math.PI / 2, Math.PI * 0.45));
  const tailGeo = lensGeo(roundBox(0.18, 0.05, 0.03, 0.012), mat4(0, 0.71, -0.89));
  parts.add(roundBox(0.18, 0.09, 0.012, 0.004), 'white', mat4(0, 0.58, -0.86, 0.3));
  const rig = { grips: [[0.385, 1.04, zf - 0.39], [-0.385, 1.04, zf - 0.39]], pegs: [[0.12, 0.47, 0.16], [-0.12, 0.47, 0.16]], pivot: [0, r, zf], seatTop: 0.83, stepThrough: true };
  return { paint, parts, fPaint, fParts, headGeo, tailGeo, rig, seat: new THREE.Vector3(0, 0.62, -0.3), wheel: { w: 0.1, rimRatio: 0.58, spokes: 5 } };
}

function sportTemplate(spec) {
  const r = spec.wheelRadius, wb = spec.wheelbase, zf = wb / 2, zr = -wb / 2;
  const paint = new PartList(), parts = new PartList(), fPaint = new PartList(), fParts = new PartList();
  const toPivot = new THREE.Matrix4().makeTranslation(0, -r, -zf);
  const F = (m) => toPivot.clone().multiply(m);
  // Upside-down fork, clip-ons and the front mudguard.
  for (const s of [-1, 1]) {
    fParts.add(tubeGeo([[s * 0.08, r, zf], [s * 0.078, r + 0.3, zf - 0.13]], 0.02, 2, 8), 'chrome', toPivot);
    fParts.add(tubeGeo([[s * 0.078, r + 0.28, zf - 0.12], [s * 0.075, 0.92, zf - 0.3]], 0.03, 2, 8), 'caliperYellow', toPivot);
    fParts.add(tubeGeo([[s * 0.08, 0.9, zf - 0.32], [s * 0.26, 0.9, zf - 0.38]], 0.014, 2, 6), 'darkAlloy', toPivot);
    fParts.add(cylGeo(0.02, 0.02, 0.11, 10), 'rubber', F(mat4(s * 0.3, 0.9, zf - 0.39, 0, 0.3 * s, Math.PI / 2)));
  }
  const guard = new THREE.TorusGeometry(r + 0.02, 0.045, 5, 14, Math.PI * 0.45);
  guard.scale(1, 1, 1.3);
  fParts.add(guard, 'gloss', F(mat4(0, r, zf, 0, Math.PI / 2, Math.PI * 0.32)));
  // Frame spars, swingarm, engine.
  for (const s of [-1, 1]) {
    parts.add(tubeGeo([[s * 0.09, 0.92, zf - 0.32], [s * 0.15, 0.82, 0.15], [s * 0.13, 0.62, -0.12], [s * 0.1, 0.5, -0.2]], 0.032, 10, 6), 'darkAlloy');
    parts.add(tubeGeo([[s * 0.1, 0.5, -0.2], [s * 0.11, r + 0.02, zr]], 0.03, 4, 6), 'darkAlloy');
  }
  parts.add(roundBox(0.3, 0.34, 0.42, 0.06), 'engine', mat4(0, 0.48, 0.08));
  parts.add(roundBox(0.24, 0.16, 0.2, 0.04), 'engine', mat4(0, 0.36, 0.28));
  for (let i = 0; i < 4; i++) parts.add(cylGeo(0.012, 0.012, 0.3, 6), 'darkAlloy', mat4(0, 0.46 + i * 0.05, 0.1, 0, 0, Math.PI / 2));
  // Fuel tank, seat, tail section.
  paint.add(ellipseLoft([[-0.14, 0.9, 0.03, 0.02], [-0.1, 0.94, 0.16, 0.09], [0.05, 0.99, 0.2, 0.12], [0.22, 0.98, 0.18, 0.11], [0.32, 0.93, 0.12, 0.07], [0.35, 0.9, 0.03, 0.02]], 18, { power: 2.3 }), FIN.gloss);
  parts.add(ellipseLoft([[-0.52, 0.92, 0.02, 0.01], [-0.48, 0.93, 0.1, 0.035], [-0.3, 0.92, 0.14, 0.045], [-0.12, 0.9, 0.15, 0.04], [-0.08, 0.89, 0.03, 0.01]], 14, { power: 2.6 }), 'seat');
  paint.add(ellipseLoft([[-1.0, 1.0, 0.02, 0.01], [-0.96, 1.0, 0.06, 0.03], [-0.75, 0.96, 0.11, 0.06], [-0.5, 0.9, 0.15, 0.07], [-0.3, 0.84, 0.15, 0.07], [-0.2, 0.82, 0.03, 0.02]], 16, { power: 2.6 }), FIN.gloss);
  // Fairing: nose cone and side panels, black inner and the tinted screen.
  paint.add(ellipseLoft([[0.42, 0.92, 0.03, 0.03], [0.48, 0.92, 0.16, 0.14], [0.6, 0.88, 0.2, 0.17], [0.72, 0.85, 0.16, 0.12], [0.8, 0.83, 0.07, 0.05], [0.83, 0.82, 0.01, 0.01]], 18, { power: 2.2 }), FIN.gloss);
  paint.add(ellipseLoft([[-0.05, 0.6, 0.03, 0.08], [0.05, 0.62, 0.2, 0.2], [0.3, 0.68, 0.21, 0.22], [0.44, 0.74, 0.17, 0.18], [0.48, 0.76, 0.02, 0.02]], 16, { power: 2.4 }), FIN.gloss);
  const screen = vLoft([[0.99, 0.6, 0.01, 0.004], [1.0, 0.59, 0.13, 0.008], [1.08, 0.5, 0.11, 0.008], [1.12, 0.45, 0.01, 0.004]], 12);
  const headGeo = (() => {
    const L = [];
    for (const s of [-1, 1]) L.push(lensGeo(vLoft([[0, 0, 0.002, 0.002], [0.01, 0, 0.055, 0.012], [0.045, 0, 0.05, 0.012], [0.055, 0, 0.002, 0.002]], 12), mat4(s * 0.065, 0.88, 0.76, -0.3, s * 0.25, 0)));
    const g = L[0];
    const merged = new THREE.BufferGeometry();
    const p = [...L[0].attributes.position.array, ...L[1].attributes.position.array], n = [...L[0].attributes.normal.array, ...L[1].attributes.normal.array];
    const off = L[0].attributes.position.count;
    merged.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); merged.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    merged.setIndex([...L[0].index.array, ...Array.from(L[1].index.array).map((i) => i + off)]);
    void g;
    return merged;
  })();
  for (const s of [-1, 1]) {
    parts.add(tubeGeo([[s * 0.15, 0.95, 0.55], [s * 0.24, 0.98, 0.52]], 0.008, 2, 5), 'frame');
    parts.add(vLoft([[0.95, 0.51, 0.002, 0.002], [0.965, 0.51, 0.05, 0.015], [1.02, 0.51, 0.055, 0.016], [1.03, 0.51, 0.002, 0.002]], 10), 'gloss', mat4(s * 0.26, 0, 0));
  }
  // Exhaust on the right, rear hugger, plate hanger and tail lamp.
  parts.add(tubeGeo([[0.05, 0.36, 0.25], [0.12, 0.3, 0.0], [0.17, 0.42, -0.35]], 0.03, 8, 8), 'exhaust');
  parts.add(cylGeo(0.06, 0.055, 0.38, 14), 'darkAlloy', mat4(0.19, 0.46, -0.48, Math.PI / 2 - 0.35, 0, 0));
  parts.add(cylGeo(0.045, 0.045, 0.01, 12), 'exhaust', mat4(0.19, 0.52, -0.66, Math.PI / 2 - 0.35, 0, 0));
  parts.add(tubeGeo([[0, 0.9, -0.85], [0, 0.72, -0.98], [0, 0.62, -1.0]], 0.012, 4, 5), 'frame');
  parts.add(roundBox(0.18, 0.09, 0.012, 0.004), 'white', mat4(0, 0.6, -1.0, 0.3));
  const hug = new THREE.TorusGeometry(r + 0.025, 0.03, 5, 12, Math.PI * 0.45);
  parts.add(hug, 'trim', mat4(0, r, zr, 0, Math.PI / 2, Math.PI * 0.5));
  const tailGeo = lensGeo(roundBox(0.12, 0.035, 0.03, 0.012), mat4(0, 0.99, -0.99));
  const rig = { grips: [[0.3, 0.9, zf - 0.39], [-0.3, 0.9, zf - 0.39]], pegs: [[0.17, 0.44, -0.2], [-0.17, 0.44, -0.2]], pivot: [0, r, zf], seatTop: 0.93, stepThrough: false };
  return { paint, parts, fPaint, fParts, headGeo, tailGeo, screen, rig, seat: new THREE.Vector3(0, 0.66, -0.32), wheel: { w: 0.13, rimRatio: 0.66, spokes: spec.spokes ?? 3 } };
}

function bajajTemplate() {
  const paint = new PartList(), parts = new PartList(), fPaint = new PartList(), fParts = new PartList();
  // Tub: rounded body, wider at the back where the passengers sit, nose with the headlamp.
  paint.add(ellipseLoft([[-1.22, 0.58, 0.32, 0.2], [-1.17, 0.62, 0.6, 0.3], [-0.6, 0.64, 0.65, 0.33], [-0.1, 0.62, 0.56, 0.31], [0.45, 0.57, 0.33, 0.26], [0.9, 0.62, 0.24, 0.3], [1.05, 0.68, 0.12, 0.18], [1.08, 0.7, 0.02, 0.03]], 20, { power: 2.6 }), FIN.gloss);
  parts.add(ellipseLoft([[-1.18, 0.3, 0.55, 0.05], [0.6, 0.3, 0.3, 0.05]], 14, { power: 3 }), 'trim');
  // Canopy on a tube frame.
  parts.add(ellipseLoft([[-1.22, 1.6, 0.05, 0.02], [-1.16, 1.63, 0.62, 0.07], [0.2, 1.66, 0.62, 0.08], [0.6, 1.6, 0.46, 0.07], [0.7, 1.56, 0.05, 0.02]], 18, { power: 3 }), 'canvas');
  for (const [x, z] of [[-0.56, -1.06], [0.56, -1.06], [-0.42, 0.56], [0.42, 0.56]]) parts.add(cylGeo(0.018, 0.018, 0.9, 8), 'darkAlloy', mat4(x, 1.2, z));
  parts.add(tubeGeo([[-0.56, 0.95, -1.06], [-0.56, 0.95, 0.0], [-0.42, 0.95, 0.56]], 0.015, 6, 5), 'darkAlloy');
  parts.add(tubeGeo([[0.56, 0.95, -1.06], [0.56, 0.95, 0.0], [0.42, 0.95, 0.56]], 0.015, 6, 5), 'darkAlloy');
  // Seats, dash, handlebar.
  parts.add(roundBox(1.1, 0.15, 0.5, 0.06), 'vinyl', mat4(0, 0.88, -0.75));
  parts.add(roundBox(1.1, 0.5, 0.12, 0.06), 'vinyl', mat4(0, 1.12, -1.04, -0.1));
  parts.add(roundBox(0.42, 0.12, 0.42, 0.05), 'vinyl', mat4(0, 0.88, 0.15));
  parts.add(roundBox(0.8, 0.3, 0.12, 0.04), 'dash', mat4(0, 0.98, 0.5));
  fParts.add(tubeGeo([[-0.34, 1.05, 0.42], [-0.2, 1.08, 0.48], [0.2, 1.08, 0.48], [0.34, 1.05, 0.42]], 0.014, 8, 6), 'chrome', new THREE.Matrix4().makeTranslation(0, -0.24, -0.75));
  // Front mudguard and fork (turn with the wheel).
  const guard = new THREE.TorusGeometry(0.27, 0.06, 5, 12, Math.PI * 0.6);
  fPaint.add(guard, FIN.gloss, new THREE.Matrix4().makeTranslation(0, 0, 0).multiply(mat4(0, 0, 0, 0, Math.PI / 2, Math.PI * 0.2)));
  fParts.add(cylGeo(0.025, 0.025, 0.5, 8), 'frame', mat4(0.07, 0.25, -0.06, 0.25, 0, 0));
  const screen = new THREE.PlaneGeometry(0.78, 0.55).rotateX(-0.15).translate(0, 1.27, 0.62);
  const headGeo = lensGeo(new THREE.CircleGeometry(0.09, 16), mat4(0, 0.88, 1.075, -0.15));
  parts.add(torusGeo(0.095, 0.014, 5, 16), 'chrome', mat4(0, 0.88, 1.07, -0.15));
  const tailGeo = (() => {
    const a = roundBox(0.1, 0.06, 0.03, 0.012).clone().translate(0.5, 0.62, -1.22), b = roundBox(0.1, 0.06, 0.03, 0.012).clone().translate(-0.5, 0.62, -1.22);
    const g = new THREE.BufferGeometry();
    const off = a.attributes.position.count;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.attributes.position.array, ...b.attributes.position.array], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...a.attributes.normal.array, ...b.attributes.normal.array], 3));
    const ia = a.index ? Array.from(a.index.array) : [...Array(off).keys()], ib = b.index ? Array.from(b.index.array) : [...Array(b.attributes.position.count).keys()];
    g.setIndex([...ia, ...ib.map((i) => i + off)]);
    return g;
  })();
  parts.add(roundBox(0.3, 0.1, 0.012, 0.004), 'white', mat4(0, 0.45, -1.2));
  const rig = { grips: [[0.33, 1.05, 0.43], [-0.33, 1.05, 0.43]], pegs: [[0.13, 0.42, 0.42], [-0.13, 0.42, 0.42]], pivot: [0, 0.24, 0.75], seatTop: 0.94, stepThrough: true, seated: true };
  return { paint, parts, fPaint, fParts, headGeo, tailGeo, screen, rig, seat: new THREE.Vector3(0, 0.82, 0.1), wheel: { w: 0.12, rimRatio: 0.55, spokes: 4, steel: true } };
}

function getTemplate(spec) {
  if (templates.has(spec.key)) return templates.get(spec.key);
  const t = spec.body === 'scooter' ? scooterTemplate(spec) : spec.body === 'bajaj' ? bajajTemplate(spec) : sportTemplate(spec);
  const build = (l) => (l.count ? l.build() : null);
  const out = { ...t, paint: build(t.paint), parts: build(t.parts), fPaint: build(t.fPaint), fParts: build(t.fParts) };
  // Wheels: cast alloys (steel for the bajaj), front disc and caliper.
  const r = spec.wheelRadius;
  out.wheelGeo = wheelGeometry(r, t.wheel.w, { spokes: t.wheel.spokes, rimRatio: t.wheel.rimRatio, seg: 22, steel: !!t.wheel.steel, finish: t.wheel.steel ? 'alloy' : 'darkAlloy' });
  out.caliper = caliperGeometry(r, t.wheel.w, r * t.wheel.rimRatio, spec.body === 'motorbike' ? 'caliperYellow' : 'caliperGrey');
  templates.set(spec.key, out);
  return out;
}

function assemble(spec, color, T) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const paint = carPaint(color), multi = multiMaterial();
  const add = (parent, geo, mat, cast = true) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = cast; parent.add(m); return m; };
  add(body, T.paint, paint);
  add(body, T.parts, multi);
  if (T.screen) { const s = add(body, T.screen, glassMat(), false); s.renderOrder = 2; }
  const tail = add(body, T.tailGeo, assets.material('taillight'), false);
  const wheels = [];
  const r = spec.wheelRadius, wb = spec.wheelbase;
  const wmat = multiMaterial('wheel');
  const wheelAt = (x, z, front) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, r, z);
    const spin = new THREE.Group();
    add(spin, T.wheelGeo, wmat);
    pivot.add(spin);
    add(pivot, T.caliper, multi, false);
    body.add(pivot);
    const w = { pivot, spin, front, x, z };
    wheels.push(w);
    return w;
  };
  let head;
  if (spec.body === 'bajaj') {
    const f = wheelAt(0, 0.75, true);
    add(f.pivot, T.fPaint, paint); add(f.pivot, T.fParts, multi);
    head = add(body, T.headGeo, assets.material('headlight'), false);
    for (const s of [-1, 1]) wheelAt(s * 0.62, -0.75, false);
  } else {
    const f = wheelAt(0, wb / 2, true);
    add(f.pivot, T.fPaint, paint); add(f.pivot, T.fParts, multi);
    head = add(spec.body === 'scooter' ? f.pivot : body, T.headGeo, assets.material('headlight'), false);
    wheelAt(0, -wb / 2, false);
  }
  return { root, body, wheels, seat: T.seat.clone(), sirens: null, brakeMeshes: [tail], headMeshes: [head], wipers: [], rig: T.rig, seatTop: T.rig?.seatTop };
}

export function buildTwoWheeler(spec, color) { return assemble(spec, color, getTemplate(spec)); }
export function buildBajaj(spec, color) { return assemble(spec, color, getTemplate(spec)); }
void rawGeometry;
