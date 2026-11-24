// Weapons of the street, with invented names: damage, rate of fire, spread, pellets, magazine,
// reload time and scope zoom; melee weapons swing with the punch animation.

export const WEAPONS = {
  fists: { id: 'fists', slot: 1, name: 'Bare Fists', short: 'FISTS', melee: true, damage: 22, rate: 2.6, range: 1.9, mag: 0, twoHanded: false },
  bat: { id: 'bat', slot: 2, name: 'Baseball Bat', short: 'BAT', melee: true, damage: 34, rate: 1.6, range: 2.3, mag: 0, twoHanded: false, price: 600 },
  machete: { id: 'machete', slot: 3, name: 'Golok Machete', short: 'MACHETE', melee: true, damage: 46, rate: 1.9, range: 2.1, mag: 0, twoHanded: false, price: 1200 },
  pistol: { id: 'pistol', slot: 2, name: 'Pistol Kancil 9', short: 'PISTOL', damage: 28, rate: 4, spread: 0.012, range: 90, mag: 12, pellets: 1, twoHanded: false, recoil: 0.025, sound: 'pistol', price: 2500 },
  revolver: { id: 'revolver', slot: 4, name: 'Revolver Banteng .357', short: 'REVOLVER', damage: 52, rate: 1.7, spread: 0.008, range: 110, mag: 6, pellets: 1, twoHanded: false, recoil: 0.06, sound: 'revolver', price: 5500, reload: 2.2 },
  smg: { id: 'smg', slot: 3, name: 'SMG Tawon', short: 'SMG', damage: 17, rate: 12, spread: 0.035, range: 75, mag: 30, pellets: 1, twoHanded: true, auto: true, recoil: 0.012, sound: 'smg', price: 9000 },
  rifle: { id: 'rifle', slot: 6, name: 'Rifle Garuda AR', short: 'RIFLE', damage: 30, rate: 9, spread: 0.016, range: 140, mag: 30, pellets: 1, twoHanded: true, auto: true, recoil: 0.018, sound: 'rifle', price: 22000, reload: 1.9 },
  shotgun: { id: 'shotgun', slot: 4, name: 'Gentar Shotgun', short: 'SHOTGUN', damage: 14, rate: 1.3, spread: 0.075, range: 32, mag: 6, pellets: 9, twoHanded: true, recoil: 0.07, sound: 'shotgun', price: 14000, reload: 2.0 },
  sniper: { id: 'sniper', slot: 8, name: 'Elang Sniper Rifle', short: 'SNIPER', damage: 140, rate: 0.75, spread: 0.002, range: 320, mag: 5, pellets: 1, twoHanded: true, recoil: 0.12, sound: 'sniper', price: 35000, reload: 2.6, zoom: 3.2 },
};

export const WEAPON_ORDER = ['fists', 'bat', 'machete', 'pistol', 'revolver', 'smg', 'rifle', 'shotgun', 'sniper'];
export const GUNS = WEAPON_ORDER.filter((id) => !WEAPONS[id].melee);
