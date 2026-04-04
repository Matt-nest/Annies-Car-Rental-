import { SkeletonTable } from './Skeleton';
import EmptyState from './EmptyState';
import { FileText } from 'lucide-react';

export default function DataTable({ columns, data, loading, emptyMessage = 'No results', emptyIcon, onRowClick }) {
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
    <div className="overflow-x-auto glass-scroll">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left px-5 py-4 whitespace-nowrap font-bold uppercase"
                style={{
                  color: 'var(--text-tertiary)',
                  fontSize: '10px',
                  letterSpacing: '0.08em',
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
  );
}
