import LoadingSpinner from './LoadingSpinner';

export default function DataTable({ columns, data, loading, emptyMessage = 'No results', onRowClick }) {
  if (loading) return <LoadingSpinner />;

  if (!data?.length) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">{emptyMessage}</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100">
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left text-xs font-medium text-stone-500 px-4 py-3 whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`${onRowClick ? 'cursor-pointer hover:bg-stone-50' : ''} transition-colors`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 whitespace-nowrap text-stone-700">
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
