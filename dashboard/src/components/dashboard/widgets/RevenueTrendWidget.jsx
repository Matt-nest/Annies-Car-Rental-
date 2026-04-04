import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { api } from '../../../api/client';
import { cachedQuery } from '../../../lib/queryCache';
import WidgetWrapper from '../WidgetWrapper';

function GlassTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-tooltip">
      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-xs" style={{ color: '#D4AF37' }}>
        Revenue: ${Number(payload[0]?.value || 0).toLocaleString()}
      </p>
    </div>
  );
}

export default function RevenueTrendWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    cachedQuery('revenue-daily-14', () => api.getRevenue({ period: 'daily', days: 14 }).catch(() => []))
      .then((rev) => {
        if (Array.isArray(rev)) {
          setData(rev.map((r) => ({
            label: r.date ? format(new Date(r.date), 'MMM d') : (r.label || ''),
            total: Number(r.total || r.amount || 0),
          })));
        }
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const headerAction = (
    <button
      onClick={() => navigate('/revenue')}
      className="text-xs font-medium transition-opacity hover:opacity-70"
      style={{ color: 'var(--accent-color)' }}
    >
      Full report →
    </button>
  );

  return (
    <WidgetWrapper
      title="Revenue Trend — 14 days"
      icon={TrendingUp}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="chart"
      headerAction={headerAction}
      noPadding
    >
      <div className="p-5" style={{ height: 280 }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No revenue data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} dy={8} />
              <YAxis axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<GlassTooltip />} />
              <Area
                type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2.5}
                fill="url(#revGradient)" dot={false}
                activeDot={{ r: 5, fill: '#D4AF37', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetWrapper>
  );
}
