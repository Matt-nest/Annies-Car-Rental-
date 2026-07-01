/**
 * TripDetailScreen — native overview of a single rental.
 * Read-only summary (status, vehicle, dates, location, price, deposit, invoice)
 * plus the lockbox code once active. Actionable steps (check-in / check-out)
 * deep-link into the proven legacy per-booking flow for now; Phase 5 brings
 * trip extension + native check-in into this screen.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Car, Calendar, MapPin, Key, Loader2, Receipt, Shield } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getTrip, getTripBalance, type TripDetail, type TripBalance } from '../portalClient';
import { statusMeta, vehicleName, fmtDate } from './tripStatus';
import PaySheet from './PaySheet';
import ExtendSheet from './ExtendSheet';
import CheckInOutScreen from './CheckInOutScreen';
import { brand } from '../../../../config/brand';

const EXTENDABLE = new Set(['approved', 'confirmed', 'ready_for_pickup', 'active']);

const money = (n?: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtTime = (t?: string) => {
  if (!t || !t.includes(':')) return t || '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export default function TripDetailScreen({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const { token } = useAccountAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [balance, setBalance] = useState<TripBalance | null>(null);
  const [paying, setPaying] = useState(false);
  const [extending, setExtending] = useState(false);
  const [checkMode, setCheckMode] = useState<'checkin' | 'checkout' | null>(null);
  const [error, setError] = useState('');

  async function reloadTrip() {
    if (!token) return;
    try { setTrip(await getTrip(token, tripId)); } catch { /* keep current */ }
  }

  async function loadBalance() {
    if (!token) return;
    try { setBalance(await getTripBalance(token, tripId)); } catch { /* balance is optional */ }
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTrip(token, tripId);
        if (!cancelled) setTrip(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load trip');
      }
    })();
    loadBalance();
    return () => { cancelled = true; };
  }, [token, tripId]);

  const accent = brand.colors.accent;

  // Native check-in/out takes over the whole view.
  if (checkMode && trip) {
    return (
      <CheckInOutScreen
        tripId={tripId}
        mode={checkMode}
        onBack={() => setCheckMode(null)}
        onDone={async () => { setCheckMode(null); await reloadTrip(); }}
      />
    );
  }

  return (
    <div className="px-5 pt-5">
      <button onClick={onBack} className="flex items-center gap-1.5 mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <ArrowLeft size={16} /> Trips
      </button>

      {!trip && !error && (
        <div className="flex justify-center py-16" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}
      {error && <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>}

      {trip && (
        <>
          {/* Vehicle hero */}
          <div
            className="rounded-2xl overflow-hidden mb-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="aspect-[16/9] flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
              {trip.vehicle?.thumbnail_url
                ? <img src={trip.vehicle.thumbnail_url} alt="" className="w-full h-full object-cover" />
                : <Car size={40} style={{ color: 'var(--text-tertiary)' }} />}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {vehicleName(trip.vehicle)}
                  </h1>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {trip.booking_code}
                  </p>
                </div>
                <StatusPill status={trip.status} />
              </div>
            </div>
          </div>

          {/* Lockbox — only when active */}
          {trip.lockbox_code && (
            <div
              className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: `${accent}1a`, border: `1px solid ${accent}55` }}
            >
              <Key size={20} style={{ color: accent }} />
              <div>
                <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Lockbox code</p>
                <p className="text-xl font-bold font-mono tracking-widest" style={{ color: 'var(--text-primary)' }}>
                  {trip.lockbox_code}
                </p>
              </div>
            </div>
          )}

          {/* Schedule */}
          <Section icon={Calendar} title="Schedule">
            <KV label="Pickup" value={`${fmtDate(trip.pickup_date)}${trip.pickup_time ? ` · ${fmtTime(trip.pickup_time)}` : ''}`} />
            <KV label="Return" value={`${fmtDate(trip.return_date)}${trip.return_time ? ` · ${fmtTime(trip.return_time)}` : ''}`} />
            {trip.pickup_location && (
              <KV label="Location" value={trip.pickup_location} icon={MapPin} />
            )}
          </Section>

          {/* Price */}
          <Section icon={Receipt} title="Charges">
            {trip.subtotal != null && <KV label="Subtotal" value={money(trip.subtotal)} />}
            {!!trip.delivery_fee && <KV label="Delivery" value={money(trip.delivery_fee)} />}
            {!!trip.tax_amount && <KV label="Tax" value={money(trip.tax_amount)} />}
            <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Total</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {money(trip.total_price || trip.total_cost)}
              </span>
            </div>
            {trip.deposit && (
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Shield size={15} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Deposit {money(trip.deposit.amount)} · {trip.deposit.status}
                </span>
              </div>
            )}
          </Section>

          {/* Outstanding balance → pay now */}
          {balance?.has_balance && (
            <button
              onClick={() => setPaying(true)}
              className="w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-semibold mt-2"
              style={{ background: accent, color: '#0a0a0a' }}
            >
              <span>Pay balance</span>
              <span>{money(balance.amount_cents / 100)}</span>
            </button>
          )}

          {/* Extend trip — for active/upcoming rentals */}
          {EXTENDABLE.has(trip.status) && (
            <button
              onClick={() => setExtending(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold mt-2"
              style={{ border: `1px solid ${accent}`, color: accent, background: 'transparent' }}
            >
              Extend trip
            </button>
          )}

          {/* Native check-in / return */}
          {trip.status === 'ready_for_pickup' && (
            <button
              onClick={() => setCheckMode('checkin')}
              className="block w-full text-center py-3 rounded-xl text-sm font-semibold mt-2"
              style={{ background: accent, color: '#0a0a0a' }}
            >
              Start check-in
            </button>
          )}
          {trip.status === 'active' && (
            <button
              onClick={() => setCheckMode('checkout')}
              className="block w-full text-center py-3 rounded-xl text-sm font-semibold mt-2"
              style={{ background: accent, color: '#0a0a0a' }}
            >
              Return vehicle
            </button>
          )}

          <p className="text-xs text-center mt-6 mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Need help? Call <a href={`tel:${brand.phone}`} style={{ color: accent }}>{brand.phone}</a>
          </p>

          {paying && balance?.has_balance && (
            <PaySheet
              tripId={tripId}
              amountCents={balance.amount_cents}
              onClose={() => setPaying(false)}
              onPaid={async () => {
                setPaying(false);
                await loadBalance();
                await reloadTrip();
              }}
            />
          )}

          {extending && (
            <ExtendSheet
              tripId={tripId}
              currentReturnDate={trip.return_date}
              onClose={() => setExtending(false)}
              onExtended={async () => {
                setExtending(false);
                await reloadTrip();
                await loadBalance();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const m = statusMeta(status);
  return (
    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0" style={{ backgroundColor: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color: 'var(--text-tertiary)' }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function KV({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
        {Icon && <Icon size={13} />} {label}
      </span>
      <span className="text-sm text-right" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
