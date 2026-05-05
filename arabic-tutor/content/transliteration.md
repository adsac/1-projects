# Transliteration scheme — Palestinian / Levantine spoken Arabic

This is the contract for every `transliteration` field in this app.
The goal: a reader who knows nothing about Arabic should be able to read
the transliteration aloud and produce something close to what a native
Palestinian speaker would say. We transcribe what is **spoken**, not the
underlying MSA spelling.

## Consonants

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
| ق | ʾ | **In urban Palestinian and many Levantine dialects, ق is realised as a glottal stop.** Some rural/Bedouin speakers keep `q` or `g`. Default to `ʾ`. |
| ك | k |  |
| ل | l |  |
| م | m |  |
| ن | n |  |
| ه | h | (English-style h) |
| و | w / ū / ō | consonantal `w`, or long vowel — see vowels |
| ي | y / ī / ē | consonantal `y`, or long vowel — see vowels |
| ء | ʾ | hamza, glottal stop |

## Vowels

- Short: **a**, **i**, **u**
- Long: **ā**, **ī**, **ū**, **ē**, **ō**
  - `ē` and `ō` are Levantine — they appear where MSA has the diphthongs `ay` and `aw`
  (e.g. بيت = `bēt`, يوم = `yōm`).
- Schwa / unstressed reduced vowel: **e** (e.g. كتبت = `katabet`, بلكي = `belki`).

## Article and assimilation

Write the article as it sounds.
- ال + sun letter assimilates: `ish-shams` (الشمس), `it-talj` (الثلج → `it-talj`/`it-talj`).
- ال + moon letter: `il-bēt`, `il-walad`.
- The article reduces to `l-` after a vowel: `kīf l-ḥāl`.

## Gemination (shadda)

Double the consonant: بدّي = `biddi`, محمّد = `Muḥammad`, شُكراً = `shukran`.

## Stress

Don't mark stress explicitly; Arabic stress is largely predictable from
syllable weight. If a word's stress would surprise an English reader,
add a `pronunciationNote` field.

## Formatting

- Lowercase by default. Capitalize only proper names (Allāh, Muḥammad, Quds).
- Hyphenate clitics that fuse phonologically: article `il-`, conjunction `w-`, preposition `bi-` / `la-`, future marker `raḥ` is a separate word.
- Spaces between words.
- Keep punctuation simple: `.`, `,`, `?`. No exclamation point unless it's a true interjection.

## Examples (canonical)

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

## Fuṣḥā notes

For dialect items that diverge sharply from MSA in form or sound,
include a `fushaNote` that gives the MSA equivalent and the sound
shift in one short sentence. Examples:

- `هلّق` (hallaʾ): "From الآن (`al-ʾān`) → الحقّ (`al-ḥaqq`, this moment) → spoken collapse to `hallaʾ`. Many Levantine speakers also say `hassa` or `halʾēt`."
- `بدّي` (biddi): "From بِودّي / بِـ + ودّ ('with my desire'). In Levantine, `bidd-` + pronoun = 'want'. MSA equivalent verb: أريد (`urīd`)."
- `شو` (shū): "From أيّ شيء هو (`ʾayy shayʾ huwa`, 'what thing is it') → contracted to `shū`. MSA: ما (`mā`) / ماذا (`māḏā`)."
- `وين` (wēn): "From أين (`ʾayna`). Levantine fronts the diphthong: `ay` → `ē` plus emphasis."

Only add a fushaNote when it actually helps memory or disambiguation.
Don't pad every item with one.

## Status

Every item starts as `"status": "draft"` until the user (Adam) has
verified it against a native speaker or a reliable source. The app
surfaces draft warnings in the content browser.
