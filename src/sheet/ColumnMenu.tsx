import { useState, type FormEvent, type ReactNode } from 'react';
import {
  deleteColumn,
  moveColumn,
  nameTaken,
  typeHasChoices,
  updateColumn,
} from '../model/columns';
import { TYPE_LABELS, type Column } from '../model/types';
import { useArm } from '../lib/useArm';
import { btn, field } from '../components/Modal';
import { Popover, PopoverHeader } from '../components/Popover';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSheetUI } from './SheetUI';

/** A sheet column header; click it to rename, hide, move, edit choices or delete the column. */
export function ColumnHeader({ col, extra }: { col: Column; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <th className="min-w-36 font-semibold">
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={`${col.name} column`}
        trigger={
          <button
            type="button"
            className="flex w-full flex-col gap-0.5 px-2.5 pt-[7px] pb-1.5 text-left text-[12.5px] text-muted transition-colors hover:bg-hover"
          >
            <span>{col.name}</span>
            {extra ?? (
              <span className="eyebrow text-[10px] font-medium text-faint">
                {TYPE_LABELS[col.type]}
              </span>
            )}
          </button>
        }
      >
        <ColumnMenu col={col} onDone={() => setOpen(false)} />
      </Popover>
    </th>
  );
}

function ColumnMenu({ col, onDone }: { col: Column; onDone: () => void }) {
  const { board, actions } = useWorkspace();
  const { editChoices } = useSheetUI();
  const toast = useToast();
  const [name, setName] = useState(col.name);
  const [onSheet, setOnSheet] = useState(col.onSheet !== false);
  const isStatus = col.id === 'status';
  const idx = board.columns.findIndex((c) => c.id === col.id);
  const [armed, del] = useArm(() => {
    actions.saveBoard(deleteColumn(board, col.id));
    toast(`Deleted ${col.name}`);
    onDone();
  });

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n && nameTaken(board, n, col.id)) {
      toast('There’s already a column with that name');
      return;
    }
    actions.saveBoard(
      updateColumn(board, col.id, { name: n || col.name, ...(isStatus ? {} : { onSheet }) }),
    );
    toast('Saved');
    onDone();
  };

  return (
    <form onSubmit={save} className="grid gap-2.5">
      <PopoverHeader title={col.name} caption={TYPE_LABELS[col.type]} />
      <label htmlFor="col-name" className="grid gap-1">
        <span className="eyebrow text-[10.5px] text-muted">Name</span>
        <input
          id="col-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </label>
      {!isStatus && (
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={onSheet}
            onChange={(e) => setOnSheet(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Show on the sheet
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="submit" className={`${btn.primary} ${btn.small}`}>
          Save
        </button>
        {typeHasChoices(col.type) && (
          <button
            type="button"
            className={`${btn.base} ${btn.small}`}
            onClick={() => {
              onDone();
              editChoices(col.id);
            }}
          >
            Edit choices
          </button>
        )}
      </div>
      {isStatus ? (
        <p className="m-0 text-xs text-muted">Company and Status are always on the sheet.</p>
      ) : (
        <>
          <div className="flex gap-1.5">
            <button
              type="button"
              className={`${btn.base} ${btn.small}`}
              disabled={idx <= 1}
              onClick={() => actions.saveBoard(moveColumn(board, col.id, -1))}
            >
              ← Move
            </button>
            <button
              type="button"
              className={`${btn.base} ${btn.small}`}
              disabled={idx === board.columns.length - 1}
              onClick={() => actions.saveBoard(moveColumn(board, col.id, 1))}
            >
              Move →
            </button>
          </div>
          <div>
            <button
              type="button"
              className={`${btn.base} ${btn.small} ${btn.danger}`}
              onClick={del}
            >
              {armed ? 'Click again to delete' : 'Delete column'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
