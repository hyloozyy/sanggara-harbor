// Going in and out of buildings. Each enterable place has a real door on a building facade in
// the city (frame, a leaf on hinges, step, awning, sign and lamp). Walk up to it and press E /
// TALK / D-pad up: Raka steps to the door, takes the handle, the door swings open, he walks in
// while the picture fades; inside, the room's own door closes behind him and the camera settles
// in a closer interior framing that never leaves the room. Leaving works the same way back.
// While inside, the city's systems pause and only the room is drawn (cheap on phones); the
// room has its own people, things to use (seats, the bar, the jukebox, the bed...) and sound.
import * as THREE from 'three';
import { Kit, roundedBox } from './shapes.js';
import { interiorMaterials, neonMaterial } from './interior-materials.js';
import { neonTubeTexture } from './interior-textures.js';
import { hingedDoor, sconce, beerGlassMesh, teaGlassMesh, coffeeCupMesh } from './furniture.js';
import { BarInterior } from './bar-interior.js';
import { HomeInterior } from './home-interior.js';
import { ShopInterior } from './shop-interior.js';
import { ClinicInterior } from './clinic-interior.js';
import { InteriorNpc, pick } from './interior-npc.js';
import { CollisionWorld } from '../city/collision-world.js';
import { PLACES, groundHeightAt } from '../city/city-layout.js';
import { SURFACE_WEATHER } from '../render/surface-weather.js';
import { VoiceDirector } from '../audio/voice-actor.js';
import { Radio } from '../audio/radio-stations.js';
import { angleDamp, clamp, damp } from '../core/math-utils.js';
import { formatMoney } from '../core/math-utils.js';
import { ENTERABLE_BY_ID, drawEnterableIcon } from './enterable-places.js';

const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The enterable places, the door each one uses in the city and the look of that door.
export const INTERIOR_DEFS = [
  { id: 'bar', label: 'Kafe Jangkar', place: 'bar', make: () => new BarInterior(), style: 'bar' },
  { id: 'home', label: "Raka's Room", place: 'safehouse', make: () => new HomeInterior(), style: 'home' },
  { id: 'shop', label: 'Toko Berkah', place: 'tokoBerkah', make: () => new ShopInterior(), style: 'shop' },
  { id: 'clinic', label: 'Klinik Sehat', place: 'clinic', make: () => new ClinicInterior(), style: 'clinic' },
];

const JUKEBOX_SONGS = [['dangdut', 'Dangdut: "Dockside Sway"'], ['keroncong', 'Keroncong: "Old Port"'], ['funky', 'Funky Kota: "Running Red Lights"'], ['lofi', 'Lo-fi: "Two AM Coffee"'], ['synthwave', 'Synthwave: "Harbour Lights 1986"']];

export class InteriorManager {
  constructor(game) {
    this.game = game;
    this.active = null;       // the Interior Raka is in
    this.def = null;
    this.trans = null;        // running transition
    this.seat = null;         // seat Raka is on (inside)
    this.sitK = 0;
    this.doors = [];
    this.rooms = new Map();
    this.empty = { collision: Object.assign(new CollisionWorld(), { bounded: false }), groundAt: () => 0 };
    this.fadeEl = document.createElement('div');
    this.fadeEl.id = 'fade-overlay';
    Object.assign(this.fadeEl.style, { position: 'fixed', inset: '0', background: '#000', opacity: '0', pointerEvents: 'none', zIndex: '40' });
    document.body.appendChild(this.fadeEl);
    this.fade = 0;
    this.voices = [0, 1, 2].map(() => { const v = new VoiceDirector(game.audio); v.useSpeech = false; return v; });
    this.jukeboxOn = false;
    this.indoor = 0;
    for (const def of INTERIOR_DEFS) this.placeDoor(def);
  }

  get inside() { return !!this.active; }

  // ---------------------------------------------------------------- city doors
  // Put the door on the facade of the building nearest to the place's sidewalk spot.
  placeDoor(def) {
    const p = PLACES[def.place];
    if (!p) return;
    const col = this.game.city.collision;
    let best = null;
    for (const b of col.query(p.x, p.z, 16)) {
      if (b.tag !== 'building' || b.maxX - b.minX < 2.4 || b.maxZ - b.minZ < 2.4) continue;
      // Nearest point on each face, with its outward normal.
      const faces = [
        { x: clamp(p.x, b.minX + 1, b.maxX - 1), z: b.minZ, nx: 0, nz: -1 }, { x: clamp(p.x, b.minX + 1, b.maxX - 1), z: b.maxZ, nx: 0, nz: 1 },
        { x: b.minX, z: clamp(p.z, b.minZ + 1, b.maxZ - 1), nx: -1, nz: 0 }, { x: b.maxX, z: clamp(p.z, b.minZ + 1, b.maxZ - 1), nx: 1, nz: 0 },
      ];
      for (const f of faces) {
        const d = Math.hypot(f.x - p.x, f.z - p.z);
        const outside = (p.x - f.x) * f.nx + (p.z - f.z) * f.nz > -0.5;
        if (outside && (!best || d < best.d)) best = { ...f, d };
      }
    }
    if (!best) best = { x: p.x, z: p.z - 1.5, nx: 0, nz: 1 };
    const heading = Math.atan2(best.nx, best.nz);   // outward
    const y = groundHeightAt(best.x + best.nx * 0.6, best.z + best.nz * 0.6);
    const door = { def, x: best.x, z: best.z, nx: best.nx, nz: best.nz, heading, y, open: 0, target: 0 };
    this.buildDoorMesh(door);
    this.doors.push(door);
    def.door = door;
  }

