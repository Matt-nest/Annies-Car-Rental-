import { useEffect } from 'react';
import { DollarSign, Percent, Calendar, Car, Sparkles } from 'lucide-react';
import { calcAdminQuote, calcRentalDays, formatMoney } from '../../lib/bookingPricing';
import { vehicleImageUrl } from '../../lib/vehicleImage';

const fieldLabel = 'text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1 block';

function Line({ label, value, accent, bold }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-[var(--text-tertiary)] shrink-0">{label}</span>
      <span
        className={`tabular-nums text-right ${bold ? 'font-bold' : 'font-medium'}`}
        style={{ color: accent ? 'var(--accent-color)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Rental quote calculator for the New Booking modal — daily rate, weekly discount,
 * deposit, and optional exact-total override.
 */
export default function BookingPricingPanel({
  vehicle,
  pickupDate,
  returnDate,
  dailyRate,
  onDailyRateChange,
  applyWeeklyDiscount,
  onApplyWeeklyDiscountChange,
  weeklyDiscountPct,
  onWeeklyDiscountPctChange,
  depositAmount,
  onDepositAmountChange,
  exactPriceEnabled,
  onExactPriceEnabledChange,
  exactPrice,
  onExactPriceChange,
  unlimitedMiles = false,
  unlimitedTolls = false,
}) {
  const rentalDays = calcRentalDays(pickupDate, returnDate);
  const quote = calcAdminQuote({
    dailyRate,
    pickupDate,
    returnDate,
    applyWeeklyDiscount,
    weeklyDiscountPct,
    unlimitedMileageEnabled: vehicle?.weekly_unlimited_mileage_enabled !== false,
    unlimitedMiles,
    unlimitedTolls,
  });

  const img = vehicleImageUrl(vehicle);
  const showWeekly = rentalDays >= 7;
  const displayTotal = exactPriceEnabled && Number(exactPrice) > 0
    ? Number(exactPrice)
    : quote?.rentalTotal;

  // Seed exact price from calculator when override is first enabled.
  useEffect(() => {
    if (exactPriceEnabled && !exactPrice && quote?.rentalTotal) {
      onExactPriceChange(String(quote.rentalTotal.toFixed(2)));
    }
  }, [exactPriceEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!vehicle) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      {/* Selected vehicle header with thumbnail */}
      <div
        className="flex items-center gap-3 p-3"
        style={{ backgroundColor: 'var(--accent-glow)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div
          className="shrink-0 w-20 h-14 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
        >
          {img ? (
            <img
              src={img}
              alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <Car size={22} style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate text-[var(--text-primary)]">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-xs font-mono text-[var(--text-tertiary)]">{vehicle.vehicle_code}</p>
        </div>
        {rentalDays > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 justify-end">
              <Calendar size={12} /> {rentalDays} day{rentalDays !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <div className="p-3 space-y-3" style={{ backgroundColor: 'var(--bg-card)' }}>
        {/* Daily rate */}
        <div>
          <label className={fieldLabel}>Daily rate</label>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="number"
              min="1"
              step="0.01"
              className="input w-full pl-8 tabular-nums"
              value={dailyRate}
              onChange={e => onDailyRateChange(e.target.value)}
            />
          </div>
          {Number(dailyRate) !== Number(vehicle.daily_rate) && (
            <p className="text-[11px] mt-1 text-[var(--text-tertiary)]">
              Vehicle list rate: ${formatMoney(vehicle.daily_rate)}/day
            </p>
          )}
        </div>

        {/* Weekly discount */}
        {showWeekly && (
          <div
            className="p-3 rounded-xl space-y-3"
            style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Weekly discount</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {applyWeeklyDiscount
                    ? `${rentalDays} days — weekly block pricing`
                    : 'Charging flat daily rate (no weekly discount)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onApplyWeeklyDiscountChange(!applyWeeklyDiscount)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: applyWeeklyDiscount ? 'var(--accent-color)' : 'var(--bg-card)',
                  color: applyWeeklyDiscount ? 'var(--accent-fg)' : 'var(--text-secondary)',
                  border: applyWeeklyDiscount ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                {applyWeeklyDiscount ? 'Applied' : 'Apply'}
              </button>
            </div>

            {applyWeeklyDiscount && (
              <div>
                <label className={fieldLabel}>Discount %</label>
                <div className="relative">
                  <Percent size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    className="input w-full pl-8 tabular-nums"
                    value={weeklyDiscountPct}
                    onChange={e => onWeeklyDiscountPctChange(e.target.value)}
                  />
                </div>
                {quote && quote.savingsVsDaily > 0 && (
                  <p className="text-[11px] mt-1 text-emerald-600 font-medium">
                    Saves ${formatMoney(quote.savingsVsDaily)} vs flat daily rate
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Breakdown */}
        {quote && !exactPriceEnabled && (
          <div className="space-y-1.5 py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {quote.rateType === 'weekly' && (
              <Line
                label={quote.fullWeeks === 1 ? '1 week' : `${quote.fullWeeks} weeks`}
                value={`$${formatMoney(quote.fullWeeks * quote.weeklyRate)}`}
              />
            )}
            {quote.rateType === 'weekly_mixed' && (
              <>
                {quote.fullWeeks > 0 && (
                  <Line
                    label={quote.fullWeeks === 1 ? '1 week' : `${quote.fullWeeks} weeks`}
                    value={`$${formatMoney(quote.fullWeeks * quote.weeklyRate)}`}
                  />
                )}
                {quote.remainderDays > 0 && (
                  <Line
                    label={quote.remainderDays === 1 ? '1 day' : `${quote.remainderDays} days`}
                    value={`$${formatMoney(quote.remainderDays * quote.dailyRate)}`}
                  />
                )}
              </>
            )}
            {quote.rateType === 'daily' && (
              <Line
                label={`${quote.rentalDays} day${quote.rentalDays !== 1 ? 's' : ''} × $${formatMoney(quote.dailyRate)}`}
                value={`$${formatMoney(quote.subtotal)}`}
              />
            )}
            {quote.mileageFee > 0 && <Line label="Unlimited miles" value={`$${formatMoney(quote.mileageFee)}`} />}
            {quote.tollFee > 0 && <Line label="Unlimited tolls" value={`$${formatMoney(quote.tollFee)}`} />}
            {quote.mileageIncluded && quote.rateType !== 'daily' && (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                <Sparkles size={11} /> Unlimited mileage included
              </p>
            )}
            <Line label={`Tax (${Math.round(quote.taxRate * 100)}%)`} value={`$${formatMoney(quote.tax)}`} />
            <Line label="Rental total" value={`$${formatMoney(quote.rentalTotal)}`} bold />
          </div>
        )}

        {/* Deposit */}
        <div>
          <label className={fieldLabel}>Security deposit</label>
          <div className="relative">
            <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="number"
              min="0"
              step="0.01"
              className="input w-full pl-8 tabular-nums"
              value={depositAmount}
              onChange={e => onDepositAmountChange(e.target.value)}
            />
          </div>
          <p className="text-[11px] mt-1 text-[var(--text-tertiary)]">
            Refundable hold collected at checkout. Default $150.
          </p>
        </div>

        {/* Exact override */}
        <div
          className="p-3 rounded-xl space-y-3"
          style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
        >
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={exactPriceEnabled}
              onChange={e => onExactPriceEnabledChange(e.target.checked)}
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Override rental total</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Set any exact rental amount (before deposit &amp; insurance).
              </p>
            </div>
          </label>

          {exactPriceEnabled && (
            <div>
              <label className={fieldLabel}>Exact rental total</label>
              <div className="relative">
                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="input w-full pl-8 tabular-nums"
                  value={exactPrice}
                  onChange={e => onExactPriceChange(e.target.value)}
                  placeholder={quote ? quote.rentalTotal.toFixed(2) : ''}
                />
              </div>
            </div>
          )}
        </div>

        {/* Grand summary */}
        {displayTotal != null && (
          <div
            className="flex justify-between items-center px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'var(--accent-glow)', border: '1px solid var(--border-subtle)' }}
          >
            <div>
              <p className="text-xs text-[var(--text-tertiary)]">Customer pays at checkout</p>
              <p className="text-[11px] text-[var(--text-tertiary)]">Rental + deposit (+ insurance on their link)</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                ${formatMoney(displayTotal + (Number(depositAmount) || 0))}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                ${formatMoney(displayTotal)} rental · ${formatMoney(depositAmount)} deposit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
