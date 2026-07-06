/**
 * Service worker registration with a user-driven update flow.
 *
 * registerType: "prompt" means updates wait until the user approves refresh.
 * We do not auto-reload during booking/payment flows.
 */
import { Workbox } from 'workbox-window';

const TOAST_ID = 'pwa-update-toast';
const SW_URL = '/sw.js';

export function registerSW(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  // Skip in dev where HMR and service workers conflict.
  if (import.meta.env.DEV) return;

  // Skip automated browser tests.
  if (navigator.webdriver) return;

  const wb = new Workbox(SW_URL, { scope: '/' });

  wb.addEventListener('waiting', () => {
    showUpdateToast(() => {
      wb.addEventListener('controlling', () => window.location.reload());
      void wb.messageSkipWaiting();
    });
  });

  void wb.register().catch((err) => {
    // SW failures are non-fatal; online app still works.
    // eslint-disable-next-line no-console
    console.warn('[pwa] SW registration failed', err);
  });
}

function showUpdateToast(onAccept: () => void): void {
  if (document.getElementById(TOAST_ID)) return;

  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 16px);
    transform: translateX(-50%);
    background: var(--bg-elevated, #1a1a1a);
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-medium, rgba(255,255,255,0.15));
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
    animation: pwa-toast-in 200ms ease-out;
  `;

  const message = document.createElement('span');
  message.textContent = 'A new version is available.';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Refresh';
  button.style.cssText = `
    background: var(--accent-color, #D4AF37);
    color: var(--accent-fg, #0A0A0A);
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
  dismiss.textContent = 'x';
  dismiss.style.cssText = `
    background: transparent;
    color: var(--text-tertiary, rgba(255,255,255,0.6));
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
