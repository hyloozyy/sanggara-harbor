// Saving and loading the game in localStorage: story progress, money, rank, weapons, crew,
// player position and settings, with an autosave after each mission.

const KEY = 'pelabuhan-sanggara-save-v1';
const SETTINGS_KEY = 'pelabuhan-sanggara-settings-v1';

export const DEFAULT_SETTINGS = { quality: 'high', master: 0.8, music: 0.6, sfx: 0.9, sensitivity: 1, invertY: false };

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function readSave() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function writeSave(game, label = '') {
  const p = game.player;
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    label,
    progression: game.progression.serialize(),
    missions: game.missions.serialize(),
    crew: game.crew.serialize(),
    side: game.side.serialize(),
    world: game.worldEvents.serialize(),
    arsenal: p.arsenal.serialize(),
    player: { x: p.pos.x, z: p.pos.z, health: p.body.health, armour: p.body.armour },
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function applySave(game, data) {
  if (!data) return false;
  // Loading mid-game: step out of any car, drop the current job and the police.
  if (game.player.vehicle) game.player.exitVehicle(game);
  if (game.missions.active) game.missions.cleanupMission();
  if (game.started) { game.wanted.clear('load'); game.police.clearAll(); }
  game.progression.restore(data.progression);
  game.missions.restore(data.missions);
  game.crew.restore(data.crew || {});
  game.side.restore(data.side);
  game.worldEvents.restore(data.world);
  game.player.arsenal.restore(data.arsenal);
  const b = game.player.body;
  b.pos.set(data.player.x, 0, data.player.z);
  b.health = Math.max(50, data.player.health);
  b.armour = data.player.armour;
  return true;
}

export function loadSettings() {
  const legacy = { tinggi: 'high', sedang: 'medium', rendah: 'low' };
  try {
    const s = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    s.quality = legacy[s.quality] || s.quality;
    return s;
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
}
