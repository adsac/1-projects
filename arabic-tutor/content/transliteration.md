# Content authoring spec — Levantine Arabic phrases & engines

This is the contract for every entry added to `phrases.json` and
`engines.json`. Read this before adding new content. The spec covers:

1. The required and optional fields on a card.
2. The transliteration scheme (the largest section — sound-by-sound rules).
3. When to write an explanatory note, which field to put it in, and what kind of note.
4. Tone, length, and the draft/verified workflow.

The underlying goal: a learner who knows nothing about Arabic should be
able to read the transliteration aloud and produce something close to
what a native Palestinian speaker would say, and the explanatory notes
should give them genuine memory hooks rather than padding.

We transcribe what is **spoken** in everyday Jerusalem / urban
Palestinian dialect, not the underlying MSA spelling.

---

## 1. Schema

### Required fields (every item)

- `id` — unique slug. Use kebab-case scoped by area: `rescue-help-me`, `family-married`, `pol-extremist`, `talk-agree`. The `talk-` prefix is for general-purpose conversational moves usable across scenarios.
- `arabic` — the Arabic script. Use vowel diacritics (shadda, fatḥa, etc.) only when they're load-bearing for distinguishing the form; don't fully vocalise like MSA textbooks.
- `transliteration` — Latin transcription per Section 2 below.
- `english` — the natural English equivalent (not the literal — the literal goes in `context`).

### Optional fields

- `context` — where most editorial notes live. Cultural/social cues ("Said as part of farewell"), gender variants ("To a woman: …"), literal meanings, word-by-word breakdowns, verb–noun pairings.
- `pronunciationNote` — only when reading the transliteration aloud doesn't reliably produce the intended sound. Clusters that surprise an English reader (`fhimt`), doubled glottals (`waʾʾif`), atypical stress.
- `fushaNote` — only when the dialect form diverges sharply from MSA and the divergence is itself a memory hook (`hallaʾ` ← `al-ʾān`, `wēn` ← `ʾayna`). MSA-side commentary lives here, not in `context`.
- `tags` — array of scenario IDs (`rescue`, `drivers`, `shops`, `kids`, `family`, `work`, `basics`, `doctor`, `directions`, `neighbours`, `geography`, `politics`) plus the `rescue: true` flag for the small set of high-priority recovery phrases. The planner uses these to surface items in scenario-scoped sessions.
- `status` — `"draft"` until verified against a native speaker or reliable source, then `"verified"`.

### Engine schema (in `engines.json`)

Engines have the same `id` / `name` / `tags` / `status`, plus:

- `pattern` — English template, e.g. `"I want [OBJECT]"`.
- `arabicPattern` / `transliterationPattern` — Arabic template with `[SLOT]` placeholders.
- `fushaNote` — engine-level MSA derivation. This is where the morphological breakdown for the whole engine lives, so individual `forms[]` entries usually don't need their own.
- `forms[]` — concrete forms. Each form has the same fields as a phrase plus a short `key` and a `label`.
- `slots[]` — substitutable options for the `[SLOT]` placeholders. Each option has `arabic` / `transliteration` / `english`.

---

## 2. Transliteration scheme

### Consonants

| Letter | Translit | Notes |
|---|---|---|
| ا | (long ā / silent stem) | see vowels |
| ب | b |  |
| ت | t |  |
| ث | t (sometimes s) | spoken Levantine usually merges to `t`; some speakers say `s`. Use what is actually said. |
| ج | j | (some speakers say `zh` — keep `j` unless writing for that speaker) |
| ح | ḥ | pharyngeal — distinct from `h` |
| خ | kh | velar fricative |
| د | d |  |
| ذ | d (sometimes z) | merges to `d` in colloquial; keep `z` only when the word survives in MSA register |
| ر | r | trilled / tapped |
| ز | z |  |
| س | s |  |
| ش | sh |  |
| ص | ṣ | emphatic — backs surrounding vowels |
| ض | ḍ | emphatic |
| ط | ṭ | emphatic |
| ظ | ẓ | emphatic — usually realised like emphatic `ḍ` in Levantine |
| ع | ʿ | voiced pharyngeal — **not** silent |
| غ | gh | uvular `r`-like |
| ف | f |  |
| ق | ʾ *or* q | **Jerusalem dialect (urban Palestinian) — see "Qāf: dual realization" below.** Default everyday spoken value is the glottal stop `ʾ`; literary retentions are written `q`. |
| ك | k |  |
| ل | l |  |
| م | m |  |
| ن | n |  |
| ه | h | (English-style h) |
| و | w / ū / ō | consonantal `w`, or long vowel — see vowels |
| ي | y / ī / ē | consonantal `y`, or long vowel — see vowels |
| ء | ʾ | hamza, glottal stop |

