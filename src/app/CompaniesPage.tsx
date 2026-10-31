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
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { useToast } from '../components/Toast';
import { readPref, writePref } from '../lib/prefs';
import { colShows, meta, optList, sheetColumns, statusCol, valueText } from '../model/board';
import { matchesQuery, parseQuery } from '../model/query';
import { inSprint, inView } from '../model/sprints';
import { norm } from '../model/text';
import type { Company } from '../model/types';
import { arrive, chipPop, glide, rowInOut } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { AddFieldDialog, DisplaySettings, FieldHeader, TwoClick, type Sort } from './columns';
import { FieldInput } from './fields';
import { StatusBoard } from './StatusBoard';
import { useSprintInfo } from './sprintLabels';
import { MenuItem, Pop, StatusTag, ui } from './ui';

type View = 'sheet' | 'board';
const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';
const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isSort = (v: unknown): v is Sort =>
  v === null || (!!v && typeof v === 'object' && typeof (v as { key?: unknown }).key === 'string');

/**
 * The companies list (M7), working like Kitsu's shot list: the companies in
 * the sprint on screen (or all of them), the Status column, then the starred
 * fields. Click a company's name or its status to open its side panel.
 * Fields edit in place.
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
      const col = board.columns.find((x) => x.id === sort.key);
      if (col?.type === 'status') {
        // Status order (Gathering, Reached out...), not A to Z.
        const i = optList(col).findIndex((o) => o.id === meta(c, col.id));
        return i < 0 ? 999 : i;
      }
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
            placeholder="Search, or filter like status=applied city=la"
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
        <motion.div key={view} {...arrive} className="h-full">
          {view === 'board' ? (
            <StatusBoard list={list} />
          ) : (
            <CompanyTable
              list={list}
              total={inScope.length}
              sort={sort}
              onSort={setSort}
              onImport={onImport}
            />
          )}
        </motion.div>
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
  const sc = statusCol(board);
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
          <code>status=applied</code> a status (<code>status=none</code> for none yet)
        </li>
        <li>
          <code>city=la,nyc</code> a field, either value
        </li>
        <li>
          <code>-buck</code> leaves names out
        </li>
      </ul>
      <b className="text-[13.5px] text-strong">Status</b>
      <div className="flex flex-wrap gap-1.5">
        {optList(sc).map((o) => (
          <button key={o.id} type="button" onClick={() => pick(`status=[${o.label}]`)}>
            <StatusTag col={sc} value={o.id} />
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
  const { selected, select, openPage } = useAppUI();
  const toast = useToast();
  const [addingField, setAddingField] = useState(false);
  const sc = statusCol(board);
  const fields = sheetColumns(board, list);

  return (
    <div className="h-full overflow-auto rounded-xl border border-line bg-surface">
      <table className="rtable w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky-a w-60 min-w-56">
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
            <th className="stage-col min-w-44">
              <FieldHeader col={sc} sort={sort} onSort={onSort} />
            </th>
            {fields.map((col) => (
              <th key={col.id} className="min-w-36">
                <FieldHeader col={col} sort={sort} onSort={onSort} />
              </th>
            ))}
            <th className="w-full" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {list.map((c) => {
              const open = selected === c.id;
              return (
                <motion.tr
                  key={c.id}
                  variants={rowInOut}
                  initial="initial"
                  animate="enter"
                  exit="exit"
                  className="group"
                  aria-selected={open}
                >
                  <td className="sticky-a">
                    <div className="flex items-center pr-1">
                      <button
                        type="button"
                        onClick={() => select(c.id)}
                        data-opens-panel
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
                          title="Open the full page"
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
                  <td
                    onClick={() => select(c.id)}
                    data-opens-panel
                    aria-selected={open}
                    aria-label={`${sc.name} for ${c.name}`}
                    className="stage-cell cursor-pointer px-3"
                  >
                    {/* A changed status pops in (M10); not on first show. */}
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={String(meta(c, sc.id) ?? '')}
                        {...chipPop}
                        className="inline-block"
                      >
                        <StatusTag col={sc} value={meta(c, sc.id)} />
                      </motion.span>
                    </AnimatePresence>
                  </td>
                  {fields.map((col) => (
                    <td key={col.id} className="field-cell max-w-72">
                      {colShows(col, c) || meta(c, col.id) != null ? (
                        <FieldInput company={c} col={col} />
                      ) : null}
                    </td>
                  ))}
                  <td />
                </motion.tr>
              );
            })}
          </AnimatePresence>
          <AddCompanyRow disabled={loading} span={fields.length + 2} />
        </tbody>
      </table>
      {!loading && !companies.length ? (
        <Message>
          No companies yet. Type a name in the last row, or bring in a list from a CSV in Settings →
          Import & export.
          <span className="mt-2 flex gap-2">
            <button type="button" className={ui.button} onClick={onImport}>
              Import from the prototype
            </button>
          </span>
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
 * The last row: type a name. In a sprint, companies you have that aren't in
 * it yet come first (Enter picks the highlighted one) and join with
 * everything they have; "New company" is last, so Enter never makes a
 * duplicate. A new company joins this sprint and the AI looks it up. Escape
 * closes the list; clicking away clears the row.
 */
function AddCompanyRow({ span, disabled }: { span: number; disabled: boolean }) {
  const { companies, sprint, actions } = useWorkspace();
  const { available, lookup } = useAssistant();
  const { select } = useAppUI();
  const info = useSprintInfo();
  const toast = useToast();
  const [name, setName] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  const n = norm(name);
  // Only in a sprint, and only companies not in it yet: in All companies
  // they're all on the list already (Zack, M7 round 2).
  const matches =
    n && sprint
      ? companies
          .filter((c) => !inSprint(c, sprint) && norm(c.name).includes(n))
          .sort((a, b) => Number(norm(b.name).startsWith(n)) - Number(norm(a.name).startsWith(n)))
          .slice(0, 6)
      : [];
  const exact = matches.some((c) => norm(c.name) === n);
  // Existing companies, then "New company" (unless the name is already taken).
  const options = [...matches.map((c) => ({ c })), ...(exact || !n ? [] : [{ c: null }])];
  const showList = open && matches.length > 0;

  const reset = () => {
    setName('');
    setActive(0);
  };

  const addExisting = (c: Company) => {
    reset();
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
    reset();
    // Sure answers fill in quietly; a "which one?" opens the panel to ask there.
    if (available) void lookup(c, { announce: true, onAsk: () => select(c.id) });
  };

  const choose = (i: number) => {
    const o = showList ? options[i] : undefined;
    if (o?.c) addExisting(o.c);
    else create();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown' && showList) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp' && showList) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      // First Escape closes the list; the next clears the name.
      e.preventDefault();
      if (showList) setOpen(false);
      else reset();
    }
  };

  return (
    <tr className="add-row">
      <td className="sticky-a relative">
        <input
          id="new-company"
          value={name}
          disabled={disabled}
          onChange={(e) => {
            setName(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // Clicking away drops the half-typed name, so it can't look added.
          onBlur={() => {
            setOpen(false);
            reset();
          }}
          onKeyDown={onKeyDown}
          placeholder="+ Add a company"
          aria-label="Add a company"
          aria-autocomplete="list"
          aria-expanded={showList}
          autoComplete="off"
          // Gray while typing: it isn't a company yet.
          className="w-full bg-transparent px-3 py-3 text-[14px] text-muted outline-none placeholder:text-faint"
        />
        {showList && (
          <div
            role="listbox"
            aria-label="Companies you have"
            // Keep focus in the input so a click on an option lands before blur closes the list.
            onMouseDown={(e) => e.preventDefault()}
            className={`${ui.menu} absolute top-full left-2 w-80`}
          >
            {options.map((o, i) =>
              o.c ? (
                <MenuItem key={o.c.id} active={active === i} onSelect={() => choose(i)}>
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.c.name}</span>
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {sprint && inSprint(o.c, sprint)
                      ? 'In this sprint'
                      : sprint
                        ? 'Add to sprint'
                        : 'On your list'}
                  </span>
                </MenuItem>
              ) : (
                <MenuItem key="new" active={active === i} onSelect={() => choose(i)}>
                  <span className="text-muted">New company “{name.trim()}”</span>
                </MenuItem>
              ),
            )}
          </div>
        )}
      </td>
      <td colSpan={span} />
    </tr>
  );
}
