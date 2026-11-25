// Talking to people. Walk up to anyone on the street (or a story character waiting at a mission
// start) and press E / TALK: they stop, turn to Raka, a name tag appears over their head and a
// short voiced conversation plays with dialogue choices. Townspeople get a name from their seed and
// say things that fit the moment: time of day, weather, the district, Raka's wanted level, how far
// the story has gone, a crash that just happened nearby. Story characters brief the next job and
// can start it from the conversation.
import * as THREE from 'three';
import { angleDamp } from '../core/math-utils.js';
import { CAST } from './story-cast.js';
import { voiceProfile, VoiceDirector } from '../audio/voice-actor.js';
import { DISTRICTS, districtAt } from '../city/city-layout.js';
import { events } from '../core/event-bus.js';

const MALE = ['Agus', 'Budi', 'Joko', 'Rizky', 'Fajar', 'Hendra', 'Wahyu', 'Yusuf', 'Eko', 'Teguh', 'Arif', 'Bambang', 'Dedi', 'Iwan', 'Rudi', 'Slamet', 'Anton', 'Bagus', 'Gilang', 'Hasan'];
const FEMALE = ['Siti', 'Dewi', 'Ayu', 'Putri', 'Rina', 'Indah', 'Sri', 'Nur', 'Fitri', 'Maya', 'Ratna', 'Yuni', 'Intan', 'Lina', 'Desi', 'Wati', 'Tari', 'Mega', 'Nia', 'Sari'];

function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; }; }
const pickOf = (r, list) => list[Math.floor(r() * list.length)];

// A townsperson's name from their look's seed: honorific by age, given name by gender.
export function townspersonName(look) {
  const r = seeded((look.seed || 1) * 31 + 7);
  const f = look.gender === 'f';
  const given = pickOf(r, f ? FEMALE : MALE);
  const hon = look.age === 'old' ? (f ? 'Bu' : 'Pak') : look.age === 'young' ? '' : (f ? 'Mbak' : 'Mas');
  return hon ? `${hon} ${given}` : given;
}

const DISTRICT_TALK = {
  'kota-lama': ['These arcades are older than the republic. My grandfather sold batik under that one.', 'The clock on the Alun-Alun has been five minutes slow for forty years. Nobody minds.'],
  'pusat-niaga': ['Everyone here walks fast and looks at their phone. Glass towers, glass people.', 'The new Menara Sanggara tower? Rent up there costs more than my whole street.'],
  'pasar-ikan': ['Fresh catch every dawn, but the Hiu Merah boys take a cut of every crate.', 'Mind the forklifts by the cranes. They stop for nobody.'],
  'pantai-senja': ['Best sunsets on the whole coast. The street racers think so too, unfortunately.', 'Try the grilled corn by the jukung boats. Trust me.'],
  'bukit-hijau': ['Up here the air is cooler and the gates are taller.', 'Juragan Rusdi has a villa up the hill. Nobody goes near it after dark.'],
  'kawasan-industri': ['Warehouses, chimneys and too many locked doors. I just work the night shift.', 'Hiu Merah run half these yards. Keep your head down.'],
};
const WEATHER_TALK = {
  clear: ['Lovely evening, isn\'t it? The light makes even the potholes look nice.', 'Clear skies. Perfect for a walk by the water.'],
  cloudy: ['Looks like rain is coming. I can smell it.', 'Grey skies today. Good for my laundry business, bad for my mood.'],
  drizzle: ['Just a drizzle. Real Sanggara people don\'t even open an umbrella for this.', 'My shoes are soaked, and it\'s only drizzling.'],
  storm: ['This downpour! The gutters on my street are rivers already.', 'Did you hear that thunder? Get inside before you float away!'],
  dry: ['So hot. The dry-season dust gets into everything.', 'No rain for weeks. Even the cicadas sound thirsty.'],
  fog: ['Sea fog this thick, the ferry captains stay in port.', 'I can barely see the end of the street. Spooky, isn\'t it?'],
  snow: ['Snow! In Sanggara! My grandmother will never believe me.', 'Is this the end of the world, or just very strange weather?'],
};

