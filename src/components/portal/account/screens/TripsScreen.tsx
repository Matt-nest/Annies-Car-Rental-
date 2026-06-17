/**
 * TripsScreen — the signed-in customer's rentals, grouped into Current /
 * Upcoming / Past. Tap a trip to open its detail.
 */
import { useEffect, useState } from 'react';
import { Car, ChevronRight, Loader2 } from 'lucide-react';
import { useAccountAuth } from '../AccountAuthContext';
import { getTrips, type TripSummary } from '../portalClient';
import { groupTrips, statusMeta, vehicleName, fmtDate, type TripGroup } from './tripStatus';
import { brand } from '../../../../config/brand';

const GROUP_LABEL: Record<TripGroup, string> = {
  current: 'Current',
  upcoming: 'Upcoming',
  past: 'Past',
};
const GROUP_ORDER: TripGroup[] = ['current', 'upcoming', 'past'];

export default function TripsScreen({ onOpenTrip }: { onOpenTrip: (id: string) => void }) {
  const { token } = useAccountAuth();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getTrips(token);
        if (!cancelled) setTrips(data);
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || 'Could not load trips'); setTrips([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const grouped = trips ? groupTrips(trips) : null;
  const isEmpty = trips && trips.length === 0;

  return (
    <div className="px-5 pt-6">
      <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Your trips
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        Manage current and past rentals.
      </p>

      {trips === null && (
        <div className="flex justify-center py-16" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {error && <p className="text-sm mb-4" style={{ color: '#ef4444' }}>{error}</p>}

      {isEmpty && (
        <div
          className="rounded-2xl px-5 py-12 flex flex-col items-center text-center"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--bg-primary)' }}>
            <Car size={22} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No trips to show yet</p>
          <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-tertiary)' }}>
            Your rentals will appear here. Questions? Call {brand.name} at{' '}
            <a href={`tel:${brand.phone}`} style={{ color: brand.colors.accent }}>{brand.phone}</a>.
          </p>
        </div>
      )}

      {grouped && !isEmpty && (
        <div className="space-y-7">
          {GROUP_ORDER.map((g) =>
            grouped[g].length ? (
              <section key={g}>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-tertiary)' }}>
                  {GROUP_LABEL[g]}
                </h2>
                <div className="space-y-3">
                  {grouped[g].map((t) => <TripCard key={t.id} trip={t} onClick={() => onOpenTrip(t.id)} />)}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip, onClick }: { trip: TripSummary; onClick: () => void }) {
  const meta = statusMeta(trip.status);
  const v = trip.vehicles;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {v?.thumbnail_url
          ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
          : <Car size={22} style={{ color: 'var(--text-tertiary)' }} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {vehicleName(v)}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {fmtDate(trip.pickup_date)} → {fmtDate(trip.return_date)}
        </p>
        <span
          className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: meta.bg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <ChevronRight size={18} style={{ color: 'var(--text-tertiary)' }} className="shrink-0" />
    </button>
  );
}
