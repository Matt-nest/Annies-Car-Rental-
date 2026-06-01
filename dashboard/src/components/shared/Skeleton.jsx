import { motion } from 'framer-motion';

/**
 * Skeleton loading component — used across all pages for placeholder content
 * while API data loads.
 */

export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return (
    <div
      className={`skeleton skeleton-text ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard({ className = '', style = {} }) {
  return (
    <div className={`skeleton skeleton-card ${className}`} style={style}>
      <div className="p-5 space-y-4">
        <SkeletonLine width="45%" height={20} />
        <SkeletonLine width="80%" />
        <SkeletonLine width="60%" />
      </div>
    </div>
  );
}

export function SkeletonKpi({ count = 5 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ minHeight: 120 }}>
          <div className="p-5 space-y-3">
            <SkeletonLine width="50%" height={32} />
            <SkeletonLine width="70%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex gap-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={i === 0 ? '80px' : '120px'} height={10} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="px-5 py-4 flex gap-6"
          style={{ borderBottom: ri < rows - 1 ? '1px solid var(--border-subtle)' : 'none' }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <SkeletonLine key={ci} width={ci === 0 ? '80px' : `${60 + ci * 20}px`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChartCard({ height = 350 }) {
  return (
    <div className="skeleton skeleton-card" style={{ height }}>
      <div className="p-5 space-y-4">
        <SkeletonLine width="40%" height={18} />
        <div className="flex-1" />
      </div>
    </div>
  );
}

export function SkeletonFleetGrid({ count = 8 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ minHeight: 260 }}>
          <div style={{ height: 144 }} />
          <div className="p-4 space-y-3">
            <SkeletonLine width="75%" height={16} />
            <SkeletonLine width="40%" height={10} />
            <SkeletonLine width="55%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-page skeleton with KPI + section cards
 */
export function SkeletonDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 sm:p-6 pb-28 lg:pb-8 max-w-7xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="space-y-2 pt-1">
        <SkeletonLine width="100px" height={10} />
        <SkeletonLine width="280px" height={32} />
        <SkeletonLine width="200px" height={12} />
      </div>

      {/* KPIs */}
      <SkeletonKpi />

      {/* Content grid */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <SkeletonChartCard height={280} />
          <SkeletonChartCard height={200} />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <SkeletonChartCard height={240} />
          <SkeletonChartCard height={200} />
        </div>
      </div>
    </motion.div>
  );
}

export default SkeletonLine;
