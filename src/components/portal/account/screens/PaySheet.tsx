/**
 * PaySheet — pay an outstanding trip balance with a saved card or a new card.
 * Amount is fixed (server-computed) and passed in; this component only chooses
 * the payment source and submits.
 */
import { useEffect, useRef, useState } from 'react';
import { CreditCard, Plus, Loader2, X, Check } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getCards, payTripBalance, type SavedCard } from '../portalClient';
import { getSquarePayments, mountCard } from '../../../booking/confirm-booking/squareClient';
import { brand } from '../../../../config/brand';

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaySheet({
  tripId, amountCents, onPaid, onClose,
}: {
  tripId: string;
  amountCents: number;
  onPaid: () => void;
  onClose: () => void;
}) {
  const { token } = useAccountAuth();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // saved card id, or 'new'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // New-card iframe
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    getCards(token)
      .then((cs) => {
        setCards(cs);
        setSelected(cs[0]?.id ?? 'new');
      })
      .catch(() => { setCards([]); setSelected('new'); });
  }, [token]);

  // Mount the Square field whenever "new card" is the active choice.
  useEffect(() => {
    if (selected !== 'new') return;
    let destroyed = false;
    (async () => {
      try {
        const payments = await getSquarePayments();
        if (destroyed || !containerRef.current) return;
        const card = await mountCard(payments, containerRef.current, {
          style: { input: { color: '#111827', fontSize: '16px' } },
        });
        if (destroyed) { card.destroy?.(); return; }
        cardRef.current = card;
        setCardReady(true);
      } catch (e: any) {
        setError(e?.message || 'Could not load the card form');
      }
    })();
    return () => {
      destroyed = true;
      setCardReady(false);
      try { cardRef.current?.destroy?.(); } catch { /* noop */ }
      cardRef.current = null;
    };
  }, [selected]);

  async function pay() {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      if (selected === 'new') {
        if (!cardRef.current) throw new Error('Enter your card details');
        const result = await cardRef.current.tokenize();
        if (result.status !== 'OK' || !result.token) {
          throw new Error(result.errors?.[0]?.message || 'Please check the card details');
        }
        await payTripBalance(token, tripId, { sourceId: result.token });
      } else if (selected) {
        await payTripBalance(token, tripId, { savedCardId: selected });
      } else {
        throw new Error('Select a card');
      }
      onPaid();
    } catch (e: any) {
      setError(e?.message || 'Payment failed');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ backgroundColor: 'var(--bg-primary)', maxHeight: '88vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Pay balance</h2>
          <button onClick={onClose} aria-label="Close"><X size={20} style={{ color: 'var(--text-tertiary)' }} /></button>
        </div>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Amount due <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{money(amountCents)}</span>
        </p>

        {cards === null && (
          <div className="flex justify-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        )}

        {cards && (
          <div className="space-y-2 mb-4">
            {cards.map((c) => (
              <SourceRow
                key={c.id}
                active={selected === c.id}
                onClick={() => setSelected(c.id)}
                icon={<CreditCard size={18} style={{ color: 'var(--text-secondary)' }} />}
                label={`${c.brand} •••• ${c.last4}`}
              />
            ))}
            <SourceRow
              active={selected === 'new'}
              onClick={() => setSelected('new')}
              icon={<Plus size={18} style={{ color: 'var(--text-secondary)' }} />}
              label="Use a new card"
            />
          </div>
        )}

        {selected === 'new' && (
          <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#fff', minHeight: 56 }}>
            <div ref={containerRef} />
            {!cardReady && !error && (
              <div className="flex justify-center py-2"><Loader2 size={18} className="animate-spin" style={{ color: '#888' }} /></div>
            )}
          </div>
        )}

        {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}

        <button
          onClick={pay}
          disabled={busy || (selected === 'new' && !cardReady)}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: brand.colors.accent, color: '#0a0a0a', opacity: (busy || (selected === 'new' && !cardReady)) ? 0.6 : 1 }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {busy ? 'Processing…' : `Pay ${money(amountCents)}`}
        </button>
      </div>
    </div>
  );
}

function SourceRow({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl text-left"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${active ? brand.colors.accent : 'var(--border-subtle)'}`,
      }}
    >
      {icon}
      <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center"
        style={{ border: `2px solid ${active ? brand.colors.accent : 'var(--border-subtle)'}` }}
      >
        {active && <span className="w-2 h-2 rounded-full" style={{ background: brand.colors.accent }} />}
      </span>
    </button>
  );
}
