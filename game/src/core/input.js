// Keyboard and mouse state with pointer lock; systems read it once per frame. The touch
// controller and the gamepad feed the same state: buttons arrive as synthetic key events (so
// every system and menu reacts to them exactly as to the keyboard), sticks as analog axes, and
// camera motion as mouse deltas.

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
    this.context = 'foot';            // 'foot' or 'vehicle', set by the game each frame
    this.pads = new Map();            // analog sources (touch, gamepad): { x, y, throttle }
    this.virtualHeld = new Map();     // virtual control id -> code it holds

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

  axis(neg, pos) {
    const digital = (this.down(pos) ? 1 : 0) - (this.down(neg) ? 1 : 0);
    if (!this.enabled) return 0;
    let analog = 0;
    for (const p of this.pads.values()) {
      let v = 0;
      if (neg === 'KeyA' && pos === 'KeyD') v = p.x;
      else if (neg === 'KeyS' && pos === 'KeyW') v = this.context === 'vehicle' ? (p.throttle || 0) : p.y;
      if (Math.abs(v) > Math.abs(analog)) analog = v;
    }
    return Math.max(-1, Math.min(1, digital + analog));
  }

  // Analog stick values from a source ('touch', 'pad'): x right, y forward, throttle for cars.
  setAnalog(source, values) { this.pads.set(source, values); }

  // Camera motion from a virtual stick or drag, in mouse pixels.
  look(dx, dy) { if (this.enabled) { this.mouseDX += dx; this.mouseDY += dy; } }

  // A virtual control went down/up: 'Mouse0'/'Mouse2' act as mouse buttons, 'Wheel+'/'Wheel-'
  // as wheel steps, anything else as that key.
  virtualDown(id, code) {
    if (this.virtualHeld.has(id)) return;
    this.virtualHeld.set(id, code);
    if (code.startsWith('Mouse')) { const b = Number(code.slice(5)); this.buttons.add(b); this.clicked.add(b); }
    else if (code.startsWith('Wheel')) this.wheel += code.endsWith('+') ? 1 : -1;
    else dispatchEvent(new KeyboardEvent('keydown', { code, key: code, cancelable: true }));
  }

  virtualUp(id) {
    const code = this.virtualHeld.get(id);
    if (code == null) return;
    this.virtualHeld.delete(id);
    if (code.startsWith('Mouse')) this.buttons.delete(Number(code.slice(5)));
    else if (!code.startsWith('Wheel')) dispatchEvent(new KeyboardEvent('keyup', { code, key: code, cancelable: true }));
  }

  // A quick tap of a key (down now, up shortly after, so hit() sees it this frame).
  virtualTap(code) {
    dispatchEvent(new KeyboardEvent('keydown', { code, key: code, cancelable: true }));
    setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code, key: code, cancelable: true })), 60);
  }

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
