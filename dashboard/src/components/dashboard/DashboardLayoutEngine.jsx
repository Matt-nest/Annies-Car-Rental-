import { useWidgetLayout } from '../../hooks/useWidgetLayout';

// ─── Widget component map ─────────────────────────────────────────────────────
// Each import is a lazy component so hidden widgets cost nothing at runtime.
import MorningBriefingWidget   from './widgets/MorningBriefingWidget';
import OverdueAlertsWidget     from './widgets/OverdueAlertsWidget';
import PendingApprovalsWidget  from './widgets/PendingApprovalsWidget';
import PendingCounterSignWidget from './widgets/PendingCounterSignWidget';
import KPICardsWidget          from './widgets/KPICardsWidget';

import RevenueTrendWidget      from './widgets/RevenueTrendWidget';
import TodayScheduleWidget     from './widgets/TodayScheduleWidget';
import WeekScheduleWidget      from './widgets/WeekScheduleWidget';
import VehicleRevenueWidget    from './widgets/VehicleRevenueWidget';
import ActivityFeedWidget      from './widgets/ActivityFeedWidget';
import DamageSummaryWidget     from './widgets/DamageSummaryWidget';
import RevenueHeatmapWidget    from './widgets/RevenueHeatmapWidget';

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
        return <Component key={id} />;
      })}
    </div>
  );
}
