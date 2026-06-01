import { useEffect, useState, useCallback } from 'react';
import { Phone, Clock, AlertTriangle, CheckCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../api/client';

function parseReturnDt(booking) {
  const date = booking.return_date;
  const time = booking.return_time || '23:59:00';
  if (!date) return null;
  return new Date(`${date}T${time}`);
}

function getHoursOverdue(booking) {
  const dt = parseReturnDt(booking);
  if (!dt) return 0;
  return (Date.now() - dt.getTime()) / 3_600_000;
}

function urgencyConfig(hours) {
  if (hours >= 24) return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', pulse: true, label: 'Critical' };
  if (hours >= 4)  return { color: '#f97316', bg: 'rgba(249,115,22,0.08)', pulse: false, label: 'Overdue' };
  if (hours >= 1)  return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', pulse: false, label: 'Late' };
  return { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', pulse: false, label: 'Pending' };
}

function formatOverdue(hours) {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = Math.floor(hours % 24);
    return `${days}d ${rem}h overdue`;
  }
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m overdue` : `${m}m overdue`;
}

export default function OverdueAlertsWidget() {
  const [overdueBookings, setOverdueBookings] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getBookings({ status: 'active', limit: 100 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        const now = Date.now();
        const overdue = list.filter((b) => {
          const dt = parseReturnDt(b);
          return dt && dt.getTime() < now;
        });
        setOverdueBookings(overdue);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = overdueBookings.filter((b) => !dismissed.has(b.id));

  // Don't render the widget at all when there's nothing to show
  if (!loading && visible.length === 0) return null;

  if (loading) {
    return (
      <div className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', minHeight: 72 }}>
        <div className="h-4 w-48 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(239,68,68,0.12)' }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#ef4444' }} />
          <AlertTriangle size={13} style={{ color: '#ef4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
            {visible.length} overdue return{visible.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={load}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: '#ef4444' }}
        >
          Refresh
        </button>
      </div>

      {/* Rows */}
      <AnimatePresence>
        {visible.map((booking, i) => {
          const hours = getHoursOverdue(booking);
          const { color, bg, pulse } = urgencyConfig(hours);
          const customer = booking.customers;
          const vehicle = booking.vehicles;
          const phone = customer?.phone;

          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12, height: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-3 px-5 py-3.5"
              style={{
                borderBottom: i < visible.length - 1 ? '1px solid rgba(239,68,68,0.08)' : 'none',
                backgroundColor: bg,
              }}
            >
              {/* Urgency bar */}
              <div
                className={`w-1 rounded-full shrink-0 self-stretch min-h-[32px] ${pulse ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: color, minWidth: 4 }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {customer?.first_name} {customer?.last_name}
                </p>
                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {vehicle?.year} {vehicle?.make} {vehicle?.model}
                  {booking.booking_code && (
                    <span className="mono-code ml-1.5">{booking.booking_code}</span>
                  )}
                </p>
              </div>

              {/* Time badge */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0"
                style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Clock size={10} style={{ color }} />
                <span className="text-[11px] font-semibold tabular-nums" style={{ color }}>
                  {formatOverdue(hours)}
                </span>
              </div>

              {/* Phone action */}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0"
                  style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}30` }}
                  title={`Call ${customer?.first_name}`}
                >
                  <Phone size={11} />
                  <span className="hidden sm:inline">Call</span>
                </a>
              )}

              {/* Dismiss */}
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, booking.id]))}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-60 shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
                title="Dismiss (this session)"
                aria-label="Dismiss alert"
              >
                <CheckCheck size={13} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
