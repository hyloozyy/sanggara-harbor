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
| E | talk to the person in front of you (dialogue choices with 1-4 / arrows / click); enter or leave a building, sit, use things inside |
| R | reload on foot, change radio station in a car |
| H / G | horn / siren (in a police car) |
| Z / X | crew favours: Dimas brings a getaway car, Bu Lastri calls off a star |
| M / Esc | city map / pause (save, load, settings, controls help) |

Touch screens get an on-screen controller in handheld-emulator style (left stick, D-pad, △○✕□
face buttons, L/R shoulders, Select/Start, a contextual TALK button and a camera drag zone; fully
multi-touch), with a layout editor in Settings (drag, pinch or slider to resize, per-control and
global opacity, hide/show, reset; saved in localStorage). Gamepads (standard mapping) use the same
layout: sticks move and look, triggers aim/shoot on foot and are analog gas/brake in a car, and
the D-pad/stick drive the menus and the map cursor; in Settings up/down picks a row and left/right
changes sliders, options and toggles (same with arrow keys or WASD + Enter). Pause → Controls shows all three side by side.

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
- **Vehicles** (parked ones are stealable too): 16 models, each with its own body design and
  handling (Lestari sedan, Sentosa executive saloon, Kancil hatchback, Garuda SUV, Banteng pickup,
  Angkot Merpati minibus, Kerbau box truck, Rajawali GT coupe, Macan V8 muscle car, Ombak taxi MPV,
  police interceptor, tactical van, ambulance, Bebek scooter, Kilat sport bike, Bajaj three-wheeler).
  Bodies are smooth parametric surfaces (`vehicles/car-body.js`): stations along the car with
  monotone-cubic interpolation, 14 named key points per section on a centripetal spline, rounded
  domed nose and tail, true-circle wheel arches with flared fenders. The surface is one structured
  grid whose column lines lean with the window and pillar edges, so glass, pillars and the pickup
  bed are exact cells (no jagged edges). Lamps, grilles, intakes and plates are outlines projected
  onto the nose and tail; frames, seams and wipers are ribbons on the surface
  (`car-surface-tools.js`). Clearcoat factory paints (solid, metallic flake, pearl) in
  `car-paint.js`; tinted glass with a headliner, seats, dashboard and steering wheel behind it;
  projector headlamps with LED strips, tail lamps that brighten under braking; treaded tyres on
  multi-spoke alloys (or steelies) with discs and calipers. Each model is built once per level of
  detail (full / far, switch at 30 m) and shared; every static part uses one vertex-coloured
  material (`car-parts.js`), so a car is about a dozen draw calls. Dents copy the body geometry
  for that car only. Sirens, a headlight beam on the player's car, contact shadows. Arcade physics
  with weight transfer, grip-limited cornering, handbrake drifts, tyre smoke, collisions, dents,
  broken headlights, smoke, fire and explosions.
- **Character animation** (`characters/humanoid-animator.js`): every frame a target pose is
  built and the bones follow it through critically damped springs, so state changes cross-fade
  (~0.2-0.3 s) and nothing snaps. Legs use analytic two-bone IK driven by a footstep planner:
  a planted foot is pinned to the ground in world space (no sliding, also when turning), a
  swinging foot travels on an arc from lift-off to the gait's landing spot; heel strike, roll
  over the ball and toe-off; stride length and cadence follow speed through walk, jog and
  sprint; little shuffle steps settle the feet after stopping or turning on the spot. The
  pelvis rides on the legs (as high as the planted feet allow) with bob, sway over the standing
  leg, swing-side drop and twist; shoulders counter-rotate, arms swing with bending elbows,
  the head stays level and looks at things; lean from acceleration and into turns; crouch
  before a jump, tuck in the air, an absorbing landing. Layers: aiming (strafing legs), punch
  with wind-up/strike/recover, two-handed bat/golok swing, reload, holster/draw, recoil,
  reaching for door handles, picking up, umbrella, phone, cower, hands-up, panic run, talking
  gestures with lip-sync, listening poses, wave/nod/shrug and a handshake whose hands meet by
  IK. Hits kick the torso away from the blow, heavy blows stagger, knock-downs throw the body
  over and it gets up again, deaths buckle the knees and topple with a rebound before the limbs
  settle. Riders hold the grips (IK, following the bars), feet on the pegs or floorboard with a
  foot down when stopped, tuck at speed and lean with the bike; they climb on and off (Raka
  too). Drivers keep their hands on a steering wheel that turns with the front wheels.
  Townspeople greet Raka, walk up to a comfortable distance to talk, step aside when walked
  at, flinch at gunfire, raise their hands when a gun is pointed at them and panic-run.