export class Conversations {
  constructor(game) {
    this.game = game;
    this.partner = null;
    this.candidate = null;
    this.choices = null;
    this.focus = 0;
    this.lastCrash = null;
    this.tag = document.createElement('div');
    this.tag.id = 'talk-nametag';
    this.tag.className = 'hidden';
    this.panel = document.createElement('div');
    this.panel.id = 'talk-choices';
    this.panel.className = 'hidden';
    document.body.append(this.tag, this.panel);
    this.v = new THREE.Vector3();
    events.on('vehicle-collision', ({ impact, x, z }) => { if (impact > 6) this.lastCrash = { x, z, t: game.time }; });
    addEventListener('keydown', (e) => this.onKey(e));
    // Ambient chatter: people nearby mutter to themselves or into their phones (no subtitles).
    this.chatter = new VoiceDirector(game.audio);
    this.chatter.useSpeech = false;
    this.chatterT = 4;
  }

  updateChatter(dt) {
    const g = this.game;
    this.chatter.listener = g.voices.listener;
    this.chatter.update();
    this.chatterT -= dt;
    if (this.chatterT > 0 || this.chatter.busy || !g.dialogue.idle || g.player.vehicle) return;
    this.chatterT = 5 + Math.random() * 8;
    const b = g.player.body;
    const near = g.peds.list.filter((p) => p.alive && p.ai && p !== this.partner && (p.ai.mode === 'walk' || p.ai.mode === 'idle') && Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z) < 14);
    if (!near.length) return;
    const p = near[Math.floor(Math.random() * near.length)], look = p.model.look;
    const lines = p.anim === 'phone'
      ? ['Yes, Mum, I will be home for dinner.', 'No, no, tell him the shipment is late.', 'Hello? Hello? The signal here is terrible.']
      : g.weather.cur.rain > 0.3 ? ['Ugh, this rain never stops.', 'Where did I leave my umbrella?'] : ['Now where is that warung?', 'So hot today...', 'I should have taken the angkot.', 'Martabak tonight, I think.'];
    this.chatter.speak(lines[Math.floor(Math.random() * lines.length)], { ...voiceProfile(look.gender, look.age, look.seed || p.id), rate: 1.05 }, p, p.pos);
  }

  get choosing() { return !!this.choices; }

  nearestPartner() {
    const g = this.game, b = g.player.body;
    if (g.player.vehicle || !b.alive || g.wastedTimer > 0 || g.interiors?.trans) return null;
    if (g.interiors?.inside) {
      // Inside: the bartender (always, when seated at his counter) and the regulars.
      const seat = g.interiors.seat;
      if (seat?.kind === 'stool') { const bt = g.interiors.active.bartender?.body; if (bt && Math.hypot(bt.pos.x - b.pos.x, bt.pos.z - b.pos.z) < 6) return bt; }
      let best = null, bd = 2.6;
      for (const c of g.interiors.active.talkers()) {
        const d = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z) - (c.interiorNpc.talkScript !== 'patron' ? 0.8 : 0);
        if (d < bd && (c.interiorNpc.talkScript !== 'patron' || d < 1.9)) { bd = d; best = c; }
      }
      return best;
    }
    let best = null, bd = 2.8;
    const consider = (c) => {
      if (!c || !c.alive || c.knock > 0) return;
      const d = Math.hypot(c.pos.x - b.pos.x, c.pos.z - b.pos.z);
      if (d < bd) { bd = d; best = c; }
    };
    for (const p of g.peds.list) if (p.ai && (p.ai.mode === 'walk' || p.ai.mode === 'idle' || p.ai.mode === 'talk')) consider(p);
    if (!g.missions.active) consider(g.missions.giverNpc);
    return best;
  }

  displayName(c) {
    if (c === this.game.missions.giverNpc) return CAST[this.game.missions.nextMission?.giver]?.name || c.name;
    if (c.interiorNpc && c.name) return c.name;
    if (!c.talkName) c.talkName = townspersonName(c.model.look);
    return c.talkName;
  }

  update(dt) {
    const g = this.game;
    if (!this.partner) {
      this.candidate = this.nearestPartner();
      if (this.candidate && g.input.hit('KeyE') && !g.eConsumed) this.begin(this.candidate);
    } else {
      this.candidate = null;
      const p = this.partner, b = g.player.body;
      const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
      if (!p.alive || p.knock > 0 || d > 6 || g.player.vehicle || (p.ai && p.ai.mode !== 'talk')) { this.end(false); return; }
      // Face each other; the townsperson stays put while talking.
      // Both turn smoothly (not snapping) and keep eye contact.
      if (!p.sit) p.heading = angleDamp(p.heading, Math.atan2(b.pos.x - p.pos.x, b.pos.z - p.pos.z), 4, dt);
      // Whoever is not speaking listens (weight on one leg, small nods).
      const speaking = (c) => (c.talk || 0) > 0.05;
      p.listening = !speaking(p); b.listening = !speaking(b) && !b.aiming;
      p.lookAt?.(b.pos.x, b.pos.z, b.pos.y + 1.6);
      if (d < 3.5 && !b.sit) b.heading = angleDamp(b.heading, Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z), 5, dt);
      b.lookAt(p.pos.x, p.pos.z, p.pos.y + 1.6);
      if (p === g.missions.giverNpc) p.updateVisual(dt);
      if (this.pendingChoices && g.dialogue.idle) { const c = this.pendingChoices; this.pendingChoices = null; c.length ? this.showChoices(c) : this.end(true); }
    }
    this.updateTag();
    this.updateChatter(dt);
    const act = g.interiors?.actionLabel?.();
    g.onTalkAvailable?.(!!this.candidate || !!act, this.candidate && !act ? 'TALK' : act || 'TALK');
  }

  updateTag() {
    const c = this.partner || this.candidate;
    if (!c) { this.tag.classList.add('hidden'); return; }
    const cam = this.game.gfx.camera;
    this.v.set(c.pos.x, c.headY + 0.42, c.pos.z).project(cam);
    if (this.v.z > 1) { this.tag.classList.add('hidden'); return; }
    this.tag.classList.remove('hidden');
    this.tag.style.left = `${(this.v.x * 0.5 + 0.5) * 100}%`;
    this.tag.style.top = `${(-this.v.y * 0.5 + 0.5) * 100}%`;
    const name = this.partner ? this.displayName(c) : '';
    this.tag.innerHTML = this.partner ? `<b>${name}</b>` : `<kbd>E</kbd> Talk`;
  }

  // ------------------------------------------------------------------ flow
  begin(c) {
    const g = this.game;
    this.partner = c;
    g.dialogue.clear();
    g.cameraRig.talkFocus = { a: g.player.body, b: c };
    g.cameraRig.talkLook = null;
    if (c.ai) { c.ai.prevMode = c.ai.mode; c.ai.mode = 'talk'; if (!c.interiorNpc) c.anim = 'idle'; }
    if (c.interiorNpc) { c.playGesture?.(c.sit ? 'nod' : 'wave', 1.2); g.player.body.playGesture('nod', 1.1); g.interiors.beginTalk(this, c); return; }
    const story = c === g.missions.giverNpc;
    // Greeting: story people offer a handshake when close enough, townspeople wave or nod.
    const d0 = Math.hypot(c.pos.x - g.player.body.pos.x, c.pos.z - g.player.body.pos.z);
    if ((story && d0 < 1.6) || (!story && d0 < 1.3 && Math.random() < 0.4)) { c.playGesture?.('handshake', 1.9, g.player.body); g.player.body.playGesture('handshake', 1.9, c); }
    else { c.playGesture?.(Math.random() < 0.5 ? 'wave' : 'nod', 1.3); g.player.body.playGesture('nod', 1.1); }
    const name = this.displayName(c);
    if (story) {
      const key = g.missions.nextMission.giver;
      const m = g.missions.nextMission;
      const hello = { dimas: 'Rak! You look like a man with too much free time.', lastri: 'Sit down, son. Have you eaten? You look thin.', harun: 'Raka. The sea is calm today, but the market is not.' }[key] || 'Raka. Good timing.';
      this.say('raka', pickOf(Math.random, ['Hey.', 'Evening.', 'Got a minute?']));
      this.say(key, hello);
      this.storyChoices = [
        { label: 'What\'s the job?', run: () => { this.say('raka', 'What\'s the job?'); this.say(key, `It's called ${m.title}. Here's the situation. ${m.briefing}`); return true; } },
        { label: 'Tell me about this place.', run: () => { this.say('raka', 'What\'s been happening around here?'); this.say(key, pickOf(Math.random, DISTRICT_TALK[districtAt(c.pos.x, c.pos.z)])); return true; } },
        { label: `Let's do it. (Start "${m.title}")`, run: () => { this.say('raka', 'Let\'s do it.'); this.end(true); g.missions.start(m); return false; } },
        { label: 'Later.', run: () => { this.say('raka', 'Later.'); this.say(key, 'Don\'t be long.'); return false; } },
      ];
      this.pendingChoices = this.storyChoices;
      return;
    }
    const look = c.model.look;
    this.profile = voiceProfile(look.gender, look.age, look.seed || c.id);
    const wanted = g.wanted.level;
    this.say('raka', pickOf(Math.random, ['Hi there.', 'Evening.', 'Excuse me.', 'Hey, how\'s it going?']));
    if (wanted >= 3) { this.npc(pickOf(Math.random, ['Please, I don\'t want any trouble! Take whatever you want!', 'Stay away from me! The police are everywhere!'])); this.pendingChoices = []; this.fleeAfter = true; return; }
    this.npc(`${this.greeting()} I'm ${name.replace(/^(Pak|Bu|Mas|Mbak) /, '')}.${wanted >= 1 ? ' Hey... aren\'t you the one the police are looking for?' : ''}`);
    this.pendingChoices = this.pedChoices();
  }

  pedChoices() {
    const g = this.game, c = this.partner;
    const wp = g.interiors?.inside ? g.interiors.savePosition() : c.pos; const district = districtAt(wp.x, wp.z);
    const all = [
      { label: 'What\'s new around here?', run: () => { this.say('raka', 'So, what\'s new around here?'); this.npc(this.newsLine(district)); return true; } },
      { label: 'Some weather, huh?', run: () => { this.say('raka', 'Some weather, huh?'); this.npc(pickOf(Math.random, WEATHER_TALK[g.weather.state] || WEATHER_TALK.clear)); return true; } },
      { label: 'Seen any police around?', run: () => { this.say('raka', 'Seen any police around?'); this.npc(this.policeLine()); return true; } },
      { label: 'Take care.', run: () => { this.say('raka', pickOf(Math.random, ['Take care.', 'See you around.'])); this.npc(pickOf(Math.random, ['You too. Stay out of trouble.', 'Bye now!', 'Hati-hati! That means be careful.'])); return false; } },
    ];
    return all.filter((ch) => !this.used?.has(ch.label));
  }

  greeting() {
    const h = this.game.weather.clock.hour;
    if (h >= 4.5 && h < 11) return pickOf(Math.random, ['Good morning!', 'Morning! Up early, are we?']);
    if (h < 15) return pickOf(Math.random, ['Good afternoon.', 'Hot one today, eh?']);
    if (h < 19) return pickOf(Math.random, ['Good evening! Beautiful sunset, no?', 'Evening! The golden hour, best time of day.']);
    return pickOf(Math.random, ['Bit late to be wandering about, isn\'t it?', 'Evening... careful, the streets get rough at night.']);
  }

  newsLine(district) {
    const g = this.game, done = g.missions.completed.size;
    const c = this.lastCrash;
    if (c && g.time - c.t < 25 && Math.hypot(c.x - this.partner.pos.x, c.z - this.partner.pos.z) < 70) return 'Did you see that crash just now? People here drive like the road owes them money!';
    if (done >= 7) return 'Since Juragan Rusdi fell, the harbour feels lighter. People are even smiling at the market.';
    if (done >= 3 && Math.random() < 0.5) return 'People say some sailor stood up to the Hiu Merah. About time somebody did.';
    if (done === 0 && Math.random() < 0.4) return 'You\'re new around here? Welcome to Sanggara. Watch your wallet.';
    return pickOf(Math.random, DISTRICT_TALK[district] || DISTRICT_TALK['pusat-niaga']) + ` That's ${DISTRICTS[district].name} for you.`;
  }

  policeLine() {
    const w = this.game.wanted.level;
    if (w >= 2) return 'Police? They\'re looking for YOU, friend. I saw your face on the news.';
    if (w === 1) return 'A patrol car just went by asking questions. Something about a troublemaker...';
    return pickOf(Math.random, ['Commissioner Wulan\'s patrols come through twice a night. Quiet otherwise.', 'Police? Only when the Hiu Merah want them gone, it seems.', 'Not many. Sanggara police are stretched thin these days.']);
  }

  say(speaker, text) { this.game.dialogue.say(speaker, text, speaker === 'raka' ? { character: this.game.player.body } : { character: this.partner }); }

  npc(text) {
    const c = this.partner;
    this.game.dialogue.say('warga', text, { name: this.displayName(c), color: '#e8e2d4', profile: this.profile, character: c });
  }

  showChoices(list) {
    this.choices = list;
    this.focus = 0;
    this.game.input.enabled = false;
    this.panel.classList.remove('hidden');
    this.panel.innerHTML = list.map((c, i) => `<button data-i="${i}" class="${i === 0 ? 'focus' : ''}"><kbd>${i + 1}</kbd>${c.label}</button>`).join('');
    this.panel.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.choose(+b.dataset.i)));
  }

  choose(i) {
    const ch = this.choices?.[i];
    if (!ch) return;
    this.hideChoices();
    this.game.audio.uiClick?.();
    (this.used ||= new Set()).add(ch.label);
    const more = ch.run();
    if (!this.partner) return;
    if (more) {
      const story = this.game.missions.giverNpc === this.partner;
      this.pendingChoices = this.partner.interiorNpc ? (this.interiorChoices || []).filter((c) => !this.used.has(c.label)) : story ? this.storyChoices.filter((c) => !this.used.has(c.label)) : this.used.size >= 3 ? [] : this.pedChoices();
    } else this.pendingChoices = [];
  }

  hideChoices() {
    this.choices = null;
    this.panel.classList.add('hidden');
    this.game.input.enabled = true;
  }

  onKey(e) {
    if (!this.choices) return;
    const n = this.choices.length;
    if (/^Digit[1-9]$/.test(e.code)) { const i = +e.code.slice(5) - 1; if (i < n) { e.preventDefault(); e.stopImmediatePropagation(); this.choose(i); } return; }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') this.focus = (this.focus + (e.code === 'ArrowDown' ? 1 : n - 1)) % n;
    else if (e.code === 'Enter') { this.choose(this.focus); return; }
    else if (e.code === 'Escape') { e.preventDefault(); this.end(true); return; }
    else return;
    this.panel.querySelectorAll('button').forEach((b, i) => b.classList.toggle('focus', i === this.focus));
  }

  end(polite) {
    const p = this.partner;
    this.hideChoices();
    this.pendingChoices = null;
    this.partner = null;
    this.used = null;
    this.game.cameraRig.talkFocus = null;
    this.game.player.body.lookAt(null);
    this.game.player.body.listening = false;
    if (p) { p.listening = false; if (polite && p.alive && !this.fleeAfter) p.playGesture?.('wave', 1.3); }
    if (!polite) this.game.dialogue.clear();
    if (p?.ai?.interior) { p.ai.mode = 'idle'; p.lookAt(null); }
    else if (p?.ai && p.ai.mode === 'talk') {
      if (this.fleeAfter) { p.ai.mode = 'flee'; p.ai.fleeFrom = { x: this.game.player.pos.x, z: this.game.player.pos.z }; p.ai.timer = 8; }
      else { p.ai.mode = 'walk'; p.anim = 'auto'; p.ai.timer = 6; }
    }
    this.fleeAfter = false;
  }
}
