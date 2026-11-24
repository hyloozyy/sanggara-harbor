// The player, Raka: camera-relative WASD on foot with sprint, stamina and jump, aiming and
// shooting, punching, weapon switching, entering/stealing/exiting cars, and driving controls.
import { generateLook } from './character-generator.js';
import { Character } from './character.js';
import { Arsenal } from '../combat/weapon-system.js';
import { buildWeaponMesh } from '../combat/weapon-meshes.js';
import { WEAPONS } from '../combat/weapon-catalog.js';
import { clamp } from '../core/math-utils.js';
import { events } from '../core/event-bus.js';

// Raka: a sailor back from six years at sea, maroon jacket over a navy tee, worn jeans.
export const PLAYER_LOOK = generateLook(1986, 'auto', {
  gender: 'm', age: 'adult', build: 'strong', height: 1.0, skin: 0xb07a52, hair: 'undercut', hairColor: 0x120e0c, headwear: null,
  top: { kind: 'tshirt', color: 0x1e2c44, color2: 0xe8e2d4, pattern: 'plain', print: null, tucked: false, longSleeves: false },
  bottom: { kind: 'jeans', color: 0x2a3650, pattern: 'denim', belt: 0x2a1a10 },
  outer: { kind: 'jacket', color: 0x7a2a22, open: true }, shoes: { kind: 'sneaker', color: 0xe8e4dc, color2: 0x7a2a22 },
  glasses: false, bag: null, name: 'Raka Wiratama',
  face: { stubble: true, beard: null, moustache: false, sunglasses: false, browThick: 4.6, browArch: 2, eyeColor: 0x2a1608, mole: false, freckles: false },
  gait: { stride: 1.04, bounce: 0.9, swing: 1.0, tempo: 1, slouch: 0.0, sway: 0.55 },
});

export class PlayerController {
  constructor(scene, x, z) {
    this.body = new Character(PLAYER_LOOK, x, z, { health: 200, faction: 'player', name: 'Raka', atlasSize: 512 });
    this.body.maxHealth = 200;
    this.body.armour = 50;
    this.scene = scene;
    scene.add(this.body.mesh);
    this.arsenal = new Arsenal(['fists']);
    this.stamina = 1;
    this.enterTimer = 0;
    this.heldId = 'fists';
  }

  get pos() { return this.body.pos; }
  get vehicle() { return this.body.vehicle; }
  get aiming() { return this.body.aiming; }
  get alive() { return this.body.alive; }

  syncHeldWeapon() {
    if (this.heldId === this.arsenal.current) return;
    this.heldId = this.arsenal.current;
    this.body.model.hold(buildWeaponMesh(this.heldId));
    this.body.twoHanded = !!WEAPONS[this.heldId].twoHanded;
  }

