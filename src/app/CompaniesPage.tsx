import { Bookmark, KanbanSquare, ListFilter, Search, Table2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { Popover } from '../components/Popover';
import { useToast } from '../components/Toast';
import { readPref, writePref } from '../lib/prefs';
import { colShows, optList, sheetColumns, statusCol } from '../model/board';
import { matchesQuery, parseQuery } from '../model/query';
import { inSprint, inView } from '../model/sprints';
import { norm } from '../model/text';
import type { Column, Company } from '../model/types';
import { glide } from '../motion';
import { ColumnHeader } from '../sheet/ColumnMenu';
import { ColumnsPopover } from '../sheet/ColumnsPopover';
import { MetaCell } from '../sheet/MetaCell';
import { RowMenu } from '../sheet/RowMenu';
import { useSheetUI } from '../sheet/SheetUI';
import { When } from '../sheet/When';
import { BoardView } from '../views/BoardView';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { useSprintInfo } from './sprintLabels';
import { StatusTag, ui } from './ui';

type View = 'sheet' | 'board';
const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Status columns get Kitsu's colored task-type header and a tinted column. */
const STATUS_TINT: Record<string, string> = { status: 'var(--c-teal)', outcome: 'var(--c-violet)' };
const tint = (col: Column) => STATUS_TINT[col.id] ?? 'var(--c-blue)';

/**
 * Kitsu's shot list, for companies (M7): the companies in the sprint on
 * screen (or all of them), searched Kitsu's way, as a sheet or a board.
 * Click a status to select it and open the side panel; Ctrl/Cmd-click or
 * Shift-click to select more.
 */
export function CompaniesPage({ onImport }: { onImport: () => void }) {
  const { loading, board, companies, pages, sprint } = useWorkspace();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(() => readPref('view', 'sheet', isView));
  const [saved, setSaved] = useState<string[]>(() => readPref('saved-searches', [], isStrings));

  const inScope = useMemo(
    () =>
      [...companies]
        .filter((c) => !sprint || inSprint(c, sprint))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((c) => inView(c, sprint)),
    [companies, sprint],
  );
  const list = useMemo(() => {
    const q = parseQuery(query);
    return inScope.filter((c) => matchesQuery(board, c, q));
  }, [board, inScope, query]);

  const changeView = (v: View) => {
    setView(v);
    writePref('view', v);
  };
  const saveSearch = (next: string[]) => {
    setSaved(next);
    writePref('saved-searches', next);
  };

  return (
    <section aria-label="Companies" className="flex h-full min-h-0 flex-col gap-3 px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 w-[340px] max-w-full items-center gap-2 rounded-full border border-line-strong/60 bg-bg pr-1.5 pl-3.5 transition-colors focus-within:border-accent">
          <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            id="sheet-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ex: buck status=wrote city=la"
            aria-label="Search companies"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear the search"
              className="grid size-6 place-items-center rounded-full bg-surface text-muted hover:text-fg"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            disabled={!query.trim() || saved.includes(query.trim())}
            onClick={() => saveSearch([...saved, query.trim()])}
            aria-label="Save this search"
            title="Save this search"
            className="grid size-7 place-items-center rounded-full text-muted hover:text-fg disabled:opacity-40"
          >
            <Bookmark size={15} />
          </button>
        </div>
        <SearchHelp onPick={setQuery} />
        <div className="ml-auto flex items-center gap-2">
          <div
            role="group"
            aria-label="View"
            className="flex rounded-[10px] border border-line-strong/60 p-0.5"
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
                className="relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-muted transition-colors aria-pressed:text-strong"
              >
                {view === id && (
                  <motion.span
                    layoutId="view-toggle"
                    transition={glide}
                    className="absolute inset-0 rounded-lg bg-selected"
                  />
                )}
                <Icon size={16} className="relative" aria-hidden="true" />
                <span className="relative text-[13.5px]">{label}</span>
              </button>
            ))}
          </div>
          <ColumnsPopover />
        </div>
      </div>

      {saved.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Saved searches">
          {saved.map((s) => (
            <span
              key={s}
              className={`flex items-center rounded-full border text-[12.5px] ${
                s === query ? 'border-accent text-strong' : 'border-line-strong/60 text-muted'
              }`}
            >
              <button
                type="button"
                onClick={() => setQuery(s === query ? '' : s)}
                className="py-1 pr-1 pl-3"
              >
                {s}
              </button>
              <button
                type="button"
                onClick={() => saveSearch(saved.filter((x) => x !== s))}
                aria-label={`Forget the search ${s}`}
                className="py-1 pr-2 pl-1 hover:text-fg"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1">
        {view === 'board' ? (
          <BoardView list={list} />
        ) : (
          <SheetTable
            list={list}
            total={inScope.length}
            loading={loading}
            empty={!companies.length}
            onImport={onImport}
            pages={pages}
          />
        )}
      </div>
      <div className="text-center text-[14px] text-muted">
        {list.length} {list.length === 1 ? 'company' : 'companies'}
        {sprint && info[sprint] ? ` in ${info[sprint]!.label}` : ''}
        {list.length !== inScope.length ? ` (of ${inScope.length})` : ''}
      </div>
    </section>
  );
}

/** Kitsu's filter button: the search syntax, with ready-made filters. */
function SearchHelp({ onPick }: { onPick: (q: string) => void }) {
  const { board } = useWorkspace();
  const [open, setOpen] = useState(false);
  const pick = (q: string) => {
    onPick(q);
    setOpen(false);
  };
  const sc = statusCol(board);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={340}
      label="Filters"
      trigger={
        <button type="button" aria-label="Filters" title="Filters" className={ui.iconButton}>
          <ListFilter size={18} />
        </button>
      }
    >
      <b className="text-strong">Filter by typing</b>
      <ul className="m-0 grid gap-1 pl-4 text-[13px] text-muted">
        <li>
          <code>buck</code> finds names and any field
        </li>
        <li>
          <code>status=wrote</code> filters a column (part of a value is enough)
        </li>
        <li>
          <code>city=la,nyc</code> matches either
        </li>
        <li>
          <code>status=[wrote back]</code> keeps spaces together
        </li>
        <li>
          <code>-buck</code> leaves names out
        </li>
      </ul>
      <b className="mt-1 text-strong">By status</b>
      <div className="flex flex-wrap gap-1.5">
        {optList(sc).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => pick(`status=[${o.label}]`)}
            className={`schip c-${o.color || 'grey'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Popover>
  );
}

function SheetTable({
  list,
  total,
  loading,
  empty,
  onImport,
  pages,
}: {
  list: Company[];
  total: number;
  loading: boolean;
  empty: boolean;
  onImport: () => void;
  pages: ReturnType<typeof useWorkspace>['pages'];
}) {
  const { board } = useWorkspace();
  const { selected, select } = useAppUI();
  const { addColumn } = useSheetUI();
  const sc = statusCol(board);
  const dependents = board.columns.filter(
    (c) => c.type === 'status' && c.showWhen && list.some((x) => colShows(c, x)),
  );
  const fields = sheetColumns(board, list).filter((c) => c.type !== 'status');
  const order = list.map((c) => c.id);
  const statusCols = [sc, ...dependents];

  const pickCell = (e: MouseEvent, id: string) =>
    select(id, e.metaKey || e.ctrlKey ? 'toggle' : e.shiftKey ? 'range' : 'only', order);

  return (
    <div className="h-full overflow-auto rounded-[10px]">
      <table className="sheet-grid w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky-col w-10 min-w-10" aria-label="Select" />
            <th className="sticky-col-2 w-64 min-w-56">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="eyebrow text-muted">Company</span>
                <button
                  type="button"
                  onClick={addColumn}
                  aria-label="Add a field"
                  title="Add a field"
                  className="grid size-7 place-items-center rounded-full border border-line-strong/60 text-muted hover:text-fg"
                >
                  +
                </button>
              </div>
            </th>
            {statusCols.map((col) => (
              <ColumnHeader
                key={col.id}
                col={col}
                accent={tint(col)}
                extra={col.id === 'status' ? <StatusMix list={list} sc={sc} /> : undefined}
              />
            ))}
            {fields.map((col) => (
              <ColumnHeader key={col.id} col={col} />
            ))}
            <th className="w-full" />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const isSel = selected.includes(c.id);
            return (
              <tr key={c.id} className="group" data-selected={isSel || undefined}>
                <td className="sticky-col text-center">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => select(c.id, 'toggle', order)}
                    aria-label={`Select ${c.name}`}
                    className="size-4 accent-[var(--selected)]"
                  />
                </td>
                <td className="sticky-col-2 max-w-72">
                  <div className="flex items-center gap-1 pr-1">
                    <OpenName company={c} />
                    <RowMenu company={c} />
                  </div>
                </td>
                {statusCols.map((col) => (
                  <td
                    key={col.id}
                    onClick={(e) => pickCell(e, c.id)}
                    style={{ '--tint': tint(col) } as React.CSSProperties}
                    className={`status-cell cursor-pointer px-2.5 py-2 ${isSel ? 'is-selected' : ''}`}
                  >
                    {colShows(col, c) && (
                      <span className="flex items-center gap-1.5">
                        <StatusTag col={col} value={c.meta?.[col.id]} />
                        {col.id === 'status' && <When company={c} page={pages[c.id]} />}
                      </span>
                    )}
                  </td>
                ))}
                {fields.map((col) => (
                  <MetaCell key={col.id} company={c} col={col} />
                ))}
                <td />
              </tr>
            );
          })}
          <AddCompanyRow span={statusCols.length + fields.length + 1} disabled={loading} />
        </tbody>
      </table>
      {loading ? (
        <SheetMessage>Loading your list…</SheetMessage>
      ) : empty ? (
        <SheetMessage>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            No companies yet. Type a name in the last row, or bring over everything from the
            prototype.
            <button type="button" className={ui.primary} onClick={onImport}>
              Import from the prototype
            </button>
          </span>
        </SheetMessage>
      ) : !total ? (
        <SheetMessage>No companies in this sprint yet. Add one in the last row.</SheetMessage>
      ) : !list.length ? (
        <SheetMessage>Nothing matches.</SheetMessage>
      ) : null}
    </div>
  );
}

/** The company name: opens its page, like a shot name in Kitsu. */
function OpenName({ company: c }: { company: Company }) {
  const { openPage } = useAppUI();
  return (
    <button
      type="button"
      onClick={() => openPage(c.id)}
      className="min-w-0 flex-1 truncate px-3 py-3 text-left text-[15px] font-bold text-strong hover:underline"
      title={`Open ${c.name}`}
    >
      {c.name || 'Untitled'}
    </button>
  );
}

/** The thin bar under the Status header: the mix of statuses in view. */
function StatusMix({ list, sc }: { list: Company[]; sc: Column }) {
  const counts = new Map<string, number>();
  for (const c of list) {
    const k = String(c.meta?.status ?? '');
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = list.length || 1;
  return (
    <span className="mt-1 flex h-1 min-w-28 overflow-hidden rounded-sm bg-line" aria-hidden="true">
      {optList(sc)
        .filter((o) => counts.get(o.id))
        .map((o) => (
          <motion.span
            key={o.id}
            className={`c-${o.color || 'grey'} block h-full bg-[var(--c)]`}
            animate={{ width: `${((counts.get(o.id) ?? 0) / total) * 100}%` }}
            transition={glide}
          />
        ))}
    </span>
  );
}

function SheetMessage({ children }: { children: React.ReactNode }) {
  return <div className="sticky left-0 px-3 py-4 text-muted">{children}</div>;
}

/**
 * The last row: type a name. Companies you already have are suggested; pick
 * one to add it to this sprint with everything it has. A new name makes a new
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
    if (available) void lookup(c, { announce: true, onAsk: () => select(c.id, 'only') });
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
    <tr>
      <td className="sticky-col border-b-0" />
      <td className="sticky-col-2 relative border-b-0">
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
          className="w-full bg-transparent px-3 py-3 outline-none placeholder:text-faint"
        />
        {matches.length > 0 && (
          <div
            role="listbox"
            aria-label="Companies you have"
            className="absolute top-full left-2 z-20 grid w-80 gap-0.5 rounded-[10px] border border-line bg-surface p-1.5 shadow-panel"
          >
            <div
              role="option"
              aria-selected={active === 0}
              className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted aria-selected:bg-selected aria-selected:text-white"
            >
              New company “{name.trim()}”
            </div>
            {matches.map((c, i) => {
              const here = !!sprint && inSprint(c, sprint);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={active === i + 1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addExisting(c)}
                  className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left aria-selected:bg-selected aria-selected:text-white"
                >
                  <span className="truncate font-bold">{c.name}</span>
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {here ? 'In this sprint' : sprint ? 'Add to sprint' : 'On your list'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </td>
      <td colSpan={span} className="border-b-0" />
    </tr>
  );
}
