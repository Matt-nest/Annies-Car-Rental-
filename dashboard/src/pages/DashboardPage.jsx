import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import brand from '../config/brand';
import DashboardLayoutEngine from '../components/dashboard/DashboardLayoutEngine';
import TodayOpsCockpit from '../components/dashboard/TodayOpsCockpit';
import AlertPillBar from '../components/layout/AlertPillBar';

const EASE = [0.25, 1, 0.5, 1];

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
    <div className="page-shell lg:p-8 space-y-6 min-w-0">

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex items-end justify-between gap-4 pt-2 min-w-0"
      >
        <div className="min-w-0">
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

      {/* Mobile alert strip — in-flow above widgets, not a second fixed bottom bar */}
      <AlertPillBar variant="strip" onActiveAlertClick={openActiveModal} />

      <TodayOpsCockpit />

      <DashboardLayoutEngine />
    </div>
  );
}
