// Builds a complete person from a seed: gender presentation, age, build and height, skin tone,
// face (brows, lips, eye colour, make-up, facial hair, glasses), hairstyle or headscarf, an
// outfit that fits the role (townsfolk, market sellers, harbour workers, police, gangsters),
// accessories (bags, phones, umbrellas), a gait and a name. No two seeds look alike.
import { createRng } from '../core/rng.js';

export const SKIN_TONES = [0xf3d2bf, 0xf0c8a8, 0xe0b48e, 0xd9a47c, 0xd09a70, 0xc68e64, 0xb88358, 0xb07a52, 0xa8744e, 0x9a6844, 0x8d5b3a, 0x7a4c2e, 0x6a4026, 0x5a3420];
const SEA_SKIN = [0xe0b48e, 0xd9a47c, 0xd09a70, 0xc68e64, 0xb88358, 0xb07a52, 0xa8744e, 0x9a6844, 0x8d5b3a];
export const HAIR_COLORS = [0x15110e, 0x1c1410, 0x231a14, 0x0c0b0a, 0x2e2118, 0x3a2618, 0x4a3a2a];
const DYED = [0x6a3a1e, 0x8a5a2a, 0xa8743a, 0x5a1e1a, 0xb89060];
const GREY = [0x9a9690, 0xc8c4bc, 0x7a7670, 0xe0ddd6];
const SHIRT = [0xe8e2d4, 0xc83a2a, 0x2a5fa8, 0x3a8a5a, 0xf0c040, 0x8a3a8a, 0x1a1a1a, 0xf08a5a, 0x5ac0c8, 0xb8a070, 0xffffff, 0x6a7a3a, 0xd06080, 0x2a3a5a, 0x7ab8e0, 0xe0d0a0, 0x8a2030, 0x40a090];
const BATIK = [[0x6a3a1a, 0xe8c890], [0x1a2a4a, 0xd8c8a0], [0x7a1a1a, 0xf0d090], [0x2a4a3a, 0xe0d0a0], [0x3a2a5a, 0xe8b860], [0x8a5a1a, 0x2a1a0a]];
const PANTS = [0x2a2e3a, 0x1a1a1a, 0x5a4a3a, 0x3a4a6a, 0x8a7a5a, 0x202838, 0x6a6a5a, 0xc8b898];
const DENIM = [0x2a3a5a, 0x34486e, 0x1e2a44, 0x4a5a7a, 0x22252e];
const SCARF = [0xe8d8c0, 0x2a4a7a, 0x8a2a4a, 0x3a6a5a, 0xd8a8b8, 0x1a1a1a, 0xc8a040, 0x6a4a8a, 0xf0e8e0, 0x4a7a9a, 0xb05a3a];
const PRINTS = ['SGR', 'OMBAK', 'KOPI', '86', 'SURF', 'PELABUHAN', 'LAUT', 'KILAT'];
const EYES = [0x2a1608, 0x3a2210, 0x1e1208, 0x4a2c14, 0x2a1a10];
const NAMES_M = ['Agus', 'Budi', 'Rizky', 'Yusuf', 'Fajar', 'Hendra', 'Joko', 'Bayu', 'Arif', 'Eko', 'Wahyu', 'Teguh', 'Andi', 'Iwan', 'Gilang', 'Rendi', 'Darto', 'Surya', 'Imam', 'Bima', 'Danu', 'Kevin', 'Made', 'Ketut', 'Ucok', 'Fikri'];
const NAMES_F = ['Siti', 'Dewi', 'Rina', 'Ayu', 'Putri', 'Nur', 'Wati', 'Indah', 'Fitri', 'Maya', 'Sari', 'Lestari', 'Intan', 'Nadia', 'Tari', 'Yuni', 'Ratna', 'Wulan', 'Citra', 'Kadek', 'Mega', 'Laras', 'Dian', 'Tika'];
const SURNAMES = ['Santoso', 'Wijaya', 'Hidayat', 'Saputra', 'Lubis', 'Siregar', 'Pratama', 'Nugroho', 'Halim', 'Kusuma', 'Purba', 'Setiawan', 'Rahman', 'Tanjung', 'Gunawan', 'Wibowo'];

