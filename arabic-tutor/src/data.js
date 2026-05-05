// Data layer — schema typedefs (JSDoc), IndexedDB wrapper, content loader.

/**
 * @typedef {Object} ReviewState
 * @property {string} itemId
 * @property {number} ease
 * @property {number} step
 * @property {number} intervalDays
 * @property {number} dueAt           // epoch ms
 * @property {number} lapses
 * @property {number} repCount
 * @property {('again'|'hard'|'good'|'easy'|null)} lastGrade
 * @property {number} lastReviewedAt
 */

/**
 * @typedef {Object} EngineForm
 * @property {string} key                 // e.g. "1sg.m.pres"
 * @property {string} label               // human label, e.g. "I (m), present"
 * @property {string} arabic
 * @property {string} transliteration
 * @property {string} english
 * @property {string} [context]           // when do you say this? e.g. "Reply to: ṣabāḥ il-khēr"
 * @property {string} [pronunciationNote]
 */

/**
 * @typedef {Object} EngineSlot
 * @property {string} name                // e.g. "OBJECT"
 * @property {Array<{arabic:string,transliteration:string,english:string}>} options
 */

/**
 * @typedef {Object} SentenceEngine
 * @property {string} id
 * @property {string} name                // English shorthand
 * @property {string} pattern             // English template, e.g. "I want [OBJECT]"
 * @property {string} arabicPattern       // Arabic template with [SLOT] markers
 * @property {string} transliterationPattern
 * @property {string} [fushaNote]
 * @property {EngineForm[]} forms
 * @property {EngineSlot[]} [slots]
 * @property {string[]} [tags]
 * @property {('draft'|'verified')} [status]
 */

/**
 * @typedef {Object} PhraseCard
 * @property {string} id
 * @property {string} arabic
 * @property {string} transliteration
 * @property {string} english
 * @property {string} [context]           // when do you say this? — shown above the english prompt
 * @property {string} [pronunciationNote]
 * @property {string} [fushaNote]
 * @property {string[]} [tags]            // scenario slugs, formality, etc.
 * @property {boolean} [rescue]           // small set of high-priority rescue phrases
 * @property {('draft'|'verified')} [status]
 */

/**
 * @typedef {Object} Scenario
 * @property {string} id                  // slug, e.g. "drivers"
 * @property {string} name                // "Drivers / taxi"
 * @property {string} description
 * @property {string[]} engineIds         // related engines
 * @property {string[]} phraseIds         // related phrases
 * @property {number} [priority]          // 1 = top, higher = lower priority
 */

/**
 * @typedef {Object} UserPhrase
 * @property {string} id
 * @property {string} english
 * @property {string} [arabic]
 * @property {string} [transliteration]
 * @property {string} [scenario]
 * @property {('high'|'normal')} [priority]
 * @property {number} createdAt
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} showTransliteration
 * @property {boolean} showHebrewHooks
 * @property {('slow'|'normal'|'fast')} newItemSpeed
 * @property {boolean} mixRecognition       // if true, ~25% of cards become Arabic→English instead of English→Arabic
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} arabicFontSize
 * @property {('xxsmall'|'xsmall'|'small'|'medium'|'large'|'xlarge')} uiFontSize
 * @property {string[]} scenarioPriority    // scenario ids in priority order
 */

// ---------------- IndexedDB wrapper ----------------

const DB_NAME = 'arabic-tutor';
const DB_VERSION = 1;
const STORES = ['reviewState', 'userPhrases', 'settings', 'sessions'];

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('reviewState')) db.createObjectStore('reviewState', { keyPath: 'itemId' });
      if (!db.objectStoreNames.contains('userPhrases')) db.createObjectStore('userPhrases', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
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

export async function dbGet(store, key) {
  const db = await openDb();
  return wrap(tx(db, store).get(key));
}

export async function dbPut(store, value, key) {
  const db = await openDb();
  return wrap(tx(db, store, 'readwrite').put(value, key));
}

export async function dbDel(store, key) {
  const db = await openDb();
  return wrap(tx(db, store, 'readwrite').delete(key));
}

export async function dbAll(store) {
  const db = await openDb();
  return wrap(tx(db, store).getAll());
}

// ---------------- Settings ----------------

export const DEFAULT_SETTINGS = /** @type {Settings} */ ({
  showTransliteration: true,
  showHebrewHooks: false,
  newItemSpeed: 'normal',
  mixRecognition: false,
  arabicFontSize: 'medium',
  uiFontSize: 'medium',
  scenarioPriority: ['rescue', 'drivers', 'shops', 'kids', 'family', 'work'],
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

// ---------------- Review state ----------------

export async function getState(itemId) {
  return (await dbGet('reviewState', itemId)) || null;
}

export async function putState(state) {
  return dbPut('reviewState', state);
}

export async function allStates() {
  return dbAll('reviewState');
}

// ---------------- User phrases ----------------

export async function addUserPhrase(p) {
  await dbPut('userPhrases', p);
  return p;
}
export async function listUserPhrases() {
  return dbAll('userPhrases');
}
export async function deleteUserPhrase(id) {
  return dbDel('userPhrases', id);
}

// ---------------- Sessions log ----------------

export async function logSession(s) {
  return dbPut('sessions', s);
}
export async function listSessions() {
  return dbAll('sessions');
}

// ---------------- Content loader ----------------

/**
 * @returns {Promise<{engines: SentenceEngine[], phrases: PhraseCard[], scenarios: Scenario[], warnings: string[]}>}
 */
export async function loadContent() {
  const warnings = [];
  const [engines, phrases, scenarios] = await Promise.all([
    fetchJson('./content/engines.json', warnings),
    fetchJson('./content/phrases.json', warnings),
    fetchJson('./content/scenarios.json', warnings),
  ]);
  validate(engines, ['id', 'name', 'pattern', 'arabicPattern', 'forms'], 'engine', warnings);
  validate(phrases, ['id', 'arabic', 'transliteration', 'english'], 'phrase', warnings);
  validate(scenarios, ['id', 'name'], 'scenario', warnings);
  return { engines, phrases, scenarios, warnings };
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

function validate(items, required, kind, warnings) {
  for (const item of items) {
    for (const k of required) {
      if (item[k] == null || item[k] === '') {
        warnings.push(`${kind} ${item.id || '(no id)'} missing ${k}`);
        break;
      }
    }
  }
}

/**
 * Combine library phrases + user phrases that have arabic filled in
 * into a single review pool.
 */
export async function reviewPool(content) {
  const userPhrases = await listUserPhrases();
  const userReady = userPhrases
    .filter((u) => u.arabic && u.transliteration)
    .map((u) => ({
      id: `user:${u.id}`,
      arabic: u.arabic,
      transliteration: u.transliteration,
      english: u.english,
      tags: u.scenario ? [u.scenario] : [],
      status: 'verified',
    }));
  return {
    phrases: [...content.phrases, ...userReady],
    engines: content.engines,
    scenarios: content.scenarios,
  };
}
