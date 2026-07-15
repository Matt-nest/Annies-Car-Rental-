import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BadgePercent, CalendarClock, Crown, Megaphone, Star } from 'lucide-react';
import { growthApi } from '../api/growth';
import DataError from '../components/shared/DataError';
import { MonthlyInquiriesPanel } from './MonthlyInquiriesPage';
import { ReviewsPanel } from './ReviewsPage';
import { PricingRulesPanel } from './PricingRulesPage';
import { LoyaltyPanel } from './LoyaltyPage';

const TABS = [
  {
    key: 'leads',
    label: 'Monthly Leads',
    role: 'Pipeline',
    icon: CalendarClock,
    accent: '#63b3ed',
    Panel: MonthlyInquiriesPanel,
    metric: (summary) => summary?.leads?.new ? `${summary.leads.new} new` : `${summary?.leads?.total || 0} total`,
  },
  {
    key: 'reviews',
    label: 'Reviews',
    role: 'Reputation',
    icon: Star,
    accent: '#E79B3C',
    Panel: ReviewsPanel,
    metric: (summary) => summary?.reviews?.pending ? `${summary.reviews.pending} pending` : `${summary?.reviews?.live || 0} live`,
  },
  {
    key: 'pricing',
    label: 'Pricing Rules',
    role: 'Revenue',
    icon: BadgePercent,
    accent: '#22c55e',
    Panel: PricingRulesPanel,
    metric: (summary) => summary?.pricing?.live ? `${summary.pricing.live} live` : `${summary?.pricing?.upcoming || 0} upcoming`,
  },
  {
    key: 'loyalty',
    label: 'Loyalty',
    role: 'Retention',
    icon: Crown,
    accent: '#a78bfa',
    Panel: LoyaltyPanel,
    metric: (summary) => `${summary?.loyalty?.total || 0} renters`,
  },
];

export default function GrowthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const currentTab = searchParams.get('tab') || 'leads';
  const active = useMemo(
    () => TABS.find(tab => tab.key === currentTab) || TABS[0],
    [currentTab],
  );
  const ActivePanel = active.Panel;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryError(null);
      try {
        const data = await growthApi.getSummary();
        if (!cancelled) setSummary(data);
      } catch (e) {
        console.error('[Growth] summary failed:', e);
        if (!cancelled) setSummaryError(e?.message || 'Could not load growth summary');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function selectTab(key) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  }

  return (
    <div className="page-shell lg:p-8 space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
            <Megaphone size={14} />
            Growth
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Growth</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-2xl">
            Leads, public trust, seasonal pricing, and repeat renters in one workspace.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const selected = active.key === tab.key;
          const metric = tab.metric(summary);
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectTab(tab.key)}
              aria-current={selected ? 'page' : undefined}
              className="group min-h-[82px] rounded-xl border p-3 text-left transition-all"
              style={{
                backgroundColor: selected ? 'var(--bg-card)' : 'transparent',
                borderColor: selected ? tab.accent : 'var(--border-subtle)',
                boxShadow: selected ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight" style={{ color: selected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {tab.label}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: selected ? tab.accent : 'var(--text-tertiary)' }}>
                    {tab.role}
                  </p>
                  <p className="text-[11px] mt-2 font-semibold" style={{ color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {metric}
                  </p>
                </div>
                <span
                  className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                  style={{
                    color: selected ? tab.accent : 'var(--text-tertiary)',
                    backgroundColor: selected ? `${tab.accent}18` : 'var(--bg-card)',
                    borderColor: selected ? `${tab.accent}45` : 'var(--border-subtle)',
                  }}
                >
                  <Icon size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <DataError message={summaryError} />

      <div className="min-w-0">
        <ActivePanel embedded />
      </div>
    </div>
  );
}
