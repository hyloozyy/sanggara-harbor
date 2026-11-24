// Weapon models, built once per type and cached: each gun is made from extruded side profiles with
// bevelled edges (slide, frame, receiver, stock), turned barrels and scopes, a textured grip, sights
// and rails, and a separate magazine (named 'mag') that the reload animation pulls out and puts
// back. The revolver's cylinder swings out instead; the shotgun has a pump. Melee: a lathe-turned
// bat with taped handle and a curved golok machete. Plus the HUD icon painter.
import * as THREE from 'three';
import { assets } from '../assets/asset-library.js';
import { makeCanvas, toTexture } from '../assets/canvas-tools.js';

let M = null;
function materials() {
  if (M) return M;
  const grip = makeCanvas(64, 64), g = grip.getContext('2d');
  g.fillStyle = '#1c1d20'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 64; x += 4) { g.fillStyle = '#2c2e33'; g.fillRect(x, y, 2, 2); }
  const wood = makeCanvas(64, 128), w = wood.getContext('2d');
  w.fillStyle = '#6a3c1e'; w.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 40; i++) { w.strokeStyle = `rgba(${30 + Math.random() * 40},${15 + Math.random() * 20},5,0.5)`; w.beginPath(); const x = Math.random() * 64; w.moveTo(x, 0); w.bezierCurveTo(x + 6, 40, x - 6, 80, x + 3, 128); w.stroke(); }
  M = {
    gunmetal: new THREE.MeshPhysicalMaterial({ color: 0x202226, metalness: 0.85, roughness: 0.32, clearcoat: 0.3 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a8e94, metalness: 1, roughness: 0.25 }),
    polymer: new THREE.MeshStandardMaterial({ color: 0x17181a, metalness: 0.1, roughness: 0.7 }),
    grip: new THREE.MeshStandardMaterial({ map: toTexture(grip, { repeat: true }), metalness: 0.1, roughness: 0.85 }),
    wood: new THREE.MeshPhysicalMaterial({ map: toTexture(wood, { repeat: true }), roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    blade: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: 0.22 }),
    tape: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x223a44, metalness: 0.2, roughness: 0.05, clearcoat: 1, envMapIntensity: 2 }),
    red: new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2020, emissiveIntensity: 3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a040, metalness: 1, roughness: 0.3 }),
  };
  return M;
}
export function weaponMaterials() { return materials(); }

// Extrude a side profile [[z, y], ...] (barrel along +z, y up) to a given width, bevelled.
function prof(points, width, mat, { bevel = 0.003, x = 0 } = {}) {
  const s = new THREE.Shape();
  points.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, width - bevel * 2), bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
  geo.rotateY(-Math.PI / 2);
  geo.translate((width - bevel * 2) / 2 + x, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  return m;
}
function cyl(r0, r1, len, mat, x, y, z, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg).rotateX(Math.PI / 2), mat);
  m.position.set(x, y, z);
  return m;
}
function box(sx, sy, sz, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z); m.rotation.x = rx;
  return m;
}
function lathe(points, mat, seg = 16) { return new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat); }

function magazine(points, width, mat, plate = true) {
  const g = new THREE.Group();
  g.name = 'mag';
  g.add(prof(points, width, mat));
  if (plate) { const ys = points.map((p) => p[1]), zs = points.map((p) => p[0]); const minY = Math.min(...ys); g.add(box(width + 0.006, 0.01, Math.max(...zs) - Math.min(...zs) + 0.006, materials().gunmetal, 0, minY - 0.002, (Math.max(...zs) + Math.min(...zs)) / 2)); }
  g.userData.home = g.position.clone();
  return g;
}

