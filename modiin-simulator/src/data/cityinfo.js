// Educational & gameplay content, anchored to REAL coordinates.
// Frame: metres, origin 34.995°E 31.8975°N, +x east, +z south (see loader.js).
// Anchors from Wikidata/OSM-derived data: Modi'in Merkaz stn (1021,-365),
// Pa'atei Modi'in (-3232,431), Umm el-Umdan (132,1261), Titora (284,-1272),
// Anava lake centroid (854,-83), Azrieli mall footprint (1241,-248).

export const SPAWN = { x: 1082, z: -292, yaw: 48 };  // station plaza

export const DISTRICTS = [
  { name: 'HaPrachim', heb: 'שכונת הפרחים', theme: 'flower streets — the first neighborhood, 1996', x: 1300, z: -650, r: 520 },
  { name: 'Mesuah', heb: 'שכונת משואה', theme: 'beacon streets, by Anava Park', x: 250, z: -450, r: 380 },
  { name: 'Avnei Chen', heb: 'שכונת אבני חן', theme: 'gemstone streets — Odem, Bareket, Inbar…', x: 450, z: -220, r: 420 },
  { name: "HaNevi'im", heb: 'שכונת הנביאים', theme: 'prophet streets, from 1999', x: 900, z: -1950, r: 480 },
  { name: 'HaMeginim', heb: 'שכונת המגינים', theme: 'streets of the pre-state defenders', x: 420, z: -1520, r: 420 },
  { name: 'HaKramim', heb: 'שכונת הכרמים', theme: 'vineyard streets — the northern gate', x: 1050, z: -2500, r: 520 },
  { name: 'HaNechalim', heb: 'שכונת הנחלים', theme: 'river streets, along Emek HaHula', x: 1950, z: 250, r: 480 },
  { name: 'HaShvatim (Buchman)', heb: 'שכונת השבטים', theme: 'the Twelve Tribes — heart of the Anglo community', x: 1000, z: 1050, r: 500 },
  { name: 'Moriah (Buchman)', heb: 'שכונת המוריה', theme: 'streets of the heroines of Israel', x: 1450, z: 1600, r: 450 },
  { name: 'HaTzipporim', heb: 'שכונת הציפורים', theme: 'bird streets — the young west, 2017', x: -400, z: 80, r: 420 },
  { name: 'Nofim', heb: 'שכונת נופים', theme: 'Views — the high western quarter, 2019', x: -1500, z: -100, r: 520 },
  { name: 'Morasha', heb: 'שכונת מורשה', theme: 'the newest quarter, still rising', x: -850, z: -700, r: 420 },
  { name: 'Maccabim', heb: 'מכבים', theme: 'founded 1985 by the Maccabi movement — villas and gardens', x: 2150, z: 1300, r: 520 },
  { name: "Re'ut", heb: 'רעות', theme: 'Friendship — founded 1987 by IDF officers', x: 2780, z: 1250, r: 480 },
  { name: "The MA'AR — City Center", heb: 'המע"ר', theme: 'the growing downtown by the station', x: 1120, z: -180, r: 380 },
  { name: 'Ligad / Einav Zone', heb: 'אזור התעשייה ליגד', theme: 'the industrial-tech west', x: -2700, z: -1250, r: 600 },
  { name: "Modi'in Illit", heb: 'מודיעין עילית', theme: 'a SEPARATE ultra-Orthodox city — often confused with Modi\'in', x: 3650, z: -3900, r: 950 },
];

const F = s => `<p class="fact">${s}</p>`;

