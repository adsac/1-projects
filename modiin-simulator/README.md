# Modi'in City Simulator — מדמה העיר מודיעין

A 3D in-browser simulator where you drive around the Israeli city of
**Modi'in-Maccabim-Re'ut**. The layout is inspired by Moshe Safdie's
real concentric-ring master plan — cream-limestone apartment blocks,
radial boulevards, a central mall, Anabe Park with its lake, the
train station, and the Judean foothills wrapping the city.

Built with [Three.js](https://threejs.org/). No build step, no npm — open in
any modern browser.

## Controls

| Key                  | Action                       |
| -------------------- | ---------------------------- |
| `W` / `↑`            | Accelerate                   |
| `S` / `↓`            | Reverse / brake              |
| `A` `D` / `←` `→`    | Steer                        |
| `Space`              | Handbrake                    |
| `C`                  | Cycle camera (chase / cockpit / top-down / hood / aerial) |
| `V`                  | Toggle aerial bird's-eye view |
| `H`                  | Horn                         |
| `N`                  | Toggle permanent night       |
| `P`                  | Pause day/night cycle        |
| `M`                  | Toggle minimap               |
| `R`                  | Respawn at Azrieli Mall      |

## Features

- **Realistic layout** — five concentric ring roads named after real
  Modi'in arterials (Dam HaMaccabim, Emek Zevulun, Menachem Begin, Yitzhak
  Rabin, Kvish HaArava) and twelve radial avenues.
- **Named neighborhoods** — Buchman, Kaiser, Moriah, Prachim, Nofim,
  Shvatim, Avnei Hen, Givat C, The Heart — all shown as you drive.
- **Landmarks with floating labels** — Azrieli Mall, City Hall, Anabe
  Park, Modi'in Central railway station, ISCAR industrial park,
  Country Club, Maccabim Stadium, Titura Hill, Ben Shemen Forest.
- **Procedural apartments** with randomized window lighting, warm
  limestone palette (the city's signature), pitched tile roofs, and
  rooftop water tanks.
- **Terrain** — rolling Judean foothills outside the city, flat in the
  center, with a gentle depression for Anabe lake.
- **Day / night cycle** — a full day passes every five minutes, with
  sunrise, dusk, and lit street lamps & headlights at night.
- **Live HUD** — speedometer, gear indicator, compass, rotating
  minimap with traffic dots, clock, neighborhood/street display, and
  landmark proximity notifications.
- **NPC traffic** — cars loop around the ring roads.
- **Engine + horn audio** — procedural WebAudio with engine pitch
  scaling to speed.

## Running it

Because the simulator uses ES modules with an import map, you need to
serve it over HTTP (most browsers refuse `file://` module loads).

From the `modiin-simulator/` directory, pick your favorite one-line
server:

```bash
# Python 3
python3 -m http.server 8080

# Node (if you have it)
npx http-server -p 8080

# PHP
php -S localhost:8080
```

Then open <http://localhost:8080>.

## Real-world map data (OpenStreetMap)

The simulator can render the *actual* street grid and building
footprints of Modi'in by pulling them from OpenStreetMap via the
Overpass API. Run once (requires Node 18+ for the global `fetch`):

```bash
node tools/fetch-osm.mjs
```

This writes `data/osm.json` (~2–5 MB) with projected local-meters
coordinates. The simulator auto-detects the file on next reload and
switches to OSM-sourced streets, buildings, parks, water and rail.
Without the file it falls back to the hand-placed procedural layout.

The fetcher also respects OSM's usage policy — don't re-run it on
every load.

## Project layout

```
modiin-simulator/
  index.html        # entry page + HUD markup
  styles.css        # HUD styling
  README.md         # this file
  src/
    config.js       # constants, landmark & neighborhood data
    city.js         # terrain, roads, buildings, landmarks, trees
    player.js       # car model, physics, chase camera, input
    hud.js          # minimap, compass, notifications
    main.js         # scene setup, loop, day/night, traffic, audio
```

## Notes & caveats

### On fidelity

This is a hand-modeled interpretation, not a GIS-sourced reconstruction.
Positions are placed from memory of the real city and aim for
*relative* correctness rather than metric accuracy.

**Landmarks modeled** — all of these exist in the real Modi'in, but
their coordinates, footprints and heights are approximations:

- **Azrieli Mall Modi'in** & **Modi'in Central Station** — the city's
  NW corner, under Route 443 near the Ayalon Valley exit.
- **City Hall** (Iriyat Modi'in-Maccabim-Re'ut).
- **Titura Hill** — archaeological mound just north of the spine.
- **Anabe Park** — lake, amphitheater, boardwalks in the east.
- **Ben Shemen Forest** — NW exterior.

**Separate places nearby (NOT part of Modi'in):**

- **Hashmonaim** — religious community north of the city.
- **Lapid** — moshav on the northern ridge.
- **Modi'in Illit** — separate Ultra-Orthodox city on the eastern
  ridge; shares "Modi'in" in its name but is a distinct municipality.

**Neighborhoods modeled** — all part of the Modi'in-Maccabim-Re'ut
municipality; AABBs approximate: Maccabim, Re'ut (both merged into
Modi'in in 2003), The Heart (HaLev), Kaiser, Buchman, Prachim,
Avnei Chen, Shvatim, Nofim, Givat C, HaKramim, Moriah.

**Street names known to be real in Modi'in:** Sderot Dam HaMaccabim,
Sderot Menachem Begin, Sderot Yitzhak Rabin, Emek Dotan, Emek Zevulun,
Emek HaElah. Other `Emek ...` and `Derech ...` names in the config are
plausible-sounding but weren't verified — treat them as placeholders.

Do not rely on this map to navigate the real city.

### Environment

- Tested on recent Chrome, Firefox, and Safari. Requires WebGL2 and
  top-level `await` in modules.
- Performance knobs: reduce `TERRAIN_SEGMENTS`, `TRAFFIC_COUNT`, or
  building density in `src/config.js` / `src/city.js` on lower-end
  hardware.
