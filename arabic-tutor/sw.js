// Service worker — cache app shell + content for offline use.
// Bump CACHE_VERSION on any user-visible change (shell *or* content).
// The in-app "Update available · reload" toast only fires when the SW
// file itself differs from the previously-installed copy, so a content-
// only change won't be signalled unless the version is bumped here.
const CACHE_VERSION = 'v15';
const SHELL_CACHE = `arabic-tutor-shell-${CACHE_VERSION}`;
const CONTENT_CACHE = `arabic-tutor-content-${CACHE_VERSION}`;

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './styles.css',
  './fonts/NotoNaskhArabic-400.woff2',
  './src/main.js',
  './src/data.js',
  './src/scheduler.js',
  './src/planner.js',
  './src/practice.js',
  './src/views.js',
  './src/router.js',
  './src/recorder.js',
  './src/util.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== CONTENT_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Content JSON: network-first, fall back to cache.
  if (url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CONTENT_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Shell: cache-first.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
