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

// ─── Trend delta badge ────────────────────────────────────────────────────────
function TrendBadge({ pct }) {
  if (pct === null || isNaN(pct)) return null;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-1" style={{ color: up ? '#22c55e' : '#ef4444' }}>
      <Icon size={10} />
      <span className="text-[10px] font-semibold tabular-nums">
        {up ? '+' : ''}{pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, rawValue, icon: Icon, hero, sub, onClick, alert, prefix = '', suffix = '', accentColor, sparkData, trendPct }) {
  const animated = useCountUp(typeof rawValue === 'number' ? rawValue : null);
  const displayValue = typeof rawValue === 'number'
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : (rawValue ?? '—');

  if (hero) {
    return (
      <motion.div
        variants={fadeUp}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        className="glass-card relative overflow-hidden rounded-2xl p-5 cursor-pointer group col-span-2 lg:col-span-1"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          minHeight: 110,
        }}
        whileHover={{ scale: 1.01, transition: { duration: 0.2, ease: EASE } }}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
          style={{ boxShadow: 'inset 0 0 60px rgba(30,58,95,0.06)' }} />
        {alert && <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full pulse-dot" style={{ backgroundColor: 'var(--danger-color)' }} />}
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">
            <p className="display-num-xl" style={{ color: 'var(--accent-color)', lineHeight: 1 }}>
              {displayValue}
            </p>
            <p className="kpi-label mt-2">{label}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent-color)' }}>
              <Icon size={20} />
            </div>
            {sparkData && <Sparkline data={sparkData} color="var(--accent-color)" />}
            <TrendBadge pct={trendPct} />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className="glass-card relative rounded-2xl p-5 group"
      style={{
        cursor: onClick ? 'pointer' : 'default',
        minHeight: 110,
      }}
      whileHover={onClick ? { borderColor: 'var(--border-medium)', transition: { duration: 0.2 } } : undefined}
    >
      {alert && <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--danger-color)' }} />}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="display-num" style={{ fontSize: '2rem', color: accentColor || 'var(--text-primary)', lineHeight: 1 }}>
            {displayValue}
          </p>
          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="p-2.5 rounded-xl shrink-0" style={{
            backgroundColor: accentColor ? `${accentColor}18` : 'var(--bg-card-hover)',
            color: accentColor || 'var(--text-secondary)',
          }}>
            <Icon size={18} />
          </div>
          {sparkData && <Sparkline data={sparkData} color={accentColor || 'var(--accent-color)'} />}
          <TrendBadge pct={trendPct} />
        </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`rounded-xl p-5 animate-pulse ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', minHeight: 120 }}>
            <div className="h-8 w-16 rounded mb-3 animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            <div className="h-3 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
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

  return (
    <>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <KpiCard
          label="Active Rentals"
          rawValue={overview?.active_rentals ?? 0}
          icon={Car}
          hero
          sub="cars currently out"
          onClick={() => navigate('/bookings?status=active')}
        />
        <KpiCard
          label="Pending"
          rawValue={pending}
          icon={CheckCircle2}
          alert={pending > 0}
          accentColor={pending > 0 ? 'var(--danger-color)' : undefined}
          onClick={() => navigate('/bookings?status=pending_approval')}
        />
        <KpiCard
          label="Pickups Today"
          rawValue={overview?.pickups_today?.length ?? 0}
          icon={ArrowUpFromLine}
          accentColor="#63b3ed"
        />
        <KpiCard
          label="Returns Today"
          rawValue={overview?.returns_today?.length ?? 0}
          icon={ArrowDownToLine}
          accentColor="#a78bfa"
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
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
          <Star size={15} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>Avg Rating</p>
            <StarRating value={overview?.average_rating} />
          </div>
        </div>

        {agreements > 0 ? (
          <div
            className="flex items-center gap-3 flex-1 rounded-xl px-5 py-4 cursor-pointer transition-colors"
            style={{ backgroundColor: 'rgba(99,179,237,0.07)', border: '1px solid rgba(99,179,237,0.2)' }}
            onClick={() => navigate('/bookings')}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && navigate('/bookings')}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(99,179,237,0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(99,179,237,0.07)')}
          >
            <FileSignature size={15} style={{ color: '#63b3ed', flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: '#63b3ed' }}>{agreements} agreement{agreements !== 1 ? 's' : ''} to sign</p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Counter-signature needed</p>
            </div>
            <ChevronRight size={13} style={{ color: '#63b3ed', flexShrink: 0 }} />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 rounded-2xl px-5 py-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
            <CheckCheck size={14} style={{ color: '#22c55e' }} />
            <span className="text-xs font-medium" style={{ color: '#22c55e' }}>All agreements signed</span>
          </div>
        )}
      </div>
    </>
  );
}
