import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';

/**
 * usePushSubscription — manages browser web push subscription state for a
 * logged-in portal customer.
 *
 * Sprint 12b.
 *
 * Flow:
 *   1. Hook detects whether PushManager is available + whether push is
 *      enabled at the backend (calls GET /push/vapid-key).
 *   2. On `subscribe()`:
 *        a. Requests Notification permission (returns 'granted' | 'denied' | 'default')
 *        b. Calls registration.pushManager.subscribe() with the VAPID key
 *        c. POSTs the subscription JSON to /push/subscribe with the portal token
 *   3. On `unsubscribe()`:
 *        a. pushManager.getSubscription().unsubscribe() (local browser)
 *        b. POSTs the endpoint to /push/unsubscribe so backend deletes the row
 *
 * Permission state is read from `Notification.permission`. We do NOT call
 * Notification.requestPermission() until the user explicitly clicks our
 * subscribe button — the "double-prompt" pattern from the research doc
 * avoids burning the permission with a cold OS prompt.
 *
 * iOS 16.4+ requires the site to be installed to the Home Screen before
 * Notification.requestPermission() can be called. The hook detects that case
 * via `window.matchMedia('(display-mode: standalone)')` and exposes
 * `requiresInstall: true` so the UI can ask the user to "Add to Home Screen"
 * first.
 */

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushSubscriptionResult {
  /** Browser supports the Push API + Notification API */
  supported: boolean;
  /** Backend is configured with VAPID keys */
  serverEnabled: boolean;
  /** OS-level notification permission */
  permission: PermissionState;
  /** True when a PushSubscription exists on this browser */
  subscribed: boolean;
  /** True only on iOS when the site isn't installed to Home Screen yet */
  requiresInstall: boolean;
  /** In-flight loading flag during subscribe/unsubscribe */
  loading: boolean;
  /** Last error string, if any */
  error: string | null;
  /** Subscribe (will prompt for permission if needed) */
  subscribe: () => Promise<void>;
  /** Unsubscribe (local + tell backend to forget) */
  unsubscribe: () => Promise<void>;
}

/** Convert the VAPID public key (base64url) to the Uint8Array format
 *  `pushManager.subscribe()` expects. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectIosStandaloneRequirement(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  if (!isIos) return false;
  // iOS allows web push only from a Home Screen install.
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari-specific
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true;
  return !standalone;
}

export function usePushSubscription(portalToken: string | null): UsePushSubscriptionResult {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [serverEnabled, setServerEnabled] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (!supported) return 'unsupported';
    return Notification.permission as PermissionState;
  });
  const [subscribed, setSubscribed] = useState(false);
  const [requiresInstall, setRequiresInstall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time: fetch VAPID key + detect iOS install requirement + check existing sub.
  useEffect(() => {
    if (!supported) return;
    setRequiresInstall(detectIosStandaloneRequirement());

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/push/vapid-key`);
        const json = await res.json();
        if (cancelled) return;
        setServerEnabled(Boolean(json.enabled));
        setVapidKey(json.publicKey || null);
      } catch {
        if (!cancelled) setServerEnabled(false);
      }

      // Check whether this browser already has a subscription.
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!existing);
      } catch { /* SW not ready / unsupported */ }
    })();

    return () => { cancelled = true; };
  }, [supported]);

  const subscribe = useCallback(async () => {
    setError(null);
    if (!supported) { setError('Push not supported on this browser'); return; }
    if (!serverEnabled || !vapidKey) { setError('Notifications not enabled yet'); return; }
    if (requiresInstall) {
      setError('Add this site to your Home Screen first to enable notifications');
      return;
    }
    if (!portalToken) { setError('Not signed in'); return; }

    setLoading(true);
    try {
      // Request permission ONLY now — double-prompt pattern.
      const perm = await Notification.requestPermission();
      setPermission(perm as PermissionState);
      if (perm !== 'granted') {
        setError(perm === 'denied' ? 'Notifications were blocked. Enable them in your browser settings.' : 'Permission not granted.');
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      // Reuse existing subscription if one already exists for this browser.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const res = await fetch(`${API_URL}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${portalToken}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Subscribe failed (${res.status}): ${text}`);
      }
      setSubscribed(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Subscribe failed');
    } finally {
      setLoading(false);
    }
  }, [supported, serverEnabled, vapidKey, requiresInstall, portalToken]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    if (!supported || !portalToken) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      // Tell the backend to drop the row — best-effort.
      try {
        await fetch(`${API_URL}/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${portalToken}` },
          body: JSON.stringify({ endpoint }),
        });
      } catch { /* ignore — local unsub already succeeded */ }
      setSubscribed(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unsubscribe failed');
    } finally {
      setLoading(false);
    }
  }, [supported, portalToken]);

  return {
    supported,
    serverEnabled,
    permission,
    subscribed,
    requiresInstall,
    loading,
    error,
    subscribe,
    unsubscribe,
  };
}
