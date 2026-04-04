import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car, ArrowDownToLine, ArrowUpFromLine, DollarSign,
  Activity, Calendar, Clock, CheckCircle2, Star,
  FileSignature, BookOpen, ChevronRight, CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format, formatDistanceToNow, addDays, startOfDay, isSameDay } from 'date-fns';

// ─── Animations ────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.35, ease: 'easeOut' } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

// ─── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null || target === undefined) return;
    const num = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) { setValue(target); return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(target); return; }

    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setValue(Math.round(eased * num));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
      else setValue(target);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ─── Fleet SVG Donut ──────────────────────────────────────────────────────────

const FLEET_COLORS = {
  available:   { fill: '#22c55e', label: 'Available',   dark: '#16a34a' },
  rented:      { fill: '#f59e0b', label: 'Rented',      dark: '#d97706' },
  turo:        { fill: '#6366f1', label: 'On Turo',     dark: '#4f46e5' },
  maintenance: { fill: '#ef4444', label: 'Maintenance', dark: '#dc2626' },
  retired:     { fill: '#a8a29e', label: 'Retired',     dark: '#78716c' },
};

function FleetDonut({ vehicles }) {
  const counts = {};
  for (const v of vehicles) counts[v.status] = (counts[v.status] || 0) + 1;
  const total = vehicles.length;
  const segments = Object.entries(counts).filter(([, c]) => c > 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-stone-400 dark:text-stone-600 text-sm">
        <Car size={32} className="mb-2 opacity-40" />
        No vehicles in fleet
      </div>
    );
  }

  const r = 52;
  const cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const gap = 3; // gap between segments in degrees

  let currentAngle = -90;
  const paths = segments.map(([status, count]) => {
    const pct = count / total;
    const angle = pct * 360 - gap;
    const start = currentAngle + gap / 2;
    const end = start + angle;
    currentAngle += pct * 360;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const large = angle > 180 ? 1 : 0;

    return {
      d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      status,
      count,
    };
  });

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={128} height={128} viewBox="0 0 128 128" aria-label={`Fleet: ${total} vehicles`}>
          {paths.map(({ d, status }) => (
            <path
              key={status}
              d={d}
              fill="none"
              stroke={FLEET_COLORS[status]?.fill || '#a8a29e'}
              strokeWidth={16}
              strokeLinecap="round"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-stone-900 dark:text-stone-100 leading-none">{total}</span>
          <span className="text-xs text-stone-400 dark:text-stone-500">vehicles</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full">
        {segments.map(([status, count]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: FLEET_COLORS[status]?.fill || '#a8a29e' }}
            />
            <span className="text-xs text-stone-600 dark:text-stone-400 capitalize">{FLEET_COLORS[status]?.label || status}</span>
            <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 ml-auto">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, rawValue, icon: Icon, accent, sub, onClick, alert, prefix = '', suffix = '' }) {
  const animated = useCountUp(
    typeof rawValue === 'number' ? rawValue : null,
  );

  const accentMap = {
    amber:  { bg: 'bg-amber-500',              text: 'text-white',            icon: 'text-white/80',      ring: 'ring-amber-300 dark:ring-amber-700' },
    blue:   { bg: 'bg-blue-50 dark:bg-blue-900/20',   text: 'text-blue-700 dark:text-blue-300', icon: 'text-blue-400',  ring: '' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', icon: 'text-purple-400', ring: '' },
    green:  { bg: 'bg-green-50 dark:bg-green-900/20',  text: 'text-green-700 dark:text-green-300', icon: 'text-green-500', ring: '' },
    red:    { bg: 'bg-red-50 dark:bg-red-900/20',   text: 'text-red-700 dark:text-red-300',   icon: 'text-red-400',   ring: '' },
    stone:  { bg: 'bg-stone-50 dark:bg-stone-800',  text: 'text-stone-700 dark:text-stone-300', icon: 'text-stone-400', ring: '' },
  };

  const a = accentMap[accent] || accentMap.stone;
  const isHero = accent === 'amber';

  const displayValue = typeof rawValue === 'number'
    ? `${prefix}${animated.toLocaleString()}${suffix}`
    : rawValue ?? '—';

  return (
    <motion.div
      variants={fadeUp}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`
        relative overflow-hidden rounded-xl p-5 transition-all duration-200
        ${isHero ? `${a.bg} shadow-md hover:shadow-lg ring-2 ring-amber-400/30` : `card hover:shadow-md hover:border-stone-300 dark:hover:border-stone-700`}
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Alert pulse dot */}
      {alert && (
        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 pulse-dot" aria-label="Requires attention" />
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-3xl font-bold tracking-tight leading-none ${isHero ? a.text : 'text-stone-900 dark:text-stone-100'}`}>
            {displayValue}
          </p>
          <p className={`text-sm mt-1 font-medium ${isHero ? 'text-white/80' : 'text-stone-500 dark:text-stone-400'}`}>
            {label}
          </p>
          {sub && (
            <p className={`text-xs mt-0.5 ${isHero ? 'text-white/60' : 'text-stone-400 dark:text-stone-500'}`}>
              {sub}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${isHero ? 'bg-white/20' : `${a.bg}`}`}>
          <Icon size={20} className={isHero ? a.icon : a.icon} />
        </div>
      </div>

      {onClick && !isHero && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100">
          <ChevronRight size={14} className="text-stone-300" />
        </div>
      )}
    </motion.div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, action, actionLabel }) {
  return (
    <div className="px-5 py-3.5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-stone-400 dark:text-stone-500" />
        <h2 className="font-semibold text-sm text-stone-800 dark:text-stone-200">{title}</h2>
      </div>
      {action && (
        <button
          onClick={action}
          className="text-xs text-amber-600 dark:text-amber-400 font-medium hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
        >
          {actionLabel || 'View all →'}
        </button>
      )}
    </div>
  );
}

// ─── Today's Schedule ─────────────────────────────────────────────────────────

function TodaySchedule({ pickups, returns, onNavigate }) {
  const all = [
    ...(pickups || []).map(b => ({ ...b, _type: 'pickup', _time: b.pickup_time })),
    ...(returns || []).map(b => ({ ...b, _type: 'return', _time: b.return_time })),
  ].sort((a, b) => (a._time || '').localeCompare(b._time || ''));

  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-stone-400 dark:text-stone-600">
        <CheckCheck size={28} className="opacity-50" />
        <p className="text-sm">Nothing scheduled today — enjoy the quiet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-50 dark:divide-stone-800/60">
      {all.map(b => (
        <div
          key={`${b._type}-${b.id}`}
          onClick={() => onNavigate(`/bookings/${b.id}`)}
          className="px-5 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors group"
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && onNavigate(`/bookings/${b.id}`)}
        >
          {/* Time badge */}
          <div className={`
            shrink-0 w-14 text-center py-1 rounded-lg text-xs font-semibold
            ${b._type === 'pickup'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}
          `}>
            {b._time?.slice(0, 5) || '—'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
              {b.customers?.first_name} {b.customers?.last_name}
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 truncate">
              {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
            </p>
          </div>

          {/* Type pill */}
          <span className={`
            badge shrink-0
            ${b._type === 'pickup'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}
          `}>
            {b._type === 'pickup' ? <ArrowUpFromLine size={10} className="mr-1" /> : <ArrowDownToLine size={10} className="mr-1" />}
            {b._type === 'pickup' ? 'Pickup' : 'Return'}
          </span>

          <ChevronRight size={14} className="text-stone-300 dark:text-stone-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ))}
    </div>
  );
}

// ─── 7-Day Strip ─────────────────────────────────────────────────────────────

function WeekStrip({ pickups, returns, onNavigate }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const pickupsByDay = {};
  const returnsByDay = {};
  for (const b of pickups || []) {
    const key = b.pickup_date;
    if (!pickupsByDay[key]) pickupsByDay[key] = [];
    pickupsByDay[key].push(b);
  }
  for (const b of returns || []) {
    const key = b.return_date;
    if (!returnsByDay[key]) returnsByDay[key] = [];
    returnsByDay[key].push(b);
  }

  const selectedKey = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedPickups = selectedKey ? (pickupsByDay[selectedKey] || []) : [];
  const selectedReturns = selectedKey ? (returnsByDay[selectedKey] || []) : [];
  const selectedAll = [
    ...selectedPickups.map(b => ({ ...b, _type: 'pickup' })),
    ...selectedReturns.map(b => ({ ...b, _type: 'return' })),
  ];

  const handleDayClick = (day) => {
    const key = format(day, 'yyyy-MM-dd');
    const hasEvents = (pickupsByDay[key]?.length || 0) + (returnsByDay[key]?.length || 0) > 0;
    if (!hasEvents) { setSelectedDay(null); return; }
    setSelectedDay(d => d && isSameDay(d, day) ? null : day);
  };

  return (
    <div>
      {/* Day strip */}
      <div className="flex overflow-x-auto px-5 py-3 gap-2 scrollbar-none">
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const pCount = pickupsByDay[key]?.length || 0;
          const rCount = returnsByDay[key]?.length || 0;
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const hasAny = pCount + rCount > 0;

          return (
            <button
              key={key}
              onClick={() => handleDayClick(day)}
              className={`
                flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl min-w-[56px] transition-all duration-150
                ${isSelected
                  ? 'bg-amber-500 shadow-sm'
                  : isToday
                  ? 'bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-700'
                  : hasAny
                  ? 'hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer'
                  : 'opacity-50 cursor-default'}
              `}
              aria-label={`${format(day, 'EEEE MMM d')}: ${pCount} pickups, ${rCount} returns`}
            >
              <span className={`text-[10px] font-semibold uppercase tracking-wide ${isSelected ? 'text-white/80' : 'text-stone-400 dark:text-stone-500'}`}>
                {format(day, 'EEE')}
              </span>
              <span className={`text-sm font-bold ${isSelected ? 'text-white' : isToday ? 'text-amber-700 dark:text-amber-400' : 'text-stone-700 dark:text-stone-300'}`}>
                {format(day, 'd')}
              </span>
              <div className="flex gap-0.5">
                {pCount > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-400'}`} />
                )}
                {rCount > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-purple-400'}`} />
                )}
                {!hasAny && <span className="w-1.5 h-1.5" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-5 pb-2 flex items-center gap-4">
        <span className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> Pickup
        </span>
        <span className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-500">
          <span className="w-2 h-2 rounded-full bg-purple-400" /> Return
        </span>
      </div>

      {/* Expanded day detail */}
      <AnimatePresence>
        {selectedDay && selectedAll.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-stone-100 dark:border-stone-800"
          >
            <div className="px-5 py-2 bg-stone-50/50 dark:bg-stone-800/30">
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-2">
                {format(selectedDay, 'EEEE, MMMM d')}
              </p>
              <div className="space-y-1.5">
                {selectedAll.map(b => (
                  <div
                    key={`${b._type}-${b.id}`}
                    onClick={() => onNavigate(`/bookings/${b.id}`)}
                    className="flex items-center gap-2.5 py-1.5 cursor-pointer group"
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && onNavigate(`/bookings/${b.id}`)}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${b._type === 'pickup' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                      {b._type === 'pickup' ? b.pickup_time?.slice(0, 5) : b.return_time?.slice(0, 5)}
                    </span>
                    <span className="text-xs text-stone-600 dark:text-stone-400 truncate">
                      {b.customers?.first_name} {b.customers?.last_name}
                    </span>
                    <span className="text-xs text-stone-400 dark:text-stone-500 truncate ml-auto">
                      {b.vehicles?.make} {b.vehicles?.model}
                    </span>
                    <span className={`badge text-[10px] shrink-0 ${b._type === 'pickup' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                      {b._type === 'pickup' ? 'Pickup' : 'Return'}
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
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-stone-400 dark:text-stone-600">
        <Activity size={28} className="opacity-50" />
        <p className="text-sm">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-50 dark:divide-stone-800/60">
      {activity.map((log, i) => (
        <div
          key={log.id}
          onClick={() => log.booking_id && onNavigate(`/bookings/${log.booking_id}`)}
          className="px-5 py-3 flex items-start gap-3 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && log.booking_id && onNavigate(`/bookings/${log.booking_id}`)}
        >
          {/* Timeline dot */}
          <div className="flex flex-col items-center shrink-0 mt-1">
            <div className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500" />
            {i < activity.length - 1 && (
              <div className="w-px flex-1 min-h-[20px] bg-stone-100 dark:bg-stone-800 mt-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-700 dark:text-stone-300 truncate">
              <span className="font-medium">
                {log.bookings?.customers?.first_name} {log.bookings?.customers?.last_name}
              </span>
              {log.bookings?.booking_code && (
                <span className="text-stone-400 dark:text-stone-500 font-mono text-xs ml-1.5">
                  {log.bookings.booking_code}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {log.from_status && <StatusBadge status={log.from_status} />}
              {log.from_status && <span className="text-stone-300 dark:text-stone-600 text-xs">→</span>}
              <StatusBadge status={log.to_status} />
            </div>
          </div>

          <p className="text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap shrink-0">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value }) {
  if (!value) return <span className="text-xs text-stone-400 dark:text-stone-500">No reviews yet</span>;
  const num = parseFloat(value);
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={14}
            className={i <= Math.round(num) ? 'text-amber-400 fill-amber-400' : 'text-stone-200 dark:text-stone-700'}
          />
        ))}
      </div>
      <span className="text-sm font-semibold text-stone-800 dark:text-stone-200">{num.toFixed(1)}</span>
    </div>
  );
}

// ─── Mobile Quick Actions ─────────────────────────────────────────────────────

function MobileQuickActions({ pendingApprovals, navigate }) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 px-4 py-3 flex gap-3 safe-bottom shadow-2xl">
      <button
        onClick={() => navigate('/bookings?status=pending_approval')}
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 active:bg-amber-100 transition-colors relative"
        aria-label={`Approve bookings — ${pendingApprovals} pending`}
      >
        {pendingApprovals > 0 && (
          <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {pendingApprovals}
          </span>
        )}
        <CheckCircle2 size={20} />
        <span className="text-[11px] font-medium">Approve</span>
      </button>

      <button
        onClick={() => navigate('/bookings')}
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 active:bg-stone-100 transition-colors"
        aria-label="View bookings"
      >
        <BookOpen size={20} />
        <span className="text-[11px] font-medium">Bookings</span>
      </button>

      <button
        onClick={() => navigate('/fleet')}
        className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 text-stone-700 dark:text-stone-300 active:bg-stone-100 transition-colors"
        aria-label="View fleet"
      >
        <Car size={20} />
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
  const [loading, setLoading]     = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Critical data — must all succeed for the page to be useful
    Promise.all([
      api.getOverview(),
      api.getUpcoming(),
      api.getActivity(10),
    ])
      .then(([ov, up, act]) => {
        setOverview(ov);
        setUpcoming(up);
        setActivity(act);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    // Fleet data — non-critical, fails silently, donut just shows empty
    api.getVehicles()
      .then(veh => setVehicles(veh || []))
      .catch(() => {});
  }, []);

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  const pendingApprovals = overview?.pending_approvals || 0;
  const pendingAgreements = overview?.pending_agreements || 0;

  return (
    <>
      {/* Page */}
      <div className="p-4 sm:p-6 pb-28 lg:pb-6 max-w-7xl mx-auto space-y-6">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Dashboard</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">
              {greeting()} — here's what needs your attention.
            </p>
          </div>

          {/* Desktop quick actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {pendingApprovals > 0 && (
              <button
                onClick={() => navigate('/bookings?status=pending_approval')}
                className="btn-primary relative"
              >
                <CheckCircle2 size={15} />
                Approve Pending
                <span className="ml-1 bg-white/30 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  {pendingApprovals}
                </span>
              </button>
            )}
            <button onClick={() => navigate('/bookings')} className="btn-secondary">
              <BookOpen size={15} />
              Bookings
            </button>
            <button onClick={() => navigate('/fleet')} className="btn-secondary">
              <Car size={15} />
              Fleet
            </button>
          </div>
        </motion.div>

        {/* Action Required alerts */}
        <AnimatePresence>
          {(pendingApprovals > 0 || pendingAgreements > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              {pendingApprovals > 0 && (
                <div
                  className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                  onClick={() => navigate('/bookings?status=pending_approval')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/bookings?status=pending_approval')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full pulse-dot" aria-hidden />
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-300 text-sm">
                        {pendingApprovals} booking{pendingApprovals !== 1 ? 's' : ''} waiting for approval
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">Review and approve or decline</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400 shrink-0">Review →</span>
                </div>
              )}
              {pendingAgreements > 0 && (
                <div
                  className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  onClick={() => navigate('/bookings')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate('/bookings')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full pulse-dot" aria-hidden />
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-300 text-sm">
                        {pendingAgreements} rental agreement{pendingAgreements !== 1 ? 's' : ''} need{pendingAgreements === 1 ? 's' : ''} your counter-signature
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400">Open the booking and use the Rental Agreement section</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-400 shrink-0">View →</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── KPI Hero Row ─────────────────────────────────────────────────── */}
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
            accent="amber"
            sub="currently out"
            onClick={() => navigate('/bookings?status=active')}
          />
          <KpiCard
            label="Pending Approval"
            rawValue={pendingApprovals}
            icon={CheckCircle2}
            accent={pendingApprovals > 0 ? 'red' : 'stone'}
            alert={pendingApprovals > 0}
            onClick={() => navigate('/bookings?status=pending_approval')}
          />
          <KpiCard
            label="Pickups Today"
            rawValue={overview?.pickups_today?.length ?? 0}
            icon={ArrowUpFromLine}
            accent="blue"
          />
          <KpiCard
            label="Returns Today"
            rawValue={overview?.returns_today?.length ?? 0}
            icon={ArrowDownToLine}
            accent="purple"
          />
          <KpiCard
            label="Revenue / Month"
            rawValue={Math.round(parseFloat(overview?.revenue_this_month || 0))}
            icon={DollarSign}
            accent="green"
            prefix="$"
            sub={`${overview?.bookings_this_month ?? 0} bookings`}
            onClick={() => navigate('/revenue')}
          />
        </motion.div>

        {/* ── Middle Zone ───────────────────────────────────────────────────── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid lg:grid-cols-5 gap-4"
        >
          {/* LEFT: Today's Schedule + 7-Day strip (takes 3/5 columns) */}
          <motion.div variants={fadeUp} className="lg:col-span-3 space-y-4">

            {/* Today's Schedule */}
            <div className="card overflow-hidden">
              <SectionHeader
                icon={Clock}
                title={`Today's Schedule — ${format(new Date(), 'EEEE, MMMM d')}`}
              />
              <TodaySchedule
                pickups={overview?.pickups_today}
                returns={overview?.returns_today}
                onNavigate={navigate}
              />
            </div>

            {/* Upcoming 7-Day Strip */}
            <div className="card overflow-hidden">
              <SectionHeader
                icon={Calendar}
                title="Next 7 Days"
                action={() => navigate('/calendar')}
                actionLabel="Calendar →"
              />
              <WeekStrip
                pickups={upcoming?.pickups || []}
                returns={upcoming?.returns || []}
                onNavigate={navigate}
              />
            </div>
          </motion.div>

          {/* RIGHT: Fleet + Rating (takes 2/5 columns) */}
          <motion.div variants={fadeUp} className="lg:col-span-2 space-y-4">

            {/* Fleet Status Donut */}
            <div
              className="card overflow-hidden cursor-pointer hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-md transition-all duration-200"
              onClick={() => navigate('/fleet')}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate('/fleet')}
              aria-label="View fleet"
            >
              <SectionHeader
                icon={Car}
                title="Fleet Status"
                action={() => navigate('/fleet')}
                actionLabel="Manage →"
              />
              <div className="p-5">
                <FleetDonut vehicles={vehicles} />
              </div>
            </div>

            {/* Rating + Pending Agreements */}
            <div className="card overflow-hidden">
              <SectionHeader icon={Star} title="Performance" />
              <div className="px-5 py-4 space-y-4">
                <div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-1">Average Rating</p>
                  <StarRating value={overview?.average_rating} />
                </div>

                {pendingAgreements > 0 && (
                  <div
                    className="flex items-center gap-2.5 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                    onClick={() => navigate('/bookings')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/bookings')}
                  >
                    <FileSignature size={16} className="text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                        {pendingAgreements} agreement{pendingAgreements !== 1 ? 's' : ''} to sign
                      </p>
                      <p className="text-[11px] text-blue-600 dark:text-blue-400">Counter-signature needed</p>
                    </div>
                    <ChevronRight size={14} className="text-blue-400 shrink-0" />
                  </div>
                )}

                {pendingAgreements === 0 && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCheck size={15} />
                    <span className="text-xs font-medium">All agreements signed</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.3 }}
        >
          <div className="card overflow-hidden">
            <SectionHeader
              icon={Activity}
              title="Recent Activity"
              action={() => navigate('/bookings')}
              actionLabel="All bookings →"
            />
            <ActivityFeed activity={activity} onNavigate={navigate} />
          </div>
        </motion.div>

      </div>

      {/* Mobile sticky quick actions */}
      <MobileQuickActions pendingApprovals={pendingApprovals} navigate={navigate} />
    </>
  );
}
