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