// builder: bespoke model key from landmarks.js. keepReal: keep the real mapped
// buildings (landmark adds only signage/props). clearR: radius where baked
// buildings are removed so the bespoke model replaces them.
export const LANDMARKS = [
  {
    id: 'station', builder: 'station', x: 1021, z: -365, yaw: 62,
    clearR: 52, collideR: 24, triggerR: 42,
    name: "Modi'in Merkaz Station", heb: 'תחנת מודיעין מרכז',
    kicker: 'Gateway to the city', prompt: 'About the central station',
    info: `<p>Israel's <b>first fully underground railway station</b> — the platforms lie about 15 metres beneath this plaza, under 7,000 m² of hall. Trains reach Ben-Gurion Airport in about a quarter of an hour and continue to Tel Aviv, which is how so many residents live here and work there.</p>
      <p>It opened on <b>1 April 2008</b> — famously about 12 years behind the original schedule. Look west: the railway rides the <b>Anava valley</b> into town, exactly the valley-following move the whole city plan is built on. Beside the plaza, the bus interchange at <b>Kikar HaTachbura</b> has an elevator that drops you straight into Anava Park.</p>
      ${F("Roughly three-quarters of employed residents commute out of Modi'in — the planned TechMod tech park is the city's bid to change that.")}`,
    quiz: {
      q: "What record does Modi'in Merkaz station hold?",
      a: ["Israel's busiest station", "Israel's first fully underground station", "Israel's oldest station", "The world's deepest station"],
      correct: 1,
      explain: "When it opened in 2008 it was Israel's first completely underground railway station.",
    },
  },
  {
    id: 'azrieli', builder: 'sign', x: 1178, z: -282, yaw: 250, keepReal: true,
    collideR: 0, triggerR: 40,
    name: "Azrieli Modi'in Mall", heb: 'קניון עזריאלי מודיעין',
    kicker: 'Where everyone runs into everyone', prompt: "About the mall & the MA'AR",
    info: `<p>The big block beside you is real — its footprint is over <b>25,000 m²</b>, straight from the map. A ~100,000 m² complex sits here: the mall, <b>three office buildings on its roof</b>, a hotel, the 346-seat <b>Einan Hall</b>, and the 15-storey <b>Azrieli Eastern Tower</b>. On a Friday morning half the city passes through.</p>
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
    id: 'cityhall', builder: 'sign', x: 1214, z: -858, yaw: 170, keepReal: true,
    collideR: 0, triggerR: 42,
    name: 'City Hall — Tiltan St.', heb: 'עיריית מודיעין־מכבים־רעות',
    kicker: 'Rabin laid the cornerstone', prompt: "About the city's founding",
    info: `<p>You're on <b>Tiltan (Clover) Street</b> — flower names mark HaPrachim, the city's first neighborhood. Modi'in is Israel's largest fully planned city of the modern era: architect <b>Moshe Safdie</b> drew the plan from 1988 — arteries in the <b>valleys</b>, terraced housing on the <b>hillsides</b>, each valley planted with its own signature tree, half the land left green.</p>
      <p>Prime Minister <b>Yitzhak Rabin</b> attended the cornerstone ceremony in 1993; the first families arrived in 1996. In 2003 the veteran communities of <b>Maccabim</b> and <b>Re'ut</b> joined the city. On Independence Day 2025 the registry counted <b>108,682 residents</b> — heading for a planned quarter-million by 2040.</p>
      ${F('Mayor Haim Bibas (since 2008) also chairs Israel\'s Federation of Local Authorities — effectively "mayor of the mayors."')}`,
    quiz: {
      q: "Who master-planned modern Modi'in?",
      a: ['Moshe Safdie', 'Frank Gehry', 'Santiago Calatrava', 'Le Corbusier'],
      correct: 0,
      explain: "Safdie designed the valleys-and-ridges plan — the same architect behind Yad Vashem's Holocaust History Museum and Singapore's Marina Bay Sands.",
    },
  },
  {
    id: 'museum', builder: 'sign', x: 1240, z: -915, yaw: 200, keepReal: true,
    collideR: 0, triggerR: 38,
    name: 'Hasmonean Heritage Museum', heb: 'מוזיאון מורשת החשמונאים',
    kicker: 'The Maccabees, next door to City Hall', prompt: 'About the Maccabees',
    info: `<p>On <b>Dam HaMaccabim</b> street ("Blood of the Maccabees" — also the Hebrew name of the red everlasting, the flower of remembrance), this museum opened in 2021 to tell the story the city is named for.</p>
      <p>In <b>167 BCE</b>, in the village of Modi'in somewhere in these hills, the priest <b>Mattathias</b> refused a Seleucid order to sacrifice to idols and rose up with his five sons — including <b>Judah Maccabee</b>. Their revolt retook Jerusalem; the Temple was rededicated in 164 BCE, and <b>Hanukkah</b> has marked it ever since. The Hasmonean dynasty ruled an independent Judea for a century.</p>
      ${F("Per the Book of Maccabees, Simon built a seven-pyramid family monument at Modi'in visible from the sea. It has never been conclusively found.")}`,
    quiz: {
      q: "What did Simon the Hasmonean build at ancient Modi'in, according to the Book of Maccabees?",
      a: ['A fortress', 'A seven-pyramid family monument visible from the sea', 'A great synagogue', 'An aqueduct'],
      correct: 1,
      explain: 'The monument with seven pyramids and carved ships has never been conclusively found — archaeologists are still looking.',
    },
  },
  {
    id: 'culture', builder: 'sign', x: 1298, z: -790, yaw: 140, keepReal: true,
    collideR: 0, triggerR: 36,
    name: 'Heichal HaTarbut', heb: 'היכל התרבות',
    kicker: "The city's stage", prompt: "About culture in Modi'in",
    info: `<p>The municipal cultural hall — a 600-seat auditorium, rooftop gallery and café, and a 150-seat outdoor amphitheatre — carries the city's calendar: concerts, theatre, stand-up, "Shabbat Tarbut" mornings. Summer nights move to the <b>1,000-seat amphitheatre over the lake</b> in Anava Park.</p>
      <p>Modi'in belongs to the <b>UNESCO Global Network of Learning Cities</b> — fitting for a town where <b>92.6%</b> of students earn their bagrut, among Israel's highest rates, with near-zero dropout.</p>
      ${F("About 65% of the city's adults hold an academic degree; household earnings run ~30% above the national average.")}`,
    quiz: {
      q: "Which UNESCO network does Modi'in belong to?",
      a: ['World Heritage Sites', 'Creative Cities', 'Global Network of Learning Cities', 'Biosphere Reserves'],
      correct: 2,
      explain: 'The city was admitted to the UNESCO Global Network of Learning Cities.',
    },
  },
  {
    id: 'sport', builder: 'sign', x: 620, z: -1080, yaw: 90, keepReal: true,
    collideR: 0, triggerR: 38,
    name: 'Municipal Sports Center', heb: 'המרכז העירוני לספורט',
    kicker: 'Emek Zevulun 5', prompt: 'About sports in the city',
    info: `<p>Twelve dunams in the heart of town on <b>Emek Zevulun</b>: the municipal pool, tennis courts, a gym, and an indoor hall where the city's leagues run all winter. A 6,000-seat stadium and arena are approved for the Einav zone out west.</p>
      <p>Safdie's valleys double as the city's linear sports grounds — pitches and bike paths thread every wadi. And yes, there's baseball: walk east along <b>Emek HaHula</b> to find the diamond.</p>
      ${F("Ironi Modi'in fields the local soccer teams; youth basketball, hockey and baseball leagues thrive on the Anglo side of town.")}`,
  },
  {
    id: 'anava', builder: 'amphi', x: 795, z: -20, yaw: 145,
    clearR: 45, collideR: 0, triggerR: 44,
    name: 'Anava Park & Lake', heb: 'פארק ענבה',
    kicker: 'Half this city is green', prompt: 'About Anava Park',
    info: `<p>The city's flagship park fills the Anava wadi below the station — Israel's self-styled <b>"first smart park."</b> The lake beside you is traced from the real one: almost exactly <b>14 dunams</b> of water, with rowboats on weekends, a spray park, lawns, and this <b>1,000-seat amphitheatre</b> above the shore.</p>
      <p>Safdie's plan gave each valley a signature tree — the <b>Valley of Pines</b>, the <b>Valley of Palms</b>, the <b>Valley of Jacarandas</b> — and kept at least half of every valley parkland. Around <b>50% of Modi'in's area is green space</b>.</p>
      ${F('On Independence Day the whole city seems to fit in this park at once.')}`,
    quiz: {
      q: "What did Safdie's plan reserve the valleys for?",
      a: ['Industry', 'Parking', 'Green public parks', 'Reservoirs'],
      correct: 2,
      explain: "The valleys are the city's green spines — housing climbs the hillsides instead.",
    },
  },
  {
    id: 'titora', builder: 'titora', x: 284, z: -1272, yaw: -20,
    clearR: 80, collideR: 7, triggerR: 44,
    name: 'Titora Hill', heb: 'גבעת התיתורה',
    kicker: '6,000 years underfoot', prompt: 'About Titora Hill',
    info: `<p>The city's <b>315-metre</b> lookout — you just climbed the real contours — has been used by humans for some <b>6,000 years</b>: Chalcolithic farmers, First-Temple villagers, Hasmonean rebels, Bar-Kokhba fighters hiding in tunnels, Byzantine monks, <b>Crusader knights</b> whose two-storey fortress ("el-Burj") crowned this summit, and Ottoman farmers. Caves, cisterns, wine presses and a columbarium riddle the slopes.</p>
      <p>In 2017, about <b>2,500 Israeli schoolchildren</b> joined community digs here and uncovered a 900-year-old cache of Crusader-period rings, bracelets and earrings. Residents have fought to keep the hill wild — it was landscaped as an archaeological garden in 2018.</p>
      ${F("Titora is one of several candidates for ancient Modi'in itself — no one has proven where the Maccabees' village stood.")}`,
    quiz: {
      q: 'Who found the 900-year-old jewellery cache on Titora in 2017?',
      a: ['A construction crew', 'Schoolchildren on a community dig', 'A metal-detector hobbyist', 'French archaeologists'],
      correct: 1,
      explain: 'Some 2,500 kids helped excavate the Crusader fortress — and hit the jackpot.',
    },
  },
  {
    id: 'umdan', builder: 'ruins', x: 132, z: 1261, yaw: 10,
    clearR: 80, collideR: 0, triggerR: 44,
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
    id: 'paatei', builder: 'paatei', x: -3232, z: 431, yaw: 75,
    clearR: 60, collideR: 24, triggerR: 46,
    name: "Pa'atei Modi'in Station", heb: 'תחנת פאתי מודיעין',
    kicker: 'First stop, 2007', prompt: 'About the western gateway',
    info: `<p>The city's second station opened in <b>September 2007</b>, months before the central one — its platforms really do sit in the <b>median of Route 431</b>, right here at the western entrance, by the Yishpro center and the Ligad industrial zone.</p>
      <p>A new line toward <b>Rishon LeZion</b> is on the way, and approved plans would extend the railway under the city to a whole new northern business quarter with a hospital and a college. Modi'in sits almost exactly halfway between Tel Aviv (~35 km) and Jerusalem (~30 km) — the whole reason a city was planted here.</p>
      ${F('The ridge to the north carries Highway 443 — the ancient ascent from the coastal plain to Jerusalem that the Maccabees fought along.')}`,
    quiz: {
      q: "Why was Modi'in built exactly here?",
      a: ['For the sea view', 'Halfway between Tel Aviv and Jerusalem', 'Next to a river', 'On an old airfield'],
      correct: 1,
      explain: 'The planners wanted a major city midway on the Tel Aviv–Jerusalem axis — with rail to both.',
    },
  },
  {
    id: 'yishpro', builder: 'sign', x: -2950, z: 700, yaw: 320, keepReal: true,
    collideR: 0, triggerR: 44, hideOnMap: true,
    name: 'Yishpro Center', heb: 'מרכז ישפרו',
    kicker: 'Big-box Friday', prompt: 'About the shopping strips',
    info: `<p>The open-air big-box strip at the western entrance: supermarkets, DIY sheds, a cinema and bowling. Between this, the Azrieli mall, and each neighborhood's little commercial centre, the joke is that Modi'inites measure all distances in minutes-to-parking.</p>
      ${F('The Ligad industrial-tech zone next door — and the planned TechMod park — are meant to finally give the commuter city its own jobs.')}`,
  },
  {
    id: 'ballfield', builder: 'baseball', x: 2200, z: 230, yaw: 45,
    clearR: 55, collideR: 0, triggerR: 42,
    name: 'The Emek HaHula Ballfield', heb: 'מגרש הבייסבול',
    kicker: 'Baseball, in Israel?', prompt: "About Modi'in baseball",
    info: `<p>Yes, baseball — the Israel Association of Baseball lists real diamonds here in the valley parks, on <b>Emek HaHula</b> and Emek Yizrael. Modi'in's huge community of American, Canadian, British and South African immigrants brought their games with them.</p>
      <p>In 2007 the professional Israel Baseball League fielded the <b>Modi'in Miracle</b>, managed by "Miracle Mets" star <b>Art Shamsky</b>. With its final draft pick the team selected 71-year-old Hall-of-Famer <b>Sandy Koufax</b> — the ultimate honorary tribute. He politely declined to suit up.</p>
      ${F("Walk Buchman on a Friday and count the languages — estimates of the city's English-speaking share start at 10% and climb.")}`,
    quiz: {
      q: "Which legend did the Modi'in Miracle draft in 2007?",
      a: ["Babe Ruth's grandson", 'Sandy Koufax, aged 71', 'Derek Jeter', 'Art Shamsky'],
      correct: 1,
      explain: 'Koufax was drafted as an honorary gesture with the last pick — and gracefully declined.',
    },
  },
  {
    id: 'maccabim', builder: 'sign', x: 2085, z: 1305, yaw: 15, keepReal: true,
    collideR: 0, triggerR: 44,
    name: 'Maccabim', heb: 'מכבים',
    kicker: 'The elder sibling', prompt: "About Maccabim & Re'ut",
    info: `<p>Before the big city existed, two garden communities stood on these southeastern hills: <b>Maccabim</b> (founded 1985 by the worldwide Maccabi sports movement — hence the name) and <b>Re'ut</b> ("friendship," founded 1987 by a group of IDF officers). They merged with each other in 1990, and with young Modi'in in <b>2003</b>.</p>
      <p>Look around: the low red-roofed villas and gardens are nothing like Modi'in's stone terraces across the valley — the two generations of town-building sit side by side. A quirk of history, too: Maccabim lies in the 1949 Armistice <b>no-man's land</b>, so the EU does not recognise this slice of the city in its agreements with Israel.</p>
      ${F("The merged city's triple-barrelled name honours the Maccabees twice — once as Modi'in, once as Maccabim.")}`,
    quiz: {
      q: "Who founded Re'ut in 1987?",
      a: ['A kibbutz movement', 'A group of IDF officers', 'American olim', 'The Maccabi movement'],
      correct: 1,
      explain: "Re'ut — \"friendship\" — was founded by an association of army officers; Maccabim by the Maccabi World Union.",
    },
  },
  {
    id: 'nofim', builder: 'lookout', x: -2290, z: 300, yaw: 262,
    clearR: 35, collideR: 0, triggerR: 40,
    name: 'Nofim Promenade', heb: 'טיילת נופים',
    kicker: 'The western views', prompt: 'About the young west',
    info: `<p><b>Nofim</b> means "views," and this western rim is why: on a clear evening the coastal plain rolls out below — the real elevation drop under your feet is about 150 metres from here to the Ben Shemen forest.</p>
      <p>The western quarters are the city's newest ring — HaTzipporim (2017), Nofim (2019), and <b>Morasha</b>, still sprouting cranes across the wadi, with 4,200 homes planned. Zero to 108,000 residents in one generation — and the west is where the next 100,000 begin.</p>
      ${F('A footbridge over the Anava wadi links Nofim to Morasha — valley below, city above, exactly as Safdie sketched it.')}`,
  },
  {
    id: 'morasha', builder: 'crane', x: -900, z: -750, yaw: 70, hideOnMap: true,
    clearR: 70, collideR: 22, triggerR: 40,
    name: 'Morasha — Under Construction', heb: 'שכונת מורשה בבנייה',
    kicker: 'The city is not finished', prompt: 'About the growing city',
    info: `<p>Cranes over the Anava's north bank: <b>Morasha</b>, the city's newest neighborhood, has been rising since 2018 — this construction site is mapped, not invented. Approved masterplans take Modi'in to about <b>250,000 residents by 2040</b>, with a new northern business quarter, a hospital, an academic campus, and the railway extended beneath the city.</p>
      ${F("Modi'in went from bare hills in 1996 to one of Israel's largest cities-in-the-making in a single generation.")}`,
  },
  {
    id: 'hanukkiah', builder: 'hanukkiah', x: 252, z: -1305, yaw: 20, hideOnMap: true,
    collideR: 4, triggerR: 26,
    name: 'The Great Hanukkiah', heb: 'החנוכייה הגדולה',
    kicker: 'Light all eight torches', prompt: 'About the torch relay',
    info: `<p>Every Hanukkah since <b>1944</b>, Maccabi youth have lit a torch at the traditional Maccabean graves near Modi'in and run it in relay ~32 km to Jerusalem — past the Knesset and the President's Residence to a giant menorah at the Western Wall. The relay has skipped only one winter: the war of 1948.</p>
      <p><b>Your quest:</b> find the eight torches burning across the city — each stands at a place that tells Modi'in's story. Every torch you light kindles one candle here on Titora's summit.</p>`,
  },
];

