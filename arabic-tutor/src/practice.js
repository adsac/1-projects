// Practice controllers — pure session-state machine + view-builders.
// The controllers return DOM nodes; mutation flows via callbacks back into the session.

import { el, clear, shuffle } from './util.js';
import { grade, previewIntervals, isLeech } from './scheduler.js';
import { putState, getState } from './data.js';
import * as recorder from './recorder.js';

/**
 * Resolve a phrase's word-by-word building blocks. Structured `breakdown`
 * wins; older content that embeds "kīf = how, ..." in `context` still parses.
 * @returns {Array<{token:string, gloss:string}>|null}
 */
export function componentsFor(phrase) {
  if (Array.isArray(phrase.breakdown) && phrase.breakdown.length >= 2) {
    return phrase.breakdown.filter((c) => c && c.token && c.gloss);
  }
  return parseWordByWord(phrase.context);
}

function componentsBlock(phrase, heading = 'Building blocks:') {
  const components = componentsFor(phrase);
  if (!components || components.length < 2) return null;
  const block = el('div', { class: 'col' });
  block.append(el('div', { class: 'muted' }, heading));
  const list = el('div', { class: 'components' });
  for (const c of components) {
    list.append(el('div', { class: 'components-row' }, [
      el('span', { class: 'translit' }, c.token),
      el('span', { class: 'muted' }, ' — '),
      el('span', {}, c.gloss),
    ]));
  }
  block.append(list);
  return block;
}

function leechTag(state) {
  return isLeech(state) ? el('span', { class: 'tag leech' }, 'keeps slipping') : null;
}

function fmtInterval(d) {
  if (d < 1) return '<1m';
  if (d === 1) return '1d';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}

/**
 * Build a card view for a phrase recall step.
 * @param {{phrase:any, state?:any, settings:any, onGraded:(grade:string)=>void, onSkip:()=>void, onSuspend?:()=>void}} ctx
 */
export function recallCard({ phrase, state, settings, onGraded, onSkip, onSuspend }) {
  const root = el('div', { class: 'card col' });
  let revealed = false;

  const prompt = el('div', { class: 'col' }, [
    el('div', { class: 'muted' }, [leechTag(state), ...phraseTags(phrase)]),
    phrase.context ? el('div', { class: 'context' }, phrase.context) : null,
    el('h1', {}, phrase.english),
  ]);
  root.append(prompt);

  const answer = el('div', { class: 'col', hidden: true });
  const arBlock = el('div', { class: 'ar lg' }, phrase.arabic);
  answer.append(arBlock);
  if (settings.showTransliteration) {
    answer.append(el('div', { class: 'translit' }, phrase.transliteration));
  }
  const blocks = componentsBlock(phrase);
  if (blocks) answer.append(blocks);
  if (phrase.pronunciationNote) answer.append(el('div', { class: 'note' }, `Pronunciation: ${phrase.pronunciationNote}`));
  if (phrase.fushaNote) answer.append(el('div', { class: 'note fusha' }, `Fuṣḥā note: ${phrase.fushaNote}`));
  answer.append(buildRecorderBar());
  root.append(answer);

  const revealBtn = el('button', {
    class: 'primary',
    onclick: () => {
      revealed = true;
      answer.hidden = false;
      revealBtn.hidden = true;
      grades.hidden = false;
    },
  }, 'Reveal');
  root.append(revealBtn);

  const grades = el('div', { class: 'grades', hidden: true }, gradeRow(state, finish));
  root.append(grades);

  root.append(el('div', { class: 'row' }, [
    el('button', { class: 'ghost', onclick: () => onSkip() }, 'Skip'),
    onSuspend ? el('button', { class: 'ghost', onclick: () => onSuspend() }, 'Suspend') : null,
  ]));

  function finish(g) {
    if (!revealed) return;
    onGraded(g);
  }
  return root;
}

/**
 * Recognition card: Arabic prompt, reveal English. Inverse of recallCard.
 * @param {{phrase:any, state?:any, settings:any, onGraded:(grade:string)=>void, onSkip:()=>void, onSuspend?:()=>void}} ctx
 */
