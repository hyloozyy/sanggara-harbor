// Armed people on foot (Polisi Sanggara officers and Hiu Merah gangsters): close in on the
// target, keep a fighting distance, strafe, take aimed shots with limited accuracy, and react to hits.
import { Character } from '../characters/character.js';
import { Arsenal } from './weapon-system.js';
import { buildWeaponMesh } from './weapon-meshes.js';
import { WEAPONS } from './weapon-catalog.js';
import { rng } from '../core/rng.js';

export const POLICE_LOOK = { skin: 0xa8744e, hair: 0x111111, shirt: 0xa88f5e, pants: 0x4a3a28, shoes: 0x111111, cap: 0x3a2e22, longSleeves: true };
export const GANG_LOOKS = [
  { shirt: 0xb0201a, pants: 0x1a1a1a, cap: 0x111111 },
  { shirt: 0x1a1a1a, pants: 0x2a2e3a, vest: 0xb0201a },
  { shirt: 0xd8d8d0, pants: 0x1a1a1a, vest: 0x8a1a14 },
];

export class Combatant {
  constructor(scene, look, x, z, { faction, weapon = 'pistol', health = 100, accuracy = 0.5, name = null, hostile = true, armour = 0 }) {
    this.body = new Character(look, x, z, { health, faction, name });
    this.body.armour = armour;
    this.body.anim = 'auto';
    this.arsenal = new Arsenal(['fists', weapon], { [weapon]: 400 });
    this.arsenal.select(weapon);
    this.body.model.hold(buildWeaponMesh(weapon));
    this.body.twoHanded = !!WEAPONS[weapon].twoHanded;
    this.accuracy = accuracy;
    this.hostile = hostile;
    this.burst = 0;
    this.thinkTimer = rng.range(0, 1);
    this.strafeDir = rng.chance(0.5) ? 1 : -1;
    this.preferred = weapon === 'fists' ? 1.3 : weapon === 'shotgun' ? 7 : weapon === 'smg' ? 13 : 16;
    this.reaction = rng.range(0.6, 1.4);
    this.holdPosition = null;
    scene.add(this.body.mesh);
  }

  get alive() { return this.body.alive; }

  update(dt, game, target) {
    const b = this.body;
    this.arsenal.update(dt);
    if (!b.alive || !target || !this.hostile) {
      if (b.alive) b.move(dt, game.world, 0, 0);
      b.updateVisual(dt);
      return;
    }
    const tp = target.pos;
    const ty = target.vehicle ? 1.0 : target.chestY;
    const dx = tp.x - b.pos.x, dz = tp.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
    const facing = Math.atan2(dx, dz);
    this.thinkTimer -= dt;
    if (this.thinkTimer <= 0) {
      this.thinkTimer = rng.range(0.4, 0.9);
      this.los = game.world.collision.lineOfSight(b.pos.x, b.headY, b.pos.z, tp.x, ty, tp.z);
      if (rng.chance(0.2)) this.strafeDir *= -1;
    }
    let wx = 0, wz = 0;
    const anchor = this.holdPosition;
    if (anchor) {
      const ax = anchor.x - b.pos.x, az = anchor.z - b.pos.z, ad = Math.hypot(ax, az);
      if (ad > 1) { wx = ax / ad * 3.5; wz = az / ad * 3.5; }
    } else if (d > this.preferred + 4 || !this.los) {
      const sp = d > 30 ? 5.2 : 3.6;
      wx = dx / d * sp; wz = dz / d * sp;
    } else if (d < this.preferred - 5) {
      wx = -dx / d * 2.2; wz = -dz / d * 2.2;
    } else {
      wx = -dz / d * 1.6 * this.strafeDir; wz = dx / d * 1.6 * this.strafeDir;
    }
    if (this.arsenal.weapon.melee) {
      // Brawlers walk straight in and throw punches.
      b.aiming = false;
      const close = d < 1.7;
      b.move(dt, game.world, close ? 0 : dx / d * 4.2, close ? 0 : dz / d * 4.2, facing, 10);
      this.reaction -= dt;
      if (close && this.reaction <= 0 && this.arsenal.canFire() && b.knock <= 0) {
        game.weapons.fire(b, this.arsenal, null, null);
        this.reaction = rng.range(0.6, 1.2);
      }
      b.updateVisual(dt);
      return;
    }
    b.aiming = this.los && d < this.arsenal.weapon.range * 0.9;
    b.move(dt, game.world, wx, wz, b.aiming ? facing : null, 10);
    b.aimPitch = 0;

    if (b.aiming && b.knock <= 0) {
      this.reaction -= dt;
      if (this.reaction <= 0 && this.arsenal.canFire()) {
        const ox = b.pos.x + Math.sin(facing) * 0.4, oy = b.chestY + 0.15, oz = b.pos.z + Math.cos(facing) * 0.4;
        // Lead the target a little and miss on purpose sometimes.
        const lead = target.vehicle ? 0.25 : 0.1;
        const tvx = (target.vehicle ? target.vehicle.vel.x : target.body?.vel.x || 0) * lead;
        const tvz = (target.vehicle ? target.vehicle.vel.z : target.body?.vel.z || 0) * lead;
        let ax = tp.x + tvx - ox, ay = ty - oy, az = tp.z + tvz - oz;
        const miss = (1 - this.accuracy) * 0.12 * Math.min(2, d / 20);
        ax += rng.range(-1, 1) * miss * d; ay += rng.range(-0.5, 1) * miss * d * 0.5; az += rng.range(-1, 1) * miss * d;
        const l = Math.hypot(ax, ay, az);
        game.weapons.fire(b, this.arsenal, { x: ox, y: oy, z: oz }, { x: ax / l, y: ay / l, z: az / l }, 0.7 + this.accuracy * 0.6);
        if (this.arsenal.weapon.auto) { this.burst++; if (this.burst > 6) { this.burst = 0; this.reaction = rng.range(0.6, 1.3); } }
        else this.reaction = rng.range(0.25, 0.9) / Math.max(0.3, this.arsenal.weapon.rate / 4);
      }
    } else if (!b.aiming) this.reaction = Math.max(this.reaction, 0.3);
    b.updateVisual(dt);
  }
}
