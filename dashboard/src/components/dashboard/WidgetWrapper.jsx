import { useState } from 'react';
import { ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.25, 1, 0.5, 1];

// ─── Skeleton variants ────────────────────────────────────────────────────────

function SkeletonRow({ w = 'w-full', h = 'h-4' }) {
  return (
    <div
      className={`${w} ${h} rounded-lg skeleton`}
    />
  );
}

function SkeletonKpi() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-5 space-y-3"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            minHeight: 110,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <SkeletonRow w="w-14" h="h-7" />
          <SkeletonRow w="w-20" h="h-3" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        height: 300,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <SkeletonRow w="w-36" h="h-4" />
      <div className="flex items-end gap-2 h-48 pt-4">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t skeleton"
            style={{ height: `${30 + Math.random() * 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function SkeletonList({ rows = 5 }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <SkeletonRow w="w-28" h="h-4" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-5 py-3.5 flex items-center gap-3"
          style={{ borderBottom: i < rows - 1 ? '1px solid var(--border-subtle)' : 'none' }}
        >
          <div className="w-8 h-8 rounded-xl skeleton shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonRow w="w-32" h="h-3" />
            <SkeletonRow w="w-20" h="h-2.5" />
          </div>
          <SkeletonRow w="w-14" h="h-3" />
        </div>
      ))}
    </div>
  );
}

function SkeletonFleetGrid() {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl skeleton"
            style={{ aspectRatio: '3/4' }}
          />
        ))}
      </div>
    </div>
  );
}

const SKELETON_MAP = {
  kpi:   SkeletonKpi,
  chart: SkeletonChart,
  list:  SkeletonList,
  fleet: SkeletonFleetGrid,
};

// ─── Widget Wrapper ───────────────────────────────────────────────────────────

export default function WidgetWrapper({
  title,
  icon: Icon,
  loading = false,
  error = null,
  onRetry,
  skeletonType = 'list',
  headerAction,
  defaultCollapsed = false,
  noPadding = false,
  children,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const SkeletonComponent = SKELETON_MAP[skeletonType] || SkeletonList;

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <SkeletonComponent />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors"
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)' }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <Icon size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
          )}
          <span
            className="text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!collapsed && headerAction}
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-tertiary)',
              transform: collapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            {error ? (
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={15} style={{ color: 'var(--danger-color)', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {error?.message || 'Failed to load data'}
                  </p>
                </div>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors shrink-0"
                    style={{ color: 'var(--accent-color)', backgroundColor: 'var(--accent-glow)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <div className={noPadding ? '' : undefined}>{children}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
