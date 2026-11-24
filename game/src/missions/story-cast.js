// The people of the story and how they look when they appear in the world.
import { generateLook } from '../characters/character-generator.js';

// Hand-designed looks: each is a full generated person with every visible choice pinned.
const person = (seed, role, o) => generateLook(seed, role, o);

export const CAST = {
  raka: { name: 'Raka', full: 'Raka Wiratama', role: 'Sailor come home', color: '#ffc35a' },
  dimas: { name: 'Dimas', full: 'Dimas "Kancil" Saputra', role: 'Getaway driver, old friend', color: '#3fd6c6',
    look: person(4101, 'auto', { gender: 'm', age: 'young', build: 'slim', height: 0.97, skin: 0xc68e64, hair: 'spiky', hairColor: 0x15110e, headwear: 'cap-back', hatColor: 0xc83a2a, capText: 'KILAT',
      top: { kind: 'tshirt', color: 0xf0c040, color2: 0x1a1a1a, pattern: 'plain', print: 'KILAT', tucked: false, longSleeves: false }, bottom: { kind: 'long-shorts', color: 0x3a4a6a, pattern: 'plain', belt: null },
      outer: null, shoes: { kind: 'sneaker', color: 0xf2f0ea, color2: 0xd03020 }, glasses: false, bag: null, face: { stubble: false, beard: null, moustache: false, sunglasses: false, makeup: false } }) },
  lastri: { name: 'Bu Lastri', full: 'Bu Lastri', role: 'Food-stall owner who hears everything', color: '#ff9a6a',
    look: person(4102, 'auto', { gender: 'f', age: 'old', build: 'heavy', height: 0.92, skin: 0xa8744e, hair: 'hijab', hatColor: 0x8a2a4a, scarfColor: 0x8a2a4a, scarfPattern: null,
      top: { kind: 'kebaya', color: 0xe8d8c0, color2: 0x8a2a4a, pattern: 'floral', longSleeves: true }, bottom: { kind: 'skirt', color: 0x6a3a1a },
      outer: { kind: 'skirt', length: 'long', color: 0x6a3a1a, color2: 0xe8c890, pattern: 'batik-kawung' }, shoes: { kind: 'sandal', color: 0x5a3a1a }, glasses: true, bag: null, face: { sunglasses: false, makeup: false, lipstick: 0x9a3a4a } }) },
  harun: { name: 'Pak Harun', full: 'Pak Harun Wiratama', role: "Raka's uncle, fish market trader", color: '#8ff0a4',
    look: person(4103, 'auto', { gender: 'm', age: 'old', build: 'average', height: 0.99, skin: 0x8d5b3a, hair: 'grey-crop', hairColor: 0xc8c4bc, headwear: 'peci', hatColor: 0x111111,
      top: { kind: 'batik', color: 0x6a3a1a, color2: 0xe8c890, pattern: 'batik-parang', longSleeves: false, tucked: false }, bottom: { kind: 'trousers', color: 0x2a2e3a, pattern: 'plain', belt: 0x2a1a10 },
      outer: null, shoes: { kind: 'sandal', color: 0x3a2a1a }, glasses: false, bag: null, face: { moustache: true, stubble: true, beard: null, sunglasses: false } }) },
  rusdi: { name: 'Juragan Rusdi', full: 'Juragan Rusdi', role: 'Boss of the Hiu Merah syndicate', color: '#ff5a5a',
    look: person(4104, 'auto', { gender: 'm', age: 'adult', build: 'heavy', height: 1.03, skin: 0xd9a47c, hair: 'undercut', hairColor: 0x0c0b0a, headwear: null,
      top: { kind: 'shirt', color: 0xb0201a, color2: 0x1a1a1a, pattern: 'plain', longSleeves: true, tucked: true }, bottom: { kind: 'trousers', color: 0xf0ece0, pattern: 'plain', belt: 0x5a3a1a },
      outer: { kind: 'jacket', color: 0xf0ece0, open: true }, shoes: { kind: 'leather', color: 0x8a5a2a }, glasses: true, bag: null, face: { sunglasses: true, moustache: true, beard: 'short', stubble: false } }) },
  bayu: { name: 'Bayu Hiu', full: 'Bayu "Hiu"', role: 'Hiu Merah debt collector', color: '#ff7a7a',
    look: person(4105, 'gang', { gender: 'm', age: 'adult', build: 'strong', height: 1.0, skin: 0x7a4c2e, hair: 'undercut', hairColor: 0x0c0b0a, headwear: 'cap-back', hatColor: 0xb0201a, capText: 'HIU',
      top: { kind: 'tank', color: 0xb0201a, pattern: 'plain' }, bottom: { kind: 'jeans', color: 0x1e2a44, pattern: 'denim', belt: 0x111111 }, outer: null,
      shoes: { kind: 'sneaker', color: 0x1a1a1a, color2: 0xb0201a }, glasses: false, face: { stubble: true, sunglasses: false, moustache: false, beard: null } }) },
  wulan: { name: 'Commissioner Wulan', full: 'Commissioner Wulan Sasmita', role: 'Sanggara Police', color: '#7fb2ff',
    look: person(4106, 'police', { gender: 'f', age: 'adult', build: 'average', height: 0.96, skin: 0xc68e64, hair: 'bun', hairColor: 0x15110e, headwear: 'police-cap', hatColor: 0x3a2e22,
      face: { makeup: true, lipstick: 0x9a3a4a, eyeshadow: 0x5a3a2a, sunglasses: false } }) },
  warga: { name: 'Local', full: 'Sanggara local', role: '', color: '#e8e2d4' },
  radio: { name: 'Police Radio', full: 'Sanggara Police Radio', role: '', color: '#9fd0ff' },
};
