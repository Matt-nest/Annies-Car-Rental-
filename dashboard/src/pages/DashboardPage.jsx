import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, ArrowDownToLine, ArrowUpFromLine, DollarSign,
  Activity, Calendar, Clock, CheckCircle2, Star,
  FileSignature, BookOpen, ChevronRight, CheckCheck, TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import { SkeletonDashboard } from '../components/shared/Skeleton';
import { format, formatDistanceToNow, addDays, startOfDay, isSameDay } from 'date-fns';

// ─── Motion ────────────────────────────────────────────────────────────────────
const EASE = {
  dramatic: [0.16, 1, 0.3, 1],
  standard: [0.25, 1, 0.5, 1],
  smooth:   [0.65, 0, 0.35, 1],
};

const fadeUp = (delay = 0) => ({
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE.standard, delay } },
});

const stagger = { show: { transition: { staggerChildren: 0.08 } } };

// ─── Count-up Hook ─────────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const num = typeof target === 'number' ? target : parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(num) || num === 0) { setVal(target); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(target); return; }

    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 4);
      setVal(Math.round(e * num));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else setVal(target);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return val;
}

// ─── Fleet Donut ──────────────────────────────────────────────────────────────
const FLEET_SEGMENTS = [
  { key: 'available',   label: 'Available',   color: '#22c55e' },
  { key: 'rented',      label: 'Rented',      color: '#D4AF37' },
  { key: 'turo',        label: 'On Turo',     color: '#818cf8' },
  { key: 'maintenance', label: 'Maintenance', color: '#f87171' },
  { key: 'retired',     label: 'Retired',     color: '#737373' },
];

