// The vehicles of Sanggara: invented makes and models with their body shape and handling numbers.

export const VEHICLE_MODELS = {
  lestari: {
    name: 'Lestari Sedan', body: 'sedan', length: 4.6, width: 1.8, height: 1.45, wheelbase: 2.7, wheelRadius: 0.33,
    maxSpeed: 46, accel: 9, grip: 7.5, mass: 1300, health: 1000, value: 45000000,
    colors: [0x9a1a1a, 0x1c2c4a, 0xd8d8d0, 0x2a2a2e, 0x7a8088, 0x8a6a3a],
  },
  kancil: {
    name: 'Kancil Mini', body: 'hatch', length: 3.8, width: 1.66, height: 1.5, wheelbase: 2.4, wheelRadius: 0.3,
    maxSpeed: 40, accel: 9.5, grip: 8, mass: 950, health: 800, value: 28000000,
    colors: [0xe0b020, 0x3a9a5a, 0xe8e8e0, 0xc83a2a, 0x3a7ac8, 0xf08a3a],
  },
  banteng: {
    name: 'Banteng Pikap', body: 'pickup', length: 4.9, width: 1.85, height: 1.75, wheelbase: 3.0, wheelRadius: 0.38,
    maxSpeed: 40, accel: 7.5, grip: 6.5, mass: 1700, health: 1300, value: 38000000,
    colors: [0xe8e8e0, 0x2a2a2e, 0x8a2a1a, 0x4a6a3a, 0x3a4a6a],
  },
  angkot: {
    name: 'Angkot Merpati', body: 'minibus', length: 4.2, width: 1.7, height: 1.95, wheelbase: 2.6, wheelRadius: 0.3,
    maxSpeed: 33, accel: 6, grip: 6, mass: 1400, health: 1000, value: 30000000,
    colors: [0x18a6a0, 0x2a6ad8, 0xe86a1a, 0xd8c020, 0xc82a5a],
  },
  rajawali: {
    name: 'Rajawali GT', body: 'sports', length: 4.4, width: 1.92, height: 1.18, wheelbase: 2.6, wheelRadius: 0.34,
    maxSpeed: 62, accel: 13.5, grip: 8.5, mass: 1250, health: 850, value: 450000000,
    colors: [0xd02010, 0xf0c000, 0x101010, 0x1a60e0, 0xf0f0f0, 0x20a050],
  },
  taksi: {
    name: 'Taksi Ombak', body: 'sedan', length: 4.6, width: 1.8, height: 1.45, wheelbase: 2.7, wheelRadius: 0.33,
    maxSpeed: 44, accel: 8.5, grip: 7.5, mass: 1300, health: 1000, value: 42000000,
    colors: [0x2a7ad8], roofSign: 'TAKSI',
  },
  patroli: {
    name: 'Patroli Polisi Sanggara', body: 'sedan', length: 4.7, width: 1.85, height: 1.48, wheelbase: 2.75, wheelRadius: 0.34,
    maxSpeed: 55, accel: 11.5, grip: 8.5, mass: 1450, health: 1300, value: 0, police: true,
    colors: [0xf2f2ee],
  },
  taktis: {
    name: 'Unit Taktis', body: 'van', length: 5.2, width: 2.0, height: 2.2, wheelbase: 3.2, wheelRadius: 0.4,
    maxSpeed: 46, accel: 9, grip: 7, mass: 2600, health: 2200, value: 0, police: true,
    colors: [0x1c2024],
  },
  bebek: {
    name: 'Bebek 110', body: 'scooter', length: 1.9, width: 0.7, height: 1.1, wheelbase: 1.25, wheelRadius: 0.3,
    maxSpeed: 31, accel: 10, grip: 9, mass: 110, health: 400, value: 15000000, twoWheel: true,
    colors: [0xc82020, 0x202020, 0x2050c0, 0xe8e8e8],
  },
};

// Weighted pick list for civilian traffic.
export const TRAFFIC_MIX = ['lestari', 'lestari', 'kancil', 'kancil', 'banteng', 'angkot', 'angkot', 'taksi', 'bebek', 'bebek', 'rajawali'];
