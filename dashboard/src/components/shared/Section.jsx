/**
 * Reusable card section wrapper with title, optional icon, and action button.
 */
export default function Section({ title, icon: Icon, action, children, titleColor }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} style={{ color: 'var(--accent-color)' }} />}
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: titleColor || 'var(--text-secondary)' }}
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
