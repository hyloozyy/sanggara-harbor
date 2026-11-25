// The vehicles of Sanggara: invented makes and models with their body shape and handling numbers.
// Colours are real-world factory paints (see car-paint.js); bright ones only on sports cars,
// angkot and taxis.
import { paints } from './car-paint.js';

export const VEHICLE_MODELS = {
  lestari: {
    name: 'Lestari Sedan', body: 'sedan', length: 4.6, width: 1.8, height: 1.45, wheelbase: 2.7, wheelRadius: 0.33,
    maxSpeed: 46, accel: 9, grip: 7.5, mass: 1300, health: 1000, value: 45000,
    colors: paints('pearlWhite', 'silver', 'gunmetal', 'black', 'deepRed', 'navy', 'champagne'),
  },
  kancil: {
    name: 'Kancil Mini', body: 'hatch', length: 3.8, width: 1.66, height: 1.5, wheelbase: 2.4, wheelRadius: 0.3,
    maxSpeed: 40, accel: 9.5, grip: 8, mass: 950, health: 800, value: 28000,
    colors: paints('polarWhite', 'silver', 'flameRed', 'steelBlue', 'champagne', 'graphite', 'racingYellow'),
  },
  banteng: {
    name: 'Banteng Pickup', body: 'pickup', length: 4.9, width: 1.85, height: 1.75, wheelbase: 3.0, wheelRadius: 0.38,
    maxSpeed: 40, accel: 7.5, grip: 6.5, mass: 1700, health: 1300, value: 38000,
    colors: paints('polarWhite', 'silver', 'gunmetal', 'black', 'olive', 'navy'),
  },
  angkot: {
    name: 'Angkot Merpati', body: 'minibus', length: 4.2, width: 1.7, height: 1.95, wheelbase: 2.6, wheelRadius: 0.3,
    maxSpeed: 33, accel: 6, grip: 6, mass: 1400, health: 1000, value: 30000,
    colors: paints('angkotTeal', 'angkotBlue', 'angkotOrange', 'angkotYellow', 'angkotGreen'),
  },
  rajawali: {
    name: 'Rajawali GT', body: 'sports', length: 4.4, width: 1.92, height: 1.18, wheelbase: 2.6, wheelRadius: 0.34,
    maxSpeed: 62, accel: 13.5, grip: 8.5, mass: 1250, health: 850, value: 450000,
    colors: paints('flameRed', 'racingYellow', 'brightBlue', 'black', 'pearlWhite', 'sunsetOrange', 'racingGreen'),
  },
  taksi: {
    name: 'Ombak Taxi', body: 'mpv',
    maxSpeed: 44, accel: 8.5, grip: 7.5, mass: 1300, health: 1000, value: 42000,
    colors: paints('taxiBlue'), roofSign: 'TAXI', length: 4.55, width: 1.78, height: 1.68, wheelbase: 2.75, wheelRadius: 0.32,
  },
  patroli: {
    name: 'Sanggara Police Patrol', body: 'interceptor', length: 4.7, width: 1.85, height: 1.48, wheelbase: 2.75, wheelRadius: 0.34,
    maxSpeed: 55, accel: 11.5, grip: 8.5, mass: 1450, health: 1300, value: 0, police: true,
    colors: paints('policeWhite'),
  },
  taktis: {
    name: 'Tactical Unit Van', body: 'van', length: 5.2, width: 2.0, height: 2.2, wheelbase: 3.2, wheelRadius: 0.4,
    maxSpeed: 46, accel: 9, grip: 7, mass: 2600, health: 2200, value: 0, police: true,
    colors: paints('tacticalGrey'),
  },
  bebek: {
    name: 'Bebek 110', body: 'scooter', length: 1.9, width: 0.7, height: 1.1, wheelbase: 1.25, wheelRadius: 0.3,
    maxSpeed: 31, accel: 10, grip: 9, mass: 110, health: 400, value: 15000, twoWheel: true,
    colors: paints('deepRed', 'solidBlack', 'steelBlue', 'polarWhite', 'silver'),
  },
  sentosa: {
    name: 'Sentosa Executive', body: 'saloon', length: 5.0, width: 1.86, height: 1.47, wheelbase: 2.95, wheelRadius: 0.34, spokes: 10,
    maxSpeed: 52, accel: 9.5, grip: 7.8, mass: 1650, health: 1150, value: 120000,
    colors: paints('black', 'gunmetal', 'pearlWhite', 'burgundy', 'navy', 'silver'),
  },
  garuda: {
    name: 'Garuda SUV', body: 'suv', length: 4.8, width: 1.92, height: 1.85, wheelbase: 2.85, wheelRadius: 0.39, tyreWidth: 0.28, heavy: true,
    maxSpeed: 44, accel: 8, grip: 6.8, mass: 2000, health: 1500, value: 95000,
    colors: paints('black', 'pearlWhite', 'silver', 'gunmetal', 'bronze', 'deepRed'),
  },
  kerbau: {
    name: 'Kerbau Box Truck', body: 'truck', length: 6.2, width: 2.1, height: 2.6, wheelbase: 3.6, wheelRadius: 0.44, tyreWidth: 0.3, heavy: true,
    maxSpeed: 30, accel: 4.5, grip: 5.5, mass: 4500, health: 2600, value: 60000,
    colors: paints('polarWhite', 'steelBlue', 'flameRed'),
  },
  macan: {
    name: 'Macan V8', body: 'muscle', length: 4.9, width: 1.95, height: 1.32, wheelbase: 2.85, wheelRadius: 0.36, tyreWidth: 0.3, spokes: 6,
    maxSpeed: 58, accel: 14, grip: 6.8, mass: 1600, health: 1100, value: 280000,
    colors: paints('sunsetOrange', 'black', 'navy', 'deepRed', 'racingGreen'),
  },
  ambulans: {
    name: 'Ambulance', body: 'ambulance', length: 5.5, width: 2.0, height: 2.5, wheelbase: 3.3, wheelRadius: 0.38, heavy: true,
    maxSpeed: 44, accel: 8, grip: 6.8, mass: 2800, health: 1800, value: 0, ambulance: true,
    colors: paints('polarWhite'),
  },
  kilat: {
    name: 'Kilat 250R', body: 'motorbike', length: 2.05, width: 0.72, height: 1.15, wheelbase: 1.4, wheelRadius: 0.31, spokes: 3,
    maxSpeed: 52, accel: 15, grip: 9, mass: 165, health: 450, value: 65000, twoWheel: true,
    colors: paints('solidBlack', 'brightBlue', 'flameRed', 'racingGreen', 'pearlWhite'),
  },
  bajaj: {
    name: 'Bajaj Roda Tiga', body: 'bajaj', length: 2.6, width: 1.3, height: 1.7, wheelbase: 1.5, wheelRadius: 0.24, spokes: 4,
    maxSpeed: 24, accel: 6, grip: 6, mass: 350, health: 600, value: 18000,
    colors: paints('angkotGreen', 'angkotBlue', 'angkotOrange', 'cream'),
  },
};

for (const [key, spec] of Object.entries(VEHICLE_MODELS)) spec.key = key;

// Weighted pick list for civilian traffic.
export const TRAFFIC_MIX = ['lestari', 'lestari', 'kancil', 'kancil', 'banteng', 'angkot', 'angkot', 'taksi', 'bebek', 'bebek', 'rajawali',
  'sentosa', 'garuda', 'kerbau', 'macan', 'kilat', 'bajaj', 'taksi', 'ambulans'];
