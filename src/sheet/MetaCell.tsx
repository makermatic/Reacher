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

/** One editable sheet cell (SPEC section 2). */
export function MetaCell({ company, col }: { company: Company; col: Column }) {
  if (col.type === 'status') {
    return (
      <td className="px-2 py-1.5">
        {colShows(col, company) && <StatusChip company={company} col={col} />}
      </td>
    );
  }
  return (
    <td>
      <EditableValue company={company} col={col} className={cellButton} />
    </td>
  );
}

/**
 * A company's value for one column, editable in place: checkboxes toggle on
 * click, lists open the picker, everything else opens the cell editor. Used by
 * sheet cells and the company page's Details.
 */
export function EditableValue({
  company,
  col,
  className,
  full = false,
  label,
}: {
  company: Company;
  col: Column;
  className: string;
  /** Show long text in full (company page) rather than its first line (sheet). */
  full?: boolean;
  /** Show this text instead of the value (e.g. "set it" links). */
  label?: string;
}) {
  const { actions, companies } = useWorkspace();
  const [open, setOpen] = useState(false);
  const value = meta(company, col.id);
  const save = (v: unknown) => actions.setMeta(company.id, col.id, v);

  if (col.type === 'status' && !label) return <StatusChip company={company} col={col} />;

  if (col.type === 'checkbox') {
    return (
      <button
        type="button"
        className={className}
        aria-label={`${col.name}: ${value ? 'yes' : 'no'}. Toggle`}
        onClick={() => save(!value)}
      >
        <CellValue col={col} value={value} />
      </button>
    );
  }

  const trigger = (
    <button
      type="button"
      className={`${className} ${col.type === 'number' && !full ? 'text-right' : ''}`}
      aria-label={`Edit ${col.name} for ${company.name}`}
    >
      {label ? (
        label
      ) : full && col.type === 'longtext' && value ? (
        <span className="whitespace-pre-wrap">{String(value)}</span>
      ) : (
        <CellValue col={col} value={value} />
      )}
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      label={`${col.name} for ${company.name}`}
      width={col.type === 'longtext' ? 360 : 300}
    >
      {col.type === 'values' || col.type === 'status' ? (
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
  );
}