- **People** (`characters/body-geometry.js`, `garment-geometry.js`, `wear-geometry.js`,
  `character-atlas.js`): every person is generated from a seed (`character-generator.js`) as one
  skinned mesh on a 51-bone skeleton with a painted 512² atlas, three draw calls (matte, gloss,
  alpha-tested hair cards). Bodies are built from anatomy on grid surfaces: superellipse torso
  sections (pelvis, glutes, waist, ribcage, pectorals or bust, shoulder blades, trapezius slope,
  clavicles, Adam's apple), muscled arm and leg tubes, hands with a palm and two bones per
  finger (relaxed curl, grips on wheels/bars/glasses/guns, fists, open hands for waves and
  handshakes), lofted shoes. Heads are sculpted on a grid packed around the eyes, nose and lips:
  nose bridge/tip/wings, lips on a doubled mouth row so they part with the jaw, eyeballs with
  iris and pupil behind almond lids, blinking upper lids and lash lines, ears, teeth; bones for
  gaze, brows and mouth corners drive saccades, visemes and expressions (smile, frown, surprise,
  fear — from state: panic, flinch, waves). Hairlines, stubble, beards and moustaches are
  evaluated per texel; hair is a shell that thins into the hairline plus strand cards (long hair
  and ponytails swing on the hair bone). Garments are shells on the body surface with the same
  weights: sleeves with hems, loose shirt hems, shorts legs, folded collars, jackets and vests,
  skirts whose front/back panels are pushed by the leading knee (spring follow-through),
  headscarf drapes; watches, earrings and necklaces; a shared fold normal map (waist, armpit,
  elbow, knee and ankle creases, skirt folds, hair strands). Near/far geometry switches by camera
  distance (`view-point.js`). Drivers sit back against the seat, hands on the wheel at a bent-arm
  reach, feet on the pedals by IK; some traffic carries pillion riders (hands at the rider's
  waist, feet on the rear pegs), bajaj and front-seat car passengers. Close-ups: the motion lab
  `?people=<n>&part=face|head|torso|body|hands|feet&who=<i>&n=<tiles>` (tile i = person i,
  `&seq=1` for a time sequence of one person, `&fps=20` for low frame rates) and
  `?shot=people[&part=..&who=..&talk=1&expr=smile]` in the game.
- **Interiors** (`game/src/interiors/`): four buildings you can walk into — **Kafe Jangkar**
  (harbour bar, Pasar Ikan), **Raka's Room** (the safehouse flat, Kota Lama), **Toko Berkah**
  (corner shop) and **Klinik Sehat** (clinic, Pusat Niaga), marked on the minimap and
  the city map (house badges, an Interiors / Masuk legend entry, a pinned note in the Controls
  screen), with a glowing beacon over each door and a MASUK blade sign on the pavement. Each has a real door on a building facade (frame, hinged leaf, step, awning, sign,
  lamp). Walk up and press E / TALK (the touch button reads ENTER) / D-pad up: Raka steps to the
  door, takes the handle, the door swings open, he walks in under a fade; inside, the room's door
  closes behind him. Leaving works the same way. While inside only the room is simulated and drawn
  (own `THREE.Scene`, collision world and environment map baked from the room itself), the city
  pauses, the street is muffled. The camera pulls in, stays below the ceiling and never leaves the
  room. Rooms are built on first entry from bevelled (`roundedBox`) and turned (`lathe`) parts
  batched per material (`shapes.js`, `furniture.js`), with canvas textures for planks, wood grain,
  ubin tegel, terrazzo, glazed tiles, brick, felt, fabrics, batik, posters, labels and neon
  (`interior-textures.js`). People inside (`interior-npc.js`) run task queues — walk, sit down,
  stand up, drink, polish glasses, pour, serve, shoot pool, chat (babble with lip-sync), laugh —
  on the shared motion system (new `sit` blend with IK legs and gestures in the animator; the sip
  drives the wrist to the mouth by IK). Things to do: sit on any stool, chair, sofa or bed (E);
  order Bir Jangkar / es teh / kopi from Bang Togar (he comes over when you sit at the counter),
  buy a regular a drink, play the jukebox (five songs, positional, muffled outside the bar door);
  at home sleep until morning (saves the game, restores health), cook mie goreng, grab a drink from
  the fridge, watch the football on TV; buy food and drink from Bu Sari; get patched up by Suster
  Ratih. Saving inside stores the pavement outside the door; loading always starts outside.
  Debug: `game/debug/interior.html?room=bar|home|shop|clinic&view=<name>` (interior lab, ~30 s via
  `node tools/interiorshot.mjs "<query>" out.png`, `&npc=<i>&n=12&step=0.3` contact sheets,
  `&trip=<i>` restroom walk, `&gest=<kind>`), and `?shot=interior&room=..&sit=..&order=beer&leave=1`
  in the game.
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
`?shot=garage`, `?shot=weapons` and `?shot=characters` line up every vehicle, weapon and person
(`?shot=garage&close=<model>&angle=<deg>&color=<n>` frames one vehicle in the street).
`game/debug/cars.html` is a vehicle lab with only the cars on a lot, in the game's renderer
(`?view=lineup|sheet|close&model=..&angle=..`, `&side=1|top=1|front=1`, `&only=paint|glass|multi`);
`node tools/carshot.mjs "<query>" out.png` renders it in about 20 s.
`game/debug/motion.html` is the motion lab: the `debug/motion-stage.js` cast (walker who stops
and turns, jogger, sprinter, handshake and chat, strafing gunman, brawl, collapse, scooter,
sport bike, driver, people climbing on/off) on a plain lot. `node tools/motionshot.mjs
"?focus=<actor>&t=<s>&n=<frames>&step=<s>&cols=<c>&angle=<deg>" out.png` renders a contact
sheet of frames (about 30 s) to judge motion; `&ghost=1` hides car bodies to see the driver.
In the game, `?shot=motion[&focus=..&t=..]` stages the same cast on Jl. Bandar and exposes
`window.__motion.advance(seconds)` for frame sequences.
`tools/touchtest.mjs` plays the game on a phone-sized touch viewport with real touch events (CDP)
and checks every on-screen control: stick, camera drag, jump/sprint, punch, D-pad weapons, aim and
shoot, reload, enter/drive/leave a car, map, pause menu, layout editor (drag, reset, save) and TALK.

## Hand-in
`mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` writes `out/` with the dossier.
