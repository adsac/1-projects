# Content authoring — MSA Reader

This is the spec for everything in `content/`. Read this before adding a dictionary entry, a graded article, or a pattern card.

## Files

| File | What | Used by |
|---|---|---|
| `dictionary.json` | Headword + gloss + root + form + Hebrew cognate | Reader popup, Review SRS |
| `graded.json` | Hand-authored short articles for first reads | Library, Reader |
| `patterns.json` | Roots and their derivations across binyans | Patterns drill |

All three are JSON with a single top-level `items` array.

## Transliteration / orthography conventions

- **Headwords are unvocalised.** That's the lookup key — it's what newspapers print and what the tokenizer hands the dictionary. Don't include ḥarakāt, tatweel, or hamza wasl: write `أعلن` not `أَعْلَنَ` in the `headword` field.
- **Vocalised forms** (the `vocalized` field) carry the full diacritics, including shadda and fatḥa-on-final-radical: `أَعْلَنَ`. They're shown in the popup and on the Review reveal.
- **Hamza** is written as the newspaper writes it: `أ` (above), `إ` (below), `ا` (bare), `ء` (standalone), `ئ` / `ؤ`. No "normalise to bare alif".
- **Tāʾ marbūṭa** as `ة` (not `ت`) on the bare singular; the tokenizer handles the `-t-` form in iḍāfa.
- **Long vowels** as `ا`, `و`, `ي`. Diacritics aren't required in headwords; let them appear in `vocalized` only.

## `dictionary.json` — entry shape

```json
{
  "headword":    "اجتماع",
  "vocalized":   "اجْتِماع",
  "gloss":       "meeting",
  "root":        "j-m-ʿ",
  "form":        "Form VIII masdar",
  "hebrew":      "",
  "status":      "draft"
}
```

| field | required | notes |
|---|---|---|
| `headword` | ✓ | Unvocalised. The lookup key. |
| `vocalized` | ✓ | With ḥarakāt. Shown in popup + on Review reveal. |
| `gloss` | ✓ | English. Short. Comma-separated senses if a word has more than one. |
| `root` |   | Three-letter (or four) hyphenated form: `k-t-b`, `ʿ-l-m`, `ʾ-m-r`. Use `ʿ` for ʿayn, `ʾ` for hamza. Skip for particles / proper nouns / loanwords without a clear Semitic root. |
| `form` |   | The morphological label. Conventions: `Form I verb`, `Form II masdar`, `Form IV active participle`, `Form X verb`, `Form I noun`, `noun of place`, `Form I nisba`, `plural`, `dual`, `particle`, `preposition`, `quantifier`, `pronoun`, `demonstrative`, `relative`, `proper noun`. |
| `hebrew` |   | Hebrew cognate, when there's a clear one. Format: Hebrew script + transliteration in parens: `"בית (bayit)"`. Empty string when there isn't a clean cognate — be honest, don't force it. |
| `status` |   | `"draft"` (default) or `"verified"`. User-added entries from the popup default to `"verified"` since they're trusted personal vocab. |

### Hebrew cognate conventions

- **Strong cognate (same root)**: `"כתב (katav, write)"` for `كتب`. Include the meaning in the parens since the Hebrew sense often differs from the Arabic.
- **Sound-only / semantic cognate**: still useful to a Hebrew speaker. `"חכמה (chochma, wisdom — same root, different semantic)"` for `حكومة`.
- **Skip** when the cognate is forced (different roots that just look similar). Leave the field empty rather than making something up.

### Broken plurals

Each broken plural is its own entry — the morphology is unpredictable, no programmatic derivation. Cross-reference in the gloss:
```json
{ "headword": "وزراء", "vocalized": "وُزَراء", "gloss": "ministers (broken pl of wazīr)", "root": "w-z-r", "form": "plural", "status": "draft" }
```

## `graded.json` — article shape

```json
{
  "id":          "01-meeting",
  "title":       "اجتماع جديد",
  "level":       1,
  "sourceLabel": "Graded · level 1",
  "paragraphs":  ["…", "…", "…"],
  "tags":        ["politics", "graded"]
}
```

- **Original prose only** — never transcribe a real article. Write in the register of al-Jazeera / BBC Arabic / al-Hayat (formal wire-service).
- **Coverage check** before merging: every token should resolve through `parser.js → lookup()` against the current dictionary. Run a smoke test:
  ```bash
  node --input-type=module -e "
    import { lookup } from './msa-reader/src/parser.js';
    import { readFileSync } from 'node:fs';
    const dict = JSON.parse(readFileSync('./msa-reader/content/dictionary.json','utf8')).items;
    const graded = JSON.parse(readFileSync('./msa-reader/content/graded.json','utf8')).items;
    const map = new Map(dict.map(e => [e.headword, e]));
    for (const art of graded) {
      const t = art.paragraphs.join(' ').split(/\s+/).map(x => x.replace(/[.,،؟!]/g,'')).filter(Boolean);
      const misses = t.filter(x => !lookup(x, map));
      console.log(art.id, '·', t.length, 'tokens ·', Math.round((t.length-misses.length)/t.length*100)+'%', misses.length ? '· misses: '+misses.join(' ') : '');
    }
  "
  ```
  Add the misses to `dictionary.json` or rephrase the article. 100% is the goal for the first few graded levels; later levels can tolerate misses (the user will save those as personal vocab).

- **Ascending difficulty**: simpler vocabulary, fewer embedded clauses, present-only earlier; passive voice, broken plurals, journalese stock phrases later.

## `patterns.json` — root shape

```json
{
  "root":         "k-t-b",
  "rootMeaning":  "writing",
  "hebrew":       "כתב (k-t-v, write)",
  "derivations": [
    {
      "form":        "Form I masdar",
      "vocalized":   "كِتابة",
      "unvocalized": "كتابة",
      "gloss":       "writing",
      "pattern":     "fiʿāla"
    }
  ]
}
```

- **`form`**: human-readable label shown on the drill card. Same vocabulary as the dictionary `form` field.
- **`pattern`**: the abstract template (`faʿala`, `mafʿūl`, `tafʿīl`, `iftiʿāl`, …). This is the *transferable* lever — once you know the pattern, you can decode new words with the same shape.
- **`unvocalized`** is the drill prompt; **`vocalized`** is shown on reveal. Same convention as the dictionary.
- 5-9 derivations per root. Pick the ones a newspaper reader would meet: verbs (I + a useful derived stem or two), masdar, active/passive participles, common derived nouns (place noun, instance noun, profession).

## SW cache versioning

Bump `CACHE_VERSION` in `sw.js` whenever any content file changes — otherwise users on the already-installed PWA won't see the new content (the SW serves cached content first when offline, but the in-app "Update available" toast only fires on SW byte-difference). One bump per PR is enough.

## Workflow

Per the repo-root `CLAUDE.md`: per-feature branch, PR via API, no waiting for approval. Validate locally (`node -e "JSON.parse(...)"` for the content files; serve with `python3 -m http.server` from `msa-reader/` for the page). Flag risk in the PR description for anything bigger than a content addition.