  buildDoorMesh(door) {
    const M = interiorMaterials(), k = new Kit(), g = new THREE.Group(), style = door.def.style;
    g.position.set(door.x + door.nx * 0.02, door.y, door.z + door.nz * 0.02);
    g.rotation.y = door.heading;
    // Warm light spilling out of the doorway behind the leaf.
    const glow = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, style === 'clinic' ? '#e8f4f0' : '#ffd090'); gr.addColorStop(0.5, style === 'clinic' ? '#90b0a8' : '#c86a30'); gr.addColorStop(1, '#1a0c06');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 128);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const W = style === 'shop' ? 1.5 : 1.0, Hd = 2.2;
    // A door surround standing proud of the facade (so shop windows behind never show through).
    const sur = style === 'clinic' ? M.white : style === 'shop' ? M.creamPaint : style === 'home' ? M.plasterCream : M.woodDark;
    k.add(roundedBox(W + 0.7, Hd + 0.45, 0.1, 0.02), sur, 0, (Hd + 0.45) / 2, 0.05);
    k.add(new THREE.PlaneGeometry(W, Hd), new THREE.MeshBasicMaterial({ map: glow, color: 0xb0b0b0 }), 0, Hd / 2, 0.102);
    k.push(0, 0, 0.165);
    door.pivot = hingedDoor(k, M, g, { w: W, h: Hd, glass: style === 'bar' || style === 'clinic', mat: style === 'home' ? M.woodTeak : style === 'clinic' ? M.white : style === 'shop' ? M.greenPaint : M.woodDark, backCasing: false, casing: style === 'clinic' ? M.steel : M.woodDark });
    k.pop();
    door.w = W;
    // Step and mat.
    k.add(roundedBox(W + 0.6, 0.1, 0.45, 0.02), M.terrazzo, 0, 0.05, 0.24);
    k.add(roundedBox(W * 0.8, 0.012, 0.35, 0.005), M.rubber, 0, 0.106, 0.26);
    const signMat = (text, bg, fg, w = 512, h = 128, font = 'bold 64px Georgia') => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16);
      x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.35 });
    };
    if (style === 'bar') {
      // Striped canvas awning, a neon name over it and a hanging anchor sign.
      const aw = new THREE.MeshStandardMaterial({ map: stripes('#8a1a1a', '#f0e8d0'), roughness: 0.85, side: THREE.DoubleSide });
      k.add(roundedBox(2.4, 0.03, 1.0, 0.01), aw, 0, 2.62, 0.45, 0, 0.32);
      for (let i = 0; i < 8; i++) k.add(roundedBox(0.3, 0.16, 0.01, 0.005), aw, -1.05 + i * 0.3, 2.42, 0.93);
      k.add(roundedBox(2.4, 0.66, 0.06, 0.02), M.black, 0, 3.25, 0.03);
      const neon = neonMaterial(neonTubeTexture('Kafe Jangkar', '#ff3a8a'), 0xffffff, 2.8);
      const nm = k.mesh(g, new THREE.PlaneGeometry(2.2, 0.55), neon, 0, 3.25, 0.07); nm.castShadow = false;
      k.add(roundedBox(0.04, 0.04, 0.7, 0.01), M.iron, 1.2, 2.95, 0.35);
      k.add(roundedBox(0.03, 0.5, 0.5, 0.01), signMat('⚓', '#1a3a4a', '#f0d080', 128, 128, 'bold 90px serif'), 1.2, 2.62, 0.55, Math.PI / 2);
      for (const sx of [-0.85, 0.85]) { k.push(sx * 1.1, 2.05, 0.1); sconce(k, M); k.pop(); }
    } else if (style === 'home') {
      k.add(roundedBox(0.36, 0.2, 0.02, 0.005), signMat("No. 7", '#2a3a5a', '#f0f0f0', 256, 128, 'bold 70px Georgia'), 0.95, 1.85, 0.11);
      k.add(roundedBox(1.5, 0.05, 0.6, 0.02), M.woodTeak, 0, 2.5, 0.3);
      k.push(-0.95, 2.0, 0.1); sconce(k, M); k.pop();
      for (const sx of [-1.0, 1.0]) { k.push(sx, 0, 0.35); k.add(roundedBox(0.32, 0.3, 0.32, 0.04), M.terracotta, 0, 0.15, 0); k.add(new THREE.SphereGeometry(0.2, 10, 8), M.leaf, 0, 0.42, 0); k.pop(); }
    } else if (style === 'shop') {
      k.add(roundedBox(3.0, 0.7, 0.08, 0.02), signMat('TOKO BERKAH', '#1a6a3a', '#ffe060', 768, 160, 'bold 96px Impact'), 0, 2.9, 0.05);
      const aw = new THREE.MeshStandardMaterial({ map: stripes('#1a6a3a', '#f0e8d0'), roughness: 0.85, side: THREE.DoubleSide });
      k.add(roundedBox(3.0, 0.03, 0.9, 0.01), aw, 0, 2.48, 0.42, 0, 0.3);
      k.add(roundedBox(0.7, 0.9, 0.04, 0.01), signMat('ES TEH', '#e8c020', '#a01a1a', 256, 320, 'bold 70px Impact'), -1.35, 1.2, 0.03);
      k.push(1.3, 0, 0.45); k.add(roundedBox(0.5, 0.9, 0.5, 0.03), M.plasticRed, 0, 0.45, 0); k.add(roundedBox(0.44, 0.5, 0.02, 0.01), M.glass, 0, 0.6, 0.26); k.pop();
    } else if (style === 'clinic') {
      k.add(roundedBox(2.4, 0.6, 0.1, 0.03), signMat('KLINIK SEHAT', '#f4f8f6', '#1a8a6a', 768, 160, 'bold 88px sans-serif'), 0, 2.8, 0.05);
      const cross = new THREE.MeshStandardMaterial({ color: 0x1aa87a, emissive: 0x1ad89a, emissiveIntensity: 2.2 });
      k.add(roundedBox(0.12, 0.42, 0.06, 0.02), cross, 1.45, 2.8, 0.08); k.add(roundedBox(0.42, 0.12, 0.06, 0.02), cross, 1.45, 2.8, 0.08);
      k.push(-1.0, 2.05, 0.1); sconce(k, M); k.pop();
    }
    // A blade sign on the pavement, readable from both directions along the street.
    const ent = ENTERABLE_BY_ID[door.def.id];
    const sx = style === 'bar' ? -1.9 : 1.9 + (W - 1) * 0.5;
    k.push(sx, 0, 2.05);
    k.add(new THREE.CylinderGeometry(0.035, 0.045, 2.5, 10), M.iron, 0, 1.25, 0);
    k.add(new THREE.CylinderGeometry(0.16, 0.2, 0.06, 14), M.iron, 0, 0.03, 0);
    k.add(roundedBox(0.04, 0.62, 0.98, 0.015), M.iron, 0, 2.08, -0.1);
    k.add(new THREE.PlaneGeometry(0.94, 0.58), streetSignMat(ent, true), 0.022, 2.08, -0.1, Math.PI / 2);
    k.add(new THREE.PlaneGeometry(0.94, 0.58), streetSignMat(ent, false), -0.022, 2.08, -0.1, -Math.PI / 2);
    k.pop();
    this.buildBeacon(door, g, ent);
    const statics = k.build({ name: 'door-' + door.def.id });
    g.add(statics);
    this.game.scene.add(g);
    door.group = g;
  }

  // A soft light pillar and a floating house badge over the door, seen from blocks away.
  buildBeacon(door, g, ent) {
    const col = new THREE.Color(ent.color);
    const b = new THREE.Group();
    b.position.set(0, 0, 1.7);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 16, 14, 1, true),
      new THREE.MeshBasicMaterial({ map: beaconTexture(), color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    pillar.position.y = 4.4 + 8;
    pillar.renderOrder = 5;
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(ent), transparent: true, depthWrite: false, fog: false }));
    badge.scale.set(1.5, 1.5 * 0.75, 1);
    badge.renderOrder = 6;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.set(2.6, 2.6, 1);
    halo.renderOrder = 4;
    b.add(pillar, badge, halo);
    for (const o of [pillar, badge, halo]) { o.castShadow = false; o.receiveShadow = false; }
    g.add(b);
    door.beacon = { group: b, pillar, badge, halo, t: Math.random() * 6 };
  }

  updateBeacon(d, dt, dist) {
    const bc = d.beacon;
    if (!bc) return;
    bc.t += dt;
    // Fade out right at the door (it would only be in the way), stay bright from afar.
    const near = clamp((dist - 3) / 6, 0, 1);
    const y = 4.4 + Math.sin(bc.t * 1.8) * 0.12;
    bc.badge.position.y = y; bc.halo.position.y = y;
    bc.badge.material.opacity = 0.25 + 0.75 * near;
    bc.halo.material.opacity = (0.55 + 0.25 * Math.sin(bc.t * 3.1)) * (0.3 + 0.7 * near);
    bc.pillar.material.opacity = 0.5 * near;
    // Keep the badge readable from far away: grow a little with distance.
    const s = 1.5 * (1 + clamp((dist - 25) / 120, 0, 1.6));
    bc.badge.scale.set(s, s * 0.75, 1); bc.halo.scale.setScalar(s * 1.7);
  }

  // ---------------------------------------------------------------- per frame (outside)
  nearestDoor() {
    const b = this.game.player.body;
    if (this.game.player.vehicle || !b.alive) return null;
    let best = null, bd = 1.9;
    for (const d of this.doors) {
      const ox = b.pos.x - d.x, oz = b.pos.z - d.z;
      const front = ox * d.nx + oz * d.nz, side = Math.abs(ox * d.nz - oz * d.nx);
      if (front < 0.1 || front > 2.2 || side > 1.3) continue;
      const dist = Math.hypot(ox, oz);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  // The hint the HUD shows (and the label of the touch button).
  hint() {
    const g = this.game;
    if (this.trans) return null;
    if (this.active) {
      if (this.seat) return this.sitK > 0.95 ? `<kbd>E</kbd>Stand up${this.nearBartender() ? ' · talk to the bartender: <kbd>E</kbd> while he is in front of you' : ''}` : null;
      const u = this.usable;
      if (u) return `<kbd>E</kbd>${u.label}`;
      return null;
    }
    const d = this.nearestDoor();
    if (!d) return null;
    if (g.wanted.level > 0) return `🔒 ${d.def.label} — lose the police first`;
    return `<kbd>E</kbd>Enter ${d.def.label}`;
  }

  nearBartender() { return false; }

  // Label for the contextual touch button (null: nothing to do here).
  actionLabel() {
    if (this.trans) return null;
    if (this.active) {
      if (this.seat) return this.sitting?.phase === 'seated' ? (this.bartenderInFront() ? null : 'STAND') : null;
      const u = this.usable;
      if (!u) return null;
      return u.kind === 'seat' ? 'SIT' : u.spot.exit ? 'EXIT' : 'USE';
    }
    return this.doorCandidate ? 'ENTER' : null;
  }

  // Someone inside was spoken to: the room writes the conversation.
  beginTalk(conv, c) {
    conv.profile = c.interiorNpc.profile;
    const room = this.active;
    if (room?.beginTalk?.(conv, c.interiorNpc, this)) return;
    conv.say('raka', pick(['Evening.', 'Hey.', 'How\'s it going?']));
    conv.npc(pick(['Evening.', 'Not bad, not bad.', 'Mm.']));
    conv.pendingChoices = [];
  }

  // Called from the session each frame, before the conversations (E is shared with talking).
  update(dt) {
    const g = this.game;
    g.eConsumed = false;
    this.updateFade(dt);
    this.updateDoors(dt);
    this.updateMusic(dt);
    if (this.trans) { this.updateTransition(dt); return; }
    if (this.active) return;
    const d = this.nearestDoor();
    this.doorCandidate = d;
    const talkNear = g.talk.candidate && Math.hypot(g.talk.candidate.pos.x - g.player.pos.x, g.talk.candidate.pos.z - g.player.pos.z) < 1.2;
    if (d && !talkNear && g.input.hit('KeyE') && !g.talk.partner) {
      g.eConsumed = true;
      if (g.wanted.level > 0) { g.hud.notify('The door stays shut while the police are after you'); return; }
      this.beginEnter(d);
    }
  }

  updateDoors(dt) {
    const p = this.game.player.pos;
    for (const d of this.doors) {
      if (!this.active) this.updateBeacon(d, dt, Math.hypot(p.x - d.x, p.z - d.z));
      if (!this.active && Math.abs(p.x - d.x) + Math.abs(p.z - d.z) > 60 && d.open === 0) continue;
      d.open = damp(d.open, d.target, d.target > d.open ? 5 : 3.2, dt);
      if (Math.abs(d.open - d.target) < 0.002) d.open = d.target;
      // City doors open outwards, towards the street.
      d.pivot.rotation.y = -1.55 * ease(d.open);
    }
  }

  updateFade(dt) {
    const want = this.fadeTarget ?? 0;
    this.fade = want > this.fade ? Math.min(want, this.fade + dt / 0.45) : Math.max(want, this.fade - dt / 0.6);
    this.fadeEl.style.opacity = String(ease(this.fade));
  }

  // ---------------------------------------------------------------- transitions
  beginEnter(door) {
    const g = this.game, b = g.player.body;
    b.aiming = false;
    g.player.entering = null;
    const hand = 0.22;   // stand a little to the handle side
    const sx = door.x + door.nx * 1.05 - door.nz * hand, sz = door.z + door.nz * 1.05 + door.nx * hand;
    this.trans = { kind: 'enter', door, t: 0, phase: 'walk', stand: { x: sx, z: sz } };
  }

  updateTransition(dt) {
    const g = this.game, b = g.player.body, T = this.trans;
    T.t += dt;
    const rig = g.cameraRig;
    if (T.kind === 'enter') {
      const d = T.door, inward = wrap(d.heading + Math.PI);
      rig.yaw = angleDamp(rig.yaw, inward, 3, dt); rig.pitch = damp(rig.pitch, 0.12, 3, dt);
      if (T.phase === 'walk') {
        const dx = T.stand.x - b.pos.x, dz = T.stand.z - b.pos.z, dist = Math.hypot(dx, dz);
        const sp = Math.min(2.2, dist * 3);
        if (dist > 0.12 && T.t < 2.5) b.move(dt, g.world, dx / dist * sp, dz / dist * sp, null, 10);
        else { T.phase = 'open'; T.t = 0; }
      } else if (T.phase === 'open') {
        b.move(dt, g.world, 0, 0, inward, 9);
        b.reach = Math.min(1, T.t / 0.3) * (1 - ease((T.t - 0.7) / 0.3));
        if (T.t > 0.25 && d.target === 0) { d.target = 1; g.sound.doorCreak?.(d.x, d.z, d.def.style === 'bar'); }
        if (T.t > 0.85) { T.phase = 'in'; T.t = 0; b.reach = 0; }
      } else if (T.phase === 'in') {
        // Walk through the doorway (no collision: the building is a solid block from outside).
        const tx = d.x - d.nx * 0.8, tz = d.z - d.nz * 0.8;
        const dx = tx - b.pos.x, dz = tz - b.pos.z, dist = Math.hypot(dx, dz) || 1;
        b.move(dt, this.empty, dx / dist * 1.5, dz / dist * 1.5, inward, 10);
        rig.distance = damp(rig.distance, 2.6, 3, dt);
        if (T.t > 0.35) this.fadeTarget = 1;
        if (T.t > 1.05 && this.fade >= 0.999) this.swapIn(d);
      }
      b.updateVisual(dt);
      return;
    }
    if (T.kind === 'arrive') {
      // Inside: the room's door closes behind Raka as he takes a few steps in.
      const room = this.active, e = room.entry;
      this.fadeTarget = 0;
      const tx = e.x + Math.sin(e.heading) * 0.55, tz = e.z + Math.cos(e.heading) * 0.55;
      const dx = tx - b.pos.x, dz = tz - b.pos.z, dist = Math.hypot(dx, dz);
      const sp = dist > 0.05 ? Math.min(1.4, dist * 3) : 0;
      b.move(dt, room.world, dist > 0.05 ? dx / dist * sp : 0, dist > 0.05 ? dz / dist * sp : 0, e.heading, 8);
      if (T.t > 0.35) room.exitDoor.target = 0;
      if (T.t > 0.95 && !T.shut) { T.shut = true; g.sound.doorShut?.(e.x, e.z + 1, 0.8); }
      b.updateVisual(dt);
      if (T.t > 1.3) this.trans = null;
      return;
    }
    if (T.kind === 'leave') {
      const room = this.active, e = room.entry, out = wrap(e.heading + Math.PI), D = room.exitDoor;
      rig.yaw = angleDamp(rig.yaw, out, 3, dt);
      if (T.phase === 'walk') {
        const sx = e.x + Math.sin(e.heading) * 0.15, sz = e.z + Math.cos(e.heading) * 0.15;
        const dx = sx - b.pos.x, dz = sz - b.pos.z, dist = Math.hypot(dx, dz);
        if (dist > 0.12 && T.t < 3) b.move(dt, room.world, dx / dist * Math.min(2, dist * 3), dz / dist * Math.min(2, dist * 3), null, 10);
        else { T.phase = 'open'; T.t = 0; }
      } else if (T.phase === 'open') {
        b.move(dt, room.world, 0, 0, out, 9);
        b.reach = Math.min(1, T.t / 0.3) * (1 - ease((T.t - 0.7) / 0.3));
        if (T.t > 0.25 && D.target === 0) { D.target = 1; g.sound.doorCreak?.(D.x, D.z, room.id === 'bar'); }
        if (T.t > 0.9) { T.phase = 'out'; T.t = 0; b.reach = 0; }
      } else if (T.phase === 'out') {
        const tx = e.x - Math.sin(e.heading) * 1.4, tz = e.z - Math.cos(e.heading) * 1.4;
        const dx = tx - b.pos.x, dz = tz - b.pos.z, dist = Math.hypot(dx, dz) || 1;
        b.move(dt, this.empty, dx / dist * 1.4, dz / dist * 1.4, out, 10);
        if (T.t > 0.35) this.fadeTarget = 1;
        if (T.t > 1.0 && this.fade >= 0.999) this.swapOut();
      }
      b.updateVisual(dt);
      return;
    }
    if (T.kind === 'outside') {
      // Back in the street: step away from the door as it swings shut.
      const d = T.door;
      this.fadeTarget = 0;
      const tx = d.x + d.nx * 1.5, tz = d.z + d.nz * 1.5;
      const dx = tx - b.pos.x, dz = tz - b.pos.z, dist = Math.hypot(dx, dz);
      const sp = dist > 0.05 ? Math.min(1.5, dist * 3) : 0;
      b.move(dt, T.t < 0.5 ? this.empty : g.world, dist > 0.05 ? dx / dist * sp : 0, dist > 0.05 ? dz / dist * sp : 0, d.heading, 8);
      if (T.t > 0.5) d.target = 0;
      if (T.t > 1.05 && !T.shut) { T.shut = true; g.sound.doorShut?.(d.x, d.z, 1); }
      b.updateVisual(dt);
      if (T.t > 1.3) this.trans = null;
    }
  }

  // Behind the black: build the room on first visit, move Raka and the camera into it.
  swapIn(door) {
    const g = this.game, b = g.player.body, def = door.def;
    let room = this.rooms.get(def.id);
    if (!room) { room = def.make(); this.rooms.set(def.id, room); }
    room.build(g.gfx.renderer);
    door.target = 0; door.open = 0;
    this.active = room; this.def = def;
    room.scene.add(b.mesh);
    g.world = room.world;
    g.cameraRig.collision = room.collision;
    g.cameraRig.interior = { ceiling: room.ceilingY };
    g.gfx.activeScene = room.scene;
    g.gfx.camera.near = 0.08; g.gfx.camera.updateProjectionMatrix();
    const e = room.entry;
    b.pos.set(e.x - Math.sin(e.heading) * 0.55, 0, e.z - Math.cos(e.heading) * 0.55);
    b.heading = e.heading; b.lastHeading = e.heading; b.vel.set(0, 0, 0);
    b.model.anim.fresh = true;
    if (b.model.heldItem) b.model.heldItem.visible = false;
    room.exitDoor.open = 1; room.exitDoor.target = 1;
    g.cameraRig.yaw = e.heading; g.cameraRig.pitch = 0.1; g.cameraRig.distance = 1.8;
    g.cameraRig.current.set(b.pos.x, 0, b.pos.z);
    this.trans = { kind: 'arrive', t: 0 };
    g.hud.notify(def.label, 'district');
    g.events?.emit?.('interior-entered', { id: def.id });
    room.onEnter?.(g, this);
  }

  beginLeave() {
    const g = this.game;
    if (g.talk.partner) g.talk.end(true);
    this.trans = { kind: 'leave', t: 0, phase: 'walk' };
  }

  swapOut(instant = false) {
    const g = this.game, b = g.player.body, room = this.active, door = this.def.door;
    if (this.seat) { this.seat.occupant = null; this.seat = null; this.sitK = 0; b.sit = null; }
    this.dropHeld();
    room.exitDoor.target = 0; room.exitDoor.open = 0;
    room.onLeave?.(g, this);
    g.scene.add(b.mesh);
    g.world = { collision: g.city.collision };
    g.cameraRig.collision = g.city.collision;
    g.cameraRig.interior = null;
    g.gfx.activeScene = null;
    g.gfx.camera.near = 0.3; g.gfx.camera.updateProjectionMatrix();
    this.active = null; this.def = null;
    b.pos.set(door.x + door.nx * 0.45, door.y, door.z + door.nz * 0.45);
    b.heading = door.heading; b.lastHeading = door.heading; b.vel.set(0, 0, 0);
    b.model.anim.fresh = true;
    if (b.model.heldItem) b.model.heldItem.visible = true;
    g.player.heldId = null;   // re-sync the weapon in the hand
    g.cameraRig.yaw = door.heading; g.cameraRig.pitch = 0.15; g.cameraRig.distance = 2.6;
    g.cameraRig.current.set(b.pos.x, b.pos.y, b.pos.z);
    door.open = instant ? 0 : 1; door.target = instant ? 0 : 1;
    this.trans = instant ? null : { kind: 'outside', t: 0, door };
    if (instant) { this.fade = 0; this.fadeTarget = 0; }
  }

  // Loading a save (or dying) while inside: straight back to the street.
  forceExit() { if (this.active) { this.trans = null; this.swapOut(true); } }

  // Where a save made inside puts Raka (the pavement in front of the door).
  savePosition() {
    if (!this.def) return null;
    const d = this.def.door;
    return { x: d.x + d.nx * 1.2, z: d.z + d.nz * 1.2 };
  }

  // ---------------------------------------------------------------- inside: Raka
  updateInside(dt) {
    const g = this.game, room = this.active, input = g.input, b = g.player.body;
    try { room.update(dt, g); } catch (e) { if (!this.warned) { this.warned = true; console.error(e); } }
    if (this.trans) return;
    // Sitting down / sitting / getting up.
    if (this.seat) {
      const s = this.seat, S = this.sitting;
      const moving = Math.abs(input.axis('KeyA', 'KeyD')) + Math.abs(input.axis('KeyS', 'KeyW')) > 0.5;
      if (S.phase === 'down') {
        S.t += dt;
        b.heading = angleDamp(b.heading, s.heading, 7, dt);
        const turned = Math.abs(wrap(b.heading - s.heading)) < 0.45 || S.t > 0.9;
        if (turned) {
          S.k = Math.min(1, S.k + dt / 0.9);
          const e = ease(S.k);
          b.pos.x = S.from.x + (s.x - S.from.x) * e; b.pos.z = S.from.z + (s.z - S.from.z) * e;
          if (S.k >= 1) S.phase = 'seated';
        }
      } else if (S.phase === 'seated') {
        if (this.sleeping) { this.updateSleep(dt); b.updateVisual(dt, 0); return; }
        b.heading = angleDamp(b.heading, s.heading, 5, dt);
        if (!g.talk.partner && !g.talk.choosing && ((input.hit('KeyE') && !this.bartenderInFront()) || moving || input.hit('Space'))) { g.eConsumed = true; S.phase = 'up'; S.k = 1; S.to = InteriorNpc.seatFront(s, 0.5); }
      } else if (S.phase === 'up') {
        S.k = Math.max(0, S.k - dt / 0.8);
        const e = ease(S.k);
        b.pos.x = S.to.x + (s.x - S.to.x) * e; b.pos.z = S.to.z + (s.z - S.to.z) * e;
        if (S.k <= 0) { s.occupant = null; this.seat = null; this.sitting = null; }
      }
      this.sitK = this.sitting ? this.sitting.k : 0;
      b.sit = this.seat ? { k: this.sitK, seatY: s.seatY, footY: s.footY, footZ: s.footZ, arms: s.arms, footPitch: s.kind === 'stool' ? 0.25 : 0 } : null;
      b.vel.set(0, 0, 0);
      b.anim = 'auto';
      b.updateVisual(dt, 0);
      this.usable = null;
      return;
    }
    b.sit = null;
    // Walking about: camera-relative, a calmer pace indoors; no weapons, no jumping on tables.
    const cam = g.cameraRig.forward;
    const ix = input.axis('KeyA', 'KeyD'), iz = input.axis('KeyS', 'KeyW');
    let wx = cam.x * iz - cam.z * ix, wz = cam.z * iz + cam.x * ix;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const sprint = input.down('ShiftLeft') && len > 0;
    const speed = sprint ? 4.2 : 2.5;
    b.aiming = false;
    b.anim = 'auto';
    b.move(dt, room.world, wx * speed, wz * speed, null, 10);
    b.updateVisual(dt);
    // Footsteps on this room's floor.
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.stride = (this.stride || 0) + sp * dt;
    if (sp > 0.5 && this.stride > (sp > 3.5 ? 1.2 : 0.74)) { this.stride = 0; g.sound.footstep(b.pos.x, b.pos.z, { running: sp > 3.5, ground: room.floorAt?.(b.pos.x, b.pos.z) || 'tile' }); }
    // Seats and things to use.
    this.usable = room.nearestUsable(b);
    const talkNear = g.talk.candidate && Math.hypot(g.talk.candidate.pos.x - b.pos.x, g.talk.candidate.pos.z - b.pos.z) < 1.4;
    if (this.usable && talkNear && this.usable.kind === 'seat') this.usable = null;
    if (this.usable && input.hit('KeyE') && !g.talk.partner && !g.talk.choosing) {
      g.eConsumed = true;
      const u = this.usable;
      if (u.kind === 'seat') this.sitOn(u.seat);
      else if (u.spot.exit) this.beginLeave();
      else u.spot.run(g, this);
    }
  }

  sitOn(seat) {
    const b = this.game.player.body;
    seat.occupant = 'player';
    this.seat = seat;
    this.sitting = { phase: 'down', t: 0, k: 0, from: { x: b.pos.x, z: b.pos.z } };
  }

  // Raka seated at the counter with the bartender right across: E talks instead of standing.
  bartenderInFront() {
    const g = this.game, c = g.talk.candidate;
    return !!(c && c.interiorNpc?.talkScript && this.seat);
  }

  // ---------------------------------------------------------------- things in hand
  hold(kind) {
    const b = this.game.player.body, M = interiorMaterials();
    const mesh = kind === 'beer' ? beerGlassMesh(M) : kind === 'tea' ? teaGlassMesh(M) : coffeeCupMesh(M);
    mesh.scale.setScalar(1 / (b.mesh.scale.x || 1));
    b.model.hold(mesh);
    this.held = kind;
  }

  dropHeld() {
    if (!this.held) return;
    const b = this.game.player.body;
    b.model.hold(null);
    this.held = null;
    this.game.player.heldId = null;
  }

  // Raka drinks what he was served (a few sips), then the glass goes back on the counter.
  drink(kind, heal, sips = 2) {
    const g = this.game, b = g.player.body;
    this.hold(kind);
    let n = 0;
    const sip = () => {
      if (!this.active || this.held !== kind) return;
      b.playGesture('drink', 2.4);
      n++;
      if (n < sips) setTimeout(sip, 3200);
      else setTimeout(() => { if (this.held === kind) this.dropHeld(); }, 2600);
    };
    setTimeout(sip, 300);
    b.health = Math.min(b.maxHealth, b.health + heal);
    if (kind === 'coffee') g.player.stamina = 1;
  }

  // The bartender set the drink down: Raka takes it and drinks.
  serveDrink(kind, heal) {
    if (!this.active) return;
    this.game.hud.notify(kind === 'beer' ? 'Bir Jangkar · +health' : kind === 'tea' ? 'Es teh manis · +health' : 'Kopi tubruk · +health, stamina', 'xp');
    this.drink(kind, heal, kind === 'beer' ? 3 : 2);
  }

  // Things at home that can be used once in a while.
  useOnce(key, cooldown, fn) {
    const now = this.game.time;
    this.cool ||= {};
    if (this.cool[key] && now < this.cool[key]) { this.game.hud.notify('Not right now'); return; }
    this.cool[key] = now + cooldown;
    fn();
  }

  // Cooking noodles: stir the wok over the flame (with the sizzle), then eat.
  cook(room) {
    const g = this.game, b = g.player.body;
    b.heading = 0 + Math.PI;
    let n = 0;
    const stir = () => {
      if (!this.active || this.active !== room) return;
      b.playGesture('wipe', 1.6);
      g.audio.noise?.(1.6, { filter: 'bandpass', freq: 3200, q: 0.7, gain: 0.05, attack: 0.1, decay: 1.6 });
      if (++n < 3) setTimeout(stir, 1600);
      else setTimeout(() => { b.health = Math.min(b.maxHealth, b.health + 40); g.hud.notify('Mie goreng · +40 health', 'xp'); }, 1700);
    };
    stir();
  }

  // Sleep in the bed: lie back, the night passes in a fade, morning, game saved.
  sleep(seat) {
    if (seat.occupant && seat.occupant !== 'player') return;
    if (!this.seat) this.sitOn(seat);
    this.sleeping = { t: 0, done: false };
  }

  updateSleep(dt) {
    const S = this.sleeping, g = this.game;
    if (!S || this.sitting?.phase !== 'seated') return;
    S.t += dt;
    if (!S.done) {
      this.fadeTarget = 1;
      if (this.fade >= 0.999) {
        S.done = true; S.t = 0;
        const c = g.weather.clock;
        c.hour = 7.0; c.compute?.();
        const b = g.player.body; b.health = b.maxHealth;
        g.saveGame("Raka's Room");
        g.hud.notify('You slept until morning · health restored', 'xp');
      }
    } else if (S.t > 1.2) { this.fadeTarget = 0; if (S.t > 2.2) this.sleeping = null; }
  }

  // ---------------------------------------------------------------- menus
  menu(items) {
    const t = this.game.talk;
    t.showChoices(items.map((it) => ({ label: it.label, run: () => { t.used = null; it.run?.(); return false; } })));
  }

  pay(amount, what) {
    const p = this.game.progression;
    if (p.money < amount) { this.game.hud.notify(`Not enough cash for ${what}`); return false; }
    p.addMoney(-amount, what);
    this.game.sound.money?.();
    return true;
  }

  // Townsfolk chatting inside: babble with lip-sync from a small pool of voices.
  babble(npc, line) {
    const v = this.voices.find((x) => !x.current || x.current.character == null || x.current.wallEnd < performance.now() / 1000) || this.voices[0];
    v.listener = this.game.voices.listener;
    v.babble(line, npc.profile, npc.body, npc.body.pos);
  }

  // ---------------------------------------------------------------- music and room sound
  playJukebox(stationId) {
    const a = this.game.audio;
    if (!this.juke) {
      this.juke = new Radio(a);
      this.jukeBus = null;
    }
    if (a.ctx && !this.jukeBus) {
      const c = a.ctx;
      this.jukeFilter = c.createBiquadFilter(); this.jukeFilter.type = 'lowpass'; this.jukeFilter.frequency.value = 6000;
      this.jukeBus = c.createGain(); this.jukeBus.gain.value = 0;
      this.jukeBus.connect(this.jukeFilter).connect(a.music);
      this.juke.dest = this.jukeBus;
    }
    const idx = this.juke.stations.findIndex((s) => s.id === stationId);
    this.juke.index = Math.max(0, idx);
    this.juke.songIndex = Math.floor(Math.random() * 4); this.juke.seed = Math.floor(Math.random() * 1000); this.juke.step = 0;
    this.juke.setOn(true);
    this.jukeboxOn = true;
  }

  stopJukebox() { this.jukeboxOn = false; this.juke?.setOn(false); }

  updateMusic(dt) {
    const g = this.game, a = g.audio;
    // Indoors the street is muffled; the room's own sound takes over.
    const room = this.active;
    this.indoor = damp(this.indoor, room && (!this.trans || this.trans.kind === 'arrive') ? 1 : 0, 3, dt);
    a.indoor = this.indoor;
    if (!this.juke || !this.jukeBus || !a.ctx) return;
    // The jukebox: loud by the machine, quieter across the room, a muffled thump outside the door.
    let gain = 0, cutoff = 6000;
    const barDoor = INTERIOR_DEFS[0].door;
    if (this.jukeboxOn) {
      if (room?.id === 'bar') {
        const p = g.player.pos, j = room.jukeboxPos, d = Math.hypot(p.x - j.x, p.z - j.z);
        gain = 1.15 / (1 + d * 0.12);
      } else if (barDoor) {
        const p = g.player.pos, d = Math.hypot(p.x - barDoor.x, p.z - barDoor.z);
        gain = d < 18 ? 0.35 * (1 - d / 18) : 0; cutoff = 420;
      }
    }
    this.jukeBus.gain.setTargetAtTime(gain, a.now, 0.3);
    this.jukeFilter.frequency.setTargetAtTime(cutoff, a.now, 0.3);
    if (gain > 0.001) this.juke.update(dt);
  }
}

function stripes(a, b) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * 16, 0, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1);
  return t;
}

