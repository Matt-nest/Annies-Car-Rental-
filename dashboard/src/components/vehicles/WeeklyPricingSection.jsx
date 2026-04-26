import { useState, useEffect } from 'react';
import { Save, Percent, Infinity } from 'lucide-react';
import { api } from '../../api/client';

function calcWeeklyRate(dailyRate, discountPct) {
  return parseFloat(((dailyRate * 7) * (1 - discountPct / 100)).toFixed(2));
}

export default function WeeklyPricingSection({ vehicle, onSaved }) {
  const dailyRate = parseFloat(vehicle.daily_rate) || 0;

  const [discountPct, setDiscountPct] = useState(vehicle.weekly_discount_percent ?? 15);
  const [unlimitedMileage, setUnlimitedMileage] = useState(vehicle.weekly_unlimited_mileage_enabled !== false);
  const [monthlyDisplayPrice, setMonthlyDisplayPrice] = useState(vehicle.monthly_display_price ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const weeklyRate = calcWeeklyRate(dailyRate, discountPct);
  const savings = parseFloat(((dailyRate * 7) - weeklyRate).toFixed(2));

  // Reset if vehicle changes
  useEffect(() => {
    setDiscountPct(vehicle.weekly_discount_percent ?? 15);
    setUnlimitedMileage(vehicle.weekly_unlimited_mileage_enabled !== false);
    setMonthlyDisplayPrice(vehicle.monthly_display_price ?? '');
  }, [vehicle.id]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateVehicle(vehicle.id, {
        weekly_discount_percent: discountPct,
        weekly_unlimited_mileage_enabled: unlimitedMileage,
        monthly_display_price: monthlyDisplayPrice !== '' ? parseFloat(monthlyDisplayPrice) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (onSaved) onSaved();
    } catch (e) {
      console.error('WeeklyPricingSection save error', e);
    }
    setSaving(false);
  }

  const accent = 'var(--accent-color, #465FFF)';

  return (
    <div
      className="rounded-xl border p-5 space-y-5"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Weekly Pricing</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Discount applied when rental is 7+ days</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
          style={{
            backgroundColor: saved ? 'rgba(34,197,94,0.12)' : 'var(--accent)',
            color: saved ? '#22c55e' : 'var(--accent-fg)',
            border: saved ? '1px solid rgba(34,197,94,0.3)' : 'none',
          }}
        >
          <Save size={12} />
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Discount slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
            <Percent size={11} /> Weekly Discount
          </label>
          <span className="text-sm font-mono font-semibold text-[var(--text-primary)]">{discountPct}%</span>
        </div>
        <input
          type="range"
          min="5"
          max="25"
          step="1"
          value={discountPct}
          onChange={e => setDiscountPct(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: accent }}
        />
        <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] mt-1">
          <span>5%</span>
          <span>25%</span>
        </div>
      </div>

      {/* Live calculator */}
      <div
        className="rounded-lg p-3.5 space-y-2 text-sm"
        style={{ backgroundColor: 'var(--bg-card-hover)', border: '1px solid var(--border-subtle)' }}
      >
        <p className="text-[10px] uppercase tracking-widest font-medium text-[var(--text-tertiary)] mb-2">
          Live Preview — 7-Day Booking
        </p>
        <div className="flex justify-between text-[var(--text-secondary)]">
          <span>Daily rate × 7</span>
          <span className="font-mono">${(dailyRate * 7).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[var(--text-secondary)]">
          <span>{discountPct}% discount</span>
          <span className="font-mono text-red-400">−${savings.toFixed(2)}</span>
        </div>
        <div
          className="flex justify-between font-semibold border-t pt-2"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }}
        >
          <span>Weekly rate</span>
          <span className="font-mono">${weeklyRate.toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)]">
          Customer saves ${savings.toFixed(2)} vs. 7× daily rate
        </p>
      </div>

      {/* Unlimited mileage toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
            <Infinity size={13} /> Unlimited Mileage Included
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Auto-included for 7+ day rentals — hides the $100 add-on</p>
        </div>
        <button
          type="button"
          onClick={() => setUnlimitedMileage(v => !v)}
          className="relative w-10 h-5 rounded-full transition-colors duration-200"
          style={{ backgroundColor: unlimitedMileage ? accent : 'var(--border-medium)' }}
          aria-pressed={unlimitedMileage}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: unlimitedMileage ? 'translateX(20px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {/* Monthly display price */}
      <div>
        <label className="label flex items-center gap-1.5 mb-1.5">
          Monthly Display Price <span className="text-[var(--text-tertiary)] font-normal">(optional)</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">$</span>
          <input
            type="number"
            min="0"
            step="50"
            value={monthlyDisplayPrice}
            onChange={e => setMonthlyDisplayPrice(e.target.value)}
            placeholder="e.g. 1800"
            className="input pl-7"
          />
        </div>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
          Shows on customer site in Monthly mode. Leave empty to hide this vehicle from monthly listings.
        </p>
      </div>
    </div>
  );
}
