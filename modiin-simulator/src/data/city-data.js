// ─────────────────────────────────────────────────────────────────────────────
// Modi'in-Maccabim-Re'ut — hand-crafted geographic & educational data.
// Coordinates: metres. +x = east, −z = north (the player faces north at yaw 0).
// The map is a compressed miniature (~2.4 km across for a ~6 km city), but
// relative positions follow the real city, anchored on verified coordinates:
// Modi'in Merkaz stn 31.9008N 35.0058E · Pa'atei Modi'in 31.8936N 34.9608E ·
// Umm el-Umdan 31.8861N 34.9964E · Titora ≈31.909N 34.998E. Scale ≈ 0.37×.
// ─────────────────────────────────────────────────────────────────────────────

export const WORLD = { size: 2400 };

export const SPAWN = { x: 462, z: 310, yaw: 40 }; // station plaza, facing the station

export const TERRAIN = {
  base: 6,
  hills: [
    { x: 120, z: -180, r: 160, h: 28 },   // Titora Hill (315 m) — the city lookout
    { x: 350, z: 560, r: 280, h: 16 },    // Buchman ridge (HaShvatim/Moriah), south of the wadi
    { x: 380, z: -430, r: 300, h: 14 },   // northern ridge (HaNevi'im / HaKramim)
    { x: -800, z: 250, r: 250, h: 18 },   // Nofim heights — the western views
    { x: -850, z: 850, r: 280, h: 14 },   // Maccabim–Re'ut ridge, southwest
    { x: 620, z: 10, r: 220, h: 10 },     // HaPrachim rise, east of centre
    { x: -450, z: -450, r: 260, h: 8 },   // northwest slopes toward Ligad
    { x: -150, z: 180, r: 220, h: -5 },   // the Anava wadi — the city's green trench
  ],
  flats: [
    { x: 430, z: 260, r: 80 },            // station + plaza
    { x: 330, z: 345, r: 70 },            // Azrieli mall plot
    { x: 510, z: 125, r: 60 },            // civic campus (city hall + museum)
    { x: 60, z: 700, r: 55 },             // Umm el-Umdan
    { x: 50, z: 130, r: 75 },             // Anava lake basin
    { x: -1050, z: 520, r: 55 },          // Pa'atei Modi'in station
    { x: -930, z: 615, r: 55 },           // Yishpro center
    { x: 420, z: 600, r: 55 },            // Buchman ballfield
    { x: 590, z: 20, r: 45 },             // sports center
  ],
};

