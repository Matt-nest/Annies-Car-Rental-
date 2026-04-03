const STATUS_STYLES = {
  pending_approval: 'bg-amber-100 text-amber-800',
  approved:         'bg-blue-100 text-blue-800',
  confirmed:        'bg-blue-200 text-blue-900',
  active:           'bg-green-100 text-green-800',
  returned:         'bg-purple-100 text-purple-800',
  completed:        'bg-stone-100 text-stone-600',
  declined:         'bg-red-100 text-red-700',
  cancelled:        'bg-red-50 text-red-500',
  no_show:          'bg-orange-100 text-orange-700',
};

const STATUS_LABELS = {
  pending_approval: 'Pending Approval',
  approved:         'Approved',
  confirmed:        'Confirmed',
  active:           'Active',
  returned:         'Returned',
  completed:        'Completed',
  declined:         'Declined',
  cancelled:        'Cancelled',
  no_show:          'No Show',
};

export default function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLES[status] || 'bg-stone-100 text-stone-600';
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`badge ${style} ${className}`}>{label}</span>
  );
}
