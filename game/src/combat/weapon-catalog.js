// Weapons of the street, with invented names: damage, rate of fire, spread, pellets, magazine.

export const WEAPONS = {
  fists: { id: 'fists', slot: 1, name: 'Tangan Kosong', short: 'TINJU', melee: true, damage: 22, rate: 2.6, range: 1.9, mag: 0, twoHanded: false },
  pistol: { id: 'pistol', slot: 2, name: 'Pistol Kancil 9', short: 'PISTOL', damage: 28, rate: 4, spread: 0.012, range: 90, mag: 12, pellets: 1, twoHanded: false, recoil: 0.025, sound: 'pistol', price: 2500000 },
  smg: { id: 'smg', slot: 3, name: 'SMG Tawon', short: 'SMG', damage: 17, rate: 12, spread: 0.035, range: 75, mag: 30, pellets: 1, twoHanded: true, auto: true, recoil: 0.012, sound: 'smg', price: 9000000 },
  shotgun: { id: 'shotgun', slot: 4, name: 'Senapan Gentar', short: 'SHOTGUN', damage: 14, rate: 1.3, spread: 0.075, range: 32, mag: 6, pellets: 9, twoHanded: true, recoil: 0.07, sound: 'shotgun', price: 14000000 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];
