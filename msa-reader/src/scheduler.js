// SM-2 lite scheduler — pure functions.
// Same shape as the Levantine app's scheduler; recognition-only here, so
// items are always Arabic-headword → reveal-gloss. No production direction.
//
// Grade semantics:
//   again — reset; see again later this session
//   hard  — slight ease drop, small interval bump
//   good  — climb the interval ladder by ease
//   easy  — bigger ease bump, skip a step
//
// Interval ladder for the first reps: 1, 3, 7, 14, 30 days. After step 4
// we let ease compound the previous interval.

import { day } from './util.js';

const STEPS_DAYS = [1, 3, 7, 14, 30];
const EASE_DEFAULT = 2.5;
const EASE_MIN = 1.3;
const EASE_MAX = 3.0;

export function newState(itemId) {
  return {
    itemId,
    ease: EASE_DEFAULT,
    step: -1,
    intervalDays: 0,
    dueAt: 0,
    lapses: 0,
    repCount: 0,
    lastGrade: null,
    lastReviewedAt: 0,
  };
}

/** @param {('again'|'hard'|'good'|'easy')} g */
export function grade(state, g, now = Date.now()) {
  const s = state ? { ...state } : newState('');
  s.repCount += 1;
  s.lastGrade = g;
  s.lastReviewedAt = now;

  if (g === 'again') {
    s.lapses += 1;
    s.step = -1;
    s.ease = Math.max(EASE_MIN, s.ease - 0.2);
    s.intervalDays = 0;
    s.dueAt = now;
    return s;
  }
  if (g === 'hard') {
    s.ease = Math.max(EASE_MIN, s.ease - 0.15);
    s.step = Math.max(0, s.step);
    const base = STEPS_DAYS[Math.min(s.step, STEPS_DAYS.length - 1)] || 1;
    s.intervalDays = Math.max(1, Math.ceil(base * 0.8));
  } else if (g === 'good') {
    s.step = Math.min(STEPS_DAYS.length - 1, s.step + 1);
    if (s.step < STEPS_DAYS.length - 1 || s.intervalDays === 0) {
      s.intervalDays = STEPS_DAYS[s.step];
    } else {
      s.intervalDays = Math.max(STEPS_DAYS[s.step], Math.ceil(s.intervalDays * s.ease));
    }
  } else if (g === 'easy') {
    s.ease = Math.min(EASE_MAX, s.ease + 0.15);
    s.step = Math.min(STEPS_DAYS.length - 1, s.step + 2);
    const base = STEPS_DAYS[s.step];
    s.intervalDays = Math.max(base, Math.ceil((s.intervalDays || base) * s.ease * 1.3));
  }
  s.dueAt = now + s.intervalDays * day;
  return s;
}

export function isDue(state, now = Date.now()) {
  if (!state || state.dueAt == null) return true;
  return state.dueAt <= now;
}

export function isNew(state) {
  return !state || state.repCount === 0;
}

/** Higher = weaker, prioritise. */
export function weakness(state) {
  if (!state) return 0;
  let w = state.lapses * 2;
  if (state.lastGrade === 'again') w += 3;
  else if (state.lastGrade === 'hard') w += 1;
  if (state.ease < 2.0) w += 1;
  return w;
}

/** Honest interval hints for the grade buttons. */
export function previewIntervals(state, now = Date.now()) {
  return {
    again: grade(state, 'again', now).intervalDays,
    hard:  grade(state, 'hard',  now).intervalDays,
    good:  grade(state, 'good',  now).intervalDays,
    easy:  grade(state, 'easy',  now).intervalDays,
  };
}
