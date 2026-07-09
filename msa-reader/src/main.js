// App bootstrap. Loads settings, registers routes + SW.

import * as data from './data.js';
import * as router from './router.js';
import * as views from './views.js';
import { toast } from './util.js';

/** Web Share Target: Android's share sheet opens the app at
 *  ./?share-title=…&share-text=…&share-url=… (see manifest). Stash the
 *  payload, strip the query so reloads don't re-trigger, and land on the
 *  paste view which reads the stash as a prefill. */
function captureShareTarget() {
  const q = new URLSearchParams(location.search);
  if (!q.has('share-title') && !q.has('share-text') && !q.has('share-url')) return;
  try {
    sessionStorage.setItem('msa-share-payload', JSON.stringify({
      title: q.get('share-title') || '',
      text: q.get('share-text') || '',
      url: q.get('share-url') || '',
    }));
  } catch { /* private mode — the paste view just opens empty */ }
  history.replaceState(null, '', location.pathname + '#/paste');
}

async function boot() {
  captureShareTarget();
  const [content, settings] = await Promise.all([
    data.loadContent(),
    data.getSettings(),
  ]);
  applyFontSizes(settings);
  views.setApp({ content, settings });

  router.route('/',         views.renderHome);
  router.route('/today',         views.renderToday);
  router.route('/read',          views.renderReader);
  router.route('/library',       views.renderLibrary);
  router.route('/article/:id',   views.renderArticle);
  router.route('/paste',         views.renderPaste);
  router.route('/review',        views.renderReview);
  router.route('/patterns',      views.renderPatterns);
  router.route('/settings',      views.renderSettings);
  router.route('/suspended',     views.renderSuspended);
  router.route('/unknowns',      views.renderUnknowns);
  router.start();

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdatePrompt(reg);
        }
      });
    });
  }).catch(() => {});
}

function showUpdatePrompt(reg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = 'Update available · ';
  const btn = document.createElement('a');
  btn.href = '#';
  btn.textContent = 'reload';
  btn.onclick = (e) => {
    e.preventDefault();
    reg.waiting?.postMessage('skipWaiting');
    location.reload();
  };
  t.append(span, btn);
  t.hidden = false;
}

function applyFontSizes(settings) {
  const root = document.documentElement;
  root.dataset.arSize = settings.arabicFontSize || 'medium';
  root.dataset.uiSize = settings.uiFontSize || 'medium';
}
window.__applyFontSizes = applyFontSizes;

window.addEventListener('error', (e) => {
  console.error('app error', e.error || e.message);
  toast('Error: ' + (e.message || 'unknown'));
});

boot().catch((err) => {
  console.error('boot failed', err);
  document.getElementById('app').innerHTML = '<div class="empty">Failed to load. Reopen the app.</div>';
});
