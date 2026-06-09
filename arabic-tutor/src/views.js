// All view renderers. Each render* function mounts into #app.

import { $, el, clear, fmtRelative, toast, uid } from './util.js';
import * as data from './data.js';
import * as scheduler from './scheduler.js';
import * as practice from './practice.js';
import { plan, summarize } from './planner.js';
import { navigate } from './router.js';
import * as recorder from './recorder.js';

let app = {
  /** @type {{engines:any[], phrases:any[], scenarios:any[], warnings:string[]}} */
  content: { engines: [], phrases: [], scenarios: [], warnings: [] },
  /** @type {any} */
  settings: data.DEFAULT_SETTINGS,
  /** @type {Map<string, any>} */
  states: new Map(),
};

export function setApp(next) {
  app = next;
}

export async function refreshStates() {
  const all = await data.allStates();
  app.states = new Map(all.map((s) => [s.itemId, s]));
}

function stateFor(id) { return app.states.get(id) || null; }

function mount(node) {
  const root = $('#app');
  clear(root);
  root.append(node);
  window.scrollTo(0, 0);
}

function appbar(title, opts = {}) {
  return el('div', { class: 'appbar' }, [
    opts.back !== false ? el('button', { class: 'ghost', onclick: () => navigate(opts.backTo || '/') }, '←') : null,
    el('div', { class: 'title' }, title),
    el('div', { class: 'spacer' }),
    opts.right || null,
  ]);
}

function warningsBanner() {
  if (!app.content.warnings || app.content.warnings.length === 0) return null;
  return el('div', { class: 'banner warn' }, [
    el('div', {}, [
      el('strong', {}, 'Content warnings: '),
      `${app.content.warnings.length} item(s) need attention. `,
      el('a', { href: '#/browser' }, 'Review'),
    ]),
  ]);
}

// ---------------- Home ----------------

export async function renderHome() {
  await refreshStates();
  const pool = await data.reviewPool(app.content);
  const sum = summarize(pool, stateFor, Date.now(), null, app.settings.suspendedIds);

  const root = el('div', { class: 'col' });
  root.append(el('div', { class: 'appbar' }, [
    el('div', { class: 'title' }, 'Arabic Tutor'),
    el('div', { class: 'spacer' }),
    el('a', { href: '#/settings' }, 'Settings'),
  ]));

  const w = warningsBanner();
  if (w) root.append(w);

  root.append(el('div', { class: 'card' }, [
    el('div', { class: 'muted' }, [
      `${sum.due} due · `,
      `${sum.weak} weak · `,
      `${sum.fresh} new available · `,
      `${sum.strong} strong`,
    ]),
  ]));

  const tile = (mins, hint) => el('button', { class: 'tile', onclick: () => navigate(`/practice/${mins}`) }, [
    el('span', { class: 'big' }, `${mins} min`),
    el('small', {}, hint),
  ]);
  root.append(el('div', { class: 'grid-2' }, [
    tile(3, 'quick triage of weak items'),
    tile(7, 'reviews + 1–2 new'),
    tile(10, 'reviews + new + scenario'),
    tile(15, 'full mix + engine drills'),
  ]));

  root.append(el('div', { class: 'col' }, [
    el('h2', {}, 'Shortcuts'),
    el('div', { class: 'grid-2' }, [
      el('button', { class: 'tile', onclick: () => navigate('/scenarios') }, [el('span', { class: 'big' }, 'Situations'), el('small', {}, 'drivers, shops, kids…')]),
      el('button', { class: 'tile', onclick: () => navigate('/add') }, [el('span', { class: 'big' }, '＋ Phrase'), el('small', {}, 'something I needed today')]),
      el('button', { class: 'tile', onclick: () => navigate('/rescue') }, [el('span', { class: 'big' }, 'Rescue'), el('small', {}, "say it slower / I don't understand")]),
      el('button', { class: 'tile', onclick: () => navigate('/needs-arabic') }, [el('span', { class: 'big' }, 'Needs Arabic'), el('small', {}, 'fill in pending phrases')]),
      el('button', { class: 'tile', onclick: () => navigate('/engines') }, [el('span', { class: 'big' }, 'Engines'), el('small', {}, 'pattern drills')]),
      el('button', { class: 'tile', onclick: () => navigate('/progress') }, [el('span', { class: 'big' }, 'Progress'), el('small', {}, 'what I can say now')]),
    ]),
  ]));

  mount(root);
}

// ---------------- Practice session ----------------