export function recognizeCard({ phrase, state, settings, onGraded, onSkip, onSuspend }) {
  const root = el('div', { class: 'card col' });
  let revealed = false;

  const tags = phraseTags(phrase);
  root.append(el('div', { class: 'muted' }, [
    el('span', { class: 'tag' }, 'Arabic → English'),
    leechTag(state),
    ...tags,
  ]));
  root.append(el('div', { class: 'ar lg' }, phrase.arabic));
  if (settings.showTransliteration) {
    root.append(el('div', { class: 'translit' }, phrase.transliteration));
  }

  const answer = el('div', { class: 'col', hidden: true }, [
    el('h2', {}, phrase.english),
    phrase.context ? el('div', { class: 'context' }, phrase.context) : null,
    componentsBlock(phrase),
    phrase.pronunciationNote ? el('div', { class: 'note' }, `Pronunciation: ${phrase.pronunciationNote}`) : null,
    phrase.fushaNote ? el('div', { class: 'note fusha' }, `Fuṣḥā note: ${phrase.fushaNote}`) : null,
  ]);
  root.append(answer);

  const revealBtn = el('button', {
    class: 'primary',
    onclick: () => {
      revealed = true;
      answer.hidden = false;
      revealBtn.hidden = true;
      grades.hidden = false;
    },
  }, 'Reveal');
  root.append(revealBtn);

  function finish(g) { if (revealed) onGraded(g); }
  const grades = el('div', { class: 'grades', hidden: true }, gradeRow(state, finish));
  root.append(grades);

  root.append(el('div', { class: 'row' }, [
    el('button', { class: 'ghost', onclick: () => onSkip() }, 'Skip'),
    onSuspend ? el('button', { class: 'ghost', onclick: () => onSuspend() }, 'Suspend') : null,
  ]));
  return root;
}

/**
 * Build the four grade buttons with intervals computed from the current
 * state. For a card with no prior state, this still works — the scheduler
 * uses fresh defaults under the hood.
 */
function gradeRow(state, finish) {
  const iv = previewIntervals(state || null);
  return [
    gradeBtn('again', 'Again', fmtInterval(iv.again), () => finish('again')),
    gradeBtn('hard',  'Hard',  fmtInterval(iv.hard),  () => finish('hard')),
    gradeBtn('good',  'Good',  fmtInterval(iv.good),  () => finish('good')),
    gradeBtn('easy',  'Easy',  fmtInterval(iv.easy),  () => finish('easy')),
  ];
}

/**
 * New-item introduction. If the phrase's context carries a parseable
 * word-by-word breakdown ("kīf = how, ḥāl = state, -ak = your (m)."),
 * we show the components first and the assembled phrase only after a
 * tap — i+1 ramp instead of i+4 wall. Otherwise the single-step intro.
 */
export function newIntro(ctx) {
  const components = componentsFor(ctx.phrase);
  return components && components.length >= 2
    ? twoStepIntro({ ...ctx, components })
    : singleStepIntro(ctx);
}

function singleStepIntro({ phrase, settings, onContinue, onSuspend }) {
  const root = el('div', { class: 'card col' });
  root.append(el('div', { class: 'muted' }, ['New phrase ', ...phraseTags(phrase)]));
  if (phrase.context) root.append(el('div', { class: 'context' }, phrase.context));
  root.append(el('div', { class: 'ar lg' }, phrase.arabic));
  if (settings.showTransliteration) root.append(el('div', { class: 'translit' }, phrase.transliteration));
  root.append(el('h2', {}, phrase.english));
  if (phrase.pronunciationNote) root.append(el('div', { class: 'note' }, `Pronunciation: ${phrase.pronunciationNote}`));
  if (phrase.fushaNote) root.append(el('div', { class: 'note fusha' }, `Fuṣḥā note: ${phrase.fushaNote}`));
  root.append(buildRecorderBar());
  root.append(el('button', { class: 'primary', onclick: () => onContinue() }, 'Got it — show me again later'));
  if (onSuspend) {
    root.append(el('div', { class: 'row' }, [
      el('button', { class: 'ghost', onclick: () => onSuspend() }, 'Suspend (don\'t show this again)'),
    ]));
  }
  return root;
}