// ── Roads ────────────────────────────────────────────────────────────────────
// kinds: boulevard (valley arteries, planted medians), street, rail
export const ROADS = [
  { // Route 443 — the old Jerusalem road, skirting the city's north; Shilat Jct at NE
    name: 'Route 443', heb: 'כביש 443', kind: 'boulevard', width: 15,
    pts: [[-1180, -280], [-800, -420], [-300, -560], [200, -660], [700, -745], [1180, -800]],
  },
  { // Route 431 — the south/west boundary, toward Rishon LeZion; Pa'atei stn in its median
    name: 'Route 431', heb: 'כביש 431', kind: 'boulevard', width: 15,
    pts: [[-1180, 470], [-1050, 520], [-820, 590], [-500, 690], [-100, 780], [400, 790], [900, 720], [1180, 660]],
  },
  { // Sderot HaHashmona'im — THE spine: Shilat Jct (443, NE) through the centre to 431 (SW)
    name: "Sderot HaHashmona'im", heb: 'שדרות החשמונאים', kind: 'boulevard', width: 12,
    pts: [[700, -745], [620, -480], [540, -230], [485, 20], [440, 250], [340, 450], [140, 630], [-100, 780]],
  },
  { // Sderot Yitzhak Rabin — the western parallel spine
    name: 'Sderot Yitzhak Rabin', heb: 'שדרות יצחק רבין', kind: 'boulevard', width: 11,
    pts: [[-300, -560], [-230, -260], [-170, 40], [-90, 340], [30, 560], [140, 630]],
  },
  { // Emek Zevulun — east–west artery past the sports centre to the station bus deck
    name: 'Emek Zevulun', heb: 'עמק זבולון', kind: 'boulevard', width: 10,
    pts: [[640, 15], [470, 115], [300, 170], [40, 235], [-250, 300], [-520, 345]],
  },
  { // Emek Ayalon — from HaPrachim north to Titora's foot
    name: 'Emek Ayalon', heb: 'עמק איילון', kind: 'street', width: 9,
    pts: [[520, 90], [400, -30], [265, -110], [160, -165]],
  },
  { // Emek HaEla — northern neighborhoods
    name: 'Emek HaEla', heb: 'עמק האלה', kind: 'street', width: 9,
    pts: [[250, -430], [450, -380], [640, -310]],
  },
  { // Emek Beit She'an
    name: "Emek Beit She'an", heb: 'עמק בית שאן', kind: 'street', width: 9,
    pts: [[250, -230], [460, -185], [630, -140]],
  },
  { // Emek Dotan / Emek HaHula — HaNechalim, below Titora
    name: 'Emek Dotan', heb: 'עמק דותן', kind: 'street', width: 9,
    pts: [[-380, -360], [-160, -260], [-10, -190]],
  },
  { // northern entrance from 443 into HaKramim
    name: 'HaKramim entrance', heb: 'כניסה צפונית', kind: 'street', width: 9,
    pts: [[200, -660], [280, -520], [330, -430]],
  },
  { // Derech Menachem Begin — the Buchman loop, south
    name: 'Derech Menachem Begin', heb: 'דרך מנחם בגין', kind: 'street', width: 9,
    pts: [[140, 630], [300, 700], [480, 640], [560, 500], [520, 380]],
  },
  { // HaShdera HaMerkazit — serving the young western districts & Ligad
    name: 'HaShdera HaMerkazit', heb: 'השדרה המרכזית', kind: 'street', width: 10,
    pts: [[-680, -300], [-740, -80], [-780, 150], [-720, 330], [-640, 420]],
  },
  { // Maccabim & Re'ut access from 431
    name: "Maccabim-Re'ut access", heb: 'דרך מכבים רעות', kind: 'street', width: 9,
    pts: [[-820, 590], [-830, 720], [-870, 850], [-900, 940]],
  },
  { // Re'ut lane
    name: 'HaShikma', heb: 'השקמה', kind: 'street', width: 8,
    pts: [[-900, 940], [-780, 990], [-680, 940]],
  },
  { // Maccabim lane
    name: 'HaGefen', heb: 'הגפן', kind: 'street', width: 8,
    pts: [[-830, 720], [-720, 760], [-640, 830]],
  },
  { // railway — enters from the west along Route 431, then up the Anava valley
    // to dive underground at Modi'in Merkaz
    name: 'Railway', heb: 'מסילת הרכבת', kind: 'rail', width: 8,
    pts: [[-1180, 490], [-1050, 512], [-820, 470], [-550, 390], [-300, 310], [-80, 255], [150, 250], [350, 258]],
  },
];

// Roundabouts — the city's running joke. Art: menorah / sculpture / flag / olive
export const ROUNDABOUTS = [
  { x: 458, z: 178, r: 11, art: 'menorah' },   // station square
  { x: 485, z: 20, r: 10, art: 'flag' },       // civic centre
  { x: 140, z: 630, r: 10, art: 'sculpture' }, // Buchman corner
  { x: 40, z: 235, r: 9, art: 'olive' },       // park edge
  { x: -170, z: 40, r: 9, art: 'sculpture' },
  { x: 620, z: -480, r: 9, art: 'olive' },
  { x: 330, z: -430, r: 9, art: 'olive' },     // HaKramim entrance
  { x: -230, z: -260, r: 9, art: 'olive' },
  { x: -720, z: 330, r: 9, art: 'sculpture' }, // Nofim
  { x: -830, z: 720, r: 8, art: 'olive' },     // Maccabim
  { x: 300, z: 170, r: 8, art: 'olive' },
  { x: 640, z: 15, r: 9, art: 'sculpture' },   // sports centre corner
];