### Qāf: dual realization

Jerusalem dialect (and urban Palestinian / Levantine more broadly) realises ق two different ways depending on the word's register:

- **Everyday colloquial → `ʾ` (glottal stop).** This is the default for ordinary spoken vocabulary: `ʾahwe` (قهوة, coffee), `ʾaddēsh` (قدّيش, how much), `ʾarīb` (قريب, near), `ʾalbi` (قلبي, my heart), `ṭarīʾ` (طريق, road), `il-bāʾi` (الباقي, the rest / change), `waʾʾif` (وقّف, stop!), `azraʾ` (أزرق, blue), `būʿ il-ʾalam` (بوق القلم, pen tip).
- **Literary / formal retention → `q`.** Words felt to belong to a higher register keep the literary qāf:
  - **Religious vocabulary**: `al-Qurʾān`, `qiyāma`, `taqwā`.
  - **Place names with classical resonance**: `al-Quds` (Jerusalem), `al-Qāhira` (Cairo), `an-Naqab` (Negev).
  - **Formal political / legal / academic terms**: `al-muqāwama` (resistance), `ḥuqūq` (rights), `al-Qāʾima` (the List, in party names), `qiṭāʿ Ghazza` (Gaza Strip), `istiqlāl` (independence), `manṭiqa` (region), `taqaddum` (progress), `niqāsh` (discussion).
  - **Modern formal nouns absent from everyday speech in their colloquial form**.

When in doubt: say it out loud. If the word feels formal, news-anchorish, or religious, it keeps `q`. If it's something you'd say buying coffee or asking directions, it's `ʾ`. Some words sit on the border (`manṭiqa` vs `manṭiʾa`); in those cases either is heard, and we default to the more formal `q` since the dialect glottal is obvious to a learner from context.

Some rural Palestinian / Bedouin / Druze speakers keep `q` everywhere or use `g` (e.g. `gahwe` for coffee). We don't model those varieties — defaulting to Jerusalem urban norms.

### Vowels

- Short: **a**, **i**, **u**
- Long: **ā**, **ī**, **ū**, **ē**, **ō**
  - `ē` and `ō` are Levantine — they appear where MSA has the diphthongs `ay` and `aw` (e.g. بيت = `bēt`, يوم = `yōm`).
- Schwa / unstressed reduced vowel: **e** (e.g. كتبت = `katabet`, بلكي = `belki`).

### Article and assimilation

Write the article as it sounds.

- ال + sun letter assimilates: `ish-shams` (الشمس), `it-talj` (الثلج), `aḍ-ḍuhr` (الضهر).
- ال + moon letter: `il-bēt`, `il-walad`, `al-mutaṭarrifīn`.
- The article reduces to `l-` after a vowel: `kīf l-ḥāl`.
- Formal political / religious vocabulary uses `al-`; everyday vocabulary uses `il-` (matches the qāf rule — same register split).

### Gemination (shadda)

Double the consonant: بدّي = `biddi`, محمّد = `Muḥammad`, شُكراً = `shukran`, خلّينا = `khallīna`.

### Stress

Don't mark stress explicitly; Arabic stress is largely predictable from syllable weight. If a word's stress would surprise an English reader, add a `pronunciationNote`.

### Formatting

- Lowercase by default. Capitalize only proper names (Allāh, Muḥammad, Quds).
- Hyphenate clitics that fuse phonologically: article `il-` / `al-`, conjunction `w-`, prepositions `bi-` / `la-`, object pronouns `-ni` / `-ak` / `-ik` / `-o` / `-ha` / `-na` / `-kum` / `-hum`, possessive suffixes (same shapes). The future marker `raḥ` is a separate word.
- Spaces between words.
- Keep punctuation simple: `.`, `,`, `?`. No exclamation point unless it's a true interjection.

### Canonical examples

| Arabic | Translit | English |
|---|---|---|
| السلام عليكم | as-salāmu ʿalaykum | peace be upon you (formal) |
| مرحبا | marḥaba | hello |
| كيف حالك؟ | kīf ḥālak? | how are you? (m) |
| كيف حالِك؟ | kīf ḥālik? | how are you? (f) |
| الحمد لله | il-ḥamdu lillāh / il-ḥamdillāh | thank God / I'm fine |
| بدّي ميّ | biddi mayy | I want water |
| ما بدّيش | mā biddīsh | I don't want |
| ممكن أحكي شوي إنجليزي؟ | mumkin aḥki shwayy inglīzi? | can I speak a little English? |
| وين الحمّام؟ | wēn il-ḥammām? | where is the bathroom? |
| كم الحساب؟ | kam il-ḥsāb? | how much is the bill? |
| رح أروح ع البيت | raḥ arūḥ ʿa l-bēt | I'm going home |
| هلّق | hallaʾ | now (Levantine; ← MSA `al-ʾān`) |
| شو؟ | shū? | what? |
| ليش؟ | lēsh? | why? |
| كتير | ktīr | a lot / very |

