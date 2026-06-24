// App bootstrap. Loads settings, registers routes + SW.

import * as data from './data.js';
import * as router from './router.js';
import * as views from './views.js';
import { toast } from './util.js';

async function boot() {
  const [content, settings] = await Promise.all([
    data.loadContent(),
    data.getSettings(),
  ]);
  applyFontSizes(settings);
  views.setApp({ content, settings });

  router.route('/',         views.renderHome);
  router.route('/read',     views.renderReader);
  router.route('/library',  views.renderLibrary);
  router.route('/review',   views.renderReview);
  router.route('/patterns', views.renderPatterns);
  router.route('/settings', views.renderSettings);
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
