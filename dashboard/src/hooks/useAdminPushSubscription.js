import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../auth/supabaseClient';

/**
 * useAdminPushSubscription
 *
 * Handles the full PushManager lifecycle for an admin:
 * - reads server push capability (GET /push/vapid-key)
 * - requests notification permission
 * - subscribes the current device (POST /push/admin/subscribe)
 * - unsubscribes the current device (POST /push/admin/unsubscribe)
 * - sends a self-test push (POST /push/admin/test)
 */

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function detectIosStandaloneRequirement() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  if (!isIos) return false;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return !standalone;
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useAdminPushSubscription() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [serverEnabled, setServerEnabled] = useState(false);
  const [vapidKey, setVapidKey] = useState(null);
  const [permission, setPermission] = useState(() =>
    supported ? Notification.permission : 'unsupported',
  );
  const [subscribed, setSubscribed] = useState(false);
  const [requiresInstall, setRequiresInstall] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supported) return undefined;
    setRequiresInstall(detectIosStandaloneRequirement());

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/push/vapid-key`);
        const json = await res.json();
        if (cancelled) return;
        setServerEnabled(Boolean(json.enabled));
        setVapidKey(json.publicKey || null);
      } catch {
        if (!cancelled) setServerEnabled(false);
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(!!existing);
      } catch {
        // SW not ready yet.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError('Push not supported on this browser');
      return;
    }
    if (!serverEnabled || !vapidKey) {
      setError('Notifications not enabled on the server');
      return;
    }
    if (requiresInstall) {
      setError('Add this site to your Home Screen first, then re-open to enable notifications.');
      return;
    }
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError(
          perm === 'denied'
            ? 'Notifications were blocked. Enable them in your iOS Settings first.'
            : 'Permission not granted.',
        );
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const headers = await authHeader();
      const res = await fetch(`${BASE}/push/admin/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Subscribe failed (${res.status}): ${text}`);
      }
      setSubscribed(true);
    } catch (e) {
      setError(e?.message || 'Subscribe failed');
    } finally {
      setLoading(false);
    }
  }, [supported, serverEnabled, vapidKey, requiresInstall]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      if (sub) await sub.unsubscribe();
      try {
        const headers = await authHeader();
        await fetch(`${BASE}/push/admin/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ endpoint }),
        });
      } catch {
        // Server pruning failure is non-fatal when client unsubscribed locally.
      }
      setSubscribed(false);
    } catch (e) {
      setError(e?.message || 'Unsubscribe failed');
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const sendTest = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch(`${BASE}/push/admin/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Test push failed (${res.status}): ${text}`);
      }
      const json = await res.json();
      if (json.sent === 0) {
        throw new Error(
          json.skipped
            ? 'Push not configured on the server (VAPID env vars missing).'
            : 'Sent — but no device received it. Re-enable notifications and try again.',
        );
      }
      return json;
    } catch (e) {
      setError(e?.message || 'Test failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

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
    sendTest,
  };
}
