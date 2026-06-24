// Light morphological tokenizer for Arabic.
//
// Given an orthographic word from a newspaper, produce a list of candidate
// stems to look up in the dictionary, most-confident first. The goal is
// high-recall on common surface forms without trying to be a real
// morphological analyser — orders of magnitude smaller than CAMeL Tools
// or Buckwalter, but tuned for the cases that bite a reader most:
// clitic prepositions, the definite article, conjunctions, pronoun and
// verb-past suffixes, broken-fem-plural ⇄ singular, and the form-IV
// imperfect ⇄ past bridge.
//
// Strategy: peel known prefixes / suffixes / both, then a couple of
// morphology-aware fallbacks (-āt → -a; bare root → +ʾalif for Form IV).
// We never claim to have analysed the word — we just produce candidates
// and let the dictionary lookup arbitrate. The first match wins.

// High-confidence prefixes (clitics + article + future marker + compounds).
// Longer compounds first so the most-specific strip wins.
const PREFIXES_TIER1 = [
  // 3-char compounds: conjunction + bi-/fa-/ka-/wa- + article
  'وبال', 'فبال', 'وفال', 'وكال', 'وللـ', 'وللل',
  // wa- + li- + al- (compressed in writing as ولل)
  'فلل', 'ولل',
  // 2-char: clitic + article
  'بال', 'فال', 'وال', 'كال',
  'لل',          // li- + al- → li-l-
  // future + imperfect prefix
  'سي', 'ست', 'سن', 'سأ',
  // article alone (must come after the compounds above)
  'ال',
  // single particles
  'و', 'ف', 'ب', 'ك', 'ل', 'س',
];

// Lower-confidence: imperfect-tense prefixes. We strip these only as
// fallbacks because they often collide with the first root letter
// (ينام nāma vs. nām is correct; أحمد would mis-strip).
const PREFIXES_IMPERFECT = ['ي', 'ت', 'ن', 'أ'];

// Pronoun suffixes (1sg/2sg/3sg + plurals) — kept as a Set for the
// iḍāfa-form cascades, which only fire after one of these is peeled.
const PRONOUN_SUFFIXES = new Set([
  'ها', 'هم', 'هن', 'كم', 'كن', 'نا',
  'ه', 'ك', 'ي',
]);

// Suffixes ordered longest-first so we don't strip a shorter substring
// when a longer one applies.
const SUFFIXES = [
  // dual / plural pronoun objects
  'هما', 'كما',
  // pronoun suffixes (3pl / 2pl / 1pl)
  'ها', 'هم', 'هن', 'كم', 'كن', 'نا',
  // verb past inflection: 2pl.m -tum, 2pl.f -tunna, 2dual -tumā
  'تما', 'تم', 'تن',
  // sound plurals
  'ون', 'ين',     // sound masc plurals (-ūn / -īn)
  'ات',           // sound fem plurals
  'ان',           // dual / -ān
  // nisba feminine
  'ية',
  // single-letter clitics & inflections
  'ه', 'ك', 'ي',
  'ت',            // verb past 3sg.f / 2sg / iḍāfa-form tāʾ
  'ة',            // tāʾ marbūṭa — peel for nisba-fem and some derivations
  'و',            // iḍāfa-form sound masc plural -ū (← -ūn)
  'ا',            // accusative orthographic alif (low confidence; last)
];

// Ḥarakāt block — short vowels, sukūn, shadda, tanwīns, dagger-alif.
const HARAKAT_RE = /[ً-ْٰ]/g;

/** Strip ḥarakāt and tatweel from a word; drop non-Arabic surrounding
 *  characters (punctuation). Doesn't normalise alif / hamza variants:
 *  the dictionary writes them as the newspapers do. */
export function normalise(word) {
  return word
    .replace(HARAKAT_RE, '')
    .replace(/ـ/g, '')
    .replace(/[^؀-ۿݐ-ݿ]/g, '')
    .trim();
}

