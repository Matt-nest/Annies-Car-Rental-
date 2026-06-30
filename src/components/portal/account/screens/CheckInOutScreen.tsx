/**
 * CheckInOutScreen — native vehicle check-in / check-out inside the account
 * portal. Bridges the logged-in account to a booking-scoped portal token, then
 * reuses the proven SlotPhotoUploader + /portal/checkin|checkout endpoints.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Gauge, Fuel, Check, Key, CheckCircle2 } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { createPortalSession, submitCheckin, submitCheckout } from '../portalClient';
import SlotPhotoUploader, { type PhotoSlots } from '../../SlotPhotoUploader';
import { brand } from '../../../../config/brand';

const FUEL_OPTIONS = [
  { value: 'full', label: 'Full' },
  { value: 'three_quarter', label: '¾' },
  { value: 'half', label: '½' },
  { value: 'quarter', label: '¼' },
  { value: 'empty', label: 'Empty' },
];

export default function CheckInOutScreen({
  tripId, mode, onBack, onDone,
}: {
  tripId: string;
  mode: 'checkin' | 'checkout';
  onBack: () => void;
  onDone: () => void;
}) {
  const { token } = useAccountAuth();
  const accent = brand.colors.accent;
  const isCheckin = mode === 'checkin';

  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [slots, setSlots] = useState<PhotoSlots>({});
  const [allPhotos, setAllPhotos] = useState(false);
  const [odometer, setOdometer] = useState('');
  const [fuel, setFuel] = useState('full');
  const [confirmed, setConfirmed] = useState(false); // condition (checkin) / key returned (checkout)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockbox, setLockbox] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    createPortalSession(token, tripId)
      .then((r) => setPortalToken(r.token))
      .catch((e) => setSessionError(e?.message || 'Could not start check-in'));
  }, [token, tripId]);

  const canSubmit = allPhotos && confirmed && Number(odometer) > 0 && !busy && portalToken;

  async function submit() {
    if (!canSubmit || !portalToken) return;
    setBusy(true); setError('');
    try {
      const body: any = { odometer: Number(odometer), fuelLevel: fuel, photoSlots: slots };
      if (isCheckin) {
        body.conditionConfirmed = true;
        const res = await submitCheckin(portalToken, body);
        if (res.lockbox_code) setLockbox(res.lockbox_code);
        setDone(true);
      } else {
        body.keyReturned = true;
        await submitCheckout(portalToken, body);
        setDone(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Submission failed');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="px-5 pt-16 flex flex-col items-center text-center">
        <CheckCircle2 size={48} style={{ color: '#22c55e' }} />
        <h1 className="text-xl font-semibold mt-4" style={{ color: 'var(--text-primary)' }}>
          {isCheckin ? 'Check-in complete!' : 'Vehicle returned'}
        </h1>
        {isCheckin && lockbox && (
          <div className="mt-5 rounded-2xl p-5 w-full max-w-xs" style={{ background: `${accent}1a`, border: `1px solid ${accent}55` }}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Lockbox code</p>
            <p className="text-2xl font-bold font-mono tracking-widest" style={{ color: 'var(--text-primary)' }}>{lockbox}</p>
          </div>
        )}
        <p className="text-sm mt-4 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          {isCheckin ? 'Grab your keys from the lockbox and drive safe!' : "Thanks! We'll inspect the vehicle and finalize your deposit shortly."}
        </p>
        <button onClick={onDone} className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold" style={{ background: accent, color: '#0a0a0a' }}>
          Back to trip
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 pt-5 pb-4">
      <button onClick={onBack} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Trip
      </button>

      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {isCheckin ? 'Start your rental' : 'Return the vehicle'}
      </h1>
      <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
        {isCheckin
          ? 'Photograph each angle, record the odometer and fuel, then confirm to get your lockbox code.'
          : 'Park at the pickup location, photograph each angle, record the odometer and fuel, return the key, then confirm.'}
      </p>

      {sessionError && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{sessionError}</p>}

      {!portalToken && !sessionError && (
        <div className="flex justify-center py-10" style={{ color: 'var(--text-tertiary)' }}><Loader2 size={22} className="animate-spin" /></div>
      )}

      {portalToken && (
        <div className="space-y-5">
          <SlotPhotoUploader token={portalToken} onSlotsChange={(s, filled) => { setSlots(s); setAllPhotos(filled); }} />

          {/* Odometer */}
          <div>
            <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Gauge size={14} /> Odometer (miles)
            </label>
            <input
              type="number" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)}
              placeholder="e.g. 42150"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Fuel */}
          <div>
            <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Fuel size={14} /> Fuel level
            </label>
            <div className="flex gap-2">
              {FUEL_OPTIONS.map((f) => (
                <button
                  key={f.value} onClick={() => setFuel(f.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium"
                  style={{
                    border: `1px solid ${fuel === f.value ? accent : 'var(--border-subtle)'}`,
                    color: fuel === f.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: fuel === f.value ? `${accent}1a` : 'transparent',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <label
            className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer"
            style={{
              backgroundColor: confirmed ? 'rgba(34,197,94,0.08)' : 'var(--bg-card)',
              border: `1px solid ${confirmed ? 'rgba(34,197,94,0.4)' : 'var(--border-subtle)'}`,
            }}
          >
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4" />
            {isCheckin
              ? <span className="text-sm" style={{ color: 'var(--text-primary)' }}>I confirm the vehicle's condition matches the photos.</span>
              : <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><Key size={14} /> I've returned the key to the lockbox.</span>}
          </label>

          {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{ background: accent, color: '#0a0a0a', opacity: canSubmit ? 1 : 0.5 }}
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {busy ? 'Submitting…' : isCheckin ? 'Complete check-in' : 'Complete return'}
          </button>
        </div>
      )}
    </div>
  );
}