  update(dt, input, game) {
    const b = this.body;
    this.arsenal.update(dt);
    if (!b.alive) { b.updateVisual(dt); return; }

    // Weapon selection.
    for (const [code, id] of [['Digit1', 'fists'], ['Digit2', 'pistol'], ['Digit3', 'smg'], ['Digit4', 'shotgun']]) {
      if (input.hit(code) && this.arsenal.select(id)) events.emit('weapon-switch', { id });
    }
    if (input.wheel && !b.vehicle) { this.arsenal.cycle(input.wheel > 0 ? 1 : -1); events.emit('weapon-switch', { id: this.arsenal.current }); }
    if (input.hit('KeyR') && !b.vehicle) this.arsenal.startReload();
    this.syncHeldWeapon();

    if (input.hit('KeyF')) this.tryEnterExit(game);
    if (b.vehicle) { this.drive(dt, input, game); return; }

    // On-foot movement relative to the camera.
    const cam = game.cameraRig.forward;
    const ix = input.axis('KeyA', 'KeyD'), iz = input.axis('KeyS', 'KeyW');
    const rx = -cam.z, rz = cam.x;
    let wx = cam.x * iz + rx * ix, wz = cam.z * iz + rz * ix;
    const len = Math.hypot(wx, wz);
    if (len > 0) { wx /= len; wz /= len; }
    b.aiming = input.mouseDown(2) && this.arsenal.current !== 'fists';
    const sprint = input.down('ShiftLeft') && len > 0 && !b.aiming && this.stamina > 0.05;
    this.stamina = clamp(this.stamina + (sprint ? -0.18 : 0.25) * dt, 0, 1);
    const speed = b.aiming ? 2.2 : sprint ? 6.8 : 3.6;
    if (input.hit('Space')) b.jump();
    const camYaw = Math.atan2(cam.x, cam.z);
    b.anim = 'auto';
    b.move(dt, game.world, wx * speed, wz * speed, b.aiming || input.mouseDown(0) ? camYaw : null, b.aiming ? 20 : 12);
    b.aimPitch = clamp(-game.cameraRig.pitch * 0.8, -0.6, 0.6);

    // Attack.
    const w = this.arsenal.weapon;
    const trigger = w.auto ? input.mouseDown(0) : input.mouseHit(0);
    if (trigger) {
      if (w.melee) game.weapons.fire(b, this.arsenal, null, null);
      else {
        const { origin, dir } = game.cameraRig.aimRay();
        // Start the ray at the player's shoulder depth so walls behind us do not eat it.
        const toPlayer = (b.pos.x - origin.x) * dir.x + (b.chestY - origin.y) * dir.y + (b.pos.z - origin.z) * dir.z;
        origin.addScaledVector(dir, Math.max(0, toPlayer + 0.5));
        b.aiming = true;
        const hits = game.weapons.fire(b, this.arsenal, origin, dir, 1);
        if (hits) { game.cameraRig.addShake(w.recoil * 4); game.cameraRig.pitch += w.recoil; if (hits.some((h) => h.character)) events.emit('player-hit-target'); }
      }
    }
    b.updateVisual(dt);
  }

  drive(dt, input, game) {
    const v = this.body.vehicle;
    const throttle = input.axis('KeyS', 'KeyW');
    v.controls.throttle = throttle;
    v.controls.steer = -input.axis('KeyA', 'KeyD');
    v.controls.handbrake = input.down('Space');
    if (input.hit('KeyH')) events.emit('horn', { vehicle: v });
    if (v.isPolice && input.hit('KeyG')) v.sirenOn = !v.sirenOn;
    this.body.pos.set(v.pos.x, v.y, v.pos.z);
    this.body.heading = v.heading;
    if (v.wrecked && v.burnTimer > 0.5) {
      this.exitVehicle(game, true);
      this.body.hit(70, { x: v.pos.x, z: v.pos.z }, { knockback: 8, cause: 'explosion' });
    }
  }

  tryEnterExit(game) {
    const b = this.body;
    if (b.vehicle) { this.exitVehicle(game); return; }
    const v = game.vehicles.nearest(b.pos.x, b.pos.z, 4.2, (c) => !c.wrecked);
    if (!v) return;
    const hadDriver = !!v.driverModel;
    if (hadDriver) game.ejectDriver(v, this);
    v.driver = 'player';
    b.vehicle = v;
    b.aiming = false;
    b.mesh.visible = false;
    if (v.ai && v.ai.kind === 'traffic') v.ai.kind = 'stolen';
    game.vehicles.seatDriver(v, PLAYER_LOOK);
    events.emit('vehicle-entered', { vehicle: v, stolen: hadDriver || !v.ownedByPlayer, carjack: hadDriver });
  }

  exitVehicle(game, bail = false) {
    const b = this.body, v = b.vehicle;
    if (!v) return;
    game.vehicles.removeDriverModel(v);
    v.driver = null;
    v.controls.throttle = 0; v.controls.steer = 0; v.controls.handbrake = !bail;
    const side = v.spec.twoWheel ? 1.0 : v.spec.width / 2 + 0.7;
    const rx = Math.cos(v.heading), rz = -Math.sin(v.heading);
    b.pos.set(v.pos.x - rx * side, v.y + 0.1, v.pos.z - rz * side);
    game.world.collision.resolveCircle(b.pos, 0.5);
    b.heading = v.heading;
    b.vel.set(v.vel.x * 0.5, 0, v.vel.z * 0.5);
    if (bail) b.knock = 0.8;
    b.vehicle = null;
    b.mesh.visible = true;
    events.emit('vehicle-exited', { vehicle: v });
  }
}
