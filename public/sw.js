/*
 * Self-destroying service worker.
 *
 * Annie's previously shipped a vite-plugin-pwa service worker (registered at
 * /sw.js, scope /). Production no longer uses a service worker, so any old SW
 * still installed in a visitor's browser is stuck serving a stale, precached
 * app shell — which now points at hashed chunks that 404 (blank/white page) or
 * an outdated cached page (wrong hero). Those SWs also can't recover on their
 * own because /sw.js had stopped being valid JavaScript.
 *
 * This file replaces that SW with one that immediately unregisters itself,
 * deletes every Cache Storage entry, and reloads any open tabs so visitors
 * land on the live (network) site. On the browser's next SW update check it
 * fetches this file and self-heals.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch (_) {
        /* ignore */
      }
      try {
        await self.registration.unregister();
      } catch (_) {
        /* ignore */
      }
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch (_) {
          /* ignore */
        }
      }
    })()
  );
});

// While briefly active, never serve from cache — always go to the network.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
