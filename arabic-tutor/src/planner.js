// Session planner. Pure function over content + review states.
//
// Output: ordered queue of { itemId, kind, payload? } where kind is one of:
//   recall          — phrase recall card
//   engine_drill    — engine slot/form drill
//   new_intro       — new phrase introduction (counts toward new-item budget)
//   scenario_drill  — phrase pulled by scenario priority
//
// Quotas per PRD §10.2 (per-minute targets, soft):
//   3min  : 7 items, weak focus
//   7min  : 14 items + up to 2 new
//   10min : 18 items + up to 3 new + 4 scenario items
//   15min : 25 items + up to 5 new + 6 scenario items + 1 engine drill block

import { isDue, isNew, weakness, newState } from './scheduler.js';
import { shuffle, pick } from './util.js';

const QUOTAS = {
  3:  { total: 7,  newMax: 0, scenarioMax: 0, engineMax: 0 },
  7:  { total: 14, newMax: 2, scenarioMax: 2, engineMax: 1 },
  10: { total: 18, newMax: 3, scenarioMax: 4, engineMax: 1 },
  15: { total: 25, newMax: 5, scenarioMax: 6, engineMax: 2 },
};

/**
 * @param {number} minutes
 * @param {{engines:any[], phrases:any[], scenarios:any[]}} content
 * @param {(id:string)=>(any|null)} stateFor
 * @param {{scenarioPriority:string[], newItemSpeed:string}} settings
 */
export function plan(minutes, content, stateFor, settings, now = Date.now()) {
  const quota = QUOTAS[minutes] || QUOTAS[10];
  const speedAdj = settings.newItemSpeed === 'fast' ? 1.5 : settings.newItemSpeed === 'slow' ? 0.5 : 1;
  const newMax = Math.round(quota.newMax * speedAdj);

  const due = [];
  const newItems = [];
  for (const p of content.phrases) {
    const st = stateFor(p.id);
    if (isNew(st)) newItems.push(p);
    else if (isDue(st, now)) due.push({ p, st });
  }

  // Sort due by weakness desc then dueAt asc
  due.sort((a, b) => weakness(b.st) - weakness(a.st) || (a.st?.dueAt || 0) - (b.st?.dueAt || 0));

  // Scenario boost: items tagged with high-priority scenarios sort first within same weakness.
  const scenarioRank = new Map(settings.scenarioPriority.map((s, i) => [s, i]));
  function scenarioScore(item) {
    if (!item.tags) return 99;
    let best = 99;
    for (const t of item.tags) {
      if (scenarioRank.has(t)) best = Math.min(best, scenarioRank.get(t));
    }
    return best;
  }

  // Build the queue.
  const queue = [];
  // 1. Reviews (most-needed first), capped to total - newMax - engineMax slots.
  const reviewSlots = Math.max(0, quota.total - newMax - quota.engineMax);
  for (const { p } of due.slice(0, reviewSlots)) {
    queue.push({ itemId: p.id, kind: 'recall', payload: p });
  }

  // 2. Scenario items: pull top-priority phrases that are not already in queue.
  if (quota.scenarioMax > 0) {
    const inQueue = new Set(queue.map((q) => q.itemId));
    const scenarioPool = content.phrases
      .filter((p) => !inQueue.has(p.id))
      .map((p) => ({ p, score: scenarioScore(p), st: stateFor(p.id) }))
      .filter((x) => !isNew(x.st)) // already-seen scenario items
      .sort((a, b) => a.score - b.score || weakness(b.st) - weakness(a.st))
      .slice(0, quota.scenarioMax);
    for (const { p } of scenarioPool) {
      queue.push({ itemId: p.id, kind: 'scenario_drill', payload: p });
    }
  }

  // 3. Engine drill block(s): pick an engine the user has touched at least once,
  //    or the first engine in scenario-priority order if cold start.
  if (quota.engineMax > 0 && content.engines.length > 0) {
    const ranked = content.engines
      .map((e) => ({ e, score: scenarioScore(e) }))
      .sort((a, b) => a.score - b.score);
    for (let i = 0; i < quota.engineMax && i < ranked.length; i++) {
      const e = ranked[i].e;
      queue.push({ itemId: `engine:${e.id}`, kind: 'engine_drill', payload: e });
    }
  }

  // 4. New introductions, capped by newMax.
  if (newMax > 0 && newItems.length > 0) {
    const ranked = newItems
      .map((p) => ({ p, score: scenarioScore(p) }))
      .sort((a, b) => a.score - b.score);
    for (let i = 0; i < newMax && i < ranked.length; i++) {
      queue.push({ itemId: ranked[i].p.id, kind: 'new_intro', payload: ranked[i].p });
    }
  }

  // 5. If still under quota, top up with more reviews (less weak).
  if (queue.length < quota.total) {
    const inQueue = new Set(queue.map((q) => q.itemId));
    for (const { p } of due) {
      if (queue.length >= quota.total) break;
      if (!inQueue.has(p.id)) queue.push({ itemId: p.id, kind: 'recall', payload: p });
    }
  }

  // Light shuffle within kinds to avoid monotony, but keep new items spaced out.
  return interleave(queue);
}

function interleave(queue) {
  const news = queue.filter((q) => q.kind === 'new_intro');
  const rest = shuffle(queue.filter((q) => q.kind !== 'new_intro'));
  if (news.length === 0) return rest;
  const out = [];
  const stride = Math.max(2, Math.floor(rest.length / (news.length + 1)));
  let ni = 0;
  for (let i = 0; i < rest.length; i++) {
    out.push(rest[i]);
    if (ni < news.length && (i + 1) % stride === 0) out.push(news[ni++]);
  }
  while (ni < news.length) out.push(news[ni++]);
  return out;
}

export function summarize(content, stateFor, now = Date.now()) {
  let due = 0, weak = 0, fresh = 0, strong = 0;
  for (const p of content.phrases) {
    const st = stateFor(p.id);
    if (isNew(st)) { fresh++; continue; }
    if (isDue(st, now)) due++;
    if (weakness(st) >= 3) weak++;
    if (st && st.intervalDays >= 7 && st.lastGrade !== 'again') strong++;
  }
  return { due, weak, fresh, strong, total: content.phrases.length };
}
