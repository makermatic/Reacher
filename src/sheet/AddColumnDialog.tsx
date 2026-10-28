import { useState, type FormEvent } from 'react';
import { nameTaken, newColumn, typeHasChoices } from '../model/columns';
import { TYPE_LABELS, type ColumnType } from '../model/types';
import { btn, field, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';

const TYPE_ORDER: ColumnType[] = [
  'text',
  'longtext',
  'number',
  'checkbox',
  'date',
  'link',
  'person',
  'values',
  'tags',
  'checklist',
  'status',
];

/** "+ Column": the Add Metadata Column dialog (SPEC section 2). */
export function AddColumnDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Metadata Column">
      <AddColumnForm onDone={() => onOpenChange(false)} />
    </Modal>
  );
}

function AddColumnForm({ onDone }: { onDone: () => void }) {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [choices, setChoices] = useState('');
  const [onSheet, setOnSheet] = useState(true);
  const [error, setError] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give the column a name.');
    if (nameTaken(board, n)) return setError('There’s already a column with that name.');
    const lines = choices
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    actions.saveBoard({
      ...board,
      columns: [...board.columns, newColumn(n, type, lines, onSheet)],
    });
    toast(`Added ${n}`);
    onDone();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <label htmlFor="mc-name" className="grid gap-1.5">
        <span className="font-medium">Name</span>
        <input
          id="mc-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Like Salary range"
          className={field}
        />
      </label>
      <label htmlFor="mc-type" className="grid gap-1.5">
        <span className="font-medium">Type</span>
        <select
          id="mc-type"
          value={type}
          onChange={(e) => setType(e.target.value as ColumnType)}
          className={field}
        >
          {TYPE_ORDER.map((t) => (
            <option key={t} value={t}>
              {t === 'status' ? 'Status (chips)' : TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>
      {typeHasChoices(type) && (
        <label htmlFor="mc-opts" className="grid gap-1.5">
          <span className="font-medium">Choices, one per line</span>
          <textarea
            id="mc-opts"
            rows={4}
            value={choices}
            onChange={(e) => setChoices(e.target.value)}
            placeholder={'Remote\nHybrid\nOn-site'}
            className={`${field} resize-y`}
          />
        </label>
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={onSheet}
          onChange={(e) => setOnSheet(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Show on the sheet (it always shows on the company page)
      </label>
      {error && <p className="m-0 text-[var(--c-red)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className={btn.ghost} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className={btn.primary}>
          Add column
        </button>
      </div>
    </form>
  );
}
