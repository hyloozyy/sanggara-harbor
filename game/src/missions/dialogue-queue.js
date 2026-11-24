// Spoken, subtitled dialogue: lines queue up and play one after another. Each line is voiced by
// the VoiceDirector (speech or synthesised babble) with the speaker's mouth moving, and held on
// screen until both the voice has finished and there has been time to read it.
import { CAST } from './story-cast.js';
import { CAST_VOICES } from '../audio/voice-actor.js';
import { events } from '../core/event-bus.js';

export class DialogueQueue {
  constructor() {
    this.queue = [];
    this.current = null;
    this.timer = 0;
    this.voices = null;           // VoiceDirector, set by the session
    this.findSpeaker = () => null; // speaker key -> Character in the world (for lip-sync and panning)
  }

  durationOf(text) { return Math.min(7, 1.6 + text.length * 0.055); }

  // opts: { name, color, profile, character } for people outside the story cast.
  say(speaker, text, opts = {}) { this.queue.push({ speaker, text, duration: this.durationOf(text), ...opts }); }
  queueLines(lines) { for (const [speaker, text] of lines) this.say(speaker, text); }
  clear() { this.queue = []; this.current = null; this.voices?.stop(); }
  get idle() { return !this.current && !this.queue.length; }

  update(dt) {
    if (this.current) {
      this.timer -= dt;
      this.overtime = (this.overtime || 0) + (this.timer <= 0 ? dt : 0);
      if (this.timer <= 0 && (!this.voices?.busy || this.overtime > 4)) this.current = null;
    }
    if (!this.current && this.queue.length) {
      const line = this.current = this.queue.shift();
      this.overtime = 0;
      const character = line.character || this.findSpeaker(line.speaker);
      let profile = line.profile || CAST_VOICES[line.speaker] || CAST_VOICES.warga;
      // A cast member who is not standing here is on the phone.
      line.phone = !character && CAST[line.speaker]?.look && line.speaker !== 'raka';
      if (line.phone) profile = { ...profile, phone: true };
      let voiced = 0;
      if (this.voices) voiced = this.voices.speak(line.text, profile, character, character ? character.pos : null);
      this.timer = Math.max(Math.min(line.duration, voiced + 1.2), voiced + 0.35);
      events.emit('dialogue-line', line);
    }
    this.voices?.update();
    this.onSpeaking?.(!!this.current);
  }

  // { name, color, text } for the HUD, or null.
  get line() {
    if (!this.current) return null;
    const c = CAST[this.current.speaker] || { name: this.current.speaker, color: '#fff' };
    return { name: (this.current.phone ? '📱 ' : '') + (this.current.name || c.name), color: this.current.color || c.color, text: this.current.text };
  }
}
