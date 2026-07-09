// Shared daily streak across the Arabic apps (arabic-tutor + msa-reader).
//
// Both apps are served from the same origin (adsac.github.io), so
// localStorage is the bridge — each app writes its own flag for today and
// reads the combined picture. A day counts toward the streak if EITHER app
// saw a completed session; the per-app flags let the home screens show
// which half of the routine is still open.
//
// This file is duplicated verbatim in both apps (they are deliberately
// self-contained). If you change it here, mirror the change in the other
// app's src/streak.js.

const KEY = 'arabic-shared-streak-v1';
const KEEP_DAYS = 550;

/** Local-date key (not UTC — a late-evening session should count for the
 *  calendar day the user experienced). */
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw.days === 'object' && raw.days !== null) return raw;
  } catch { /* corrupted or unavailable — start fresh */ }
  return { days: {} };
}

/**
 * Mark today as active for one app.
 * @param {('tutor'|'msa')} appId
 */
export function recordActivity(appId, now = new Date()) {
  const data = load();
  const k = dayKey(now);
  data.days[k] = { ...(data.days[k] || {}), [appId]: true };
  const keys = Object.keys(data.days).sort();
  while (keys.length > KEEP_DAYS) delete data.days[keys.shift()];
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode etc. */ }
}

/**
 * Current combined streak. A day with activity in either app counts.
 * If today has no activity yet, the streak from yesterday still stands
 * (you haven't broken it — you just haven't extended it).
 * @returns {{current:number, today:{tutor:boolean, msa:boolean}}}
 */
export function streakInfo(now = new Date()) {
  const days = load().days;
  const today = days[dayKey(now)] || {};
  const cursor = new Date(now);
  if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days[dayKey(cursor)]) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, today: { tutor: !!today.tutor, msa: !!today.msa } };
}
