// Data layer — IndexedDB wrapper, content loader, settings.
//
// Schema is set up for the full feature set even though PR 1 only uses
// `settings`. Later PRs fill in reviewState, savedArticles, userVocab.

/**
 * @typedef {Object} Settings
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} arabicFontSize
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} uiFontSize
 * @property {boolean} showHebrewCognates       // gloss popup includes Hebrew cognate
 * @property {boolean} showFamiliarityHints     // colour-code known/unknown words in Reader
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
 * @property {string} [form]          // e.g. "I masdar", "II active participle"
 * @property {string} [hebrew]        // Hebrew cognate (no nikkud needed)
 * @property {string[]} [tags]
 * @property {('verified'|'draft')} [status]
 */

/**
 * @typedef {Object} SavedArticle
 * @property {string} id
 * @property {string} title
 * @property {string} sourceLabel     // free text — "BBC Arabic", "pasted on 2026-06-14"
 * @property {string[]} paragraphs    // unvocalized; line-broken into paragraphs
 * @property {string[][]} [tokens]    // optional pre-tokenized form per paragraph
 * @property {number} createdAt
 */

// ---------------- IndexedDB wrapper ----------------

const DB_NAME = 'arabic-newspaper';
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

// ---------------- Review state (stubs — used from PR 3) ----------------

export async function getState(itemId)  { return (await dbGet('reviewState', itemId)) || null; }
export async function putState(state)   { return dbPut('reviewState', state); }
export async function allStates()       { return dbAll('reviewState'); }
export async function deleteState(id)   { return dbDel('reviewState', id); }

// ---------------- User vocab + saved articles (stubs — used from PR 2/4) ----------------

export async function addUserVocab(entry)      { return dbPut('userVocab', entry); }
export async function listUserVocab()          { return dbAll('userVocab'); }
export async function saveArticle(article)     { return dbPut('savedArticles', article); }
export async function listSavedArticles()      { return dbAll('savedArticles'); }
export async function deleteSavedArticle(id)   { return dbDel('savedArticles', id); }

// ---------------- Content loader ----------------

/**
 * Loads bundled content. PR 1 returns empty arrays — PR 2 fills dictionary,
 * PR 4 fills graded articles, PR 5 fills patterns.
 * @returns {Promise<{dictionary: DictEntry[], graded: SavedArticle[], warnings: string[]}>}
 */
export async function loadContent() {
  const warnings = [];
  return { dictionary: [], graded: [], warnings };
}
