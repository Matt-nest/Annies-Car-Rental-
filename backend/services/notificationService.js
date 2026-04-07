import { supabase } from '../db/supabase.js';

/**
 * Create a notification for the dashboard.
 * Called from various services when events occur.
 */
export async function createNotification(type, title, message, link = null, metadata = {}) {
  const { data, error } = await supabase.from('notifications').insert({
    type,
    title,
    message,
    link,
    metadata,
  }).select().single();

  if (error) {
    console.error('[Notification] Failed to create:', error.message);
    return null;
  }

  return data;
}

/**
 * Notification types and their configurations
 */
export const NOTIFICATION_TYPES = {
  new_booking: { icon: 'BookOpen', color: '#818cf8' },
  status_change: { icon: 'RefreshCw', color: '#63b3ed' },
  payment_received: { icon: 'DollarSign', color: '#22c55e' },
  agreement_pending: { icon: 'FileText', color: '#f59e0b' },
  overdue_return: { icon: 'AlertTriangle', color: '#ef4444' },
  damage_report: { icon: 'AlertOctagon', color: '#ef4444' },
  webhook_failure: { icon: 'Zap', color: '#f97316' },
};
