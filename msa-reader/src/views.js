// All view renderers. Each render* mounts into #app.

import { $, el, clear, toast, uid } from './util.js';
import * as data from './data.js';
import * as scheduler from './scheduler.js';
import { lookup } from './parser.js';
import { navigate } from './router.js';

let app = {
  /** @type {any} */
  settings: data.DEFAULT_SETTINGS,
  /** @type {{dictionary:any[], graded:any[], warnings:string[]}} */
  content: { dictionary: [], graded: [], warnings: [] },
  /** @type {Map<string, any>} */
  dictMap: new Map(),
  /** @type {Map<string, any>} */
  states: new Map(),
};

export function setApp(next) {
  app = { ...app, ...next };
  rebuildDictMap();
}

/** Combined lookup table: bundled dictionary + user-added vocab.
 *  User vocab wins on collision (so you can correct a bundled entry). */
async function rebuildDictMap() {
  const m = new Map();
  for (const e of (app.content?.dictionary || [])) m.set(e.headword, e);
  try {
    const user = await data.listUserVocab();
    for (const e of user) m.set(e.headword, { ...e, _user: true });
  } catch {
    // pre-DB-open contexts: fall back to bundled only.
  }
  app.dictMap = m;
}

async function refreshStates() {
  const all = await data.allStates();
  app.states = new Map(all.map((s) => [s.itemId, s]));
}
function stateFor(id) { return app.states.get(id) || null; }
function entryById(id) {
  return app.dictMap.get(id) || null;
}

/** Add a dictionary entry to the review queue. Idempotent — if it's
 *  already in the SRS we just toast a hint. */
async function addToReview(headword) {
  const entry = entryById(headword);
  if (!entry) { toast('Not in dictionary'); return; }
  const existing = await data.getState(headword);
  if (existing) {
    toast('Already in review');
    return;
  }
  const fresh = scheduler.newState(headword);
  await data.putState(fresh);
  app.states.set(headword, fresh);
  toast(`Added: ${entry.vocalized || headword}`);
}

function mount(node) {
  const root = $('#app');
  clear(root);
  root.append(node);
  window.scrollTo(0, 0);
  closePopup();
}

function appbar(title, opts = {}) {
  return el('div', { class: 'appbar' }, [
    opts.back !== false ? el('button', { class: 'ghost', onclick: () => navigate(opts.backTo || '/') }, '←') : null,
    el('div', { class: 'title' }, title),
    el('div', { class: 'spacer' }),
    opts.right || null,
  ]);
}

// ---------------- Home ----------------

export async function renderHome() {
  const root = el('div', { class: 'col' });
  root.append(el('div', { class: 'appbar' }, [
    el('div', { class: 'title' }, 'MSA Reader'),
    el('div', { class: 'spacer' }),
    el('a', { href: '#/settings' }, 'Settings'),
  ]));

  root.append(el('div', { class: 'card' }, [
    el('div', { class: 'muted' }, [
      'Read newspaper Arabic. Tap any word for a gloss; long-press will add it to review (PR 3). ',
      el('strong', {}, `${app.content.dictionary.length} words loaded.`),
    ]),
  ]));

  const tile = (path, big, hint) =>
    el('button', { class: 'tile', onclick: () => navigate(path) }, [
      el('span', { class: 'big' }, big),
      el('small', {}, hint),
    ]);

  root.append(el('div', { class: 'grid-2' }, [
    tile('/read',     'Read',     'sample article + your library'),
    tile('/library',  'Library',  'graded pieces + paste-in (coming)'),
    tile('/review',   'Review',   'words you saved (coming)'),
    tile('/patterns', 'Patterns', 'roots + forms (coming)'),
  ]));

  mount(root);
}

// ---------------- Reader ----------------

const SAMPLE_PARAGRAPHS = [
  'أعلنت السلطات اليوم عن اجتماع جديد سيُعقد في الأسبوع المقبل لمناقشة الوضع الاقتصادي في المنطقة.',
  'وقال متحدث رسمي إن الاجتماع سيضم ممثلين عن عدة وزارات، مشيراً إلى أن النتائج ستُعلن في وقت لاحق.',
];

const SAMPLE_ARTICLE = {
  id: 'sample',
  title: 'Sample article',
  sourceLabel: 'Sample · level 1',
  paragraphs: SAMPLE_PARAGRAPHS,
};

