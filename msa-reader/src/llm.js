// Anthropic API wrapper for auto-filling unknown-word dictionary entries.
//
// Uses Claude Sonnet 4.6 for stronger Arabic morphology (roots, binyan
// forms, Hebrew cognates) than Haiku. Roughly $0.0018 per word lookup
// (~200 input + ~80 output tokens at Sonnet rates) — about 3x Haiku, still
// well under a fifth of a cent each.
//
// The API key is stored in IndexedDB (Settings.claudeApiKey) and never
// leaves the device — exports strip it. The browser-direct call uses
// Anthropic's CORS header so no proxy is needed.

const MODEL = 'claude-sonnet-4-6';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You populate a Modern Standard Arabic newspaper-reader dictionary.

Given an unvocalised Arabic word, respond with ONLY a JSON object — no preamble, no markdown fences — with exactly these fields:

- gloss: short English gloss (3-8 words; comma-separated senses if needed)
- vocalized: the fully vocalised form with diacritics (شَدَّة, fatḥa, kasra, ḍamma, sukūn, etc.)
- root: hyphenated root letters like "k-t-b" (ʿ for ʿayn, ʾ for hamza). Empty string if particle / loanword / proper noun.
- form: morphological form label. Use this controlled vocabulary verbatim:
    "Form I verb", "Form II verb", ..., "Form X verb"
    "Form I masdar", "Form II masdar", ..., "Form X masdar"
    "Form I active participle", ..., "Form X active participle"
    "Form I passive participle", ..., "Form X passive participle"
    "noun of place", "Form I noun", "Form I nisba"
    "plural", "dual", "elative"
    "particle", "preposition", "pronoun", "demonstrative", "relative", "quantifier", "interrogative", "number"
    "proper noun"
- hebrew: Hebrew cognate if a clean shared Semitic root exists, formatted "<Hebrew script> (transliteration, gloss)". Empty string when there isn't a clean cognate — don't force it.

Word:`;

/**
 * Look up an Arabic word via Claude. Returns a parsed dict entry on success.
 * Throws on network / auth / parse errors so the caller can surface the message.
 */
export async function autofillEntry(headword, apiKey) {
  if (!apiKey) throw new Error('No API key set in Settings.');
  if (!headword) throw new Error('No word.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      messages: [
        { role: 'user', content: `${SYSTEM_PROMPT} ${headword}` },
      ],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    throw new Error(`API ${res.status}${detail ? ` — ${detail}` : ''}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  // Tolerate stray markdown fences or prose around the JSON.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Response was not JSON.');
  const parsed = JSON.parse(match[0]);
  return {
    headword,
    vocalized: parsed.vocalized || headword,
    gloss: parsed.gloss || '',
    root: parsed.root || '',
    form: parsed.form || '',
    hebrew: parsed.hebrew || '',
    status: 'verified',
  };
}

const EXPLAIN_PROMPT = `You help an intermediate learner read real Modern Standard Arabic news text.

Given an Arabic passage, respond with ONLY a JSON object — no preamble, no markdown fences — with exactly these fields:

- translation: natural English translation of the whole passage
- words: array of {ar, gloss} covering the passage IN ORDER, one entry per word as printed (clitics explained inside the gloss, e.g. "and-the-government (wa- + al-)"). Keep glosses short.
- notes: 1-3 sentences on whatever grammar in this passage would trip a learner (case endings, verb forms, iḍāfa, passive, word order). Plain English. Empty string if genuinely nothing noteworthy.

Passage:
`;

/**
 * Parse an explain response. Long paragraphs can hit the max_tokens cap and
 * arrive as JSON cut off mid-array — instead of throwing a parse error at
 * the user, salvage the translation and every complete {ar, gloss} pair
 * that made it through before the cutoff.
 * Exported for tests. Returns null only when nothing usable is present.
 */
export function parseExplainResponse(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return {
        translation: parsed.translation || '',
        words: Array.isArray(parsed.words)
          ? parsed.words.filter((w) => w && w.ar && w.gloss).map((w) => ({ ar: String(w.ar), gloss: String(w.gloss) }))
          : [],
        notes: parsed.notes || '',
        truncated: false,
      };
    } catch { /* fall through to salvage */ }
  }
  const str = '"((?:[^"\\\\]|\\\\.)*)"';
  const unq = (s) => JSON.parse(`"${s}"`);
  const tr = text.match(new RegExp(`"translation"\\s*:\\s*${str}`));
  const notes = text.match(new RegExp(`"notes"\\s*:\\s*${str}`));
  const words = [];
  const wordRx = new RegExp(`\\{\\s*"ar"\\s*:\\s*${str}\\s*,\\s*"gloss"\\s*:\\s*${str}\\s*\\}`, 'g');
  let m;
  while ((m = wordRx.exec(text))) words.push({ ar: unq(m[1]), gloss: unq(m[2]) });
  if (!tr && words.length === 0) return null;
  return {
    translation: tr ? unq(tr[1]) : '',
    words,
    notes: notes ? unq(notes[1]) : '',
    truncated: true,
  };
}

/**
 * Explain a passage (usually one paragraph) via Claude.
 * Returns { translation, words: [{ar, gloss}], notes, truncated }.
 * Throws on network / auth / unusable-response errors so the caller can
 * surface them. Roughly $0.01–0.05 per paragraph at Sonnet rates depending
 * on length.
 */
export async function explainPassage(passage, apiKey) {
  if (!apiKey) throw new Error('No API key set in Settings.');
  if (!passage || !passage.trim()) throw new Error('Nothing to explain.');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      // Word-by-word glosses of a full news paragraph run long: ~25 tokens
      // per word entry means a 60-word paragraph needs ~2000 tokens for the
      // words array alone. 6000 leaves comfortable headroom; the salvage
      // path below still renders whatever fits if a monster paragraph
      // exceeds even that.
      max_tokens: 6000,
      messages: [
        { role: 'user', content: EXPLAIN_PROMPT + passage },
      ],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch {}
    throw new Error(`API ${res.status}${detail ? ` — ${detail}` : ''}`);
  }

  const data = await res.json();
  const text = data?.content?.[0]?.text || '';
  const result = parseExplainResponse(text);
  if (!result) throw new Error('Could not read the response — try again.');
  if (data?.stop_reason === 'max_tokens') result.truncated = true;
  return result;
}
