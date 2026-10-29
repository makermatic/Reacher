import { useState, type FormEvent, type ReactNode } from 'react';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import {
  deleteColumn,
  moveColumn,
  nameTaken,
  typeHasChoices,
  updateColumn,
} from '../model/columns';
import { TYPE_LABELS, type Column } from '../model/types';
import { btn, field } from '../components/Modal';
import { Popover, PopoverHeader } from '../components/Popover';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSheetUI } from './SheetUI';

/**
 * A sheet column header, Kitsu-style (M7): fields in small uppercase; status
 * columns (`accent`) like Kitsu's task types, a colored dot and a tinted
 * column. Click it to rename, hide, move, edit choices or delete the column.
 */
export function ColumnHeader({
  col,
  extra,
  accent,
}: {
  col: Column;
  extra?: ReactNode;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <th
      className={`min-w-36 ${accent ? 'status-head' : ''}`}
      style={accent ? ({ '--tint': accent } as React.CSSProperties) : undefined}
      title={TYPE_LABELS[col.type]}
    >
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={`${col.name} column`}
        trigger={
          <button
            type="button"
            className="flex w-full flex-col justify-center gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-hover"
          >
            {accent ? (
              <span className="flex items-center gap-2 text-[14px] font-bold tracking-wide text-strong">
                <span className="size-2.5 rounded-full" style={{ background: accent }} />
                {col.name}
              </span>
            ) : (
              <span className="eyebrow text-muted">{col.name}</span>
            )}
            {extra}
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
  const del = () => {
    actions.saveBoard(deleteColumn(board, col.id));
    toast(`Deleted ${col.name}`);
    onDone();
  };

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
            <ConfirmButton
              onConfirm={del}
              confirm="Click again to delete"
              className={`${btn.base} ${btn.small} ${btn.danger}`}
              armedClassName={armedDanger}
            >
              Delete column
            </ConfirmButton>
          </div>
        </>
      )}
    </form>
  );
}
