/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import brand from './config/brand';

const FALLBACK_TITLE = `${brand.name} Admin`;

// Precache the admin shell. Vite + injectManifest inlines the list at build time.
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Auto-update handoff from src/pwa/registerSW.js.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Google Fonts CSS.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-css',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// Google Fonts files.
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

// Same-origin /assets/* (hashed Vite assets).
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'admin-static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Images (same-origin + Supabase-hosted images).
registerRoute(
  ({ url, request }) =>
    request.destination === 'image' &&
    (url.origin === self.location.origin || url.hostname.endsWith('.supabase.co')),
  new StaleWhileRevalidate({
    cacheName: 'admin-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

// Navigation fallback for SPA routes.
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

// Admin push notification renderer.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: FALLBACK_TITLE, body: 'You have a new alert.' };
  }

  const title = payload.title || FALLBACK_TITLE;
  const tag =
    (payload.data && typeof payload.data.tag === 'string' && payload.data.tag) ||
    payload.url ||
    'annies-admin-default';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/pwa-icon-192.svg',
    badge: payload.badge || '/pwa-icon-192.svg',
    tag,
    renotify: true,
    vibrate: [40, 60, 40],
    data: { url: payload.url || '/', ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

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
          if (url.origin === self.location.origin) {
            await client.focus();
            if (client.url !== targetUrl && 'navigate' in client) {
              await client.navigate(target);
            }
            return;
          }
        } catch {
          // Ignore malformed client URLs.
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
