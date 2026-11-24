// In-world descriptions for the map's detail cards: each district's English subtitle, lore, who
// controls it, police presence and a camera vantage for its thumbnail; and the landmarks.

export const DISTRICT_LORE = {
  'kota-lama': {
    subtitle: 'Old Town', gang: 'Contested — Hiu Merah collectors work the arcades', police: 2,
    lore: 'Colonial arcades, shuttered shophouses and the Alun-Alun square with its domed hall and slow clock. Every family here has run a stall for three generations, and every one of them pays somebody.',
    view: { x: 70, y: 32, z: 190, tx: 40, tz: 130 },
  },
  'pusat-niaga': {
    subtitle: 'Business District', gang: 'Nobody, officially — money talks here', police: 3,
    lore: 'Glass towers, shopping arcades and Menara Sanggara, the tallest thing on the coast. By day bankers and couriers; by night neon, karaoke bars and deals done in parked cars.',
    view: { x: -40, y: 55, z: 60, tx: 0, tz: -10 },
  },
  'pasar-ikan': {
    subtitle: 'Fish Market & Harbour', gang: 'Hiu Merah — they tax every crate', police: 1,
    lore: 'The fish hall opens before dawn; the gantry cranes never stop. Stacked containers, a rusting freighter and Pak Harun\'s stall, where the protection money is collected every Friday.',
    view: { x: 290, y: 40, z: 120, tx: 240, tz: 190 },
  },
  'pantai-senja': {
    subtitle: 'Sunset Beach', gang: 'Kobra Senja street racers', police: 1,
    lore: 'Palm-lined boulevard, beach cafes, jukung outriggers pulled up on the sand. At golden hour the whole city comes to watch the sun go down; after dark the racers come out.',
    view: { x: -150, y: 26, z: 300, tx: -120, tz: 350 },
  },
  'bukit-hijau': {
    subtitle: 'Green Hills', gang: 'Juragan Rusdi\'s private security', police: 2,
    lore: 'Villas with clay-tile roofs and pools on the cool green slopes above the city. Tall gates, quiet roads, and at the top, the villa of Juragan Rusdi himself.',
    view: { x: 0, y: 50, z: -190, tx: 30, tz: -290 },
  },
  'kawasan-industri': {
    subtitle: 'Industrial Estate', gang: 'Hiu Merah — their garages and warehouses', police: 0,
    lore: 'Sawtooth warehouses, fuel tanks and chimneys. Half the doors are padlocked and the night shift asks no questions. The Hiu Merah garage is somewhere in here.',
    view: { x: -170, y: 40, z: 20, tx: -240, tz: -40 },
  },
};

export const DANGER = ['Quiet', 'Low', 'Moderate', 'High'];
export const POLICE_PRESENCE = ['Rare patrols', 'Some patrols', 'Regular patrols', 'Heavy patrols'];

export const PLACE_INFO = {
  safehouse: { kind: 'Safehouse', text: 'Raka\'s rented room above a shop. Save your game, rest, stash your cash.' },
  lastriWarung: { kind: 'Story', text: 'Bu Lastri\'s food stall: the best nasi goreng in Kota Lama, and the best gossip.' },
  fishMarket: { kind: 'Story', text: 'Pak Harun\'s stall in the fish hall, under the gaze of the Hiu Merah collectors.' },
  hiuGarage: { kind: 'Gang', text: 'The Hiu Merah syndicate\'s chop shop. Armed men, stolen cars.' },
  hillVilla: { kind: 'Gang', text: 'Juragan Rusdi\'s villa, high above the city. Guards on the gate.' },
  containerYard: { kind: 'Location', text: 'Rows of stacked containers on the wharf. Easy to hide things here. Or people.' },
  finalPier: { kind: 'Location', text: 'The yacht pier where the rich moor their boats.' },
  beachHouse: { kind: 'Story', text: 'A beach house on Pantai Senja where Dimas plans the last job.' },
  paintShop: { kind: 'Garage', text: 'Pak Darto\'s respray shop: drive in wanted, drive out clean. For a fee.' },
  gunShop: { kind: 'Shop', text: 'Om Beni\'s gun shop behind a hardware counter. Pistols, SMGs, shotguns, armour.' },
  raceStart: { kind: 'Activity', text: 'Sunset Street Race: fourteen gates along the coast against the Kobra Senja record.' },
  deliveryDepot: { kind: 'Activity', text: 'Martabak Bulan: deliver hot martabak by scooter before it goes cold.' },
  station: { kind: 'Landmark', text: 'Sanggara Station, where Raka stepped off the train after six years at sea.' },
};