function FleetDonut({ vehicles }) {
  const counts = {};
  for (const v of vehicles) counts[v.status] = (counts[v.status] || 0) + 1;
  const total = vehicles.length;
  const active = FLEET_SEGMENTS.filter(s => counts[s.key] > 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <Car size={28} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No fleet data</p>
      </div>
    );
  }

  const r = 50, cx = 64, cy = 64, gap = 4;
  let angle = -90;
  const paths = active.map(seg => {
    const pct = counts[seg.key] / total;
    const sweep = pct * 360 - gap;
    const a1 = angle + gap / 2;
    const a2 = a1 + sweep;
    angle += pct * 360;
    const toR = d => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toR(a1)), y1 = cy + r * Math.sin(toR(a1));
    const x2 = cx + r * Math.cos(toR(a2)), y2 = cy + r * Math.sin(toR(a2));
    return { ...seg, d: `M${x1} ${y1} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2}`, count: counts[seg.key] };
  });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width={128} height={128} viewBox="0 0 128 128">
          {paths.map(p => (
            <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={14} strokeLinecap="round" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold leading-none display-num" style={{ color: 'var(--text-primary)' }}>{total}</span>
          <span className="text-[11px] tracking-wide" style={{ color: 'var(--text-tertiary)' }}>vehicles</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {paths.map(p => (
          <div key={p.key} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, rawValue, icon: Icon, hero = false, sub, onClick, alert, prefix = '', suffix = '', accentColor }) {
  const animated = useCountUp(typeof rawValue === 'number' ? rawValue : null);
  const displayValue = typeof rawValue === 'number'
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : (rawValue ?? '—');

  if (hero) {
    return (
      <motion.div
        variants={fadeUp(0)}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
        className="relative overflow-hidden rounded-xl p-5 cursor-pointer group"
        style={{
          backgroundColor: 'var(--hero-bg)',
          border: '1px solid rgba(212,175,55,0.15)',
          minHeight: '120px',
        }}
        whileHover={{ scale: 1.01, transition: { duration: 0.25, ease: EASE.smooth } }}
      >
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl"
          style={{ boxShadow: 'inset 0 0 60px rgba(212,175,55,0.06)' }}
        />
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div>
            <p className="display-num" style={{ fontSize: '2.5rem', color: 'var(--accent-color)', lineHeight: 1 }}>
              {displayValue}
            </p>
            <p className="text-sm font-medium mt-2" style={{ color: 'rgba(255,255,255,0.65)' }}>{label}</p>
            {sub && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
          </div>
          <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: 'rgba(212,175,55,0.12)', color: 'var(--accent-color)' }}>
            <Icon size={20} />
          </div>
        </div>
        {alert && (
          <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 rounded-full pulse-dot" style={{ backgroundColor: 'var(--danger-color)' }} />
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUp(0)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? e => e.key === 'Enter' && onClick() : undefined}
      className="relative rounded-xl p-5 group"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(24px)',
        cursor: onClick ? 'pointer' : 'default',
        minHeight: '120px',
      }}
      whileHover={onClick ? {
        borderColor: 'var(--border-medium)',
        transition: { duration: 0.2 }
      } : undefined}
    >
      {alert && (
        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--danger-color)' }} />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="display-num" style={{ fontSize: '2rem', color: accentColor || 'var(--text-primary)', lineHeight: 1 }}>
            {displayValue}
          </p>
          <p className="text-sm mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
        </div>
        <div className="p-2.5 rounded-xl shrink-0" style={{
          backgroundColor: accentColor ? `${accentColor}18` : 'var(--bg-card-hover)',
          color: accentColor || 'var(--text-secondary)',
        }}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Glass Card Shell ──────────────────────────────────────────────────────────
function GlassCard({ children, onClick, className = '', style = {} }) {
  return (
    <div
      onClick={onClick}
      className={`card overflow-hidden ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, action, actionLabel }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: 'var(--text-tertiary)' }} />
        <h2 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      {action && (
        <button
          onClick={action}
          className="text-xs font-medium transition-colors"
          style={{ color: 'var(--accent-color)' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {actionLabel || 'View all →'}
        </button>
      )}
    </div>
  );
}

// ─── Chart Tooltip ─────────────────────────────────────────────────────────────
function GlassTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-tooltip">
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color || 'var(--text-secondary)' }}>
          {p.name}: {prefix}{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ─── Revenue Area Chart (real API) ────────────────────────────────────────────
function RevenueChart({ revenueData }) {
  if (!revenueData?.length) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No revenue data available</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={revenueData}>
        <defs>
          <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} dy={8} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip content={<GlassTooltip prefix="$" />} />
        <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2.5} fill="url(#goldGradient)" dot={false} activeDot={{ r: 5, fill: '#D4AF37', stroke: 'var(--bg-primary)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Fleet Bar Chart (real API) ───────────────────────────────────────────────
function FleetBarChart({ vehicles }) {
  if (!vehicles?.length) return null;

  // Group by category
  const cats = {};
  for (const v of vehicles) {
    const cat = v.category || 'other';
    if (!cats[cat]) cats[cat] = { category: cat, available: 0, rented: 0, other: 0 };
    if (v.status === 'available') cats[cat].available++;
    else if (v.status === 'rented') cats[cat].rented++;
    else cats[cat].other++;
  }
  const data = Object.values(cats);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10, textTransform: 'capitalize' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
        <Tooltip content={<GlassTooltip />} />
        <Bar dataKey="available" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} name="Available" />
        <Bar dataKey="rented" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={24} name="Rented" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Revenue by Category Pie (real API) ──────────────────────────────────────
const CATEGORY_COLORS = {
  sedan: '#D4AF37',
  suv: '#22c55e',
  luxury: '#818cf8',
  economy: '#63b3ed',
  other: '#a8a29e',
};

function RevenuePieChart({ revenueByCategory }) {
  if (!revenueByCategory?.length) return null;

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="50%" height={180}>
        <PieChart>
          <Pie
            data={revenueByCategory}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={6}
            dataKey="value"
          >
            {revenueByCategory.map((entry, i) => (
              <Cell key={i} fill={entry.color || CATEGORY_COLORS[entry.name?.toLowerCase()] || '#a8a29e'} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<GlassTooltip prefix="$" />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-2.5 pr-4">
        {revenueByCategory.map(item => (
          <div key={item.name} className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color || CATEGORY_COLORS[item.name?.toLowerCase()] || '#a8a29e' }} />
            <span className="text-xs flex-1 capitalize" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              ${(item.value / 1000).toFixed(1)}k
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Today's Schedule ──────────────────────────────────────────────────────────
function TodaySchedule({ pickups, returns, onNavigate }) {
  const all = [
    ...(pickups || []).map(b => ({ ...b, _type: 'pickup', _time: b.pickup_time })),
    ...(returns || []).map(b => ({ ...b, _type: 'return', _time: b.return_time })),
  ].sort((a, b) => (a._time || '').localeCompare(b._time || ''));

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <CheckCheck size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Nothing scheduled today</p>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>Enjoy the quiet!</p>
      </div>
    );
  }

  return (
    <div>
      {all.map((b, i) => (
        <div
          key={`${b._type}-${b.id}`}
          onClick={() => onNavigate(`/bookings/${b.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onNavigate(`/bookings/${b.id}`)}
          className="px-5 py-3.5 flex items-center gap-3.5 cursor-pointer group transition-colors"
          style={{ borderBottom: i < all.length - 1 ? '1px solid var(--border-subtle)' : 'none', minHeight: 54 }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div
            className="shrink-0 text-center py-1 px-2.5 rounded-xl text-xs font-semibold min-w-[52px]"
            style={{
              backgroundColor: b._type === 'pickup' ? 'rgba(99,179,237,0.12)' : 'rgba(167,139,250,0.12)',
              color: b._type === 'pickup' ? '#63b3ed' : '#a78bfa',
            }}
          >
            {b._time?.slice(0, 5) || '—'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {b.customers?.first_name} {b.customers?.last_name}
            </p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
            </p>
          </div>
          <span className="badge shrink-0 gap-1" style={{
            backgroundColor: b._type === 'pickup' ? 'rgba(99,179,237,0.1)' : 'rgba(167,139,250,0.1)',
            color: b._type === 'pickup' ? '#63b3ed' : '#a78bfa',
          }}>
            {b._type === 'pickup' ? <ArrowUpFromLine size={9} /> : <ArrowDownToLine size={9} />}
            {b._type === 'pickup' ? 'Pickup' : 'Return'}
          </span>
          <ChevronRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      ))}
    </div>
  );
}

// ─── 7-Day Strip ──────────────────────────────────────────────────────────────
function WeekStrip({ pickups, returns, onNavigate }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const byPickup = {}, byReturn = {};
  for (const b of pickups || []) {
    if (!byPickup[b.pickup_date]) byPickup[b.pickup_date] = [];
    byPickup[b.pickup_date].push(b);
  }
  for (const b of returns || []) {
    if (!byReturn[b.return_date]) byReturn[b.return_date] = [];
    byReturn[b.return_date].push(b);
  }

  const selKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selAll = selKey ? [
    ...(byPickup[selKey] || []).map(b => ({ ...b, _type: 'pickup' })),
    ...(byReturn[selKey]  || []).map(b => ({ ...b, _type: 'return' })),
  ] : [];

  return (
    <div>
      <div className="flex px-5 py-3 gap-2 overflow-x-auto no-scrollbar">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const pc = byPickup[key]?.length || 0;
          const rc = byReturn[key]?.length || 0;
          const isToday = isSameDay(day, today);
          const isSel = selectedDay && isSameDay(day, selectedDay);
          const hasAny = pc + rc > 0;

          return (
            <button
              key={key}
              onClick={() => setSelectedDay(d => d && isSameDay(d, day) ? null : (hasAny ? day : null))}
              className="flex flex-col items-center gap-1.5 py-2.5 px-3 rounded-xl min-w-[52px] transition-all duration-200"
              style={{
                backgroundColor: isSel ? 'var(--accent-color)' : isToday ? 'var(--accent-glow)' : hasAny ? 'var(--bg-card-hover)' : 'transparent',
                border: isToday && !isSel ? '1px solid var(--accent-color)' : '1px solid transparent',
                opacity: !hasAny ? 0.4 : 1,
                cursor: hasAny ? 'pointer' : 'default',
                minHeight: 64,
              }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: isSel ? 'var(--accent-fg)' : 'var(--text-tertiary)' }}>
                {format(day, 'EEE')}
              </span>
              <span className="text-sm font-bold"
                style={{ color: isSel ? 'var(--accent-fg)' : isToday ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5">
                {pc > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.8)' : '#63b3ed' }} />}
                {rc > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSel ? 'rgba(255,255,255,0.6)' : '#a78bfa' }} />}
                {!hasAny && <span className="w-1.5 h-1.5" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-5 pb-3 flex items-center gap-4">
        {[['#63b3ed', 'Pickup'], ['#a78bfa', 'Return']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
            {l}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {selectedDay && selAll.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: EASE.standard }}
            className="overflow-hidden"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <div className="px-5 py-3" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                {format(selectedDay, 'EEEE, MMMM d')}
              </p>
              <div className="space-y-2">
                {selAll.map(b => (
                  <div
                    key={`${b._type}-${b.id}`}
                    onClick={() => onNavigate(`/bookings/${b.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onNavigate(`/bookings/${b.id}`)}
                    className="flex items-center gap-2.5 py-1 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                    style={{ minHeight: 36 }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: b._type === 'pickup' ? '#63b3ed' : '#a78bfa' }} />
                    <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {b._type === 'pickup' ? b.pickup_time?.slice(0, 5) : b.return_time?.slice(0, 5)}
                    </span>
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                      {b.customers?.first_name} {b.customers?.last_name}
                    </span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {b.vehicles?.make} {b.vehicles?.model}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
function ActivityFeed({ activity, onNavigate }) {
  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Activity size={24} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>No recent activity</p>
      </div>
    );
  }

  return (
    <div>
      {activity.map((log, i) => (
        <div
          key={log.id}
          onClick={() => log.booking_id && onNavigate(`/bookings/${log.booking_id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && log.booking_id && onNavigate(`/bookings/${log.booking_id}`)}
          className="px-5 py-3.5 flex items-start gap-3 cursor-pointer transition-colors group"
          style={{ borderBottom: i < activity.length - 1 ? '1px solid var(--border-subtle)' : 'none', minHeight: 54 }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <div className="flex flex-col items-center shrink-0 mt-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-color)' }} />
            {i < activity.length - 1 && (
              <div className="w-px flex-1 min-h-[20px] mt-1" style={{ backgroundColor: 'var(--border-subtle)' }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              <span className="font-medium">
                {log.bookings?.customers?.first_name} {log.bookings?.customers?.last_name}
              </span>
              {log.bookings?.booking_code && (
                <span className="mono-code text-xs ml-1.5" style={{ color: 'var(--text-tertiary)' }}>
                  {log.bookings.booking_code}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {log.from_status && <StatusBadge status={log.from_status} />}
              {log.from_status && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>→</span>}
              <StatusBadge status={log.to_status} />
            </div>
          </div>
          <p className="text-xs shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function StarRating({ value }) {
  if (!value) return <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No reviews yet</span>;
  const num = parseFloat(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} size={13}
            style={{ color: i <= Math.round(num) ? '#D4AF37' : 'var(--border-medium)' }}
            fill={i <= Math.round(num) ? '#D4AF37' : 'none'}
          />
        ))}
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{num.toFixed(1)}</span>
    </div>
  );
}

// ─── Mobile Quick Actions ─────────────────────────────────────────────────────
function MobileQuickActions({ pendingApprovals, navigate }) {
  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 px-4 py-3 flex gap-2.5"
      style={{
        backgroundColor: 'var(--header-bg)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <button
        onClick={() => navigate('/bookings?status=pending_approval')}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors relative"
        style={{
          backgroundColor: pendingApprovals > 0 ? 'var(--accent-glow)' : 'var(--bg-card)',
          color: pendingApprovals > 0 ? 'var(--accent-color)' : 'var(--text-secondary)',
          minHeight: 54,
        }}
      >
        {pendingApprovals > 0 && (
          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--danger-color)', color: '#fff' }}>
            {pendingApprovals}
          </span>
        )}
        <CheckCircle2 size={19} />
        <span className="text-[11px] font-medium">Approve</span>
      </button>
      <button
        onClick={() => navigate('/bookings')}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', minHeight: 54 }}
      >
        <BookOpen size={19} />
        <span className="text-[11px] font-medium">Bookings</span>
      </button>
      <button
        onClick={() => navigate('/fleet')}
        className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', minHeight: 54 }}
      >
        <Car size={19} />
        <span className="text-[11px] font-medium">Fleet</span>
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [overview, setOverview]   = useState(null);
  const [upcoming, setUpcoming]   = useState(null);
  const [activity, setActivity]   = useState([]);
  const [vehicles, setVehicles]   = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [revenueByCategory, setRevenueByCategory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getUpcoming(),
      api.getActivity(10),
      api.getVehicles(),
      api.getRevenue({ period: 'daily', days: 14 }).catch(() => []),
      api.getVehicleStats().catch(() => null),
    ]).then(([ov, up, act, vehs, rev, vStats]) => {
      setOverview(ov);
      setUpcoming(up);
      setActivity(act);
      setVehicles(vehs || []);

      // Transform revenue data for chart
      if (Array.isArray(rev)) {
        setRevenueData(rev.map(r => ({
          label: r.date ? format(new Date(r.date), 'MMM d') : r.label || '',
          total: Number(r.total || r.amount || 0),
        })));
      }

      // Build revenue by category from vehicle stats or bookings
      if (vStats?.revenue_by_category) {
        const cats = Object.entries(vStats.revenue_by_category).map(([name, value]) => ({
          name,
          value: Number(value),
          color: CATEGORY_COLORS[name.toLowerCase()] || '#a8a29e',
        }));
        setRevenueByCategory(cats);
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) return <SkeletonDashboard />;

  const pending = overview?.pending_approvals || 0;
  const agreements = overview?.pending_agreements || 0;

  return (
    <>
      <div className="p-4 sm:p-6 pb-28 lg:pb-8 max-w-7xl mx-auto space-y-5">

        {/* ── Page Header ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE.standard }}
          className="flex items-end justify-between gap-4 pt-1"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-color)' }}>
              Annie's Rentals
            </p>
            <h1
              className="text-3xl sm:text-4xl font-medium leading-none tracking-tight display-num"
              style={{ color: 'var(--text-primary)' }}
            >
              {greeting()}
            </h1>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              {format(new Date(), 'EEEE, MMMM d')} — here's your day at a glance.
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-2 shrink-0 pb-1">
            {pending > 0 && (
              <button onClick={() => navigate('/bookings?status=pending_approval')} className="btn btn-primary flex items-center gap-2">
                <CheckCircle2 size={14} />
                Approve
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>{pending}</span>
              </button>
            )}
            <button onClick={() => navigate('/bookings')} className="btn btn-secondary"><BookOpen size={14} /> Bookings</button>
            <button onClick={() => navigate('/fleet')} className="btn btn-secondary"><Car size={14} /> Fleet</button>
          </div>
        </motion.div>

        {/* ── Action Alerts ─────────────────────────────────── */}
        <AnimatePresence>
          {(pending > 0 || agreements > 0) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-2 overflow-hidden">
              {pending > 0 && (
                <div
                  className="card p-4 flex items-center justify-between cursor-pointer group"
                  style={{ backgroundColor: 'var(--accent-glow)', borderColor: 'rgba(212,175,55,0.2)' }}
                  onClick={() => navigate('/bookings?status=pending_approval')}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/bookings?status=pending_approval')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: 'var(--accent-color)' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>{pending} booking{pending !== 1 ? 's' : ''} waiting for approval</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Review and approve or decline</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--accent-color)' }}>Review →</span>
                </div>
              )}
              {agreements > 0 && (
                <div
                  className="card p-4 flex items-center justify-between cursor-pointer"
                  style={{ backgroundColor: 'rgba(99,179,237,0.07)', borderColor: 'rgba(99,179,237,0.2)' }}
                  onClick={() => navigate('/bookings')}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/bookings')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: '#63b3ed' }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#63b3ed' }}>{agreements} rental agreement{agreements !== 1 ? 's' : ''} need{agreements === 1 ? 's' : ''} your counter-signature</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Open the booking and use the Rental Agreement section</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: '#63b3ed' }}>View →</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KPI Row ─────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Active Rentals" rawValue={overview?.active_rentals ?? 0} icon={Car} hero sub="cars currently out" onClick={() => navigate('/bookings?status=active')} />
          <KpiCard label="Pending" rawValue={pending} icon={CheckCircle2} alert={pending > 0} accentColor={pending > 0 ? 'var(--danger-color)' : undefined} onClick={() => navigate('/bookings?status=pending_approval')} />
          <KpiCard label="Pickups Today" rawValue={overview?.pickups_today?.length ?? 0} icon={ArrowUpFromLine} accentColor="#63b3ed" />
          <KpiCard label="Returns Today" rawValue={overview?.returns_today?.length ?? 0} icon={ArrowDownToLine} accentColor="#a78bfa" />
          <KpiCard label="Revenue / Month" rawValue={Math.round(parseFloat(overview?.revenue_this_month || 0))} icon={DollarSign} accentColor="#22c55e" prefix="$" sub={`${overview?.bookings_this_month ?? 0} bookings`} onClick={() => navigate('/revenue')} />
        </motion.div>

        {/* ── Charts Row ─────────────────────────────────────── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          <motion.div variants={fadeUp(0.05)}>
            <GlassCard>
              <SectionHeader icon={TrendingUp} title="Revenue Trend" action={() => navigate('/revenue')} actionLabel="Full Report →" />
              <div className="p-5" style={{ height: 280 }}>
                <RevenueChart revenueData={revenueData} />
              </div>
            </GlassCard>
          </motion.div>
          <motion.div variants={fadeUp(0.1)}>
            <GlassCard>
              <SectionHeader icon={Car} title="Fleet by Category" action={() => navigate('/fleet')} actionLabel="Manage →" />
              <div className="p-5" style={{ height: 280 }}>
                <FleetBarChart vehicles={vehicles} />
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* ── Middle Zone ─────────────────────────────────────── */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid lg:grid-cols-5 gap-4">
          <motion.div variants={fadeUp(0.1)} className="lg:col-span-3 space-y-4">
            <GlassCard>
              <SectionHeader icon={Clock} title={`Today — ${format(new Date(), 'EEEE, MMMM d')}`} />
              <TodaySchedule pickups={overview?.pickups_today} returns={overview?.returns_today} onNavigate={navigate} />
            </GlassCard>
            <GlassCard>
              <SectionHeader icon={Calendar} title="Next 7 Days" action={() => navigate('/calendar')} actionLabel="Calendar →" />
              <WeekStrip pickups={upcoming?.pickups || []} returns={upcoming?.returns || []} onNavigate={navigate} />
            </GlassCard>
          </motion.div>

          <motion.div variants={fadeUp(0.15)} className="lg:col-span-2 space-y-4">
            <GlassCard onClick={() => navigate('/fleet')} style={{ cursor: 'pointer' }}>
              <SectionHeader icon={Car} title="Fleet Status" action={() => navigate('/fleet')} actionLabel="Manage →" />
              <div className="p-5">
                <FleetDonut vehicles={vehicles} />
              </div>
            </GlassCard>

            {/* Revenue by Category */}
            {revenueByCategory.length > 0 && (
              <GlassCard>
                <SectionHeader icon={DollarSign} title="Revenue by Category" />
                <div className="p-5">
                  <RevenuePieChart revenueByCategory={revenueByCategory} />
                </div>
              </GlassCard>
            )}

            <GlassCard>
              <SectionHeader icon={Star} title="Performance" />
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs mb-1.5 uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>Average Rating</p>
                  <StarRating value={overview?.average_rating} />
                </div>
                {agreements > 0 ? (
                  <div
                    className="flex items-center gap-2.5 p-3 rounded-xl cursor-pointer transition-colors"
                    style={{ backgroundColor: 'rgba(99,179,237,0.07)', border: '1px solid rgba(99,179,237,0.15)' }}
                    onClick={() => navigate('/bookings')}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/bookings')}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(99,179,237,0.12)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(99,179,237,0.07)'}
                  >
                    <FileSignature size={15} style={{ color: '#63b3ed', flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold" style={{ color: '#63b3ed' }}>{agreements} agreement{agreements !== 1 ? 's' : ''} to sign</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Counter-signature needed</p>
                    </div>
                    <ChevronRight size={13} style={{ color: '#63b3ed', flexShrink: 0 }} />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCheck size={14} style={{ color: '#22c55e' }} />
                    <span className="text-xs font-medium" style={{ color: '#22c55e' }}>All agreements signed</span>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>

        {/* ── Recent Activity ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE.standard, delay: 0.25 }}>
          <GlassCard>
            <SectionHeader icon={Activity} title="Recent Activity" action={() => navigate('/bookings')} actionLabel="All bookings →" />
            <ActivityFeed activity={activity} onNavigate={navigate} />
          </GlassCard>
        </motion.div>

      </div>

      <MobileQuickActions pendingApprovals={pending} navigate={navigate} />
    </>
  );
}
