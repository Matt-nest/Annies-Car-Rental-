import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, DollarSign, TrendingUp, CreditCard, Calendar, Car } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { SkeletonKpi, SkeletonChartCard, SkeletonTable } from '../components/shared/Skeleton';
import EmptyState from '../components/shared/EmptyState';
import RevenueHeatmapWidget from '../components/dashboard/widgets/RevenueHeatmapWidget';

const EASE = [0.25, 1, 0.5, 1];
const PIE_COLORS = ['#00D4AA', '#1E3A5F', '#818cf8', '#63b3ed', '#f87171', '#f59e0b', '#ec4899'];
const CATEGORY_COLORS = { sedan: '#818cf8', suv: '#00D4AA', truck: '#1E3A5F', luxury: '#f59e0b', electric: '#63b3ed', uncategorized: '#94a3b8' };

function GlassTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-tooltip">
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color || 'var(--text-secondary)' }}>
          {p.name}: {prefix}{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

function exportCSV(transactions) {
  const headers = ['Date', 'Booking Code', 'Vehicle', 'Subtotal', 'Tax', 'Total', 'Source'];
  const rows = (transactions || []).map(t => [
    t.pickup_date,
    t.booking_code,
    t.vehicles ? `${t.vehicles.year} ${t.vehicles.make} ${t.vehicles.model}` : '',
    Number(t.total_cost - (t.tax_amount || 0)).toFixed(2),
    Number(t.tax_amount || 0).toFixed(2),
    Number(t.total_cost).toFixed(2),
    t.source || 'website',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `annies-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, sub, icon: Icon, accentColor }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-2xl font-bold tabular-nums" style={{ color: accentColor || 'var(--text-primary)' }}>{value}</p>
          <p className="text-sm mt-1.5 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl" style={{
            backgroundColor: accentColor ? `${accentColor}18` : 'var(--bg-card-hover)',
            color: accentColor || 'var(--text-secondary)',
          }}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

const RANGE_PRESETS = [
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: null },
];

export default function RevenuePage() {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState(4); // All time

  const fetchRevenue = useCallback(async (rangeIndex) => {
    setLoading(true);
    try {
      const preset = RANGE_PRESETS[rangeIndex];
      const params = {};
      if (preset.days) {
        params.from = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        params.to = new Date().toISOString().slice(0, 10);
      }
      const data = await api.getRevenue(params);
      setRevenue(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRevenue(activeRange);
  }, [activeRange, fetchRevenue]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        <div className="space-y-2">
          <div className="skeleton skeleton-text" style={{ width: 120, height: 28 }} />
          <div className="skeleton skeleton-text" style={{ width: 200, height: 14 }} />
        </div>
        <SkeletonKpi count={4} />
        <SkeletonChartCard height={300} />
        <div className="grid lg:grid-cols-2 gap-4">
          <SkeletonChartCard height={260} />
          <SkeletonChartCard height={260} />
        </div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  const monthData = Object.entries(revenue?.by_month || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: Number(Number(total).toFixed(0)) }));

  const vehicleData = Object.entries(revenue?.by_vehicle || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([name, total]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, total: Number(Number(total).toFixed(0)) }));

  const sourceData = Object.entries(revenue?.by_source || {})
    .map(([name, value]) => ({ name, value: Number(Number(value).toFixed(0)) }));

  const categoryData = Object.entries(revenue?.by_category || {})
    .map(([name, value]) => ({ name, value: Number(Number(value).toFixed(0)) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Revenue</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Financial overview and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportCSV(revenue?.transactions)} className="btn-secondary">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </motion.div>

      {/* Date range filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar size={14} className="text-gray-400 mr-1" />
        {RANGE_PRESETS.map((preset, i) => (
          <button
            key={i}
            onClick={() => setActiveRange(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              i === activeRange
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Revenue" value={`$${Number(revenue?.total || 0).toLocaleString()}`} sub="Selected period" icon={DollarSign} accentColor="#22c55e" />
        <StatCard label="This Month" value={`$${Number(revenue?.this_month_revenue || 0).toLocaleString()}`} sub={`${revenue?.this_month_bookings || 0} bookings`} icon={Calendar} accentColor="#818cf8" />
        <StatCard label="Avg per Booking" icon={CreditCard} accentColor="#1E3A5F"
          value={revenue?.transactions?.length
            ? `$${(Number(revenue.total) / revenue.transactions.length).toFixed(0)}`
            : '$0'}
        />
        <StatCard label="FL Sales Tax" value={`$${Number(revenue?.total_tax || 0).toLocaleString()}`} sub="7% of subtotal" icon={DollarSign} />
      </div>

      {/* Monthly chart with trend line overlay */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Revenue</h2>
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-[#1E3A5F] inline-block" /> Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#00D4AA] inline-block" /> Trend</span>
          </div>
        </div>
        <div className="p-5" style={{ height: 300 }}>
          {monthData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No revenue data yet" description="Revenue will appear once bookings are completed." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<GlassTooltip prefix="$" />} />
                <Bar dataKey="total" fill="#1E3A5F" radius={[6, 6, 0, 0]} barSize={32} name="Revenue" />
                <Line type="monotone" dataKey="total" stroke="#00D4AA" strokeWidth={2} dot={false} name="Trend" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* By vehicle */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue by Vehicle</h2>
          </div>
          <div className="p-5" style={{ height: 260 }}>
            {vehicleData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No vehicle data" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vehicleData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} width={130} />
                  <Tooltip content={<GlassTooltip prefix="$" />} />
                  <Bar dataKey="total" fill="#818cf8" radius={[0, 6, 6, 0]} barSize={20} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* By category (NEW donut chart) */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue by Category</h2>
          </div>
          <div className="p-5" style={{ height: 260 }}>
            {categoryData.length === 0 ? (
              <EmptyState icon={Car} title="No category data" />
            ) : (
              <div className="flex items-center h-full">
                <ResponsiveContainer width="55%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<GlassTooltip prefix="$" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3 pl-2">
                  {categoryData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[item.name] || PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs capitalize flex-1" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>${Number(item.value).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* By source */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Bookings by Source</h2>
        </div>
        <div className="p-5" style={{ height: 260 }}>
          {sourceData.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No source data" />
          ) : (
            <div className="flex items-center h-full">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={5}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<GlassTooltip prefix="$" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3 pl-2">
                {sourceData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs capitalize flex-1" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>${Number(item.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Transactions</h2>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{revenue?.transactions?.length || 0} total</span>
        </div>
        <div className="overflow-x-auto glass-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {['Date', 'Booking', 'Vehicle', 'Subtotal', 'Tax', 'Total', 'Source'].map(h => (
                  <th key={h} className="text-left px-5 py-4 font-bold uppercase" style={{ color: 'var(--text-tertiary)', fontSize: '10px', letterSpacing: '0.08em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(revenue?.transactions || []).length === 0 ? (
                <tr><td colSpan="7"><EmptyState icon={DollarSign} title="No transactions yet" /></td></tr>
              ) : (
                (revenue?.transactions || []).map((t, i) => (
                  <tr
                    key={i}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-5 py-4 mono-code text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.pickup_date}</td>
                    <td className="px-5 py-4 mono-code text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.booking_code}</td>
                    <td className="px-5 py-4" style={{ color: 'var(--text-secondary)' }}>{t.vehicles ? `${t.vehicles.year} ${t.vehicles.make} ${t.vehicles.model}` : '—'}</td>
                    <td className="px-5 py-4 tabular-nums" style={{ color: 'var(--text-secondary)' }}>${Number(t.total_cost - (t.tax_amount || 0)).toFixed(2)}</td>
                    <td className="px-5 py-4 tabular-nums" style={{ color: 'var(--text-tertiary)' }}>${Number(t.tax_amount || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-bold tabular-nums" style={{ color: '#22c55e' }}>${Number(t.total_cost).toLocaleString()}</td>
                    <td className="px-5 py-4 capitalize" style={{ color: 'var(--text-secondary)' }}>{t.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Heatmap */}
      <RevenueHeatmapWidget />
    </div>
  );
}
