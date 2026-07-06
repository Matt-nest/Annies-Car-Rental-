/**
 * haptic — tiny consistency layer for `navigator.vibrate()`.
 *
 * Mirrors src/hooks/useHaptic.ts on the customer site. iOS silently ignores
 * navigator.vibrate; Android / Chrome / Firefox honor it.
 *
 * Patterns:
 *   • 'tap'    — 10 ms (default tap)
 *   • 'edge'   — 6 ms (gesture crossed a threshold)
 *   • 'commit' — 14 ms (high-confidence confirm)
 *
 * Usage:
 *   import { haptic } from '@/lib/haptic';
 *   haptic('tap');
 */
const PATTERNS = { tap: 10, edge: 6, commit: 14 };

export function haptic(pattern = 'tap') {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  try { navigator.vibrate?.(PATTERNS[pattern] ?? PATTERNS.tap); }
  catch { /* swallow rate-limit rejections */ }
}
