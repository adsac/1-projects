// ============================================================
// Modi'in City Simulator — Configuration & Data
// ============================================================
// A simplified, playable representation of the Israeli city
// of Modi'in-Maccabim-Re'ut, designed originally by architect
// Moshe Safdie. The layout uses concentric ring roads around
// a central civic plaza, with radial avenues cutting through
// named neighborhoods. All coordinates are in meters and the
// Y axis is "up" (following Three.js convention).
// ============================================================

import * as THREE from 'three';

// ---------- World ----------
export const WORLD_SIZE = 3600;            // terrain side length in meters
export const TERRAIN_SEGMENTS = 180;       // heightmap resolution
export const CITY_RADIUS = 1300;           // urban footprint from center

// Concentric ring roads (distance from city center).
// Named after real-world Modi'in arterial boulevards.
export const RINGS = [
  { r: 160,  name: "Dam HaMaccabim",     innerBuildingFactor: 0.92 },
  { r: 360,  name: "Emek Zevulun",       innerBuildingFactor: 0.90 },
  { r: 620,  name: "Derech Menachem Begin", innerBuildingFactor: 0.90 },
  { r: 920,  name: "Sderot Yitzhak Rabin", innerBuildingFactor: 0.88 },
  { r: 1220, name: "Kvish HaArava",      innerBuildingFactor: 0.86 },
];

// Radial avenues (angle in radians, starting from +X axis going CCW).
// Twelve spokes gives the city its distinctive pie-slice neighborhoods.
export const RADIAL_COUNT = 12;

// ---------- Neighborhoods ----------
// Each lives in one or two pie-slice wedges between rings.
// `angle` is the center azimuth in degrees (0 = east, 90 = north).
export const NEIGHBORHOODS = [
  { key: "buchman",   name: "Buchman",           nameHe: "בוכמן",        angle: 45,  minR: 360, maxR: 1220 },
  { key: "kaiser",    name: "Kaiser",            nameHe: "קייזר",         angle: 0,   minR: 360, maxR: 920 },
  { key: "moriah",    name: "Moriah",            nameHe: "מוריה",         angle: 315, minR: 360, maxR: 1220 },
  { key: "prachim",   name: "Prachim",           nameHe: "הפרחים",        angle: 270, minR: 160, maxR: 920 },
  { key: "nofim",     name: "Nofim",             nameHe: "הנופים",        angle: 225, minR: 360, maxR: 1220 },
  { key: "shvatim",   name: "Shvatim",           nameHe: "השבטים",        angle: 180, minR: 360, maxR: 920 },
  { key: "avnei",     name: "Avnei Hen",         nameHe: "אבני חן",       angle: 135, minR: 360, maxR: 1220 },
  { key: "kfar",      name: "Kfar Daniel Gate",  nameHe: "שער כפר דניאל", angle: 90,  minR: 360, maxR: 920 },
  { key: "givat-c",   name: "Givat C",           nameHe: "גבעת ג'",       angle: 300, minR: 160, maxR: 620 },
  { key: "heart",     name: "The Heart",         nameHe: "הלב",           angle: 0,   minR: 0,   maxR: 160 },
];

