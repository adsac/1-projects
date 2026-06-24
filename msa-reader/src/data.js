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
const DB_VERSION = 1;

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
  const dictionary = await fetchJson('./content/dictionary.json', warnings);
  return { dictionary, graded: [], warnings };
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