const BUILDERS = {
  pistol() {
    const m = materials(), g = new THREE.Group();
    // Slide with a chamfered nose and rear serrations; frame with dust-cover rail; angled textured grip.
    g.add(prof([[-0.035, 0.022], [0.155, 0.022], [0.165, 0.032], [0.165, 0.05], [0.155, 0.057], [-0.03, 0.057], [-0.035, 0.05]], 0.03, m.gunmetal));
    for (let i = 0; i < 6; i++) g.add(box(0.032, 0.026, 0.002, m.polymer, 0, 0.04, -0.026 + i * 0.006));
    g.add(prof([[-0.03, 0.0], [0.14, 0.0], [0.15, 0.008], [0.15, 0.022], [-0.03, 0.022]], 0.026, m.polymer));
    g.add(prof([[-0.035, 0.004], [0.022, 0.004], [0.01, -0.095], [-0.045, -0.092], [-0.05, -0.02]], 0.03, m.grip));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0035, 6, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), m.polymer).translateZ(0.04).translateY(0.0));
    g.add(box(0.004, 0.018, 0.004, m.steel, 0, -0.006, 0.033, 0.3));                                   // trigger
    g.add(cyl(0.0065, 0.0065, 0.012, m.steel, 0, 0.038, 0.168));                                       // muzzle
    g.add(box(0.006, 0.006, 0.006, m.steel, 0, 0.061, 0.15), box(0.02, 0.006, 0.006, m.steel, 0, 0.061, -0.028)); // sights
    g.add(magazine([[-0.03, -0.0], [0.006, -0.0], [-0.006, -0.1], [-0.04, -0.098]], 0.022, m.steel));
    return g;
  },
  revolver() {
    const m = materials(), g = new THREE.Group();
    g.add(cyl(0.009, 0.009, 0.17, m.steel, 0, 0.042, 0.11));                                           // barrel
    g.add(box(0.012, 0.012, 0.17, m.steel, 0, 0.052, 0.11));                                           // vent rib
    g.add(box(0.016, 0.014, 0.17, m.steel, 0, 0.03, 0.11));                                            // ejector shroud
    g.add(prof([[-0.04, 0.005], [0.03, 0.005], [0.03, 0.065], [-0.02, 0.065], [-0.045, 0.045]], 0.03, m.steel));
    const drum = new THREE.Group(); drum.name = 'mag';
    drum.add(cyl(0.022, 0.022, 0.042, m.gunmetal, 0, 0, 0, 12));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; drum.add(cyl(0.005, 0.005, 0.043, m.brass, Math.cos(a) * 0.013, Math.sin(a) * 0.013, 0, 6)); }
    drum.position.set(0, 0.036, 0.008); drum.userData.home = drum.position.clone();
    g.add(drum);
    g.add(prof([[-0.04, 0.008], [-0.012, 0.008], [-0.02, -0.04], [-0.03, -0.085], [-0.065, -0.085], [-0.058, -0.03]], 0.032, m.wood));
    g.add(box(0.006, 0.02, 0.012, m.steel, 0, 0.07, -0.042, -0.5));                                   // hammer
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.003, 6, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI), m.steel).translateZ(0.002));
    return g;
  },
  smg() {
    const m = materials(), g = new THREE.Group();
    g.add(prof([[-0.08, 0.0], [0.2, 0.0], [0.22, 0.015], [0.22, 0.055], [-0.07, 0.055], [-0.08, 0.045]], 0.04, m.gunmetal));
    g.add(box(0.02, 0.008, 0.2, m.polymer, 0, 0.06, 0.06));                                           // top rail
    for (let i = 0; i < 9; i++) g.add(box(0.022, 0.004, 0.008, m.gunmetal, 0, 0.066, -0.02 + i * 0.022));
    g.add(cyl(0.016, 0.016, 0.1, m.polymer, 0, 0.028, 0.27));                                          // suppressor-style shroud
    g.add(prof([[-0.02, 0.002], [0.02, 0.002], [0.01, -0.09], [-0.03, -0.088]], 0.032, m.grip));        // grip
    g.add(prof([[0.12, 0.002], [0.145, 0.002], [0.14, -0.07], [0.12, -0.07]], 0.03, m.grip));           // fore grip
    g.add(magazine([[0.05, 0.0], [0.08, 0.0], [0.075, -0.17], [0.045, -0.165]], 0.026, m.polymer));
    // Folding wire stock.
    g.add(box(0.006, 0.006, 0.2, m.steel, 0.018, 0.04, -0.17), box(0.006, 0.006, 0.2, m.steel, -0.018, 0.04, -0.17), box(0.042, 0.06, 0.008, m.polymer, 0, 0.025, -0.27));
    g.add(box(0.012, 0.016, 0.01, m.steel, 0, 0.074, 0.19), box(0.024, 0.016, 0.01, m.steel, 0, 0.074, -0.05));
    return g;
  },
  rifle() {
    const m = materials(), g = new THREE.Group();
    g.add(prof([[-0.1, 0.0], [0.17, 0.0], [0.17, 0.065], [-0.08, 0.065], [-0.1, 0.05]], 0.044, m.gunmetal));      // receiver
    g.add(box(0.024, 0.01, 0.27, m.gunmetal, 0, 0.072, 0.03));                                                     // picatinny rail
    for (let i = 0; i < 12; i++) g.add(box(0.026, 0.005, 0.009, m.polymer, 0, 0.079, -0.1 + i * 0.022));
    g.add(prof([[0.17, 0.005], [0.42, 0.005], [0.42, 0.062], [0.17, 0.062]], 0.05, m.polymer));                   // handguard
    for (let i = 0; i < 7; i++) g.add(box(0.052, 0.012, 0.018, m.gunmetal, 0, 0.033, 0.2 + i * 0.03));           // vents
    g.add(cyl(0.009, 0.009, 0.18, m.steel, 0, 0.034, 0.5), cyl(0.014, 0.014, 0.05, m.gunmetal, 0, 0.034, 0.6));  // barrel, brake
    g.add(box(0.008, 0.04, 0.012, m.gunmetal, 0, 0.08, 0.44));                                                     // front sight post
    g.add(prof([[-0.02, 0.002], [0.025, 0.002], [0.005, -0.095], [-0.035, -0.09]], 0.034, m.grip));
    g.add(prof([[-0.1, 0.06], [-0.1, 0.0], [-0.33, -0.035], [-0.35, -0.03], [-0.35, 0.07], [-0.3, 0.075]], 0.04, m.polymer)); // stock
    g.add(box(0.044, 0.1, 0.012, m.tape, 0, 0.018, -0.35));                                                        // butt pad
    const mag = new THREE.Group(); mag.name = 'mag';
    for (let i = 0; i < 5; i++) { const s = box(0.026, 0.04, 0.06, m.gunmetal, 0, -0.02 - i * 0.034, 0.075 + i * 0.008, -0.12 * i); mag.add(s); }
    mag.userData.home = mag.position.clone();
    g.add(mag);
    // Red-dot sight.
    g.add(cyl(0.017, 0.017, 0.05, m.polymer, 0, 0.1, 0.02), cyl(0.013, 0.013, 0.002, m.glass, 0, 0.1, 0.046));
    const dot = box(0.004, 0.004, 0.002, m.red, 0, 0.1, 0.0); dot.userData.keepEmissive = true; g.add(dot);
    return g;
  },
  shotgun() {
    const m = materials(), g = new THREE.Group();
    g.add(prof([[-0.08, 0.0], [0.12, 0.0], [0.12, 0.06], [-0.07, 0.06], [-0.08, 0.05]], 0.042, m.gunmetal));
    g.add(cyl(0.014, 0.014, 0.52, m.gunmetal, 0, 0.045, 0.38), cyl(0.012, 0.012, 0.42, m.gunmetal, 0, 0.014, 0.33));
    const pump = new THREE.Group(); pump.name = 'pump';
    pump.add(cyl(0.024, 0.024, 0.16, m.wood, 0, 0.014, 0.25, 12));
    for (let i = 0; i < 7; i++) pump.add(cyl(0.0255, 0.0255, 0.006, m.wood, 0, 0.014, 0.19 + i * 0.02, 12));
    pump.userData.home = pump.position.clone();
    g.add(pump);
    g.add(box(0.006, 0.01, 0.006, m.steel, 0, 0.062, 0.63));                                         // bead sight
    g.add(prof([[-0.08, 0.055], [-0.08, 0.0], [-0.06, -0.03], [-0.38, -0.08], [-0.4, -0.075], [-0.4, 0.04], [-0.3, 0.055]], 0.04, m.wood));
    g.add(box(0.042, 0.12, 0.014, m.tape, 0, -0.02, -0.405, 0.15));
    for (let i = 0; i < 3; i++) g.add(cyl(0.009, 0.009, 0.03, new THREE.MeshStandardMaterial({ color: 0xb02020, roughness: 0.6 }), 0.024, 0.02 - i * 0.02, -0.18 - i * 0.004, 8)); // shell holder
    return g;
  },
  sniper() {
    const m = materials(), g = new THREE.Group();
    g.add(prof([[-0.09, 0.0], [0.16, 0.0], [0.16, 0.055], [-0.09, 0.055]], 0.04, m.gunmetal));
    g.add(cyl(0.012, 0.009, 0.52, m.gunmetal, 0, 0.035, 0.42), cyl(0.015, 0.015, 0.06, m.gunmetal, 0, 0.035, 0.7));
    for (let i = 0; i < 6; i++) g.add(box(0.026, 0.002, 0.3, m.polymer, 0, 0.035 + (i % 2 ? 0.0125 : -0.0125), 0.36));
    g.add(prof([[-0.09, 0.05], [0.3, 0.05], [0.3, -0.01], [0.16, -0.02], [-0.06, -0.03], [-0.42, -0.06], [-0.45, -0.05], [-0.45, 0.07], [-0.2, 0.08], [-0.1, 0.065]], 0.05, m.polymer));
    g.add(prof([[-0.04, -0.02], [0.0, -0.02], [-0.015, -0.11], [-0.05, -0.105]], 0.034, m.grip));
    g.add(cyl(0.004, 0.004, 0.05, m.steel, 0.03, 0.05, -0.04).rotateY(Math.PI / 2));                  // bolt handle
    g.add(magazine([[0.02, -0.02], [0.08, -0.02], [0.08, -0.07], [0.02, -0.07]], 0.03, m.gunmetal));
    // Scope: turned tube with objective and eyepiece bells, turrets, lens glass.
    const scope = lathe([[0.0, -0.16], [0.02, -0.16], [0.022, -0.12], [0.015, -0.1], [0.015, 0.08], [0.026, 0.12], [0.026, 0.15], [0.0, 0.15]], m.gunmetal, 18);
    scope.rotation.x = Math.PI / 2; scope.position.set(0, 0.1, 0.02); g.add(scope);
    g.add(cyl(0.006, 0.006, 0.02, m.gunmetal, 0, 0.122, 0.02).rotateX(Math.PI / 2), cyl(0.024, 0.024, 0.002, m.glass, 0, 0.1, 0.171));
    g.add(box(0.012, 0.04, 0.02, m.gunmetal, 0, 0.075, -0.04), box(0.012, 0.04, 0.02, m.gunmetal, 0, 0.075, 0.09));
    // Folded bipod.
    for (const s of [-1, 1]) g.add(box(0.006, 0.006, 0.18, m.steel, s * 0.012, -0.02, 0.38));
    return g;
  },
  bat() {
    const m = materials(), g = new THREE.Group();
    const b = lathe([[0, -0.02], [0.022, -0.02], [0.016, 0.0], [0.014, 0.25], [0.022, 0.45], [0.034, 0.62], [0.034, 0.74], [0.026, 0.76], [0, 0.765]], m.wood, 14);
    b.rotation.x = Math.PI / 2; b.position.z = -0.06;
    g.add(b);
    g.add(cyl(0.0165, 0.0165, 0.16, m.tape, 0, 0, 0.04, 12));
    return g;
  },
  machete() {
    const m = materials(), g = new THREE.Group();
    // Golok: a broad blade swelling towards the tip, slightly curved back edge.
    g.add(prof([[0.06, -0.012], [0.25, -0.02], [0.42, -0.03], [0.5, -0.018], [0.52, 0.006], [0.45, 0.026], [0.25, 0.022], [0.06, 0.016]], 0.005, m.blade, { bevel: 0.0015 }));
    g.add(prof([[-0.08, -0.016], [0.06, -0.016], [0.06, 0.02], [-0.07, 0.022], [-0.09, 0.012]], 0.026, m.wood));
    g.add(box(0.03, 0.044, 0.01, m.steel, 0, 0.002, 0.062));
    for (const z of [-0.04, 0.02]) g.add(cyl(0.004, 0.004, 0.03, m.brass, 0, 0, z).rotateY(Math.PI / 2));
    return g;
  },
};