export const TORCHES = [
  { x: 150, z: 1238, hint: "Among the Maccabees' own columns." },      // Umm el-Umdan
  { x: 305, z: -1252, hint: 'On 6,000 years of history.' },            // Titora summit
  { x: 810, z: -52, hint: 'By the lake in the green valley.' },        // Anava
  { x: 1048, z: -330, hint: 'Where the trains dive underground.' },    // station plaza
  { x: 1198, z: -880, hint: "By the Maccabees' museum." },             // civic campus
  { x: 2185, z: 252, hint: 'At home plate.' },                         // ballfield
  { x: 2100, z: 1282, hint: 'On the red-roofed hills.' },              // Maccabim
  { x: -2272, z: 318, hint: 'Above the western views.' },              // Nofim promenade
];

export const AMBIENT_FACTS = [
  'Every street around you is real — names, curves and hills come straight from the map of Modi\'in.',
  'The Hebrew word <i>modi\'in</i> also means "intelligence" — but the city is named for the Maccabees\' ancient village.',
  "Modi'in went from zero residents in 1996 to over 108,000 today — and is planned to reach about 250,000 by 2040.",
  'Notice the roundabouts? Locals joke you can cross the whole city without ever meeting a traffic light.',
  'Almost every roof carries a <i>dud shemesh</i> — a solar water heater. Israeli law has required them on new homes since 1980.',
  'The cream stone cladding is required by city regulation on main streets — that\'s why the whole city glows the same warm beige.',
  "See a city on the far northeastern hill? That's Modi'in Illit — a separate ultra-Orthodox city, forever confused with Modi'in.",
  "You're walking real topography: the city spans roughly 230–320 m above sea level, ridge and wadi alternating.",
  'The main arteries are named for the valleys of Israel — Emek Ayalon, Emek Zevulun, Emek HaHula — and they literally run in the valleys.',
  'Each valley has a signature tree: pines, palms, or jacarandas. When the jacarandas bloom purple, everyone photographs the same street.',
  "Where exactly ancient Modi'in stood is still an open scholarly fight between at least four sites in and around the modern city.",
  'The "Tombs of the Maccabees" nearby may actually be a Byzantine-era memorial — a 2015 dig couldn\'t settle it.',
  "Modi'in's bagrut pass rate of ~92.6% is one of the highest of any city in Israel.",
  "Rochester, New York and Aventura, Florida are Modi'in's sister cities.",
  'There is no hospital in the city yet — one is planned for the new northern quarter. For now: Terem urgent care on Tiltan Street.',
  'Street themes mark the neighborhoods — flowers, gemstones, prophets, tribes, rivers, birds, vineyards. Directions are given by theme.',
];