export async function runSession({ minutes, scope }) {
  await refreshStates();
  const m = parseInt(minutes, 10);
  const pool = await data.reviewPool(app.content);
  const queue = plan(m, pool, stateFor, app.settings, Date.now(), scope || null);
  const scenario = scope ? app.content.scenarios.find((s) => s.id === scope) : null;
  const scopeLabel = scenario ? scenario.name : null;
  if (queue.length === 0) {
    mount(el('div', { class: 'col' }, [
      appbar(scopeLabel ? `${scopeLabel} · ${m} min` : `${m} min session`),
      el('div', { class: 'empty' }, scopeLabel
        ? `Nothing to practice in ${scopeLabel} right now. Try a longer time slot or remove the focus.`
        : 'Nothing to practice right now. Add a phrase or pick a scenario.'),
    ]));
    return;
  }

  const sessionId = uid();
  const startedAt = Date.now();
  let i = 0;
  let correct = 0, lapses = 0;
  // Items graded 'hard' get one extra in-session pass for consolidation.
  // Tracked here to avoid infinite re-shows if the user keeps grading hard.
  const hardReshown = new Set();
  // New-item re-test: when a phrase has been freshly introduced, push a recall
  // card a few items later in the same session — one retrieval attempt after
  // intro is worth more than the intro alone.
  const newIntroReshown = new Set();
  // For Undo: remember the state of the most recently graded item before the
  // grade was applied. Cleared after each undo or when the next grade happens.
  let lastUndoable = null; // { itemId, prevState | null }

  step();

  /** Insert an item to be re-shown later in the same session, a few cards
   *  ahead of where we are. Used for hard re-shows and new-item re-tests.
   *  Lands at i + 4..7, capped by queue length. */
  function insertLater(entry) {
    const offset = 4 + Math.floor(Math.random() * 4);
    const pos = Math.min(queue.length, i + offset);
    queue.splice(pos, 0, entry);
  }

  async function step() {
    if (i >= queue.length) {
      await data.logSession({ id: sessionId, startedAt, finishedAt: Date.now(), minutes: m, scope: scope || null, total: queue.length, correct, lapses });
      mount(el('div', { class: 'col' }, [
        appbar('Session done'),
        el('div', { class: 'card col' }, [
          el('h1', {}, 'Done.'),
          scopeLabel ? el('div', { class: 'muted' }, `Focused on: ${scopeLabel}`) : null,
          el('p', {}, `${queue.length} items · ${correct} good/easy · ${lapses} again`),
          el('button', { class: 'primary', onclick: () => navigate('/') }, 'Home'),
        ]),
      ]));
      recorder.teardown();
      return;
    }
    const item = queue[i];
    // If the item was suspended mid-session (e.g. earlier in this run, then
    // re-queued by a hard grade before the suspend), silently skip it.
    if ((app.settings.suspendedIds || []).includes(item.itemId)) {
      i++; step();
      return;
    }
    const undoBtn = lastUndoable
      ? el('button', { class: 'ghost', onclick: undo }, '↶ Undo')
      : null;
    const header = el('div', { class: 'col' }, [
      appbar(scopeLabel
        ? `${scopeLabel} · ${i + 1} / ${queue.length}`
        : `${i + 1} / ${queue.length} · ${m}min`,
        { right: undoBtn }),
      el('div', { class: 'progress' }, [el('span', { style: `width:${Math.round((i / queue.length) * 100)}%` })]),
    ]);

    async function suspendCurrent() {
      app.settings = await data.suspendItem(item.itemId);
      lastUndoable = null;
      toast('Suspended — won\'t appear again. See Settings → Suspended.');
      i++; step();
    }

    async function undo() {
      if (!lastUndoable) return;
      const { itemId, prevState } = lastUndoable;
      if (prevState) {
        await data.putState(prevState);
      } else {
        await data.deleteState(itemId);
      }
      lastUndoable = null;
      // Rewind: re-render the previous card. Note: this doesn't unwind queue
      // mutations (re-queued hard / again / new-intro pushbacks) — those stay
      // in the queue. The point is to fix the grade, not the queue order.
      i = Math.max(0, i - 1);
      step();
    }

    if (item.kind === 'recall' || item.kind === 'scenario_drill' || item.kind === 'recognize') {
      const builder = item.kind === 'recognize' ? practice.recognizeCard : practice.recallCard;
      const node = builder({
        phrase: item.payload,
        state: stateFor(item.itemId),
        settings: app.settings,
        onGraded: async (g) => {
          const prevState = await data.getState(item.itemId);
          await practice.applyGrade(item.itemId, g);
          lastUndoable = { itemId: item.itemId, prevState };
          if (g === 'again') {
            lapses++;
            queue.push(item);
          } else {
            correct++;
            if (g === 'hard' && !hardReshown.has(item.itemId)) {
              hardReshown.add(item.itemId);
              insertLater(item);
            }
          }
          i++;
          step();
        },
        onSkip: () => { i++; step(); },
        onSuspend: suspendCurrent,
      });
      mount(el('div', { class: 'col' }, [header, node]));
    } else if (item.kind === 'new_intro') {
      const node = practice.newIntro({
        phrase: item.payload,
        settings: app.settings,
        onContinue: () => {
          // Don't grade yet — push a real recall card a few items later so the
          // user has to actually retrieve the Arabic from English. Whatever
          // grade they assign at that point becomes the first review.
          if (!newIntroReshown.has(item.itemId)) {
            newIntroReshown.add(item.itemId);
            insertLater({ itemId: item.itemId, kind: 'recall', payload: item.payload });
          }
          lastUndoable = null; // intro doesn't create state — nothing to undo
          i++; step();
        },
        onSuspend: suspendCurrent,
      });
      mount(el('div', { class: 'col' }, [header, node]));
    } else if (item.kind === 'engine_drill') {
      const node = practice.engineDrill({
        engine: item.payload,
        settings: app.settings,
        onDone: () => { i++; step(); },
      });
      mount(el('div', { class: 'col' }, [header, node]));
    } else {
      i++; step();
    }
  }
}