// Roles shape the outfit; 'auto' picks a townsperson.
export function generateLook(seed, role = 'auto', overrides = {}) {
  const r = createRng((seed * 2654435761) >>> 0 || 1);
  const pick = r.pick, chance = r.chance, range = r.range;
  const gender = overrides.gender ?? (chance(0.5) ? 'm' : 'f');
  const f = gender === 'f';
  const age = overrides.age ?? (chance(0.2) ? 'young' : chance(0.78) ? 'adult' : 'old');
  const build = overrides.build ?? (chance(0.22) ? 'slim' : chance(0.24) ? 'heavy' : !f && chance(0.2) ? 'strong' : 'average');
  const skin = chance(0.82) ? pick(SEA_SKIN) : pick(SKIN_TONES);
  const hairColor = age === 'old' ? pick(GREY) : chance(0.12) ? pick(DYED) : pick(HAIR_COLORS);
  const look = {
    seed, gender, age, build, skin, hairColor,
    height: (f ? range(0.9, 0.97) : range(0.95, 1.04)) * (age === 'young' ? 0.96 : age === 'old' ? 0.97 : 1),
    face: {
      browThick: f ? range(1.8, 3) : range(3, 5.2), browArch: range(1, f ? 7 : 4), eyeColor: pick(EYES),
      mouthW: range(0.85, 1.15), freckles: chance(0.06), mole: chance(0.15),
      makeup: f && age !== 'old' && chance(0.45), blush: f && chance(0.5),
      lipstick: f && chance(0.45) ? pick([0xb03040, 0x9a3a4a, 0xc05050, 0x8a2a3a, 0xc8706a]) : null,
      eyeshadow: pick([0x6a3a5a, 0x5a3a2a, 0x3a4a6a, 0x8a5a3a]),
      stubble: !f && chance(0.4), beard: !f && age !== 'young' && chance(0.14) ? pick(['short', 'full']) : null, moustache: !f && chance(0.22),
      sunglasses: false,
    },
    glasses: chance(age === 'old' ? 0.4 : 0.12),
    gait: { stride: range(0.92, 1.08), bounce: range(0.7, 1.3), swing: range(0.75, 1.25), tempo: range(0.92, 1.1), slouch: age === 'old' ? range(0.08, 0.16) : range(-0.02, 0.06), sway: f ? range(0.8, 1.3) : range(0.4, 0.9) },
  };
  if (look.glasses && chance(0.35)) look.face.sunglasses = true;
  // Hair.
  if (f) {
    look.hair = chance(0.42) ? 'hijab' : pick(['long', 'long', 'ponytail', 'bun', 'bob', 'curly']);
    if (age === 'old' && look.hair !== 'hijab') look.hair = pick(['bun', 'bob']);
  } else {
    look.hair = age === 'old' && chance(0.3) ? 'bald' : pick(['crop', 'crop', 'undercut', 'curly', 'spiky', 'crop']);
  }
  if (look.hair === 'hijab') { look.scarfColor = pick(SCARF); look.hatColor = look.scarfColor; look.scarfPattern = chance(0.25) ? pick(['floral', 'dots', 'batik-kawung']) : null; look.scarfColor2 = pick(SCARF); }
  // Outfit.
  const top = { kind: 'tshirt', color: pick(SHIRT), color2: pick(SHIRT), pattern: 'plain' };
  const bottom = { kind: 'trousers', color: pick(PANTS), pattern: 'plain' };
  look.top = top; look.bottom = bottom;
  look.shoes = { kind: pick(['sneaker', 'sandal', 'sandal', 'leather']), color: pick([0x1a1410, 0x3a2a1a, 0xe8e8e8, 0x2a2a3a, 0x8a5a3a, 0x2a4a8a]), color2: pick([0xd03020, 0x2050c0, 0x20a060]) };
  const u = r.next();
  if (f) {
    if (u < 0.22) { Object.assign(top, { kind: 'kebaya', pattern: 'floral', color: pick([0xf0e8e0, 0xe8c8d0, 0xd8e0f0, 0xf0d8a0]), color2: pick(SHIRT), longSleeves: true }); look.outer = { kind: 'skirt', length: 'long', ...batik(pick) }; bottom.kind = 'skirt'; }
    else if (u < 0.42) { Object.assign(top, { kind: 'dress', pattern: pick(['plain', 'floral', 'dots']), longSleeves: look.hair === 'hijab' }); look.outer = { kind: 'skirt', length: look.hair === 'hijab' ? 'long' : pick(['knee', 'midi']), color: top.color, color2: top.color2, pattern: top.pattern }; bottom.kind = 'skirt'; bottom.color = top.color; }
    else if (u < 0.62) { Object.assign(top, { kind: pick(['tshirt', 'vneck', 'shirt']), longSleeves: look.hair === 'hijab', pattern: pick(['plain', 'plain', 'stripes', 'dots']) }); look.outer = { kind: 'skirt', length: look.hair === 'hijab' ? 'long' : pick(['knee', 'midi', 'long']), color: pick([...PANTS, 0x8a3a4a, 0x3a5a4a]), pattern: pick(['plain', 'plain', 'batik-parang']) , color2: pick(SHIRT)}; bottom.kind = 'skirt'; }
    else { Object.assign(top, { kind: pick(['tshirt', 'vneck', 'tank', 'shirt', 'batik']), longSleeves: look.hair === 'hijab' }); if (look.hair === 'hijab' && top.kind === 'tank') top.kind = 'shirt'; Object.assign(bottom, { kind: pick(['jeans', 'jeans', 'trousers', 'capri', 'shorts']), color: pick(DENIM), pattern: 'denim' }); if (bottom.kind === 'trousers') { bottom.color = pick(PANTS); bottom.pattern = 'plain'; } if (look.hair === 'hijab' && (bottom.kind === 'shorts' || bottom.kind === 'capri')) bottom.kind = 'jeans'; }
    if (top.kind === 'batik') Object.assign(top, batik(pick));
    if (chance(0.3)) { look.bag = 'shoulder'; look.bagColor = pick([0x4a3020, 0x8a2a2a, 0x1a1a1a, 0xc8a070, 0x2a4a6a]); }
  } else {
    if (u < 0.2) Object.assign(top, { kind: 'batik', ...batik(pick), longSleeves: chance(0.4), tucked: chance(0.3) });
    else if (u < 0.35) Object.assign(top, { kind: 'polo', pattern: chance(0.2) ? 'stripes' : 'plain' });
    else if (u < 0.5) Object.assign(top, { kind: 'shirt', pattern: pick(['plain', 'plaid', 'pinstripe', 'plaid']), longSleeves: chance(0.4), tucked: chance(0.3) });
    else if (u < 0.6) Object.assign(top, { kind: 'tank', pattern: 'plain' });
    else Object.assign(top, { kind: 'tshirt', pattern: pick(['plain', 'plain', 'stripes', 'logo']), print: chance(0.35) ? pick(PRINTS) : null });
    Object.assign(bottom, chance(0.45) ? { kind: 'jeans', color: pick(DENIM), pattern: 'denim' } : chance(0.5) ? { kind: pick(['trousers', 'cargo', 'track']), color: pick(PANTS), color2: 0xe8e8e8 } : { kind: pick(['shorts', 'long-shorts']), color: pick([...PANTS, ...DENIM]) });
    if (chance(0.08) && age !== 'young') { look.outer = { kind: 'sarong', length: 'long', ...batik(pick) }; bottom.kind = 'skirt'; look.headwear = 'peci'; look.hatColor = 0x111111; }
    if (chance(0.15) && !look.outer) { look.outer = { kind: chance(0.5) ? 'jacket' : 'hoodie', color: pick([0x1a1a1a, 0x3a4a2a, 0x2a3a5a, 0x5a3a2a, 0x8a1a1a, 0x6a6a6a]), open: chance(0.6) }; }
    if (!look.headwear && look.hair !== 'bald' && chance(0.18)) { look.headwear = chance(0.75) ? 'cap' : 'cap-back'; look.hatColor = pick([0x1a1a1a, 0xc83a2a, 0x2a5fa8, 0xe8e0c8, 0x3a6a3a]); look.capText = pick(['SGR', 'OMBAK', 'KILAT', '86']); }
    if (look.hair === 'bald' && chance(0.4) && !look.headwear) { look.headwear = 'peci'; look.hatColor = 0x111111; }
    if (chance(0.12)) { look.bag = 'backpack'; look.bagColor = pick([0x2a3a5a, 0x1a1a1a, 0x8a2a2a, 0x3a5a3a]); }
  }
  if (bottom.kind === 'trousers' || bottom.kind === 'jeans') bottom.belt = chance(0.5) ? pick([0x2a1a10, 0x111111, 0x5a3a1a]) : null;
  look.props = { phone: chance(0.3), umbrella: chance(0.55) };
  // Jewellery and a wristwatch (on the left wrist).
  look.watch = chance(age === 'young' ? 0.25 : 0.42) ? pick(['steel', 'gold', 'black']) : null;
  look.earrings = f && look.hair !== 'hijab' && chance(0.55) ? pick(['gold', 'gold', 'silver']) : null;
  look.necklace = chance(f ? 0.3 : 0.12) && look.hair !== 'hijab' ? pick(['gold', 'silver']) : null;
  look.name = `${pick(f ? NAMES_F : NAMES_M)}${chance(0.5) ? ' ' + pick(SURNAMES) : ''}`;
  applyRole(look, role, r);
  return deepMerge(look, overrides);
}