const cache = new Map();

// Weapon points along +z from the hand; the hand frame's arm points down -y, so we rotate the
// model to lay the barrel along the forearm. Each call returns a fresh clone of a cached model.
export function buildWeaponMesh(id) {
  if (id === 'fists' || !BUILDERS[id]) return null;
  if (!cache.has(id)) {
    const g = BUILDERS[id]();
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    assets.applyEnvironment?.(g);
    cache.set(id, g);
  }
  const g = cache.get(id).clone();
  g.traverse((o) => { if (o.userData.home) o.userData.home = o.position.clone(); });
  g.rotation.x = Math.PI / 2;
  return g;
}

// Silhouette icon for the HUD weapon box.
export function paintWeaponIcon(canvas, id) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f6efe2';
  ctx.save();
  ctx.scale(canvas.width / 64, canvas.height / 30);
  const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); };
  if (id === 'fists') {
    ctx.beginPath(); ctx.roundRect(20, 6, 24, 18, 5); ctx.fill();
    ctx.fillStyle = '#333'; for (let i = 0; i < 3; i++) ctx.fillRect(26 + i * 6, 7, 1, 8);
  } else if (id === 'pistol') {
    ctx.fillRect(14, 8, 34, 7); poly([[16, 14], [25, 14], [23, 27], [14, 26]]); ctx.fillRect(25, 15, 6, 2);
  } else if (id === 'revolver') {
    ctx.fillRect(24, 9, 34, 4); ctx.fillRect(18, 8, 10, 9); poly([[18, 14], [24, 14], [20, 27], [12, 26], [14, 16]]);
  } else if (id === 'smg') {
    ctx.fillRect(8, 9, 44, 8); ctx.fillRect(52, 11, 8, 3); ctx.fillRect(26, 16, 6, 12); ctx.fillRect(12, 16, 7, 9); ctx.fillRect(2, 10, 7, 4);
  } else if (id === 'rifle') {
    ctx.fillRect(14, 9, 40, 7); ctx.fillRect(54, 11, 10, 2); poly([[24, 15], [30, 15], [33, 27], [27, 27]]); ctx.fillRect(17, 15, 5, 8); poly([[0, 10], [14, 9], [14, 16], [2, 19]]); ctx.fillRect(22, 6, 10, 3);
  } else if (id === 'shotgun') {
    ctx.fillRect(14, 10, 48, 4); ctx.fillRect(20, 14, 26, 4); poly([[2, 20], [16, 12], [20, 16], [6, 26]]);
  } else if (id === 'sniper') {
    ctx.fillRect(16, 11, 48, 3); ctx.fillRect(20, 5, 22, 4); poly([[0, 12], [20, 11], [22, 17], [2, 20]]); ctx.fillRect(22, 14, 4, 8);
  } else if (id === 'bat') {
    poly([[4, 16], [30, 14], [60, 11], [62, 15], [60, 19], [30, 17]]);
  } else if (id === 'machete') {
    poly([[22, 13], [50, 11], [62, 13], [60, 18], [40, 18], [22, 17]]); ctx.fillRect(6, 13, 16, 5);
  }
  ctx.restore();
}
