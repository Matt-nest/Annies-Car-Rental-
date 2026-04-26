import { motion } from 'motion/react';
import { TrendingUp, CheckCircle2, Infinity } from 'lucide-react';
import { calcRentalDays, calcPriceBreakdown } from '../../utils/pricing';

interface WeeklyUpsellProps {
  startDate: string;
  endDate: string;
  dailyRate: number;
  weeklyDiscountPercent?: number;
  unlimitedMileageEnabled?: boolean;
}

export default function WeeklyUpsell({
  startDate,
  endDate,
  dailyRate,
  weeklyDiscountPercent = 15,
  unlimitedMileageEnabled = true,
}: WeeklyUpsellProps) {
  if (!startDate || !endDate) return null;

  const days = calcRentalDays(startDate, endDate);
  if (days < 5) return null;

  const isWeekly = days >= 7;
  const breakdown = calcPriceBreakdown({
    dailyRate,
    discountPct: weeklyDiscountPercent,
    unlimitedMileageEnabled,
    startDate,
    endDate,
  });

  if (isWeekly) {
    // Success state: they're already on a weekly rate
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl p-4"
        style={{
          backgroundColor: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: '#22c55e' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: '#22c55e' }}>Weekly rate applied</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {breakdown
                ? `You're saving $${breakdown.savingsVsDaily.toFixed(2)} vs. daily pricing`
                : `${weeklyDiscountPercent}% off daily rate`}
              {unlimitedMileageEnabled && ' · Unlimited mileage included'}
            </p>
            {breakdown && breakdown.rateType !== 'daily' && (
              <div className="flex items-center gap-1.5 mt-2">
                {unlimitedMileageEnabled && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
                    style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.06)' }}
                  >
                    <Infinity size={9} /> Unlimited miles
                  </span>
                )}
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
                  style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.06)' }}
                >
                  {breakdown.fullWeeks > 1 ? `${breakdown.fullWeeks} weeks` : '1 week'}
                  {breakdown.remainderDays > 0 ? ` + ${breakdown.remainderDays}d` : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Nudge state: 5-6 days — show savings if they extend to a full week
  const daysNeeded = 7 - days;
  const weeklyRate = parseFloat(((dailyRate * 7) * (1 - weeklyDiscountPercent / 100)).toFixed(2));
  const currentCost = parseFloat((dailyRate * days).toFixed(2));
  const saving = parseFloat((currentCost - weeklyRate).toFixed(2));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl p-4"
      style={{
        backgroundColor: 'rgba(212,175,55,0.08)',
        border: '1px solid rgba(212,175,55,0.25)',
      }}
    >
      <div className="flex items-start gap-3">
        <TrendingUp size={16} className="mt-0.5 shrink-0" style={{ color: '#D4AF37' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: '#D4AF37' }}>
            Add {daysNeeded} day{daysNeeded !== 1 ? 's' : ''} and unlock the weekly rate
          </p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            A full week costs <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>${weeklyRate.toFixed(2)}</span>
            {saving > 0 ? (
              <> — you'd <span className="font-semibold" style={{ color: '#D4AF37' }}>save ${saving.toFixed(2)}</span> vs. your current {days} days</>
            ) : (
              <> at {weeklyDiscountPercent}% off daily pricing</>
            )}
            {unlimitedMileageEnabled && ', plus unlimited mileage'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
