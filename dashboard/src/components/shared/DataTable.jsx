import { SkeletonTable } from './Skeleton';
import EmptyState from './EmptyState';
import { FileText } from 'lucide-react';

export default function DataTable({ columns, data, loading, emptyMessage = 'No results', emptyIcon, onRowClick, mobileCardRenderer }) {
  if (loading) return <SkeletonTable rows={6} cols={columns?.length || 4} />;

  if (!data?.length) {
    return (
      <EmptyState
        icon={emptyIcon || FileText}
        title={emptyMessage}
        description="Try adjusting your filters or check back later."
      />
    );
  }

  return (
    <>
      {/* Desktop table — hidden on mobile */}
      <div className="hidden md:block overflow-x-auto glass-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-left px-5 py-3.5 whitespace-nowrap font-semibold uppercase"
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    backgroundColor: 'var(--bg-card-hover)',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors duration-150 ${onRowClick ? 'cursor-pointer' : ''}`}
                style={{
                  borderBottom: i < data.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={e => onRowClick && (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={e => onRowClick && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className="px-5 py-4 whitespace-nowrap"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list — shown only on mobile */}
      <div className="md:hidden divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {data.map((row, i) => (
          <div
            key={row.id || i}
            onClick={() => onRowClick?.(row)}
            className={`px-4 py-3.5 active:bg-[var(--bg-card-hover)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {mobileCardRenderer ? (
              mobileCardRenderer(row)
            ) : (
              /* Fallback: show first 3 columns as key-value pairs */
              <div className="space-y-1.5">
                {columns.slice(0, 4).map(col => (
                  col.label && (
                    <div key={col.key} className="flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-wider font-semibold shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {col.label}
                      </span>
                      <div className="text-sm text-right" style={{ color: 'var(--text-primary)' }}>
                        {col.render ? col.render(row) : row[col.key] ?? '—'}
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
