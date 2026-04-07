import { supabase } from '../db/supabase.js';

/**
 * Create a notification for the dashboard.
 * Called from various services when events occur.
 */
export async function createNotification(type, title, message, link = null, metadata = {}) {
  try {
    const { error } = await supabase.from('notifications').insert({
      type,
      title,
      message,
      link,
      metadata,
    });

    if (error) {
      console.error('[Notification] Insert failed:', error.message, error.details, error.hint);
      return null;
    }

    console.log(`[Notification] Created: ${type} — ${title}`);
    return { success: true };
  } catch (e) {
    console.error('[Notification] Exception:', e.message);
    return null;
  }
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
