import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import brand from '../config/brand';
import DashboardLayoutEngine from '../components/dashboard/DashboardLayoutEngine';
import AlertPillBar from '../components/layout/AlertPillBar';

const EASE = [0.25, 1, 0.5, 1];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();

  const openActiveModal = () =>
    window.dispatchEvent(new CustomEvent('dashboard:open-active-modal'));

  const greeting = useCallback(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <>
      <div className="p-6 lg:p-8 space-y-6">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-end justify-between gap-4 pt-2"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-color)' }}>
              {brand.name}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight"
              style={{ color: 'var(--text-primary)' }}>
              {greeting()}
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {format(new Date(), 'EEEE, MMMM d')} — here's your day at a glance.
            </p>
          </div>

          {/* Desktop header actions — alert pills + nav shortcuts.
              Pills live to the LEFT of Bookings/Fleet so they're visible
              alongside the static shortcuts. The Active pill dispatches a
              custom event that DashboardLayout listens for to open the
              acknowledgement modal. */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 pb-1">
            <AlertPillBar onActiveAlertClick={openActiveModal} />
            <button onClick={() => navigate('/bookings')} className="btn btn-secondary">
              <BookOpen size={14} /> Bookings
            </button>
            <button onClick={() => navigate('/fleet')} className="btn btn-secondary">
              <Car size={14} /> Fleet
            </button>
          </div>
        </motion.div>

        {/* ── Mobile alert strip ──────────────────────────────────────────
            On phones/tablets the header's desktop pill row is hidden, so the
            same high-priority alerts surface here as a full-bleed, horizontally
            scrollable strip — visible in-flow at the top of the page instead of
            a fixed bottom bar that fought the global BottomNav for z-space.
            Renders null (no phantom gap) when there are no active alerts. */}
        <AlertPillBar variant="strip" onActiveAlertClick={openActiveModal} />

        {/* ── Widget engine ──────────────────────────────────────────── */}
        <DashboardLayoutEngine />

      </div>
    </>
  );
}