// ---------------- Engines ----------------

export async function renderEngines() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Engines'));
  if (app.content.engines.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No engines loaded yet.'));
  } else {
    const list = el('ul', { class: 'list' });
    for (const e of app.content.engines) {
      list.append(el('li', {}, [
        el('a', { href: `#/engine/${e.id}` }, [
          el('strong', {}, e.name),
          el('div', { class: 'ar sm' }, e.arabicPattern),
          el('div', { class: 'muted' }, e.pattern),
        ]),
      ]));
    }
    root.append(list);
  }
  mount(root);
}

export async function renderEngine({ id }) {
  const e = app.content.engines.find((x) => x.id === id);
  if (!e) { mount(el('div', {}, [appbar('Engine'), el('div', { class: 'empty' }, 'Not found.')])); return; }

  const root = el('div', { class: 'col' });
  root.append(appbar(e.name, { backTo: '/engines' }));
  root.append(el('div', { class: 'card col' }, [
    el('h1', {}, e.pattern),
    el('div', { class: 'ar lg' }, e.arabicPattern),
    app.settings.showTransliteration ? el('div', { class: 'translit' }, e.transliterationPattern) : null,
    e.fushaNote ? el('div', { class: 'note fusha' }, `Fuṣḥā note: ${e.fushaNote}`) : null,
    el('button', { class: 'primary', onclick: () => startEngineDrill(e) }, 'Start drill'),
  ]));

  if (e.forms?.length) {
    root.append(el('h2', {}, 'Forms'));
    const list = el('ul', { class: 'list' });
    for (const f of e.forms) {
      list.append(el('li', {}, [
        el('div', { class: 'muted' }, f.label),
        el('div', { class: 'ar sm' }, f.arabic),
        app.settings.showTransliteration ? el('div', { class: 'translit' }, f.transliteration) : null,
        el('div', {}, f.english),
      ]));
    }
    root.append(list);
  }

  if (e.slots?.length) {
    root.append(el('h2', {}, 'Slots'));
    for (const s of e.slots) {
      const block = el('div', { class: 'card col' }, [el('strong', {}, `[${s.name}]`)]);
      const list = el('ul', { class: 'list' });
      for (const o of s.options) {
        list.append(el('li', {}, [
          el('div', { class: 'ar sm' }, o.arabic),
          app.settings.showTransliteration ? el('div', { class: 'translit' }, o.transliteration) : null,
          el('div', { class: 'muted' }, o.english),
        ]));
      }
      block.append(list);
      root.append(block);
    }
  }

  mount(root);
}

function startEngineDrill(engine) {
  mount(el('div', { class: 'col' }, [
    appbar(engine.name, { backTo: `/engine/${engine.id}` }),
    practice.engineDrill({
      engine,
      settings: app.settings,
      onDone: () => navigate(`/engine/${engine.id}`),
    }),
  ]));
}

// ---------------- Scenarios ----------------

