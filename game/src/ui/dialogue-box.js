// The dialogue box: every spoken line (conversations, mission dialogue, phone calls, police radio)
// shows at the bottom of the screen with the speaker's portrait, name and the words typed out.
// Townspeople and cast members speak from the left, Raka from the right; in a conversation the
// listener's portrait waits dimmed on the other side. Portraits are rendered from the speaker's
// own 3D model (PortraitRenderer) when they first speak in a conversation, so the face, hair and
// clothes match the person on screen.
import { CAST } from '../missions/story-cast.js';
import { PortraitRenderer } from './portrait-renderer.js';

const CPS = 46; // typewriter speed, characters per second

// Fallback portraits for voices without a body: the police radio and unknown callers.
function iconPortrait(kind, color, initials = '') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 150);
  grad.addColorStop(0, kind === 'radio' ? '#1d3a5c' : '#3a2a2a'); grad.addColorStop(1, '#0a0d16');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 8; g.lineCap = 'round';
  if (kind === 'radio') {
    g.fillRect(96, 92, 64, 112); g.fillRect(140, 46, 12, 50);
    g.fillStyle = '#0a0d16'; for (let y = 104; y < 150; y += 12) g.fillRect(106, y, 44, 5);
    for (const r of [34, 54]) { g.beginPath(); g.arc(128, 140, r + 40, -0.5, 0.5); g.stroke(); g.beginPath(); g.arc(128, 140, r + 40, Math.PI - 0.5, Math.PI + 0.5); g.stroke(); }
  } else {
    g.beginPath(); g.arc(128, 104, 46, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(128, 236, 86, 70, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#0a0d16'; g.font = "700 40px 'Barlow Condensed', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials, 128, 106);
  }
  return c;
}

export class DialogueBox {
  constructor(session) {
    this.session = session;
    this.portraits = null; // created lazily (needs the renderer)
    this.root = document.createElement('div');
    this.root.id = 'dialogue-box';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="dlg-face dlg-left"><div class="dlg-frame"></div><div class="dlg-tag"></div></div>
      <div class="dlg-card"><div class="dlg-name"></div><div class="dlg-text"><span class="dlg-shown"></span><span class="dlg-rest"></span></div><div class="dlg-more">▼</div></div>
      <div class="dlg-face dlg-right"><div class="dlg-frame"></div><div class="dlg-tag"></div></div>`;
    document.getElementById('hud').appendChild(this.root);
    const q = (s) => this.root.querySelector(s);
    this.el = { left: q('.dlg-left'), right: q('.dlg-right'), card: q('.dlg-card'), name: q('.dlg-name'), shown: q('.dlg-shown'), rest: q('.dlg-rest') };
    this.cache = new Map(); // character or key -> { canvas, conv }
    this.conv = 0;
    this.lineKey = null;
    this.typed = 0;
    this.hideT = 0;
  }

  // A new conversation: portraits are rendered fresh (the people may have changed since).
  newConversation() { this.conv++; }

  portraitFor(line, side) {
    const key = line.character || (line.phone ? 'cast:' + line.speaker : 'icon:' + line.speaker);
    const hit = this.cache.get(key);
    if (hit && (hit.conv === this.conv || typeof key === 'string')) return hit.canvas;
    let canvas = null;
    try {
      if (!this.portraits) this.portraits = new PortraitRenderer(this.session.gfx);
      if (line.character) canvas = this.portraits.render(line.character, side);
      else if (line.phone && CAST[line.speaker]?.look) canvas = this.portraits.render(this.portraits.standIn(line.speaker, CAST[line.speaker].look), side);
    } catch (e) { console.warn('[dialogue portrait]', e); }
    if (!canvas) {
      const initials = (line.name || '?').replace(/^📱\s*/, '').replace(/^(Pak|Bu|Mas|Mbak) /, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      canvas = iconPortrait(line.speaker === 'radio' ? 'radio' : 'person', line.color || '#e8e2d4', initials);
    }
    canvas.className = 'dlg-portrait';
    if (line.character) {
      // Keep the cache small: forget portraits of people from older conversations.
      for (const [k, v] of this.cache) if (typeof k !== 'string' && v.conv !== this.conv) this.cache.delete(k);
    }
    this.cache.set(key, { canvas, conv: this.conv });
    return canvas;
  }

  setFace(slot, canvas, tag, color, active) {
    const frame = slot.querySelector('.dlg-frame');
    if (canvas && frame.firstChild !== canvas) frame.replaceChildren(canvas);
    slot.querySelector('.dlg-tag').textContent = tag || '';
    slot.style.setProperty('--accent', color || '#ffc35a');
    slot.classList.toggle('empty', !canvas);
    slot.classList.toggle('active', !!active);
  }

  // line: { id, speaker, name, color, text, character, phone } or null. partner: the person Raka
  // is talking to (their portrait stays up while Raka speaks).
  update(dt, line, partner = null) {
    if (!line) {
      if (this.lineKey !== null) { this.hideT = 0.2; this.lineKey = null; }
      if (this.hideT > 0) { this.hideT -= dt; if (this.hideT <= 0 && !this.lineKey) { this.root.classList.add('dlg-out'); this.outT = setTimeout(() => this.root.classList.add('hidden'), 260); } }
      return;
    }
    if (line.id !== this.lineKey) {
      clearTimeout(this.outT);
      const wasHidden = this.root.classList.contains('hidden') || this.root.classList.contains('dlg-out');
      this.lineKey = line.id;
      this.typed = 0;
      const raka = line.speaker === 'raka';
      const sideEl = raka ? this.el.right : this.el.left;
      const otherEl = raka ? this.el.left : this.el.right;
      const color = line.color || '#ffc35a';
      this.setFace(sideEl, this.portraitFor(line, raka ? -1 : 1), raka ? '' : line.phone ? '📱 PHONE' : line.speaker === 'radio' ? 'RADIO' : '', color, true);
      // The other side: the conversation partner (or Raka), dimmed; empty for one-sided lines.
      let other = null, otherColor = '#ffc35a';
      if (raka && partner) {
        const pl = { character: partner, speaker: 'partner', name: '' };
        other = this.portraitFor(pl, 1);
        otherColor = this.lastPartnerColor || '#e8e2d4';
      } else if (!raka && partner && line.character === partner) {
        other = this.portraitFor({ character: this.session.player.body, speaker: 'raka', name: 'Raka' }, -1);
        this.lastPartnerColor = color;
      }
      this.setFace(otherEl, other, '', otherColor, false);
      this.root.classList.toggle('speaker-right', raka);
      this.root.style.setProperty('--accent', color);
      this.el.name.textContent = line.name;
      this.text = line.text;
      this.el.shown.textContent = '';
      this.el.rest.textContent = line.text;
      this.root.classList.remove('hidden', 'dlg-out');
      if (wasHidden) { this.root.classList.remove('dlg-in'); void this.root.offsetWidth; this.root.classList.add('dlg-in'); }
      this.el.card.classList.remove('dlg-pop'); void this.el.card.offsetWidth; this.el.card.classList.add('dlg-pop');
    }
    if (this.typed < this.text.length) {
      this.typed = Math.min(this.text.length, this.typed + dt * CPS);
      const n = Math.floor(this.typed);
      this.el.shown.textContent = this.text.slice(0, n);
      this.el.rest.textContent = this.text.slice(n);
    }
    this.root.classList.toggle('typing', this.typed < this.text.length);
  }
}
