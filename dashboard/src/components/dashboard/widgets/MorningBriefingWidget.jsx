import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sun, Sunset, Moon, ArrowUpFromLine, ArrowDownToLine,
  CheckCircle2, AlertTriangle, DollarSign, ChevronRight, PenLine,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';

function getTimeContext() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { label: 'Good morning', Icon: Sun, phase: 'morning' };
  if (h >= 12 && h < 18) return { label: 'Good afternoon', Icon: Sunset, phase: 'afternoon' };
  return { label: 'Good evening', Icon: Moon, phase: 'evening' };
}

function StatChip({ icon: Icon, value, label, color, onClick }) {
  const content = (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors"
      style={{ backgroundColor: `${color}14`, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      onMouseEnter={onClick ? (e) => (e.currentTarget.style.backgroundColor = `${color}22`) : undefined}
      onMouseLeave={onClick ? (e) => (e.currentTarget.style.backgroundColor = `${color}14`) : undefined}
    >
      <Icon size={13} style={{ color, flexShrink: 0 }} />
      <span className="text-base font-bold display-num" style={{ color }}>{value}</span>
      <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
  return content;
}

export default function MorningBriefingWidget() {
  const [overview, setOverview] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { label: greeting, Icon: TimeIcon, phase } = getTimeContext();

  useEffect(() => {
    Promise.all([
      cachedQuery('overview', () => api.getOverview()),
      cachedQuery('upcoming', () => api.getUpcoming()),
    ])
      .then(([ov, up]) => { setOverview(ov); setUpcoming(up); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="liquid-glass p-5 space-y-3 animate-pulse" style={{ minHeight: 80 }}>
        <div className="h-5 w-48 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="h-4 w-64 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
      </div>
    );
  }

  const pending = overview?.pending_approvals || 0;
  const pendingAgreements = overview?.pending_agreements || 0;
  const activeRentals = overview?.active_rentals || 0;
  const pickupsToday = overview?.pickups_today?.length || 0;
  const returnsToday = overview?.returns_today?.length || 0;
  const revenueMonth = parseFloat(overview?.revenue_this_month || 0);
  const tomorrowPickups = upcoming?.pickups?.filter(b => {
    const d = new Date(b.pickup_date);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    return d.toDateString() === tomorrow.toDateString();
  }).length || 0;

  const hasUrgency = pending > 0 || pendingAgreements > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      className="liquid-glass relative overflow-hidden"
    >
      {/* Subtle ambient glow when urgency */}
      {hasUrgency && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(70,95,255,0.06) 0%, transparent 70%)' }} />
      )}

      <div className="relative z-10 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Left — greeting + date */}
        <div className="flex items-center gap-3 sm:w-52 shrink-0">
          <div className="p-2 rounded-xl" style={{ backgroundColor: 'var(--accent-glow)' }}>
            <TimeIcon size={18} style={{ color: 'var(--accent-color)' }} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-color)' }}>
              {greeting}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {format(new Date(), 'EEE, MMM d')}
            </p>
          </div>
        </div>

        {/* Center — stat chips */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {phase !== 'evening' ? (
            <>
              <StatChip icon={ArrowUpFromLine} value={pickupsToday} label="pickups" color="#63b3ed" onClick={() => navigate('/calendar')} />
              <StatChip icon={ArrowDownToLine} value={returnsToday} label="returns" color="#a78bfa" onClick={() => navigate('/calendar')} />
              {pending > 0 && (
                <StatChip icon={CheckCircle2} value={pending} label="pending" color="var(--danger-color)" onClick={() => navigate('/bookings?status=pending_approval')} />
              )}
              {pendingAgreements > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: 'rgba(0,122,255,0.12)',
                    boxShadow: '0 0 12px rgba(0,122,255,0.25), inset 0 0 0 1px rgba(0,122,255,0.2)',
                    animation: 'pulseBlue 2s ease-in-out infinite',
                  }}
                  onClick={() => {
                    const el = document.querySelector('[data-widget="pending-counter-sign"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <PenLine size={13} style={{ color: '#007AFF', flexShrink: 0 }} />
                  <span className="text-base font-bold display-num" style={{ color: '#007AFF' }}>{pendingAgreements}</span>
                  <span className="text-xs hidden sm:inline" style={{ color: '#007AFF', opacity: 0.8 }}>counter-sign</span>
                </div>
              )}
              <StatChip icon={DollarSign} value={activeRentals} label="active" color="#22c55e" />
            </>
          ) : (
            <>
              <StatChip icon={DollarSign} value={`$${Math.round(revenueMonth / 1000)}k`} label="this month" color="#22c55e" onClick={() => navigate('/revenue')} />
              {tomorrowPickups > 0 && (
                <StatChip icon={ArrowUpFromLine} value={tomorrowPickups} label="tomorrow" color="#63b3ed" onClick={() => navigate('/calendar')} />
              )}
              <StatChip icon={DollarSign} value={activeRentals} label="active" color="#22c55e" />
              {pendingAgreements > 0 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: 'rgba(0,122,255,0.12)',
                    boxShadow: '0 0 12px rgba(0,122,255,0.25), inset 0 0 0 1px rgba(0,122,255,0.2)',
                    animation: 'pulseBlue 2s ease-in-out infinite',
                  }}
                  onClick={() => {
                    const el = document.querySelector('[data-widget="pending-counter-sign"]');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <PenLine size={13} style={{ color: '#007AFF', flexShrink: 0 }} />
                  <span className="text-base font-bold display-num" style={{ color: '#007AFF' }}>{pendingAgreements}</span>
                  <span className="text-xs hidden sm:inline" style={{ color: '#007AFF', opacity: 0.8 }}>counter-sign</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right — revenue hero */}
        <div
          className="flex items-center gap-2 shrink-0 cursor-pointer group"
          onClick={() => navigate('/revenue')}
        >
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>This month</p>
            <p className="text-xl font-bold display-num" style={{ color: 'var(--accent-color)' }}>
              ${Math.round(revenueMonth).toLocaleString()}
            </p>
          </div>
          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent-color)' }} />
        </div>
      </div>
    </motion.div>
  );
}