export { pick, formatMoney, SURFACE_WEATHER };

// The pavement sign: coloured header with the house badge, the place's name and MASUK with an
// arrow pointing at the door (each face of the blade gets its own, so the arrow is never mirrored).
function streetSignMat(ent, doorOnRight) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 236; const x = c.getContext('2d');
  x.fillStyle = '#10141c'; x.fillRect(0, 0, 384, 236);
  x.fillStyle = ent.color; x.fillRect(0, 0, 384, 78);
  x.strokeStyle = '#f4efe0'; x.lineWidth = 6; x.strokeRect(5, 5, 374, 226);
  drawEnterableIcon(x, doorOnRight ? 44 : 340, 40, 22, '#10141c', ent.glyph);
  x.fillStyle = '#10141c'; x.font = 'bold 44px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('MASUK', doorOnRight ? 200 : 184, 42);
  x.fillStyle = '#f4efe0'; x.font = 'bold 38px Georgia, serif';
  x.fillText(ent.label, 192, 120, 350);
  x.fillStyle = ent.color; x.font = 'bold 28px sans-serif';
  x.fillText(doorOnRight ? `${ent.kind.toUpperCase()}  ➜` : `⟵  ${ent.kind.toUpperCase()}`, 192, 186);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.45 });
}

let beaconTex = null, haloTex = null;
function beaconTexture() {
  if (beaconTex) return beaconTex;
  const c = document.createElement('canvas'); c.width = 4; c.height = 128; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
  beaconTex = new THREE.CanvasTexture(c);
  return beaconTex;
}
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}
function badgeTexture(ent) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d');
  drawEnterableIcon(x, 128, 72, 46, ent.color, ent.glyph);
  x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(ent.label, 128, 160);
  x.fillStyle = '#fff'; x.fillText(ent.label, 128, 160);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
