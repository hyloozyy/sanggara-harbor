# Pelabuhan Sanggara — notes

An open-world crime game in the browser, set in **Pelabuhan Sanggara**, an invented Indonesian
port city at golden-hour dusk. Everything (city, cars, people, textures, music, sounds) is generated
in code; the only library is three.js r170, vendored as `game/vendor/three.module.min.js`.
No network requests at runtime, no build step: serve `game/` with any static server
(`node serve.ts`) and open it in desktop Chrome.

## Controls
| | |
|---|---|
| WASD / mouse | move, look (click to lock the pointer) |
| Shift / Space | sprint / jump (handbrake in a car) |
| F | enter, carjack or leave a vehicle |
| Left / right mouse | shoot or punch / aim over the shoulder |
| 1-4, mouse wheel, hold Tab | weapons: fists, pistol, SMG, shotgun (weapon wheel) |
| R | reload on foot, change radio station in a car |
| H / G | horn / siren (in a police car) |
| Z / X | crew favours: Dimas brings a getaway car, Bu Lastri calls off a star |
| M / Esc | city map / pause (save, load, settings) |

## Features
- **City**: 64 blocks over six districts — Pusat Niaga (glass towers), Kota Lama (colonial rows,
  shophouses, the Alun-Alun with its domed hall and clock tower), Pasar Ikan (fish market hall,
  quay, gantry cranes, stacked containers, container ship, marina, yacht), Pantai Senja (beach
  boulevard, palms, umbrellas, jukung boats), Bukit Hijau (villas with pools, hills) and Kawasan
  Industri (sawtooth warehouses, tanks, chimneys). Street names, traffic signals, sodium lamps, power
  lines, billboards and neon signs with invented brands.
- **Rendering**: PBR materials with procedural canvas textures (wet asphalt with lane markings,
  pavers, facades with lit windows and relief, clay tiles, corrugated metal, sand, animated water
  normals), PMREM reflections baked from a procedural dusk sky, low warm sun with soft shadows that
  follow the player, fog, hand-written HDR bloom and ACES grade, instanced props, chunked merged
  buildings for culling.
- **Vehicles**: 9 models (Lestari sedan, Kancil Mini, Banteng pickup, Angkot Merpati minibus,
  Rajawali GT, Taksi Ombak, police patrol car, Unit Taktis van, Bebek 110 scooter) with extruded
  bodies, glass cabins, steering/spinning wheels, glowing lights, sirens. Arcade physics with weight
  transfer, handbrake drifts, tyre smoke, collisions, damage, smoke, fire and explosions.
- **Traffic & people**: left-hand-drive traffic AI on the road graph obeying signals and keeping
  distance, parked cars, scooters; articulated pedestrians that walk the sidewalks, phone, cower,
  flee, get hit and call the police.
- **Police**: 1-5 stars from witnessed crimes; patrol cars that route and ram, officers who get out
  and shoot, roadblocks, the Elang-1 helicopter with a searchlight, tactical vans; search zone on
  the minimap, escape by staying unseen, the Bengkel Cat respray, and arrest ("TERTANGKAP").
- **Combat**: fists, pistol, SMG, shotgun; hitscan with spread, headshots, tracers, muzzle flashes,
  blood, sparks, knock-downs; ammo, reloads, pickups, armour.
- **Story**: seven missions (Pulang Kampung → Ombak Terakhir) with stages, objectives, named cast
  and dialogue: Raka Wiratama against Juragan Rusdi's Hiu Merah syndicate.
- **Activities & progression**: Balap Liar Senja street race, Martabak delivery runs, Toko Besi
  gun shop, safehouse; money in Rupiah, respect XP and six ranks with perks; crew favours.
- **Audio**: WebAudio-synthesised gunshots, explosions, engines, squeal, sirens, rotor thump and
  four procedural radio stations (dangdut, lo-fi, keroncong, funky kota).
- **UI**: title screen with briefing and chapter list, pause with stats, settings (quality,
  volumes, sensitivity), save/load in localStorage with autosave; HUD with rotating minimap,
  objective marker, mission panel, police unit list, stars, money, rank bar, weapon slots, crew,
  speedometer, car condition, radio, district banner, subtitles and notifications; full map.

## Screenshots
`screenshots/` are real renders made by `tools/shoot-all.sh` (headless Chromium, software WebGL),
which opens the game with the `?shot=cover|combat|drive|menu` scenes of
`game/src/debug/screenshot-director.js`; those stage a moment with the game's own systems and
simulate it on a fixed time step. `?shot=stress` exercises every mission and system and logs.

## Hand-in
`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/` with the dossier.
