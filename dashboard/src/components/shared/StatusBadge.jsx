const STATUS_STYLES = {
  pending_approval: {
    bg: 'rgba(245,158,11,0.10)',
    border: 'rgba(245,158,11,0.20)',
    color: '#d97706',
    darkColor: '#fbbf24',
  },
  approved: {
    bg: 'rgba(59,130,246,0.10)',
    border: 'rgba(59,130,246,0.20)',
    color: '#2563eb',
    darkColor: '#60a5fa',
  },
  confirmed: {
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    color: '#16a34a',
    darkColor: '#4ade80',
  },
  active: {
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.25)',
    color: '#15803d',
    darkColor: '#22c55e',
  },
  returned: {
    bg: 'rgba(139,92,246,0.10)',
    border: 'rgba(139,92,246,0.20)',
    color: '#7c3aed',
    darkColor: '#a78bfa',
  },
  completed: {
    bg: 'rgba(120,113,108,0.10)',
    border: 'rgba(120,113,108,0.15)',
    color: '#57534e',
    darkColor: '#a8a29e',
  },
  declined: {
    bg: 'rgba(244,63,94,0.10)',
    border: 'rgba(244,63,94,0.20)',
    color: '#e11d48',
    darkColor: '#fb7185',
  },
  cancelled: {
    bg: 'rgba(244,63,94,0.08)',
    border: 'rgba(244,63,94,0.15)',
    color: '#f43f5e',
    darkColor: '#fda4af',
  },
  no_show: {
    bg: 'rgba(249,115,22,0.10)',
    border: 'rgba(249,115,22,0.20)',
    color: '#c2410c',
    darkColor: '#fb923c',
  },
  // Vehicle statuses
  available: {
    bg: 'rgba(34,197,94,0.10)',
    border: 'rgba(34,197,94,0.20)',
    color: '#16a34a',
    darkColor: '#22c55e',
  },
  rented: {
    bg: 'rgba(212,175,55,0.10)',
    border: 'rgba(212,175,55,0.20)',
    color: '#a16207',
    darkColor: '#D4AF37',
  },
  turo: {
    bg: 'rgba(129,140,248,0.10)',
    border: 'rgba(129,140,248,0.20)',
    color: '#4f46e5',
    darkColor: '#818cf8',
  },
  maintenance: {
    bg: 'rgba(248,113,113,0.10)',
    border: 'rgba(248,113,113,0.20)',
    color: '#dc2626',
    darkColor: '#f87171',
  },
  retired: {
    bg: 'rgba(115,115,115,0.10)',
    border: 'rgba(115,115,115,0.15)',
    color: '#525252',
    darkColor: '#737373',
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

  // Detect dark mode from the html element
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
