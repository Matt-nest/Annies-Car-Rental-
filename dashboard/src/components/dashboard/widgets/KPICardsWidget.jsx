import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, CheckCircle2, ArrowUpFromLine, ArrowDownToLine,
  DollarSign, Star, FileSignature, CheckCheck, ChevronRight, TrendingUp, TrendingDown,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import { useCountUp } from '../../../hooks/useCountUp';

const EASE = [0.25, 1, 0.5, 1];
const stagger = { show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = 'var(--accent-color)' }) {
  if (!data || data.length < 2) return null;
  return (
    <div style={{ width: 72, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Trend Badge — TailAdmin style with pill + "Vs last month" ────────────────
function TrendBadge({ pct }) {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{
          backgroundColor: up ? 'var(--kpi-positive-bg)' : 'var(--kpi-negative-bg)',
          color: up ? 'var(--kpi-positive-text)' : 'var(--kpi-negative-text)',
        }}
      >
        <Icon size={12} />
        {up ? '+' : ''}{pct.toFixed(1)}%
      </span>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Vs last month</span>
    </div>
  );
}

// ─── KPI Card — TailAdmin reference layout ────────────────────────────────────
// Layout: icon (top-left in colored square) → label → big number → trend badge
function KpiCard({ label, rawValue, icon: Icon, sub, onClick, alert, prefix = '', suffix = '', accentColor, sparkData, trendPct }) {
  const animated = useCountUp(typeof rawValue === 'number' ? rawValue : null);
  const displayValue = typeof rawValue === 'number'
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : (rawValue ?? '—');

  const iconBg = accentColor ? `${accentColor}18` : 'var(--accent-glow)';
  const iconColor = accentColor || 'var(--accent-color)';

  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className="liquid-glass relative p-7 group"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {alert && <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full pulse-dot" style={{ backgroundColor: 'var(--danger-color)' }} />}

      {/* Top — icon + label + big number */}
      <div className="relative z-10">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: iconBg, color: iconColor }}
        >
          <Icon size={20} strokeWidth={1.8} />
        </div>

        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>

        <p className="display-num" style={{ color: 'var(--text-primary)' }}>
          {displayValue}
        </p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
      </div>

      {/* Bottom — trend badge + sparkline */}
      <div className="flex items-end justify-between relative z-10">
        <TrendBadge pct={trendPct} />
        {sparkData && <Sparkline data={sparkData} color={iconColor} />}
      </div>
    </motion.div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value }) {
  if (!value) return <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No reviews yet</span>;
  const num = parseFloat(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={13}
            style={{ color: i <= Math.round(num) ? '#F59E0B' : 'var(--border-medium)' }}
            fill={i <= Math.round(num) ? '#F59E0B' : 'none'} />
        ))}
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{num.toFixed(1)}</span>
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────
export default function KPICardsWidget() {
  const [overview, setOverview] = useState(null);
  const [dailyRev, setDailyRev] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      cachedQuery('overview', () => api.getOverview()),
      cachedQuery('revenue-daily-14', () => api.getRevenue({ period: 'daily', days: 14 }).catch(() => [])),
    ])
      .then(([ov, rev]) => {
        setOverview(ov);
        if (Array.isArray(rev)) {
          setDailyRev(rev.map((r) => ({ v: Number(r.total || r.amount || 0), date: r.date })));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl p-6 animate-pulse"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', minHeight: 160 }}>
            <div className="w-10 h-10 rounded-xl mb-4 skeleton" />
            <div className="h-3 w-20 rounded mb-2 skeleton" />
            <div className="h-7 w-24 rounded skeleton" />
          </div>
        ))}
      </div>
    );
  }

  // Compute 7-day trend for revenue
  const last7 = dailyRev.slice(-7);
  const prev7 = dailyRev.slice(-14, -7);
  const last7Sum = last7.reduce((s, d) => s + d.v, 0);
  const prev7Sum = prev7.reduce((s, d) => s + d.v, 0);
  const revTrend = prev7Sum > 0 ? ((last7Sum - prev7Sum) / prev7Sum) * 100 : null;
  const sparkData = last7.length >= 2 ? last7 : null;

  const pending = overview?.pending_approvals || 0;
  const agreements = overview?.pending_agreements || 0;
  const totalPending = pending + agreements;

  return (
    <>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <KpiCard
          label="Active Rentals"
          rawValue={overview?.active_rentals ?? 0}
          icon={Car}
          sub="cars currently out"
          onClick={() => navigate('/bookings?status=active')}
        />
        <KpiCard
          label="Pending"
          rawValue={totalPending}
          icon={CheckCircle2}
          alert={totalPending > 0}
          accentColor={totalPending > 0 ? 'var(--danger-color)' : undefined}
          sub={totalPending > 0 ? `${pending} approval${pending !== 1 ? 's' : ''} · ${agreements} sign${agreements !== 1 ? 's' : ''}` : undefined}
          onClick={() => {
            const el = document.querySelector('[data-widget="pending-approvals"]') || document.querySelector('[data-widget="pending-counter-sign"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else navigate('/bookings?status=pending_approval');
          }}
        />
        <KpiCard
          label="Check-Ins & Outs"
          rawValue={overview?.pickups_today?.length ?? 0}
          icon={ArrowUpFromLine}
          accentColor="#63b3ed"
          sub="today's activity"
          onClick={() => navigate('/check-ins')}
        />
        <KpiCard
          label="Revenue / Month"
          rawValue={Math.round(parseFloat(overview?.revenue_this_month || 0))}
          icon={DollarSign}
          accentColor="#22c55e"
          prefix="$"
          sub={`${overview?.bookings_this_month ?? 0} bookings`}
          onClick={() => navigate('/revenue')}
          sparkData={sparkData}
          trendPct={revTrend}
        />
      </motion.div>

      {/* Performance row */}
      <div className="flex flex-col sm:flex-row gap-6 mt-5">
        <div className="flex-1 liquid-glass px-5 py-4 flex items-center gap-4">
          <Star size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          <div className="relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Avg Rating</p>
            <StarRating value={overview?.average_rating} />
          </div>
        </div>

        {agreements > 0 ? (
          <div
            className="flex items-center gap-3 flex-1 liquid-glass px-5 py-4 cursor-pointer"
            onClick={() => navigate('/bookings')}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/bookings')}
          >
            <FileSignature size={15} style={{ color: '#63b3ed', flexShrink: 0 }} className="relative z-10" />
            <div className="flex-1 min-w-0 relative z-10">
              <p className="text-xs font-semibold" style={{ color: '#63b3ed' }}>{agreements} agreement{agreements !== 1 ? 's' : ''} to sign</p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Counter-signature needed</p>
            </div>
            <ChevronRight size={13} style={{ color: '#63b3ed', flexShrink: 0 }} className="relative z-10" />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 liquid-glass px-5 py-4">
            <CheckCheck size={14} style={{ color: '#22c55e' }} className="relative z-10" />
            <span className="text-xs font-medium relative z-10" style={{ color: '#22c55e' }}>All agreements signed</span>
          </div>
        )}
      </div>
    </>
  );
}