function twoStepIntro({ phrase, components, settings, onContinue, onSuspend }) {
  const root = el('div', { class: 'col' });

  // Step 1: meaning + building blocks. No Arabic answer yet.
  const step1 = el('div', { class: 'card col' });
  step1.append(el('div', { class: 'muted' }, ['New phrase · components first ', ...phraseTags(phrase)]));
  step1.append(el('h2', {}, phrase.english));
  step1.append(el('div', { class: 'muted' }, 'Building blocks:'));
  const list = el('div', { class: 'components' });
  for (const c of components) {
    list.append(el('div', { class: 'components-row' }, [
      el('span', { class: 'translit' }, c.token),
      el('span', { class: 'muted' }, ' — '),
      el('span', {}, c.gloss),
    ]));
  }
  step1.append(list);

  // Step 2: assembled phrase, hidden until step 1 is acknowledged.
  const step2 = el('div', { class: 'card col', hidden: true });
  step2.append(el('div', { class: 'muted' }, 'Assembled:'));
  step2.append(el('div', { class: 'ar lg' }, phrase.arabic));
  if (settings.showTransliteration) step2.append(el('div', { class: 'translit' }, phrase.transliteration));
  step2.append(el('h2', {}, phrase.english));
  if (phrase.pronunciationNote) step2.append(el('div', { class: 'note' }, `Pronunciation: ${phrase.pronunciationNote}`));
  if (phrase.fushaNote) step2.append(el('div', { class: 'note fusha' }, `Fuṣḥā note: ${phrase.fushaNote}`));
  step2.append(buildRecorderBar());
  step2.append(el('button', { class: 'primary', onclick: () => onContinue() }, 'Got it — show me again later'));

  const revealBtn = el('button', {
    class: 'primary',
    onclick: () => { step2.hidden = false; revealBtn.hidden = true; },
  }, 'Show the assembled phrase');
  step1.append(revealBtn);

  if (onSuspend) {
    step1.append(el('div', { class: 'row' }, [
      el('button', { class: 'ghost', onclick: () => onSuspend() }, 'Suspend (don\'t show this again)'),
    ]));
  }
  root.append(step1);
  root.append(step2);
  return root;
}

/**
 * Parse a context string for word-by-word breakdowns of the form
 *   "X = how, Y = state, -ak = your (m)."
 * or with semicolons. Returns an array of {token, gloss} or null.
 *
 * Handles prose before / after the breakdown:
 *  - "At a café. fī = there is; ..."  -> drops "At a café. " prefix
 *  - "your (m). Lit. 'how (is) your-state'." -> truncates after "your (m)"
 *    only when the next sentence starts with a capital letter, so
 *    "law samaḥt = lit. 'if you...would permit'" stays intact.
 */
function parseWordByWord(context) {
  if (!context) return null;
  const parts = splitOutsideParens(context);
  const components = [];
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    let token = part.slice(0, eq).trim();
    let gloss = part.slice(eq + 1).trim();
    // Strip prose prefix on the token (e.g. "At a café. fī" -> "fī"):
    const dotInToken = token.lastIndexOf('. ');
    if (dotInToken >= 0) token = token.slice(dotInToken + 2).trim();
    // Strip prose suffix on the gloss, but only when the next sentence starts
    // with a capital letter (so "lit. 'if you...'" stays intact while
    // "your (m). Lit. ..." gets cut):
    const sentenceBreak = gloss.match(/\.\s+(?=[A-Z])/);
    if (sentenceBreak && sentenceBreak.index > 0) {
      gloss = gloss.slice(0, sentenceBreak.index).trim();
    }
    gloss = gloss.replace(/\.$/, '').trim();
    if (!token || !gloss) continue;
    if (token.length > 30) continue;
    if (token.split(/\s+/).length > 3) continue;
    components.push({ token, gloss });
  }
  return components.length >= 2 ? components : null;
}

/** Split a string on top-level commas / semicolons only — commas inside
 *  parens (like "(subjunctive, no b-)") stay attached to their part. */
