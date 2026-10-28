import { useState } from 'react';
import { colShows, meta } from '../model/board';
import type { Column, Company } from '../model/types';
import { Popover } from '../components/Popover';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { CellEditor } from './CellEditor';
import { CellValue } from './CellValue';
import { OptionPicker } from './OptionPicker';
import { StatusChip } from './StatusChip';

const cellButton =
  'block w-full max-w-60 overflow-hidden text-ellipsis px-2.5 py-[7px] text-left outline-none focus-visible:bg-accent-soft';

/**
 * One editable sheet cell. Checkboxes toggle on click, lists open the picker,
 * everything else opens the cell editor (SPEC section 2).
 */
export function MetaCell({ company, col }: { company: Company; col: Column }) {
  const { actions, companies } = useWorkspace();
  const [open, setOpen] = useState(false);
  const value = meta(company, col.id);
  const save = (v: unknown) => actions.setMeta(company.id, col.id, v);
  const numeric = col.type === 'number' ? 'text-right' : '';

  if (col.type === 'status') {
    return (
      <td className="px-2 py-1.5">
        {colShows(col, company) && <StatusChip company={company} col={col} />}
      </td>
    );
  }

  if (col.type === 'checkbox') {
    return (
      <td>
        <button
          type="button"
          className={cellButton}
          aria-label={`${col.name}: ${value ? 'yes' : 'no'}. Toggle`}
          onClick={() => save(!value)}
        >
          <CellValue col={col} value={value} />
        </button>
      </td>
    );
  }

  const trigger = (
    <button
      type="button"
      className={`${cellButton} ${numeric}`}
      aria-label={`Edit ${col.name} for ${company.name}`}
    >
      <CellValue col={col} value={value} />
    </button>
  );

  return (
    <td>
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        label={`${col.name} for ${company.name}`}
        width={col.type === 'longtext' ? 360 : 300}
      >
        {col.type === 'values' ? (
          <OptionPicker
            col={col}
            current={value}
            onPick={(v) => {
              save(v);
              setOpen(false);
            }}
            onClear={() => {
              save(null);
              setOpen(false);
            }}
          />
        ) : (
          <CellEditor
            col={col}
            value={value}
            onSave={save}
            onDone={() => setOpen(false)}
            used={col.type === 'text' ? companies.map((c) => meta(c, col.id)) : undefined}
          />
        )}
      </Popover>
    </td>
  );
}
