import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { asChecklist, asPerson, asTags, colorFor } from '../model/board';
import { TYPE_LABELS, type ChecklistItem, type Column } from '../model/types';
import { normalizeUrl } from '../lib/links';
import { btn, field } from '../components/Modal';
import { PopoverHeader } from '../components/Popover';
import { useSheetUI } from './SheetUI';

type Props = {
  col: Column;
  value: unknown;
  /** Save a value (null clears it). */
  onSave: (value: unknown) => void;
  /** Close the editor. */
  onDone: () => void;
};

/** The popover editor for one cell, by column type (prototype's openCellEditor). */
export function CellEditor(props: Props) {
  const { col } = props;
  return (
    <>
      <PopoverHeader title={col.name} caption={TYPE_LABELS[col.type]} />
      {col.type === 'person' ? (
        <PersonEditor {...props} />
      ) : col.type === 'tags' ? (
        <TagsEditor {...props} />
      ) : col.type === 'checklist' ? (
        <ChecklistEditor {...props} />
      ) : (
        <TextishEditor {...props} />
      )}
    </>
  );
}

function SaveClear({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex gap-1.5">
      <button type="submit" className={`${btn.primary} ${btn.small}`}>
        Save
      </button>
      <button type="button" className={`${btn.ghost} ${btn.small}`} onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

/** Text, long text, number, date and link. */
function TextishEditor({ col, value, onSave, onDone }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const save = (e?: FormEvent) => {
    e?.preventDefault();
    const v =
      col.type === 'number'
        ? text.trim() === '' || isNaN(Number(text))
          ? null
          : Number(text)
        : col.type === 'link'
          ? normalizeUrl(text) || null
          : text.trim() === ''
            ? null
            : text;
    onSave(v);
    onDone();
  };
  const clear = () => {
    onSave(null);
    onDone();
  };
  const id = `cell-${col.id}`;

  if (col.type === 'longtext') {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
    };
    return (
      <form onSubmit={save} className="grid gap-2.5">
        <textarea
          id={id}
          autoFocus
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label={col.name}
          className={`${field} resize-y`}
        />
        <span className="text-xs text-muted">Ctrl+Enter to save</span>
        <SaveClear onClear={clear} />
      </form>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-2.5">
      <input
        id={id}
        autoFocus
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        step={col.type === 'number' ? 'any' : undefined}
        inputMode={col.type === 'link' ? 'url' : undefined}
        placeholder={col.type === 'link' ? 'website.com' : undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label={col.name}
        className={field}
      />
      <SaveClear onClear={clear} />
    </form>
  );
}

function PersonEditor({ col, value, onSave, onDone }: Props) {
  const [p, setP] = useState(asPerson(value) ?? { name: '', role: '', email: '' });
  const set = (k: keyof typeof p) => (e: { target: { value: string } }) =>
    setP((cur) => ({ ...cur, [k]: e.target.value }));
  const save = (e: FormEvent) => {
    e.preventDefault();
    const v = { name: p.name.trim(), role: p.role.trim(), email: p.email.trim() };
    onSave(v.name || v.role || v.email ? v : null);
    onDone();
  };
  return (
    <form onSubmit={save} className="grid gap-2">
      <input
        id={`cell-${col.id}-name`}
        autoFocus
        placeholder="Name"
        value={p.name}
        onChange={set('name')}
        className={field}
      />
      <input
        id={`cell-${col.id}-role`}
        placeholder="Role, like Recruiter"
        value={p.role}
        onChange={set('role')}
        className={field}
      />
      <input
        id={`cell-${col.id}-email`}
        type="email"
        placeholder="Email"
        value={p.email}
        onChange={set('email')}
        className={field}
      />
      <SaveClear
        onClear={() => {
          onSave(null);
          onDone();
        }}
      />
    </form>
  );
}

/** Tags save as you tick them, in the column's choice order. */
function TagsEditor({ col, value, onSave }: Props) {
  const { editChoices } = useSheetUI();
  const options = (col.options ?? []).map(String);
  const current = asTags(value);
  const toggle = (tag: string, on: boolean) => {
    const set = new Set(current);
    if (on) set.add(tag);
    else set.delete(tag);
    const ordered = options
      .filter((o) => set.has(o))
      .concat([...set].filter((t) => !options.includes(t)));
    onSave(ordered.length ? ordered : null);
  };
  return (
    <>
      <div className="grid gap-0.5">
        {options.map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-hover"
          >
            <input
              type="checkbox"
              checked={current.includes(o)}
              onChange={(e) => toggle(o, e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className={`tag c-${colorFor(col, o)}`}>{o}</span>
          </label>
        ))}
        {!options.length && <span className="text-[12.5px] text-muted">No choices yet.</span>}
      </div>
      <div>
        <button
          type="button"
          className={`${btn.ghost} ${btn.small}`}
          onClick={() => editChoices(col.id)}
        >
          Edit choices
        </button>
      </div>
    </>
  );
}

/** Checklist items save as you add, tick or remove them. */
function ChecklistEditor({ col, value, onSave }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>(asChecklist(value));
  const [draft, setDraft] = useState('');
  const update = (next: ChecklistItem[]) => {
    setItems(next);
    onSave(next.length ? next : null);
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    update([...items, { t: draft.trim(), done: false }]);
    setDraft('');
  };
  return (
    <>
      <div className="grid gap-1">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={it.done}
              aria-label={`Done: ${it.t}`}
              onChange={(e) =>
                update(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))
              }
              className="accent-[var(--accent)]"
            />
            <span className={`min-w-0 flex-1 ${it.done ? 'text-muted line-through' : ''}`}>
              {it.t}
            </span>
            <button
              type="button"
              aria-label={`Remove ${it.t}`}
              onClick={() => update(items.filter((_, j) => j !== i))}
              className={btn.icon}
            >
              ×
            </button>
          </div>
        ))}
        {!items.length && <span className="text-[12.5px] text-muted">No items yet.</span>}
      </div>
      <form onSubmit={add} className="flex gap-1.5">
        <input
          id={`cell-${col.id}-new`}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item"
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" className={`${btn.base} ${btn.small}`}>
          Add
        </button>
      </form>
    </>
  );
}
