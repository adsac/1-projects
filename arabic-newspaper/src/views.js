// All view renderers. Each render* mounts into #app.
//
// PR 1 ships:
//   - renderHome   — tile navigation
//   - renderReader — hardcoded sample paragraph, tokenized into tappable
//                    spans; tap shows a "PR 2 will gloss this" toast.
//   - stubs for Review / Patterns / Library / Settings.

import { $, el, clear, toast } from './util.js';
import * as data from './data.js';
import { navigate } from './router.js';

let app = {
  /** @type {any} */
  settings: data.DEFAULT_SETTINGS,
  /** @type {{dictionary:any[], graded:any[], warnings:string[]}} */
  content: { dictionary: [], graded: [], warnings: [] },
};

export function setApp(next) {
  app = next;
}

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

// ---------------- Home ----------------

export async function renderHome() {
  const root = el('div', { class: 'col' });
  root.append(el('div', { class: 'appbar' }, [
    el('div', { class: 'title' }, 'MSA Reader'),
    el('div', { class: 'spacer' }),
    el('a', { href: '#/settings' }, 'Settings'),
  ]));

  root.append(el('div', { class: 'card' }, [
    el('div', { class: 'muted' }, 'Read newspaper Arabic. Tap any word for a gloss; long-press to add it to review.'),
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

// Hello-world content for PR 1. A short, newspaper-register paragraph
// written in the style of a wire-service lede — neutral subject so it
// doesn't anchor the dictionary work in PR 2 to one topic.
const SAMPLE_PARAGRAPHS = [
  'أعلنت السلطات اليوم عن اجتماع جديد سيُعقد في الأسبوع المقبل لمناقشة الوضع الاقتصادي في المنطقة.',
  'وقال متحدث رسمي إن الاجتماع سيضم ممثلين عن عدة وزارات، مشيراً إلى أن النتائج ستُعلن في وقت لاحق.',
];

export async function renderReader() {
  const root = el('div', { class: 'col' });
  root.append(appbar('Sample article'));

  root.append(el('div', { class: 'muted' }, [
    'Tap any word for a gloss. ',
    el('strong', {}, 'PR 1 wires the UI; PR 2 plugs in the dictionary.'),
  ]));

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

/** Render a paragraph as a <p> of tappable .tok spans, splitting on
 *  whitespace. Punctuation tucks inside the adjacent token for now —
 *  the morphology-aware split lands in PR 2. */
function renderParagraph(text) {
  const p = el('p', {});
  const tokens = text.split(/(\s+)/); // keep whitespace as separators
  for (const t of tokens) {
    if (/^\s+$/.test(t)) {
      p.append(document.createTextNode(t));
    } else if (t.length === 0) {
      // skip
    } else {
      const span = el('span', { class: 'tok', onclick: () => handleTokenTap(span, t) }, t);
      p.append(span);
    }
  }
  return p;
}

function handleTokenTap(span, raw) {
  document.querySelectorAll('.tok.active').forEach((n) => n.classList.remove('active'));
  span.classList.add('active');
  toast(`"${raw}" — dictionary lookup coming in PR 2`);
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
      el('div', { class: 'field' }, [el('label', {}, 'Colour-code familiar / unfamiliar words in Reader'), famHints]),
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
    el('div', { class: 'muted' }, 'Export / import and more settings land in PR 6.'),
  ]));
}