export async function renderScenarios() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Situations'));
  if (app.content.scenarios.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No scenarios loaded.'));
  } else {
    const list = el('ul', { class: 'list' });
    for (const s of app.content.scenarios) {
      list.append(el('li', {}, [
        el('a', { href: `#/scenario/${s.id}` }, [
          el('strong', {}, s.name),
          el('div', { class: 'muted' }, s.description || ''),
        ]),
      ]));
    }
    root.append(list);
  }
  mount(root);
}

export async function renderScenario({ id }) {
  const s = app.content.scenarios.find((x) => x.id === id);
  if (!s) { mount(el('div', {}, [appbar('Situation'), el('div', { class: 'empty' }, 'Not found.')])); return; }
  await refreshStates();
  const pool = await data.reviewPool(app.content);
  const sum = summarize(pool, stateFor, Date.now(), s.id, app.settings.suspendedIds);

  const root = el('div', { class: 'col' });
  root.append(appbar(s.name, { backTo: '/scenarios' }));
  root.append(el('div', { class: 'card col' }, [
    el('p', {}, s.description || ''),
    el('div', { class: 'muted' }, [
      el('strong', {}, `${sum.strong}`), ' strong · ',
      el('strong', {}, `${sum.due}`), ' due · ',
      el('strong', {}, `${sum.weak}`), ' weak · ',
      el('strong', {}, `${sum.fresh}`), ' new · ',
      el('strong', {}, `${sum.total}`), ' total',
    ]),
  ]));

  root.append(el('h2', {}, 'Practice this scenario'));
  const tile = (mins, hint) => el('button', { class: 'tile', onclick: () => navigate(`/practice/${mins}/in/${s.id}`) }, [
    el('span', { class: 'big' }, `${mins} min`),
    el('small', {}, hint),
  ]);
  root.append(el('div', { class: 'grid-2' }, [
    tile(3, 'quick triage'),
    tile(7, 'short focused'),
    tile(10, 'standard'),
    tile(15, 'longer drill'),
  ]));

  const phraseIds = new Set(s.phraseIds || []);
  const suspended = new Set(app.settings.suspendedIds || []);
  const phrases = pool.phrases.filter((p) =>
    (phraseIds.has(p.id) || (p.tags || []).includes(s.id)) && !suspended.has(p.id));
  const engineIds = new Set(s.engineIds || []);
  const engines = app.content.engines.filter((e) => engineIds.has(e.id) || (e.tags || []).includes(s.id));

  if (engines.length) {
    root.append(el('h2', {}, 'Engines'));
    const list = el('ul', { class: 'list' });
    for (const e of engines) {
      list.append(el('li', {}, [el('a', { href: `#/engine/${e.id}` }, [el('strong', {}, e.name), el('div', { class: 'muted' }, e.pattern)])]));
    }
    root.append(list);
  }

  if (phrases.length) {
    root.append(el('h2', {}, 'Phrases'));
    const list = el('ul', { class: 'list' });
    for (const p of phrases) {
      list.append(el('li', {}, [
        el('div', { class: 'ar sm' }, p.arabic),
        app.settings.showTransliteration ? el('div', { class: 'translit' }, p.transliteration) : null,
        el('div', {}, p.english),
      ]));
    }
    root.append(list);
  }

  mount(root);
}

// ---------------- Add phrase ----------------

export async function renderAddPhrase() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Add phrase'));
  const fEnglish = el('input', { placeholder: 'English (required)' });
  const fArabic = el('input', { class: 'ar', placeholder: 'العربية (optional)', dir: 'rtl' });
  const fTranslit = el('input', { placeholder: 'Transliteration (optional)' });
  const fScenario = el('select', {}, [
    el('option', { value: '' }, '— scenario —'),
    ...app.content.scenarios.map((s) => el('option', { value: s.id }, s.name)),
  ]);
  const card = el('div', { class: 'card col' }, [
    el('div', { class: 'field' }, [el('label', {}, 'English'), fEnglish]),
    el('div', { class: 'field' }, [el('label', {}, 'Arabic'), fArabic]),
    el('div', { class: 'field' }, [el('label', {}, 'Transliteration'), fTranslit]),
    el('div', { class: 'field' }, [el('label', {}, 'Scenario'), fScenario]),
    el('button', { class: 'primary', onclick: save }, 'Save phrase'),
    el('button', { class: 'ghost', onclick: () => navigate('/needs-arabic') }, 'See pending phrases'),
  ]);
  root.append(card);
  mount(root);

  async function save() {
    const english = fEnglish.value.trim();
    if (!english) { toast('English is required'); return; }
    const p = {
      id: uid(),
      english,
      arabic: fArabic.value.trim() || undefined,
      transliteration: fTranslit.value.trim() || undefined,
      scenario: fScenario.value || undefined,
      createdAt: Date.now(),
    };
    await data.addUserPhrase(p);
    toast(p.arabic ? 'Saved — entered review queue' : 'Saved to "Needs Arabic"');
    navigate(p.arabic ? '/' : '/needs-arabic');
  }
}

