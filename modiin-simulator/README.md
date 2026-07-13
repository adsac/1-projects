# Modi'in City Walk · מודיעין־מכבים־רעות

A first-person, walkable miniature of **Modi'in-Maccabim-Re'ut** — the planned city
in the Judean foothills where the Hanukkah story began. Built from scratch with
research into the real city's geography, history, and daily life.

**Play it:** https://adsac.github.io/1-projects/modiin-simulator/

## What's in the city

- **Moshe Safdie's plan, in miniature** — boulevards running through green valleys,
  stone-clad terraced housing on the hillsides, and the roundabouts every resident
  jokes about.
- **Recognizable landmarks**, hand-modelled: Modi'in Merkaz underground railway
  station and the Azrieli mall beside it, City Hall, the cultural hall, Anava Park
  with its boating lake and amphitheatre, Titora Hill's Crusader ruins, and the
  2,200-year-old synagogue at Umm el-Umdan.
- **The Torch Relay quest** — find eight torches at the city's most storied spots;
  each lights a candle on the great hanukkiah, echoing the real Maccabi torch relay
  run from Modi'in toward Jerusalem every Hanukkah since 1944.
- **Educational plaques & quizzes** at every landmark, ambient "did you know" facts,
  neighborhood name banners as you cross the city, day/night cycle (watch the
  windows and streetlights come on), full city map, and a rotating minimap.
- Solar water heaters on every roof, cypress/olive/pine hillsides, palm-lined
  boulevards — the small stuff that makes it feel like home.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | walk (`Shift` to run) |
| Mouse (click to capture) | look around |
| `E` / `Enter` | read plaques, light torches |
| `M` | city map |
| `N` | day / night |
| `H` | help |
| Touch | left thumb joystick, right thumb look, gold button interact |

## Tech

Plain ES modules + [Three.js](https://threejs.org/) (vendored in `vendor/`,
no build step, no external requests). The whole city is generated procedurally
at load time from a hand-crafted geographic data file
(`src/data/city-data.js`) whose layout follows the real city: real neighborhood
names and positions, real street-naming themes, landmarks in the right places
relative to each other.

Run locally: `python3 -m http.server` in this folder, open `http://localhost:8000`.

## Accuracy notes

The map is a stylized miniature, not survey data — distances are compressed and
the street network is simplified to the main boulevards. History content was
researched from the sources listed in the in-game plaques (municipality,
IAA excavation reports, press). Corrections from people who know the city
are welcome.
