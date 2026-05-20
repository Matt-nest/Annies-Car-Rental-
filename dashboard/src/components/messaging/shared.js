/**
 * Shared utilities + constants for the messaging UI.
 * Phase 2E decomposition — formerly inline at top of MessagingPage.jsx.
 *
 * EASE/SPRING are re-exported from lib/animation.js so the messaging UI uses
 * the same motion vocabulary as the rest of the dashboard. Imports here are
 * unchanged so callers keep working; new code should reach for lib/animation
 * directly.
 */

import { EASE_OUT_QUART, SPRING_SNAPPY } from '../../lib/animation';

/* ── Design Tokens (re-exported from lib/animation.js) ── */
export const EASE = EASE_OUT_QUART;
export const SPRING = SPRING_SNAPPY;

export const TEMPLATE_STAGES = [
  // Booking flow
  { value: 'booking_submitted', label: 'Booking Submitted', color: '#22c55e' },
  { value: 'booking_approved', label: 'Booking Approved', color: '#10b981' },
  { value: 'booking_declined', label: 'Booking Declined', color: '#ef4444' },
  { value: 'booking_cancelled', label: 'Booking Cancelled', color: '#f97316' },
  // Payment
  { value: 'payment_confirmed', label: 'Payment Confirmed', color: '#3b82f6' },
  // Pickup flow
  { value: 'pickup_reminder', label: 'Pre-Pickup (24h)', color: '#f59e0b' },
  { value: 'day_of_pickup', label: 'Day-of Pickup', color: '#eab308' },
  // During rental
  { value: 'mid_rental_checkin', label: 'Mid-Rental Check-in', color: '#8b5cf6' },
  { value: 'extension_offer', label: 'Extension Offer', color: '#a78bfa' },
  // Return flow
  { value: 'return_reminder', label: 'Pre-Return (24h)', color: '#ec4899' },
  { value: 'day_of_return', label: 'Day-of Return', color: '#f472b6' },
  { value: 'return_confirmed', label: 'Return Confirmed', color: '#14b8a6' },
  // Post-rental
  { value: 'rental_completed', label: 'Review Request', color: '#06b6d4' },
  { value: 'repeat_customer', label: 'Loyalty / Repeat', color: '#465FFF' },
  // Alerts
  { value: 'late_return_warning', label: 'Late Warning (1h)', color: '#f97316' },
  { value: 'late_return_escalation', label: 'Late Escalation (4h)', color: '#dc2626' },
  // Other
  { value: 'damage_notification', label: 'Damage Report', color: '#991b1b' },
];

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function getInitials(name) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
];

export function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
