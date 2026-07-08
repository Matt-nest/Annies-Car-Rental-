import { Mail, Phone, User, Car, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

function money(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '$0.00';
}

function ItemizedReceipt({ booking }) {
  const lineItems = Array.isArray(booking?.line_items) ? booking.line_items : null;

  return (
    <div className="rounded-xl border p-3 space-y-2 text-sm" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card-hover)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Itemized receipt</p>

      {lineItems?.length > 0 ? (
        lineItems.map((item, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
            <span className="tabular-nums shrink-0" style={{ color: item.amount < 0 ? '#22c55e' : 'var(--text-primary)' }}>
              {item.amount < 0 ? `-${money(Math.abs(item.amount))}` : money(item.amount)}
            </span>
          </div>
        ))
      ) : (
        <>
          <div className="flex justify-between gap-3">
            <span style={{ color: 'var(--text-secondary)' }}>
              Rental ({booking?.rental_days}d × {money(booking?.daily_rate)}/day)
            </span>
            <span className="tabular-nums">{money(booking?.subtotal)}</span>
          </div>
          {Number(booking?.delivery_fee) > 0 && (
            <div className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-secondary)' }}>Delivery fee</span>
              <span className="tabular-nums">{money(booking.delivery_fee)}</span>
            </div>
          )}
          {Number(booking?.discount_amount) > 0 && (
            <div className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-secondary)' }}>Discount</span>
              <span className="tabular-nums text-emerald-500">-{money(booking.discount_amount)}</span>
            </div>
          )}
          {Number(booking?.mileage_addon_fee) > 0 && (
            <div className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-secondary)' }}>Unlimited miles</span>
              <span className="tabular-nums">{money(booking.mileage_addon_fee)}</span>
            </div>
          )}
          {Number(booking?.toll_addon_fee) > 0 && (
            <div className="flex justify-between gap-3">
              <span style={{ color: 'var(--text-secondary)' }}>Unlimited tolls</span>
              <span className="tabular-nums">{money(booking.toll_addon_fee)}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span style={{ color: 'var(--text-secondary)' }}>Tax</span>
            <span className="tabular-nums">{money(booking?.tax_amount)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between gap-3 font-semibold pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <span style={{ color: 'var(--text-primary)' }}>Rental total</span>
        <span className="tabular-nums">{money(booking?.total_cost)}</span>
      </div>
    </div>
  );
}

function CustomerDetails({ booking }) {
  const c = booking?.customers;
  const ag = Array.isArray(booking?.rental_agreements)
    ? booking.rental_agreements[0]
    : booking?.rental_agreements;
  const v = booking?.vehicles;

  return (
    <div className="rounded-xl border p-3 space-y-2 text-sm" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-card-hover)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Customer</p>
      <div className="flex items-center gap-2">
        <User size={14} style={{ color: 'var(--accent-color)' }} />
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{c?.first_name} {c?.last_name}</span>
      </div>
      {c?.email && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Mail size={12} /> {c.email}
        </div>
      )}
      {c?.phone && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Phone size={12} /> {c.phone}
        </div>
      )}
      {ag?.driver_license_number && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          DL {ag.driver_license_number} ({ag.driver_license_state || '—'})
        </p>
      )}
      {v && (
        <div className="flex items-center gap-2 text-xs pt-1" style={{ color: 'var(--text-secondary)' }}>
          <Car size={12} /> {v.year} {v.make} {v.model}
        </div>
      )}
      {booking?.pickup_date && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <Calendar size={12} />
          {format(new Date(booking.pickup_date), 'MMM d, yyyy')} → {format(new Date(booking.return_date), 'MMM d, yyyy')}
        </div>
      )}
    </div>
  );
}

/**
 * Review panel shown before admin approves a pending booking:
 * itemized receipt, customer details, high-risk flag, deposit adjustment.
 */
export default function ApproveBookingPanel({
  booking,
  isHighRisk,
  setIsHighRisk,
  depositAmount,
  setDepositAmount,
  baseDeposit,
}) {
  const depositNum = Number(depositAmount);
  const rentalTotal = Number(booking?.total_cost) || 0;
  const chargePreview = rentalTotal + (Number.isFinite(depositNum) ? depositNum : 0);

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <CustomerDetails booking={booking} />
      <ItemizedReceipt booking={booking} />

      <div
        className="rounded-xl border p-3 space-y-3"
        style={{
          borderColor: isHighRisk ? 'rgba(245,158,11,0.35)' : 'var(--border-subtle)',
          backgroundColor: isHighRisk ? 'rgba(245,158,11,0.06)' : 'var(--bg-card-hover)',
        }}
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isHighRisk}
            onChange={(e) => setIsHighRisk(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
              <AlertTriangle size={14} className="text-amber-500" />
              High-risk customer?
            </span>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Flag this renter if you want a higher security deposit or extra caution on this rental.
            </p>
          </div>
        </label>

        <div>
          <label className="label">Security deposit ($)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            className="input"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Standard for this vehicle: {money(baseDeposit)}. Customer pays rental + insurance + deposit at checkout.
          </p>
        </div>
      </div>

      <div className="flex justify-between text-sm font-semibold px-1">
        <span style={{ color: 'var(--text-secondary)' }}>Est. charge at checkout (excl. insurance)</span>
        <span className="tabular-nums" style={{ color: 'var(--accent-color)' }}>{money(chargePreview)}+</span>
      </div>
    </div>
  );
}
