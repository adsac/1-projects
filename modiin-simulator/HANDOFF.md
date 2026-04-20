# Modi'in Simulator — Handoff Notes

Last worked on: **2026-04-20**. Originally developed on branch
`claude/modiin-city-simulator-ImpLp`, merged to `main`.

## Current status

Working, but **unresolved user-reported problem**:
> "it just doesn't look like anything. no road even"

The problem could be (a) procedural-only mode because the OSM
fetcher was never run, (b) z-fighting between terrain and road
ribbons, (c) camera spawning underground, (d) empty/tiny
`data/osm.json`, or (e) performance timeout before the scene
renders. **Not yet diagnosed** — I couldn't run the simulator from
my sandbox to verify.

The immediate next step is to get browser console output + a
screenshot (or a live env) and diagnose from there.

## File layout

```
modiin-simulator/
  index.html              # HUD markup
  styles.css              # HUD styling
  README.md               # user docs + fidelity note
  src/
    config.js             # constants, streets, neighborhoods, landmarks
    city.js               # procedural terrain, roads, buildings, props
    osm.js                # OSM loader + renderer (streets, buildings, areas, rails)
    player.js             # car model, arcade physics, chase/aerial cameras
    hud.js                # HUD + minimap
    main.js               # scene setup, main loop, traffic, audio, day/night
  tools/
    fetch-osm.mjs         # Overpass API fetcher → data/osm.json
  data/
    osm.json              # (gitignored by convention; user runs fetcher)
```

## How the two rendering modes work

On boot `main.js` calls `loadOSM('data/osm.json')`:

- **OSM present** → `buildOSMAreas` / `buildOSMStreets` / `buildOSMRails`
  / `buildOSMBuildings` draw the real geometry; `buildLandmarks` runs in
  `labelsOnly` mode and snaps label positions to matching OSM features
  by name. `buildProps` runs with `skipStreetProps: true`.
- **OSM missing** → `buildRoads` / `buildBuildings` / full `buildLandmarks`
  / `buildProps` — the hand-placed procedural city.

Traffic drives along whichever street collection was used. Spawn
tries to snap to any road whose name matches "Maccabim" (Dam
HaMaccabim).

## Run

```bash
cd modiin-simulator
node tools/fetch-osm.mjs     # optional but strongly recommended
python3 -m http.server 8080
```

Open <http://localhost:8080>. Needs Node 18+ for the fetcher
(uses global `fetch`). Sandbox environments may block Overpass
(`403 Host not in allowlist`) — run the fetcher from a normal
network.

## Controls

| Key              | Action |
| ---------------- | ------ |
| `W`/`↑`, `S`/`↓` | accel / brake |
| `A`/`←`, `D`/`→` | steer |
| `Space`          | handbrake |
| `C`              | cycle camera (chase / cockpit / top-down / hood / aerial) |
| `V`              | toggle aerial view |
| `H`              | horn |
| `N`              | toggle permanent night |
| `P`              | pause day/night cycle |
| `M`              | toggle minimap |
| `R`              | respawn |

## Known issues / pick-up points

1. **"Doesn't look like anything" (blocker)** — diagnose first.
   Ask the user for:
   - F12 → Console output (look for `[osm] loaded N streets, M buildings, K areas` or `[osm] no OSM data`)
   - Any red errors
   - A screenshot of the canvas
   - What the aerial view (**V**) shows — if that also shows nothing it's a data problem, not a camera problem
2. **Performance** — already tuned aggressively (shared materials,
   reduced counts, smaller terrain, 1024 shadow map). Further wins
   available: `InstancedMesh` for trees, `MeshBasicMaterial` for
   distant OSM buildings, more aggressive frustum culling, LOD swap.
3. **Fidelity** — without OSM data the city is an artistic
   interpretation. User confirmed several hand-placed landmarks
   were fabricated; those have been removed. The only hand-placed
   landmarks still in `config.js` are ones I'm confident are real.
4. **Landmark→OSM name matching** — `findByName` is substring-based
   on `name` + `name:he`. If OSM doesn't tag "Azrieli" / "עזריאלי"
   on the mall, the label won't snap. Fall back is to the config
   coordinates, which may or may not line up with OSM features.
5. **Coordinate origin** — `tools/fetch-osm.mjs` projects from
   `ORIGIN = { lat: 31.8950, lng: 35.0100 }`. If that's ever moved,
   the hand-placed `config.js` landmarks in meters will no longer
   line up with OSM data. Keep them in sync.

## Debugging checklist

```bash
# OSM data sanity
node tools/fetch-osm.mjs
ls -lh data/osm.json                     # should be > 500 KB for Modi'in
jq '{streets: (.streets|length), buildings: (.buildings|length), areas: (.areas|length)}' data/osm.json

# Browser
# - F12 console should show [osm] loaded … or [osm] no OSM data …
# - No red errors
# - Press V immediately after load: aerial should show *something*
```

## Suggested next work (priority order)

1. **Fix the "looks like nothing" rendering bug.** Likely either
   terrain z-fighting, OSM data empty, or performance timeout.
2. **Tile-based satellite overlay** — a huge visual-fidelity win.
   Fetch a few zoom-15 tiles from an OSM-compatible tile server
   (with attribution) and use them as the terrain diffuse texture,
   instead of the current procedural vertex colors. Dramatic.
3. **Better building heights** — OSM `building:levels` is sparse in
   Modi'in; consider using neighborhood-based defaults (Moriah tends
   to be taller, Reut shorter, Heart has towers, etc.).
4. **Labeled street signs** at major intersections — small blue
   plaques with Hebrew + English names.
5. **Free-fly camera** (unbound from the car), useful for
   navigation in aerial mode.
6. **Preserve the current tour system** — `TOUR_TARGETS` in main.js
   filters landmarks by type; confirm it behaves sensibly in
   OSM-mode too (the landmarks still exist but as labels-only).

## Commit history on this branch

```
bd3695c Load real Modi'in geometry from OpenStreetMap + add aerial view
da7f610 Major perf pass: cut draw calls and share materials
1349b46 Fix ReferenceError: roofH no longer in scope at water-tank placement
b3088a1 Move Maccabim and Re'ut into the city; Lapid & Modi'in Illit stay external
9dc52cd Remove fabricated landmarks
9242178 Make Modi'in simulator more faithful to the real city
e3db47a Polish: tour mission, stars, mountains, water, bus stops
3512aff Rebuild around real geography
897ce8b Initial scaffolding
```