/** Produce candidate stems for a normalised word, exact-first. */
export function candidateStems(word) {
  const out = [];
  const seen = new Set();
  const push = (s) => {
    if (s && !seen.has(s) && s.length >= 2) { seen.add(s); out.push(s); }
  };

  push(word);

  // Tier 1: suffix strips (and the morphological cascades that follow:
  //   -āt → -a for sound fem plurals,
  //   pronoun suffix + iḍāfa-form -t → -a tāʾ marbūṭa,
  //   pronoun suffix + -āt → -a (e.g. sayyārātnā → sayyāra).
  for (const suf of SUFFIXES) {
    if (word.endsWith(suf) && word.length > suf.length + 1) {
      const stem = word.slice(0, -suf.length);
      push(stem);
      if (suf === 'ات') push(word.slice(0, -2) + 'ة');
      if (PRONOUN_SUFFIXES.has(suf)) {
        if (stem.endsWith('ات')) push(stem.slice(0, -2) + 'ة');
        else if (stem.endsWith('ت')) push(stem.slice(0, -1) + 'ة');
      }
    }
  }

  // Tier 2: prefix strips
  for (const pre of PREFIXES_TIER1) {
    if (word.startsWith(pre) && word.length > pre.length + 1) {
      push(word.slice(pre.length));
    }
  }

  // Tier 3: prefix + suffix combinations, with the same cascades as Tier 1.
  for (const pre of PREFIXES_TIER1) {
    if (!word.startsWith(pre) || word.length <= pre.length + 1) continue;
    const afterPre = word.slice(pre.length);
    for (const suf of SUFFIXES) {
      if (afterPre.endsWith(suf) && afterPre.length > suf.length + 1) {
        const stem = afterPre.slice(0, -suf.length);
        push(stem);
        if (suf === 'ات') push(afterPre.slice(0, -2) + 'ة');
        if (PRONOUN_SUFFIXES.has(suf)) {
          if (stem.endsWith('ات')) push(stem.slice(0, -2) + 'ة');
          else if (stem.endsWith('ت')) push(stem.slice(0, -1) + 'ة');
        }
      }
    }
  }

  // Tier 4: imperfect prefix strip (lower confidence; only after the
  // simpler strips have been tried). Also try suffix strips on top so
  // plural imperfects like يكتبون peel to كتب (i.e. drop both ي and ون).
  for (const pre of PREFIXES_IMPERFECT) {
    if (word.startsWith(pre) && word.length > pre.length + 1) {
      const stem = word.slice(pre.length);
      push(stem);
      for (const suf of SUFFIXES) {
        if (stem.endsWith(suf) && stem.length > suf.length + 1) {
          push(stem.slice(0, -suf.length));
        }
      }
    }
  }
  // Combined: future marker + imperfect prefix already covered in TIER1
  // (سي/ست/سن/سأ) — also try simple ت/ي/ن/أ strips on words that begin
  // with a single clitic + imperfect prefix (e.g. سي + کتب).
  for (const clitic of ['س', 'و', 'ف']) {
    if (word.startsWith(clitic) && word.length > 2) {
      const afterClitic = word.slice(1);
      for (const ip of PREFIXES_IMPERFECT) {
        if (afterClitic.startsWith(ip) && afterClitic.length > ip.length + 1) {
          push(afterClitic.slice(ip.length));
        }
      }
    }
  }

  // Tier 5: Form-IV imperfect → past bridge. The imperfect stem
  // (e.g. علن after stripping ت from تعلن) doesn't match the dict's past
  // headword (أعلن); add أ-prefixed candidates so the bridge works.
  // Also try plain alif so Form VII/VIII/X stems land (استمر, اجتمع, …).
  const bridge = [];
  for (const c of out) {
    if (c.length >= 3 && c.length <= 6 && !/^[أإاآ]/.test(c)) {
      bridge.push('أ' + c);
      bridge.push('ا' + c);
    }
  }
  for (const c of bridge) push(c);

  return out;
}

/** Look up an orthographic word in a dictionary (Map<headword, entry>).
 *  Returns { entry, matchedStem, original } or null. */
export function lookup(rawWord, dictMap) {
  const word = normalise(rawWord);
  if (!word) return null;
  for (const c of candidateStems(word)) {
    const hit = dictMap.get(c);
    if (hit) return { entry: hit, matchedStem: c, original: rawWord };
  }
  return null;
}
