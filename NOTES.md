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
| 1-9, mouse wheel, hold Tab | weapons: fists, bat, machete, pistol, revolver, SMG, rifle, shotgun, sniper (weapon wheel) |
| E | talk to the person in front of you (dialogue choices with 1-4 / arrows / click) |
| R | reload on foot, change radio station in a car |
| H / G | horn / siren (in a police car) |
| Z / X | crew favours: Dimas brings a getaway car, Bu Lastri calls off a star |
| M / Esc | city map / pause (save, load, settings, controls help) |

Touch screens get an on-screen controller in handheld-emulator style (left stick, D-pad, △○✕□
face buttons, L/R shoulders, Select/Start, a contextual TALK button and a camera drag zone; fully
multi-touch), with a layout editor in Settings (drag, pinch or slider to resize, per-control and
global opacity, hide/show, reset; saved in localStorage). Gamepads (standard mapping) use the same
layout: sticks move and look, triggers aim/shoot on foot and are analog gas/brake in a car, and
the D-pad/stick drive the menus and the map cursor. Pause → Controls shows all three side by side.

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
- **Vehicles** (parked ones are stealable too): 16 models, each with its own lofted body design and
  handling (Lestari sedan, Sentosa executive saloon, Kancil hatchback, Garuda SUV, Banteng pickup,
  Angkot Merpati minibus, Kerbau box truck, Rajawali GT coupe, Macan V8 muscle car, Ombak taxi MPV,
  police interceptor, tactical van, ambulance, Bebek scooter, Kilat sport bike, Bajaj three-wheeler)
  with smooth bodies, glass cabins, steering/spinning wheels, glowing lights, sirens, contact shadows, a real
  headlight beam on the player's car. Arcade physics with weight transfer, grip-limited cornering,
  handbrake drifts, tyre smoke, collisions, dents in the bodywork, broken headlights, smoke, fire
  and explosions.
- **Character animation**: one continuous gait blended by a smoothed speed (idle, walk, jog,
  sprint) with stride-matched foot planting, pelvis bob/sway/twist, counter-rotating shoulders,
  arm swing and relaxed elbows; idle breathing, weight shifts and glances; a tucked jump pose and a
  crouching landing; holster/draw when switching weapons (the new gun appears once the hand has
  been to the hip); a two-handed reload where the support hand fetches a magazine from the belt;
  recoil kick in the arms and chest; Raka walks to the driver's door and reaches for the handle
  before getting in (F again cancels), steps out and straightens up, crouches to pick things up.
  In conversations both people turn smoothly to face each other, keep eye contact and gesture
  with their hands and nod while they speak.
- **Traffic & people**: left-hand-drive traffic AI on the road graph obeying signals, keeping
  distance and overtaking stalled cars, parked cars, scooters; articulated pedestrians (some in
  headscarves) who walk the sidewalks, phone, cower,
  flee, get hit and call the police.
- **Police**: 1-5 stars from witnessed crimes; patrol cars that route and ram, officers who get out
  and shoot, roadblocks, the Elang-1 helicopter with a searchlight, tactical vans; search zone on
  the minimap, escape by staying unseen, the Bengkel Cat respray, and arrest.
- **Combat**: fists, baseball bat, golok machete, pistol, revolver, SMG, assault rifle, shotgun and a
  scoped sniper rifle, each an original detailed model (extruded slides and receivers, turned
  barrels and scope, textured grips, sights, rails, stocks); hitscan with spread, headshots,
  tracers, muzzle flash and smoke, ejected brass casings, magazines dropping out on reload (the
  revolver's cylinder swings out, the shotgun pumps), recoil and camera kick, bullet marks,
  sparks and dust; ammo, pickups, armour.
- **Talking people**: walk up to anyone and press E: they stop and turn, a name tag (seeded name
  with honorific: Pak, Bu, Mas, Mbak) appears and a short voiced conversation runs with choices;
  their lines follow the time of day, weather, district, wanted level, story progress and recent
  crashes. Story characters at mission starts brief the job and can start it. Every line is
  spoken: speechSynthesis with a per-character English voice, pitch and rate (local voices first,
  for offline play), or a WebAudio formant babble when no voice exists; mouths lip-sync, lines
  are panned to where the speaker stands, absent cast speak by phone, subtitles always show.
- **Street life**: food carts (gerobak), rows of parked scooters, pennant bunting across the old
  streets, sodium light pools under the lamps.
- **Story**: seven missions (Pulang Kampung → Ombak Terakhir) with stages, objectives, named cast
  and dialogue: Raka Wiratama against Juragan Rusdi's Hiu Merah syndicate.
- **Activities & progression**: Balap Liar Senja street race (14 gates against the clock),
  Martabak delivery runs on a scooter, "Narik Angkot" passenger fares in any angkot, twelve hidden
  Kerang Emas (golden shells), Hiu Merah ambushes on their industrial turf, respawning health/armour/
  weapon supplies, Toko Besi gun shop, Bengkel Cat respray, safehouse; money in US dollars, respect XP
  and six ranks with perks; crew favours; hospital respawn and arrest.
- **Audio** (all WebAudio, no files): positional one-shots through PannerNodes with distance
  falloff — gunshots per weapon with street echo, impacts per surface, glass, crashes, explosions,
  doors, horns per vehicle type, grunts, footsteps by surface (asphalt, sand, wood, grass,
  puddles); an engine voice per model (scooter buzz, two-stroke bajaj, diesel trucks, V8 burble,
  high-revving coupe) with gear shifts; nearby traffic, sirens (wail/yelp/hi-lo) and the rotor
  pitched by doppler; district ambience (traffic hum, gulls and ship horns, market crowd and
  melodic vendor calls, waves, industrial clanks, birds), rain layers, thunder, wind, cicadas,
  rain drumming on the roof in a car; six radio stations (dangdut, lo-fi, keroncong, funky kota,
  synthwave, news-talk with babbling hosts) that duck under dialogue; UI clicks, stingers, money;
  master / music / effects / voice volume sliders.
- **UI**: title screen with briefing and chapter list, pause with stats, settings (quality,
  volumes, sensitivity), save/load in localStorage with autosave; HUD with rotating minimap,
  objective marker, mission panel, police unit list, stars, money, rank bar, weapon slots, crew,
  speedometer, car condition, radio, district banner, subtitles and notifications.
- **Maps**: rotating minimap with district tints, blips, flashing police, the search zone, a GPS
  route along the roads to the objective or a waypoint and edge arrows for off-screen targets; the
  full-screen map (M, Select, pause menu) outlines and names all six districts, shows landmarks,
  activities and street names, pans/zooms with mouse, pinch or gamepad cursor, and opens a detail
  card for any district or place: lore, a thumbnail rendered from the 3D city, who controls it,
  police presence, danger, the weather, story progress and a Set waypoint button.

## Screenshots
`screenshots/` are real renders made by `tools/shoot-all.sh` (headless Chromium, software WebGL),
which opens the game with the `?shot=cover|combat|drive|menu` scenes of
`game/src/debug/screenshot-director.js`; those stage a moment with the game's own systems and
simulate it on a fixed time step. `?shot=stress` exercises every mission and system and logs;
`?shot=garage`, `?shot=weapons` and `?shot=characters` line up every vehicle, weapon and person.

## Hand-in
`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/` with the dossier.
