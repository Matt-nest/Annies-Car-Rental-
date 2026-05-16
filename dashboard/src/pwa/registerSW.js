/**
 * Service worker registration for the admin dashboard.
 *
 * Same pattern as the customer site (src/pwa/registerSW.ts) but JavaScript
 * (the dashboard is JSX, not TSX) and with admin-flavored toast copy.
 *
 * Critical: registerType: 'prompt' in vite.config.js means we NEVER swap the
 * SW silently. An admin mid-check-in needs a stable session.
 */
import { Workbox } from 'workbox-window';

const TOAST_ID = 'pwa-update-toast';
const SW_URL = '/sw.js';

export function registerSW() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;
  if (navigator.webdriver) return;

  const wb = new Workbox(SW_URL, { scope: '/' });

  wb.addEventListener('waiting', () => {
    showUpdateToast(() => {
      wb.addEventListener('controlling', () => window.location.reload());
      wb.messageSkipWaiting();
    });
  });

  wb.register().catch((err) => {
    console.warn('[pwa] SW registration failed', err);
  });
}

function showUpdateToast(onAccept) {
  if (document.getElementById(TOAST_ID)) return;

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
    transform: translateX(-50%);
    background: var(--bg-elevated, #1F2A37);
    color: var(--text-primary, #F1F5F9);
    border: 1px solid var(--border-medium, #3B4A5E);
    border-radius: 9999px;
    padding: 10px 14px 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    z-index: 99999;
    max-width: calc(100vw - 32px);
  `;

  const message = document.createElement('span');
  message.textContent = 'A new admin build is ready.';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Refresh';
  button.style.cssText = `
    background: var(--accent-color, #465FFF);
    color: var(--accent-fg, #FFFFFF);
    border: none;
    padding: 8px 14px;
    border-radius: 9999px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    min-height: 36px;
  `;
  button.onclick = () => {
    toast.remove();
    onAccept();
  };

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '×';
  dismiss.style.cssText = `
    background: transparent;
    color: var(--text-tertiary, #6B7280);
    border: none;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    padding: 0 4px;
  `;
  dismiss.onclick = () => toast.remove();

  toast.appendChild(message);
  toast.appendChild(button);
  toast.appendChild(dismiss);
  document.body.appendChild(toast);
}
