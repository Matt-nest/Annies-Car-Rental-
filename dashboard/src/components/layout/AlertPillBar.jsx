import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlerts } from '../../lib/alertsContext';

/**
 * AlertPillBar — compact row of high-priority alert pills shown in the
 * dashboard header (next to Bookings/Fleet). Each pill links to the screen
 * where the admin resolves the alert. Counts come from AlertsContext so
 * approving / completing inspection from anywhere updates the bar in <300ms.
 */
export default function AlertPillBar({ onActiveAlertClick }) {
  const navigate = useNavigate();
  const { alerts } = useAlerts();

  const pills = [
    {
      key: 'inspections',
      count: alerts.pending_inspections || 0,
      label: 'Inspections',
      icon: ClipboardCheck,
      tone: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.28)', fg: '#b45309' },
      onClick: () => navigate('/bookings?status=returned'),
      title: 'Customer returns awaiting inspection',
    },
    {
      key: 'active',
      count: alerts.active_rentals || 0,
      label: 'Active',
      icon: Sparkles,
      tone: { bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.28)', fg: '#15803d' },
      onClick: () => onActiveAlertClick ? onActiveAlertClick() : navigate('/bookings?status=active'),
      title: 'Currently active rentals',
    },
    {
      key: 'approvals',
      count: alerts.pending_approvals || 0,
      label: 'Approvals',
      icon: CheckCircle2,
      tone: { bg: 'rgba(70,95,255,0.10)', border: 'rgba(70,95,255,0.28)', fg: '#465FFF' },
      onClick: () => navigate('/bookings?status=pending_approval'),
      title: 'Booking requests awaiting decision',
    },
  ];

  // Only render pills that have a count
  const visible = pills.filter(p => p.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-1.5">
      <AnimatePresence>
        {visible.map(pill => (
          <motion.button
            key={pill.key}
            type="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={pill.onClick}
            title={pill.title}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums transition-all hover:scale-[1.04]"
            style={{
              backgroundColor: pill.tone.bg,
              border: `1px solid ${pill.tone.border}`,
              color: pill.tone.fg,
            }}
          >
            <pill.icon size={13} />
            {pill.count} {pill.label}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
