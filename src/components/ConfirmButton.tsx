import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useArm } from '../lib/useArm';
import { duration, ease } from '../motion';

/**
 * Every "click twice to delete" button: the first click morphs it into its
 * confirm state (it grows to fit, the new label slides in from the right), the second click runs the
 * action, and it settles back on its own after a few seconds.
 */
export function ConfirmButton({
  children,
  confirm,
  onConfirm,
  className,
  armedClassName,
  label,
}: {
  /** What the button shows at rest (e.g. ×, or "Delete company"). */
  children: ReactNode;
  /** What it shows once armed (e.g. "Delete?"). */
  confirm: ReactNode;
  onConfirm: () => void;
  className: string;
  armedClassName: string;
  /** Screen-reader name at rest. */
  label?: string;
}) {
  const [armed, click] = useArm(onConfirm);
  return (
    <motion.button
      layout
      type="button"
      onClick={click}
      aria-label={label ? (armed ? `Confirm: ${label}` : label) : undefined}
      transition={{ layout: { duration: duration.base, ease: ease.out } }}
      className={`${armed ? armedClassName : className} overflow-hidden whitespace-nowrap`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={armed ? 'armed' : 'rest'}
          layout="position"
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0, transition: { duration: duration.base, ease: ease.out } }}
          exit={{ opacity: 0, x: -4, transition: { duration: duration.fast, ease: ease.out } }}
          className="inline-block"
        >
          {armed ? confirm : children}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** The red tint a delete button takes once armed. */
export const armedDanger =
  'inline-flex items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--c-red)_14%,transparent)] px-2 py-1 text-[12.5px] font-medium text-[var(--c-red)]';
