// ============================================================
// fetch-osm.mjs — Pull Modi'in map data from OpenStreetMap via
// the Overpass API and project it into the simulator's local
// meters coordinate system.
//
// Usage:  node tools/fetch-osm.mjs
// Output: data/osm.json (kept under version control so players
//         don't need internet to run the sim).
// ============================================================

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Approximate bounding box covering Modi'in-Maccabim-Re'ut + the
// main Route 443 corridor and the nearby communities (Hashmonaim,
// Lapid, Ben Shemen Forest).
const BBOX = {
  south: 31.8600,
  west:  34.9500,
  north: 31.9400,
  east:  35.0600,
};
// Origin for the local-meters coordinate system — a point roughly
// at the city's geographic center, so the simulator's (0,0) is
// near the civic core.
const ORIGIN = { lat: 31.8950, lng: 35.0100 };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const OUT_DIR = join(ROOT, 'data');
mkdirSync(OUT_DIR, { recursive: true });

// ---- Overpass query ---------------------------------------------------
const { south, west, north, east } = BBOX;
const bbox = `${south},${west},${north},${east}`;
const query = `
[out:json][timeout:120];
(
  way[highway~"motorway|trunk|primary|secondary|tertiary|residential|unclassified|service|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link"](${bbox});
  way[building](${bbox});
  way[leisure~"park|pitch|stadium|playground|garden|sports_centre"](${bbox});
  way[landuse~"forest|grass|cemetery|recreation_ground|commercial|industrial|residential|construction"](${bbox});
  way[natural~"water|wood|scrub"](${bbox});
  way[amenity~"school|hospital|place_of_worship|university|college|cinema|theatre|library|townhall"](${bbox});
  way[shop~"mall|supermarket"](${bbox});
  way[railway=rail](${bbox});
  node[railway=station](${bbox});
  node[place~"town|suburb|neighbourhood|village|city"](${bbox});
);
out geom tags;
`.trim();

