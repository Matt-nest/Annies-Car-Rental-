/**
 * Motion Design System
 * 
 * Three-tier easing vocabulary that replaces the one-curve-fits-all approach.
 * Each easing has a specific perceptual role:
 *
 * - dramatic: slow and heavy, for hero reveals and modal entrances
 * - standard: crisp and confident, for cards and section reveals
 * - smooth:   balanced and subtle, for hovers, toggles, and micro-interactions
 */

export const EASE = {
  dramatic: [0.16, 1, 0.3, 1] as const,
  standard: [0.25, 1, 0.5, 1] as const,
  smooth: [0.65, 0, 0.35, 1] as const,
};

/** Duration presets in seconds */
export const DURATION = {
  fast: 0.3,
  normal: 0.5,
  slow: 0.7,
  cinematic: 1.2,
};

/** Stagger delay multiplier for grid items */
export const STAGGER = {
  fast: 0.06,
  normal: 0.1,
  slow: 0.15,
};

/**
 * Spring presets - reach for these instead of cubic-bezier for anything
 * user-initiated. Spring motion is the single biggest "feels iOS native"
 * signal: drawer open/close, modal entry, button press, sheet rise, route
 * push/pop, list-item drag-snap.
 *
 *  • NATURAL - default native iOS feel. Tight, predictable, faintly bouncy.
 *  • BOUNCE  - slightly under-damped. Overshoots before settling. For
 *              cheerful confirmations (success badges, send-message arrive).
 *  • SMOOTH  - over-damped. No overshoot. For chrome that shouldn't draw
 *              attention to its own motion.
 *  • SNAPPY  - stiffer + tight damping. Very fast, no bounce. Toasts,
 *              badge appearances, in-flight micro-confirmations.
 */
export const SPRING = {
  natural: { type: 'spring' as const, stiffness: 380, damping: 32, mass: 0.9 },
  bounce:  { type: 'spring' as const, stiffness: 320, damping: 22, mass: 0.9 },
  smooth:  { type: 'spring' as const, stiffness: 320, damping: 28 },
  snappy:  { type: 'spring' as const, stiffness: 500, damping: 30 },
};