// ---------------- Needs Arabic ----------------

export async function renderNeedsArabic() {
  const all = await data.listUserPhrases();
  const pending = all.filter((p) => !p.arabic);
  const root = el('div', { class: 'col' });
  root.append(appbar('Needs Arabic'));
  if (pending.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No pending phrases. Add one from Home.'));
  } else {
    const list = el('ul', { class: 'list' });
    for (const p of pending) list.append(renderPendingItem(p));
    root.append(list);
  }
  mount(root);
}

function renderPendingItem(p) {
  const ar = el('input', { class: 'ar', dir: 'rtl', placeholder: 'العربية' });
  const tr = el('input', { placeholder: 'Transliteration' });
  return el('li', { class: 'col' }, [
    el('strong', {}, p.english),
    el('div', { class: 'field' }, [el('label', {}, 'Arabic'), ar]),
    el('div', { class: 'field' }, [el('label', {}, 'Transliteration'), tr]),
    el('div', { class: 'row' }, [
      el('button', {
        class: 'primary',
        onclick: async () => {
          if (!ar.value.trim() || !tr.value.trim()) { toast('Both fields needed'); return; }
          p.arabic = ar.value.trim();
          p.transliteration = tr.value.trim();
          await data.addUserPhrase(p);
          toast('Filled — entered review queue');
          renderNeedsArabic();
        },
      }, 'Save'),
      el('button', {
        class: 'ghost',
        onclick: async () => {
          await data.deleteUserPhrase(p.id);
          renderNeedsArabic();
        },
      }, 'Delete'),
    ]),
  ]);
}

// ---------------- Progress ----------------

export async function renderProgress() {
  await refreshStates();
  const pool = await data.reviewPool(app.content);
  const suspended = new Set(app.settings.suspendedIds || []);
  const sum = summarize(pool, stateFor, Date.now(), null, app.settings.suspendedIds);

  const visible = pool.phrases.filter((p) => !suspended.has(p.id));
  const strong = visible.filter((p) => scheduler.isStrong(stateFor(p.id)));
  const weak = visible
    .map((p) => ({ p, st: stateFor(p.id) }))
    .filter((x) => scheduler.isWeak(x.st))
    .sort((a, b) => scheduler.weakness(b.st) - scheduler.weakness(a.st));

  const root = el('div', { class: 'col' });
  root.append(appbar('Progress'));

  // Top stats — every number here matches the lists below.
  root.append(el('div', { class: 'card' }, [
    el('div', {}, [
      el('strong', {}, `${sum.strong}`), ' can say now · ',
      el('strong', {}, `${sum.due}`), ' due · ',
      el('strong', {}, `${sum.weak}`), ' weak · ',
      el('strong', {}, `${sum.seen}`), ' seen · ',
      el('strong', {}, `${sum.fresh}`), ' new available',
    ]),
    el('div', { class: 'progress', style: 'margin-top:10px' }, [
      el('span', { style: `width:${Math.round((sum.strong / Math.max(1, sum.total)) * 100)}%` }),
    ]),
    el('div', { class: 'muted', style: 'margin-top:6px' }, `${sum.strong} / ${sum.total} of the library`),
  ]));

  // Per-scenario breakdown.
  const byScenario = scenarioBreakdown(pool, app.content.scenarios);
  if (byScenario.length) {
    root.append(el('h2', {}, 'By scenario'));
    const list = el('ul', { class: 'list' });
    for (const row of byScenario) {
      list.append(el('li', { class: 'col' }, [
        el('div', { class: 'row' }, [
          el('strong', {}, row.name),
          el('div', { class: 'spacer' }),
          el('span', { class: 'muted' }, `${row.strong} / ${row.total}`),
        ]),
        el('div', { class: 'progress' }, [
          el('span', { style: `width:${Math.round((row.strong / Math.max(1, row.total)) * 100)}%` }),
        ]),
        el('div', { class: 'muted' }, `${row.due} due · ${row.weak} weak · ${row.fresh} new`),
      ]));
    }
    root.append(list);
  }

  // Recent sessions.
  const sessions = (await data.listSessions()).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)).slice(0, 8);
  if (sessions.length) {
    root.append(el('h2', {}, 'Recent sessions'));
    const list = el('ul', { class: 'list' });
    for (const s of sessions) {
      list.append(el('li', { class: 'row' }, [
        el('div', { class: 'spacer' }, [
          el('strong', {}, `${s.minutes ?? '?'} min`),
          el('span', { class: 'muted' }, ` · ${new Date(s.startedAt).toLocaleString()}`),
        ]),
        el('span', { class: 'muted' }, `${s.correct ?? 0} good · ${s.lapses ?? 0} again`),
      ]));
    }
    root.append(list);
  }

  if (strong.length) {
    root.append(el('h2', {}, `Can say now (${strong.length})`));
    const list = el('ul', { class: 'list' });
    for (const p of strong.slice(0, 50)) {
      list.append(el('li', {}, [
        el('div', { class: 'ar sm' }, p.arabic),
        app.settings.showTransliteration ? el('div', { class: 'translit' }, p.transliteration) : null,
        el('div', { class: 'muted' }, p.english),
      ]));
    }
    root.append(list);
  }

  if (weak.length) {
    root.append(el('h2', {}, `Weak — focus on these (${weak.length})`));
    const list = el('ul', { class: 'list' });
    for (const { p, st } of weak.slice(0, 20)) {
      list.append(el('li', {}, [
        el('div', { class: 'ar sm' }, p.arabic),
        el('div', {}, p.english),
        el('div', { class: 'muted' }, `Lapses: ${st.lapses} · last: ${st.lastGrade || '–'} · due ${fmtRelative(st.dueAt)}`),
      ]));
    }
    root.append(list);
  }

  if (!strong.length && !weak.length) {
    root.append(el('div', { class: 'empty' }, 'No reviewed items yet — run a session and grades will show up here.'));
  }

  mount(root);
}

