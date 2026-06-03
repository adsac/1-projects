# Arabic Tutor

A personal, Android-first practice app for spoken Palestinian / Levantine Arabic. Sentence engines + phrase cards, lightweight spaced repetition, fully offline once installed.

This is a personal tool, not a product. It is shaped specifically around an English-speaking adult learner (Hebrew background) living in the Modi'in / Jerusalem area, practicing in 3–15 minute slices.

## Stack

Zero-build static PWA. Plain HTML, CSS, ES modules. No npm, no bundler, no framework. Hosted on GitHub Pages from this repo. Modern Android Chrome runs everything natively (ES modules, IndexedDB, service worker, MediaRecorder, Web App Manifest).

## Install on Android

1. Enable GitHub Pages once: **Settings → Pages → Source: Deploy from a branch → Branch: `main` → Folder: `/ (root)` → Save**.
2. Wait ~1 minute. Open `https://adsac.github.io/1-projects/arabic-tutor/` in Android Chrome.
3. Chrome menu → **Add to Home screen**. Launch from the icon.
4. Once it has loaded, the service worker caches everything — works offline from then on.

## Use

The home screen shows status (due / weak / new) and four time tiles: **3 / 7 / 10 / 15 min**. Tap one and start. Cards prompt in English, you say the Arabic out loud, tap **Reveal**, then self-grade **Again / Hard / Good / Easy** (SM-2 lite).

Other entry points:
- **Situations** — practice scoped to drivers, shops, kids, family, work, rescue, doctor, directions, neighbours, geography, politics, basics.
- **Engines** — pattern drills (e.g. *I want X*, *I have X*, present-tense verbs, imperative, colours, numbers).
- **Add phrase** — capture something you needed today; if you don't have the Arabic yet, it goes to **Needs Arabic** and waits until you fill it in.
- **Rescue** — quick reference for "say it slower", "I didn't understand", etc.
- **Progress** — what you can say now, what's weak.
- **Settings** — transliteration on/off, Arabic + UI font sizes, new-item speed (`none`/`slow`/`normal`/`fast`), mix in recognition cards, reorder scenario priorities, view and unsuspend phrases, reset progress.

Every card has **Skip** (just this round) and **Suspend** (never again until I bring it back via Settings → Suspended phrases). Items graded **Hard** also get one extra pass later in the same session for consolidation. When many of your due items are weak the planner trims the new-item budget automatically — fewer new phrases pile on top of what's already struggling.

Every card supports self-recording via your phone mic for replay-and-compare. There's no automatic pronunciation scoring — you grade yourself.

## Repo layout

```
arabic-tutor/
  index.html              app shell
  manifest.webmanifest    PWA manifest
  sw.js                   service worker (offline cache)
  icon.svg                app icon
  styles.css              tokens + components, RTL Arabic blocks
  fonts/                  self-hosted Noto Naskh Arabic woff2
  src/
    main.js               bootstrap
    data.js               schema (JSDoc), IndexedDB, content loader
    scheduler.js          SM-2 lite — pure functions
    planner.js            session planner — pure functions
    practice.js           card / engine / new-intro controllers
    views.js              all screens
    router.js             tiny hash router
    recorder.js           MediaRecorder wrapper (record + replay)
    util.js               DOM, time, RNG helpers
  content/
    transliteration.md    content authoring spec (transliteration + note conventions) — read first
    engines.json          sentence engines
    phrases.json          phrase cards
    scenarios.json        situational groupings
```

## Data shape

JSDoc typedefs live at the top of `src/data.js`. Engines drill across person, gender, tense, negation, imperative, and question forms. Phrases carry English / Arabic / transliteration plus optional `pronunciationNote` and `fushaNote` (the latter is a short MSA contrast — useful for items where the dialect diverges sharply, e.g. `hallaʾ` ← MSA `al-ʾān`, `biddi` ← `bi-wadd-` / `urīd`).

Every seed item starts with `"status": "draft"` until verified.

## Editing content from the phone

The `content/*.json` files are the only thing you need to touch to add or fix vocabulary. The transliteration scheme and the editorial conventions (literal meanings, verb–noun pairing, word-by-word breakdowns, fuṣḥā notes, gender variants) are documented in `content/transliteration.md` — read that first. You can edit the JSON files directly via the GitHub mobile site or `github.dev`. Commit, wait for Pages to redeploy (~1 min), reopen the app — the service worker fetches new content network-first (and falls back to cache when offline), so changes show up on the next load.

## Update flow

Bump `CACHE_VERSION` in `sw.js` on any user-visible change — shell *or* content. The "update available — reload" toast only fires when the SW file itself differs from the installed copy, so a content-only push without a version bump won't be signalled.

## What's intentionally **not** here (v0)

- No model audio playback. The data model leaves room (an optional `audioPath` per item) for static `.opus`/`.m4a`/`.mp3` later — GitHub Pages serves these fine, no Git LFS.
- No automatic pronunciation scoring.
- No AI translation in "Add phrase" — manual entry only.
- No accounts / cloud sync. Everything lives in the device's IndexedDB.

## Workflow

`main` is both the deployable and the test environment — Pages serves from it directly, and there's no separate staging. Iteration happens on short-lived per-feature branches (`claude/<feature-name>`) opened as PRs against `main` and merged via `mcp__github__merge_pull_request`. Local validation (`node -e "JSON.parse(...)"` for content, `python3 -m http.server` for the page) runs before opening the PR. See `/CLAUDE.md` at the repo root for the full branch rules.