/** Lookup an article by id across graded + saved. /read defaults to the
 *  sample, /article/:id resolves to graded or saved. */
async function resolveArticle(id) {
  if (!id || id === 'sample') return SAMPLE_ARTICLE;
  const graded = (app.content.graded || []).find((a) => a.id === id);
  if (graded) return graded;
  const saved = await data.listSavedArticles();
  return saved.find((a) => a.id === id) || null;
}

export async function renderReader() {
  return renderArticle({ id: 'sample' });
}

export async function renderArticle({ id }) {
  await refreshStates();
  const article = await resolveArticle(id);
  if (!article) {
    mount(el('div', {}, [appbar('Article'), el('div', { class: 'empty' }, 'Article not found.')]));
    return;
  }

  const root = el('div', { class: 'col' });
  const dueCount = countDue();
  root.append(appbar(article.title, {
    backTo: '/library',
    right: dueCount > 0
      ? el('button', { class: 'ghost', onclick: () => navigate('/review') }, `Review (${dueCount})`)
      : null,
  }));
  root.append(el('div', { class: 'muted' }, [
    article.sourceLabel,
    ' · tap for gloss, long-press to add to review.',
  ]));

  const reader = el('div', { class: 'reader ar' });
  for (const p of (article.paragraphs || [])) {
    reader.append(renderParagraph(p));
  }
  root.append(reader);

  mount(root);
}

function countDue() {
  const suspended = new Set(app.settings.suspendedIds || []);
  let due = 0;
  for (const s of app.states.values()) {
    if (suspended.has(s.itemId)) continue;
    if (scheduler.isDue(s)) due++;
  }
  return due;
}

/** Render a paragraph as a <p> of tappable .tok spans. Whitespace is
 *  preserved as text; punctuation rides with the adjacent token (the
 *  tokenizer ignores ḥarakāt and non-Arabic chars at lookup time). */
function renderParagraph(text) {
  const p = el('p', {});
  const parts = text.split(/(\s+)/);
  for (const t of parts) {
    if (!t) continue;
    if (/^\s+$/.test(t)) {
      p.append(document.createTextNode(t));
      continue;
    }
    // Strip surrounding punctuation for the lookup but keep the original
    // glyphs in place so the rendered text reads naturally.
    const m = t.match(/^([^\p{L}]*)(.+?)([^\p{L}]*)$/u);
    const lead = m ? m[1] : '';
    const core = m ? m[2] : t;
    const trail = m ? m[3] : '';
    if (lead) p.append(document.createTextNode(lead));
    const span = el('span', { class: 'tok' }, core);
    bindTokenInteractions(span, core);
    applyFamiliarity(span, core);
    p.append(span);
    if (trail) p.append(document.createTextNode(trail));
  }
  return p;
}

/** Wire tap and long-press onto a token span. Long-press (500 ms) adds
 *  the matched stem to the SRS; a shorter press opens the gloss popup.
 *  Uses pointer events so touch + mouse work uniformly. */
function bindTokenInteractions(span, raw) {
  let lpTimer = null;
  let didLongPress = false;
  let startX = 0, startY = 0;
  const LP_MS = 500;
  const MOVE_TOLERANCE = 10;

  span.addEventListener('pointerdown', (e) => {
    didLongPress = false;
    startX = e.clientX; startY = e.clientY;
    lpTimer = setTimeout(async () => {
      lpTimer = null;
      didLongPress = true;
      const hit = lookup(raw, app.dictMap);
      if (hit) {
        await addToReview(hit.entry.headword);
        span.classList.add('known');
        span.classList.remove('unknown');
      } else {
        toast('Not in dictionary — can\'t add yet');
      }
    }, LP_MS);
  });
  const cancel = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
  span.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - startX) > MOVE_TOLERANCE || Math.abs(e.clientY - startY) > MOVE_TOLERANCE) cancel();
  });
  span.addEventListener('pointerup', () => cancel());
  span.addEventListener('pointercancel', () => cancel());
  span.addEventListener('pointerleave', () => cancel());
  // Tap = the standard click event. If a long-press fired first, swallow
  // the click so we don't also open the popup.
  span.addEventListener('click', (e) => {
    if (didLongPress) { e.stopPropagation(); didLongPress = false; return; }
    handleTokenTap(span, raw);
  });
}

