// Data layer — IndexedDB wrapper, content loader, settings.
//
// Schema is set up for the full feature set even though early PRs only use
// `settings` + content. Later PRs fill in reviewState, savedArticles, userVocab.

/**
 * @typedef {Object} Settings
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} arabicFontSize
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} uiFontSize
 * @property {boolean} showHebrewCognates       // gloss popup includes Hebrew cognate
 * @property {boolean} showFamiliarityHints     // colour-code known/unknown words in Reader
 * @property {string[]} suspendedIds            // headwords hidden from reviews
 * @property {string} claudeApiKey              // Anthropic API key for auto-fill (local-only; excluded from export)
 * @property {boolean} autoSaveAiLookups        // skip the review step after AI fills the form
 */

/**
 * @typedef {Object} TapLogEntry
 * @property {string} headword        // the normalised token tapped on
 * @property {number} count           // how many times this token has been tapped
 * @property {number} firstTappedAt
 * @property {number} lastTappedAt
 * @property {boolean} inDict         // did the most recent tap find it in the dictionary?
 * @property {number|null} addedAt    // ms when the user added it via the popup; null if still unsaved
 */

/**
 * @typedef {Object} ReviewState
 * @property {string} itemId          // the unvocalized headword
 * @property {number} ease
 * @property {number} step
 * @property {number} intervalDays
 * @property {number} dueAt
 * @property {number} lapses
 * @property {number} repCount
 * @property {('again'|'hard'|'good'|'easy'|null)} lastGrade
 * @property {number} lastReviewedAt
 */

/**
 * @typedef {Object} DictEntry
 * @property {string} headword        // unvocalized; primary key
 * @property {string} vocalized       // with diacritics
 * @property {string} gloss           // English gloss
 * @property {string} [root]          // e.g. "k-t-b"
 * @property {string} [form]          // e.g. "Form I masdar", "Form IV active participle"
 * @property {string} [hebrew]        // Hebrew cognate (Hebrew letters + transliteration)
 * @property {string[]} [tags]
 * @property {('verified'|'draft')} [status]
 */

/**
 * @typedef {Object} SavedArticle
 * @property {string} id
 * @property {string} title
 * @property {string} sourceLabel     // free text — "BBC Arabic", "pasted on 2026-06-14"
 * @property {string[]} paragraphs    // unvocalized; line-broken
 * @property {number} createdAt
 */

// ---------------- IndexedDB wrapper ----------------

