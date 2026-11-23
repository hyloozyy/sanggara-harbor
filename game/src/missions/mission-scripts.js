// The story of Pelabuhan Sanggara in seven missions. Each mission is a list of stages the
// MissionRunner understands (goto, enter-vehicle, drive-to, eliminate, chase, collect,
// lose-wanted, survive, talk), with lines of dialogue spoken by the cast.
import { PLACES } from '../city/city-layout.js';

const P = PLACES;

export const STORY_ARC = 'Raka Wiratama pulang ke Pelabuhan Sanggara setelah enam tahun di kapal kargo. Pamannya, Pak Harun, diperas sindikat Hiu Merah milik Juragan Rusdi — yang menyelundupkan barang lewat lapangan peti kemas dan membeli separuh kota.';

export const MISSIONS = [
  {
    id: 'pulang-kampung', chapter: 'BAB 1', title: 'Pulang Kampung', giver: 'dimas',
    start: { x: 7.5, z: -7.5 }, startNow: true,
    briefing: 'Dimas menjemput Raka di Stasiun Sanggara. Kota sudah berubah: Hiu Merah menguasai pelabuhan.',
    reward: { money: 500000, xp: 150 }, unlockCrew: 'dimas',
    stages: [
      { type: 'talk', text: 'Temui Dimas', lines: [['dimas', 'Raka! Enam tahun di kapal, akhirnya pulang juga, bro.'], ['raka', 'Kota ini kelihatan lebih terang dari yang kuingat.'], ['dimas', 'Terang lampunya, gelap urusannya. Ayo, Bu Lastri nunggu.']] },
      { type: 'enter-vehicle', text: 'Masuk ke Kancil Mini milik Dimas', vehicle: { model: 'kancil', x: -4.7, z: -26, heading: Math.PI, color: 0xe0b020 } },
      { type: 'drive-to', text: 'Antar Dimas ke Warung Bu Lastri', target: P.lastriWarung, radius: 6, lines: [['dimas', 'Lewat Jalan Raya Sanggara, belok kiri di Jalan Bandar.'], ['dimas', 'Ingat, di sini nyetirnya di kiri. Jangan kebiasaan kapal!']] },
      { type: 'talk', text: 'Dengar kabar dari Bu Lastri', lines: [['lastri', 'Raka... Pamanmu sedang susah, Nak. Hiu Merah minta setoran tiap minggu.'], ['lastri', 'Yang menagih namanya Bayu. Datanglah ke Pasar Ikan kalau kau masih punya nyali.'], ['raka', 'Nyali masih ada, Bu. Kesabaran yang sudah habis.']] },
    ],
  },
  {
    id: 'ikan-busuk', chapter: 'BAB 2', title: 'Ikan Busuk', giver: 'lastri',
    start: P.lastriWarung,
    briefing: 'Para penagih Hiu Merah sedang memeras pedagang di Pasar Ikan. Usir mereka — dan tangkap si penagih.',
    reward: { money: 1500000, xp: 300 }, giveWeapon: ['pistol', 48],
    stages: [
      { type: 'goto', text: 'Pergi ke Pasar Ikan', target: P.fishMarket, radius: 8, lines: [['lastri', 'Hati-hati. Mereka tidak main-main.']] },
      { type: 'eliminate', text: 'Hajar para penagih Hiu Merah', enemies: [{ dx: 0, dz: -8, weapon: 'fists' }, { dx: 3, dz: 6, weapon: 'fists' }, { dx: -1, dz: 14, weapon: 'fists' }], lines: [['bayu', 'Siapa ini? Pahlawan kesiangan?'], ['raka', 'Keponakan Pak Harun. Kalian salah lapak.']] },
      { type: 'chase', text: 'Kejar Bayu yang kabur naik motor', vehicle: { model: 'bebek', dx: 4.4, dz: 22, color: 0xc82020 }, who: 'bayu', lines: [['bayu', 'Bilang ke pamanmu, Juragan Rusdi tidak akan lupa!'], ['harun', 'Raka! Jangan biarkan dia lolos!']] },
      { type: 'talk', text: 'Bicara dengan Pak Harun', lines: [['harun', 'Kau tumbuh jadi orang keras, Raka. Ayahmu pasti bangga... atau cemas.'], ['harun', 'Simpan pistol ini. Kota ini sudah bukan kota yang dulu.']] },
    ],
  },
  {
    id: 'angkot-panas', chapter: 'BAB 3', title: 'Angkot Panas', giver: 'harun',
    start: P.fishMarket,
    briefing: 'Hiu Merah mengangkut barang selundupan dengan angkot palsu dari garasi mereka di Kawasan Industri. Curi angkotnya.',
    reward: { money: 3000000, xp: 450 }, unlockCrew: 'lastri',
    stages: [
      { type: 'goto', text: 'Pergi ke Garasi Hiu Merah', target: P.hiuGarage, radius: 10, lines: [['harun', 'Angkot jurusan 04, cat hijau toska. Isinya bukan penumpang.']] },
      { type: 'enter-vehicle', text: 'Curi angkot selundupan', vehicle: { model: 'angkot', x: P.hiuGarage.x + 4, z: P.hiuGarage.z + 18, heading: 0, color: 0x18a6a0 }, wanted: 2, guards: [{ dx: 2, dz: 10, weapon: 'pistol' }, { dx: -4, dz: 26, weapon: 'pistol' }], lines: [['radio', 'Semua unit, pencurian kendaraan di Kawasan Industri!']] },
      { type: 'lose-wanted', text: 'Hilangkan kejaran polisi', lines: [['dimas', 'Masuk gang, matikan lampu di kepala, jangan ngebut lurus terus!']] },
      { type: 'drive-to', text: 'Bawa angkot ke belakang Warung Bu Lastri', target: P.lastriWarung, radius: 6, requireMissionVehicle: true },
      { type: 'talk', text: 'Bongkar muatan', lines: [['lastri', 'Ya Tuhan... dokumen pelabuhan. Cap resmi. Rusdi membayar orang dalam.'], ['lastri', 'Mulai sekarang telepon aku kalau polisi terlalu dekat (tombol X).']] },
    ],
  },
  {
    id: 'serangan-kota-lama', chapter: 'BAB 4', title: 'Serangan di Kota Lama', giver: 'lastri',
    start: P.lastriWarung,
    briefing: 'Hiu Merah tahu siapa yang mencuri angkot mereka. Malam ini mereka datang ke Kota Lama untuk membalas.',
    reward: { money: 4000000, xp: 500 },
    stages: [
      { type: 'talk', text: 'Dengarkan Bu Lastri', lines: [['lastri', 'Raka, dengar itu? Mobil-mobil hitam berhenti di ujung Jalan Bandar.'], ['raka', 'Masuk ke dalam, Bu. Kunci pintunya.']] },
      { type: 'eliminate', text: 'Lindungi warung dari penembak Hiu Merah', enemies: [{ dx: -22, dz: -4, weapon: 'pistol' }, { dx: -30, dz: -6.5, weapon: 'smg' }, { dx: 18, dz: -5, weapon: 'pistol' }, { dx: 26, dz: -7, weapon: 'pistol' }, { dx: -40, dz: -4, weapon: 'shotgun' }], lines: [['bayu', 'Itu dia! Hajar warungnya sekalian!'], ['lastri', 'Jangan sampai kaca warungku pecah, Raka!']] },
      { type: 'talk', text: 'Periksa keadaan Bu Lastri', lines: [['lastri', 'Kau menyelamatkan warung ini... dan separuh Kota Lama.'], ['lastri', 'Rusdi menyimpan buku besarnya di vila Bukit Hijau. Itu kuncinya.']] },
    ],
  },
  {
    id: 'senja-di-bukit', chapter: 'BAB 5', title: 'Senja di Bukit', giver: 'lastri',
    start: P.lastriWarung,
    briefing: 'Buku besar Juragan Rusdi tersimpan di vilanya di Bukit Hijau. Penjaganya bersenjata.',
    reward: { money: 6000000, xp: 600 }, giveWeapon: ['smg', 120],
    stages: [
      { type: 'drive-to', text: 'Pergi ke Vila Juragan Rusdi di Bukit Hijau', target: P.hillVilla, radius: 9, lines: [['lastri', 'Rusdi sedang di kapal. Vilanya cuma dijaga anak buah.']] },
      { type: 'eliminate', text: 'Lumpuhkan penjaga vila', enemies: [{ dx: 0, dz: 8, weapon: 'pistol' }, { dx: -4, dz: 33, weapon: 'pistol' }, { dx: 4, dz: 35, weapon: 'pistol' }, { dx: 0, dz: 55, weapon: 'smg' }, { dx: -28, dz: 33, weapon: 'pistol' }], lines: [['raka', 'Lima penjaga. Senja yang sibuk.']] },
      { type: 'collect', text: 'Ambil buku besar Rusdi', at: { dx: 0, dz: 33 }, lines: [['raka', 'Nama-nama, tanggal, nomor kontainer. Kontainer 27...']] },
      { type: 'lose-wanted', text: 'Kabur dari Bukit Hijau', wanted: 3, lines: [['radio', 'Tembakan di Bukit Hijau! Kirim helikopter Elang-1!']] },
    ],
  },
  {
    id: 'kontainer-27', chapter: 'BAB 6', title: 'Kontainer 27', giver: 'harun',
    start: P.fishMarket,
    briefing: 'Bukti terakhir ada di Kontainer 27, di lapangan peti kemas. Ambil pikap berisi bukti dan bawa ke Rumah Pantai.',
    reward: { money: 12000000, xp: 900 }, giveWeapon: ['shotgun', 36],
    stages: [
      { type: 'goto', text: 'Masuk ke Lapangan Peti Kemas', target: P.containerYard, radius: 12, lines: [['harun', 'Derek-derek itu dulu punya kami. Sekarang semua bayar ke Rusdi.']] },
      { type: 'eliminate', text: 'Habisi penjaga Kontainer 27', enemies: [{ dx: 4, dz: -22, weapon: 'smg' }, { dx: 10, dz: 8, weapon: 'pistol' }, { dx: -2, dz: 24, weapon: 'smg' }, { dx: 8, dz: -40, weapon: 'pistol' }, { dx: 14, dz: -6, weapon: 'shotgun' }, { dx: -4, dz: -8, weapon: 'pistol' }], lines: [['bayu', 'Habisi dia! Juragan bayar dobel!']] },
      { type: 'enter-vehicle', text: 'Ambil pikap berisi bukti', vehicle: { model: 'banteng', x: P.containerYard.x + 8, z: P.containerYard.z + 34, heading: Math.PI, color: 0x8a2a1a }, wanted: 4, lines: [['radio', 'Pencurian di pelabuhan! Pasang penghadang di semua jalan keluar!']] },
      { type: 'drive-to', text: 'Bawa bukti ke Rumah Pantai', target: P.beachHouse, radius: 9, requireMissionVehicle: true, lines: [['dimas', 'Polisi di mana-mana! Lewat pantai, Rak!']] },
      { type: 'lose-wanted', text: 'Hilangkan kejaran polisi', lines: [['wulan', 'Raka Wiratama. Aku tahu siapa kau. Aku juga tahu siapa Rusdi.']] },
    ],
  },
  {
    id: 'ombak-terakhir', chapter: 'BAB 7', title: 'Ombak Terakhir', giver: 'dimas',
    start: P.beachHouse,
    briefing: 'Juragan Rusdi kabur ke kapal pesiarnya di dermaga. Ini malam terakhirnya di Sanggara.',
    reward: { money: 25000000, xp: 1500 },
    stages: [
      { type: 'drive-to', text: 'Pergi ke Dermaga Kapal Pesiar', target: P.finalPier, radius: 12, lines: [['dimas', 'Aku tunggu di mobil. Kalau kau tidak kembali... aku tetap tunggu.']] },
      { type: 'eliminate', text: 'Kalahkan Juragan Rusdi dan anak buahnya', boss: 'rusdi', enemies: [{ dx: -6, dz: -16, weapon: 'smg' }, { dx: 8, dz: -10, weapon: 'pistol' }, { dx: -4, dz: 6, weapon: 'shotgun' }, { dx: 10, dz: 12, weapon: 'smg' }, { dx: 0, dz: 22, weapon: 'shotgun', boss: true }], lines: [['rusdi', 'Anak nelayan berani datang ke kapalku?'], ['raka', 'Kapalmu bersandar di kotaku, Rusdi.']] },
      { type: 'survive', text: 'Bertahan sampai polisi datang', seconds: 25, wanted: 4, lines: [['wulan', 'Semua unit ke dermaga. Rusdi milik pengadilan, bukan milik siapa-siapa.']] },
      { type: 'lose-wanted', text: 'Menghilang ke dalam senja', lines: [['wulan', 'Pergi, Raka. Malam ini aku tidak melihatmu.']] },
      { type: 'talk', text: 'Epilog', lines: [['harun', 'Pasar ikan ramai lagi, Raka. Setoran tidak ada lagi.'], ['dimas', 'Jadi... pelabuhan ini punya kita sekarang?'], ['raka', 'Pelabuhan ini punya orang-orangnya. Kita cuma menjaga senjanya.']] },
    ],
  },
];
