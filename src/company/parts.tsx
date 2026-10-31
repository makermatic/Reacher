import { Pencil, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { btn } from '../components/Modal';

/** The × on an entry: first click asks "Delete?", second click deletes. */
export function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <ConfirmButton
      onConfirm={onDelete}
      confirm="Delete?"
      label={label}
      className={btn.icon}
      armedClassName={armedDanger}
    >
      <X size={15} aria-hidden="true" />
    </ConfirmButton>
  );
}

/**
 * One dated row in Applications or Meetings. With an `editor`, a pencil opens
 * it in place (M7g: entries can be edited after adding); it calls `done` to close.
 */
export function Entry({
  date,
  children,
  onDelete,
  label,
  editLabel,
  editor,
}: {
  date: ReactNode;
  children: ReactNode;
  onDelete: () => void;
  label: string;
  editLabel?: string;
  editor?: (done: () => void) => ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing && editor) return <div className={addForm}>{editor(() => setEditing(false))}</div>;
  return (
    <div className="group/entry grid grid-cols-[108px_minmax(0,1fr)_auto] items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-hover/50">
      <span className="pt-px text-[12.5px] text-muted tabular-nums">{date}</span>
      <div className="min-w-0 text-[13.5px] [overflow-wrap:anywhere] whitespace-pre-wrap">
        {children}
      </div>
      <span className="flex items-center opacity-60 transition-opacity group-hover/entry:opacity-100 focus-within:opacity-100">
        {editor && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={editLabel ?? 'Edit'}
            title="Edit"
            className={btn.icon}
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
        )}
        <DeleteButton label={label} onDelete={onDelete} />
      </span>
    </div>
  );
}

/** The tinted box that holds a section's add or edit form. */
export const addForm = 'grid gap-2 rounded-xl border border-line bg-surface p-3';