const DB_NAME = 'msa-reader';
const DB_VERSION = 2; // v2 adds 'tapLog' store

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('reviewState'))    db.createObjectStore('reviewState',    { keyPath: 'itemId' });
      if (!db.objectStoreNames.contains('userVocab'))      db.createObjectStore('userVocab',      { keyPath: 'headword' });
      if (!db.objectStoreNames.contains('savedArticles'))  db.createObjectStore('savedArticles',  { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings'))       db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('sessions'))       db.createObjectStore('sessions',       { keyPath: 'id' });
      if (!db.objectStoreNames.contains('tapLog'))         db.createObjectStore('tapLog',         { keyPath: 'headword' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(db, store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}
function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(store, key) { return wrap(tx(await openDb(), store).get(key)); }
async function dbPut(store, value, key) { return wrap(tx(await openDb(), store, 'readwrite').put(value, key)); }
async function dbDel(store, key) { return wrap(tx(await openDb(), store, 'readwrite').delete(key)); }
async function dbAll(store) { return wrap(tx(await openDb(), store).getAll()); }

// ---------------- Settings ----------------

export const DEFAULT_SETTINGS = /** @type {Settings} */ ({
  arabicFontSize: 'medium',
  uiFontSize: 'medium',
  showHebrewCognates: true,
  showFamiliarityHints: true,
  suspendedIds: [],
  claudeApiKey: '',
  autoSaveAiLookups: false,
});

export async function getSettings() {
  const s = await dbGet('settings', 'app');
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

export async function saveSettings(patch) {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await dbPut('settings', next, 'app');
  return next;
}

export async function suspendItem(id) {
  const cur = await getSettings();
  if ((cur.suspendedIds || []).includes(id)) return cur;
  return saveSettings({ suspendedIds: [...(cur.suspendedIds || []), id] });
}
export async function unsuspendItem(id) {
  const cur = await getSettings();
  return saveSettings({ suspendedIds: (cur.suspendedIds || []).filter((x) => x !== id) });
}
export async function unsuspendAll() {
  return saveSettings({ suspendedIds: [] });
}

// ---------------- Tap log (every popup view, hit or miss) ----------------

/** Record a tap on a token in the Reader. Idempotent within a session —
 *  re-tapping the same word increments the counter. */
export async function logTap(headword, inDict) {
  if (!headword) return;
  const now = Date.now();
  const cur = await dbGet('tapLog', headword);
  const next = cur
    ? { ...cur, count: cur.count + 1, lastTappedAt: now, inDict }
    : { headword, count: 1, firstTappedAt: now, lastTappedAt: now, inDict, addedAt: null };
  return dbPut('tapLog', next);
}

/** Mark a tap-log entry as resolved — user added the word to userVocab. */
export async function markTapAdded(headword) {
  const cur = await dbGet('tapLog', headword);
  if (!cur) return;
  return dbPut('tapLog', { ...cur, addedAt: Date.now() });
}

export async function listTapLog()  { return dbAll('tapLog'); }
export async function clearTapLog() {
  const db = await openDb();
  await new Promise((resolve) => {
    const req = db.transaction('tapLog', 'readwrite').objectStore('tapLog').clear();
    req.onsuccess = req.onerror = () => resolve();
  });
}

// ---------------- Export / import ----------------

const EXPORT_FORMAT = 'msa-reader-export-v1';

/** Serialize the entire IndexedDB (review state + user vocab + saved
 *  articles + settings) as a JSON snapshot the user can download.
 *  Doesn't include the bundled content (dictionary / graded / patterns)
 *  — those live in the repo. */
export async function exportSnapshot() {
  const [reviewState, userVocab, savedArticles, sessions, tapLog, settings] = await Promise.all([
    dbAll('reviewState'),
    dbAll('userVocab'),
    dbAll('savedArticles'),
    dbAll('sessions'),
    dbAll('tapLog'),
    getSettings(),
  ]);
  // Strip the API key — never leaves the device in a snapshot.
  const { claudeApiKey: _stripped, ...safeSettings } = settings;
  return {
    format: EXPORT_FORMAT,
    exportedAt: Date.now(),
    reviewState, userVocab, savedArticles, sessions, tapLog,
    settings: safeSettings,
  };
}

/** Restore from a snapshot. Replaces existing review state + user vocab
 *  + saved articles + sessions wholesale. Merges settings so newer
 *  defaults survive. */
export async function importSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== EXPORT_FORMAT) {
    throw new Error('Not a valid MSA Reader export.');
  }
  const db = await openDb();
  await Promise.all(['reviewState', 'userVocab', 'savedArticles', 'sessions', 'tapLog'].map((store) => new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(store)) { resolve(); return; }
    const txn = db.transaction(store, 'readwrite');
    const os = txn.objectStore(store);
    os.clear();
    for (const item of (snapshot[store] || [])) os.put(item);
    txn.oncomplete = () => resolve();
    txn.onerror = () => reject(txn.error);
  })));
  if (snapshot.settings) {
    // Preserve any API key already on this device — imports never overwrite it.
    const cur = await getSettings();
    await saveSettings({ ...snapshot.settings, claudeApiKey: cur.claudeApiKey });
  }
  return {
    reviewStates: (snapshot.reviewState || []).length,
    userVocab: (snapshot.userVocab || []).length,
    savedArticles: (snapshot.savedArticles || []).length,
    sessions: (snapshot.sessions || []).length,
    tapLog: (snapshot.tapLog || []).length,
  };
}

/** Wipe review state + user vocab + saved articles + sessions. Settings
 *  preserved. Used by the Reset button in Settings. */
export async function resetProgress() {
  const db = await openDb();
  await Promise.all(['reviewState', 'userVocab', 'savedArticles', 'sessions', 'tapLog'].map((store) => new Promise((resolve) => {
    if (!db.objectStoreNames.contains(store)) { resolve(); return; }
    const req = db.transaction(store, 'readwrite').objectStore(store).clear();
    req.onsuccess = req.onerror = () => resolve();
  })));
}

// ---------------- Review state (stubs — used from PR 3) ----------------

export async function getState(itemId)  { return (await dbGet('reviewState', itemId)) || null; }
export async function putState(state)   { return dbPut('reviewState', state); }
export async function allStates()       { return dbAll('reviewState'); }
export async function deleteState(id)   { return dbDel('reviewState', id); }

// ---------------- User vocab + saved articles (used from PR 2/4) ----------------

export async function addUserVocab(entry)      { return dbPut('userVocab', entry); }
export async function listUserVocab()          { return dbAll('userVocab'); }
export async function saveArticle(article)     { return dbPut('savedArticles', article); }
export async function listSavedArticles()      { return dbAll('savedArticles'); }
export async function deleteSavedArticle(id)   { return dbDel('savedArticles', id); }

// ---------------- Content loader ----------------

/**
 * Load bundled content. Dictionary lands in PR 2, graded articles in PR 4,
 * patterns in PR 5.
 * @returns {Promise<{dictionary: DictEntry[], graded: SavedArticle[], warnings: string[]}>}
 */
export async function loadContent() {
  const warnings = [];
  const [dictionary, graded, patterns] = await Promise.all([
    fetchJson('./content/dictionary.json', warnings),
    fetchJson('./content/graded.json', warnings),
    fetchJson('./content/patterns.json', warnings),
  ]);
  return { dictionary, graded, patterns, warnings };
}

async function fetchJson(url, warnings) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.items || [];
  } catch (err) {
    warnings.push(`Failed to load ${url}: ${err.message}`);
    return [];
  }
}
