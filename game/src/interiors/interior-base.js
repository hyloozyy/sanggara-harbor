// One enterable interior: its own scene (so the city is not drawn while inside, which keeps
// phones fast), its own collision world, lights with soft shadows, an environment map baked
// from the room itself (bottles, chrome and glass reflect the actual room), the furnished
// layout, the people who live or work there, seats, things to use and the door back out.
// Subclasses describe the room in layout(); the manager handles going in and out.
import * as THREE from 'three';
import { CollisionWorld } from '../city/collision-world.js';
import { Kit, roundedBox } from './shapes.js';
import { interiorMaterials } from './interior-materials.js';
import { hingedDoor } from './furniture.js';

const WALL_T = 0.16;

export class Interior {
  constructor(id, { name, ceiling = 3.2 } = {}) {
    this.id = id;
    this.name = name;
    this.ceilingY = ceiling;
    this.built = false;
    this.seats = [];          // { x, z, heading, seatY, footY, footZ, arms, kind, occupant }
    this.spots = [];          // interactables: { x, z, r, label, run(game), when(game) }
    this.doors = [];          // inner doors that swing open for anyone walking through
    this.npcs = [];           // InteriorNpc behaviours
    this.animated = [];       // per-frame callbacks (fans, lights, clocks)
    this.nav = [];            // waypoints people walk between
    this.time = 0;
    this.audioState = { music: 0, chatter: 0, street: 0.3 };
  }

