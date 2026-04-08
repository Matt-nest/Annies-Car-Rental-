/**
 * Widget registry — single source of truth for dashboard widget metadata
 * and the default layout (order + visibility).
 *
 * ADDING A NEW WIDGET:
 *  1. Add an entry here.
 *  2. Create the component in components/dashboard/widgets/.
 *  3. Register it in WIDGET_COMPONENTS inside DashboardLayoutEngine.jsx.
 */

export const WIDGET_REGISTRY = [
  {
    id: 'overdue-alerts',
    label: 'Overdue Return Alerts',
    description: 'Active rentals that have passed their scheduled return time',
    defaultVisible: true,
  },
  {
    id: 'pending-approvals',
    label: 'Pending Approvals Queue',
    description: 'Approve or decline bookings without leaving the dashboard',
    defaultVisible: true,
  },
  {
    id: 'pending-counter-sign',
    label: 'Pending Counter-Signatures',
    description: 'Agreements awaiting your counter-signature to confirm the booking',
    defaultVisible: true,
  },
  {
    id: 'morning-briefing',
    label: 'Morning Briefing',
    description: 'Time-aware ops summary — pickups, returns, revenue at a glance',
    defaultVisible: true,
  },
  {
    id: 'kpi-cards',
    label: 'KPI Summary Cards',
    description: 'Active rentals, pending, pickups today, returns today, monthly revenue',
    defaultVisible: true,
  },
  {
    id: 'fleet-grid',
    label: 'Fleet Command Grid',
    description: 'Live tile view of every vehicle with status, renter, and return countdown',
    defaultVisible: true,
  },
  {
    id: 'revenue-trend',
    label: 'Revenue Trend',
    description: '14-day revenue area chart',
    defaultVisible: true,
  },
  {
    id: 'today-schedule',
    label: "Today's Schedule",
    description: "Today's pickups and returns, sorted by time",
    defaultVisible: true,
  },
  {
    id: 'week-schedule',
    label: 'Next 7 Days',
    description: 'Week strip with pickup/return indicators per day',
    defaultVisible: true,
  },
  {
    id: 'vehicle-revenue',
    label: 'Vehicle Revenue Leaderboard',
    description: 'Vehicles ranked by revenue — see your earners and your idle cars',
    defaultVisible: true,
  },
  {
    id: 'activity-feed',
    label: 'Recent Activity',
    description: 'Latest booking status changes across the fleet',
    defaultVisible: true,
  },
  {
    id: 'damage-summary',
    label: 'Damage Reports Summary',
    description: 'Fleet-wide damage reports aggregated by vehicle and severity',
    defaultVisible: false,
  },
  {
    id: 'revenue-heatmap',
    label: 'Revenue Heatmap Calendar',
    description: 'Full-year daily revenue grid — spot seasonal patterns instantly',
    defaultVisible: false,
  },
];

/** The canonical default layout used on first visit and after Reset. */
export const DEFAULT_LAYOUT = WIDGET_REGISTRY.map((w, i) => ({
  id: w.id,
  visible: w.defaultVisible,
  order: i,
}));

/** Fast lookup map by widget id. */
export const WIDGET_META = Object.fromEntries(WIDGET_REGISTRY.map((w) => [w.id, w]));
