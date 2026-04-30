import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, Sparkles, PenLine, ArrowUpFromLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlerts } from '../../lib/alertsContext';

/**
 * AlertPillBar — unified row of high-priority alert pills shown in the
 * dashboard header (next to Bookings/Fleet). Each pill glows with a pulse
 * animation matching its color. Counts come from AlertsContext so mutations
 * (approve / counter-sign / complete inspection) update the bar instantly.
 *
 * Colors mirror MorningBriefingWidget chips so the visual language is consistent:
 *  - Approve         → yellow  (#F59E0B, pulseYellow)
 *  - Counter-Sign    → blue    (#007AFF, pulseBlue)
 *  - Check-Ins       → light blue (#63b3ed, pulseLightBlue)
 *  - Active          → green   (#22c55e, pulseGreen)        — transient
 *  - Inspections     → purple  (#a78bfa, pulsePurple)       — return under inspection
 */
export default function AlertPillBar({ onActiveAlertClick }) {
  const navigate = useNavigate();
  const { alerts } = useAlerts();

  const pills = [
    {
      key: 'approvals',
      count: alerts.pending_approvals || 0,
      label: 'Approve',
      icon: CheckCircle2,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.12)',
      border: 'rgba(245,158,11,0.25)',
      pulse: 'pulseYellow 2s ease-in-out infinite',
      onClick: () => navigate('/bookings?status=pending_approval'),
      title: 'Booking requests awaiting approval',
    },
    {
      key: 'counter-sign',
      count: alerts.pending_agreements || 0,
      label: 'Counter-Sign',
      icon: PenLine,
      color: '#007AFF',
      bg: 'rgba(0,122,255,0.12)',
      border: 'rgba(0,122,255,0.25)',
      pulse: 'pulseBlue 2s ease-in-out infinite',
      onClick: () => navigate('/bookings?status=confirmed'),
      title: 'Agreements awaiting your counter-signature',
    },
    {
      key: 'check-ins',
      count: alerts.pickups_today_count || 0,
      label: 'Check-In',
      icon: ArrowUpFromLine,
      color: '#63b3ed',
      bg: 'rgba(99,179,237,0.14)',
      border: 'rgba(99,179,237,0.28)',
      pulse: 'pulseLightBlue 2s ease-in-out infinite',
      onClick: () => navigate('/check-ins'),
      title: 'Pickups scheduled today — complete check-in',
    },
    {
      key: 'active',
      count: alerts.has_unacknowledged_active ? 1 : 0,
      label: 'Active',
      icon: Sparkles,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.14)',
      border: 'rgba(34,197,94,0.28)',
      pulse: 'pulseGreen 2s ease-in-out infinite',
      onClick: () => onActiveAlertClick?.(),
      title: 'A rental just went active',
      hideCount: true,
    },
    {
      key: 'inspections',
      count: alerts.pending_inspections || 0,
      label: 'Inspect',
      icon: ClipboardCheck,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.14)',
      border: 'rgba(167,139,250,0.28)',
      pulse: 'pulsePurple 2s ease-in-out infinite',
      onClick: () => navigate('/bookings?status=returned'),
      title: 'Returns awaiting inspection',
    },
  ];

  const visible = pills.filter(p => p.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-2">
      <AnimatePresence>
        {visible.map(pill => (
          <motion.button
            key={pill.key}
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            onClick={pill.onClick}
            title={pill.title}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tabular-nums transition-transform hover:scale-[1.04]"
            style={{
              backgroundColor: pill.bg,
              border: `1px solid ${pill.border}`,
              color: pill.color,
              animation: pill.pulse,
            }}
          >
            <pill.icon size={13} />
            {pill.label}
            {!pill.hideCount && (
              <span
                className="text-[10px] font-bold rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: pill.color, color: '#fff', minWidth: 18, textAlign: 'center' }}
              >
                {pill.count}
              </span>
            )}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
