import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, BookOpen, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { api } from '../api/client';
import { cachedQuery } from '../lib/queryCache';
import DashboardLayoutEngine from '../components/dashboard/DashboardLayoutEngine';

const EASE = [0.25, 1, 0.5, 1];

// ─── Mobile quick-action bar ──────────────────────────────────────────────────
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
          <span
            className="absolute top-1.5 right-1.5 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            style={{ backgroundColor: 'var(--danger-color)', color: '#fff' }}
          >
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [pending, setPending] = useState(0);
  const navigate = useNavigate();

  // Lightweight fetch of pending count for the header button + mobile bar.
  // Uses the same cache key as KPICardsWidget / MorningBriefingWidget — no extra network request.
  useEffect(() => {
    cachedQuery('overview', () => api.getOverview())
      .then((ov) => setPending(ov?.pending_approvals || 0))
      .catch(() => {});
  }, []);

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <>
      <div className="p-4 sm:p-6 pb-28 lg:pb-8 max-w-7xl mx-auto space-y-5">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-end justify-between gap-4 pt-1"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-color)' }}>
              Annie's Rentals
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight"
              style={{ color: 'var(--text-primary)' }}>
              {greeting()}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {format(new Date(), 'EEEE, MMMM d')} — here's your day at a glance.
            </p>
          </div>

          {/* Desktop header actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 pb-1">
            {pending > 0 && (
              <button
                onClick={() => navigate('/bookings?status=pending_approval')}
                className="btn btn-primary flex items-center gap-2"
              >
                <CheckCircle2 size={14} />
                Approve
                <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                  {pending}
                </span>
              </button>
            )}
            <button onClick={() => navigate('/bookings')} className="btn btn-secondary">
              <BookOpen size={14} /> Bookings
            </button>
            <button onClick={() => navigate('/fleet')} className="btn btn-secondary">
              <Car size={14} /> Fleet
            </button>
          </div>
        </motion.div>

        {/* ── Widget engine ──────────────────────────────────────────── */}
        <DashboardLayoutEngine />

      </div>

      <MobileQuickActions pendingApprovals={pending} navigate={navigate} />
    </>
  );
}
