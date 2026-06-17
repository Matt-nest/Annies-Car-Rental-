/**
 * WalletScreen — saved cards on file (list / add / remove).
 * Add-card mounts the Square Web Payments SDK card field (reusing the booking
 * flow's loader) and stores the tokenized card against the customer's Square
 * Customer via POST /account/cards.
 */
import { useEffect, useRef, useState } from 'react';
import { CreditCard, Plus, Trash2, Loader2, X, ShieldCheck } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getCards, addCard, removeCard, type SavedCard } from '../portalClient';
import { API_URL } from '../../../../config';
import { getSquarePayments, mountCard } from '../../../booking/confirm-booking/squareClient';
import { brand } from '../../../../config/brand';

export default function WalletScreen() {
  const { token } = useAccountAuth();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [provider, setProvider] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!token) return;
    try {
      setCards(await getCards(token));
    } catch (e: any) {
      setError(e?.message || 'Could not load cards');
      setCards([]);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/account/payments-config`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((c) => setProvider(c.provider || ''))
      .catch(() => {});
    load();
  }, [token]);

  async function onRemove(cardId: string) {
    if (!token) return;
    setCards((cs) => (cs || []).filter((c) => c.id !== cardId)); // optimistic
    try {
      await removeCard(token, cardId);
    } catch (e: any) {
      setError(e?.message || 'Could not remove card');
      load(); // re-sync on failure
    }
  }

  const squareReady = provider === 'square';

  return (
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Wallet</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Your saved payment methods.
      </p>

      {error && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{error}</p>}

      {cards === null && (
        <div className="flex justify-center py-12" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {cards && (
        <div className="space-y-3 mb-5">
          {cards.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
            >
              <CreditCard size={20} style={{ color: 'var(--text-secondary)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {c.brand} •••• {c.last4}
                </p>
                {c.exp_month && c.exp_year && (
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Expires {String(c.exp_month).padStart(2, '0')}/{String(c.exp_year).slice(-2)}
                  </p>
                )}
              </div>
              <button onClick={() => onRemove(c.id)} className="p-2" aria-label="Remove card">
                <Trash2 size={16} style={{ color: '#ef4444' }} />
              </button>
            </div>
          ))}

          {cards.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
              No saved cards yet.
            </p>
          )}
        </div>
      )}

      {squareReady && !adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
          style={{ background: brand.colors.accent, color: '#0a0a0a' }}
        >
          <Plus size={16} /> Add a card
        </button>
      )}

      {squareReady && adding && (
        <AddCardPanel
          onClose={() => setAdding(false)}
          onAdded={() => { setAdding(false); load(); }}
        />
      )}

      {provider && !squareReady && (
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-tertiary)' }}>
          To update your card, call {brand.name} at{' '}
          <a href={`tel:${brand.phone}`} style={{ color: brand.colors.accent }}>{brand.phone}</a>.
        </p>
      )}

      <div className="flex items-center justify-center gap-1.5 mt-6">
        <ShieldCheck size={13} style={{ color: 'var(--text-tertiary)' }} />
        <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Cards are stored securely by Square. {brand.name} never sees full card numbers.
        </p>
      </div>
    </div>
  );
}

function AddCardPanel({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { token } = useAccountAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let destroyed = false;
    (async () => {
      try {
        const payments = await getSquarePayments();
        if (destroyed || !containerRef.current) return;
        // Concrete colors (the card iframe is cross-origin — no CSS variables).
        const card = await mountCard(payments, containerRef.current, {
          style: { input: { color: '#111827', fontSize: '16px' }, '.input-container': { borderRadius: '10px' } },
        });
        if (destroyed) { card.destroy?.(); return; }
        cardRef.current = card;
        setReady(true);
      } catch (e: any) {
        setError(e?.message || 'Could not load the card form');
      }
    })();
    return () => {
      destroyed = true;
      try { cardRef.current?.destroy?.(); } catch { /* noop */ }
    };
  }, []);

  async function submit() {
    if (!token || !cardRef.current || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== 'OK' || !result.token) {
        throw new Error(result.errors?.[0]?.message || 'Please check the card details');
      }
      await addCard(token, result.token);
      onAdded();
    } catch (e: any) {
      setError(e?.message || 'Could not save card');
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add a card</h3>
        <button onClick={onClose} aria-label="Close"><X size={18} style={{ color: 'var(--text-tertiary)' }} /></button>
      </div>

      {/* Square card iframe mounts here on a light surface for legibility */}
      <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: '#fff', minHeight: 56 }}>
        <div ref={containerRef} />
        {!ready && !error && (
          <div className="flex justify-center py-2"><Loader2 size={18} className="animate-spin" style={{ color: '#888' }} /></div>
        )}
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}

      <button
        onClick={submit}
        disabled={!ready || busy}
        className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
        style={{ background: brand.colors.accent, color: '#0a0a0a', opacity: (!ready || busy) ? 0.6 : 1 }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {busy ? 'Saving…' : 'Save card'}
      </button>
    </div>
  );
}
