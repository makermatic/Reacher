import { useState } from 'react';
import { moveColumn, updateColumn } from '../model/columns';
import { TYPE_LABELS } from '../model/types';
import { btn } from '../components/Modal';
import { Popover, PopoverHeader } from '../components/Popover';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/** The toolbar's Columns button: show or hide each column on the sheet, and reorder them. */
export function ColumnsPopover() {
  const { board, actions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const cols = board.columns.filter((c) => c.id !== 'status');
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={320}
      align="end"
      label="Sheet columns"
      trigger={
        <button type="button" className={btn.base}>
          Columns
        </button>
      }
    >
      <PopoverHeader title="Sheet columns" caption="show · order" />
      <div className="grid gap-0.5">
        {cols.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-hover">
            <input
              type="checkbox"
              checked={c.onSheet !== false}
              aria-label={`Show ${c.name} on the sheet`}
              onChange={(e) =>
                actions.saveBoard(updateColumn(board, c.id, { onSheet: e.target.checked }))
              }
              className="accent-[var(--accent)]"
            />
            <span className="min-w-0 flex-1 truncate">
              {c.name} <span className="text-xs text-muted">{TYPE_LABELS[c.type]}</span>
            </span>
            <button
              type="button"
              className={btn.icon}
              disabled={i === 0}
              aria-label={`Move ${c.name} up`}
              onClick={() => actions.saveBoard(moveColumn(board, c.id, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              className={btn.icon}
              disabled={i === cols.length - 1}
              aria-label={`Move ${c.name} down`}
              onClick={() => actions.saveBoard(moveColumn(board, c.id, 1))}
            >
              ↓
            </button>
          </div>
        ))}
      </div>
      <p className="m-0 text-xs text-muted">
        Company and Status always show. Hidden columns still appear on each company page.
      </p>
    </Popover>
  );
}
