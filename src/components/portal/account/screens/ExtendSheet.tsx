/**
 * ExtendSheet — request a later return date, see the price + availability, and
 * pay to extend the trip. Mirrors PaySheet's source picker (saved card / new
 * card), with a date step and a live quote in front of it.
 */
import { useEffect, useRef, useState } from 'react';
import { CreditCard, Plus, Loader2, X, Check, CalendarPlus, AlertCircle } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getCards, getExtensionQuote, extendTrip, type SavedCard, type ExtensionQuote } from '../portalClient';
import { getSquarePayments, mountCard } from '../../../booking/confirm-booking/squareClient';
import { brand } from '../../../../config/brand';

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function nextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function ExtendSheet({
  tripId, currentReturnDate, onExtended, onClose,
}: {
  tripId: string;
  currentReturnDate: string;
  onExtended: () => void;
  onClose: () => void;
}) {
  const { token } = useAccountAuth();
  const [date, setDate] = useState('');
  const [quote, setQuote] = useState<ExtensionQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<any>(null);
  const [cardReady, setCardReady] = useState(false);

  useEffect(() => {
    if (!token) return;
    getCards(token).then((cs) => { setCards(cs); setSelected(cs[0]?.id ?? 'new'); }).catch(() => setSelected('new'));
  }, [token]);

  // Fetch a quote whenever the chosen date changes.
  useEffect(() => {
    if (!token || !date) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true); setError('');
    getExtensionQuote(token, tripId, date)
      .then((q) => { if (!cancelled) setQuote(q); })
      .catch((e) => { if (!cancelled) { setError(e?.message || 'Could not price that date'); setQuote(null); } })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [token, tripId, date]);

  // Mount the Square field for the new-card option once payment is reachable.
  const payable = quote?.available && quote.amount_cents > 0;
  useEffect(() => {
    if (selected !== 'new' || !payable) return;
    let destroyed = false;
    (async () => {
      try {
        const payments = await getSquarePayments();
        if (destroyed || !containerRef.current) return;
        const card = await mountCard(payments, containerRef.current, { style: { input: { color: '#111827', fontSize: '16px' } } });
        if (destroyed) { card.destroy?.(); return; }
        cardRef.current = card;
        setCardReady(true);
      } catch (e: any) {
        setError(e?.message || 'Could not load the card form');
      }
    })();
    return () => {
      destroyed = true; setCardReady(false);
      try { cardRef.current?.destroy?.(); } catch { /* noop */ }
      cardRef.current = null;
    };
  }, [selected, payable]);

  async function submit() {
    if (!token || !date || busy) return;
    setBusy(true); setError('');
    try {
      let sourceId: string | undefined;
      let savedCardId: string | undefined;
      if (selected === 'new') {
        if (!cardRef.current) throw new Error('Enter your card details');
        const result = await cardRef.current.tokenize();
        if (result.status !== 'OK' || !result.token) throw new Error(result.errors?.[0]?.message || 'Check the card details');
        sourceId = result.token;
      } else if (selected) {
        savedCardId = selected;
      } else {
        throw new Error('Select a card');
      }
      await extendTrip(token, tripId, { return_date: date, savedCardId, sourceId });
      onExtended();
    } catch (e: any) {
      setError(e?.message || 'Could not extend the trip');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8"
        style={{ backgroundColor: 'var(--bg-primary)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CalendarPlus size={18} /> Extend trip
          </h2>
          <button onClick={onClose} aria-label="Close"><X size={20} style={{ color: 'var(--text-tertiary)' }} /></button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          Current return: {currentReturnDate}
        </p>

        <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>New return date</label>
        <input
          type="date"
          value={date}
          min={nextDay(currentReturnDate)}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        />

        {quoting && (
          <div className="flex justify-center py-4" style={{ color: 'var(--text-tertiary)' }}><Loader2 size={20} className="animate-spin" /></div>
        )}

        {quote && !quoting && (
          <>
            {!quote.available ? (
              <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertCircle size={16} style={{ color: '#ef4444' }} className="mt-0.5 shrink-0" />
                <p className="text-sm" style={{ color: '#ef4444' }}>
                  This vehicle isn't available for those dates. Try an earlier return or call {brand.phone}.
                </p>
              </div>
            ) : (
              <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>+{quote.extra_days} day{quote.extra_days === 1 ? '' : 's'}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{money(quote.amount_cents)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Payment source — only when there's something to pay */}
        {payable && (
          <>
            <div className="space-y-2 mb-4">
              {cards.map((c) => (
                <SourceRow key={c.id} active={selected === c.id} onClick={() => setSelected(c.id)}
                  icon={<CreditCard size={18} style={{ color: 'var(--text-secondary)' }} />} label={`${c.brand} •••• ${c.last4}`} />
              ))}
              <SourceRow active={selected === 'new'} onClick={() => setSelected('new')}
                icon={<Plus size={18} style={{ color: 'var(--text-secondary)' }} />} label="Use a new card" />
            </div>
            {selected === 'new' && (
              <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#fff', minHeight: 56 }}>
                <div ref={containerRef} />
                {!cardReady && <div className="flex justify-center py-2"><Loader2 size={18} className="animate-spin" style={{ color: '#888' }} /></div>}
              </div>
            )}
          </>
        )}

        {error && <p className="text-sm mb-3" style={{ color: '#ef4444' }}>{error}</p>}

        <button
          onClick={submit}
          disabled={!payable || busy || (selected === 'new' && !cardReady)}
          className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: brand.colors.accent, color: '#0a0a0a', opacity: (!payable || busy || (selected === 'new' && !cardReady)) ? 0.5 : 1 }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {busy ? 'Extending…' : quote?.available ? `Extend & pay ${money(quote.amount_cents)}` : 'Extend & pay'}
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
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${active ? brand.colors.accent : 'var(--border-subtle)'}` }}
    >
      {icon}
      <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: `2px solid ${active ? brand.colors.accent : 'var(--border-subtle)'}` }}>
        {active && <span className="w-2 h-2 rounded-full" style={{ background: brand.colors.accent }} />}
      </span>
    </button>
  );
}
