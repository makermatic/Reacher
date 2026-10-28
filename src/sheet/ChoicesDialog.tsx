import { useState } from 'react';
import { colById, optList, statusCol } from '../model/board';
import { statusOptions, updateColumn } from '../model/columns';
import { uid } from '../model/text';
import { COLORS, type Column, type StatusOption } from '../model/types';
import { btn, field, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';

/** Edit a column's choices (SPEC section 3, "Edit choices dialog"). */
export function ChoicesDialog({ colId, onClose }: { colId: string | null; onClose: () => void }) {
  const { board } = useWorkspace();
  const col = colId ? colById(board, colId) : undefined;
  return (
    <Modal
      open={!!col}
      onOpenChange={(o) => !o && onClose()}
      title={col ? `${col.name} choices` : 'Choices'}
      wide={col?.type === 'status'}
      description={
        col?.type === 'status'
          ? 'Group choices into categories (like Email outreach). Add an emoji to flag the important ones. The template is what the company page suggests at that status.'
          : undefined
      }
    >
      {col &&
        (col.type === 'status' ? (
          <StatusChoices col={col} onDone={onClose} />
        ) : (
          <ListChoices col={col} onDone={onClose} />
        ))}
    </Modal>
  );
}

function move<T>(list: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function RowButtons({
  onMove,
  onRemove,
  label,
}: {
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <span className="flex">
      <button
        type="button"
        className={btn.icon}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(-1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={btn.icon}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(1)}
      >
        ↓
      </button>
      <button type="button" className={btn.icon} aria-label={`Remove ${label}`} onClick={onRemove}>
        ×
      </button>
    </span>
  );
}

function Footer({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" className={btn.ghost} onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className={btn.primary} onClick={onSave}>
        Save choices
      </button>
    </div>
  );
}

function ListChoices({ col, onDone }: { col: Column; onDone: () => void }) {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [opts, setOpts] = useState(optList(col).map((o) => o.label));
  const save = () => {
    actions.saveBoard(
      updateColumn(board, col.id, { options: opts.map((o) => o.trim()).filter(Boolean) }),
    );
    toast('Choices saved');
    onDone();
  };
  return (
    <div className="grid gap-2">
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            id={`copt-${i}`}
            value={o}
            aria-label="Choice"
            onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))}
            className={`${field} min-w-0 flex-1`}
          />
          <RowButtons
            label={o || 'choice'}
            onMove={(d) => setOpts(move(opts, i, d))}
            onRemove={() => setOpts(opts.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <div>
        <button
          type="button"
          className={`${btn.base} ${btn.small}`}
          onClick={() => setOpts([...opts, ''])}
        >
          + Add choice
        </button>
      </div>
      <Footer onSave={save} onCancel={onDone} />
    </div>
  );
}

function StatusChoices({ col, onDone }: { col: Column; onDone: () => void }) {
  const { board, templates, actions } = useWorkspace();
  const toast = useToast();
  const [opts, setOpts] = useState<StatusOption[]>(statusOptions(col));
  const [showWhen, setShowWhen] = useState<string[]>(col.showWhen?.values ?? []);
  const groups = [...new Set(opts.map((o) => o.group).filter(Boolean))];
  const isMain = col.id === 'status';
  const set = (i: number, patch: Partial<StatusOption>) =>
    setOpts(opts.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const save = () => {
    const options = opts
      .filter((o) => o.label.trim())
      .map((o) => ({
        id: o.id || uid('o'),
        label: o.label.trim(),
        group: o.group.trim(),
        color: o.color || 'grey',
        tpl: o.tpl || '',
        icon: (o.icon ?? '').trim(),
      }));
    const patch: Partial<Column> = { options };
    if (!isMain) patch.showWhen = showWhen.length ? { col: 'status', values: showWhen } : null;
    actions.saveBoard(updateColumn(board, col.id, patch));
    toast('Choices saved');
    onDone();
  };

  const grid =
    'grid grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_92px_minmax(0,1fr)_auto] items-center gap-1.5';
  return (
    <div className="grid gap-2 overflow-x-auto">
      <datalist id="choice-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="min-w-[560px] grid gap-1.5">
        <div className={`${grid} eyebrow text-[10px] text-muted`}>
          <span>Icon</span>
          <span>Label</span>
          <span>Category</span>
          <span>Color</span>
          <span>Email template</span>
          <span />
        </div>
        {opts.map((o, i) => (
          <div key={o.id || i} className={`${grid} c-${o.color || 'grey'}`}>
            <input
              id={`copt-${i}-icon`}
              value={o.icon ?? ''}
              maxLength={4}
              placeholder="—"
              aria-label="Icon or emoji"
              onChange={(e) => set(i, { icon: e.target.value })}
              className={`${field} px-1 text-center`}
            />
            <input
              id={`copt-${i}-label`}
              value={o.label}
              aria-label="Label"
              onChange={(e) => set(i, { label: e.target.value })}
              className={`${field} border-l-4 border-l-[var(--c)]`}
            />
            <input
              id={`copt-${i}-group`}
              value={o.group}
              list="choice-groups"
              placeholder="No category"
              aria-label="Category"
              onChange={(e) => set(i, { group: e.target.value })}
              className={field}
            />
            <select
              id={`copt-${i}-color`}
              value={o.color || 'grey'}
              aria-label="Color"
              onChange={(e) => set(i, { color: e.target.value as StatusOption['color'] })}
              className={field}
            >
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              id={`copt-${i}-tpl`}
              value={o.tpl}
              aria-label="Email template"
              onChange={(e) => set(i, { tpl: e.target.value })}
              className={field}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {o.tpl && !templates.some((t) => t.id === o.tpl) && (
                <option value={o.tpl}>{o.tpl}</option>
              )}
            </select>
            <RowButtons
              label={o.label || 'choice'}
              onMove={(d) => setOpts(move(opts, i, d))}
              onRemove={() => setOpts(opts.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <div>
        <button
          type="button"
          className={`${btn.base} ${btn.small}`}
          onClick={() =>
            setOpts([
              ...opts,
              {
                id: uid('o'),
                label: 'New choice',
                group: opts.at(-1)?.group ?? '',
                color: 'grey',
                tpl: '',
              },
            ])
          }
        >
          + Add choice
        </button>
      </div>
      {!isMain && (
        <fieldset className="m-0 grid gap-1.5 border-0 p-0 pt-2">
          <legend className="eyebrow mb-1.5 p-0 text-[10.5px] text-muted">
            Only show this column when Status is
          </legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {optList(statusCol(board)).map((s) => (
              <label key={s.id} className="flex items-center gap-1 text-[13px]">
                <input
                  type="checkbox"
                  checked={showWhen.includes(s.id)}
                  onChange={(e) =>
                    setShowWhen(
                      e.target.checked ? [...showWhen, s.id] : showWhen.filter((v) => v !== s.id),
                    )
                  }
                  className="accent-[var(--accent)]"
                />
                {s.label}
              </label>
            ))}
          </div>
          <span className="text-xs text-muted">Leave all unchecked to always show it.</span>
        </fieldset>
      )}
      <Footer onSave={save} onCancel={onDone} />
    </div>
  );
}
