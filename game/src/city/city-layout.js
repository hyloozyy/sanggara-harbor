// The map of Pelabuhan Sanggara: the road grid, street names, districts, coastline and the
// blocks between roads. Everything else (buildings, traffic, missions) is placed from this.

export const GRID = [-320, -240, -160, -80, 0, 80, 160, 240, 320];
export const BLOCK_PITCH = 80;
export const ROAD_HALF = 5.5;          // asphalt half width
export const LANE_OFFSET = 2.6;        // lane centre from road centre (traffic keeps left)
export const SIDEWALK = 3.5;
export const CURB_HEIGHT = 0.16;
export const WORLD_MIN = -372, WORLD_MAX = 372;
export const SEA_SOUTH_Z = 372;        // open sea beyond the beach
export const HARBOR_EDGE_X = 372;      // quay wall beyond the container yard
export const BEACH_START_Z = 330;

// Streets running east-west (constant z) and north-south (constant x).
export const EW_STREETS = ['Jl. Bukit Raya', 'Jl. Cendana', 'Jl. Merdeka Lama', 'Jl. Niaga', 'Jl. Pelita', 'Jl. Cempaka', 'Jl. Bandar', 'Jl. Layar', 'Jl. Pantai Senja'];
export const NS_STREETS = ['Jl. Pabrik', 'Jl. Gudang Tua', 'Jl. Rel Kereta', 'Jl. Benteng', 'Jl. Raya Sanggara', 'Jl. Kenari', 'Jl. Teluk', 'Jl. Nelayan', 'Jl. Dermaga'];

export const DISTRICTS = {
  'bukit-hijau': { name: 'Bukit Hijau', tagline: 'Hillside villas', color: '#7fc77a' },
  'pusat-niaga': { name: 'Pusat Niaga', tagline: 'Glass towers and city lights', color: '#7fb2ff' },
  'kota-lama': { name: 'Kota Lama', tagline: 'Colonial old town', color: '#ffd27a' },
  'pasar-ikan': { name: 'Pasar Ikan', tagline: 'Salt air, cranes and containers', color: '#5fe0d0' },
  'pantai-senja': { name: 'Pantai Senja', tagline: 'Palm-lined beach boulevard', color: '#ff9a6a' },
  'kawasan-industri': { name: 'Kawasan Industri', tagline: 'Warehouses, chimneys and secrets', color: '#c0a0a0' },
};

export function districtAt(x, z) {
  if (z > 250) return x > 250 ? 'pasar-ikan' : 'pantai-senja';
  if (x < -165) return 'kawasan-industri';
  if (x > 165) return 'pasar-ikan';
  if (z < -165) return 'bukit-hijau';
  if (z > 85) return 'kota-lama';
  return 'pusat-niaga';
}

// Nearest street name for the banner.
export function streetAt(x, z) {
  let best = null, bestD = Infinity;
  GRID.forEach((g, i) => {
    const dz = Math.abs(z - g);
    if (dz < bestD && x > GRID[0] - 10 && x < GRID[8] + 10) { bestD = dz; best = EW_STREETS[i]; }
    const dx = Math.abs(x - g);
    if (dx < bestD && z > GRID[0] - 10 && z < GRID[8] + 10) { bestD = dx; best = NS_STREETS[i]; }
  });
  if (z > BEACH_START_Z) return 'Pantai Senja';
  if (x > 330) return 'Container Wharf';
  return best;
}

// Blocks between grid roads: i, j index the cell, bounds are the sidewalk slab and lot inside it.
export const BLOCKS = [];
for (let i = 0; i < GRID.length - 1; i++) {
  for (let j = 0; j < GRID.length - 1; j++) {
    const x0 = GRID[i], z0 = GRID[j];
    const cx = x0 + BLOCK_PITCH / 2, cz = z0 + BLOCK_PITCH / 2;
    BLOCKS.push({
      i, j, cx, cz,
      slab: { minX: x0 + ROAD_HALF, maxX: x0 + BLOCK_PITCH - ROAD_HALF, minZ: z0 + ROAD_HALF, maxZ: z0 + BLOCK_PITCH - ROAD_HALF },
      lot: { minX: x0 + ROAD_HALF + SIDEWALK, maxX: x0 + BLOCK_PITCH - ROAD_HALF - SIDEWALK, minZ: z0 + ROAD_HALF + SIDEWALK, maxZ: z0 + BLOCK_PITCH - ROAD_HALF - SIDEWALK },
      district: districtAt(cx, cz),
    });
  }
}

// Ground is flat asphalt; block slabs are raised by the curb height.
export function groundHeightAt(x, z) {
  if (x < GRID[0] - ROAD_HALF || x > GRID[8] + ROAD_HALF || z < GRID[0] - ROAD_HALF || z > GRID[8] + ROAD_HALF) return 0;
  const fx = ((x - GRID[0]) % BLOCK_PITCH + BLOCK_PITCH) % BLOCK_PITCH;
  const fz = ((z - GRID[0]) % BLOCK_PITCH + BLOCK_PITCH) % BLOCK_PITCH;
  const inX = fx > ROAD_HALF && fx < BLOCK_PITCH - ROAD_HALF;
  const inZ = fz > ROAD_HALF && fz < BLOCK_PITCH - ROAD_HALF;
  return inX && inZ ? CURB_HEIGHT : 0;
}

export function isOnRoad(x, z) {
  const near = (v) => GRID.some((g) => Math.abs(v - g) < ROAD_HALF);
  const inside = (v) => v > GRID[0] - ROAD_HALF && v < GRID[8] + ROAD_HALF;
  return (near(x) && inside(z)) || (near(z) && inside(x));
}

export function isWater(x, z) {
  return z > SEA_SOUTH_Z || x > HARBOR_EDGE_X;
}

// Points of interest used by missions, the map legend and the safehouse.
export const PLACES = {
  safehouse: { x: -40, z: 87.5, name: "Raka's Room (Safehouse)" },
  lastriWarung: { x: 34, z: 166.8, name: "Bu Lastri's Warung" },
  fishMarket: { x: 233, z: 196, name: "Pak Harun's Fish Market" },
  hiuGarage: { x: -233, z: -40, name: 'Hiu Merah Garage' },
  hillVilla: { x: 40, z: -313, name: "Juragan Rusdi's Villa" },
  containerYard: { x: 352, z: -120, name: 'Container Yard' },
  finalPier: { x: 352, z: 300, name: 'Yacht Pier' },
  beachHouse: { x: -205, z: 345, name: 'Beach House' },
  paintShop: { x: -152.5, z: -40, name: "Pak Darto's Paint Shop" },
  gunShop: { x: 120, z: -7.2, name: "Om Beni's Gun Shop" },
  raceStart: { x: -120, z: 317.4, name: 'Sunset Street Race' },
  deliveryDepot: { x: 200, z: 87.2, name: 'Martabak Bulan (Delivery)' },
  station: { x: 7.5, z: -7.5, name: 'Sanggara Station' },
};
