// Session planner. Pure function over content + review states.
//
// Output: ordered queue of { itemId, kind, payload? } where kind is one of:
//   recall          — phrase recall card (includes engine forms, which the
//                     pool expands into phrase-shaped items)
//   new_intro       — new item introduction (counts toward new-item budget)
//   scenario_drill  — item pulled by scenario priority
//
// Quotas per PRD §10.2 (per-minute targets, soft). Slots previously reserved
// for the block engine_drill have been reabsorbed into reviewSlots — engine
// forms now flow through the same recall channel as phrases.
//   3min  : 7 items, weak focus
//   7min  : 14 items + up to 2 new + 2 scenario items
//   10min : 18 items + up to 3 new + 4 scenario items
//   15min : 25 items + up to 5 new + 6 scenario items

import { isDue, isNew, weakness, isWeak, isStrong } from './scheduler.js';
import { shuffle } from './util.js';

/** Tokenize a transliteration into atomic lexical pieces. Splits on
 *  whitespace and on clitic-hyphens (the scheme writes "il-bēt", "biddak",
 *  "-ak") so each morpheme can be checked for familiarity independently.
 *  Diacritics are preserved (kīf stays kīf — direct == against itself). */
function tokenize(translit) {
  if (!translit) return [];
  return translit.toLowerCase()
    .replace(/[?!.,;:'"()…]/g, '')
    .split(/[\s\-]+/)
    .filter((t) => t.length > 0);
}

const QUOTAS = {
  3:  { total: 7,  newMax: 1, scenarioMax: 1 },
  7:  { total: 14, newMax: 2, scenarioMax: 2 },
  10: { total: 18, newMax: 3, scenarioMax: 4 },
  15: { total: 25, newMax: 5, scenarioMax: 6 },
};

/**
 * @param {number} minutes
 * @param {{engines:any[], phrases:any[], scenarios:any[]}} content
 * @param {(id:string)=>(any|null)} stateFor
 * @param {{scenarioPriority:string[], newItemSpeed:string, mixRecognition?:boolean}} settings
 * @param {number} [now]
 * @param {string|null} [scope]   // optional scenario id to scope the session to
 */
export function plan(minutes, content, stateFor, settings, now = Date.now(), scope = null) {
  const suspended = new Set(settings.suspendedIds || []);
  if (scope || suspended.size > 0) {
    content = {
      ...content,
      phrases: content.phrases
        .filter((p) => !suspended.has(p.id))
        .filter((p) => !scope || (p.tags || []).includes(scope)),
      engines: scope ? content.engines.filter((e) => (e.tags || []).includes(scope)) : content.engines,
    };
  }
  const quota = QUOTAS[minutes] || QUOTAS[10];
  const speedAdj = settings.newItemSpeed === 'fast' ? 1.5
    : settings.newItemSpeed === 'slow' ? 0.5
    : settings.newItemSpeed === 'none' ? 0
    : 1;

  const due = [];
  const newItems = [];
  // Build the "known tokens" set as we walk the pool: any item the user has
  // touched contributes its transliteration tokens. Used below to defer new
  // phrases whose words are still unfamiliar — the i+4 wall the user was
  // complaining about.
  const knownTokens = new Set();
  let itemsWithHistory = 0;
  for (const p of content.phrases) {
    const st = stateFor(p.id);
    if (isNew(st)) {
      newItems.push(p);
    } else {
      if (isDue(st, now)) due.push({ p, st });
      if (st && st.repCount > 0) {
        itemsWithHistory++;
        for (const tok of tokenize(p.transliteration)) knownTokens.add(tok);
      }
    }
  }

  // Sort due by weakness desc then dueAt asc
  due.sort((a, b) => weakness(b.st) - weakness(a.st) || (a.st?.dueAt || 0) - (b.st?.dueAt || 0));

  // Adaptive new-item throttle: when many due items are already weak
  // (recent again/hard grades), drop new-item introductions so the session
  // can consolidate what's struggling rather than piling more on top.
  // Stacks on newItemSpeed.
  const weakDueCount = due.filter((d) => isWeak(d.st)).length;
  const throttle = Math.floor(weakDueCount / 4);
  const newMax = Math.max(0, Math.round(quota.newMax * speedAdj) - throttle);

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
  // 1. Reviews (most-needed first), leaving room for newMax intros.
  const reviewSlots = Math.max(0, quota.total - newMax);
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

  // 3. New introductions, capped by newMax.
  // Component-aware ranking: prefer phrases whose transliteration tokens are
  // mostly already in knownTokens. Once you have a meaningful history (>20
  // items reviewed), defer phrases with 3+ unfamiliar tokens — that's the
  // cognitive-load wall. Falls back to the full pool if filtering would
  // leave us with too few candidates so the session is never empty.
  if (newMax > 0 && newItems.length > 0) {
    const annotated = newItems.map((p) => {
      const toks = tokenize(p.transliteration);
      const unfamiliar = toks.filter((t) => !knownTokens.has(t)).length;
      return { p, score: scenarioScore(p), unfamiliar };
    });
    const useThreshold = itemsWithHistory > 20;
    let candidates = annotated;
    if (useThreshold) {
      const filtered = annotated.filter((x) => x.unfamiliar <= 2);
      candidates = filtered.length >= newMax ? filtered : annotated;
    }
    const ranked = candidates.sort((a, b) =>
      a.score - b.score || a.unfamiliar - b.unfamiliar
    );
    for (let i = 0; i < newMax && i < ranked.length; i++) {
      queue.push({ itemId: ranked[i].p.id, kind: 'new_intro', payload: ranked[i].p });
    }
  }

  // 4. If still under quota, top up with more reviews (less weak).
  if (queue.length < quota.total) {
    const inQueue = new Set(queue.map((q) => q.itemId));
    for (const { p } of due) {
      if (queue.length >= quota.total) break;
      if (!inQueue.has(p.id)) queue.push({ itemId: p.id, kind: 'recall', payload: p });
    }
  }

  // 5. Last-resort fallback: if the queue is still very small (e.g. 3-min when
  //    nothing is due, or a scoped session in a scenario you've already
  //    cleared today), top up with new-item intros so the session isn't empty.
  //    Sort by familiarity too so this fallback picks easier-to-absorb items
  //    rather than the same wall-of-new phrases the new-intro filter rejected.
  const minTarget = Math.min(quota.total, Math.max(3, Math.floor(quota.total / 2)));
  if (queue.length < minTarget && newItems.length > 0) {
    const inQueue = new Set(queue.map((q) => q.itemId));
    const ranked = newItems
      .filter((p) => !inQueue.has(p.id))
      .map((p) => ({
        p,
        score: scenarioScore(p),
        unfamiliar: tokenize(p.transliteration).filter((t) => !knownTokens.has(t)).length,
      }))
      .sort((a, b) => a.score - b.score || a.unfamiliar - b.unfamiliar);
    for (const { p } of ranked) {
      if (queue.length >= minTarget) break;
      queue.push({ itemId: p.id, kind: 'new_intro', payload: p });
    }
  }

  // Light shuffle within kinds to avoid monotony, but keep new items spaced out.
  const ordered = interleave(queue);
  return settings.mixRecognition ? sprinkleRecognition(ordered) : ordered;
}

// Flip ~25% of recall/scenario items to ar→en recognition mode so the user
// also exercises the receptive direction. Keep new_intro and engine_drill alone.
function sprinkleRecognition(queue, fraction = 0.25) {
  const flippable = queue.filter((q) => q.kind === 'recall' || q.kind === 'scenario_drill');
  if (flippable.length === 0) return queue;
  const target = Math.max(1, Math.round(flippable.length * fraction));
  const picked = new Set(shuffle(flippable).slice(0, target).map((q) => q.itemId));
  return queue.map((q) => picked.has(q.itemId) ? { ...q, kind: 'recognize' } : q);
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

export function summarize(content, stateFor, now = Date.now(), scope = null, suspendedIds = null) {
  const suspended = suspendedIds ? new Set(suspendedIds) : null;
  const phrases = content.phrases.filter((p) => {
    if (suspended && suspended.has(p.id)) return false;
    if (scope && !(p.tags || []).includes(scope)) return false;
    return true;
  });
  let due = 0, weak = 0, fresh = 0, strong = 0, seen = 0;
  for (const p of phrases) {
    const st = stateFor(p.id);
    if (isNew(st)) { fresh++; continue; }
    seen++;
    if (isDue(st, now)) due++;
    if (isWeak(st)) weak++;
    if (isStrong(st)) strong++;
  }
  return { due, weak, fresh, strong, seen, total: phrases.length };
}