// ── Districts (housing generators + name banners) ───────────────────────────
export const DISTRICTS = [
  {
    name: 'HaPrachim', heb: 'שכונת הפרחים', theme: 'streets named for flowers — the first neighborhood, 1996',
    x: 600, z: 10, r: 190, count: 56, floors: 4,
    palette: ['#e7dcc3', '#efe6d0', '#e0d2b0'],
  },
  {
    name: 'Mesuah', heb: 'שכונת משואה', theme: 'streets named for beacons — beside Anava Park',
    x: -60, z: 400, r: 160, count: 44, floors: 4,
    palette: ['#eee4cd', '#e2d5b4'],
  },
  {
    name: 'Avnei Chen', heb: 'שכונת אבני חן', theme: 'streets named for gemstones — Odem, Bareket, Inbar…',
    x: -390, z: 490, r: 190, count: 54, floors: 4,
    palette: ['#eae0c6', '#f1e9d6'],
  },
  {
    name: "HaNevi'im", heb: 'שכונת הנביאים', theme: 'streets named for the prophets, from 1999',
    x: 430, z: -290, r: 170, count: 50, floors: 5,
    palette: ['#efe6d0', '#e5d8ba'],
  },
  {
    name: 'HaMeginim', heb: 'שכונת המגינים', theme: 'streets honoring the pre-state defenders',
    x: 120, z: -390, r: 150, count: 40, floors: 5,
    palette: ['#e7dcc3', '#eee4cd'],
  },
  {
    name: 'HaKramim', heb: 'שכונת הכרמים', theme: 'streets named for wine & vineyards — the northern gate',
    x: 380, z: -560, r: 170, count: 48, floors: 6,
    palette: ['#f0e8d5', '#e6dcc4'],
  },
  {
    name: 'HaNechalim', heb: 'שכונת הנחלים', theme: 'streets named for rivers — under Titora Hill',
    x: -230, z: -320, r: 170, count: 46, floors: 4,
    palette: ['#e7dcc3', '#ded0ad'],
  },
  {
    name: 'HaShvatim (Buchman)', heb: 'שכונת השבטים', theme: 'the Twelve Tribes — heart of the Anglo community',
    x: 350, z: 530, r: 180, count: 52, floors: 3,
    palette: ['#f2ead8', '#eadfc6'],
  },
  {
    name: 'Moriah (Buchman)', heb: 'שכונת המוריה', theme: 'streets named for the heroines of Israel',
    x: 260, z: 700, r: 150, count: 40, style: 'cottages',
    palette: ['#f4eee0', '#efe6d0'],
  },
  {
    name: 'HaTzipporim', heb: 'שכונת הציפורים', theme: 'streets named for birds — the young west, 2017',
    x: -560, z: 380, r: 150, count: 34, floors: 8,
    palette: ['#f0e8d5', '#e8e2d2'],
  },
  {
    name: 'Nofim', heb: 'שכונת נופים', theme: 'Views — the high western quarter, 2019',
    x: -790, z: 270, r: 160, count: 36, floors: 8,
    palette: ['#f0e8d5', '#e2d5b4'],
  },
  {
    name: 'Morasha', heb: 'שכונת מורשה', theme: 'the newest quarter — still rising on the Anava\'s north bank',
    x: -740, z: 40, r: 150, count: 20, floors: 6,
    palette: ['#e8e2d2', '#dcd6c6'],
  },
  {
    name: 'Maccabim', heb: 'מכבים', theme: 'founded 1985 by the Maccabi movement — villas and gardens',
    x: -760, z: 790, r: 170, style: 'cottages', count: 50,
    palette: ['#f4eee0', '#efe6d0'],
  },
  {
    name: "Re'ut", heb: 'רעות', theme: 'Friendship — founded 1987 by IDF officers; red roofs, quiet lanes',
    x: -810, z: 970, r: 160, style: 'cottages', count: 44,
    palette: ['#f4eee0', '#eee4cd'],
  },
  {
    name: "The MA'AR — City Center", heb: 'המע"ר', theme: 'the growing downtown around the station',
    x: 420, z: 390, r: 130, count: 12, floors: 10,
    palette: ['#e8e2d2', '#dcd6c6'],
  },
];

// ── Parks ────────────────────────────────────────────────────────────────────
export const PARKS = [
  { // Anava Park — the flagship, along the wadi west/northwest of the station
    name: 'Anava Park', x: 130, z: 160, r: 150, color: '#55843a',
    lake: { r: 58, dx: -70, dz: -20 },
  },
  { name: 'Anava Park west', x: -160, z: 170, r: 120, color: '#55843a' },
  { name: 'Titora slopes', x: 120, z: -180, r: 160, color: '#6d8a4a' },
  { name: 'Valley of Pines', x: 350, z: -180, r: 90, color: '#5f8f3e' },   // HaNevi'im valley
  { name: 'Valley of Jacarandas', x: -100, z: -100, r: 80, color: '#5f8f3e' },
  { name: 'Buchman valley park', x: 250, z: 480, r: 70, color: '#55843a' },
  { name: 'Kramim park', x: 330, z: -500, r: 60, color: '#5f8f3e' },
  { name: 'Nofim promenade park', x: -820, z: 300, r: 70, color: '#6d8a4a' },
  { name: "Re'ut green", x: -740, z: 930, r: 60, color: '#55843a' },
];

// ── Landmarks ────────────────────────────────────────────────────────────────
const F = s => `<p class="fact">${s}</p>`;