function applyFamiliarity(span, word) {
  if (!app.settings.showFamiliarityHints) return;
  const hit = lookup(word, app.dictMap);
  if (!hit) { span.classList.add('unknown'); return; }
  // In your SRS with at least one successful review → known.
  // In the dictionary but never added or never recalled → neutral.
  const st = app.states.get(hit.entry.headword);
  if (st && st.repCount > 0 && st.lastGrade !== 'again') span.classList.add('known');
}

function handleTokenTap(span, raw) {
  document.querySelectorAll('.tok.active').forEach((n) => n.classList.remove('active'));
  span.classList.add('active');
  const hit = lookup(raw, app.dictMap);
  showPopup(raw, hit);
}

// ---------------- Word popup (gloss sheet) ----------------

function showPopup(rawWord, hit) {
  const popup = document.getElementById('popup');
  if (!popup) return;
  clear(popup);

  const close = () => closePopup();
  document.removeEventListener('click', onOutsideClick);
  // Defer attaching so the click that opened the popup doesn't immediately
  // close it.
  setTimeout(() => document.addEventListener('click', onOutsideClick), 0);

  if (!hit) {
    popup.append(renderNotFound(rawWord, close));
  } else {
    popup.append(renderGloss(hit, close));
  }
  popup.hidden = false;
}

function onOutsideClick(e) {
  const popup = document.getElementById('popup');
  if (!popup || popup.hidden) return;
  if (popup.contains(e.target)) return;
  if (e.target.closest('.tok')) return; // taps on other tokens route through their own handler
  closePopup();
}

function closePopup() {
  const popup = document.getElementById('popup');
  if (popup) popup.hidden = true;
  document.removeEventListener('click', onOutsideClick);
  document.querySelectorAll('.tok.active').forEach((n) => n.classList.remove('active'));
}

function renderGloss(hit, close) {
  const e = hit.entry;
  const rows = el('div', { class: 'col' });
  rows.append(el('div', { class: 'ar lg' }, e.vocalized || e.headword));
  rows.append(el('h2', {}, e.gloss));

  if (e.root) {
    rows.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Root'),
      el('span', { class: 'gloss-val' }, e.root),
    ]));
  }
  if (e.form) {
    rows.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Form'),
      el('span', { class: 'gloss-val' }, e.form),
    ]));
  }
  if (e.hebrew && app.settings.showHebrewCognates) {
    rows.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Hebrew'),
      el('span', { class: 'gloss-val he' }, e.hebrew),
    ]));
  }
  if (hit.matchedStem !== hit.original) {
    rows.append(el('div', { class: 'muted' }, [
      'Matched stem: ',
      el('span', { class: 'gloss-val' }, hit.matchedStem),
      ' (you tapped ',
      el('span', { class: 'ar sm', style: 'display:inline' }, hit.original),
      ')',
    ]));
  }

  const inSrs = !!app.states.get(e.headword);
  rows.append(el('div', { class: 'actions' }, [
    inSrs
      ? el('button', { class: 'ghost', disabled: true }, '✓ In review')
      : el('button', { class: 'primary', onclick: async () => {
          await addToReview(e.headword);
          closePopup();
        } }, '＋ Add to review'),
    el('button', { class: 'ghost', onclick: close }, 'Close'),
  ]));
  return rows;
}

function renderNotFound(rawWord, close) {
  const rows = el('div', { class: 'col' });
  rows.append(el('div', { class: 'ar lg' }, rawWord));
  rows.append(el('div', { class: 'muted' }, 'Not in the dictionary yet — add it as a personal entry.'));

  const fGloss = el('input', { type: 'text', placeholder: 'English gloss (required)' });
  const fRoot  = el('input', { type: 'text', placeholder: 'Root (e.g. k-t-b) — optional' });
  const fForm  = el('input', { type: 'text', placeholder: 'Form / pattern — optional' });
  const fHeb   = el('input', { type: 'text', placeholder: 'Hebrew cognate — optional' });

  rows.append(el('div', { class: 'col' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Gloss'), fGloss]),
    el('div', { class: 'field' }, [el('label', {}, 'Root'),  fRoot]),
    el('div', { class: 'field' }, [el('label', {}, 'Form'),  fForm]),
    el('div', { class: 'field' }, [el('label', {}, 'Hebrew'), fHeb]),
  ]));

  rows.append(el('div', { class: 'actions' }, [
    el('button', { class: 'primary', onclick: async () => {
      const gloss = fGloss.value.trim();
      if (!gloss) { toast('Gloss is required'); return; }
      // Strip ḥarakāt + non-Arabic from the headword key so it matches what
      // the tokenizer hands the lookup.
      const headword = rawWord.replace(/[ً-ٰ]/g, '').replace(/ـ/g, '').trim();
      const entry = {
        headword,
        vocalized: rawWord,
        gloss,
        root: fRoot.value.trim(),
        form: fForm.value.trim(),
        hebrew: fHeb.value.trim(),
        status: 'verified', // user-authored = trusted
      };
      await data.addUserVocab(entry);
      await rebuildDictMap();
      toast(`Saved: ${headword}`);
      close();
    } }, '＋ Add to my dictionary'),
    el('button', { class: 'ghost', onclick: close }, 'Close'),
  ]));
  return rows;
}

