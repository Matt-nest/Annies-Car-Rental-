import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Car, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../../api/client';
import WidgetWrapper from '../WidgetWrapper';

const SEVERITY_CONFIG = {
  minor:    { color: '#D4AF37', bg: 'rgba(212,175,55,0.12)',  label: 'Minor' },
  moderate: { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'Moderate' },
  major:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Major' },
  totaled:  { color: '#7f1d1d', bg: 'rgba(127,29,29,0.20)',   label: 'Totaled' },
};

function SeverityChip({ severity, count }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.minor;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <span>{count}</span>
      <span>{cfg.label}</span>
    </div>
  );
}

export default function DamageSummaryWidget() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.getDamageReports()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || []);
        setReports(list);
      })
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aggregate counts by severity
  const severityCounts = reports.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {});

  const totalCost = reports.reduce((s, r) => s + Number(r.estimated_cost || 0), 0);

  return (
    <WidgetWrapper
      title="Damage Reports"
      icon={AlertTriangle}
      loading={loading}
      error={error}
      onRetry={load}
      skeletonType="list"
      noPadding
    >
      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <AlertTriangle size={24} style={{ color: '#22c55e', opacity: 0.7 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>No damage reports on file</p>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xl font-bold display-num" style={{ color: 'var(--text-primary)' }}>{reports.length}</span>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>total reports</span>
            </div>
            {Object.entries(severityCounts).map(([sev, cnt]) => (
              <SeverityChip key={sev} severity={sev} count={cnt} />
            ))}
            {totalCost > 0 && (
              <div className="ml-auto text-right">
                <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Est. cost</p>
                <p className="text-sm font-bold display-num" style={{ color: '#ef4444' }}>
                  ${totalCost.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Report list */}
          {reports.slice(0, 10).map((r, i) => {
            const cfg = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.minor;
            const vehicle = r.vehicles || r.bookings?.vehicles;
            const booking = r.bookings;

            return (
              <div
                key={r.id}
                className="px-5 py-3.5 flex items-start gap-3 transition-colors"
                style={{ borderBottom: i < Math.min(reports.length, 10) - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {/* Severity dot */}
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cfg.color }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {vehicle && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  {r.description && (
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {r.description}
                    </p>
                  )}
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {r.created_at && formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {r.estimated_cost && (
                    <span className="text-xs font-semibold tabular-nums" style={{ color: '#ef4444' }}>
                      ${Number(r.estimated_cost).toLocaleString()}
                    </span>
                  )}
                  {booking?.id && (
                    <button
                      onClick={() => navigate(`/bookings/${booking.id}`)}
                      className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-70"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      <ExternalLink size={9} /> View
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {reports.length > 10 && (
            <div className="px-5 py-3 text-center">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Showing 10 of {reports.length} reports
              </p>
            </div>
          )}
        </>
      )}
    </WidgetWrapper>
  );
}
