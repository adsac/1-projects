// ============================================================
// Modi'in City Simulator — Configuration & Data
// ============================================================
// A geographically-informed model of Modi'in-Maccabim-Re'ut,
// designed by architect Moshe Safdie. The real city is NOT a
// concentric ring — it's a linear settlement stretched along
// the east-west "Dam HaMaccabim" spine with neighborhood pods
// on either side. We capture that:
//
//   • +X is east,  -X is west
//   • +Z is south, -Z is north
//   • Origin is near Titura Hill (city center)
//   • West end (-2100) sits at the valley floor near the train
//     station & mall; the land rises east toward Moriah (+1800).
//   • Highway 443 skirts the north edge; Route 431 the south.
//   • Ben Shemen Forest is northwest, Hashmonaim is east,
//     Maccabim-Re'ut spreads to the southeast.
// ============================================================

import * as THREE from 'three';

// ---------- World extents ----------
export const WORLD_SIZE = 6200;            // terrain plane side (m)
export const TERRAIN_SEGMENTS = 220;
export const CITY_BOUNDS = {
  minX: -2900, maxX: 2100,
  minZ: -1100, maxZ: 1100,
};

// ---------- Street network ----------
// Paths are polylines of [x, z] points in meters. Each street has
// a type that controls width, color, center-line, and speed limit.
export const STREETS = [
  // Main east-west spine — curves gently, climbing west-to-east
  {
    key: "maccabim",
    name: "Dam HaMaccabim Blvd",
    nameHe: "שדרות דם המכבים",
    type: "spine",
    width: 16,
    path: [
      [-2050,   10], [-1600,  -10], [-1100,   0],
      [ -500,   20], [    0,   40], [  500,   60],
      [ 1100,   80], [ 1600,  110], [ 2050,  140],
    ],
  },
  // North arterial
  {
    key: "rabin",
    name: "Sderot Yitzhak Rabin",
    nameHe: "שדרות יצחק רבין",
    type: "arterial",
    width: 13,
    path: [
      [-1900, -380], [-1100, -360], [-200, -340], [600, -320], [1400, -300], [2000, -270],
    ],
  },
  // South arterial
  {
    key: "begin",
    name: "Sderot Menachem Begin",
    nameHe: "שדרות מנחם בגין",
    type: "arterial",
    width: 13,
    path: [
      [-1900, 380], [-1100, 370], [-200, 360], [600, 370], [1400, 390], [2000, 420],
    ],
  },
  // Inner parallels
  {
    key: "zevulun",
    name: "Emek Zevulun",
    nameHe: "עמק זבולון",
    type: "collector",
    width: 9,
    path: [[-1700, -180], [-900, -175], [0, -160], [900, -140], [1700, -110]],
  },
  {
    key: "ela",
    name: "Emek HaElah",
    nameHe: "עמק האלה",
    type: "collector",
    width: 9,
    path: [[-1700, 190], [-900, 185], [0, 180], [900, 200], [1700, 230]],
  },
  {
    key: "dotan",
    name: "Emek Dotan",
    nameHe: "עמק דותן",
    type: "collector",
    width: 8,
    path: [[-1600, -540], [-400, -520], [700, -510], [1600, -490]],
  },
  {
    key: "hula",
    name: "Emek HaHula",
    nameHe: "עמק החולה",
    type: "collector",
    width: 8,
    path: [[-1600, 550], [-400, 560], [700, 580], [1600, 610]],
  },
  // North-south connectors (straight-ish cross streets)
  {
    key: "ns1",
    name: "Derech Nofim",
    nameHe: "דרך הנופים",
    type: "collector",
    width: 8,
    path: [[-1500, -700], [-1500, 700]],
  },
  {
    key: "ns2",
    name: "Derech HaLev",
    nameHe: "דרך הלב",
    type: "collector",
    width: 8,
    path: [[-800, -800], [-800, 800]],
  },
  {
    key: "ns3",
    name: "Derech Moriah",
    nameHe: "דרך מוריה",
    type: "collector",
    width: 8,
    path: [[-200, -800], [-200, 800]],
  },
  {
    key: "ns4",
    name: "Derech Buchman",
    nameHe: "דרך בוכמן",
    type: "collector",
    width: 8,
    path: [[500, -800], [500, 800]],
  },
  {
    key: "ns5",
    name: "Derech Shvatim",
    nameHe: "דרך השבטים",
    type: "collector",
    width: 8,
    path: [[1200, -700], [1200, 700]],
  },
  {
    key: "ns6",
    name: "Derech Avnei Chen",
    nameHe: "דרך אבני חן",
    type: "collector",
    width: 8,
    path: [[1750, -500], [1750, 600]],
  },
  // Route 443: the main corridor Tel Aviv area → Jerusalem. It enters
  // Modi'in from the SW (coming up from the Ayalon Valley), curves
  // above the city along its northern edge, and exits to the NE
  // toward Jerusalem via the Beit Horon pass.
  {
    key: "hw443",
    name: "Route 443 (Tel Aviv–Jerusalem)",
    nameHe: "כביש 443",
    type: "highway",
    width: 24,
    path: [
      [-3000, 200], [-2500, -100], [-2050, -550], [-1700, -780],
      [-1100, -900], [0, -940], [1000, -920], [1900, -880],
      [2500, -700], [3000, -350],
    ],
  },
  // Route 431 south edge (east-west, joins Route 6).
  {
    key: "hw431",
    name: "Route 431",
    nameHe: "כביש 431",
    type: "highway",
    width: 22,
    path: [[-3000, 980], [-1500, 960], [0, 950], [1500, 970], [3000, 1000]],
  },
  // Exit ramp from 443 to the Modi'in Center (near Azrieli).
  {
    key: "exit-center",
    name: "Modi'in Center Exit",
    nameHe: "מחלף מודיעין מרכז",
    type: "arterial",
    width: 11,
    path: [[-1700, -780], [-1600, -700], [-1550, -620], [-1500, -500]],
  },
  // Exit from 443 to Moriah/east
  {
    key: "exit-east",
    name: "Moriah Exit",
    nameHe: "מחלף מוריה",
    type: "arterial",
    width: 11,
    path: [[1900, -880], [1700, -700], [1500, -500], [1400, -320]],
  },
  // Spur to Anabe Park
  {
    key: "anabe-entry",
    name: "Anabe Park Entry",
    nameHe: "כניסת פארק ענבה",
    type: "collector",
    width: 9,
    path: [[1700, 140], [1900, 180], [2050, 230]],
  },
];

