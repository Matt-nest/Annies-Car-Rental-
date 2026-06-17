/** Status presentation + grouping shared by Trips list and Trip detail. */
import type { TripSummary } from '../portalClient';

export interface StatusMeta { label: string; color: string; bg: string; }

const META: Record<string, StatusMeta> = {
  pending_approval: { label: 'Pending review', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  approved:         { label: 'Approved',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  confirmed:        { label: 'Confirmed',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  ready_for_pickup: { label: 'Ready for pickup', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  active:           { label: 'On the road',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  returned:         { label: 'Returned',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  completed:        { label: 'Completed',      color: '#6b7280', bg: 'rgba(107,114,128,0.14)' },
  cancelled:        { label: 'Cancelled',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  declined:         { label: 'Declined',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

export function statusMeta(status: string): StatusMeta {
  return META[status] || { label: status, color: '#6b7280', bg: 'rgba(107,114,128,0.14)' };
}

export type TripGroup = 'current' | 'upcoming' | 'past';

export function groupOf(status: string): TripGroup {
  if (status === 'active' || status === 'ready_for_pickup' || status === 'returned') return 'current';
  if (status === 'completed' || status === 'cancelled' || status === 'declined') return 'past';
  return 'upcoming';
}

export function groupTrips(trips: TripSummary[]): Record<TripGroup, TripSummary[]> {
  const out: Record<TripGroup, TripSummary[]> = { current: [], upcoming: [], past: [] };
  for (const t of trips) out[groupOf(t.status)].push(t);
  return out;
}

export function vehicleName(v?: { year?: number; make?: string; model?: string } | null): string {
  if (!v) return 'Vehicle';
  return [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle';
}

export function fmtDate(d?: string): string {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
