/**
 * People (M11): the second list, next to Companies, like Kitsu's assets next
 * to shots. The same Sheet and Board, fields, stars and Display; each person
 * has a company and a thumbs up / down status. A sprint shows the people at
 * its companies. Click a name or a status for their side panel.
 */
import { ArrowUpRight, Building2, KanbanSquare, Plus, Search, Table2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { readPref, writePref } from '../lib/prefs';
import { colShows, meta, optList, sheetColumns, statusCol, valueText } from '../model/board';
import { personActivity } from '../model/activity';
import { matchesQuery, parseQuery } from '../model/query';
import { inSprint } from '../model/sprints';
import type { Company, Contact } from '../model/types';
import { arrive, chipPop, glide, rowInOut } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import {
  AddFieldDialog,
  DisplaySettings,
  FieldHeader,
  SortMenu,
  TwoClick,
  type Sort,
} from './columns';
import { FieldInput } from './fields';
import { PeopleList, useList } from './listContext';
import { StatusBoard } from './StatusBoard';
import { useSprintInfo } from './sprintLabels';
import { MenuItem, MenuSeparator, Pop, StatusTag, ui } from './ui';

type View = 'sheet' | 'board';
const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';
const isSort = (v: unknown): v is Sort =>
  v === null || (!!v && typeof v === 'object' && typeof (v as { key?: unknown }).key === 'string');

export function PeoplePage() {
  return (
    <PeopleList>
      <People />
    </PeopleList>
  );
}

function People() {
  const { people, companies, pages, chains, sprint, loading } = useWorkspace();
  const { board } = useList();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(() => readPref('people-view', 'sheet', isView));
  const [sort, setSortState] = useState<Sort>(() => readPref<Sort>('people-sort', null, isSort));
  const setSort = (s: Sort) => {
    setSortState(s);
    writePref('people-sort', s);
  };
  const companyOf = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const companyName = (p: Contact) => (p.companyId ? companyOf.get(p.companyId)?.name : '') ?? '';

  const inScope = useMemo(
    () =>
      people.filter((p) => {
        if (!sprint) return true;
        const c = p.companyId ? companyOf.get(p.companyId) : undefined;
        return !!c && inSprint(c, sprint);
      }),
    [people, sprint, companyOf],
  );
  const list = useMemo(() => {
    const q = parseQuery(query);
    // Their company's name counts as part of who they are, for search.
    const rows = inScope.filter((p) =>
      matchesQuery(board, { ...p, name: `${p.name} ${companyName(p)}` } as unknown as Company, q),
    );
    const order = (p: Contact) => p.order || 0;
    if (!sort) return rows.sort((a, b) => order(a) - order(b));
    const key = (p: Contact): string | number => {
      if (sort.key === 'name') return p.name.toLowerCase();
      if (sort.key === 'company') return companyName(p).toLowerCase();
      if (sort.key === 'recent') return personActivity(p, pages, chains);
      const col = board.columns.find((x) => x.id === sort.key);
      if (col?.type === 'status') {
        const i = optList(col).findIndex((o) => o.id === meta(p, col.id));
        return i < 0 ? 999 : i;
      }
      return col ? valueText(col, meta(p, col.id)).toLowerCase() : '';
    };
    return rows.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka === '' || ka === 999) return 1;
      if (kb === '' || kb === 999) return -1;
      return (ka < kb ? -1 : ka > kb ? 1 : order(a) - order(b)) * sort.dir;
    });
    // companyName reads companyOf, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, inScope, query, sort, companyOf, pages, chains]);

  const changeView = (v: View) => {
    setView(v);
    writePref('people-view', v);
  };

  return (
    <section aria-label="People" className="flex h-full min-h-0 flex-col gap-3 px-6 pt-5 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-[360px] max-w-full items-center gap-2 rounded-lg border border-line bg-surface pr-1 pl-3 transition-colors focus-within:border-selectable">
          <Search size={16} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            id="people-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, or filter like role=recruiter"
            aria-label="Search people"
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
        </div>
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
                    layoutId="people-view-toggle"
                    transition={glide}
                    className="absolute inset-0 rounded-md bg-hover"
                  />
                )}
                <Icon size={15} className="relative" aria-hidden="true" />
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          <SortMenu sort={sort} onSort={setSort} />
          <DisplaySettings />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <motion.div key={view} {...arrive} className="h-full">
          {view === 'board' ? (
            <StatusBoard list={list} subtitle={(r) => companyName(r as Contact) || 'No company'} />
          ) : (
            <PeopleTable list={list} sort={sort} onSort={setSort} companyName={companyName} />
          )}
        </motion.div>
      </div>
      <div className="text-center text-[13px] text-muted">
        {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'person' : 'people'}`}
        {sprint && info[sprint] ? ` at companies in ${info[sprint]!.label}` : ''}
        {list.length !== inScope.length ? ` (of ${inScope.length})` : ''}
      </div>
    </section>
  );
}

function PeopleTable({
  list,
  sort,
  onSort,
  companyName,
}: {
  list: Contact[];
  sort: Sort;
  onSort: (s: Sort) => void;
  companyName: (p: Contact) => string;
}) {
  const { people, loading, actions } = useWorkspace();
  const { board } = useList();
  const { selected, select } = useAppUI();
  const toast = useToast();
  const [addingField, setAddingField] = useState(false);
  const sc = statusCol(board);
  const fields = sheetColumns(board, list);
  const head =
    'flex h-10 items-center px-3 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted hover:text-fg';
  const flip = (key: string) =>
    onSort(sort?.key === key && sort.dir === 1 ? { key, dir: -1 } : { key, dir: 1 });

  return (
    <div className="h-full overflow-auto rounded-xl border border-line bg-surface">
      <table className="rtable w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky-a w-56 min-w-52">
              <div className="flex items-center justify-between pr-2">
                <button type="button" onClick={() => flip('name')} className={head}>
                  Name
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
            <th className="min-w-44">
              <button type="button" onClick={() => flip('company')} className={head}>
                Company
              </button>
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
            {list.map((p) => {
              const open = selected === p.id;
              return (
                <motion.tr
                  key={p.id}
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
                        onClick={() => select(p.id)}
                        data-opens-panel
                        title={`Open ${p.name}`}
                        className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[14px] font-semibold text-strong hover:underline"
                      >
                        {p.name || 'Untitled'}
                      </button>
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <RowDelete
                          name={p.name}
                          onDelete={() => {
                            void actions.deletePerson(p.id);
                            toast(`Deleted ${p.name}`);
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="field-cell">
                    <CompanyPicker person={p} name={companyName(p)} openOnClick />
                  </td>
                  <td
                    onClick={() => select(p.id)}
                    data-opens-panel
                    aria-selected={open}
                    aria-label={`${sc.name} for ${p.name}`}
                    className="stage-cell cursor-pointer px-3"
                  >
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={String(meta(p, sc.id) ?? '')}
                        {...chipPop}
                        className="inline-block"
                      >
                        <StatusTag col={sc} value={meta(p, sc.id)} />
                      </motion.span>
                    </AnimatePresence>
                  </td>
                  {fields.map((col) => (
                    <td key={col.id} className="field-cell max-w-72">
                      {colShows(col, p) || meta(p, col.id) != null ? (
                        <FieldInput company={p} col={col} />
                      ) : null}
                    </td>
                  ))}
                  <td />
                </motion.tr>
              );
            })}
          </AnimatePresence>
          <AddPersonRow disabled={loading} span={fields.length + 2} />
        </tbody>
      </table>
      {!loading && !people.length && (
        <p className="sticky left-0 m-0 px-4 py-5 text-[13.5px] text-muted">
          No people yet. Add one in the last row, from a company’s panel, or from a CSV in Settings
          → Import & export.
        </p>
      )}
      <AddFieldDialog open={addingField} onOpenChange={setAddingField} />
    </div>
  );
}

/** Their company: click to move them to another one (or none). */
export function CompanyPicker({
  person,
  name,
  className = '',
  openOnClick = false,
}: {
  person: Contact;
  name: string;
  className?: string;
  /** On the People sheet (Zack): a click opens the company, a right-click changes it. */
  openOnClick?: boolean;
}) {
  const { companies, actions } = useWorkspace();
  const { openPage, select } = useAppUI();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const matches = [...companies]
    .filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 12);
  const pick = (c: Company | null) => {
    actions.movePerson(person.id, c?.id ?? null);
    setOpen(false);
    setQ('');
  };
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={260}
      label={`Company for ${person.name}`}
      trigger={
        <button
          type="button"
          aria-label={`Company for ${person.name}`}
          {...(openOnClick && person.companyId
            ? {
                'data-opens-panel': true,
                title: `Open ${name}. Right-click to change`,
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  select(person.companyId);
                },
                onContextMenu: (e: React.MouseEvent) => {
                  e.preventDefault();
                  setOpen(true);
                },
              }
            : {})}
          className={`flex h-full min-h-[44px] w-full items-center gap-2 px-3 text-left text-[13.5px] ${name ? 'text-fg' : 'text-faint'} ${className}`}
        >
          <Building2 size={14} className="shrink-0 text-faint" aria-hidden="true" />
          <span className="truncate">{name || 'No company'}</span>
        </button>
      }
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a company"
        aria-label="Find a company"
        className={`${ui.input} mb-1 h-8 w-full`}
      />
      {matches.map((c) => (
        <MenuItem key={c.id} active={c.id === person.companyId} onSelect={() => pick(c)}>
          <span className="truncate">{c.name}</span>
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem muted active={!person.companyId} onSelect={() => pick(null)}>
        No company
      </MenuItem>
      {person.companyId && (
        <MenuItem
          onSelect={() => {
            setOpen(false);
            openPage(person.companyId!);
          }}
        >
          <ArrowUpRight size={14} aria-hidden="true" /> Open {name}
        </MenuItem>
      )}
    </Pop>
  );
}

function RowDelete({ name, onDelete }: { name: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={220}
      align="end"
      label={`Delete ${name}`}
      trigger={
        <button type="button" aria-label={`Delete ${name}`} className={ui.ghostIcon}>
          <X size={15} />
        </button>
      }
    >
      <TwoClick armed="Click again to delete" onConfirm={onDelete}>
        Delete {name}
      </TwoClick>
    </Pop>
  );
}

/**
 * The last row: a name, and the company they're at. In a sprint, people you
 * have who aren't in it come first (Zack): picking one adds their company to
 * the sprint, so they show up, instead of making a duplicate.
 */
function AddPersonRow({ span, disabled }: { span: number; disabled: boolean }) {
  const { companies, people, sprint, actions } = useWorkspace();
  const { select } = useAppUI();
  const info = useSprintInfo();
  const toast = useToast();
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const companyOf = (p: Contact) => companies.find((c) => c.id === p.companyId);

  const n = name.trim().toLowerCase();
  const inView = (p: Contact) => {
    const c = companyOf(p);
    return !sprint || (!!c && inSprint(c, sprint));
  };
  const matches = n
    ? people
        .filter((p) => !inView(p) && p.name.toLowerCase().includes(n))
        .sort(
          (a, b) =>
            Number(b.name.toLowerCase().startsWith(n)) - Number(a.name.toLowerCase().startsWith(n)),
        )
        .slice(0, 6)
    : [];
  const exact = people.find((p) => p.name.trim().toLowerCase() === n);
  const options = [...matches.map((p) => ({ p })), ...(exact ? [] : [{ p: null }])];
  const showList = open && matches.length > 0;

  const reset = () => {
    setName('');
    setActive(0);
  };
  const addExisting = (p: Contact) => {
    reset();
    const c = companyOf(p);
    if (inView(p)) return toast(`${p.name} is already on the list`);
    if (!c) {
      toast(`${p.name} isn’t at a company yet. Put them at one to add them to this sprint.`);
      return select(p.id);
    }
    actions.addToSprint(c.id, sprint!);
    toast(`Added ${c.name} to ${info[sprint!]?.label ?? 'this sprint'}, with ${p.name}`);
  };
  const create = () => {
    if (!name.trim()) return;
    if (exact) return addExisting(exact);
    actions.addPerson(name, companyId || null);
    toast(`Added ${name.trim()}`);
    reset();
  };
  const choose = (i: number) => {
    const o = showList ? options[i] : undefined;
    if (o?.p) addExisting(o.p);
    else create();
  };

  return (
    <tr className="add-row">
      <td className="sticky-a relative">
        <input
          id="new-person"
          value={name}
          disabled={disabled}
          onChange={(e) => {
            setName(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
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
              e.preventDefault();
              if (showList) setOpen(false);
              else reset();
            }
          }}
          placeholder="+ Add a person"
          aria-label="Add a person"
          aria-expanded={showList}
          autoComplete="off"
          className="w-full bg-transparent px-3 py-3 text-[14px] text-muted outline-none placeholder:text-faint"
        />
        {showList && (
          <div
            role="listbox"
            aria-label="People you have"
            onMouseDown={(e) => e.preventDefault()}
            className={`${ui.menu} absolute top-full left-2 w-80`}
          >
            {options.map((o, i) =>
              o.p ? (
                <MenuItem key={o.p.id} active={active === i} onSelect={() => choose(i)}>
                  <span className="min-w-0 flex-1 truncate font-semibold">{o.p.name}</span>
                  <span className="shrink-0 truncate text-[11.5px] text-faint">
                    {companyOf(o.p)?.name ?? 'No company'}
                  </span>
                </MenuItem>
              ) : (
                <MenuItem key="new" active={active === i} onSelect={() => choose(i)}>
                  <span className="text-muted">New person “{name.trim()}”</span>
                </MenuItem>
              ),
            )}
          </div>
        )}
      </td>
      <td>
        {name.trim() && !showList && (
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            aria-label="At company"
            className="h-9 w-full bg-transparent px-3 text-[13.5px] text-muted outline-none"
          >
            <option value="">No company</option>
            {[...companies]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
      </td>
      <td colSpan={span} />
    </tr>
  );
}
