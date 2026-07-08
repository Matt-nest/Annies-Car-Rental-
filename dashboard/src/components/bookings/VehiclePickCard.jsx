import { Check, Car, Users, Gauge, Fuel } from 'lucide-react';
import { vehicleImageUrl } from '../../lib/vehicleImage';

/**
 * VehiclePickCard — visual, selectable vehicle card for the New Booking modal.
 * Replaces the old plain text-button list with an image + rate + spec badges,
 * echoing the customer site's fleet cards. Selected state gets an accent ring.
 */
export default function VehiclePickCard({ vehicle: v, selected, onSelect }) {
  const img = vehicleImageUrl(v);
  const specs = [
    v.seats != null && { icon: Users, label: `${v.seats}` },
    (v.mpg != null || v.mpg_combined != null) && { icon: Gauge, label: `${v.mpg ?? v.mpg_combined} mpg` },
    v.fuel_type && { icon: Fuel, label: String(v.fuel_type) },
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={() => onSelect(v.id)}
      aria-pressed={selected}
      className="w-full text-left rounded-xl overflow-hidden transition-all cursor-pointer flex"
      style={{
        backgroundColor: selected ? 'var(--accent-glow)' : 'var(--bg-card)',
        border: selected ? '2px solid var(--accent-color)' : '1px solid var(--border-subtle)',
      }}
    >
      {/* Thumbnail */}
      <div
        className="shrink-0 w-24 sm:w-28 self-stretch min-h-[5.5rem] relative flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card-hover)' }}
      >
        {img ? (
          <img src={img} alt={`${v.year} ${v.make} ${v.model}`} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Car size={26} style={{ color: 'var(--text-tertiary)' }} />
        )}
        {selected && (
          <span
            className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-fg)' }}
          >
            <Check size={12} strokeWidth={3} />
          </span>
        )}
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {v.year} {v.make} {v.model}
            </p>
            <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{v.vehicle_code}</p>
          </div>
          {v.daily_rate != null && (
            <p className="text-sm font-bold tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>
              ${Number(v.daily_rate).toFixed(0)}
              <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>/day</span>
            </p>
          )}
        </div>
        {specs.length > 0 && (
          <div className="flex items-center gap-3 mt-0.5">
            {specs.map(({ icon: Icon, label }, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                <Icon size={12} /> {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