console.log(`Querying Overpass for bbox [${bbox}]…`);
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass returned ${res.status}: ${await res.text()}`);
const raw = await res.json();
console.log(`Received ${raw.elements.length} elements.`);

// ---- Coordinate projection --------------------------------------------
// A simple equirectangular projection centered on ORIGIN is accurate
// enough for a 10 km² area and keeps the math cheap at runtime.
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
function project(lat, lng) {
  return {
    x: +((lng - ORIGIN.lng) * M_PER_DEG_LNG).toFixed(1),
    z: +(-(lat - ORIGIN.lat) * M_PER_DEG_LAT).toFixed(1),   // N→-Z
  };
}

// ---- Classification ---------------------------------------------------
function classifyHighway(tags) {
  const h = tags.highway;
  if (['motorway', 'trunk'].includes(h)) return { type: 'highway', width: 22 };
  if (['primary'].includes(h)) return { type: 'spine', width: 14 };
  if (['secondary'].includes(h)) return { type: 'arterial', width: 12 };
  if (['tertiary'].includes(h)) return { type: 'collector', width: 9 };
  if (['residential', 'unclassified', 'living_street'].includes(h)) return { type: 'street', width: 7 };
  if (h && h.endsWith('_link')) return { type: 'ramp', width: 9 };
  if (['service', 'track'].includes(h)) return { type: 'service', width: 4 };
  return null;
}
function buildingHeight(tags) {
  // Height hints: explicit `height` in meters, or `building:levels`.
  if (tags.height) {
    const m = parseFloat(tags.height);
    if (!isNaN(m)) return m;
  }
  if (tags['building:levels']) {
    const lvl = parseFloat(tags['building:levels']);
    if (!isNaN(lvl)) return lvl * 3.2;
  }
  // Fallbacks by building tag
  const b = tags.building;
  if (['apartments', 'residential'].includes(b)) return 4 * 3.2;
  if (['house', 'detached', 'terrace', 'bungalow'].includes(b)) return 2 * 3.2;
  if (['retail', 'commercial', 'supermarket'].includes(b)) return 8;
  if (['school', 'public', 'civic', 'government', 'hospital', 'cathedral'].includes(b)) return 3 * 3.5;
  if (['industrial', 'warehouse'].includes(b)) return 10;
  if (b === 'church' || b === 'synagogue' || b === 'mosque') return 12;
  return 3 * 3.2;                                           // generic default
}

// ---- Transform --------------------------------------------------------
const streets = [];
const buildings = [];
const areas = [];               // parks, forests, water, etc.
const rails = [];
const points = [];

for (const el of raw.elements) {
  if (el.type === 'way' && el.geometry) {
    const pts = el.geometry.map(p => project(p.lat, p.lon));

    // Highway (road) classification
    if (el.tags?.highway) {
      const cls = classifyHighway(el.tags);
      if (!cls) continue;
      streets.push({
        id: el.id,
        name: el.tags.name || null,
        nameHe: el.tags['name:he'] || null,
        type: cls.type,
        width: cls.width,
        path: pts.map(p => [p.x, p.z]),
      });
      continue;
    }

    // Building
    if (el.tags?.building) {
      buildings.push({
        id: el.id,
        name: el.tags.name || null,
        nameHe: el.tags['name:he'] || null,
        kind: el.tags.building,
        height: buildingHeight(el.tags),
        levels: el.tags['building:levels'] ? +el.tags['building:levels'] : null,
        polygon: pts.map(p => [p.x, p.z]),
      });
      continue;
    }

    // Area (park, forest, water, etc.)
    let areaKind = null;
    if (el.tags?.leisure === 'park' || el.tags?.leisure === 'garden') areaKind = 'park';
    else if (el.tags?.leisure === 'pitch') areaKind = 'pitch';
    else if (el.tags?.leisure === 'playground') areaKind = 'playground';
    else if (el.tags?.leisure === 'stadium') areaKind = 'stadium';
    else if (el.tags?.leisure === 'sports_centre') areaKind = 'sports';
    else if (el.tags?.natural === 'water') areaKind = 'water';
    else if (el.tags?.natural === 'wood') areaKind = 'wood';
    else if (el.tags?.natural === 'scrub') areaKind = 'scrub';
    else if (el.tags?.landuse === 'forest') areaKind = 'wood';
    else if (el.tags?.landuse === 'grass') areaKind = 'grass';
    else if (el.tags?.landuse === 'cemetery') areaKind = 'cemetery';
    else if (el.tags?.landuse === 'recreation_ground') areaKind = 'grass';
    else if (el.tags?.landuse === 'industrial') areaKind = 'industrial';
    else if (el.tags?.amenity === 'school' || el.tags?.amenity === 'university' || el.tags?.amenity === 'college') areaKind = 'school';

    if (areaKind) {
      areas.push({
        id: el.id,
        name: el.tags.name || null,
        nameHe: el.tags['name:he'] || null,
        kind: areaKind,
        tags: el.tags,
        polygon: pts.map(p => [p.x, p.z]),
      });
      continue;
    }

    // Railways
    if (el.tags?.railway === 'rail') {
      rails.push({
        id: el.id,
        path: pts.map(p => [p.x, p.z]),
      });
      continue;
    }
  }

  if (el.type === 'node' && (el.tags?.place || el.tags?.railway === 'station')) {
    const p = project(el.lat, el.lon);
    points.push({
      id: el.id,
      kind: el.tags.railway === 'station' ? 'station' : el.tags.place,
      name: el.tags.name || null,
      nameHe: el.tags['name:he'] || null,
      pos: [p.x, p.z],
    });
  }
}

console.log(`Projected: ${streets.length} streets, ${buildings.length} buildings, ${areas.length} areas, ${rails.length} rails, ${points.length} points.`);

// ---- Save -------------------------------------------------------------
const outPath = join(OUT_DIR, 'osm.json');
writeFileSync(outPath, JSON.stringify({
  meta: {
    source: 'OpenStreetMap via Overpass API',
    attribution: '© OpenStreetMap contributors (ODbL)',
    fetched: new Date().toISOString(),
    bbox: BBOX,
    origin: ORIGIN,
    m_per_deg_lat: M_PER_DEG_LAT,
    m_per_deg_lng: M_PER_DEG_LNG,
  },
  streets,
  buildings,
  areas,
  rails,
  points,
}, null, 0));
console.log(`Wrote ${outPath}`);
