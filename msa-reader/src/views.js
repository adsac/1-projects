// All view renderers. Each render* mounts into #app.

import { $, el, clear, toast } from './util.js';
import * as data from './data.js';
import { lookup } from './parser.js';
import { navigate } from './router.js';

let app = {
  /** @type {any} */
  settings: data.DEFAULT_SETTINGS,
  /** @type {{dictionary:any[], graded:any[], warnings:string[]}} */
  content: { dictionary: [], graded: [], warnings: [] },
  /** @type {Map<string, any>} */
  dictMap: new Map(),
};

export function setApp(next) {
  app = { ...app, ...next };
  app.dictMap = new Map((app.content?.dictionary || []).map((e) => [e.headword, e]));
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

export async function renderReader() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Sample article'));
  root.append(el('div', { class: 'muted' }, 'Tap any word for the gloss.'));

  const reader = el('div', { class: 'reader ar' });
  for (const p of SAMPLE_PARAGRAPHS) {
    reader.append(renderParagraph(p));
  }
  root.append(reader);

  root.append(el('div', { class: 'row' }, [
    el('button', { class: 'ghost', onclick: () => navigate('/') }, '← Home'),
  ]));

  mount(root);
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
    const span = el('span', { class: 'tok', onclick: () => handleTokenTap(span, core) }, core);
    applyFamiliarity(span, core);
    p.append(span);
    if (trail) p.append(document.createTextNode(trail));
  }
  return p;
}

function applyFamiliarity(span, word) {
  if (!app.settings.showFamiliarityHints) return;
  const hit = lookup(word, app.dictMap);
  if (!hit) span.classList.add('unknown');
  // PR 3 will distinguish "in your SRS with positive history" from
  // "in dict but never reviewed" — for now anything in the dict is
  // neutral; anything missed is unknown.
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

  rows.append(el('div', { class: 'actions' }, [
    el('button', { class: 'primary', onclick: () => toast('Add-to-review lands in PR 3') }, '＋ Add to review'),
    el('button', { class: 'ghost', onclick: close }, 'Close'),
  ]));
  return rows;
}

function renderNotFound(rawWord, close) {
  const rows = el('div', { class: 'col' });
  rows.append(el('div', { class: 'ar lg' }, rawWord));
  rows.append(el('div', { class: 'muted' }, 'Not in the dictionary yet. PR 6 will let you save your own entries.'));
  rows.append(el('div', { class: 'actions' }, [
    el('button', { class: 'ghost', onclick: close }, 'Close'),
  ]));
  return rows;
}

// ---------------- Stubs ----------------

export async function renderReview() {
  mount(el('div', { class: 'col' }, [
    appbar('Review'),
    el('div', { class: 'empty' }, 'Recognition-only SRS lands in PR 3. Long-press a word in the Reader to queue it for review.'),
  ]));
}

export async function renderPatterns() {
  mount(el('div', { class: 'col' }, [
    appbar('Patterns'),
    el('div', { class: 'empty' }, 'Root + form recognition drills land in PR 5. ~20 high-frequency roots × 5-8 forms each.'),
  ]));
}

export async function renderLibrary() {
  mount(el('div', { class: 'col' }, [
    appbar('Library'),
    el('div', { class: 'empty' }, 'Graded articles and paste-in land in PR 4. For now, the Reader has one sample paragraph.'),
    el('button', { class: 'primary', onclick: () => navigate('/read') }, 'Open sample article'),
  ]));
}

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
    el('div', { class: 'muted' }, 'Export / import + more settings land in PR 6.'),
  ]));
}
