import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, BookOpen, CheckCircle2, PenLine } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { api } from '../api/client';
import { cachedQuery } from '../lib/queryCache';
import DashboardLayoutEngine from '../components/dashboard/DashboardLayoutEngine';

const EASE = [0.25, 1, 0.5, 1];

// ─── Mobile quick-action bar ──────────────────────────────────────────────────
function MobileQuickActions({ pendingApprovals, pendingAgreements, navigate }) {
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
      {pendingApprovals > 0 && (
        <button
          onClick={() => {
            const el = document.querySelector('[data-widget="pending-approvals"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else navigate('/bookings?status=pending_approval');
          }}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors relative"
          style={{
            backgroundColor: 'rgba(245,158,11,0.1)',
            color: '#F59E0B',
            boxShadow: '0 0 12px rgba(245,158,11,0.2), inset 0 0 0 1px rgba(245,158,11,0.2)',
            animation: 'pulseYellow 2s ease-in-out infinite',
            minHeight: 54,
          }}
        >
          <span
            className="absolute top-1.5 right-1.5 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            style={{ backgroundColor: '#F59E0B', color: '#fff' }}
          >
            {pendingApprovals}
          </span>
          <CheckCircle2 size={19} />
          <span className="text-[11px] font-medium">Approve</span>
        </button>
      )}

      {pendingAgreements > 0 && (
        <button
          onClick={() => {
            const el = document.querySelector('[data-widget="pending-counter-sign"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors relative"
          style={{
            backgroundColor: 'rgba(0,122,255,0.1)',
            color: '#007AFF',
            boxShadow: '0 0 12px rgba(0,122,255,0.2), inset 0 0 0 1px rgba(0,122,255,0.2)',
            animation: 'pulseBlue 2s ease-in-out infinite',
            minHeight: 54,
          }}
        >
          <span
            className="absolute top-1.5 right-1.5 text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
            style={{ backgroundColor: '#007AFF', color: '#fff' }}
          >
            {pendingAgreements}
          </span>
          <PenLine size={19} />
          <span className="text-[11px] font-medium">Sign</span>
        </button>
      )}

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
  const [pendingAgreements, setPendingAgreements] = useState(0);
  const navigate = useNavigate();

  // Lightweight fetch of pending count for the header button + mobile bar.
  // Uses the same cache key as KPICardsWidget / MorningBriefingWidget — no extra network request.
  useEffect(() => {
    cachedQuery('overview', () => api.getOverview())
      .then((ov) => {
        setPending(ov?.pending_approvals || 0);
        setPendingAgreements(ov?.pending_agreements || 0);
      })
      .catch(() => {});
  }, []);

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <>
      <div className="p-6 lg:p-8 pb-28 lg:pb-8 space-y-6">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-end justify-between gap-4 pt-2"
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

          {/* Desktop header actions — Approve / Counter-Sign / Check-In / Active /
              Inspect pills are rendered in the global AlertPillBar (in the top
              header, next to the search bar). Keep only the static nav shortcuts here. */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 pb-1">
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

      <MobileQuickActions pendingApprovals={pending} pendingAgreements={pendingAgreements} navigate={navigate} />
    </>
  );
}
