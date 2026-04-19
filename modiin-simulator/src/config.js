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
  minX: -2100, maxX: 2100,
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
  // Highways at the city edges
  {
    key: "hw443",
    name: "Highway 443",
    nameHe: "כביש 443",
    type: "highway",
    width: 22,
    path: [[-3000, -950], [-1200, -920], [800, -900], [3000, -870]],
  },
  {
    key: "hw431",
    name: "Highway 431",
    nameHe: "כביש 431",
    type: "highway",
    width: 22,
    path: [[-3000, 970], [-1200, 950], [800, 960], [3000, 990]],
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
// Axis-aligned rectangles that approximate the real pod layout.
export const NEIGHBORHOODS = [
  { key: "heart",   name: "The Heart / HaLev",  nameHe: "הלב",         center: [-1600,   50], aabb: [-2000, -200, -1200,  250] },
  { key: "nofim",   name: "Nofim",              nameHe: "הנופים",       center: [-1400, -450], aabb: [-1800, -800, -1000, -200] },
  { key: "givat-c", name: "Givat C",            nameHe: "גבעת ג׳",      center: [-1300,  500], aabb: [-1750,  200,  -900,  800] },
  { key: "kaiser",  name: "Kaiser",             nameHe: "קייזר",        center: [ -500, -470], aabb: [ -900, -800,  -100, -180] },
  { key: "prachim", name: "Prachim",            nameHe: "הפרחים",       center: [ -500,  490], aabb: [ -900,  200,  -100,  780] },
  { key: "buchman", name: "Buchman",            nameHe: "בוכמן",        center: [  250, -470], aabb: [ -100, -800,   650, -180] },
  { key: "avnei",   name: "Avnei Chen",         nameHe: "אבני חן",      center: [  300,  500], aabb: [ -100,  200,   700,  800] },
  { key: "moriah",  name: "Moriah",             nameHe: "מוריה",        center: [  900,  490], aabb: [  550,  200,  1250,  800] },
  { key: "shvatim", name: "Shvatim",            nameHe: "השבטים",       center: [ 1550, -400], aabb: [ 1250, -750,  1900,  -80] },
  { key: "kramim",  name: "HaKramim",           nameHe: "הכרמים",       center: [ 1600,  500], aabb: [ 1300,  200,  1950,  780] },
];

// ---------- Landmarks ----------
// All positions roughly reflect real-world placement within
// Modi'in relative to the city spine.
export const LANDMARKS = [
  {
    key: "azrieli",
    name: "Azrieli Mall Modi'in",
    nameHe: "קניון עזריאלי מודיעין",
    pos: [-1780, -90], size: [130, 90], h: 28,
    color: 0xe8dcc0, accent: 0x4a78d0,
    type: "mall",
    description: "Central shopping mall next to the railway station.",
  },
  {
    key: "train",
    name: "Modi'in Central Station",
    nameHe: "תחנת הרכבת מודיעין מרכז",
    pos: [-1940, -130], size: [240, 55], h: 12,
    color: 0xcbc3b2, accent: 0x2b6cb0,
    type: "station",
    description: "Terminus of Israel Railways line from Tel Aviv.",
  },
  {
    key: "cityhall",
    name: "City Hall",
    nameHe: "עיריית מודיעין-מכבים-רעות",
    pos: [-520, 100], size: [70, 60], h: 24,
    color: 0xd9cfb8, accent: 0xc44545,
    type: "civic",
    description: "Municipality of Modi'in-Maccabim-Re'ut.",
  },
  {
    key: "titura",
    name: "Titura Hill",
    nameHe: "תל תיטורה",
    pos: [50, 30], size: [160, 160], h: 55,
    color: 0xb8a888, accent: 0xffcc55,
    type: "hill",
    description: "Archaeological hill at the geographic heart of the city.",
  },
  {
    key: "anabe",
    name: "Anabe Park",
    nameHe: "פארק ענבה",
    pos: [1700, 250], size: [420, 350], h: 2,
    color: 0x4f7a3a, accent: 0x5aa3d6,
    type: "park",
    description: "Large lakeside park in the eastern valley.",
  },
  {
    key: "country",
    name: "Modi'in Country Club",
    nameHe: "קאנטרי קלאב מודיעין",
    pos: [260, -560], size: [130, 80], h: 10,
    color: 0xdde6d8, accent: 0x3aa6d0,
    type: "sport",
    description: "Pools, gym, outdoor courts.",
  },
  {
    key: "stadium",
    name: "Maccabim Stadium",
    nameHe: "אצטדיון מכבים",
    pos: [-920, -770], size: [160, 115], h: 18,
    color: 0xd6d3ca, accent: 0x36b36b,
    type: "stadium",
    description: "Football pitch and running track.",
  },
  {
    key: "library",
    name: "Modi'in Central Library",
    nameHe: "הספרייה העירונית",
    pos: [-420, 160], size: [45, 40], h: 14,
    color: 0xead5a5, accent: 0x3b6bb2,
    type: "civic",
    description: "Public library and cultural hall.",
  },
  {
    key: "highschool",
    name: "'Ort' High School",
    nameHe: "תיכון אורט",
    pos: [600, 260], size: [80, 60], h: 10,
    color: 0xd7cfb8, accent: 0xb86a2f,
    type: "school",
    description: "A city school among many.",
  },
  {
    key: "benshemen",
    name: "Ben Shemen Forest",
    nameHe: "יער בן שמן",
    pos: [-1300, -1600], size: [1000, 600], h: 1,
    color: 0x3d6a2c, accent: 0x2a4a1d,
    type: "forest",
    description: "Historic pine forest northwest of the city.",
  },
  {
    key: "hashmonaim",
    name: "Hashmonaim",
    nameHe: "חשמונאים",
    pos: [2300, -1150], size: [450, 300], h: 9,
    color: 0xe5d5b3, accent: 0x7d3a2a,
    type: "suburb",
    description: "Neighboring town to the northeast.",
  },
  {
    key: "maccabim-reut",
    name: "Maccabim-Re'ut",
    nameHe: "מכבים-רעות",
    pos: [1800, 1200], size: [550, 300], h: 9,
    color: 0xe0d2b0, accent: 0x6a4b35,
    type: "suburb",
    description: "Older suburb merged with Modi'in in 2003.",
  },
  {
    key: "modiin-illit",
    name: "Modi'in Illit (distant)",
    nameHe: "מודיעין עילית",
    pos: [3200, -400], size: [700, 500], h: 22,
    color: 0xd2c09a, accent: 0x6a4b35,
    type: "distant",
    description: "Ultra-Orthodox city visible on the eastern ridge.",
  },
  {
    key: "westgate",
    name: "Western Gateway",
    nameHe: "שער המערב",
    pos: [-2080, 40], size: [14, 14], h: 28,
    color: 0xd2c09a, accent: 0xffd277,
    type: "gateway",
    description: "Landmark sculpture at the city's west entrance.",
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
