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
| `C`                  | Cycle camera (chase / cockpit / top-down / hood) |
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

- Landmark footprints and coordinates are **approximate** —
  the goal was a recognizable, playful Modi'in, not a GIS-accurate map.
- Tested on recent Chrome, Firefox, and Safari. Requires WebGL2 and
  top-level `await` in modules.
- Performance knobs: reduce `TERRAIN_SEGMENTS`, `TRAFFIC_COUNT`,
  building density in `src/config.js` / `src/city.js` if you're on
  lower-end hardware.
