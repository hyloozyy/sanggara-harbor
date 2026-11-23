// Keyboard and mouse state with pointer lock; systems read it once per frame.

// Pointer lock can be refused (or return a rejected promise); dragging still looks around then.
export function lockPointer(el) {
  try { const r = el.requestPointerLock && el.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch { /* not available */ }
}

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();      // keys that went down this frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.buttons = new Set();
    this.clicked = new Set();
    this.locked = false;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
    addEventListener('mousemove', (e) => {
      // Without pointer lock (e.g. it was refused), dragging with a button held still looks around.
      if (!this.locked && this.buttons.size === 0) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.enabled && !this.locked) lockPointer(canvas);
      this.buttons.add(e.button);
      this.clicked.add(e.button);
    });
    addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  down(code) { return this.enabled && this.keys.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
  mouseDown(button) { return this.enabled && this.buttons.has(button); }
  mouseHit(button) { return this.enabled && this.clicked.has(button); }

  axis(neg, pos) { return (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0); }

  releaseLock() { if (document.exitPointerLock && this.locked) document.exitPointerLock(); }

  // Called at the end of each frame.
  endFrame() {
    this.pressed.clear();
    this.clicked.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }

  // Scripted input for the deterministic screenshot scenes.
  simulateHold(code, on = true) { if (on) this.keys.add(code); else this.keys.delete(code); }
}
