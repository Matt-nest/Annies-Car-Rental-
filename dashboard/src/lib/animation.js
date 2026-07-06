/**
 * Motion Design System — Dashboard
 *
 * Centralizes easing curves, durations, springs, and stagger multipliers so the
 * whole dashboard speaks one motion vocabulary instead of every component
 * redefining `const EASE = [...]` locally.
 *
 * The shape mirrors the customer portal's src/utils/motion.ts so a developer
 * jumping between repos doesn't have to re-learn the API. JavaScript values
 * here MUST match the CSS custom properties in styles/globals.css `:root`
 * (`--ease-out-expo`, `--ease-out-quart`, `--ease-in-out`, `--ease-spring`).
 *
 * Three-tier easing vocabulary, each with a specific perceptual role:
 *   - dramatic:  slow and heavy, for modal/sheet entrances and hero reveals
 *   - standard:  crisp and confident, for page/card/widget enters
 *   - smooth:    balanced and subtle, for hovers, toggles, micro-interactions
 *
 * Springs are kept simple — `smooth` for chrome (dropdowns, drawer pin/unpin)
 * and `snappy` for in-flight UI confirmations (toasts, badges).
 */

export const EASE = {
  dramatic: [0.16, 1, 0.3, 1],     // --ease-out-expo
  standard: [0.25, 1, 0.5, 1],     // --ease-out-quart
  smooth: [0.65, 0, 0.35, 1],    // --ease-in-out
};

/** Named individual curves for files that prefer them over EASE.foo. */
export const EASE_OUT_EXPO = EASE.dramatic;
export const EASE_OUT_QUART = EASE.standard;
export const EASE_IN_OUT = EASE.smooth;

/** Duration presets in seconds. */
export const DURATION = {
  fast: 0.15,  // micro-interactions (focus rings, scale-feedback)
  base: 0.22,  // page transitions, default card enters
  normal: 0.30,  // modal panels, dropdowns
  slow: 0.45,  // longer fades, attention-grabbing motion
  cinematic: 1.20,  // intentionally-slow hero reveals
};

/** Spring presets. Spring motion is the single biggest "feels iOS" signal —
 *  reach for these BEFORE cubic-bezier curves for anything user-initiated:
 *  drawer open/close, modal entry, tab indicator slide, button press, sheet
 *  rise, list-item drag-snap. Cubic-bezier is for autonomous animations
 *  (skeletons, ambient pulses) where natural overshoot would feel wrong.
 *
 *  Pick by character:
 *   • NATURAL — the default native iOS feel. Tight, predictable, faintly bouncy.
 *   • BOUNCE  — slightly under-damped — overshoots a hair before settling.
 *               Use for cheerful confirmations (success badges, send-message).
 *   • SMOOTH  — over-damped — settles without overshoot. Use for chrome
 *               that shouldn't draw attention to its own motion.
 *   • SNAPPY  — stiffer + tight damping — very fast, no bounce. Use for
 *               toasts, badge appears, in-flight micro-confirmations.
 */
export const SPRING_NATURAL = { type: 'spring', stiffness: 380, damping: 32, mass: 0.9 };
export const SPRING_BOUNCE = { type: 'spring', stiffness: 320, damping: 22, mass: 0.9 };
export const SPRING_SMOOTH = { type: 'spring', stiffness: 320, damping: 28 };
export const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 30 };

/** Stagger delay multiplier for grid/list items. */
export const STAGGER = {
  fast: 0.04,
  normal: 0.06,
  slow: 0.10,
};
