import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { btn } from '../components/Modal';
import { duration, ease } from '../motion';

/** The × on a dated entry: first click asks "Delete?", second click deletes. */
export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <ConfirmButton
      onConfirm={onDelete}
      confirm="Delete?"
      label={label}
      className={btn.icon}
      armedClassName={armedDanger}
    >
      ×
    </ConfirmButton>
  );
}

/**
 * A company page section: click the title to collapse it, drag anywhere on
 * the header row to reorder (SPEC section 6; whole row per Zack, round 2).
 * Lives inside a SortableContext (see CompanyPanel).
 */
export function Section({
  id,
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`group/sec relative grid bg-surface ${isDragging ? 'z-10 shadow-panel' : ''}`}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        role="group"
        aria-roledescription="Section header, drag to reorder"
        title="Drag to reorder"
        className="flex cursor-grab touch-none items-center gap-1.5 border-b border-line pb-2 select-none active:cursor-grabbing"
      >
        <span
          aria-hidden="true"
          className="px-0.5 text-[13px] tracking-[-2px] text-faint opacity-0 transition-opacity group-hover/sec:opacity-100"
        >
          ⋮⋮
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 cursor-[inherit] items-center gap-1.5 text-left"
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
    </section>
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
