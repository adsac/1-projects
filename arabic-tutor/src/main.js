// App bootstrap. Loads content + settings, registers SW, wires routes.

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
  await views.setApp({ content, settings, states: new Map() });

  router.route('/', views.renderHome);
  router.route('/practice/:minutes', views.runSession);
  router.route('/practice/:minutes/in/:scope', views.runSession);
  router.route('/engines', views.renderEngines);
  router.route('/engine/:id', views.renderEngine);
  router.route('/scenarios', views.renderScenarios);
  router.route('/scenario/:id', views.renderScenario);
  router.route('/add', views.renderAddPhrase);
  router.route('/needs-arabic', views.renderNeedsArabic);
  router.route('/progress', views.renderProgress);
  router.route('/settings', views.renderSettings);
  router.route('/browser', views.renderBrowser);
  router.route('/rescue', views.renderRescue);
  router.start();

  registerSW();
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // Skip SW under file:// or localhost-without-https variations during ad-hoc testing.
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available.
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
// Re-export so views.js can call it after Settings save without reloading.
window.__applyFontSizes = applyFontSizes;

window.addEventListener('error', (e) => {
  console.error('app error', e.error || e.message);
  toast('Error: ' + (e.message || 'unknown'));
});

boot().catch((err) => {
  console.error('boot failed', err);
  document.getElementById('app').innerHTML = '<div class="empty">Failed to load. Reopen the app.</div>';
});
