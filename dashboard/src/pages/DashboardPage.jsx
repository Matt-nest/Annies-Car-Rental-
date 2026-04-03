import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Car, ArrowDownToLine, ArrowUpFromLine, DollarSign, Star, Calendar, Activity } from 'lucide-react';
import { api } from '../api/client';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format, formatDistanceToNow } from 'date-fns';

function StatCard({ label, value, icon: Icon, color = 'amber', sub }) {
  const colors = {
    amber:  'bg-amber-50 text-amber-600',
    green:  'bg-green-50 text-green-600',
    blue:   'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-stone-900">{value ?? '—'}</p>
        <p className="text-sm text-stone-500">{label}</p>
        {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.getOverview(), api.getUpcoming(), api.getActivity(10)])
      .then(([ov, up, act]) => {
        setOverview(ov);
        setUpcoming(up);
        setActivity(act);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="min-h-screen" />;

  const upcomingAll = [
    ...(upcoming?.pickups || []).map(b => ({ ...b, _type: 'pickup', _date: b.pickup_date, _time: b.pickup_time })),
    ...(upcoming?.returns || []).map(b => ({ ...b, _type: 'return', _date: b.return_date, _time: b.return_time })),
  ].sort((a, b) => a._date.localeCompare(b._date) || a._time.localeCompare(b._time));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Dashboard</h1>
        <p className="text-sm text-stone-500">Good morning — here's what needs your attention.</p>
      </div>

      {/* Action Required */}
      {overview?.pending_approvals > 0 && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
          onClick={() => navigate('/bookings?status=pending_approval')}
        >
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <div>
              <p className="font-medium text-amber-900">
                {overview.pending_approvals} booking{overview.pending_approvals !== 1 ? 's' : ''} waiting for approval
              </p>
              <p className="text-sm text-amber-700">Review and approve or decline</p>
            </div>
          </div>
          <span className="text-sm font-medium text-amber-700">View →</span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Rentals"      value={overview?.active_rentals}      icon={Car}               color="green" />
        <StatCard label="Pickups Today"       value={overview?.pickups_today?.length} icon={ArrowUpFromLine}  color="blue" />
        <StatCard label="Returns Today"       value={overview?.returns_today?.length} icon={ArrowDownToLine}  color="purple" />
        <StatCard label="Revenue This Month"  value={`$${Number(overview?.revenue_this_month || 0).toLocaleString()}`} icon={DollarSign} color="amber"
          sub={`${overview?.bookings_this_month} bookings`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming 7 days */}
        <div className="card">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Calendar size={16} className="text-stone-400" />
            <h2 className="font-medium text-stone-900 text-sm">Upcoming — Next 7 Days</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {upcomingAll.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">Nothing scheduled</p>
            )}
            {upcomingAll.slice(0, 10).map(b => (
              <div
                key={`${b._type}-${b.id}`}
                className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-stone-50 transition-colors"
                onClick={() => navigate(`/bookings/${b.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${b._type === 'pickup' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                  <div>
                    <p className="text-sm font-medium text-stone-900">
                      {b.customers?.first_name} {b.customers?.last_name}
                    </p>
                    <p className="text-xs text-stone-400">
                      {b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-stone-700">{format(new Date(b._date), 'MMM d')}</p>
                  <p className={`text-xs ${b._type === 'pickup' ? 'text-blue-500' : 'text-purple-500'}`}>
                    {b._type === 'pickup' ? 'Pickup' : 'Return'} {b._time?.slice(0, 5)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <Activity size={16} className="text-stone-400" />
            <h2 className="font-medium text-stone-900 text-sm">Recent Activity</h2>
          </div>
          <div className="divide-y divide-stone-50">
            {activity.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-8">No recent activity</p>
            )}
            {activity.map(log => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-stone-700">
                      <span className="font-medium">
                        {log.bookings?.customers?.first_name} {log.bookings?.customers?.last_name}
                      </span>
                      {' '}— {log.bookings?.booking_code}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {log.from_status && <StatusBadge status={log.from_status} />}
                      {log.from_status && <span className="text-stone-300 text-xs">→</span>}
                      <StatusBadge status={log.to_status} />
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
