import { lazy, Suspense } from 'react';
import { useWidgetLayout } from '../../hooks/useWidgetLayout';
import { SkeletonChartCard, SkeletonKpi, SkeletonCard } from '../shared/Skeleton';

// ─── Widget component map ─────────────────────────────────────────────────────
// Each import is a lazy component so hidden widgets cost nothing at runtime.
import MorningBriefingWidget   from './widgets/MorningBriefingWidget';
import OverdueAlertsWidget     from './widgets/OverdueAlertsWidget';
import PendingApprovalsWidget  from './widgets/PendingApprovalsWidget';
import PendingCounterSignWidget from './widgets/PendingCounterSignWidget';
import TodayScheduleWidget     from './widgets/TodayScheduleWidget';
import WeekScheduleWidget      from './widgets/WeekScheduleWidget';
import VehicleRevenueWidget    from './widgets/VehicleRevenueWidget';
import ActivityFeedWidget      from './widgets/ActivityFeedWidget';
import DamageSummaryWidget     from './widgets/DamageSummaryWidget';
import RevenueHeatmapWidget    from './widgets/RevenueHeatmapWidget';

const KPICardsWidget = lazy(() => import('./widgets/KPICardsWidget'));
const RevenueTrendWidget = lazy(() => import('./widgets/RevenueTrendWidget'));

const FALLBACKS = {
  'kpi-cards': () => <SkeletonKpi count={5} />,
  'revenue-trend': () => <SkeletonChartCard height={350} />,
};

const WIDGET_COMPONENTS = {
  'morning-briefing':  MorningBriefingWidget,
  'overdue-alerts':    OverdueAlertsWidget,
  'pending-approvals': PendingApprovalsWidget,
  'pending-counter-sign': PendingCounterSignWidget,
  'kpi-cards':         KPICardsWidget,

  'revenue-trend':     RevenueTrendWidget,
  'today-schedule':    TodayScheduleWidget,
  'week-schedule':     WeekScheduleWidget,
  'vehicle-revenue':   VehicleRevenueWidget,
  'activity-feed':     ActivityFeedWidget,
  'damage-summary':    DamageSummaryWidget,
  'revenue-heatmap':   RevenueHeatmapWidget,
};

/**
 * Reads the persisted widget layout and renders only the visible widgets
 * in their configured order.
 *
 * Toggling a widget OFF means its component never mounts → no API calls.
 */
export default function DashboardLayoutEngine() {
  const { widgets } = useWidgetLayout();

  return (
    <div className="space-y-6">
      {widgets.map(({ id, visible }) => {
        if (!visible) return null;
        const Component = WIDGET_COMPONENTS[id];
        if (!Component) return null;
        const fallback = FALLBACKS[id]?.() ?? <SkeletonCard />;
        return (
          <Suspense key={id} fallback={fallback}>
            <Component />
          </Suspense>
        );
      })}
    </div>
  );
}
