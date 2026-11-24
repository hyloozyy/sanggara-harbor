// The story of Pelabuhan Sanggara in seven missions. Each mission is a list of stages the
// MissionRunner understands (goto, enter-vehicle, drive-to, eliminate, chase, collect,
// lose-wanted, survive, talk), with lines of dialogue spoken by the cast.
import { PLACES } from '../city/city-layout.js';

const P = PLACES;

export const STORY_ARC = 'Raka Wiratama comes home to Pelabuhan Sanggara after six years on cargo ships. His uncle, Pak Harun, is being squeezed by the Hiu Merah syndicate of Juragan Rusdi, who smuggles through the container yard and has bought half the city.';

export const MISSIONS = [
  {
    id: 'pulang-kampung', chapter: 'CHAPTER 1', title: 'Homecoming', giver: 'dimas',
    start: { x: 7.5, z: -7.5 }, startNow: true,
    briefing: 'Dimas picks Raka up at Sanggara Station. The city has changed: Hiu Merah runs the harbour now.',
    reward: { money: 500000, xp: 150 }, unlockCrew: 'dimas',
    stages: [
      { type: 'talk', text: 'Meet Dimas', lines: [['dimas', 'Raka! Six years at sea and you finally came home, bro.'], ['raka', 'This town looks brighter than I remember.'], ['dimas', 'Bright lights, dark business. Come on, Bu Lastri is waiting.']] },
      { type: 'enter-vehicle', text: "Get in Dimas's Kancil Mini", vehicle: { model: 'kancil', x: -4.7, z: -26, heading: Math.PI, color: 0xe0b020 } },
      { type: 'drive-to', text: "Drive Dimas to Bu Lastri's food stall", target: P.lastriWarung, radius: 6, lines: [['dimas', 'Take Jalan Raya Sanggara, then left on Jalan Bandar.'], ['dimas', 'Remember, we drive on the left here. This is not a ship!']] },
      { type: 'talk', text: 'Hear the news from Bu Lastri', lines: [['lastri', 'Raka... your uncle is in trouble, son. Hiu Merah wants protection money every week.'], ['lastri', 'The collector is called Bayu. Go down to Pasar Ikan if you still have the nerve.'], ['raka', 'The nerve is still there, Bu. It is the patience that ran out.']] },
    ],
  },
  {
    id: 'ikan-busuk', chapter: 'CHAPTER 2', title: 'Rotten Fish', giver: 'lastri',
    start: P.lastriWarung,
    briefing: 'Hiu Merah collectors are shaking down the traders at Pasar Ikan. Drive them out, and catch the collector.',
    reward: { money: 1500000, xp: 300 }, giveWeapon: ['pistol', 48],
    stages: [
      { type: 'goto', text: 'Go to Pasar Ikan', target: P.fishMarket, radius: 8, lines: [['lastri', 'Be careful. They are not playing games.']] },
      { type: 'eliminate', text: 'Beat up the Hiu Merah collectors', enemies: [{ dx: 0, dz: -8, weapon: 'bat' }, { dx: 3, dz: 6, weapon: 'fists' }, { dx: -1, dz: 14, weapon: 'machete' }], lines: [['bayu', 'Who is this? A hero who showed up late?'], ['raka', "Pak Harun's nephew. You picked the wrong stall."]] },
      { type: 'chase', text: 'Chase Bayu as he flees on a scooter', vehicle: { model: 'bebek', dx: 4.4, dz: 22, color: 0xc82020 }, who: 'bayu', lines: [['bayu', 'Tell your uncle Juragan Rusdi never forgets!'], ['harun', 'Raka! Do not let him get away!']] },
      { type: 'talk', text: 'Talk to Pak Harun', lines: [['harun', 'You grew up hard, Raka. Your father would be proud... or worried.'], ['harun', 'Keep this pistol. This is not the town it used to be.']] },
    ],
  },
  {
    id: 'angkot-panas', chapter: 'CHAPTER 3', title: 'Hot Angkot', giver: 'harun',
    start: P.fishMarket,
    briefing: 'Hiu Merah moves contraband in a fake angkot from their garage in Kawasan Industri. Steal it.',
    reward: { money: 3000000, xp: 450 }, unlockCrew: 'lastri',
    stages: [
      { type: 'goto', text: 'Go to the Hiu Merah garage', target: P.hiuGarage, radius: 10, lines: [['harun', 'Route 04 angkot, teal paint. It is not carrying passengers.']] },
      { type: 'enter-vehicle', text: 'Steal the smuggling angkot', vehicle: { model: 'angkot', x: P.hiuGarage.x + 4, z: P.hiuGarage.z + 18, heading: 0, color: 0x18a6a0 }, wanted: 2, guards: [{ dx: 2, dz: 10, weapon: 'pistol' }, { dx: -4, dz: 26, weapon: 'pistol' }], lines: [['radio', 'All units, vehicle theft in Kawasan Industri!']] },
      { type: 'lose-wanted', text: 'Lose the police', lines: [['dimas', 'Duck into the alleys and do not just floor it in a straight line!']] },
      { type: 'drive-to', text: "Bring the angkot behind Bu Lastri's stall", target: P.lastriWarung, radius: 6, requireMissionVehicle: true },
      { type: 'talk', text: 'Unload the cargo', lines: [['lastri', 'Good heavens... harbour papers. Official stamps. Rusdi is paying someone inside.'], ['lastri', 'From now on, call me when the police get too close (key X).']] },
    ],
  },
  {
    id: 'serangan-kota-lama', chapter: 'CHAPTER 4', title: 'Raid on Kota Lama', giver: 'lastri',
    start: P.lastriWarung,
    briefing: 'Hiu Merah knows who stole their angkot. Tonight they come to Kota Lama for revenge.',
    reward: { money: 4000000, xp: 500 },
    stages: [
      { type: 'talk', text: 'Listen to Bu Lastri', lines: [['lastri', 'Raka, hear that? Black cars just stopped at the end of Jalan Bandar.'], ['raka', 'Get inside, Bu. Lock the door.']] },
      { type: 'eliminate', text: 'Defend the stall from the Hiu Merah gunmen', enemies: [{ dx: -22, dz: -4, weapon: 'pistol' }, { dx: -30, dz: -6.5, weapon: 'smg' }, { dx: 18, dz: -5, weapon: 'pistol' }, { dx: 26, dz: -7, weapon: 'pistol' }, { dx: -40, dz: -4, weapon: 'shotgun' }], lines: [['bayu', 'There he is! Wreck the stall while you are at it!'], ['lastri', 'Do not let them break my windows, Raka!']] },
      { type: 'talk', text: 'Check on Bu Lastri', lines: [['lastri', 'You saved this stall... and half of Kota Lama.'], ['lastri', 'Rusdi keeps his ledger at his villa in Bukit Hijau. That is the key.']] },
    ],
  },
  {
    id: 'senja-di-bukit', chapter: 'CHAPTER 5', title: 'Dusk on the Hill', giver: 'lastri',
    start: P.lastriWarung,
    briefing: "Juragan Rusdi's ledger is kept at his villa in Bukit Hijau. The guards are armed.",
    reward: { money: 6000000, xp: 600 }, giveWeapon: ['smg', 120],
    stages: [
      { type: 'drive-to', text: "Go to Juragan Rusdi's villa in Bukit Hijau", target: P.hillVilla, radius: 9, lines: [['lastri', 'Rusdi is out on his boat. Only his men guard the villa.']] },
      { type: 'eliminate', text: 'Take out the villa guards', enemies: [{ dx: 0, dz: 8, weapon: 'pistol' }, { dx: -4, dz: 33, weapon: 'pistol' }, { dx: 4, dz: 35, weapon: 'pistol' }, { dx: 0, dz: 55, weapon: 'rifle' }, { dx: -28, dz: 33, weapon: 'revolver' }], lines: [['raka', 'Five guards. Busy evening.']] },
      { type: 'collect', text: "Grab Rusdi's ledger", at: { dx: 0, dz: 33 }, lines: [['raka', 'Names, dates, container numbers. Container 27...']] },
      { type: 'lose-wanted', text: 'Escape from Bukit Hijau', wanted: 3, lines: [['radio', 'Shots fired in Bukit Hijau! Send the Elang-1 helicopter!']] },
    ],
  },
  {
    id: 'kontainer-27', chapter: 'CHAPTER 6', title: 'Container 27', giver: 'harun',
    start: P.fishMarket,
    briefing: 'The last evidence is in Container 27 at the container yard. Take the pickup with the evidence to the Beach House.',
    reward: { money: 12000000, xp: 900 }, giveWeapon: ['shotgun', 36],
    stages: [
      { type: 'goto', text: 'Enter the container yard', target: P.containerYard, radius: 12, lines: [['harun', 'Those cranes used to be ours. Now everyone pays Rusdi.']] },
      { type: 'eliminate', text: 'Take down the Container 27 guards', enemies: [{ dx: 4, dz: -22, weapon: 'smg' }, { dx: 10, dz: 8, weapon: 'pistol' }, { dx: -2, dz: 24, weapon: 'rifle' }, { dx: 8, dz: -40, weapon: 'pistol' }, { dx: 14, dz: -6, weapon: 'shotgun' }, { dx: -4, dz: -8, weapon: 'pistol' }], lines: [['bayu', 'Finish him! The boss pays double!']] },
      { type: 'enter-vehicle', text: 'Take the pickup with the evidence', vehicle: { model: 'banteng', x: P.containerYard.x + 8, z: P.containerYard.z + 34, heading: Math.PI, color: 0x8a2a1a }, wanted: 4, lines: [['radio', 'Theft at the harbour! Roadblocks on every exit!']] },
      { type: 'drive-to', text: 'Bring the evidence to the Beach House', target: P.beachHouse, radius: 9, requireMissionVehicle: true, lines: [['dimas', 'Cops everywhere! Take the beach road, Rak!']] },
      { type: 'lose-wanted', text: 'Lose the police', lines: [['wulan', 'Raka Wiratama. I know who you are. I also know who Rusdi is.']] },
    ],
  },
  {
    id: 'ombak-terakhir', chapter: 'CHAPTER 7', title: 'The Last Wave', giver: 'dimas',
    start: P.beachHouse,
    briefing: 'Juragan Rusdi has fled to his yacht at the pier. This is his last night in Sanggara.',
    reward: { money: 25000000, xp: 1500 },
    stages: [
      { type: 'drive-to', text: 'Go to the yacht pier', target: P.finalPier, radius: 12, lines: [['dimas', 'I will wait in the car. If you do not come back... I will keep waiting.']] },
      { type: 'eliminate', text: 'Defeat Juragan Rusdi and his men', boss: 'rusdi', enemies: [{ dx: -6, dz: -16, weapon: 'smg' }, { dx: 8, dz: -10, weapon: 'pistol' }, { dx: -4, dz: 6, weapon: 'shotgun' }, { dx: 10, dz: 12, weapon: 'rifle' }, { dx: 0, dz: 22, weapon: 'revolver', boss: true }], lines: [['rusdi', "A fisherman's boy dares to board my yacht?"], ['raka', 'Your yacht is moored in my town, Rusdi.']] },
      { type: 'survive', text: 'Hold out until the police arrive', seconds: 25, wanted: 4, lines: [['wulan', 'All units to the pier. Rusdi belongs to the court, not to anyone else.']] },
      { type: 'lose-wanted', text: 'Vanish into the dusk', lines: [['wulan', 'Go, Raka. Tonight I did not see you.']] },
      { type: 'talk', text: 'Epilogue', lines: [['harun', 'The fish market is busy again, Raka. No more protection money.'], ['dimas', 'So... the harbour is ours now?'], ['raka', 'The harbour belongs to its people. We just keep watch over the dusk.']] },
    ],
  },
];