// ---------- Neighborhoods ----------
// Axis-aligned rectangles approximating the real pod layout.
// Reference: west-to-east Safdie linear plan. Maccabim and Re'ut
// (merged into the Modi'in-Maccabim-Re'ut municipality in 2003)
// sit as their own neighborhoods on the western side.
export const NEIGHBORHOODS = [
  { key: "maccabim", name: "Maccabim",         nameHe: "מכבים",    center: [-2550,  150], aabb: [-2850, -200, -2250,  500] },
  { key: "reut",     name: "Re'ut",            nameHe: "רעות",     center: [-2050,  200], aabb: [-2250, -150, -1850,  600] },
  { key: "heart",    name: "The Heart / HaLev", nameHe: "לב העיר", center: [-1300, -300], aabb: [-1650, -720, -1000,   80] },
  { key: "kaiser",   name: "Kaiser",           nameHe: "קייזר",    center: [ -750, -500], aabb: [-1100, -800,  -400, -180] },
  { key: "buchman",  name: "Buchman",          nameHe: "בוכמן",    center: [  150, -520], aabb: [ -350, -820,   650, -180] },
  { key: "prachim",  name: "Prachim",          nameHe: "הפרחים",   center: [  850, -500], aabb: [  620, -800,  1150, -180] },
  { key: "avnei",    name: "Avnei Chen",       nameHe: "אבני חן",  center: [ 1450, -450], aabb: [ 1150, -780,  1800, -160] },
  { key: "shvatim",  name: "Shvatim",          nameHe: "השבטים",   center: [ -200,  400], aabb: [ -500,  180,    80,  700] },
  { key: "nofim",    name: "Nofim",            nameHe: "הנופים",   center: [-1150,  480], aabb: [-1500,  180,  -820,  780] },
  { key: "givat-c",  name: "Givat C",          nameHe: "גבעת ג׳",  center: [-1750,  420], aabb: [-1950,  180, -1550,  780] },
  { key: "kramim",   name: "HaKramim",         nameHe: "הכרמים",   center: [  450,  460], aabb: [  100,  180,   820,  780] },
  { key: "moriah",   name: "Moriah",           nameHe: "מוריה",    center: [ 1100,  430], aabb: [  820,  180,  1500,  760] },
];