function batik(pick) {
  const [c1, c2] = pick(BATIK);
  return { pattern: pick(['batik-parang', 'batik-kawung', 'batik-mega']), color: c1, color2: c2 };
}

function applyRole(look, role, r) {
  const pick = r.pick, chance = r.chance;
  if (role === 'police') {
    Object.assign(look, { hair: look.gender === 'f' ? (chance(0.5) ? 'hijab' : 'bun') : 'crop', headwear: 'police-cap', hatColor: 0x3a2e22, glasses: false, bag: null });
    if (look.hair === 'hijab') { look.headwear = null; look.hatColor = 0x3a2e22; look.scarfPattern = null; }
    look.top = { kind: 'uniform', color: 0xa88f5e, tucked: true, longSleeves: chance(0.5) };
    look.bottom = { kind: 'trousers', color: 0x4a3a28, belt: 0x111111 };
    look.outer = null;
    look.shoes = { kind: 'boot', color: 0x111111 };
    look.build = look.build === 'heavy' ? 'heavy' : 'strong';
    look.face.makeup = false; look.face.beard = null;
  } else if (role === 'tactical') {
    applyRole(look, 'police', r);
    look.top = { kind: 'shirt', color: 0x1a2230, longSleeves: true, tucked: true };
    look.bottom = { kind: 'cargo', color: 0x1a2230, belt: 0x111111 };
    look.outer = { kind: 'tactical', color: 0x22262a };
    look.headwear = 'helmet'; look.hatColor = 0x22262a;
    if (look.hair === 'hijab') { look.hair = 'bun'; }
  } else if (role === 'gang') {
    Object.assign(look, { gender: 'm' });
    if (look.hair === 'hijab' || look.hair === 'long' || look.hair === 'bun' || look.hair === 'bob' || look.hair === 'ponytail') look.hair = pick(['undercut', 'crop', 'spiky']);
    look.top = { kind: pick(['tank', 'tshirt', 'shirt']), color: pick([0xb0201a, 0x1a1a1a, 0x8a1a1a, 0xe8e8e8]), pattern: chance(0.3) ? 'plaid' : 'plain', color2: 0x1a1a1a };
    look.bottom = { kind: pick(['jeans', 'cargo']), color: pick(DENIM), pattern: 'denim' };
    look.outer = chance(0.45) ? { kind: 'jacket', color: pick([0x1a1a1a, 0x3a1a1a, 0x2a2a2a]), open: true } : null;
    if (chance(0.3)) { look.headwear = 'cap-back'; look.hatColor = 0xb0201a; look.capText = 'HIU'; }
    look.face.sunglasses = chance(0.3); look.glasses = look.face.sunglasses;
    look.shoes = { kind: 'sneaker', color: 0x1a1a1a, color2: 0xb0201a };
    look.face.makeup = false; look.face.lipstick = null;
    look.build = pick(['strong', 'average', 'heavy']);
    look.bag = null;
  } else if (role === 'market') {
    look.outer = look.outer?.kind === 'skirt' ? look.outer : { kind: 'apron', color: pick([0xe8e0d0, 0x3a6a8a, 0xc85a3a, 0x5a8a5a]) };
    if (look.outer.kind === 'apron' && look.bottom.kind === 'skirt') look.bottom.kind = 'trousers';
    if (look.hair !== 'hijab' && chance(0.4)) { look.headwear = 'straw'; look.hatColor = 0xc8a868; }
  } else if (role === 'worker') {
    look.outer = { kind: 'hivis', color: chance(0.5) ? 0xff7a10 : 0xd8e020 };
    look.top = { kind: 'tshirt', color: pick([0x3a4a6a, 0x2a2a2a, 0xe8e2d4]), pattern: 'plain', longSleeves: chance(0.4) };
    look.bottom = { kind: 'cargo', color: pick([0x3a3a3a, 0x2a3a5a, 0x5a4a3a]) };
    look.headwear = 'hardhat'; look.hatColor = pick([0xf0c020, 0xf0f0f0, 0xff7a10]);
    if (look.hair === 'hijab' || look.hair === 'long') look.hair = 'bun';
    look.shoes = { kind: 'boot', color: 0x3a2a1a };
    look.bag = null;
  } else if (role === 'rider') {
    look.headwear = 'helmet'; look.hatColor = r.pick([0xc83a2a, 0x1a1a1a, 0xf0f0f0, 0x2a5fa8, 0xf0c040]);
    if (look.hair === 'hijab') look.hair = 'bun';
  }
}