// ---------------- Stubs ----------------

// ---------------- Review session ----------------

export async function renderReview() {
  await refreshStates();
  const queue = buildReviewQueue();
  if (queue.length === 0) {
    mount(el('div', { class: 'col' }, [
      appbar('Review'),
      el('div', { class: 'empty' }, 'No reviews due. Tap a word in the Reader and long-press to add it.'),
      el('button', { class: 'primary', onclick: () => navigate('/read') }, 'Open sample article'),
    ]));
    return;
  }
  runReviewSession(queue);
}

/** Pull every SRS state that is currently due (and not suspended).
 *  Sort by weakness desc so weak items front-load. */
function buildReviewQueue() {
  const suspended = new Set(app.settings.suspendedIds || []);
  const out = [];
  for (const st of app.states.values()) {
    if (suspended.has(st.itemId)) continue;
    if (!scheduler.isDue(st)) continue;
    const entry = entryById(st.itemId);
    if (!entry) continue; // headword no longer in dict (shouldn't normally happen)
    out.push({ st, entry });
  }
  out.sort((a, b) => scheduler.weakness(b.st) - scheduler.weakness(a.st));
  return out;
}

function runReviewSession(queue) {
  let i = 0;
  let correct = 0, lapses = 0;
  const hardReshown = new Set();
  let lastUndoable = null;

  function insertLater(entry) {
    const offset = 4 + Math.floor(Math.random() * 4);
    queue.splice(Math.min(queue.length, i + offset), 0, entry);
  }

  async function suspendCurrent(item) {
    app.settings = await data.suspendItem(item.entry.headword);
    lastUndoable = null;
    toast('Suspended — won\'t appear in review again.');
    i++; step();
  }

  async function undo() {
    if (!lastUndoable) return;
    const { itemId, prevState } = lastUndoable;
    if (prevState) {
      await data.putState(prevState);
      app.states.set(itemId, prevState);
    } else {
      await data.deleteState(itemId);
      app.states.delete(itemId);
    }
    lastUndoable = null;
    i = Math.max(0, i - 1);
    step();
  }

  function step() {
    if (i >= queue.length) {
      mount(el('div', { class: 'col' }, [
        appbar('Review done'),
        el('div', { class: 'card col' }, [
          el('h1', {}, 'Done.'),
          el('p', {}, `${queue.length} cards · ${correct} good/easy · ${lapses} again`),
          el('button', { class: 'primary', onclick: () => navigate('/') }, 'Home'),
          el('button', { class: 'ghost', onclick: () => navigate('/read') }, 'Back to Reader'),
        ]),
      ]));
      return;
    }
    const item = queue[i];

    // Skip mid-session if a previous-card suspend hit this same id (via hard re-show).
    if ((app.settings.suspendedIds || []).includes(item.entry.headword)) {
      i++; step(); return;
    }

    const header = el('div', { class: 'col' }, [
      appbar(`${i + 1} / ${queue.length}`, {
        right: lastUndoable ? el('button', { class: 'ghost', onclick: undo }, '↶ Undo') : null,
      }),
      el('div', { class: 'progress' }, [el('span', { style: `width:${Math.round((i / queue.length) * 100)}%` })]),
    ]);

    const card = renderReviewCard(item, {
      onGraded: async (g) => {
        const prevState = await data.getState(item.entry.headword);
        const next = scheduler.grade(prevState, g);
        next.itemId = item.entry.headword;
        await data.putState(next);
        app.states.set(item.entry.headword, next);
        lastUndoable = { itemId: item.entry.headword, prevState };
        if (g === 'again') {
          lapses++;
          queue.push(item);
        } else {
          correct++;
          if (g === 'hard' && !hardReshown.has(item.entry.headword)) {
            hardReshown.add(item.entry.headword);
            insertLater(item);
          }
        }
        i++; step();
      },
      onSkip: () => { i++; step(); },
      onSuspend: () => suspendCurrent(item),
    });

    mount(el('div', { class: 'col' }, [header, card]));
  }
  step();
}

