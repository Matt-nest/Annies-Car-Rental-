import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Loader2, AlertCircle, Check, Plus } from 'lucide-react';
import { API_URL } from '../../config';
import {
  SQUARE_APPLICATION_ID,
  SQUARE_LOCATION_ID,
  SQUARE_CONFIGURED,
  SQUARE_ENVIRONMENT
} from '../booking/confirm-booking/constants';
import { EASE } from '../../utils/motion';

declare global {
  interface Window {
    Square?: any;
  }
}

interface Card { brand: string; last4: string; }

function squareSdkUrl() {
  return SQUARE_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox.web.squarecdn.com/v1/square.js'
    : 'https://web.squarecdn.com/v1/square.js';
}

function loadSquareSdk() {
  if (window.Square) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-square-sdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Square SDK failed to load')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = squareSdkUrl();
    script.async = true;
    script.dataset.squareSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Square SDK failed to load'));
    document.head.appendChild(script);
  });
}

function SetupForm({ token, onSaved, onCancel }: {
  token: string; onSaved: (c: Card) => void; onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sdkReady, setSdkReady] = useState(false);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!SQUARE_CONFIGURED) {
        setError('Square is not configured on the server.');
        return;
      }
      try {
        await loadSquareSdk();
        if (!window.Square) throw new Error('Square SDK unavailable');
        const payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        await card.attach('#square-card-container');
        if (cancelled) {
          card.destroy?.();
          return;
        }
        cardRef.current = card;
        setSdkReady(true);
      } catch (err: any) {
        setError(err.message || 'Square payments failed to initialize');
      }
    }
    init();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.();
      cardRef.current = null;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardRef.current || saving) return;
    setSaving(true); setError('');

    try {
      const tokenResult = await cardRef.current.tokenize();

      if (tokenResult.status !== 'OK') {
        const firstError = tokenResult.errors?.[0];
        throw new Error(firstError ? `${firstError.message}` : 'Card tokenization failed');
      }

      const res = await fetch(`${API_URL}/portal/payment-method/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source_id: tokenResult.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your card');
      onSaved(data.card);
    } catch (err: any) {
      setError(err.message || 'Saving card failed.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div id="square-card-container" className="min-h-[90px]" />
      {!sdkReady && !error && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading Square secure card form…</p>}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!sdkReady || saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save card</>}
        </button>
      </div>
    </form>
  );
}

export default function PaymentMethodCard({ token }: { token: string; theme: string; }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/portal/payment-method`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (res.ok) setCard(data.card || null);
      } catch { /* silent */ }
      setLoaded(true);
    })();
  }, [token]);

  const startAdd = () => {
    setAdding(true);
    setError('');
  };

  if (!loaded) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: EASE.standard }}
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '16px' }}
    >
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-glow)' }}>
            <CreditCard size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Payment method</h3>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Used for extensions and any post-return charges.
            </p>
          </div>
        </div>

        {card && !adding && (
          <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}>
            <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
              {card.brand} •••• {card.last4}
            </span>
            <button onClick={startAdd} disabled={loading}
              className="text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-50"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : 'Update'}
            </button>
          </div>
        )}

        {!card && !adding && (
          <button onClick={startAdd} disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}>
            {loading ? <><Loader2 size={16} className="animate-spin" /> Loading…</> : <><Plus size={16} /> Add a card on file</>}
          </button>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
            backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
          }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {adding && (
          <SetupForm
            token={token}
            onSaved={(c) => { setCard(c); setAdding(false); }}
            onCancel={() => { setAdding(false); }}
          />
        )}
      </div>
    </motion.div>
  );
}
