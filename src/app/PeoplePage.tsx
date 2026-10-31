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
import { matchesQuery, parseQuery } from '../model/query';
import { inSprint } from '../model/sprints';
import type { Company, Contact } from '../model/types';
import { arrive, chipPop, glide, rowInOut } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { AddFieldDialog, DisplaySettings, FieldHeader, TwoClick, type Sort } from './columns';
import { FieldInput } from './fields';
import { PeopleList, useList } from './listContext';
import { StatusBoard } from './StatusBoard';
import { useSprintInfo } from './sprintLabels';
import { MenuItem, MenuSeparator, Pop, StatusTag, ui } from './ui';

type View = 'sheet' | 'board';
const isView = (v: unknown): v is View => v === 'sheet' || v === 'board';

export function PeoplePage() {
  return (
    <PeopleList>
      <People />
    </PeopleList>
  );
}

function People() {
  const { people, companies, sprint, loading } = useWorkspace();
  const { board } = useList();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<View>(() => readPref('people-view', 'sheet', isView));
  const [sort, setSort] = useState<Sort>(null);
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
  }, [board, inScope, query, sort, companyOf]);

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
                    <CompanyPicker person={p} name={companyName(p)} />
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
}: {
  person: Contact;
  name: string;
  className?: string;
}) {
  const { companies, actions } = useWorkspace();
  const { openPage } = useAppUI();
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

/** The last row: a name, and the company they're at. */
function AddPersonRow({ span, disabled }: { span: number; disabled: boolean }) {
  const { companies, actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const add = () => {
    if (!name.trim()) return;
    actions.addPerson(name, companyId || null);
    toast(`Added ${name.trim()}`);
    setName('');
  };
  return (
    <tr className="add-row">
      <td className="sticky-a">
        <input
          id="new-person"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            } else if (e.key === 'Escape') setName('');
          }}
          placeholder="+ Add a person"
          aria-label="Add a person"
          autoComplete="off"
          className="w-full bg-transparent px-3 py-3 text-[14px] text-muted outline-none placeholder:text-faint"
        />
      </td>
      <td>
        {name.trim() && (
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
