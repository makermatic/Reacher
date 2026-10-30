/**
 * Field cells (M7): every custom field edits right where it is, the way
 * Kitsu's metadata columns do. Text, numbers, dates and links are inputs (Enter
 * or clicking away saves, Escape puts it back); lists are a dropdown; a
 * checkbox is a checkbox; tags, people, long text and checklists open a small
 * editor. Text suggests values already in the column, abbreviations expanded
 * ("LA" → Los Angeles).
 */
import { ExternalLink, Plus, X } from 'lucide-react';
import { useId, useState, type KeyboardEvent } from 'react';
import { normalizeUrl } from '../lib/links';
import { asChecklist, asPerson, asTags, meta } from '../model/board';
import { ALIASES } from '../model/search';
import { textSuggestions } from '../model/suggest';
import { norm } from '../model/text';
import type { Column, Company } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { Pop, ui } from './ui';

type Variant = 'cell' | 'row';

const shell = (v: Variant) =>
  v === 'cell'
    ? 'h-full min-h-[44px] w-full bg-transparent px-3 text-[13.5px] text-fg outline-none placeholder:text-faint focus:bg-bg focus:shadow-[inset_0_0_0_1px_var(--selectable)]'
    : 'h-9 w-full rounded-lg bg-transparent px-2 text-[14px] text-fg outline-none transition-colors placeholder:text-faint hover:bg-hover focus:bg-bg focus:shadow-[inset_0_0_0_1px_var(--selectable)]';

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function FieldInput({
  company,
  col,
  variant = 'cell',
}: {
  company: Company;
  col: Column;
  variant?: Variant;
}) {
  const label = `${col.name} for ${company.name}`;
  switch (col.type) {
    case 'checkbox':
      return <CheckboxField company={company} col={col} label={label} variant={variant} />;
    case 'values':
      return <SelectField company={company} col={col} label={label} variant={variant} />;
    case 'tags':
      return <TagsField company={company} col={col} label={label} variant={variant} />;
    case 'person':
      return <PersonField company={company} col={col} label={label} variant={variant} />;
    case 'longtext':
      return <LongTextField company={company} col={col} label={label} variant={variant} />;
    case 'checklist':
      return <ChecklistField company={company} col={col} label={label} variant={variant} />;
    default:
      return <TextField company={company} col={col} label={label} variant={variant} />;
  }
}

type FieldProps = { company: Company; col: Column; label: string; variant: Variant };

