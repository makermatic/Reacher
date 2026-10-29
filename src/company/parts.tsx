import type { ReactNode } from 'react';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { btn } from '../components/Modal';

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
