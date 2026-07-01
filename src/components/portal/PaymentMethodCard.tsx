import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Loader2, AlertCircle, Check, Plus } from 'lucide-react';
import { Elements, useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { API_URL } from '../../config';
import { stripePromise } from '../booking/confirm-booking/constants';
import { EASE } from '../../utils/motion';

interface Card { brand: string; last4: string; }

function SetupForm({ token, clientSecret, onSaved, onCancel }: {
  token: string; clientSecret: string; onSaved: (c: Card) => void; onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true); setError('');

    const { error: setupErr, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    });
    if (setupErr) {
      setError(setupErr.message || 'Could not save your card.');
      setSaving(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/portal/payment-method/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ setup_intent_id: setupIntent?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save your card');
      onSaved(data.card);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl text-sm" style={{
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
        }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={saving}
          className="px-4 py-2.5 rounded-full text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Cancel
        </button>
        <button type="submit" disabled={!stripe || saving}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#1c1917' }}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Check size={16} /> Save card</>}
        </button>
      </div>
    </form>
  );
}

export default function PaymentMethodCard({ token, theme }: { token: string; theme: string; }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

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

  const startAdd = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/portal/payment-method/setup`, { method: 'POST', headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start card setup');
      setClientSecret(data.clientSecret);
      setAdding(true);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
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

        {adding && clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: theme === 'dark' ? 'night' : 'stripe',
                variables: { colorPrimary: '#D4AF37', borderRadius: '12px', fontFamily: '"Inter", system-ui, sans-serif' },
              },
            }}
          >
            <SetupForm
              token={token}
              clientSecret={clientSecret}
              onSaved={(c) => { setCard(c); setAdding(false); setClientSecret(null); }}
              onCancel={() => { setAdding(false); setClientSecret(null); }}
            />
          </Elements>
        )}
      </div>
    </motion.div>
  );
}
