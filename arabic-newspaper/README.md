# MSA Reader

A personal, Android-first reader for newspaper Arabic (Modern Standard Arabic / fuṣḥā). Built for an intermediate learner with rusty classical and Hebrew background; the goal is to read real wire-service articles without vocalisation.

This is a sister project to [`arabic-tutor`](../arabic-tutor/) (Levantine spoken Arabic), in the same repo but architecturally separate — different content, different SRS, different interaction model. The tutor is flashcard-centered; this one is **reader-centered**.

## Approach

- Recognition-only. No production drilling.
- Text is shown unvocalised by default; tap any word for a popup showing the vocalised form, gloss, root, form-pattern, and (when applicable) Hebrew cognate.
- A built-in dictionary of the top ~1500 newspaper words ships with the app. Lookup misses degrade to a "search by root" UI; words can be added by hand and grow the on-device dictionary.
- Long-press a word to add it to the spaced-repetition queue. Reviews are unvocalised-prompt → vocalised+gloss reveal — same direction as actual reading.
- Hand-annotated graded articles (politics, regional, wider Arab world, general interest) are pre-loaded for the first reads; paste-in mode handles arbitrary text.
- A separate **Patterns** module drills root + form recognition (k-t-b × Forms I-X) to reactivate rusty morphological intuition.

## Stack

Zero-build static PWA. Plain HTML, CSS, ES modules. No npm, no bundler, no framework. Hosted on GitHub Pages from `main`. Modern Android Chrome runs everything natively (ES modules, IndexedDB, service worker, Web App Manifest).

## Install on Android

1. Open `https://adsac.github.io/1-projects/arabic-newspaper/` in Android Chrome.
2. Chrome menu → **Add to Home screen**. Launch from the icon.
3. After first load the service worker caches everything; works offline thereafter.

## Repo layout

```
arabic-newspaper/
  index.html              app shell
  manifest.webmanifest    PWA manifest
  sw.js                   service worker (offline cache)
  icon.svg                ق letterform + underline
  styles.css              tokens + components, RTL Arabic blocks
  fonts/                  self-hosted Noto Naskh Arabic woff2
  src/
    main.js               bootstrap
    data.js               IndexedDB + schema (JSDoc) + content loader
    views.js              all screens
    router.js             hash router
    util.js               DOM + time helpers
  content/
    (PR 2+) dictionary.json
    (PR 4+) graded/*.json
    (PR 5+) patterns.json
```

## Build plan (this is PR 1 of 6)

| | shipped in | what |
|---|---|---|
| 1 | this PR | Scaffold: PWA basics, routes, hello-world Reader with a 2-paragraph sample. |
| 2 | next | Bundled dictionary (~1500 words), light tokenizer, tap-to-gloss popup. |
| 3 | | Recognition-only SRS + Review screen. Long-press to add words. |
| 4 | | Library: graded articles + paste-in. |
| 5 | | Patterns drill (root + form recognition, ~20 roots). |
| 6 | | Settings polish, export / import, content-authoring spec doc. |

## Workflow

Same as the tutor: `main` is both deployable and test environment (Pages serves from it). Per-feature branches → PR → API merge. See `/CLAUDE.md` at repo root for branch rules.