function scenarioBreakdown(pool, scenarios) {
  const suspended = new Set(app.settings.suspendedIds || []);
  const rows = [];
  for (const sc of scenarios) {
    const items = pool.phrases.filter((p) => (p.tags || []).includes(sc.id) && !suspended.has(p.id));
    if (items.length === 0) continue;
    let strong = 0, weak = 0, due = 0, fresh = 0;
    const now = Date.now();
    for (const p of items) {
      const st = stateFor(p.id);
      if (scheduler.isNew(st)) fresh++;
      if (scheduler.isStrong(st)) strong++;
      if (scheduler.isWeak(st)) weak++;
      if (st && scheduler.isDue(st, now) && !scheduler.isNew(st)) due++;
    }
    rows.push({ id: sc.id, name: sc.name, total: items.length, strong, weak, due, fresh });
  }
  return rows;
}

// ---------------- Settings ----------------

export async function renderSettings() {
  const s = app.settings;
  const root = el('div', { class: 'col' });
  root.append(appbar('Settings'));

  const showTr = el('input', { type: 'checkbox' });
  showTr.checked = !!s.showTransliteration;
  const mixRec = el('input', { type: 'checkbox' });
  mixRec.checked = !!s.mixRecognition;
  const speedOptions = [
    ['none',   'none — review only'],
    ['slow',   'slow (fewer)'],
    ['normal', 'normal'],
    ['fast',   'fast (more)'],
  ];
  const speed = el('select', {}, speedOptions.map(([v, label]) => el('option', { value: v }, label)));
  speed.value = s.newItemSpeed;

  const sizeOptions = [
    ['xxsmall', 'XX-small'],
    ['xsmall',  'X-small'],
    ['small',   'Small'],
    ['medium',  'Medium (default)'],
    ['large',   'Large'],
    ['xlarge',  'X-large'],
  ];
  const arSize = el('select', {}, sizeOptions.map(([v, label]) => el('option', { value: v }, label)));
  arSize.value = s.arabicFontSize || 'medium';
  const uiSize = el('select', {}, sizeOptions.map(([v, label]) => el('option', { value: v }, label)));
  uiSize.value = s.uiFontSize || 'medium';

  function previewSizes() {
    if (window.__applyFontSizes) {
      window.__applyFontSizes({ arabicFontSize: arSize.value, uiFontSize: uiSize.value });
    }
  }
  arSize.onchange = previewSizes;
  uiSize.onchange = previewSizes;

  root.append(el('div', { class: 'card col' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Show transliteration'), showTr]),
    el('div', { class: 'field' }, [
      el('label', {}, 'Mix in Arabic → English cards (~25%)'),
      mixRec,
      el('div', { class: 'muted' }, 'Default sessions are English → Arabic (production). Turn this on to also exercise comprehension.'),
    ]),
    el('div', { class: 'field' }, [el('label', {}, 'Arabic font size'), arSize]),
    el('div', { class: 'ar', style: 'margin: -4px 0 4px' }, 'مرحبا، كيف حالك؟'),
    el('div', { class: 'field' }, [el('label', {}, 'English / UI font size'), uiSize]),
    el('div', { style: 'margin: -4px 0 4px' }, 'How are you? — preview at this UI size.'),
    el('div', { class: 'field' }, [el('label', {}, 'New-item speed'), speed]),
    el('button', {
      class: 'primary',
      onclick: async () => {
        const next = await data.saveSettings({
          showTransliteration: showTr.checked,
          mixRecognition: mixRec.checked,
          newItemSpeed: speed.value,
          arabicFontSize: arSize.value,
          uiFontSize: uiSize.value,
        });
        app.settings = next;
        if (window.__applyFontSizes) window.__applyFontSizes(next);
        toast('Saved');
      },
    }, 'Save'),
  ]));

  root.append(el('h2', {}, 'Scenario priority'));
  root.append(el('div', { class: 'card col' }, [
    el('p', { class: 'muted' }, 'Tap to move up. Top items are pulled first into sessions.'),
    renderScenarioOrder(),
  ]));

  root.append(el('h2', {}, 'Data'));
  const suspendedCount = (s.suspendedIds || []).length;
  const importFile = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importFile.onchange = async () => {
    const f = importFile.files && importFile.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const snap = JSON.parse(text);
      if (!confirm('Import will REPLACE your current review state, user phrases, and session log. Continue?')) {
        importFile.value = '';
        return;
      }
      const counts = await data.importSnapshot(snap);
      app.settings = await data.getSettings();
      if (window.__applyFontSizes) window.__applyFontSizes(app.settings);
      toast(`Imported: ${counts.reviewStates} reviews · ${counts.userPhrases} phrases · ${counts.sessions} sessions`);
      navigate('/');
    } catch (err) {
      console.error('import failed', err);
      toast('Import failed: ' + (err.message || 'invalid file'));
    } finally {
      importFile.value = '';
    }
  };
  root.append(el('div', { class: 'card col' }, [
    el('button', { class: 'ghost', onclick: () => navigate('/browser') }, 'Browse content'),
    el('button', { class: 'ghost', onclick: () => navigate('/suspended') }, `Suspended phrases (${suspendedCount})`),
    el('button', {
      class: 'ghost',
      onclick: async () => {
        const snap = await data.exportSnapshot();
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arabic-tutor-${stamp}.json`;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Snapshot downloaded');
      },
    }, 'Export progress (download JSON)'),
    el('button', {
      class: 'ghost',
      onclick: () => importFile.click(),
    }, 'Import progress (replace from JSON)'),
    importFile,
    el('button', {
      class: 'ghost',
      onclick: async () => {
        if (!confirm('Reset all review state and user phrases?')) return;
        const db = await data.openDb();
        await Promise.all(['reviewState', 'userPhrases', 'sessions'].map((store) => new Promise((r) => {
          const req = db.transaction(store, 'readwrite').objectStore(store).clear();
          req.onsuccess = req.onerror = () => r();
        })));
        toast('Reset');
        navigate('/');
      },
    }, 'Reset progress'),
  ]));

  mount(root);

  function renderScenarioOrder() {
    const order = [...s.scenarioPriority];
    const known = new Set(app.content.scenarios.map((x) => x.id));
    for (const sc of app.content.scenarios) if (!order.includes(sc.id)) order.push(sc.id);
    const list = el('ul', { class: 'list' });
    function repaint() {
      clear(list);
      order.forEach((id, idx) => {
        const sc = app.content.scenarios.find((x) => x.id === id);
        const name = sc ? sc.name : id;
        list.append(el('li', { class: 'row' }, [
          el('div', { class: 'spacer' }, [el('strong', {}, name), known.has(id) ? null : el('span', { class: 'muted' }, ' (missing)')]),
          el('button', {
            class: 'ghost',
            disabled: idx === 0,
            onclick: async () => {
              [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
              app.settings = await data.saveSettings({ scenarioPriority: order });
              repaint();
            },
          }, '↑'),
          el('button', {
            class: 'ghost',
            disabled: idx === order.length - 1,
            onclick: async () => {
              [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
              app.settings = await data.saveSettings({ scenarioPriority: order });
              repaint();
            },
          }, '↓'),
        ]));
      });
    }
    repaint();
    return list;
  }
}

// ---------------- Suspended phrases ----------------

export async function renderSuspended() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Suspended', { backTo: '/settings' }));

  const ids = [...(app.settings.suspendedIds || [])].reverse(); // most-recent first
  const pool = await data.reviewPool(app.content); // includes user-added phrases
  const byId = new Map(pool.phrases.map((p) => [p.id, p]));

  if (ids.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No suspended phrases. Suspend an item during practice to hide it from sessions.'));
    mount(root);
    return;
  }

  root.append(el('div', { class: 'card row' }, [
    el('div', { class: 'muted' }, `${ids.length} suspended`),
    el('div', { class: 'spacer' }),
    el('button', {
      class: 'ghost',
      onclick: async () => {
        if (!confirm(`Unsuspend all ${ids.length} phrases?`)) return;
        app.settings = await data.unsuspendAll();
        toast('All unsuspended');
        navigate('/suspended');
      },
    }, 'Unsuspend all'),
  ]));

  const list = el('div', { class: 'col' });
  for (const id of ids) {
    const p = byId.get(id);
    if (!p) continue; // user-phrase or removed content; skip
    list.append(renderSuspendedRow(p));
  }
  root.append(list);
  mount(root);

  function renderSuspendedRow(phrase) {
    const row = el('div', { class: 'card col' });
    row.append(el('div', { class: 'muted' }, (phrase.tags || []).map((t) => el('span', { class: 'tag' }, t))));
    row.append(el('div', { class: 'ar' }, phrase.arabic));
    if (app.settings.showTransliteration) {
      row.append(el('div', { class: 'translit' }, phrase.transliteration));
    }
    row.append(el('div', {}, phrase.english));
    row.append(el('div', { class: 'row' }, [
      el('button', {
        class: 'ghost',
        onclick: async () => {
          app.settings = await data.unsuspendItem(phrase.id);
          toast('Unsuspended');
          navigate('/suspended');
        },
      }, 'Unsuspend'),
    ]));
    return row;
  }
}

// ---------------- Browser ----------------

export async function renderBrowser() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Content browser'));

  if (app.content.warnings.length) {
    root.append(el('div', { class: 'banner warn' }, [
      el('strong', {}, 'Warnings:'),
      el('ul', {}, app.content.warnings.slice(0, 20).map((w) => el('li', {}, w))),
    ]));
  }

  root.append(el('h2', {}, `Engines (${app.content.engines.length})`));
  const eList = el('ul', { class: 'list' });
  for (const e of app.content.engines) {
    eList.append(el('li', {}, [el('a', { href: `#/engine/${e.id}` }, [el('strong', {}, e.name), ' — ', e.pattern])]));
  }
  root.append(eList);

  root.append(el('h2', {}, `Phrases (${app.content.phrases.length})`));
  const pList = el('ul', { class: 'list' });
  for (const p of app.content.phrases.slice(0, 200)) {
    pList.append(el('li', {}, [
      el('div', { class: 'ar sm' }, p.arabic),
      app.settings.showTransliteration ? el('div', { class: 'translit' }, p.transliteration) : null,
      el('div', {}, p.english),
      (p.tags || []).length ? el('div', {}, p.tags.map((t) => el('span', { class: 'tag' }, t))) : null,
    ]));
  }
  root.append(pList);

  mount(root);
}

// ---------------- Rescue ----------------

export async function renderRescue() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Rescue phrases'));
  const suspended = new Set(app.settings.suspendedIds || []);
  const items = app.content.phrases.filter((p) => (p.rescue || (p.tags || []).includes('rescue')) && !suspended.has(p.id));
  if (items.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No rescue phrases yet.'));
  } else {
    const list = el('ul', { class: 'list' });
    for (const p of items) {
      list.append(el('li', {}, [
        el('div', { class: 'ar lg' }, p.arabic),
        app.settings.showTransliteration ? el('div', { class: 'translit' }, p.transliteration) : null,
        el('div', {}, p.english),
        p.pronunciationNote ? el('div', { class: 'note' }, p.pronunciationNote) : null,
      ]));
    }
    root.append(list);
  }
  mount(root);
}
