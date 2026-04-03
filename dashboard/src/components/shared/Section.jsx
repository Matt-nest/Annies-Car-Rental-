/**
 * Reusable card section wrapper with title, optional icon, and action button.
 * Used across BookingDetailPage, VehicleDetailPage, FleetPage.
 */
export default function Section({ title, icon: Icon, action, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-stone-400" />}
          <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