function renderReviewCard(item, { onGraded, onSkip, onSuspend }) {
  const root = el('div', { class: 'card col' });
  let revealed = false;

  // Prompt — unvocalised headword (this is what you'll see in a newspaper).
  root.append(el('div', { class: 'muted' }, 'Recognise this'));
  root.append(el('div', { class: 'ar lg' }, item.entry.headword));

  const answer = el('div', { class: 'col', hidden: true });
  if (item.entry.vocalized && item.entry.vocalized !== item.entry.headword) {
    answer.append(el('div', { class: 'ar' }, item.entry.vocalized));
  }
  answer.append(el('h2', {}, item.entry.gloss));
  if (item.entry.root) {
    answer.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Root'),
      el('span', { class: 'gloss-val' }, item.entry.root),
    ]));
  }
  if (item.entry.form) {
    answer.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Form'),
      el('span', { class: 'gloss-val' }, item.entry.form),
    ]));
  }
  if (item.entry.hebrew && app.settings.showHebrewCognates) {
    answer.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Hebrew'),
      el('span', { class: 'gloss-val he' }, item.entry.hebrew),
    ]));
  }
  root.append(answer);

  const grades = el('div', { class: 'grades', hidden: true }, gradeRow(item.st, finish));
  root.append(grades);

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

  root.append(el('div', { class: 'row' }, [
    el('button', { class: 'ghost', onclick: () => onSkip() }, 'Skip'),
    el('button', { class: 'ghost', onclick: () => onSuspend() }, 'Suspend'),
  ]));

  function finish(g) { if (revealed) onGraded(g); }
  return root;
}

function gradeRow(state, finish) {
  const iv = scheduler.previewIntervals(state || null);
  return [
    gradeBtn('again', 'Again', fmtInterval(iv.again), () => finish('again')),
    gradeBtn('hard',  'Hard',  fmtInterval(iv.hard),  () => finish('hard')),
    gradeBtn('good',  'Good',  fmtInterval(iv.good),  () => finish('good')),
    gradeBtn('easy',  'Easy',  fmtInterval(iv.easy),  () => finish('easy')),
  ];
}

function gradeBtn(kind, label, sub, onClick) {
  return el('button', { class: kind, onclick: onClick }, [
    el('span', {}, label),
    el('small', {}, sub),
  ]);
}