  // Build once, on first entry.
  build(renderer) {
    if (this.built) return;
    this.built = true;
    this.M = interiorMaterials();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050403);
    this.collision = new CollisionWorld();
    this.collision.bounded = false;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.dynamic = new THREE.Group();
    this.scene.add(this.dynamic);
    const k = new Kit();
    this.k = k;
    this.layout(k, this.M);
    const statics = k.build({ name: this.id + '-static' });
    this.root.add(statics);
    this.statics = statics;
    this.bakeEnvironment(renderer);
  }

  // Subclasses: build the room. Must set this.entry = { x, z, heading } (where Raka stands
  // just inside, facing into the room) and this.exitDoor (the inner door's pivot).
  layout() {}

  // Reflections: a small cube map rendered from the middle of the room at eye height.
  bakeEnvironment(renderer) {
    const pm = new THREE.PMREMGenerator(renderer);
    const c = this.envCenter || { x: 0, y: 1.6, z: 0 };
    this.scene.position.set(-c.x, -c.y, -c.z);
    this.scene.updateMatrixWorld(true);
    const shadows = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;
    const rt = pm.fromScene(this.scene, 0.03, 0.05, 60);
    renderer.shadowMap.enabled = shadows;
    this.scene.position.set(0, 0, 0);
    this.scene.updateMatrixWorld(true);
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = this.envIntensity ?? 0.7;
    pm.dispose();
  }

  // ------------------------------------------------------------------ room shell
  // Floor and ceiling of a rectangular room.
  floor(k, x0, z0, x1, z1, mat, ceilMat = this.M.ceiling, ceilY = this.ceilingY) {
    const w = x1 - x0, d = z1 - z0;
    const fg = new THREE.PlaneGeometry(w, d); fg.rotateX(-Math.PI / 2);
    const uv = fg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    k.add(fg, mat, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    if (ceilMat) {
      const cg = new THREE.PlaneGeometry(w, d); cg.rotateX(Math.PI / 2);
      const cu = cg.attributes.uv; for (let i = 0; i < cu.count; i++) cu.setXY(i, cu.getX(i) * w, cu.getY(i) * d);
      k.add(cg, ceilMat, (x0 + x1) / 2, ceilY, (z0 + z1) / 2);
    }
  }

  // An axis-aligned wall from (ax, az) to (bx, bz). `inside` is a point in the room the
  // decorated face looks at. Openings: [{ at (m from a), w, h, sill }]. Upper and lower wall
  // finishes, a baseboard, a chair rail over the wainscot and a cornice; colliders per piece.
  wall(k, ax, az, bx, bz, { inside, upper, lower = null, lowerH = 1.0, openings = [], both = false, other = null, h = this.ceilingY, rail = this.M.woodDark, base = this.M.woodDark, cornice = true } = {}) {
    let dx = bx - ax, dz = bz - az;
    const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const nx = -dz, nz = dx;
    if (inside && (inside[0] - (ax + bx) / 2) * nx + (inside[1] - (az + bz) / 2) * nz < 0) {
      // Flip so local +z faces the room.
      return this.wall(k, bx, bz, ax, az, { inside, upper, lower, lowerH, both, other, h, rail, base, cornice, openings: openings.map((o) => ({ ...o, at: L - o.at - o.w })) });
    }
    const ry = Math.atan2(-dz, dx);
    k.push(ax, 0, az, ry);
    const ops = [...openings].sort((a, b) => a.at - b.at);
    // Solid spans between openings.
    const spans = [];
    let x = 0;
    for (const o of ops) { if (o.at > x) spans.push([x, o.at]); x = o.at + o.w; }
    if (x < L) spans.push([x, L]);
    const collide = (x0, x1, top) => {
      const p0 = k.point(x0, 0, -WALL_T / 2), p1 = k.point(x1, 0, WALL_T / 2);
      this.collision.addBox(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), top, 'wall');
    };
    const piece = (x0, x1, y0, y1) => {
      if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
      k.add(roundedBox(x1 - x0, y1 - y0, WALL_T, 0.004, 1), upper, (x0 + x1) / 2, (y0 + y1) / 2, 0);
    };
    for (const [x0, x1] of spans) { piece(x0, x1, 0, h); collide(x0, x1, h + 1); }
    // Lintels over doors are open below (no collider); windows block walking and the camera.
    for (const o of ops) { piece(o.at, o.at + o.w, (o.h ?? 2.15), h); if (o.sill) { piece(o.at, o.at + o.w, 0, o.sill); collide(o.at, o.at + o.w, h + 1); } }
    // Finishes on the room side (and the other side for partitions).
    const sides = both ? [1, -1] : [1];
    for (const s of sides) {
      const lo = s > 0 ? lower : (other?.lower ?? lower);
      const up = s > 0 ? null : other?.upper;
      for (const [x0, x1] of spans.concat(ops.filter((o) => o.sill).map((o) => [o.at, o.at + o.w]))) {
        const w = x1 - x0;
        if (w < 0.02) continue;
        const cx = (x0 + x1) / 2, isSill = ops.some((o) => o.sill && Math.abs(o.at - x0) < 1e-4);
        if (up) k.add(roundedBox(w, h, 0.01, 0.003, 1), up, cx, h / 2, s * (WALL_T / 2 + 0.005));
        if (lo && (!isSill || ops.find((o) => Math.abs(o.at - x0) < 1e-4).sill >= lowerH)) {
          k.add(roundedBox(w, lowerH, 0.02, 0.004, 1), lo, cx, lowerH / 2, s * (WALL_T / 2 + 0.01));
          if (rail) k.add(roundedBox(w, 0.05, 0.045, 0.015), rail, cx, lowerH, s * (WALL_T / 2 + 0.022));
        }
        if (base && !isSill) k.add(roundedBox(w, 0.12, 0.025, 0.008), base, cx, 0.06, s * (WALL_T / 2 + 0.0125));
        if (cornice && !isSill) k.add(roundedBox(w, 0.09, 0.06, 0.025), this.M.white, cx, h - 0.045, s * (WALL_T / 2 + 0.03));
      }
      if (cornice) for (const o of ops) k.add(roundedBox(o.w, 0.09, 0.06, 0.025), this.M.white, o.at + o.w / 2, h - 0.045, s * (WALL_T / 2 + 0.03));
    }
    k.pop();
  }

  // A solid furniture collider (axis-aligned footprint in room coordinates).
  block(x, z, w, d, h = 1.0) { this.collision.addCenteredBox(x, z, w, d, h, 'furniture'); }

  // A rotated footprint, kept axis-aligned (90-degree turns swap w and d).
  blockRot(x, z, w, d, ry, h = 1.0) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    this.block(x, z, w * c + d * s, w * s + d * c, h);
  }

  // A seat at (x, z) facing `heading`; `kind` picks the sitting pose.
  seat(x, z, heading, info, kind = 'chair', arms = 'lap') {
    const s = { x, z, heading, seatY: info.seatY, footY: info.footY ?? 0, footZ: info.footZ ?? 0.42, kind, arms, occupant: null };
    this.seats.push(s);
    return s;
  }

  // Something to use: E / TALK when within r (and facing roughly towards it).
  spot(x, z, r, label, run, when = null) { const s = { x, z, r, label, run, when }; this.spots.push(s); return s; }

  // An inner door (swings open on its own when someone walks up to it).
  door(k, x, z, ry, opts = {}) {
    k.push(x, 0, z, ry);
    const pivot = hingedDoor(k, this.M, this.dynamic, opts);
    k.pop();
    const d = { x, z, ry, pivot, open: 0, target: 0, swing: opts.swing ?? 1, auto: opts.auto !== false, locked: !!opts.locked, max: opts.max ?? 1.45 };
    // The way out is walked through by script only: a plug keeps people and the camera inside.
    if (opts.auto === false) {
      const w = (opts.w ?? 0.9) + 0.1, c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
      this.collision.addCenteredBox(x - Math.sin(ry) * 0.05, z - Math.cos(ry) * 0.05, w * c + 0.3 * s, w * s + 0.3 * c, this.ceilingY + 1, 'wall');
    }
    this.doors.push(d);
    return d;
  }

  // Lights: warm points (no shadow), and a few shadow-casting spots over the main areas.
  point(x, y, z, color = 0xffc880, intensity = 6, dist = 7) {
    const l = new THREE.PointLight(color, intensity, dist, 2);
    l.position.set(x, y, z);
    this.scene.add(l);
    return l;
  }

  spotLight(x, y, z, tx, ty, tz, { color = 0xffd8a0, intensity = 40, angle = 0.9, penumbra = 0.8, dist = 12, shadow = true, mapSize = 1024 } = {}) {
    const l = new THREE.SpotLight(color, intensity, dist, angle, penumbra, 1.6);
    l.position.set(x, y, z);
    l.target.position.set(tx, ty, tz);
    if (shadow) { l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 4; l.shadow.camera.near = 0.3; l.shadow.camera.far = dist; }
    this.scene.add(l, l.target);
    return l;
  }

  ambient(sky = 0x7a6a5a, ground = 0x2a1a10, intensity = 0.6) {
    const h = new THREE.HemisphereLight(sky, ground, intensity);
    this.scene.add(h);
    return h;
  }

  // ------------------------------------------------------------------ runtime
  addNpc(npc) { this.npcs.push(npc); this.scene.add(npc.body.mesh); return npc; }

  // Every frame while Raka is inside.
  update(dt, game) {
    this.time += dt;
    for (const a of this.animated) a(dt, this.time, game);
    // Inner doors open for whoever walks up to them.
    const people = [game.player.body, ...this.npcs.map((n) => n.body)];
    for (const d of this.doors) {
      if (d.auto && !d.locked) {
        let near = false;
        for (const p of people) if (Math.hypot(p.pos.x - d.x, p.pos.z - d.z) < 1.25) { near = true; break; }
        d.target = near ? 1 : 0;
      }
      const prev = d.open;
      d.open += (d.target - d.open) * Math.min(1, dt * (d.target > d.open ? 4.5 : 2.6));
      d.pivot.rotation.y = d.swing * d.max * easeInOut(d.open);
      if (prev < 0.04 && d.open >= 0.04) game.sound?.doorCreak?.(d.x, d.z);
      if (prev > 0.06 && d.open <= 0.06 && d.target === 0) game.sound?.doorShut?.(d.x, d.z, 0.5);
    }
    for (const n of this.npcs) n.update(dt, game, this);
  }

  // The nearest usable thing (seat or spot) in front of Raka.
  nearestUsable(b) {
    let best = null, bd = Infinity;
    const fx = Math.sin(b.heading), fz = Math.cos(b.heading);
    for (const s of this.spots) {
      if (s.when && !s.when()) continue;
      const dx = s.x - b.pos.x, dz = s.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d > s.r) continue;
      const facing = d < 0.5 ? 1 : (dx * fx + dz * fz) / d;
      if (facing < -0.2) continue;
      const score = d - facing * 0.4;
      if (score < bd) { bd = score; best = { kind: 'spot', spot: s, label: s.label }; }
    }
    for (const s of this.seats) {
      if (s.occupant) continue;
      const dx = s.x - b.pos.x, dz = s.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d > 1.3) continue;
      const score = d + 0.3;
      if (score < bd) { bd = score; best = { kind: 'seat', seat: s, label: s.kind === 'bed' ? 'Sit on the bed' : s.kind === 'sofa' ? 'Sit on the sofa' : s.kind === 'stool' ? 'Sit at the bar' : 'Sit down' }; }
    }
    return best;
  }

  // Characters others can talk to (the conversation system asks for these).
  talkers() { return this.npcs.filter((n) => n.talkScript).map((n) => n.body); }
}

export function easeInOut(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
export { WALL_T };
