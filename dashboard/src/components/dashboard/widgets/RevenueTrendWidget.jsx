import { useEffect, useState, useCallback, useRef } from 'react';
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
      <p className="text-xs" style={{ color: '#22c55e' }}>
        Revenue: ${Number(payload[0]?.value || 0).toLocaleString()}
      </p>
    </div>
  );
}

/* Animated glowing dot that pulses at the latest data point */
function PulsingDot(props) {
  const { cx, cy, index, dataLength } = props;
  if (index !== dataLength - 1 || !cx || !cy) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#22c55e" opacity={0.25}>
        <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.35;0.08;0.35" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={4} fill="#22c55e" stroke="var(--bg-primary)" strokeWidth={2} />
    </g>
  );
}

export default function RevenueTrendWidget() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setMounted(false);
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
      .finally(() => {
        setLoading(false);
        // Small delay to let ResponsiveContainer measure, then trigger animation
        timerRef.current = setTimeout(() => setMounted(true), 100);
      });
  }, []);

  useEffect(() => { load(); return () => clearTimeout(timerRef.current); }, [load]);

  const total = data.reduce((s, d) => s + d.total, 0);
  const peak = data.length > 0 ? Math.max(...data.map(d => d.total)) : 0;

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
      {/* Summary stat bar */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>14-Day Total</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: '#22c55e' }}>${total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-tertiary)' }}>Peak Day</p>
          <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>${peak.toLocaleString()}</p>
        </div>
      </div>

      <div className="px-3 pb-4" style={{ height: 240 }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No revenue data available</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mounted ? data : data.map(d => ({ ...d, total: 0 }))}>
              <defs>
                <linearGradient id="revTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="50%" stopColor="#22c55e" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <filter id="glowLine">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" opacity={0.5} />
              <XAxis
                dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <Tooltip content={<GlassTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#revTrendGrad)"
                filter="url(#glowLine)"
                isAnimationActive={true}
                animationDuration={1800}
                animationBegin={0}
                animationEasing="ease-out"
                dot={(props) => <PulsingDot {...props} dataLength={data.length} />}
                activeDot={{ r: 5, fill: '#22c55e', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetWrapper>
  );
}
