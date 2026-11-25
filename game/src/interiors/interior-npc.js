// People inside the interiors. Each one runs a small queue of tasks (walk a path, sit down on a
// seat, stand up, play a gesture, chat with a neighbour, wait, face somewhere) and, when the
// queue runs dry, asks its role for more. Everything goes through the shared motion system:
// walking uses the footstep planner, sitting lowers the hips onto the seat with the legs on
// IK, gestures (drinking, polishing glasses, pouring, pool shots, laughing) are animator layers.
import * as THREE from 'three';
import { Character } from '../characters/character.js';
import { angleDamp } from '../core/math-utils.js';
import { voiceProfile } from '../audio/voice-actor.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class InteriorNpc {
  constructor(look, x, z, heading = 0, { name = null, role = 'patron', plan = null, talkScript = null, speed = 1.25 } = {}) {
    this.body = new Character(look, x, z, { health: 100, name: name || look.name });
    this.body.pos.y = 0;
    this.body.heading = heading;
    this.body.interiorNpc = this;
    this.body.ai = { mode: 'idle', interior: true };
    this.role = role;
    this.planFn = plan;
    this.talkScript = talkScript;
    this.speed = speed;
    this.tasks = [];
    this.task = null;
    this.seat = null;
    this.sitK = 0;
    this.profile = voiceProfile(look.gender, look.age, look.seed || 1);
    this.stuckT = 0;
    this.lookTarget = null;
    this.memory = {};
  }

  get pos() { return this.body.pos; }
  get busyTalking() { return this.body.ai.mode === 'talk'; }

  // ---------------------------------------------------------------- task helpers
  clear() { this.tasks.length = 0; this.task = null; }
  push(...tasks) { this.tasks.push(...tasks); return this; }
  walk(path, speed = this.speed) { return this.push({ type: 'walk', path: path.map((p) => ({ x: p[0] ?? p.x, z: p[1] ?? p.z })), i: 0, speed }); }
  sitOn(seat) { return this.push({ type: 'sit', seat, t: 0 }); }
  stand() { return this.push({ type: 'stand', t: 0 }); }
  gesture(kind, dur = 2) { return this.push({ type: 'gesture', kind, dur, t: 0 }); }
  wait(t, look = null) { return this.push({ type: 'wait', t, look }); }
  face(heading, t = 0.6) { return this.push({ type: 'face', heading, t }); }
  chat(line, withNpc = null, t = null) { return this.push({ type: 'chat', line, with: withNpc, t: t ?? (1.2 + line.length * 0.055) }); }
  call(fn) { return this.push({ type: 'call', fn }); }

  // Approach point in front of a seat (where the person stands before sitting down).
  // Sofas and beds are sat on from the front; chairs at tables and stools at the counter from
  // the side (there is a table or the bar in front of them).
  static seatFront(seat, d = 0.45) {
    const h = seat.heading;
    if (seat.kind === 'sofa' || seat.kind === 'bed' || seat.front === 'front') return { x: seat.x + Math.sin(h) * d, z: seat.z + Math.cos(h) * d };
    const s = seat.side ?? 1;
    return { x: seat.x + Math.cos(h) * d * s - Math.sin(h) * 0.08, z: seat.z - Math.sin(h) * d * s - Math.cos(h) * 0.08 };
  }

  // ---------------------------------------------------------------- update
  update(dt, game, room) {
    const b = this.body;
    if (!this.task) {
      this.task = this.tasks.shift() || null;
      if (!this.task && this.planFn) { this.planFn(this, room, game); this.task = this.tasks.shift() || null; }
      if (this.task) this.task.t0 = this.task.t;
    }
    let wishX = 0, wishZ = 0, face = null;
    const T = this.task;
    const talking = this.busyTalking;
    if (talking) {
      // In a conversation with Raka: stop, keep the seat, look at him.
      const p = game.player.body;
      if (!this.seat) face = Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
      b.lookAt(p.pos.x, p.pos.z, p.headY);
    } else if (T) {
      switch (T.type) {
        case 'walk': {
          const p = T.path[T.i];
          if (!p) { this.task = null; break; }
          const dx = p.x - b.pos.x, dz = p.z - b.pos.z, d = Math.hypot(dx, dz);
          const last = T.i === T.path.length - 1;
          if (d < (last ? 0.12 : 0.35)) { T.i++; this.stuckT = 0; if (T.i >= T.path.length) this.task = null; break; }
          const sp = last ? Math.min(T.speed, 0.35 + d * 1.6) : T.speed;
          wishX = dx / d * sp; wishZ = dz / d * sp;
          const moved = Math.hypot(b.vel.x, b.vel.z);
          this.stuckT = moved < 0.15 ? this.stuckT + dt : 0;
          if (this.stuckT > 2.5) { this.stuckT = 0; T.i++; if (T.i >= T.path.length) this.task = null; }
          break;
        }
        case 'sit': {
          // Turn to face away from the seat, then lower down onto it while shuffling back.
          const s = T.seat;
          if (s.occupant && s.occupant !== this) { this.task = null; break; }
          s.occupant = this;
          T.t += dt;
          if (!T.front) { const f = InteriorNpc.seatFront(s); T.front = Math.hypot(f.x - b.pos.x, f.z - b.pos.z) < 0.6 ? { x: b.pos.x, z: b.pos.z } : f; }
          const turnErr = Math.abs(wrap(b.heading - s.heading));
          face = s.heading;
          if (turnErr < 0.5 || T.t > 1.2) {
            T.k = Math.min(1, (T.k || 0) + dt / 0.95);
            const e = T.k * T.k * (3 - 2 * T.k);
            b.pos.x = T.front.x + (s.x - T.front.x) * e; b.pos.z = T.front.z + (s.z - T.front.z) * e;
            this.sitK = T.k; this.seat = s;
            if (T.k >= 1) this.task = null;
          }
          break;
        }
        case 'stand': {
          const s = this.seat;
          if (!s) { this.task = null; break; }
          T.k = Math.min(1, (T.k || 0) + dt / 0.85);
          const e = T.k * T.k * (3 - 2 * T.k);
          const f = InteriorNpc.seatFront(s);
          b.pos.x = s.x + (f.x - s.x) * e; b.pos.z = s.z + (f.z - s.z) * e;
          this.sitK = 1 - T.k;
          face = s.heading;
          if (T.k >= 1) { s.occupant = null; this.seat = null; this.sitK = 0; this.task = null; }
          break;
        }
        case 'gesture':
          if (T.t === T.t0) b.playGesture(T.kind, T.dur);
          T.t += dt;
          if (T.t - T.t0 >= T.dur) this.task = null;
          break;
        case 'wait':
          T.t -= dt;
          if (T.look) { const l = typeof T.look === 'function' ? T.look() : T.look; if (l) b.lookAt(l.x, l.z, l.y ?? 1.5); }
          if (T.t <= 0) { this.task = null; b.lookAt(null); }
          break;
        case 'face':
          face = T.heading; T.t -= dt;
          if (T.t <= 0) this.task = null;
          break;
        case 'chat': {
          if (!T.started) { T.started = true; game.interiors?.babble(this, T.line); }
          T.t -= dt;
          if (T.with?.body) { const o = T.with.body; b.lookAt(o.pos.x, o.pos.z, o.headY); if (!this.seat) face = Math.atan2(o.pos.x - b.pos.x, o.pos.z - b.pos.z); }
          if (T.t <= 0) { this.task = null; b.lookAt(null); }
          break;
        }
        case 'call': T.fn(this, room, game); this.task = null; break;
        default: this.task = null;
      }
    }
    // Look at whoever is being looked at (idle glances otherwise).
    if (!T || T.type !== 'wait' && T.type !== 'chat') if (this.lookTarget && !talking) { const l = this.lookTarget; b.lookAt(l.x, l.z, l.y ?? 1.5); }
    const seated = this.sitK > 0.001;
    b.sit = seated ? { k: this.sitK, seatY: this.seat?.seatY ?? 0.46, footY: this.seat?.footY ?? 0, footZ: this.seat?.footZ ?? 0.42, arms: this.seat?.arms || 'lap', footPitch: this.seat?.kind === 'stool' ? 0.25 : 0 } : null;
    b.anim = 'auto';
    if (seated) {
      b.vel.set(0, 0, 0);
      if (face != null) b.heading = angleDamp(b.heading, face, 6, dt);
      b.updateVisual(dt, 0);
    } else {
      b.move(dt, room.world, wishX, wishZ, face, face != null ? 6 : 9);
      b.updateVisual(dt);
    }
  }
}

// Pick a random entry.
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const vec = (x, z) => new THREE.Vector3(x, 0, z);