export const LANDMARKS = [
  {
    id: 'station', builder: 'station', x: 430, z: 258, yaw: -15,
    clearR: 75, collideR: 30, triggerR: 45,
    name: "Modi'in Merkaz Station", heb: 'תחנת מודיעין מרכז',
    kicker: 'Gateway to the city', prompt: 'About the central station',
    info: `<p>Israel's <b>first fully underground railway station</b> — the platforms lie about 15 metres beneath this plaza, under 7,000 m² of hall. Trains reach Ben-Gurion Airport in about a quarter of an hour and continue to Tel Aviv, which is how so many residents live here and work there.</p>
      <p>It opened on <b>1 April 2008</b> — famously about 12 years behind the original schedule. Note where the tracks vanish underground west of here: the railway rides the <b>Anava valley</b> into town, exactly the kind of valley-following move the whole city plan is built on. Beside the plaza: the bus interchange at <b>Kikar HaTachbura</b>, with an elevator that drops you straight into Anava Park.</p>
      ${F('Roughly three-quarters of employed residents commute out of Modi\'in — the planned TechMod tech park is the city\'s bid to change that.')}`,
    quiz: {
      q: "What record does Modi'in Merkaz station hold?",
      a: ["Israel's busiest station", "Israel's first fully underground station", "Israel's oldest station", "The world's deepest station"],
      correct: 1,
      explain: "When it opened in 2008 it was Israel's first completely underground railway station.",
    },
  },
  {
    id: 'azrieli', builder: 'mall', x: 330, z: 350, yaw: -15,
    clearR: 85, collideR: 45, triggerR: 60,
    name: "Azrieli Modi'in Mall", heb: 'קניון עזריאלי מודיעין',
    kicker: 'Where everyone runs into everyone', prompt: 'About the mall & the MA\'AR',
    info: `<p>A ~100,000 m² complex right beside the station: the mall, <b>three office buildings sitting on its roof</b>, a hotel, the 346-seat <b>Einan Hall</b>, and the newer 15-storey <b>Azrieli Eastern Tower</b> — the tallest thing in town. On a Friday morning half the city seems to pass through here.</p>
      <p>For years Modi'in was teased as a bedroom suburb, "a city without a centre." The answer is rising all around you: the <b>MA'AR</b> central business district, whose first offices opened from 2020 onward.</p>
      ${F("Modi'in's average age is about 34 — one of the youngest big cities in Israel, and you can tell by the stroller traffic here.")}`,
    quiz: {
      q: "What was the classic complaint about Modi'in that the MA'AR downtown is meant to fix?",
      a: ['Too much traffic', 'A city without a real centre', 'Not enough parks', 'Too far from the airport'],
      correct: 1,
      explain: 'Haaretz even ran the headline "Was building Modi\'in a mistake?" in 2008 — the new downtown is the municipal comeback.',
    },
  },
  {
    id: 'cityhall', builder: 'cityhall', x: 515, z: 120, yaw: 195,
    clearR: 60, collideR: 26, triggerR: 42,
    name: 'City Hall', heb: 'עיריית מודיעין־מכבים־רעות',
    kicker: 'Rabin laid the cornerstone', prompt: "About the city's founding",
    info: `<p>Modi'in is Israel's largest fully planned city of the modern era. Architect <b>Moshe Safdie</b> — of Habitat 67 and Marina Bay Sands fame — drew the plan from 1988: arteries in the <b>valleys</b>, terraced housing on the <b>hillsides</b>, each valley planted with its own signature tree, and about half the land left green.</p>
      <p>Prime Minister <b>Yitzhak Rabin</b> attended the cornerstone ceremony in 1993; the first families arrived in 1996. In 2003 the veteran communities of <b>Maccabim</b> and <b>Re'ut</b> joined the young city. On Independence Day 2025 the registry counted <b>108,682 residents</b> — headed for a planned quarter-million by around 2040.</p>
      ${F('Mayor Haim Bibas (since 2008) also chairs Israel\'s Federation of Local Authorities — effectively "mayor of the mayors."')}`,
    quiz: {
      q: "Who master-planned modern Modi'in?",
      a: ['Moshe Safdie', 'Frank Gehry', 'Santiago Calatrava', 'Le Corbusier'],
      correct: 0,
      explain: "Safdie designed the valleys-and-ridges plan — the same architect behind Yad Vashem's Holocaust History Museum and Singapore's Marina Bay Sands.",
    },
  },
  {
    id: 'museum', builder: 'museum', x: 560, z: 165, yaw: 230,
    clearR: 45, collideR: 18, triggerR: 32,
    name: 'Hasmonean Heritage Museum', heb: 'מוזיאון מורשת החשמונאים',
    kicker: 'The Maccabees, next door to City Hall', prompt: 'About the Maccabees',
    info: `<p>Opened in 2021 beside City Hall, this small museum tells the story the city is named for. In <b>167 BCE</b>, in the village of Modi'in somewhere in these hills, the priest <b>Mattathias</b> refused a Seleucid order to sacrifice to idols, and rose up with his five sons — Yohanan, Shimon, <b>Judah Maccabee</b>, Eleazar and Jonathan.</p>
      <p>Judah led the revolt that retook Jerusalem; the Temple was rededicated in 164 BCE, and the festival of <b>Hanukkah</b> has marked it ever since. The Hasmonean dynasty they founded ruled an independent Judea for a century.</p>
      ${F('The street outside is called Dam HaMaccabim — "Blood of the Maccabees," which is also the Hebrew name of the red everlasting flower of remembrance.')}`,
    quiz: {
      q: 'What did Simon the Hasmonean build at ancient Modi\'in, according to the Book of Maccabees?',
      a: ['A fortress', 'A seven-pyramid family monument visible from the sea', 'A great synagogue', 'An aqueduct'],
      correct: 1,
      explain: 'The monument with seven pyramids and carved ships has never been conclusively found — archaeologists are still looking.',
    },
  },
  {
    id: 'culture', builder: 'culture', x: 450, z: 60, yaw: 160,
    clearR: 55, collideR: 26, triggerR: 38,
    name: 'Heichal HaTarbut', heb: 'היכל התרבות',
    kicker: "The city's stage", prompt: "About culture in Modi'in",
    info: `<p>The municipal cultural hall — a 600-seat auditorium, rooftop gallery and café, and a 150-seat outdoor amphitheatre — carries the city's calendar: concerts, theatre, stand-up, and "Shabbat Tarbut" mornings. Summer nights move to the <b>1,000-seat amphitheatre over the lake</b> in Anava Park.</p>
      <p>Modi'in is a member of the <b>UNESCO Global Network of Learning Cities</b> — fitting for a town where <b>92.6%</b> of students earn their bagrut (matriculation), among the highest rates in Israel, with a dropout rate near zero.</p>
      ${F("About 65% of the city's adults hold an academic degree, and household earnings run ~30% above the national average.")}`,
    quiz: {
      q: "Which UNESCO network does Modi'in belong to?",
      a: ['World Heritage Sites', 'Creative Cities', 'Global Network of Learning Cities', 'Biosphere Reserves'],
      correct: 2,
      explain: 'The city was admitted to the UNESCO Global Network of Learning Cities.',
    },
  },
  {
    id: 'sport', builder: 'sport', x: 600, z: 15, yaw: 250,
    clearR: 50, collideR: 24, triggerR: 36,
    name: 'Municipal Sports Center', heb: 'המרכז העירוני לספורט',
    kicker: 'Emek Zevulun 5', prompt: 'About sports in the city',
    info: `<p>Twelve dunams in the heart of town: the municipal pool, tennis courts, a gym, and an indoor hall where the city's basketball and volleyball leagues run all winter. A 6,000-seat stadium and arena are approved for the Einav zone out west.</p>
      <p>Every neighborhood also gets its own courts and bike paths — Safdie's valleys double as the city's linear sports grounds. And yes, there's baseball; walk the Buchman ridge to find the diamond.</p>
      ${F("Ironi Modi'in fields the local soccer teams; youth basketball, hockey and baseball leagues thrive on the Anglo side of town.")}`,
  },
  {
    id: 'anava', builder: 'amphi', x: 165, z: 205, yaw: -35,
    clearR: 45, collideR: 0, triggerR: 42,
    name: 'Anava Park & Lake', heb: 'פארק ענבה',
    kicker: 'Half this city is green', prompt: 'About Anava Park',
    info: `<p>The city's flagship park fills the Anava wadi below the station — Israel's self-styled <b>"first smart park."</b> A boating lake of some <b>14 dunams</b>, lawns, a spray park, a lakeside canteen, and this <b>1,000-seat amphitheatre</b> looking over the water. On Independence Day the whole city seems to fit in here.</p>
      <p>Safdie's plan gave each valley a signature tree — the <b>Valley of Pines</b>, the <b>Valley of Palms</b>, the <b>Valley of Jacarandas</b> — and kept at least half of every valley as parkland. Around <b>50% of Modi'in's area is green space</b>, laced with bike paths.</p>
      ${F('Rowboats and pedal boats ply the lake on weekends; herons drop by uninvited.')}`,
    quiz: {
      q: "What did Safdie's plan reserve the valleys for?",
      a: ['Industry', 'Parking', 'Green public parks', 'Reservoirs'],
      correct: 2,
      explain: "The valleys are the city's green spines — housing climbs the hillsides instead.",
    },
  },
  {
    id: 'titora', builder: 'titora', x: 120, z: -180, yaw: -20,
    clearR: 60, collideR: 7, triggerR: 42,
    name: 'Titora Hill', heb: 'גבעת התיתורה',
    kicker: '6,000 years underfoot', prompt: 'About Titora Hill',
    info: `<p>The city's 315-metre lookout has been used by humans for some <b>6,000 years</b> — Chalcolithic farmers, First-Temple villagers, Hasmonean rebels, Bar-Kokhba fighters hiding in tunnels, Byzantine monks, <b>Crusader knights</b> whose two-storey fortress ("el-Burj") crowned this summit, and Ottoman farmers. Caves, cisterns, wine presses and a columbarium riddle the slopes.</p>
      <p>In 2017, about <b>2,500 Israeli schoolchildren</b> joined community digs here and uncovered a 900-year-old cache of Crusader-period rings, bracelets and earrings. Residents have fought to keep the hill wild — it's the city's favourite lookout and dog-walking mountain, landscaped as an archaeological garden in 2018.</p>
      ${F("Titora is one of several candidates for ancient Modi'in itself — no one has proven where the Maccabees' village actually stood.")}`,
    quiz: {
      q: 'Who found the 900-year-old jewellery cache on Titora in 2017?',
      a: ['A construction crew', 'Schoolchildren on a community dig', 'A metal-detector hobbyist', 'French archaeologists'],
      correct: 1,
      explain: 'Some 2,500 kids helped excavate the Crusader fortress — and hit the jackpot.',
    },
  },
  {
    id: 'umdan', builder: 'ruins', x: 60, z: 700, yaw: 10,
    clearR: 60, collideR: 0, triggerR: 42,
    name: 'Umm el-Umdan', heb: "ח'ירבת אום אל־עומדאן",
    kicker: 'Where Hanukkah may have begun', prompt: 'About the ancient synagogue',
    info: `<p>"Mother of Columns" in Arabic — rescue digs here in 2000–2003, on the city's southern edge by Route 431, exposed a Jewish village of the Maccabees' own era: houses, alleys, a mikveh, and a <b>synagogue first built in the late 2nd century BCE</b> — one of the <b>oldest synagogues ever found in Israel</b>, later rebuilt in Herod's day on eight columns.</p>
      <p>Beneath it lies an even earlier public hall from around 200 BCE — the very generation of Mattathias and his sons. The excavators believe this may be ancient Modi'in itself, or its satellite "Modi'it."</p>
      ${F("If they're right, you are standing in the Maccabees' home village right now.")}`,
    quiz: {
      q: 'What makes the synagogue at Umm el-Umdan special?',
      a: ['It is the largest ancient synagogue in Israel', 'It is one of the oldest ever found in Israel', 'It has a gold mosaic floor', 'It was built by Herod personally'],
      correct: 1,
      explain: "Its first phase dates to the Hasmonean era, late 2nd century BCE — the Maccabees' own generation.",
    },
  },
  {
    id: 'paatei', builder: 'paatei', x: -1050, z: 520, yaw: 12,
    clearR: 60, collideR: 26, triggerR: 42,
    name: "Pa'atei Modi'in Station", heb: 'תחנת פאתי מודיעין',
    kicker: 'First stop, 2007', prompt: 'About the western gateway',
    info: `<p>The city's second station opened in <b>September 2007</b>, months before the central one — its platforms sit in the <b>median of Route 431</b> at the western entrance, by the Yishpro shopping center and the Ligad industrial zone.</p>
      <p>A new line toward <b>Rishon LeZion</b> is on the way, and approved plans would extend the railway under the city to a whole new northern business quarter with a hospital and a college. Modi'in sits almost exactly halfway between Tel Aviv (~35 km) and Jerusalem (~30 km) — the whole reason a city was planted here.</p>
      ${F('Beyond the ridge to the north runs Highway 443 — the ancient ascent from the coastal plain to Jerusalem that the Maccabees fought along.')}`,
    quiz: {
      q: "Why was Modi'in built exactly here?",
      a: ['For the sea view', 'Halfway between Tel Aviv and Jerusalem', 'Next to a river', 'On an old airfield'],
      correct: 1,
      explain: 'The planners wanted a major city midway on the Tel Aviv–Jerusalem axis — with rail to both.',
    },
  },
  {
    id: 'yishpro', builder: 'bigbox', x: -930, z: 615, yaw: 100, hideOnMap: true,
    clearR: 55, collideR: 30, triggerR: 38,
    name: 'Yishpro Center', heb: 'מרכז ישפרו',
    kicker: 'Big-box Friday', prompt: 'About the shopping strips',
    info: `<p>The open-air big-box strip by the western entrance: supermarkets, DIY sheds, a cinema and bowling. Between this, the Azrieli mall, and each neighborhood's little commercial centre, the joke is that Modi'inites measure all distances in minutes-to-parking.</p>
      ${F('The Ligad industrial-tech zone next door — and the planned TechMod park — are meant to finally give the commuter city its own jobs.')}`,
  },
  {
    id: 'ballfield', builder: 'baseball', x: 420, z: 600, yaw: 45,
    clearR: 55, collideR: 0, triggerR: 40,
    name: 'The Buchman Ballfield', heb: 'מגרש הבייסבול',
    kicker: 'Baseball, in Israel?', prompt: "About Modi'in baseball",
    info: `<p>Yes, baseball. Modi'in's huge community of American, Canadian, British and South African immigrants — concentrated right here on the <b>Buchman</b> ridge — brought their games with them.</p>
      <p>In 2007 the professional Israel Baseball League fielded the <b>Modi'in Miracle</b>, managed by "Miracle Mets" star <b>Art Shamsky</b>. With its final draft pick the team selected 71-year-old Hall-of-Famer <b>Sandy Koufax</b> — the ultimate honorary tribute to the famously Sabbath-observant pitcher. He politely declined to suit up.</p>
      ${F("Walk Buchman on a Friday and count the languages — estimates of the city's English-speaking share start at 10% and climb from there.")}`,
    quiz: {
      q: "Which legend did the Modi'in Miracle draft in 2007?",
      a: ["Babe Ruth's grandson", 'Sandy Koufax, aged 71', 'Derek Jeter', 'Art Shamsky'],
      correct: 1,
      explain: 'Koufax was drafted as an honorary gesture with the last pick — and gracefully declined.',
    },
  },
  {
    id: 'maccabim', builder: 'synagogue', x: -760, z: 760, yaw: 150,
    clearR: 45, collideR: 14, triggerR: 38,
    name: 'Maccabim', heb: 'מכבים',
    kicker: 'The elder sibling', prompt: "About Maccabim & Re'ut",
    info: `<p>Before the big city existed, two garden communities stood on this southwestern ridge: <b>Maccabim</b> (founded 1985 by the worldwide Maccabi sports movement — hence the name) and <b>Re'ut</b> ("friendship," founded 1987 by a group of IDF officers). They merged with each other in 1990, and with young Modi'in in <b>2003</b>.</p>
      <p>They kept their character — villas, gardens, <b>red-tiled roofs</b>, no apartment blocks, and the little Lev Re'ut centre for errands — plus a quirk of history: Maccabim sits in the 1949 Armistice <b>no-man's land</b>, so the EU does not recognise this slice of the city in its agreements with Israel.</p>
      ${F("The merged city's triple-barrelled name honours the Maccabees twice — once as Modi'in, once as Maccabim.")}`,
    quiz: {
      q: "Who founded Re'ut in 1987?",
      a: ['A kibbutz movement', 'A group of IDF officers', 'American olim', 'The Maccabi movement'],
      correct: 1,
      explain: "Re'ut — \"friendship\" — was founded by an association of army officers; Maccabim by the Maccabi World Union.",
    },
  },
  {
    id: 'nofim', builder: 'lookout', x: -830, z: 280, yaw: 265,
    clearR: 40, collideR: 0, triggerR: 36,
    name: 'Nofim Promenade', heb: 'טיילת נופים',
    kicker: 'The western views', prompt: 'About the young west',
    info: `<p><b>Nofim</b> means "views," and this rim promenade is why: on a clear evening the whole coastal plain rolls out below, from the Ben Shemen forest at your feet to the Tel Aviv towers glinting on the horizon.</p>
      <p>The western quarters are the city's newest ring — HaTzipporim (2017), Nofim (2019), and <b>Morasha</b>, still sprouting cranes across the wadi, with 4,200 homes planned. Zero to 108,000 residents in one generation — and the west is where the next 100,000 begin.</p>
      ${F('A footbridge over the Anava wadi links Nofim to Morasha — valley below, city above, exactly as Safdie sketched it.')}`,
  },
  {
    id: 'morasha', builder: 'crane', x: -740, z: 30, yaw: 70, hideOnMap: true,
    clearR: 50, collideR: 22, triggerR: 36,
    name: 'Morasha — Under Construction', heb: 'שכונת מורשה בבנייה',
    kicker: 'The city is not finished', prompt: 'About the growing city',
    info: `<p>Cranes over the Anava's north bank: <b>Morasha</b>, the city's newest neighborhood, has been rising since 2018. Approved masterplans take Modi'in to about <b>250,000 residents by 2040</b> — with a new northern business quarter, a hospital, an academic campus, and the railway extended beneath the city to reach them.</p>
      ${F("Modi'in went from bare hills in 1996 to Israel's tenth-largest-city trajectory in a single generation.")}`,
  },
  {
    id: 'hanukkiah', builder: 'hanukkiah', x: 95, z: -215, yaw: 20, hideOnMap: true,
    clearR: 18, collideR: 4, triggerR: 24,
    name: 'The Great Hanukkiah', heb: 'החנוכייה הגדולה',
    kicker: 'Light all eight torches', prompt: 'About the torch relay',
    info: `<p>Every Hanukkah since <b>1944</b>, Maccabi youth have lit a torch at the traditional Maccabean graves near Modi'in and run it in relay ~32 km to Jerusalem — past the Knesset and the President's Residence to a giant menorah at the Western Wall. The relay has skipped only one winter: the war of 1948.</p>
      <p><b>Your quest:</b> find the eight torches burning across the city — each stands at a place that tells Modi'in's story. Every torch you light kindles one candle here on Titora's summit.</p>`,
  },
];

