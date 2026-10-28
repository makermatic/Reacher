import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import type { ReactNode } from 'react';
import { useArm } from '../lib/useArm';
import { btn } from '../components/Modal';
import { duration, ease } from '../motion';

/** The × on a dated entry: first click asks "Delete?", second click deletes. */
export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [armed, click] = useArm(onDelete);
  return (
    <button
      type="button"
      onClick={click}
      aria-label={armed ? `Confirm: ${label}` : label}
      className={
        armed
          ? `${btn.small} rounded-md bg-[color-mix(in_srgb,var(--c-red)_14%,transparent)] font-medium text-[var(--c-red)]`
          : btn.icon
      }
    >
      {armed ? 'Delete?' : '×'}
    </button>
  );
}

/**
 * A company page section: click the title to collapse it, drag the grip to
 * reorder (SPEC section 6). Lives inside a Reorder.Group.
 */
export function Section({
  id,
  title,
  count,
  collapsed,
  onToggle,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      as="section"
      aria-label={title}
      className="group/sec relative grid bg-surface"
      whileDrag={{ scale: 1.01, boxShadow: 'var(--shadow)', zIndex: 5 }}
      transition={{ duration: duration.base, ease: ease.out }}
    >
      <div className="flex items-center gap-1.5 border-b border-line pb-2">
        <span
          onPointerDown={(e) => controls.start(e)}
          title="Drag to reorder"
          aria-hidden="true"
          className="cursor-grab touch-none px-0.5 text-[13px] tracking-[-2px] text-faint opacity-0 transition-opacity group-hover/sec:opacity-100 active:cursor-grabbing"
        >
          ⋮⋮
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <motion.span
            aria-hidden="true"
            animate={{ rotate: collapsed ? -90 : 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="w-3 text-xs text-muted"
          >
            ▾
          </motion.span>
          <h3 className="m-0 font-display text-base font-bold">
            {title}
            {count != null && (
              <span className="ml-1.5 font-mono text-xs font-medium text-muted">{count}</span>
            )}
          </h3>
        </button>
        {action}
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.out }}
            className="overflow-hidden"
          >
            <div className="grid gap-2.5 pt-2.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  );
}

/** One dated row in Notes, Applications or Meetings. */
export function Entry({
  date,
  children,
  onDelete,
  label,
}: {
  date: ReactNode;
  children: ReactNode;
  onDelete: () => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-line py-2">
      <span className="pt-px font-mono text-xs text-muted">{date}</span>
      <div className="min-w-0 text-[13.5px] [overflow-wrap:anywhere] whitespace-pre-wrap">
        {children}
      </div>
      <DeleteButton label={label} onDelete={onDelete} />
    </div>
  );
}

/** The tinted box that holds a section's add form. */
export const addForm = 'grid gap-2 rounded-xl bg-surface-2 p-2.5';
