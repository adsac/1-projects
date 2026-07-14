# Modi'in City Walk · מודיעין־מכבים־רעות

A first-person, walkable simulation of **Modi'in-Maccabim-Re'ut** built from
**real map data**: every street, building footprint, park, and hill comes from
the actual city.

**Play it:** https://adsac.github.io/1-projects/modiin-simulator/
Works on phones (left thumb = joystick, right thumb = look, gold button = interact).

## What's real

- **Every street** — 8,700+ road segments with their true geometry and 584 real
  street names (shown as floating signs as you walk): Sderot HaHashmona'im,
  Emek Ayalon, Dam HaMaccabim, Tiltan, the defender streets of HaMeginim…
- **Every mapped building** — 12,038 real footprints extruded to plausible
  heights (real heights/floor counts where mapped), stone-toned like the
  planning code requires, red-roofed in villa Maccabim-Re'ut, solar water
  heaters on the flat roofs.
- **The real topography** — a digital elevation model of the Judean foothills
  (86–338 m), with hillshading baked into the ground and Safdie's wadis and
  ridges underfoot (gentle 1.22× vertical exaggeration so slopes read on screen).
- **The real land cover** — Anava Park's 14-dunam lake traced from the map,
  Ben Shemen forest, orchards, pitches, and the Morasha construction sites.
- **Real neighbors** — Modi'in Illit on its hill to the northeast (a separate
  city, as the plaque will remind you).

## What's a game

The **Torch Relay quest**: eight torches burn at the city's most storied spots —
Umm el-Umdan's 2,200-year-old synagogue, Titora's Crusader summit, the lake,
the underground central station… Each torch lights a candle on a great
hanukkiah on Titora, echoing the real Maccabi relay run from Modi'in toward
Jerusalem every Hanukkah since 1944. Every landmark carries a researched
plaque with a quiz; ambient facts surface as you wander; neighborhoods
announce themselves with their street-naming themes. Day/night cycle included —
the windows come on across the wadis.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | walk (`Shift` runs — the city is real-scale) |
| Mouse (click to capture) | look around |
| `E` / `Enter` | read plaques, light torches |
| `M` | city map · `N` day/night · `H` help |
| Touch | left joystick (push far = run), right drag = look, gold button = interact |

## Tech

Plain ES modules + [Three.js](https://threejs.org/) (vendored, no build step).
The city loads from ~2.8 MB of baked binary data in `data/`:

| file | contents |
| --- | --- |
| `roads.bin` | 8,722 polylines, class + name-table index, int16 half-metres |
| `bld.bin` | 12,038 footprints with heights and villa flags |
| `areas.bin` | water / parks / forest / pitches / construction polygons |
| `dem.bin` | 400×340 elevation grid (real DEM) |
| `ground.jpg` | 4096² aerial-style albedo: land cover + roads + hillshade |
| `names.json` | 584 real street names (Hebrew) |

Pipeline in `tools/` (Python): `extract.py` pulls bbox-filtered
[Overture Maps](https://overturemaps.org/) GeoParquet (OSM-derived, ODbL)
straight from S3; `fetch_dem.py` decodes AWS Open Data
[Terrain Tiles](https://registry.opendata.aws/terrain-tiles/); `bake.py` +
`shade.py` produce the binaries and the shaded ground texture.

Run locally: `python3 -m http.server` in this folder.

## Data credits

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, via [Overture Maps Foundation](https://overturemaps.org/) (ODbL).
Elevation: Terrain Tiles on AWS Open Data (Mapzen terrarium; SRTM et al.).
History content researched from municipality, IAA and press sources — see the
in-game plaques.