// ── Torch quest positions (orange dots on the minimap) ──────────────────────
export const TORCHES = [
  { x: 40, z: 675, hint: "Among the Maccabees' own columns." },        // Umm el-Umdan
  { x: 145, z: -150, hint: 'On 6,000 years of history.' },             // Titora summit
  { x: 105, z: 175, hint: 'By the lake in the green valley.' },        // Anava park
  { x: 462, z: 292, hint: 'Where the trains dive underground.' },      // station plaza
  { x: 585, z: 190, hint: "At the Maccabees' museum." },               // heritage museum
  { x: 398, z: 578, hint: 'At home plate.' },                          // ballfield
  { x: -785, z: 742, hint: "On the veterans' ridge." },                // Maccabim
  { x: -845, z: 305, hint: 'Above the western views.' },               // Nofim promenade
];

// ── Ambient wandering facts ──────────────────────────────────────────────────
export const AMBIENT_FACTS = [
  'The Hebrew word <i>modi\'in</i> also means "intelligence" — the city shares its name with Israel\'s word for an intelligence service, but it\'s really named for the Maccabees\' ancient village.',
  "Modi'in went from zero residents in 1996 to over 108,000 today — and is planned to reach about 250,000 by 2040.",
  'Notice the roundabouts? Locals joke you can cross the whole city without ever meeting a traffic light.',
  'Almost every roof carries a <i>dud shemesh</i> — a solar water heater. Israeli law has required them on new homes since 1980.',
  'The cream-coloured stone cladding is required by city regulation on main streets — that\'s why the whole city glows the same warm beige.',
  "Don't confuse Modi'in with Modi'in Illit or with Hashmonaim — separate towns nearby that also borrowed the Maccabee branding.",
  "Modi'in sits about 230–320 m above sea level in the Judean foothills — high enough for a breeze, low enough to skip Jerusalem's winter chill.",
  'The main arteries are named for the valleys of Israel — Emek Ayalon, Emek Zevulun, Emek HaEla — and they literally run in valleys, as the plan ordered.',
  "Each valley has a signature tree: pines in one, palms in another, jacarandas in a third. When the jacarandas bloom purple, everyone photographs the same street.",
  "Where exactly ancient Modi'in stood is still an open scholarly fight between at least four sites in and around the modern city.",
  'The "Tombs of the Maccabees" nearby may actually be a Byzantine-era memorial to the Maccabees — a 2015 dig couldn\'t settle it.',
  "Modi'in's bagrut pass rate of ~92.6% is one of the highest of any city in Israel.",
  "Rochester, New York and Aventura, Florida are Modi'in's sister cities.",
  'There is no hospital in the city yet — one is in the plans for the new northern quarter. For now: Terem urgent care on Tiltan Street.',
  'Streets are themed by neighborhood — flowers, gemstones, prophets, tribes, rivers, birds, vineyards. Residents give directions by theme.',
];