function fmtInterval(d) {
  if (d < 1) return '<1m';
  if (d === 1) return '1d';
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${Math.round(d / 365)}y`;
}

// ---------------- Patterns ----------------

export async function renderPatterns() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Patterns'));

  const roots = app.content.patterns || [];
  if (roots.length === 0) {
    root.append(el('div', { class: 'empty' }, 'No patterns loaded.'));
    mount(root); return;
  }

  const totalCards = roots.reduce((n, r) => n + (r.derivations || []).length, 0);
  root.append(el('div', { class: 'card col' }, [
    el('div', { class: 'muted' }, [
      `${roots.length} roots · ${totalCards} derivation cards. Reveal-only — drill through forms to reactivate pattern recognition.`,
    ]),
    el('button', { class: 'primary', onclick: () => startPatternDrill(mixedDeck(roots, 10), 'Mixed') }, 'Drill 10 mixed'),
  ]));

  root.append(el('h2', {}, 'By root'));
  const list = el('div', { class: 'col' });
  for (const r of roots) {
    const card = el('div', {
      class: 'card col',
      onclick: () => startPatternDrill(deckForRoot(r), r.root),
      style: 'cursor: pointer',
    });
    card.append(el('div', { class: 'row' }, [
      el('strong', { style: 'flex:1' }, r.root),
      el('span', { class: 'muted' }, `${(r.derivations || []).length} forms`),
    ]));
    card.append(el('div', { class: 'muted' }, r.rootMeaning || ''));
    if (r.hebrew && app.settings.showHebrewCognates) {
      card.append(el('div', { class: 'gloss-row' }, [
        el('span', { class: 'gloss-label' }, 'Hebrew'),
        el('span', { class: 'gloss-val he' }, r.hebrew),
      ]));
    }
    list.append(card);
  }
  root.append(list);
  mount(root);
}

function deckForRoot(r) {
  return (r.derivations || []).map((d) => ({ ...d, root: r.root, rootMeaning: r.rootMeaning, hebrew: r.hebrew }));
}

function mixedDeck(roots, n) {
  const all = [];
  for (const r of roots) all.push(...deckForRoot(r));
  // Fisher-Yates shuffle, slice n
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n);
}

function startPatternDrill(deck, label) {
  if (!deck.length) {
    mount(el('div', {}, [appbar('Patterns'), el('div', { class: 'empty' }, 'Empty deck.')]));
    return;
  }
  let i = 0;

  function step() {
    if (i >= deck.length) {
      mount(el('div', { class: 'col' }, [
        appbar('Patterns done'),
        el('div', { class: 'card col' }, [
          el('h1', {}, 'Done.'),
          el('p', {}, `${deck.length} cards · ${label}`),
          el('button', { class: 'primary', onclick: () => navigate('/patterns') }, 'Back to roots'),
          el('button', { class: 'ghost', onclick: () => navigate('/') }, 'Home'),
        ]),
      ]));
      return;
    }
    const d = deck[i];

    const header = el('div', { class: 'col' }, [
      appbar(`${label} · ${i + 1} / ${deck.length}`, { backTo: '/patterns' }),
      el('div', { class: 'progress' }, [el('span', { style: `width:${Math.round((i / deck.length) * 100)}%` })]),
    ]);

    const card = el('div', { class: 'card col' });
    card.append(el('div', { class: 'muted' }, [
      'Root ',
      el('strong', {}, d.root),
      d.rootMeaning ? ` · ${d.rootMeaning}` : '',
    ]));
    card.append(el('div', { class: 'ar lg' }, d.unvocalized));

    const answer = el('div', { class: 'col', hidden: true });
    if (d.vocalized && d.vocalized !== d.unvocalized) {
      answer.append(el('div', { class: 'ar' }, d.vocalized));
    }
    answer.append(el('h2', {}, d.gloss));
    answer.append(el('div', { class: 'gloss-row' }, [
      el('span', { class: 'gloss-label' }, 'Form'),
      el('span', { class: 'gloss-val' }, d.form),
    ]));
    if (d.pattern) {
      answer.append(el('div', { class: 'gloss-row' }, [
        el('span', { class: 'gloss-label' }, 'Pattern'),
        el('span', { class: 'gloss-val' }, d.pattern),
      ]));
    }
    if (d.hebrew && app.settings.showHebrewCognates) {
      answer.append(el('div', { class: 'gloss-row' }, [
        el('span', { class: 'gloss-label' }, 'Hebrew'),
        el('span', { class: 'gloss-val he' }, d.hebrew),
      ]));
    }
    card.append(answer);

    const nextBtn = el('button', { class: 'primary', hidden: true, onclick: () => { i++; step(); } }, i + 1 < deck.length ? 'Next' : 'Done');
    const revealBtn = el('button', {
      class: 'primary',
      onclick: () => { answer.hidden = false; revealBtn.hidden = true; nextBtn.hidden = false; },
    }, 'Reveal');
    card.append(revealBtn);
    card.append(nextBtn);
    card.append(el('div', { class: 'row' }, [
      el('button', { class: 'ghost', onclick: () => { i++; step(); } }, 'Skip'),
    ]));

    mount(el('div', { class: 'col' }, [header, card]));
  }
  step();
}

// ---------------- Library ----------------

export async function renderLibrary() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Library'));

  root.append(el('div', { class: 'row' }, [
    el('button', { class: 'primary', onclick: () => navigate('/paste') }, '＋ Paste an article'),
    el('button', { class: 'ghost', onclick: () => navigate('/article/sample') }, 'Sample paragraph'),
  ]));

  // Graded articles section
  const graded = app.content.graded || [];
  if (graded.length) {
    root.append(el('h2', {}, 'Graded'));
    const list = el('div', { class: 'col' });
    for (const a of graded) {
      list.append(renderArticleCard(a, false));
    }
    root.append(list);
  }

  // Saved articles section
  const saved = await data.listSavedArticles();
  saved.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  root.append(el('h2', {}, `Saved (${saved.length})`));
  if (saved.length === 0) {
    root.append(el('div', { class: 'empty' }, 'Nothing saved yet. Paste any Arabic text above.'));
  } else {
    const list = el('div', { class: 'col' });
    for (const a of saved) {
      list.append(renderArticleCard(a, true));
    }
    root.append(list);
  }

  mount(root);
}

function renderArticleCard(article, isSaved) {
  const card = el('div', {
    class: 'card col',
    onclick: () => navigate(`/article/${encodeURIComponent(article.id)}`),
    style: 'cursor: pointer',
  });
  const titleRow = el('div', { class: 'row' }, [
    el('div', { style: 'flex:1' }, el('strong', {}, article.title)),
    isSaved ? el('button', {
      class: 'ghost',
      onclick: async (e) => {
        e.stopPropagation();
        if (!confirm(`Delete "${article.title}"?`)) return;
        await data.deleteSavedArticle(article.id);
        toast('Deleted');
        renderLibrary();
      },
    }, '×') : null,
  ]);
  card.append(titleRow);
  if (article.sourceLabel) card.append(el('div', { class: 'muted' }, article.sourceLabel));
  const firstLine = (article.paragraphs && article.paragraphs[0]) || '';
  if (firstLine) {
    card.append(el('div', { class: 'ar sm', style: 'opacity:0.8' },
      firstLine.length > 90 ? firstLine.slice(0, 90) + '…' : firstLine));
  }
  return card;
}

// ---------------- Paste-in ----------------

export async function renderPaste() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Paste an article', { backTo: '/library' }));

  const fTitle = el('input', { type: 'text', placeholder: 'Title — e.g. al-Jazeera 14 Jun 2026' });
  const fSource = el('input', { type: 'text', placeholder: 'Source label (optional)' });
  const fBody = el('textarea', { rows: 14, dir: 'rtl', class: 'ar', placeholder: 'Paste the Arabic text here. Blank lines separate paragraphs.' });

  async function save() {
    const title = fTitle.value.trim();
    const body = fBody.value.trim();
    if (!title) { toast('Title is required'); return; }
    if (!body)  { toast('Paste some text'); return; }
    const paragraphs = body.split(/\n\s*\n+/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const article = {
      id: uid(),
      title,
      sourceLabel: fSource.value.trim() || `Pasted ${new Date().toISOString().slice(0, 10)}`,
      paragraphs,
      createdAt: Date.now(),
    };
    await data.saveArticle(article);
    toast(`Saved · ${paragraphs.length} paragraph${paragraphs.length === 1 ? '' : 's'}`);
    navigate(`/article/${encodeURIComponent(article.id)}`);
  }

  root.append(el('div', { class: 'card col' }, [
    el('div', { class: 'field' }, [el('label', {}, 'Title'), fTitle]),
    el('div', { class: 'field' }, [el('label', {}, 'Source label (optional)'), fSource]),
    el('div', { class: 'field' }, [el('label', {}, 'Body'), fBody]),
    el('div', { class: 'row' }, [
      el('button', { class: 'primary', onclick: save }, 'Save + open'),
      el('button', { class: 'ghost', onclick: () => navigate('/library') }, 'Cancel'),
    ]),
  ]));
  mount(root);
}

// ---------------- Suspended list ----------------

export async function renderSuspended() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Suspended', { backTo: '/settings' }));

  const ids = [...(app.settings.suspendedIds || [])].reverse();
  if (ids.length === 0) {
    root.append(el('div', { class: 'empty' }, 'Nothing suspended. Suspend a card during Review to hide it from future sessions.'));
    mount(root); return;
  }

  root.append(el('div', { class: 'card row' }, [
    el('div', { class: 'muted', style: 'flex:1' }, `${ids.length} suspended`),
    el('button', {
      class: 'ghost',
      onclick: async () => {
        if (!confirm(`Unsuspend all ${ids.length}?`)) return;
        app.settings = await data.unsuspendAll();
        toast('All unsuspended');
        renderSuspended();
      },
    }, 'Unsuspend all'),
  ]));

  const list = el('div', { class: 'col' });
  for (const id of ids) {
    const entry = app.dictMap.get(id);
    const row = el('div', { class: 'card col' });
    row.append(el('div', { class: 'ar' }, entry?.vocalized || id));
    if (entry) row.append(el('div', {}, entry.gloss));
    row.append(el('div', { class: 'row' }, [
      el('button', {
        class: 'ghost',
        onclick: async () => {
          app.settings = await data.unsuspendItem(id);
          toast('Unsuspended');
          renderSuspended();
        },
      }, 'Unsuspend'),
    ]));
    list.append(row);
  }
  root.append(list);
  mount(root);
}

// ---------------- Settings ----------------

export async function renderSettings() {
  const s = app.settings;

  const sizeOptions = [
    ['xxsmall', 'XX-small'],
    ['xsmall',  'X-small'],
    ['small',   'Small'],
    ['medium',  'Medium (default)'],
    ['large',   'Large'],
    ['xlarge',  'X-large'],
  ];
  const arSize = el('select', {}, sizeOptions.map(([v, l]) => el('option', { value: v }, l)));
  arSize.value = s.arabicFontSize || 'medium';
  const uiSize = el('select', {}, sizeOptions.map(([v, l]) => el('option', { value: v }, l)));
  uiSize.value = s.uiFontSize || 'medium';

  const heCog = el('input', { type: 'checkbox' });
  heCog.checked = !!s.showHebrewCognates;
  const famHints = el('input', { type: 'checkbox' });
  famHints.checked = !!s.showFamiliarityHints;

  function previewSizes() {
    if (window.__applyFontSizes) {
      window.__applyFontSizes({ arabicFontSize: arSize.value, uiFontSize: uiSize.value });
    }
  }
  arSize.onchange = previewSizes;
  uiSize.onchange = previewSizes;

  // ---- Data section: suspended list, export/import, reset ----
  const suspendedCount = (s.suspendedIds || []).length;
  const importFile = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  importFile.onchange = async () => {
    const f = importFile.files && importFile.files[0];
    if (!f) return;
    try {
      const snap = JSON.parse(await f.text());
      if (!confirm('Import will REPLACE your current review state, user vocab, and saved articles. Continue?')) {
        importFile.value = ''; return;
      }
      const counts = await data.importSnapshot(snap);
      app.settings = await data.getSettings();
      await rebuildDictMap();
      if (window.__applyFontSizes) window.__applyFontSizes(app.settings);
      toast(`Imported: ${counts.reviewStates} reviews · ${counts.userVocab} vocab · ${counts.savedArticles} articles`);
      navigate('/');
    } catch (err) {
      console.error('import failed', err);
      toast('Import failed: ' + (err.message || 'invalid file'));
    } finally {
      importFile.value = '';
    }
  };

  mount(el('div', { class: 'col' }, [
    appbar('Settings'),
    el('div', { class: 'card col' }, [
      el('div', { class: 'field' }, [el('label', {}, 'Arabic font size'), arSize]),
      el('div', { class: 'ar' }, 'الاجتماع المُنعقد في عمّان'),
      el('div', { class: 'field' }, [el('label', {}, 'English / UI font size'), uiSize]),
      el('div', { class: 'field' }, [el('label', {}, 'Show Hebrew cognate in gloss popup'), heCog]),
      el('div', { class: 'field' }, [el('label', {}, 'Colour-code unfamiliar words in Reader'), famHints]),
      el('button', {
        class: 'primary',
        onclick: async () => {
          const next = await data.saveSettings({
            arabicFontSize: arSize.value,
            uiFontSize: uiSize.value,
            showHebrewCognates: heCog.checked,
            showFamiliarityHints: famHints.checked,
          });
          app.settings = next;
          if (window.__applyFontSizes) window.__applyFontSizes(next);
          toast('Saved');
        },
      }, 'Save'),
    ]),
    el('h2', {}, 'Data'),
    el('div', { class: 'card col' }, [
      el('button', { class: 'ghost', onclick: () => navigate('/suspended') }, `Suspended (${suspendedCount})`),
      el('button', {
        class: 'ghost',
        onclick: async () => {
          const snap = await data.exportSnapshot();
          const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const stamp = new Date().toISOString().slice(0, 10);
          const a = document.createElement('a');
          a.href = url;
          a.download = `msa-reader-${stamp}.json`;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast('Snapshot downloaded');
        },
      }, 'Export progress (download JSON)'),
      el('button', { class: 'ghost', onclick: () => importFile.click() }, 'Import progress (replace from JSON)'),
      importFile,
      el('button', {
        class: 'ghost',
        onclick: async () => {
          if (!confirm('Reset review state, user vocab, saved articles, and session log? Settings are kept.')) return;
          await data.resetProgress();
          await rebuildDictMap();
          await refreshStates();
          toast('Reset');
          navigate('/');
        },
      }, 'Reset progress'),
    ]),
  ]));
}
