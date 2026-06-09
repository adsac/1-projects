// Practice controllers — pure session-state machine + view-builders.
// The controllers return DOM nodes; mutation flows via callbacks back into the session.

import { el, clear, shuffle } from './util.js';
import { grade, previewIntervals } from './scheduler.js';
import { putState, getState } from './data.js';
import * as recorder from './recorder.js';

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
    el('div', { class: 'muted' }, phraseTags(phrase)),
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
    ...tags,
  ]));
  root.append(el('div', { class: 'ar lg' }, phrase.arabic));
  if (settings.showTransliteration) {
    root.append(el('div', { class: 'translit' }, phrase.transliteration));
  }

  const answer = el('div', { class: 'col', hidden: true }, [
    el('h2', {}, phrase.english),
    phrase.context ? el('div', { class: 'context' }, phrase.context) : null,
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
 * New-item introduction: show everything up front, user taps "Got it" to enter the review chain.
 */
export function newIntro({ phrase, settings, onContinue, onSuspend }) {
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
      out.push({ label: f.label, english: f.english, arabic: f.arabic, transliteration: f.transliteration, context: f.context, pronunciationNote: f.pronunciationNote });
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
