import { useState, useEffect, useCallback } from 'react';
import { Crown, Star, Award, Medal, Users, TrendingUp, ChevronRight } from 'lucide-react';
import { supabase } from '../auth/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DataError from '../components/shared/DataError';
import { SkeletonTable } from '../components/shared/Skeleton';

const BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function authFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${BASE}${path}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

const TIER_META = {
  vip:    { label: 'VIP',    icon: Crown,  color: '#E79B3C', bg: 'rgba(212,175,55,0.12)',  discount: 15 },
  gold:   { label: 'Gold',   icon: Star,   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  discount: 10 },
  silver: { label: 'Silver', icon: Award,  color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', discount: 8  },
  bronze: { label: 'Bronze', icon: Medal,  color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',  discount: 5  },
};

function TierBadge({ tier, size = 'sm' }) {
  const meta = TIER_META[tier];
  if (!meta) return null;
  const Icon = meta.icon;
  const isLg = size === 'lg';
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${isLg ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'}`}
      style={{ backgroundColor: meta.bg, color: meta.color }}
    >
      <Icon size={isLg ? 13 : 11} />
      {meta.label}
    </span>
  );
}

function fmt(n) {
  return n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) ?? '$0';
}

export default function LoyaltyPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/loyalty/customers');
      setData(res);
    } catch (e) {
      console.error('[Loyalty]', e);
      setError(e?.message || 'Failed to load loyalty customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const customers = (data?.customers || []).filter(c => {
    if (filterTier !== 'all' && c.tier !== filterTier) return false;
    if (search) {
      const q = search.toLowerCase();
      return `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q);
    }
    return true;
  });

  const breakdown = data?.breakdown || {};
  const totalLoyalty = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const StatCard = ({ tier, count }) => {
    const meta = TIER_META[tier];
    const Icon = meta.icon;
    return (
      <button
        onClick={() => setFilterTier(filterTier === tier ? 'all' : tier)}
        className="rounded-xl p-4 border text-left cursor-pointer transition-all hover:opacity-90 min-w-0"
        style={{
          backgroundColor: filterTier === tier ? meta.bg : 'var(--bg-card)',
          borderColor: filterTier === tier ? meta.color : 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} style={{ color: meta.color }} />
          <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <p className="text-2xl font-bold text-[var(--text-primary)]">{count}</p>
        <p className="text-xs text-[var(--text-tertiary)]">{meta.discount}% off</p>
      </button>
    );
  };

  return (
    <div className="page-shell lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Customer Loyalty</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Repeat customers receive automatic discounts at booking</p>
      </div>

      <DataError error={error} onRetry={load} />

      {/* Tier stats — 2-col on phone, full row on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(TIER_META).map(([key]) => (
          <StatCard key={key} tier={key} count={breakdown[key] || 0} />
        ))}
        <div className="rounded-xl p-4 border border-[var(--border-subtle)] text-left min-w-0" style={{ backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-[var(--text-tertiary)]" />
            <span className="text-xs font-semibold text-[var(--text-tertiary)]">Total</span>
          </div>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{totalLoyalty}</p>
          <p className="text-xs text-[var(--text-tertiary)]">loyal customers</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-color)]"
        />
        {filterTier !== 'all' && (
          <button
            onClick={() => setFilterTier('all')}
            className="px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Customer list */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-16 text-center">
          <TrendingUp size={32} className="mx-auto mb-3 text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {search || filterTier !== 'all' ? 'No customers match' : 'No loyalty customers yet'}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">Customers earn a tier after their first completed rental</p>
        </div>
      ) : (
        <>
        <div className="hidden md:block rounded-xl border border-[var(--border-subtle)] overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Tier</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Rentals</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Total Spent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Last Rental</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text-primary)]">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{c.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">{c.completed_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">{fmt(c.total_spent)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {c.last_rental ? new Date(c.last_rental + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight size={14} className="text-[var(--text-tertiary)] ml-auto" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden rounded-xl border border-[var(--border-subtle)] divide-y overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          {customers.map((c, i) => (
            <motion.button
              type="button"
              key={c.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/customers/${c.id}`)}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 min-h-[56px]"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.first_name} {c.last_name}</p>
                  <TierBadge tier={c.tier} />
                </div>
                <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{c.email}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                  <span>{c.completed_count} rentals</span>
                  <span>{fmt(c.total_spent)}</span>
                </div>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} className="shrink-0" />
            </motion.button>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
