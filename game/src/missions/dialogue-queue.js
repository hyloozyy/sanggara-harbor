// Subtitled dialogue: lines from the cast queue up and play one after another on the HUD,
// each held long enough to read, with a short voice blip from the audio engine.
import { CAST } from './story-cast.js';
import { events } from '../core/event-bus.js';

export class DialogueQueue {
  constructor() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
  }

  durationOf(text) { return Math.min(7, 1.6 + text.length * 0.055); }

  say(speaker, text) { this.queue.push({ speaker, text, duration: this.durationOf(text) }); }
  queueLines(lines) { for (const [speaker, text] of lines) this.say(speaker, text); }
  clear() { this.queue = []; this.current = null; }

  update(dt) {
    if (this.current) {
      this.timer -= dt;
      if (this.timer <= 0) this.current = null;
    }
    if (!this.current && this.queue.length) {
      this.current = this.queue.shift();
      this.timer = this.current.duration;
      events.emit('dialogue-line', this.current);
    }
  }

  // { name, color, text } for the HUD, or null.
  get line() {
    if (!this.current) return null;
    const c = CAST[this.current.speaker] || { name: this.current.speaker, color: '#fff' };
    return { name: c.name, color: c.color, text: this.current.text };
  }
}
