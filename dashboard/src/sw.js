/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
/**
 * Dashboard service worker — Sprint 18.
 *
 * Mirrors the customer portal's src/sw.ts pattern: precache the admin shell
 * via workbox, runtime-cache fonts/images/assets, and add a push event
 * handler so admin push notifications (new bookings, damage reports, late
 * returns) actually render.
 *
 * This file was introduced when the dashboard switched from VitePWA's
 * `generateSW` mode to `injectManifest` mode — generateSW doesn't support a
 * custom push handler, so admin push delivery was a no-op before. After this
 * change the SW caches the same set of files as before (precache + runtime)
 * AND can deliver pushes.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache the admin shell. Vite + injectManifest inlines the list at build time.
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Auto-update: registerSW.js posts SKIP_WAITING as soon as a new SW reaches
// the `waiting` state, so a freshly-deployed build activates immediately
// instead of stalling until every tab/installed-PWA instance closes (which on
// a phone home-screen app almost never happens — that's why deploys looked
// "stuck"). On activate we clientsClaim so the new SW controls open tabs, and
// registerSW.js reloads once on `controlling`.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* ── Runtime caching — same shape as the old generateSW config in vite.config ── */

// Google Fonts CSS — stale-while-revalidate for swap on updates.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-css',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// Google Fonts files — cache-first, year-long.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// Same-origin /assets/* (hashed Vite assets) — cache-first, 30-day expiry.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'admin-static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Images — vehicle thumbnails + Supabase rental-photos.
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (url.origin === self.location.origin || url.hostname.endsWith('.supabase.co')),
  new StaleWhileRevalidate({
    cacheName: 'admin-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Navigation fallback — serve cached index.html for SPA routes, but never
// for /api/* / /login / /oauth which must hit the network.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'admin-shell',
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    {
      denylist: [/^\/api\//, /^\/login/, /^\/oauth/],
    },
  ),
);

/* ═══════════════════════════════════════════════════════════════════════════
   PUSH EVENT HANDLER — Sprint 18
   Renders the notification when the server fires a webpush. Matches the
   portal SW's pattern (src/sw.ts:113-139) but tagged differently so admin
   pushes don't collide with customer pushes if the user has both PWAs
   installed.
   ═══════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Annie\'s Dashboard', body: 'You have a new alert.' };
  }

  const title = payload.title || 'Annie\'s Dashboard';
  const tag =
    (payload.data && typeof payload.data.tag === 'string' && payload.data.tag) ||
    payload.url ||
    'annie-admin-default';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/web-app-manifest-192x192.png',
    badge: payload.badge || '/favicon-96x96.png',
    tag,
    renotify: true,
    vibrate: [40, 60, 40],
    data: { url: payload.url || '/', ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* Notification click — focus the dashboard if a tab is already open, else
 * open one. `client.navigate()` lets a focused tab deep-link to the target
 * URL (e.g. /bookings/abc-123 when the push was about that booking). */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      const targetUrl = new URL(target, self.location.origin).href;
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          // Any same-origin dashboard tab counts as "the app is open."
          if (url.origin === self.location.origin) {
            await client.focus();
            if (client.url !== targetUrl && 'navigate' in client) {
              await client.navigate(target);
            }
            return;
          }
        } catch {
          /* ignore */
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
