const STATUS_STYLES = {
  pending_approval: {
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.22)',
    color: '#d97706',
    darkColor: '#fbbf24',
  },
  approved: {
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.22)',
    color: '#2563eb',
    darkColor: '#60a5fa',
  },
  confirmed: {
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.22)',
    color: '#16a34a',
    darkColor: '#4ade80',
  },
  active: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.28)',
    color: '#15803d',
    darkColor: '#22c55e',
  },
  returned: {
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.22)',
    color: '#7c3aed',
    darkColor: '#a78bfa',
  },
  completed: {
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.18)',
    color: '#475569',
    darkColor: '#94A3B8',
  },
  declined: {
    bg: 'rgba(239,68,68,0.10)',
    border: 'rgba(239,68,68,0.22)',
    color: '#dc2626',
    darkColor: '#f87171',
  },
  cancelled: {
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.18)',
    color: '#ef4444',
    darkColor: '#fca5a5',
  },
  no_show: {
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.22)',
    color: '#c2410c',
    darkColor: '#fb923c',
  },
  available: {
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.22)',
    color: '#16a34a',
    darkColor: '#22c55e',
  },
  rented: {
    bg: 'rgba(212,175,55,0.10)',
    border: 'rgba(212,175,55,0.22)',
    color: '#a16207',
    darkColor: '#D4AF37',
  },
  turo: {
    bg: 'rgba(129,140,248,0.10)',
    border: 'rgba(129,140,248,0.22)',
    color: '#4f46e5',
    darkColor: '#818cf8',
  },
  maintenance: {
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.22)',
    color: '#c2410c',
    darkColor: '#fb923c',
  },
  retired: {
    bg: 'rgba(100,116,139,0.10)',
    border: 'rgba(100,116,139,0.15)',
    color: '#475569',
    darkColor: '#64748B',
  },
};

const STATUS_LABELS = {
  pending_approval: 'Pending',
  approved: 'Approved',
  confirmed: 'Confirmed',
  active: 'Active',
  returned: 'Returned',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
  no_show: 'No Show',
  available: 'Available',
  rented: 'Rented',
  turo: 'On Turo',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

export default function StatusBadge({ status, className = '' }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.completed;
  const label = STATUS_LABELS[status] || status;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const textColor = isDark ? (s.darkColor || s.color) : s.color;

  return (
    <span
      className={`status-pill ${className}`}
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        color: textColor,
      }}
    >
      {label}
    </span>
  );
}
