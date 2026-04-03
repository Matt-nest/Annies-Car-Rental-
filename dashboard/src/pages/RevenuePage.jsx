import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { api } from '../api/client';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e'];

function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <p className="text-2xl font-semibold text-stone-900">{value}</p>
      <p className="text-sm text-stone-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function RevenuePage() {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRevenue()
      .then(setRevenue)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  const monthData = Object.entries(revenue?.by_month || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Number(total).toFixed(0) }));

  const vehicleData = Object.entries(revenue?.by_vehicle || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, total]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, total: Number(total).toFixed(0) }));

  const sourceData = Object.entries(revenue?.by_source || {})
    .map(([name, value]) => ({ name, value: Number(value).toFixed(0) }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">Revenue</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`$${Number(revenue?.total || 0).toLocaleString()}`} sub="All time" />
        <StatCard label="Transactions" value={revenue?.transactions?.length || 0} />
        <StatCard
          label="Avg per Booking"
          value={revenue?.transactions?.length
            ? `$${(Number(revenue.total) / revenue.transactions.length).toFixed(0)}`
            : '$0'}
        />
        <StatCard
          label="Top Source"
          value={sourceData[0]?.name || '—'}
          sub={sourceData[0] ? `$${Number(sourceData[0].value).toLocaleString()}` : ''}
        />
      </div>

      {/* Monthly revenue chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-stone-700 mb-4">Monthly Revenue</h2>
        {monthData.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-8">No data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#78716c' }} />
              <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={v => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue by vehicle */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Revenue by Vehicle</h2>
          {vehicleData.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vehicleData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#78716c' }} width={120} />
                <Tooltip formatter={v => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Revenue by source */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-stone-700 mb-4">Bookings by Source</h2>
          {sourceData.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {sourceData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={v => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Transaction log */}
      <div className="card">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="text-sm font-semibold text-stone-700">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                {['Date', 'Booking', 'Vehicle', 'Amount', 'Source'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-stone-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {(revenue?.transactions || []).slice(0, 20).map((t, i) => (
                <tr key={i} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-500">{t.pickup_date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-600">{t.booking_code}</td>
                  <td className="px-4 py-3 text-stone-700">{t.vehicles ? `${t.vehicles.year} ${t.vehicles.make} ${t.vehicles.model}` : '—'}</td>
                  <td className="px-4 py-3 font-medium text-green-700">${Number(t.total_cost).toLocaleString()}</td>
                  <td className="px-4 py-3 text-stone-500 capitalize">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
