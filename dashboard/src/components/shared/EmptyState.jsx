import { motion } from 'framer-motion';

const EASE = [0.25, 1, 0.5, 1];

/**
 * Styled empty state component — replaces generic "No results" text
 * with an animated, on-brand empty state.
 */
export default function EmptyState({
  icon: Icon,
  title = 'Nothing here yet',
  description,
  action,
  actionLabel,
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {Icon && (
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center mb-5"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Icon
            size={28}
            style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}
          />
        </div>
      )}
      <h3
        className="text-lg font-semibold tracking-tight mb-1.5"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm max-w-xs leading-relaxed"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action}
          className="btn-primary mt-6"
        >
          {actionLabel || 'Get started'}
        </button>
      )}
    </motion.div>
  );
}
