/**
 * useHaptic / haptic — a tiny consistency layer for `navigator.vibrate()`.
 *
 * iOS Safari silently ignores `navigator.vibrate` — that's fine, the calls
 * become no-ops and the visual feedback (active:scale, color flash, etc.)
 * carries the load. Android, most Chromium-based browsers, and Firefox honor
 * it. Linux/desktop Chrome ignores it.
 *
 * We standardize on three "patterns" matching the Material Design haptic
 * vocabulary so the rest of the codebase doesn't sprinkle magic numbers:
 *   • `tap`    — primary tap, 10 ms (default action)
 *   • `edge`   — gesture passed a threshold, 6 ms (e.g. swipe-card crossed
 *                the approve/decline edge)
 *   • `commit` — destructive or high-confidence confirm, 14 ms
 *
 * Usage:
 *   import { haptic } from '@/hooks/useHaptic';
 *   haptic('tap');
 */
type HapticPattern = 'tap' | 'edge' | 'commit';

const PATTERNS: Record<HapticPattern, number> = {
  tap: 10,
  edge: 6,
  commit: 14,
};

export function haptic(pattern: HapticPattern = 'tap'): void {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  try {
    navigator.vibrate?.(PATTERNS[pattern]);
  } catch {
    /* swallow — some browsers throw if vibrate is called too rapidly */
  }
}
