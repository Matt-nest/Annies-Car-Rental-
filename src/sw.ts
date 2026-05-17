/// <reference lib="webworker" />

/**
 * Annie's Car Rental — customer-site service worker.
 *
 * Sprint 12b. Switched from vite-plugin-pwa's `generateSW` mode to
 * `injectManifest` so we can attach a custom `push` event handler. All the
 * runtime caching strategies that used to live in `vite.config.ts` are now
 * imported from workbox-* modules below.
 *
 * Lifecycle:
 *   - On install: precache the shell injected by vite-plugin-pwa.
 *   - On activate: clean up old precaches; clientsClaim() so we control all
 *     open tabs after the user accepts the in-app refresh prompt.
 *   - On push: show a system notification using the payload from the
 *     backend's `pushService.sendToCustomer`.
 *   - On notificationclick: focus an open portal tab, or open the URL the
 *     payload pointed to.
 *
 * SW updates are gated by an in-app prompt (registerType: 'prompt'), so we
 * NEVER skipWaiting() automatically — Sprint 5a contract.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// ── Precache (injected at build time by vite-plugin-pwa) ──────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Runtime caching ────────────────────────────────────────────────────────

// Google Fonts CSS — SWR.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-css',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Google Fonts woff2 — Cache First, 1y.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-files',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// Same-origin hashed assets (/assets/*) — Cache First, 30d.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// Same-origin images (/public/* photos like hero, fleet) — SWR, 30d.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// SPA navigation fallback — serve cached index.html when offline.
// Denylist /api/* + /admin/* so backend calls + admin routes never get
// intercepted by the SW (matches Sprint 5a contract).
const navFallback = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'navigations',
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
  {
    denylist: [/^\/api\//, /^\/admin/],
  }
);
registerRoute(navFallback);

// Explicit: backend API requests always go straight to network. Setting a
// NetworkOnly default for non-matched requests ensures we never accidentally
// cache booking state, payment intents, or auth tokens.
setDefaultHandler(new NetworkOnly());

// ── Push event handler (Sprint 12b) ───────────────────────────────────────

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    // Older Safari occasionally sends an empty payload — treat as a generic ping.
    payload = { title: 'Annie\'s Car Rental', body: 'You have a new update.' };
  }

  const title = payload.title || 'Annie\'s Car Rental';
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || '/web-app-manifest-192x192.png',
    badge: payload.badge || '/favicon-96x96.png',
    // Group notifications by URL so a second notification for the same booking
    // replaces the first instead of stacking.
    tag: typeof payload.data?.tag === 'string' ? payload.data.tag : payload.url || 'annie-default',
    // Re-notify the user even if a tagged notification was already showing.
    renotify: true,
    // Allow OS to vibrate if it's installed as a home-screen app.
    // @ts-expect-error — vibrate is widely supported but missing from some TS lib targets
    vibrate: [40, 60, 40],
    data: { url: payload.url || '/portal', ...payload.data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const target = (event.notification.data && (event.notification.data as { url?: string }).url) || '/portal';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Prefer an already-open portal tab on the same origin.
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith('/portal')) {
            await client.focus();
            // Navigate within that tab to the specific URL if it changed.
            if (client.url !== new URL(target, self.location.origin).href && 'navigate' in client) {
              // @ts-expect-error — WindowClient.navigate is well-supported
              await client.navigate(target);
            }
            return;
          }
        } catch { /* ignore */ }
      }
      // No portal tab open — pop a new one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

// ── Update gating ──────────────────────────────────────────────────────────
// New SW installs in waiting state. The page's registerSW.ts shows an in-app
// toast; the user accepts → posts SKIP_WAITING → we activate → reload.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
