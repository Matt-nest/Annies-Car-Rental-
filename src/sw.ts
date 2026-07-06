/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Precache generated at build time by vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Google Fonts CSS.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-css',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// Google Fonts font files.
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

// Built assets.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Same-origin images.
registerRoute(
  ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// SPA navigations with offline fallback behavior.
const navFallback = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'navigations',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 })],
  }),
  {
    denylist: [/^\/api\//, /^\/admin/],
  }
);
registerRoute(navFallback);

// Never cache unmatched requests (booking state, payments, auth tokens).
setDefaultHandler(new NetworkOnly());

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

const BRAND_NAME = import.meta.env.VITE_BRAND_NAME || "Annie's Car Rental";
const FALLBACK_ICON = '/brand/annies-wordmark-charcoal.svg';
const FALLBACK_BADGE = '/brand/annies-wordmark-charcoal.svg';

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    payload = { title: BRAND_NAME, body: 'You have a new update.' };
  }

  const title = payload.title || BRAND_NAME;
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: payload.body || '',
    icon: payload.icon || FALLBACK_ICON,
    badge: payload.badge || FALLBACK_BADGE,
    tag: typeof payload.data?.tag === 'string' ? payload.data.tag : payload.url || 'annies-default',
    renotify: true,
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
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith('/portal')) {
            await client.focus();
            if (client.url !== new URL(target, self.location.origin).href && 'navigate' in client) {
              await client.navigate(target);
            }
            return;
          }
        } catch {
          // Ignore malformed URLs and continue.
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })()
  );
});

// Updates are user-gated by registerSW.ts update prompt.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
