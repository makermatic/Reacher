/**
 * Every timing and curve in Reacher lives here, so the feel can be retuned in
 * one place.
 *
 * Direction (Zack, 2026-10-28): motion should be subtle, fast and functional.
 * Popups and menus stay in the 120–250ms range, use opacity and small
 * transforms only, ease out, and never bounce. Larger surfaces (a whole view)
 * may take a little longer. The curve comes from zackzand.com.
 */
import type { Transition, Variants } from 'motion/react';

export const ease = {
  /** Material "standard" curve, used by zackzand.com's page transitions. */
  standard: [0.4, 0, 0.2, 1],
  /** easeOutQuad: quick start, gentle landing. */
  out: [0.25, 0.46, 0.45, 0.94],
} as const;

/** Seconds. */
export const duration = {
  /** Things leaving, hover feedback. */
  fast: 0.12,
  /** Popovers, menus, rows and cards appearing. */
  base: 0.16,
  /** Dialogs and whole views. */
  slow: 0.22,
} as const;

/** How long the pointer rests on something before its hover popup opens, in ms. */
export const hoverDelay = 1500;

/** How far content drifts during a view change, in px. */
const drift = 6;

/** Cross-fade between whole views (Sheet ↔ Board). */
export const viewTransition: Variants = {
  initial: { opacity: 0, y: drift },
  enter: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
  exit: { opacity: 0, y: -drift / 2, transition: { duration: duration.fast, ease: ease.out } },
};

/** Popovers and menus: a quick fade with a hint of scale toward the trigger. */
export const popIn: Variants = {
  initial: { opacity: 0, y: 4, scale: 0.98 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, scale: 0.99, transition: { duration: duration.fast, ease: ease.out } },
};

/** Dialogs: the same, a touch slower because they're bigger. */
export const dialogIn: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  enter: { opacity: 1, y: 0, scale: 1, transition: { duration: duration.slow, ease: ease.out } },
  exit: { opacity: 0, scale: 0.99, transition: { duration: duration.fast, ease: ease.out } },
};

export const fade: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: duration.slow, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.out } },
};

/** Rows and cards appearing or leaving. */
export const itemInOut = {
  initial: { opacity: 0, y: -3 },
  animate: { opacity: 1, y: 0, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.out } },
};

/** Elements that slide to a new position (e.g. the view switcher's highlight). */
export const glide: Transition = { duration: duration.slow, ease: ease.standard };
