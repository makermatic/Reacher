import {
  ArrowUpRight,
  Bookmark,
  KanbanSquare,
  ListFilter,
  Plus,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { useToast } from '../components/Toast';
import { readPref, writePref } from '../lib/prefs';
import { meta, valueText } from '../model/board';
import { matchesQuery, parseQuery } from '../model/query';
import { inSprint, inView } from '../model/sprints';
import { norm } from '../model/text';
import type { Company } from '../model/types';
import { glide } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { sameCell, useAppUI, type Cell } from './AppUI';
import {
  AddFieldDialog,
  DisplaySettings,
  FieldHeader,
  StageHeader,
  TwoClick,
  type Sort,
} from './columns';
import { FieldInput } from './fields';
import { StageBoard } from './StageBoard';
import { useSprintInfo } from './sprintLabels';
import { colorVar, MenuItem, Pop, StatusTag, ui } from './ui';

type View = 'sheet' | 'board';
const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isSort = (v: unknown): v is Sort =>
  v === null || (!!v && typeof v === 'object' && typeof (v as { key?: unknown }).key === 'string');

/**
 * The companies list (M7), working like Kitsu's shot list: the companies in
 * the sprint on screen (or all of them), a colored column per stage and a
 * plain column per field. Click a stage cell to select it and open the side
 * panel; Ctrl/Cmd-click or Shift-click to select more. Fields edit in place.
 */
export function CompaniesPage({ onImport }: { onImport: () => void }) {
  const { board, companies, sprint, loading } = useWorkspace();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(() => readPref('view', 'sheet', isView));
  const [saved, setSaved] = useState<string[]>(() => readPref('saved-searches', [], isStrings));
  const [sort, setSortState] = useState<Sort>(() => readPref<Sort>('sort', null, isSort));
  const setSort = (s: Sort) => {
    setSortState(s);
    writePref('sort', s);
  };

  const inScope = useMemo(
    () => companies.filter((c) => !sprint || inSprint(c, sprint)).map((c) => inView(c, sprint)),
    [companies, sprint],
  );
  const list = useMemo(() => {
    const q = parseQuery(query);
    const rows = inScope.filter((c) => matchesQuery(board, c, q));
    const order = (c: Company) => c.order || 0;
    if (!sort) return rows.sort((a, b) => order(a) - order(b));
    const key = (c: Company): string | number => {
      if (sort.key === 'name') return c.name.toLowerCase();
      if (sort.key.startsWith('stage:')) {
        const i = board.statuses.findIndex((s) => s.id === c.stages?.[sort.key.slice(6)]);
        return i < 0 ? 999 : i;
      }
      const col = board.columns.find((x) => x.id === sort.key);
      return col ? valueText(col, meta(c, col.id)).toLowerCase() : '';
    };
    return rows.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      // Empty values last either way.
      if (ka === '' || ka === 999) return 1;
      if (kb === '' || kb === 999) return -1;
      return (ka < kb ? -1 : ka > kb ? 1 : order(a) - order(b)) * sort.dir;
    });
  }, [board, inScope, query, sort]);

  const changeView = (v: View) => {
    setView(v);
    writePref('view', v);
  };
  const saveSearches = (next: string[]) => {
    setSaved(next);
    writePref('saved-searches', next);
  };

  return (
    <section aria-label="Companies" className="flex h-full min-h-0 flex-col gap-3 px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-[360px] max-w-full items-center gap-2 rounded-lg border border-line bg-surface pr-1 pl-3 transition-colors focus-within:border-selectable">
          <Search size={16} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            id="sheet-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, or filter like outreach=reply city=la"
            aria-label="Search companies"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className={ui.ghostIcon}
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            disabled={!query.trim() || saved.includes(query.trim())}
            onClick={() => saveSearches([...saved, query.trim()])}
            aria-label="Save this search"
            title="Save this search"
            className={`${ui.ghostIcon} disabled:opacity-30`}
          >
            <Bookmark size={14} />
          </button>
        </div>
        <SearchHelp onPick={setQuery} />
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label="View"
            className="flex rounded-lg border border-line bg-surface p-0.5"
          >
            {(
              [
                ['sheet', 'Sheet', Table2],
                ['board', 'Board', KanbanSquare],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => changeView(id)}
                className="relative flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted transition-colors aria-pressed:text-strong"
              >
                {view === id && (
                  <motion.span
                    layoutId="view-toggle"
                    transition={glide}
                    className="absolute inset-0 rounded-md bg-hover"
                  />
                )}
                <Icon size={15} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          <DisplaySettings />
        </div>
      </div>

      {saved.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Saved searches">
          {saved.map((s) => (
            <span
              key={s}
              className={`flex items-center rounded-full border text-[12.5px] ${
                s === query ? 'border-selectable bg-selected text-strong' : 'border-line text-muted'
              }`}
            >
              <button
                type="button"
                onClick={() => setQuery(s === query ? '' : s)}
                className="py-0.5 pr-1 pl-2.5"
              >
                {s}
              </button>
              <button
                type="button"
                onClick={() => saveSearches(saved.filter((x) => x !== s))}
                aria-label={`Forget the search ${s}`}
                className="py-0.5 pr-2 pl-0.5 hover:text-fg"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {view === 'board' ? (
          <StageBoard list={list} />
        ) : (
          <CompanyTable
            list={list}
            total={inScope.length}
            sort={sort}
            onSort={setSort}
            onImport={onImport}
          />
        )}
      </div>
      <div className="text-center text-[13px] text-muted">
        {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'company' : 'companies'}`}
        {sprint && info[sprint] ? ` in ${info[sprint]!.label}` : ''}
        {list.length !== inScope.length ? ` (of ${inScope.length})` : ''}
      </div>
    </section>
  );
}

/** The filter button: how to type filters, with ready-made ones. */
function SearchHelp({ onPick }: { onPick: (q: string) => void }) {
  const { board } = useWorkspace();
  const [open, setOpen] = useState(false);
  const pick = (q: string) => {
    onPick(q);
    setOpen(false);
  };
  const first = board.stages[0];
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={360}
      label="Filters"
      className={`${ui.menu} gap-2 p-3`}
      trigger={
        <button type="button" aria-label="Filters" title="Filters" className={ui.iconButton}>
          <ListFilter size={16} />
        </button>
      }
    >
      <b className="text-[13.5px] text-strong">Filter by typing</b>
      <ul className="m-0 grid gap-1 pl-4 text-[13px] text-muted">
        <li>
          <code>buck</code> finds names and any field
        </li>
        <li>
          <code>{(first?.name ?? 'outreach').toLowerCase()}=reply</code> a stage at a status
        </li>
        <li>
          <code>status=reply</code> any stage at that status
        </li>
        <li>
          <code>city=la,nyc</code> a field, either value
        </li>
        <li>
          <code>-buck</code> leaves names out
        </li>
      </ul>
      <b className="text-[13.5px] text-strong">Any stage at</b>
      <div className="flex flex-wrap gap-1.5">
        {board.statuses.map((s) => (
          <button key={s.id} type="button" onClick={() => pick(`status=[${s.label}]`)}>
            <StatusTag board={board} value={s.id} />
          </button>
        ))}
      </div>
    </Pop>
  );
}

function CompanyTable({
  list,
  total,
  sort,
  onSort,
  onImport,
}: {
  list: Company[];
  total: number;
  sort: Sort;
  onSort: (s: Sort) => void;
  onImport: () => void;
}) {
  const { board, companies, loading, actions } = useWorkspace();
  const { selected, select, setSelection, openPage } = useAppUI();
  const toast = useToast();
  const [addingField, setAddingField] = useState(false);
  const stages = board.stages.filter((s) => s.onSheet !== false);
  const fields = board.columns.filter((c) => c.onSheet !== false);
  // Cells in reading order, for Shift-click ranges.
  const order: Cell[] = list.flatMap((c) => stages.map((s) => ({ id: c.id, stage: s.id })));
  const isSel = (cell: Cell) => selected.some((x) => sameCell(x, cell));
  const pick = (e: MouseEvent, cell: Cell) =>
    select(cell, e.metaKey || e.ctrlKey ? 'toggle' : e.shiftKey ? 'range' : 'only', order);

  return (
    <div className="h-full overflow-auto rounded-xl border border-line bg-surface">
      <table className="rtable w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky-a w-10" aria-label="Select" />
            <th className="sticky-b w-60 min-w-56">
              <div className="flex items-center justify-between pr-2">
                <button
                  type="button"
                  onClick={() =>
                    onSort(
                      sort?.key === 'name' && sort.dir === 1
                        ? { key: 'name', dir: -1 }
                        : { key: 'name', dir: 1 },
                    )
                  }
                  className="flex h-10 items-center px-3 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted hover:text-fg"
                >
                  Company
                </button>
                <button
                  type="button"
                  onClick={() => setAddingField(true)}
                  aria-label="Add a field"
                  title="Add a field"
                  className={ui.ghostIcon}
                >
                  <Plus size={15} />
                </button>
              </div>
            </th>
            {stages.map((s) => (
              <th
                key={s.id}
                className="stage-col min-w-40"
                style={{ '--tint': colorVar(s.color) } as React.CSSProperties}
              >
                <StageHeader stage={s} sort={sort} onSort={onSort} />
              </th>
            ))}
            {fields.map((col) => (
              <th key={col.id} className="min-w-36">
                <FieldHeader col={col} sort={sort} onSort={onSort} />
              </th>
            ))}
            <th className="w-full" />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const rowCells = stages.map((s) => ({ id: c.id, stage: s.id }));
            const rowSelected = rowCells.length > 0 && rowCells.every(isSel);
            return (
              <tr key={c.id} className="group">
                <td className="sticky-a text-center">
                  <input
                    type="checkbox"
                    checked={rowSelected}
                    onChange={() =>
                      setSelection(
                        rowSelected
                          ? selected.filter((x) => x.id !== c.id)
                          : [...selected.filter((x) => x.id !== c.id), ...rowCells],
                      )
                    }
                    aria-label={`Select ${c.name}`}
                    className="size-4 accent-[var(--selectable)]"
                  />
                </td>
                <td className="sticky-b">
                  <div className="flex items-center pr-1">
                    <button
                      type="button"
                      onClick={() => openPage(c.id)}
                      title={`Open ${c.name}`}
                      className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[14px] font-semibold text-strong hover:underline"
                    >
                      {c.name || 'Untitled'}
                    </button>
                    <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => openPage(c.id)}
                        aria-label={`Open ${c.name}'s page`}
                        className={ui.ghostIcon}
                      >
                        <ArrowUpRight size={15} />
                      </button>
                      <RowDelete
                        company={c}
                        onDelete={() => {
                          void actions.deleteCompany(c.id);
                          toast(`Deleted ${c.name}`);
                        }}
                      />
                    </span>
                  </div>
                </td>
                {stages.map((s) => {
                  const cell = { id: c.id, stage: s.id };
                  return (
                    <td
                      key={s.id}
                      onClick={(e) => pick(e, cell)}
                      aria-selected={isSel(cell)}
                      aria-label={`${s.name} for ${c.name}`}
                      style={{ '--tint': colorVar(s.color) } as React.CSSProperties}
                      className="stage-cell cursor-pointer px-3"
                    >
                      <StatusTag board={board} value={c.stages?.[s.id]} />
                    </td>
                  );
                })}
                {fields.map((col) => (
                  <td key={col.id} className="field-cell max-w-72">
                    <FieldInput company={c} col={col} />
                  </td>
                ))}
                <td />
              </tr>
            );
          })}
          <AddCompanyRow disabled={loading} span={stages.length + fields.length + 1} />
        </tbody>
      </table>
      {!loading && !companies.length ? (
        <Message>
          No companies yet. Type a name in the last row, or bring over everything from the
          prototype.{' '}
          <button type="button" className={`${ui.primary} ml-2`} onClick={onImport}>
            Import from the prototype
          </button>
        </Message>
      ) : !loading && !total ? (
        <Message>
          No companies in this sprint yet. Add one in the last row: companies you have are
          suggested.
        </Message>
      ) : !loading && !list.length ? (
        <Message>Nothing matches.</Message>
      ) : null}
      <AddFieldDialog open={addingField} onOpenChange={setAddingField} />
    </div>
  );
}

function RowDelete({ company, onDelete }: { company: Company; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={220}
      align="end"
      label={`Delete ${company.name}`}
      trigger={
        <button type="button" aria-label={`Delete ${company.name}`} className={ui.ghostIcon}>
          <X size={15} />
        </button>
      }
    >
      <p className="m-0 px-2.5 py-1 text-[13px] text-muted">
        Delete {company.name} with its emails, notes and meetings?
      </p>
      <TwoClick armed="Click again to delete" onConfirm={onDelete}>
        Delete company
      </TwoClick>
    </Pop>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="sticky left-0 px-4 py-5 text-[13.5px] text-muted">{children}</div>;
}

/**
 * The last row: type a name. Companies you have are suggested; picking one
 * adds it to this sprint with everything it has. A new name makes a new
 * company (in this sprint) and the AI looks it up.
 */
function AddCompanyRow({ span, disabled }: { span: number; disabled: boolean }) {
  const { companies, sprint, actions } = useWorkspace();
  const { available, lookup } = useAssistant();
  const { select } = useAppUI();
  const info = useSprintInfo();
  const toast = useToast();
  const [name, setName] = useState('');
  const [active, setActive] = useState(0);

  const n = norm(name);
  const matches = n
    ? companies
        .filter((c) => norm(c.name).includes(n))
        .sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)))
        .slice(0, 6)
    : [];

  const addExisting = (c: Company) => {
    setName('');
    if (sprint && !inSprint(c, sprint)) {
      actions.addToSprint(c.id, sprint);
      toast(`Added ${c.name} to ${info[sprint]?.label ?? 'this sprint'}`);
    } else toast(`${c.name} is already on the list`);
  };

  const create = () => {
    const typed = name.trim();
    if (!typed) return;
    const existing = actions.findByName(typed);
    if (existing) return addExisting(existing);
    const c = actions.addCompany(typed);
    setName('');
    // Sure answers fill in quietly; a "which one?" opens the panel to ask there.
    if (available)
      void lookup(c, { announce: true, onAsk: () => select({ id: c.id, stage: null }) });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length));
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // 0 = what you typed; 1.. = a suggestion.
      if (active > 0 && matches[active - 1]) addExisting(matches[active - 1]!);
      else create();
      setActive(0);
    } else if (e.key === 'Escape') setName('');
  };

  return (
    <tr className="add-row">
      <td className="sticky-a" />
      <td className="sticky-b relative">
        <input
          id="new-company"
          value={name}
          disabled={disabled}
          onChange={(e) => {
            setName(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="+ Add a company"
          aria-label="Add a company"
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full bg-transparent px-3 py-3 text-[14px] outline-none placeholder:text-faint"
        />
        {matches.length > 0 && (
          <div
            role="listbox"
            aria-label="Companies you have"
            className={`${ui.menu} absolute top-full left-2 w-80`}
          >
            <MenuItem active={active === 0} onSelect={create}>
              <span className="text-muted">New company “{name.trim()}”</span>
            </MenuItem>
            {matches.map((c, i) => {
              const here = !!sprint && inSprint(c, sprint);
              return (
                <MenuItem key={c.id} active={active === i + 1} onSelect={() => addExisting(c)}>
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {here ? 'In this sprint' : sprint ? 'Add to sprint' : 'On your list'}
                  </span>
                </MenuItem>
              );
            })}
          </div>
        )}
      </td>
      <td colSpan={span} />
    </tr>
  );
}
