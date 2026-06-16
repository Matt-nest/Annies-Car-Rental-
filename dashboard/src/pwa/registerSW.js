/**
 * Service worker registration for the admin dashboard.
 *
 * Auto-update: as soon as a freshly-deployed SW reaches `waiting`, we tell it
 * to skip waiting; when it takes control we reload once. This guarantees a new
 * build actually reaches installed/home-screen PWAs instead of stalling behind
 * the old cached SW. (Previously a manual "refresh" toast drove this, but the
 * SW had skipWaiting disabled so the toast couldn't actually swap the build —
 * deploys looked stuck on phones.)
 *
 * Note: a reload can land mid-task. Updates only ship on deploy (infrequent),
 * and the SPA re-fetches state on load, so the window is small — but if an
 * admin reports losing an in-progress form, switch this back to a prompt.
 */
import { Workbox } from 'workbox-window';

const SW_URL = '/sw.js';

export function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  if (navigator.webdriver) return;

  const wb = new Workbox(SW_URL, { scope: '/' });

  // Reload exactly once when the new SW takes control (guard prevents the
  // classic auto-update reload loop).
  let reloading = false;
  wb.addEventListener('controlling', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  // A new build is installed and waiting → activate it immediately.
  wb.addEventListener('waiting', () => {
    wb.messageSkipWaiting();
  });

  wb.register().catch((err) => {
    console.warn('[pwa] SW registration failed', err);
  });
}
