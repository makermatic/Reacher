/**
 * Every timing and curve in Reacher lives here, so the feel can be retuned in
 * one place. The starting point is zackzand.com: content fades out while
 * drifting up, then fades back in on one standard ease-out curve.
 */
import type { Transition, Variants } from 'motion/react';

export const ease = {
  /** Material "standard" curve, used by zackzand.com's page transitions. */
  standard: [0.4, 0, 0.2, 1],
  /** easeOutQuad, used by zackzand.com's lightbox. */
  out: [0.25, 0.46, 0.45, 0.94],
} as const;

/** Seconds. */
export const duration = {
  fast: 0.2,
  base: 0.35,
  slow: 0.5,
} as const;

/** How far content drifts during a view change, in px. The site uses 60; an app wants less. */
const drift = 14;

/** Cross-fade between whole views (Sheet ↔ Board). */
export const viewTransition: Variants = {
  initial: { opacity: 0, y: drift },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      y: { duration: duration.base, ease: ease.standard },
      opacity: { duration: duration.slow, ease: 'easeOut' },
    },
  },
  exit: {
    opacity: 0,
    y: -drift,
    transition: { duration: duration.fast + 0.05, ease: ease.standard },
  },
};

/** Dialogs and popovers: a short rise and fade. */
export const popIn: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: duration.base, ease: ease.standard },
  },
  exit: {
    opacity: 0,
    y: 4,
    scale: 0.99,
    transition: { duration: duration.fast, ease: ease.standard },
  },
};

export const fade: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: duration.base, ease: ease.out } },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.out } },
};

/** Elements that slide to a new position (e.g. the view switcher's highlight). */
export const glide: Transition = { duration: duration.base, ease: ease.standard };
