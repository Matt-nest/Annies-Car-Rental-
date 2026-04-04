/**
 * Reusable card section wrapper with title, optional icon, and action button.
 * Used across BookingDetailPage, VehicleDetailPage, FleetPage.
 */
export default function Section({ title, icon: Icon, action, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} style={{ color: 'var(--text-tertiary)' }} />}
          <h3
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
