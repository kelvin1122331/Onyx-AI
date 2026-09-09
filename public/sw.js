/**
 * Onyx AI — Service Worker
 * Strategi: cache-first untuk aset statis, network-only untuk API.
 */
'use strict';

const CACHE_NAME = 'onyx-ai-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/markdown.js',
  './js/app.js',
  './js/vendor/marked.umd.js',
  './js/vendor/purify.min.js',
  './js/vendor/prism/prism-core.js',
  './js/vendor/prism/prism-langs.js',
  './favicon.svg',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan pernah intercept panggilan API Gemini
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        // Refresh di belakang (stale-while-revalidate)
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) caches.open(CACHE_NAME).then((c) => c.put(event.request, res));
          })
          .catch(() => {});
        return cached;
      }
      return fetch(event.request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