// ---------- Landmarks ----------
// Only landmarks I can verify are real. Positions are still
// approximate — the goal is relative placement, not GPS accuracy.
export const LANDMARKS = [
  {
    key: "azrieli",
    name: "Azrieli Mall Modi'in",
    nameHe: "קניון עזריאלי מודיעין",
    // Real site: NW corner of the city, on the south side of Route 443,
    // sharing a plaza with the Central Station.
    pos: [-1550, -620], size: [140, 95], h: 28,
    color: 0xe8dcc0, accent: 0x4a78d0,
    type: "mall",
    description: "Central shopping mall adjacent to the railway station.",
  },
  {
    key: "train",
    name: "Modi'in Central Station",
    nameHe: "תחנת הרכבת מודיעין מרכז",
    // Immediately west of the mall.
    pos: [-1780, -620], size: [260, 55], h: 12,
    color: 0xcbc3b2, accent: 0x2b6cb0,
    type: "station",
    description: "Western terminus of the Tel Aviv–Modi'in rail line.",
  },
  {
    key: "cityhall",
    name: "City Hall",
    nameHe: "עיריית מודיעין-מכבים-רעות",
    pos: [-420, 210], size: [72, 62], h: 24,
    color: 0xd9cfb8, accent: 0xc44545,
    type: "civic",
    description: "Municipality of Modi'in-Maccabim-Re'ut.",
  },
  {
    key: "titura",
    name: "Titura Hill",
    nameHe: "תל תיטורה",
    // Small archaeological mound north of the spine.
    pos: [-80, -320], size: [150, 150], h: 48,
    color: 0xb8a888, accent: 0xffcc55,
    type: "hill",
    description: "Archaeological hill with Crusader-era ruins.",
  },
  {
    key: "anabe",
    name: "Anabe Park",
    nameHe: "פארק ענבה",
    // Eastern valley with lake + amphitheater + boardwalks.
    pos: [1600, 300], size: [460, 380], h: 2,
    color: 0x4f7a3a, accent: 0x5aa3d6,
    type: "park",
    description: "Flagship municipal park with a lake and amphitheater.",
  },
  {
    key: "benshemen",
    name: "Ben Shemen Forest",
    nameHe: "יער בן שמן",
    // NW of the city.
    pos: [-2300, -1500], size: [1100, 700], h: 1,
    color: 0x3d6a2c, accent: 0x2a4a1d,
    type: "forest",
    description: "Historic pine forest NW of Modi'in.",
  },
  {
    key: "hashmonaim",
    name: "Hashmonaim",
    nameHe: "חשמונאים",
    // Separate religious community just north of Modi'in.
    pos: [400, -1500], size: [420, 280], h: 9,
    color: 0xe5d5b3, accent: 0x7d3a2a,
    type: "suburb",
    description: "Separate religious community just north of Modi'in.",
  },
  {
    key: "lapid",
    name: "Lapid",
    nameHe: "לפיד",
    // Separate moshav north of Modi'in — not part of the city.
    pos: [-800, -1550], size: [300, 220], h: 8,
    color: 0xe0d2b0, accent: 0x7d3a2a,
    type: "suburb",
    description: "Separate moshav north of Modi'in.",
  },
  {
    key: "modiin-illit",
    name: "Modi'in Illit",
    nameHe: "מודיעין עילית",
    // Separate ultra-Orthodox city on the eastern ridge — not part
    // of the Modi'in-Maccabim-Re'ut municipality.
    pos: [3200, -400], size: [700, 500], h: 22,
    color: 0xd2c09a, accent: 0x6a4b35,
    type: "distant",
    description: "Separate Ultra-Orthodox city on the eastern ridge.",
  },
];

// ---------- Palettes ----------
// Municipal code requires cream-limestone cladding on most buildings;
// we pick from a warm desert palette with subtle variation.
export const BUILDING_COLORS = [
  0xefe3c8, 0xe5d5b3, 0xdcc9a2, 0xf1e6cf, 0xd7c8a8,
  0xeaddbf, 0xe0d2b0, 0xf5ecd2, 0xd2c09a, 0xece1c3,
  0xe8d8b5, 0xdccdac,
];
export const ROOF_COLORS = [0x7d3a2a, 0x6a4b35, 0x5a4534, 0x8a5540, 0x7a4a32];

// Tree species weights (probability distribution used when scattering flora).
export const TREE_SPECIES = ["cypress", "olive", "palm", "pine", "jacaranda"];

// ---------- Vehicle dynamics ----------
export const CAR = {
  maxSpeed: 34,
  reverseSpeed: 10,
  accel: 15,
  brake: 28,
  friction: 2.6,
  steerRate: 1.9,
  steerSpeedDamp: 0.55,
  width: 1.8,
  length: 4.3,
  height: 1.4,
};

// ---------- Traffic & atmosphere ----------
export const TRAFFIC_COUNT = 28;

export const SKY_DAY   = new THREE.Color(0x8ec6ee);
export const SKY_DUSK  = new THREE.Color(0xd67a4c);
export const SKY_NIGHT = new THREE.Color(0x0a0f22);
export const FOG_DAY   = new THREE.Color(0xdbe8f2);
export const FOG_NIGHT = new THREE.Color(0x0a0f22);

export const DEG = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

// ---------- Road & sidewalk widths (fallback) ----------
export const SIDEWALK_WIDTH = 2.5;
