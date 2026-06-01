/**
 * Shared formatting utilities used across booking, rental agreement,
 * and status pages to eliminate duplicate implementations.
 */

/** Format an ISO date string to "Mon DD, YYYY" */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format a 24h time string (e.g., "14:00") to "2:00 PM" */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${suffix}`;
}

/** Format a number as USD currency (e.g., "$1,234.56") */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