/** Text, number, date and link: an input that saves on Enter or blur. */
function TextField({ company, col, label, variant }: FieldProps) {
  const { companies, actions } = useWorkspace();
  const listId = useId();
  const value = meta(company, col.id);
  const asText = value == null ? '' : String(value);
  const [draft, setDraft] = useState(asText);
  const [shown, setShown] = useState(asText);
  if (asText !== shown) {
    setShown(asText);
    setDraft(asText);
  }

  const used = col.type === 'text' ? companies.map((c) => meta(c, col.id)) : [];
  const suggestions = col.type === 'text' ? textSuggestions(used, draft, 8) : [];

  const commit = () => {
    let v: unknown = draft.trim();
    if (v === asText) return;
    if (col.type === 'number') v = v === '' ? null : Number(v);
    else if (col.type === 'link') v = normalizeUrl(String(v)) || null;
    else if (col.type === 'text' && v) {
      // "LA" → the spelling already used for Los Angeles (or Los Angeles).
      const alias = ALIASES[String(v).toLowerCase()];
      if (alias)
        v =
          used.find((u): u is string => typeof u === 'string' && norm(u) === norm(alias)) ??
          titleCase(alias);
    }
    actions.setMeta(company.id, col.id, v === '' ? null : v);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(asText);
      requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
    }
  };

  return (
    <span className="relative flex h-full items-center">
      <input
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        aria-label={label}
        list={suggestions.length ? listId : undefined}
        placeholder={variant === 'row' ? 'Empty' : ''}
        className={`${shell(variant)} ${col.type === 'link' && draft ? 'pr-8 text-selectable' : ''}`}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {col.type === 'link' && asText && (
        <a
          href={asText}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${asText}`}
          className="absolute right-2 text-faint hover:text-fg"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

function CheckboxField({ company, col, label, variant }: FieldProps) {
  const { actions } = useWorkspace();
  return (
    <span className={`flex h-full items-center ${variant === 'cell' ? 'justify-center' : 'px-2'}`}>
      <input
        type="checkbox"
        checked={!!meta(company, col.id)}
        onChange={(e) => actions.setMeta(company.id, col.id, e.target.checked)}
        aria-label={label}
        className="size-4 accent-[var(--accent)]"
      />
    </span>
  );
}

/** A list of values: a dropdown, like Kitsu's list descriptors. */
function SelectField({ company, col, label, variant }: FieldProps) {
  const { actions } = useWorkspace();
  const value = meta(company, col.id);
  return (
    <select
      value={value == null ? '' : String(value)}
      onChange={(e) => actions.setMeta(company.id, col.id, e.target.value || null)}
      aria-label={label}
      className={`${shell(variant)} cursor-pointer appearance-none`}
    >
      <option value="">{variant === 'row' ? 'Empty' : ''}</option>
      {(col.options ?? []).map(String).map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** A button that shows the value and opens an editor. */
function Opener({
  label,
  variant,
  children,
  ...rest
}: {
  label: string;
  variant: Variant;
  children: React.ReactNode;
} & React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label={label}
      {...rest}
      className={`${shell(variant)} flex min-w-0 items-center gap-1 overflow-hidden text-left`}
    >
      {children}
    </button>
  );
}

function TagsField({ company, col, label, variant }: FieldProps) {
  const { board, actions } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState('');
  const tags = asTags(meta(company, col.id));
  const options = (col.options ?? []).map(String);
  const toggle = (t: string) =>
    actions.setMeta(
      company.id,
      col.id,
      tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t],
    );
  const add = () => {
    const t = adding.trim();
    if (!t) return;
    const existing = options.find((o) => norm(o) === norm(t));
    if (!existing)
      actions.saveBoard({
        ...board,
        columns: board.columns.map((c) =>
          c.id === col.id ? { ...c, options: [...options, t] } : c,
        ),
      });
    if (!tags.includes(existing ?? t))
      actions.setMeta(company.id, col.id, [...tags, existing ?? t]);
    setAdding('');
  };
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={240}
      label={label}
      trigger={
        <Opener label={label} variant={variant}>
          {tags.length ? (
            tags.map((t) => (
              <span key={t} className="shrink-0 rounded-md bg-hover px-1.5 py-0.5 text-[12.5px]">
                {t}
              </span>
            ))
          ) : (
            <span className="text-faint">{variant === 'row' ? 'Empty' : ''}</span>
          )}
        </Opener>
      }
    >
      {options.map((o) => (
        <label
          key={o}
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-hover"
        >
          <input
            type="checkbox"
            checked={tags.includes(o)}
            onChange={() => toggle(o)}
            className="accent-[var(--accent)]"
          />
          <span className="text-[13.5px]">{o}</span>
        </label>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-1 flex gap-1 border-t border-line pt-1.5"
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a tag"
          aria-label="Add a tag"
          className={`${ui.input} h-8 min-w-0 flex-1`}
        />
        <button type="submit" aria-label="Add" className={ui.ghostIcon}>
          <Plus size={15} />
        </button>
      </form>
    </Pop>
  );
}

function PersonField({ company, col, label, variant }: FieldProps) {
  const { actions } = useWorkspace();
  const p = asPerson(meta(company, col.id)) ?? { name: '', role: '', email: '' };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(p);
  const save = () => {
    actions.setMeta(company.id, col.id, draft.name || draft.email || draft.role ? draft : null);
    setOpen(false);
  };
  return (
    <Pop
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(p);
        else save();
        setOpen(o);
      }}
      width={280}
      label={label}
      className={`${ui.menu} gap-2 p-3`}
      trigger={
        <Opener label={label} variant={variant}>
          {p.name || p.email ? (
            <span className="min-w-0 truncate">
              {p.name || p.email}
              {p.role && <span className="ml-1.5 text-[12px] text-muted">{p.role}</span>}
            </span>
          ) : (
            <span className="text-faint">{variant === 'row' ? 'Empty' : ''}</span>
          )}
        </Opener>
      }
    >
      {(['name', 'role', 'email'] as const).map((k) => (
        <input
          key={k}
          id={`person-${k}`}
          value={draft[k]}
          onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={k === 'name' ? 'Name' : k === 'role' ? 'Role' : 'Email'}
          aria-label={k}
          type={k === 'email' ? 'email' : 'text'}
          className={ui.input}
        />
      ))}
    </Pop>
  );
}

function LongTextField({ company, col, label, variant }: FieldProps) {
  const { actions } = useWorkspace();
  const value = String(meta(company, col.id) ?? '');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <Pop
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value);
        else if (draft !== value) actions.setMeta(company.id, col.id, draft.trim() || null);
        setOpen(o);
      }}
      width={360}
      label={label}
      className={`${ui.menu} p-2`}
      trigger={
        <Opener label={label} variant={variant}>
          <span className={`min-w-0 truncate ${value ? '' : 'text-faint'}`}>
            {value || (variant === 'row' ? 'Empty' : '')}
          </span>
        </Opener>
      }
    >
      <textarea
        autoFocus
        rows={6}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={label}
        className={`${ui.input} h-auto resize-y py-2`}
      />
    </Pop>
  );
}

function ChecklistField({ company, col, label, variant }: FieldProps) {
  const { actions } = useWorkspace();
  const items = asChecklist(meta(company, col.id));
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState('');
  const save = (next: typeof items) =>
    actions.setMeta(company.id, col.id, next.length ? next : null);
  const done = items.filter((i) => i.done).length;
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={280}
      label={label}
      trigger={
        <Opener label={label} variant={variant}>
          {items.length ? (
            <span className="text-[13px] text-muted">
              {done}/{items.length} done
            </span>
          ) : (
            <span className="text-faint">{variant === 'row' ? 'Empty' : ''}</span>
          )}
        </Opener>
      }
    >
      {items.map((it, i) => (
        <div key={i} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-hover">
          <input
            type="checkbox"
            checked={it.done}
            onChange={() => save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
            aria-label={it.t}
            className="accent-[var(--accent)]"
          />
          <span className={`flex-1 text-[13.5px] ${it.done ? 'text-faint line-through' : ''}`}>
            {it.t}
          </span>
          <button
            type="button"
            onClick={() => save(items.filter((_, j) => j !== i))}
            aria-label={`Remove ${it.t}`}
            className="text-faint opacity-0 group-hover:opacity-100 hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding.trim()) return;
          save([...items, { t: adding.trim(), done: false }]);
          setAdding('');
        }}
        className="mt-1 flex gap-1 border-t border-line pt-1.5"
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add an item"
          aria-label="Add an item"
          className={`${ui.input} h-8 min-w-0 flex-1`}
        />
        <button type="submit" aria-label="Add" className={ui.ghostIcon}>
          <Plus size={15} />
        </button>
      </form>
    </Pop>
  );
}
