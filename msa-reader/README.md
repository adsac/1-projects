# MSA Reader

A personal, Android-first reader for newspaper Arabic (Modern Standard Arabic / fuṣḥā). Intermediate-recognition — built for a Hebrew-speaking adult learner with rusty classical, aiming to read real wire-service articles without vocalisation.

Sister project to [`arabic-tutor`](../arabic-tutor/) (Levantine spoken Arabic). Same repo, same stack, separate app — different SRS, different content, recognition-only, **reader-centered** instead of flashcard-centered.

## Approach

- **Recognition-only**. No production direction.
- Text shown **unvocalised by default**; tap any word for a popup with vocalised form + gloss + root + form pattern + Hebrew cognate.
- **Long-press** a word to add it to the spaced-repetition queue. Reviews drill the unvocalised form → reveal vocalised + meaning, mirroring how you'll read.
- Built-in dictionary of **200 high-frequency newspaper words** ships with the app; lookup misses can be saved as personal entries that grow your on-device dictionary.
- Hand-authored **graded articles** (politics, regional, economy, law, diplomacy — ascending difficulty) for first reads, plus **paste-in** for any text from real outlets.
- A separate **Patterns** module drills root + form recognition (k-t-b × Forms I-X) to reactivate rusty morphological intuition.

## Stack

Zero-build static PWA. Plain HTML, CSS, ES modules. No npm, no bundler, no framework. Hosted on GitHub Pages from `main`. Modern Android Chrome runs everything natively (ES modules, IndexedDB, service worker, Web App Manifest).

## Install on Android

1. Open `https://adsac.github.io/1-projects/msa-reader/` in Android Chrome.
2. Chrome menu → **Add to Home screen**. Launch from the icon.
3. After first load the service worker caches everything; works offline thereafter.

## Use

The home screen has four tiles:

- **Read** — opens the sample article. Tap any word for a gloss; long-press to add it to review. Words you've reviewed turn green; words not in the dictionary go red.
- **Library** — graded pieces (5 to start) + your paste-in collection. "＋ Paste an article" lets you bring in real news from any outlet.
- **Review** — spaced repetition over words you've saved. Same SM-2 ladder as the tutor; honest interval previews on the grade buttons; one-step Undo; Skip and Suspend.
- **Patterns** — 8 high-frequency roots (k-t-b, q-r-ʾ, ʿ-l-m, ḥ-k-m, ʿ-m-l, ḥ-d-th, k-w-n, j-m-ʿ) and their derivations across binyans. Reveal-only drill, by root or 10 random.

**Settings** has font-size controls, the Hebrew-cognate toggle (default on), the familiarity-colour toggle, suspended-list, and export / import of progress as JSON.

## Repo layout

```
msa-reader/
  index.html              app shell
  manifest.webmanifest    PWA manifest
  sw.js                   service worker (offline cache)
  icon.svg                ق letterform + underline
  styles.css              tokens + components, RTL Arabic blocks
  fonts/                  self-hosted Noto Naskh Arabic woff2
  src/
    main.js               bootstrap + SW registration
    data.js               IndexedDB schema + content loader + export/import
    scheduler.js          SM-2 lite (pure functions)
    parser.js             light morphological tokenizer for dict lookup
    views.js              all screens
    router.js             hash router
    util.js               DOM + time helpers
  content/
    AUTHORING.md          spec for dictionary / graded / patterns entries
    dictionary.json       headword + gloss + root + form + Hebrew cognate
    graded.json           hand-authored short articles
    patterns.json         roots and their derivations across binyans
```

## Data shape

JSDoc typedefs at the top of `src/data.js`. Everything in `content/` follows the spec in [`content/AUTHORING.md`](./content/AUTHORING.md).

Storage in IndexedDB:

- `reviewState` — SM-2 state per item (headword as key)
- `userVocab` — entries you added via the "Not in the dictionary yet" popup
- `savedArticles` — paste-ins
- `settings` — UI prefs + suspended list
- `sessions` — review-session log (not yet surfaced in UI)

Export → JSON snapshot of all the above. Import replaces wholesale (after confirm).

## Hebrew cognates

On by default — for a Hebrew speaker, knowing that `بيت ↔ בית` and `كتب ↔ כתב` is a real reading-fluency lever. ~70 of the 200 dictionary entries carry a cognate; pattern roots carry one when there's a clean shared root. Toggle off in Settings if you'd rather drill the Arabic in isolation.

## What's intentionally **not** here (v0)

- No audio.
- No production / writing practice (this is a reader; the tutor handles speaking).
- No real morphological analyser (the light tokenizer covers ~85% of newspaper surface forms; missed words go via the personal-vocab path).
- No online fetching (CORS hell from a static PWA — paste-in is the workflow).

## Workflow

Per the repo-root [`CLAUDE.md`](../CLAUDE.md): `main` is both deployable and test environment. Per-feature branches → PR → API merge. Local validation (JSON parse + `python3 -m http.server`) before opening the PR.