// ---------- Landmarks ----------
// Destination points with visible 3D structures and floating labels.
// `size` is footprint in meters, `h` is height, `color` is the building tone.
export const LANDMARKS = [
  {
    key: "azrieli",
    name: "Azrieli Mall Modi'in",
    nameHe: "עזריאלי מודיעין",
    pos: [0, 0],
    size: [90, 90],
    h: 28,
    color: 0xe8dcc0,
    accent: 0x5588ff,
    type: "mall",
    description: "Central shopping mall & civic plaza.",
  },
  {
    key: "cityhall",
    name: "City Hall",
    nameHe: "עיריית מודיעין-מכבים-רעות",
    pos: [0, -250],
    size: [60, 60],
    h: 22,
    color: 0xd9cfb8,
    accent: 0xc44545,
    type: "civic",
    description: "Modi'in-Maccabim-Re'ut municipality.",
  },
  {
    key: "anabe",
    name: "Anabe Park",
    nameHe: "פארק ענבה",
    pos: [1050, 150],
    size: [320, 240],
    h: 2,
    color: 0x4f7a3a,
    accent: 0x6dbbea,
    type: "park",
    description: "Large lakeside recreational park.",
  },
  {
    key: "trainstation",
    name: "Modi'in Central Station",
    nameHe: "תחנת רכבת מודיעין מרכז",
    pos: [-650, 780],
    size: [180, 50],
    h: 14,
    color: 0xcbc3b2,
    accent: 0x2b6cb0,
    type: "station",
    description: "Israel Railways terminal.",
  },
  {
    key: "iscar",
    name: "ISCAR Industrial Park",
    nameHe: "פארק תעשייה איסכאר",
    pos: [-200, 1100],
    size: [220, 120],
    h: 16,
    color: 0xbfb9a8,
    accent: 0x888888,
    type: "industrial",
    description: "Hi-tech & industrial campus on the northern edge.",
  },
  {
    key: "ccc",
    name: "Country Club",
    nameHe: "קאנטרי קלאב מודיעין",
    pos: [700, -550],
    size: [110, 70],
    h: 12,
    color: 0xdde6d8,
    accent: 0x3aa6d0,
    type: "sport",
    description: "Pools, gym, outdoor courts.",
  },
  {
    key: "stadium",
    name: "Maccabim Stadium",
    nameHe: "אצטדיון מכבים",
    pos: [-900, -200],
    size: [140, 100],
    h: 18,
    color: 0xd6d3ca,
    accent: 0x36b36b,
    type: "sport",
    description: "Football pitch and running track.",
  },
  {
    key: "lookout",
    name: "Titura Hill Lookout",
    nameHe: "גבעת תיטורה",
    pos: [-1150, 450],
    size: [30, 30],
    h: 40,
    color: 0xb8a888,
    accent: 0xffcc55,
    type: "nature",
    description: "Archaeological site with panoramic views.",
  },
  {
    key: "forest",
    name: "Ben Shemen Forest",
    nameHe: "יער בן שמן",
    pos: [1300, -900],
    size: [500, 400],
    h: 1,
    color: 0x3d6a2c,
    accent: 0x2a4a1d,
    type: "forest",
    description: "Historic pine forest at the city's edge.",
  },
];

// ---------- Building palettes ----------
// Modi'in is famous for its cream-limestone cladding, a municipal
// requirement. We vary within a warm desert palette.
export const BUILDING_COLORS = [
  0xefe3c8, 0xe5d5b3, 0xdcc9a2, 0xf1e6cf, 0xd7c8a8,
  0xeaddbf, 0xe0d2b0, 0xf5ecd2, 0xd2c09a, 0xece1c3,
];
export const ROOF_COLORS = [0x7d3a2a, 0x6a4b35, 0x5a4534, 0x8a5540];

// ---------- Vehicle dynamics ----------
export const CAR = {
  maxSpeed: 32,           // m/s (~115 km/h)
  reverseSpeed: 10,       // m/s
  accel: 14,              // m/s^2
  brake: 26,              // m/s^2
  friction: 2.5,          // m/s^2 idle decel
  steerRate: 1.8,         // rad/s at low speed
  steerSpeedDamp: 0.55,   // how quickly steering response drops with speed
  width: 1.8,
  length: 4.3,
  height: 1.4,
};

// ---------- Traffic ----------
export const TRAFFIC_COUNT = 22;

// ---------- Sky & time of day ----------
export const SKY_DAY = new THREE.Color(0x87c0ea);
export const SKY_DUSK = new THREE.Color(0xd2754b);
export const SKY_NIGHT = new THREE.Color(0x0a0f22);
export const FOG_DAY = new THREE.Color(0xcfe0ef);
export const FOG_NIGHT = new THREE.Color(0x0a0f22);

// ---------- Utility ----------
export const DEG = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

// Flatten-zone radius: how close to a road center counts as paved.
export const ROAD_WIDTH = 9;            // lane width times two lanes + shoulder
export const SIDEWALK_WIDTH = 2.5;
