// One button layout for the on-screen controller and real gamepads, in the style of a handheld
// emulator: shape-symbol face buttons, shoulders, D-pad, Start/Select. Each control maps to a
// key, mouse button or wheel step that differs on foot and in a vehicle; the router turns presses
// into Input's virtual events and remembers what a held control pressed so a context change
// mid-press never leaves a key stuck. The help screen reads the same table.

export const CONTROL_MAP = {
  triangle: { symbol: '△', name: 'Triangle', foot: ['KeyF', 'Enter / steal vehicle'], vehicle: ['KeyF', 'Leave vehicle'] },
  circle: { symbol: '○', name: 'Circle', foot: ['Mouse0', 'Punch / attack'], vehicle: ['Space', 'Handbrake'] },
  cross: { symbol: '✕', name: 'Cross', foot: ['ShiftLeft', 'Sprint (tap: jump)'], vehicle: ['KeyW', 'Accelerate'] },
  square: { symbol: '□', name: 'Square', foot: ['KeyR', 'Reload'], vehicle: ['KeyS', 'Brake / reverse'] },
  l: { symbol: 'L', name: 'L shoulder', foot: ['Mouse2', 'Aim'], vehicle: ['KeyH', 'Horn'] },
  r: { symbol: 'R', name: 'R shoulder', foot: ['Mouse0', 'Shoot'], vehicle: ['KeyG', 'Siren (police)'] },
  up: { symbol: '▲', name: 'D-pad up', foot: ['KeyE', 'Talk to someone nearby'], vehicle: ['KeyR', 'Next radio station'] },
  down: { symbol: '▼', name: 'D-pad down', foot: ['KeyZ', 'Phone Dimas: getaway car'], vehicle: ['KeyZ', 'Phone Dimas: getaway car'] },
  left: { symbol: '◀', name: 'D-pad left', foot: ['Wheel-', 'Previous weapon'], vehicle: ['KeyX', 'Phone Bu Lastri: lose a star'] },
  right: { symbol: '▶', name: 'D-pad right', foot: ['Wheel+', 'Next weapon'], vehicle: ['KeyX', 'Phone Bu Lastri: lose a star'] },
  start: { symbol: 'START', name: 'Start', foot: ['Escape', 'Pause menu'], vehicle: ['Escape', 'Pause menu'] },
  select: { symbol: 'SELECT', name: 'Select', foot: ['KeyM', 'City map'], vehicle: ['KeyM', 'City map'] },
  talk: { symbol: 'TALK', name: 'Talk', foot: ['KeyE', 'Talk'], vehicle: ['KeyE', 'Talk'] },
};

// Keyboard and mouse equivalents for the help screen.
export const KEYBOARD_HELP = {
  foot: [
    ['W A S D', 'Move'], ['Mouse', 'Look (click to capture; drag works too)'], ['Shift', 'Sprint'], ['Space', 'Jump'],
    ['F', 'Enter / steal vehicle'], ['E', 'Talk to someone nearby'], ['1-4 / ↑↓ Enter / click', 'Dialogue choices'], ['Left click', 'Shoot / punch'], ['Right click', 'Aim'],
    ['R', 'Reload'], ['1-9 / wheel / hold Tab', 'Weapons'], ['Z / X', 'Phone the crew'], ['M', 'City map'], ['Esc', 'Pause, save, settings'],
  ],
  vehicle: [
    ['W / S', 'Accelerate / brake, reverse'], ['A / D', 'Steer'], ['Space', 'Handbrake'], ['F', 'Leave vehicle'],
    ['H', 'Horn'], ['G', 'Siren (police)'], ['R', 'Next radio station'], ['Mouse', 'Look around'],
  ],
};

// Standard-mapping gamepad buttons -> controls (triggers are analog in a vehicle).
export const PAD_BUTTONS = { 0: 'cross', 1: 'circle', 2: 'square', 3: 'triangle', 6: 'l', 7: 'r', 8: 'select', 9: 'start', 10: 'talk', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
export const PAD_SHOULDERS = { foot: { 4: ['Wheel-', 'Previous weapon'], 5: ['Wheel+', 'Next weapon'] }, vehicle: { 4: ['KeyH', 'Horn'], 5: ['KeyG', 'Siren (police)'] } };

export class ControlRouter {
  constructor(input) {
    this.input = input;
    this.downAt = new Map();
  }

  codeFor(id) {
    const ctx = this.input.context === 'vehicle' ? 'vehicle' : 'foot';
    if (id.startsWith('pad')) return PAD_SHOULDERS[ctx][id.slice(3)]?.[0];
    return CONTROL_MAP[id]?.[ctx]?.[0];
  }

  press(source, id) {
    const code = this.codeFor(id);
    if (!code) return;
    const key = `${source}:${id}`;
    this.downAt.set(key, { t: performance.now(), code });
    this.input.virtualDown(key, code);
  }

  release(source, id) {
    const key = `${source}:${id}`;
    const d = this.downAt.get(key);
    this.downAt.delete(key);
    this.input.virtualUp(key);
    // A short tap on the sprint button jumps.
    if (d && d.code === 'ShiftLeft' && performance.now() - d.t < 220) this.input.virtualTap('Space');
  }

  releaseAll(source) {
    for (const key of [...this.downAt.keys()]) if (key.startsWith(source + ':')) this.release(source, key.slice(source.length + 1));
  }
}