---

## 3. When to add a note, and which field to use

Three optional note fields. Pick the smallest one that fits, and don't pad. The card is the unit of attention; the note is supporting material that should be scannable in one glance.

### Field selection

- **`context`** — the default home for editorial notes. Holds: when do you say this, cultural/social cues, gender variants, literal meanings, word-by-word breakdowns, verb–noun pairings.
- **`pronunciationNote`** — only when the transliteration alone won't get the learner the right sound. Clusters (`fhimt`), doubled glottals (`waʾʾif`), surprising stress, vowel-quality cues.
- **`fushaNote`** — only for MSA derivation and sound shifts. The dialect form's relationship to its classical ancestor.

When unsure: use `context` and keep it short. Don't double up — if `pronunciationNote` already covers the hook, don't repeat it in `context`.

### 3a. Literal meanings

When a phrase's idiomatic meaning differs from the word-for-word sum of its parts — greetings, set expressions, fixed metaphors, body-part idioms, religious phrases used as small-talk — include the literal gloss alongside the natural English. The literal gives the learner a hook for memory and a feel for how the language puts ideas together.

Format: `Lit. '<word-for-word translation>'.`

Examples in the data:

- `marḥabtēn` → "Hello back." Lit. 'two hellos' (warmer reply).
- `maʿ is-salāme` → "Goodbye." Lit. 'with safety'.
- `ṣabāḥ in-nūr` → "Good morning back." Lit. 'morning of light'.
- `yalla` → "Let's go / Come on." From يا الله, lit. 'O God'.
- `biddha waʾt` → "It'll take time." Lit. 'it [f] wants time'.
- `mā shāʾ Allāh` → admiration interjection. Lit. 'what God has willed'.
- `māshi` → "OK / fine." Lit. 'walking / going' (active participle of `mishi`).
- `ʿala mahlak` → "Take it easy." Lit. 'on your leisure / pace'.

Skip the literal when it would just restate the English (`mā fhimt` = "I didn't understand" — no metaphor, no need). Keep it short — one short sentence, not a full etymology. Etymology that crosses into MSA goes in `fushaNote`, not here.

### 3b. Verb–noun pairing

When a card teaches a verb form (especially imperatives and request forms — "help me", "repeat", "wait"), name the related Arabic noun in `context`. Arabic roots cluster verbs and nouns tightly, so showing the noun alongside the verb gives the learner two anchors for the same root.

Format: `noun: <noun-form> ('<gloss>').` Place inside the existing `context` text — don't invent a new field.

Examples in the data:

- `tsāʿidni` ("help me") — noun: `musāʿada` ('help / assistance').
- `tʿīd` ("repeat") — noun: `iʿāda` ('a repetition').
- `baʿtaʾid` ("I think / believe") — noun: `iʿtiqād` ('a belief').
- `baḥtirim` ("I respect") — noun: `iḥtirām` ('respect').
- `tsallifni` ("lend me" — note: the English "borrow" inverts the Arabic perspective) — noun: `taslīf` ('lending / a loan').
- `atʿallam` / `tʿallamt` ("I learn / I learned") — noun: `taʿallum` ('learning'); related: `taʿlīm` ('teaching / education').

Skip when the noun shape matches the verb shape so closely that naming it adds nothing (most Form I masdars where English uses the same word for both — `shaghl` ↔ `shaghal`, both 'work'), or when the noun is far less useful in conversation than the verb. Skip if the verb–noun pair belongs to a register the learner won't use (e.g. `aḥsant` ↔ `iḥsān` is technically right, but `iḥsān` is mostly religious / charitable register and not a useful pairing here).

### 3c. Word-by-word breakdown

When a phrase has multiple Arabic words and it isn't obvious which Arabic word maps to which English meaning — particles, clitics, fused pronouns, iḍāfa constructions, dual / plural endings — include a brief morpheme-by-morpheme breakdown.

Three formats; use whichever is shortest and clearest:

- **Equation form**: `kīf = how, ḥāl = state, -ak = your (m).`
- **Inline gloss**: `Lit. word-for-word: 'how (is) your-state'.`
- **Component callout**: `mumkin = is-it-possible; t- = you (2sg); sāʿid = help; -ni = me.`

Examples in the data:

- `kīf ḥālak?` ("How are you? (m)") → `kīf = how, ḥāl = state, -ak = your (m). Lit. 'how (is) your-state'.`
- `bashūfak bukra` ("See you tomorrow") → `b-ashūf = I see / I'll see; -ak = you (m); bukra = tomorrow.`
- `byōjaʿni hōn` ("It hurts here") → `b-y-ōjaʿ = it (m) hurts (b- prefix + 3sg.m imperfect of wajaʿ); -ni = me; hōn = here.`
- `ʿindi waladēn` ("I have two kids") → `ʿind-i = at-me / I-have; waladēn = two-boys (the dual ending -ēn on walad).`
- `kam walad ʿindak?` ("How many kids do you have?") → `kam = how many (takes a singular noun, not plural); walad = kid; ʿind-ak = at-you / you-have.`
- `ish-sharaf ili` ("The honor is mine") → `ish-sharaf = the honor; il-i = to-me / mine. No copula needed.`

Skip when:

- Single-word phrases (`yalla`, `marḥaba`, `bi-ẓ-ẓabṭ`, `māshi`).
- Compositional sentences where each Arabic word transparently maps to one English word in the same order (`biddi mayy` = "I-want water" — too obvious; `ana muwāfiʾ` = "I'm agreeing" — same).
- The existing `context`, `pronunciationNote`, or `fushaNote` already breaks it down.
- Engine `forms[]` entries — the engine's own `fushaNote` handles morphology for the whole engine, so individual forms don't need their own breakdown.

### 3d. Fuṣḥā notes

For dialect items that diverge sharply from MSA in form or sound, add a `fushaNote` that names the MSA equivalent and the sound shift in one short sentence.

Examples:

- `هلّق` (`hallaʾ`): "From الآن (`al-ʾān`) → الحقّ (`al-ḥaqq`, this moment) → spoken collapse to `hallaʾ`. Many Levantine speakers also say `hassa` or `halʾēt`."
- `بدّي` (`biddi`): "From بِودّي / بِـ + ودّ ('with my desire'). In Levantine, `bidd-` + pronoun = 'want'. MSA verb: أريد (`urīd`)."
- `شو` (`shū`): "From أيّ شيء هو (`ʾayy shayʾ huwa`, 'what thing is it') → contracted to `shū`. MSA: ما (`mā`) / ماذا (`māḏā`)."
- `وين` (`wēn`): "From أين (`ʾayna`). Levantine fronts the diphthong: `ay` → `ē`."

Only add a `fushaNote` when it actually helps memory or disambiguation. Don't pad every item with one. If two unrelated etymologies both fit (e.g. `istanna` vs `intaẓara` share meaning but not root), say so honestly — don't fabricate a derivation.

### 3e. Gender variants

Arabic distinguishes 2sg.m / 2sg.f and male / female speakers, so many cards have a counterpart form. Convention:

- For cards **addressed to a specific gender**, append: `To a woman: <alternate>.` or `To a man: <alternate>.`
- For cards **said by a specific-gender speaker** (active participle, adjective with gender agreement), append: `Female speaker: <alternate>.` or `Male speaker: <alternate>.`
- The base card uses the masculine form by default (matches the existing convention; not a statement about who the user is, just a default).

Examples:

- `ana muwāfiʾ` → "I agree." — `Female speaker: ana muwāfʾa.`
- `kīf ḥālak?` → "How are you? (m)" — paired with a separate `kīf-ḥālik` card; in `context`: `Asking a man.`
- `mumkin tsāʿidni?` → "Can you help me?" — `To a woman: mumkin tsāʿdīni?`

If both forms differ enough to warrant separate cards (different transliterations the learner needs to recognise on hearing them), make two cards. If the form change is mechanical and predictable (just a gender suffix), one card with a `context` note is enough.

---

## 4. Tone & length

The flashcard UI shows the `context` (and `pronunciationNote`, `fushaNote`) above the answer. Long notes overwhelm the card.

- One to two short sentences max in any single field.
- Don't pile up. If you've added a literal AND a verb-noun AND a word-by-word, you've over-padded — pick the most useful one and cut.
- Write for someone who has the answer in front of them and wants the hook in five seconds, not the etymology.
- Drop articles ("the", "a") in word-by-word glosses where they bloat: `walad = kid` not `walad = a kid`.
- Use straight ASCII apostrophes / quotes and `→` only sparingly. Match the JSON-friendly style already in the file.

---

## 5. Status

Every new item starts as `"status": "draft"` until Adam has verified it against a native speaker or a reliable source. The app surfaces draft warnings in the content browser. Don't promote items to `"verified"` yourself — that's the user's call after testing the phrase in the wild.
