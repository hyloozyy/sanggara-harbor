// Gamepad API support (standard mapping): left stick moves or steers, right stick looks, triggers
// aim/shoot on foot and are gas/brake in a vehicle, face buttons, shoulders and D-pad follow the
// shared control map. In menus the D-pad/stick navigate, Cross confirms and Circle goes back.
import { PAD_BUTTONS, PAD_SHOULDERS } from './control-router.js';

const DEAD = 0.18;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

export class GamepadInput {
  constructor(input, router) {
    this.input = input;
    this.router = router;
    this.prev = new Map();
    this.menuMode = true;
    this.menuRepeat = 0;
    this.connected = false;
    this.lookSpeed = 900;
    addEventListener('gamepadconnected', () => { this.connected = true; });
    addEventListener('gamepaddisconnected', () => { this.router.releaseAll('pad'); this.input.setAnalog('pad', { x: 0, y: 0, throttle: 0 }); });
  }

  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of list) if (p && p.connected) return p;
    return null;
  }

  update(dt) {
    const p = this.pad();
    if (!p) return;
    this.connected = true;
    const pressed = (i) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.4);
    const edge = (i) => { const now = pressed(i), was = this.prev.get(i) || false; this.prev.set(i, now); return now === was ? 0 : now ? 1 : -1; };
    const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);

    if (this.menuMode) {
      this.router.releaseAll('pad');
      this.input.setAnalog('pad', { x: 0, y: 0, throttle: 0 });
      this.menuRepeat -= dt;
      const vert = pressed(12) || ly < -0.5 ? -1 : pressed(13) || ly > 0.5 ? 1 : 0;
      const horiz = pressed(14) || lx < -0.5 ? -1 : pressed(15) || lx > 0.5 ? 1 : 0;
      if (vert && this.menuRepeat <= 0) { this.input.virtualTap(vert < 0 ? 'ArrowUp' : 'ArrowDown'); this.menuRepeat = 0.25; }
      else if (!vert && horiz && this.menuRepeat <= 0) { this.input.virtualTap(horiz < 0 ? 'ArrowLeft' : 'ArrowRight'); this.menuRepeat = 0.2; }
      if (!vert && !horiz) this.menuRepeat = 0;
      for (const i of [0, 1, 9, 8]) {
        if (edge(i) !== 1) continue;
        this.input.virtualTap(i === 0 ? 'Enter' : i === 8 ? 'KeyM' : 'Escape');
      }
      this.mapCursor = { x: lx, y: ly, zoom: (p.buttons[7]?.value || 0) - (p.buttons[6]?.value || 0) };
      return;
    }

    const vehicle = this.input.context === 'vehicle';
    const gas = p.buttons[7]?.value || 0, brake = p.buttons[6]?.value || 0;
    this.input.setAnalog('pad', { x: lx, y: -ly, throttle: vehicle ? gas - brake : 0 });
    this.input.look(rx * this.lookSpeed * dt, ry * this.lookSpeed * dt * 0.7);
    for (const [i, id] of Object.entries(PAD_BUTTONS)) {
      if (vehicle && (i === '6' || i === '7')) { if (this.prev.get(+i)) this.router.release('pad', id); this.prev.set(+i, false); continue; }
      const e = edge(+i);
      if (e === 1) this.router.press('pad', id); else if (e === -1) this.router.release('pad', id);
    }
    for (const i of Object.keys(PAD_SHOULDERS.foot)) {
      const e = edge(+i);
      if (e === 1) this.router.press('pad', 'pad' + i); else if (e === -1) this.router.release('pad', 'pad' + i);
    }
  }

  rumble(strength = 0.5, ms = 120) {
    const p = this.pad();
    try { p?.vibrationActuator?.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); } catch { /* unsupported */ }
  }
}