function splitOutsideParens(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (c === ',' || c === ';')) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  if (start < s.length) parts.push(s.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

/**
 * Engine drill: introduce the base pattern, then quiz on a few forms.
 */
export function engineDrill({ engine, settings, onDone }) {
  const root = el('div', { class: 'col' });

  // Step 0: base pattern intro.
  const intro = el('div', { class: 'card col' }, [
    el('div', { class: 'muted' }, `Engine · ${engine.name}`),
    el('h1', {}, engine.pattern),
    el('div', { class: 'ar lg' }, engine.arabicPattern),
    settings.showTransliteration ? el('div', { class: 'translit' }, engine.transliterationPattern) : null,
    engine.fushaNote ? el('div', { class: 'note fusha' }, `Fuṣḥā note: ${engine.fushaNote}`) : null,
  ]);
  root.append(intro);

  const queue = pickEngineDrills(engine, 5);
  let i = 0;
  const slot = el('div', { class: 'col' });
  root.append(slot);

  const startBtn = el('button', { class: 'primary', onclick: next }, queue.length ? `Drill ${queue.length} forms` : 'Done');
  intro.append(startBtn);

  function next() {
    if (i === 0) startBtn.remove();
    if (i >= queue.length) {
      clear(slot);
      slot.append(el('div', { class: 'card col' }, [
        el('h2', {}, 'Drill complete'),
        el('button', { class: 'primary', onclick: () => onDone() }, 'Continue'),
      ]));
      return;
    }
    const drill = queue[i++];
    clear(slot);
    slot.append(renderDrillStep(drill, settings, next));
  }

  if (queue.length === 0) {
    startBtn.textContent = 'Continue';
    startBtn.onclick = () => onDone();
  }

  return root;
}

function renderDrillStep(drill, settings, onNext) {
  const card = el('div', { class: 'card col' });
  card.append(el('div', { class: 'muted' }, drill.label));
  if (drill.context) card.append(el('div', { class: 'context' }, drill.context));
  card.append(el('h2', {}, drill.english));
  const answer = el('div', { class: 'col', hidden: true }, [
    el('div', { class: 'ar lg' }, drill.arabic),
    settings.showTransliteration ? el('div', { class: 'translit' }, drill.transliteration) : null,
    componentsBlock(drill),
    drill.pronunciationNote ? el('div', { class: 'note' }, `Pronunciation: ${drill.pronunciationNote}`) : null,
  ]);
  card.append(answer);
  const reveal = el('button', { class: 'primary', onclick: () => { answer.hidden = false; reveal.hidden = true; nextBtn.hidden = false; } }, 'Reveal');
  const nextBtn = el('button', { class: 'primary', hidden: true, onclick: onNext }, 'Next');
  card.append(reveal);
  card.append(nextBtn);
  return card;
}

function pickEngineDrills(engine, n) {
  const out = [];
  if (Array.isArray(engine.forms)) {
    for (const f of shuffle(engine.forms).slice(0, Math.min(n, engine.forms.length))) {
      out.push({ label: f.label, english: f.english, arabic: f.arabic, transliteration: f.transliteration, context: f.context, pronunciationNote: f.pronunciationNote, breakdown: f.breakdown });
    }
  }
  // Slot substitutions: replace [SLOT] with options
  if (out.length < n && Array.isArray(engine.slots)) {
    for (const s of engine.slots) {
      for (const opt of shuffle(s.options).slice(0, 2)) {
        if (out.length >= n) break;
        out.push({
          label: `Substitute ${s.name}`,
          english: engine.pattern.replace(`[${s.name}]`, opt.english),
          arabic: engine.arabicPattern.replace(`[${s.name}]`, opt.arabic),
          transliteration: engine.transliterationPattern.replace(`[${s.name}]`, opt.transliteration),
        });
      }
    }
  }
  return out;
}

// ---------------- Helpers ----------------

function phraseTags(phrase) {
  if (!phrase.tags || phrase.tags.length === 0) return [];
  return phrase.tags.map((t) => el('span', { class: 'tag' }, t));
}

function gradeBtn(kind, label, sub, onClick) {
  return el('button', { class: kind, onclick: onClick }, [
    el('span', {}, label),
    el('small', {}, sub),
  ]);
}

function buildRecorderBar() {
  const bar = el('div', { class: 'recbar' });
  let lastUrl = null;
  let recording = false;
  const recBtn = el('button', { class: 'ghost', onclick: toggle }, '● Record');
  const playBtn = el('button', { class: 'ghost', disabled: true, onclick: replay }, '▶ Play');
  const dot = el('span', { class: 'recdot', hidden: true });
  bar.append(recBtn, playBtn, dot);

  async function toggle() {
    if (!recording) {
      try {
        await recorder.startRecording();
        recording = true;
        recBtn.textContent = '■ Stop';
        dot.hidden = false;
      } catch (err) {
        recBtn.textContent = '● Record (mic blocked)';
      }
    } else {
      const out = await recorder.stopRecording();
      recording = false;
      dot.hidden = true;
      recBtn.textContent = '● Record';
      if (out) {
        lastUrl = out.url;
        playBtn.disabled = false;
      }
    }
  }
  function replay() {
    if (!lastUrl) return;
    new Audio(lastUrl).play();
  }
  return bar;
}

/**
 * Apply a grade to an item and persist.
 * Returns the new state (or null for engine/no-state items).
 */
export async function applyGrade(itemId, g, now = Date.now()) {
  if (itemId.startsWith('engine:')) return null;
  const cur = (await getState(itemId)) || { itemId, ease: 2.5, step: -1, intervalDays: 0, dueAt: 0, lapses: 0, repCount: 0, lastGrade: null, lastReviewedAt: 0 };
  const next = grade(cur, g, now);
  next.itemId = itemId;
  await putState(next);
  return next;
}