function deepMerge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') a[k] = deepMerge({ ...a[k] }, v);
    else a[k] = v;
  }
  return a;
}

// Older code describes people by a few colours; turn that into a full look.
export function normaliseLook(look = {}) {
  if (look.top && look.bottom) return look;
  const seed = look.seed ?? ((look.skin ?? 1) ^ ((look.shirt ?? 2) << 3) ^ ((look.pants ?? 3) << 7)) >>> 0;
  const base = generateLook(seed, look.role || 'auto');
  const out = { ...base };
  if (look.skin != null) out.skin = look.skin;
  if (look.hair != null) out.hairColor = look.hair;
  if (look.shirt != null) out.top = { ...base.top, color: look.shirt, pattern: 'plain', print: null, longSleeves: !!look.longSleeves };
  if (look.pants != null) out.bottom = { kind: 'trousers', color: look.pants, pattern: 'plain' };
  if (look.shoes != null) out.shoes = { kind: 'leather', color: look.shoes };
  if (look.scale != null) out.height = look.scale;
  if (look.scarf) { out.hair = 'hijab'; out.gender = 'f'; out.scarfColor = look.scarf; out.hatColor = look.scarf; }
  else if (base.hair === 'hijab') { out.hair = 'crop'; }
  if (look.skirt) { out.outer = { kind: 'skirt', length: 'long', color: look.skirt }; out.bottom = { kind: 'skirt', color: look.skirt }; }
  else if (out.outer?.kind === 'skirt' || out.outer?.kind === 'sarong') { out.outer = null; }
  if (out.bottom.kind === 'skirt' && !out.outer) out.bottom.kind = 'trousers';
  if (look.cap) { out.headwear = look.brim === false ? 'peci' : 'cap'; out.hatColor = look.cap; }
  if (look.vest) out.outer = { kind: 'jacket', color: look.vest, open: true };
  return out;
}
