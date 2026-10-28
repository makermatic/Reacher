import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { optList, sheetColumns, statusCol } from '../model/board';
import { visibleCompanies, type Filter } from '../model/search';
import type { Column, Company } from '../model/types';
import { btn } from '../components/Modal';
import { useToast } from '../components/Toast';
import { glide, itemInOut } from '../motion';
import { ColumnHeader } from '../sheet/ColumnMenu';
import { ColumnsPopover } from '../sheet/ColumnsPopover';
import { MetaCell } from '../sheet/MetaCell';
import { RowMenu } from '../sheet/RowMenu';
import { useSheetUI } from '../sheet/SheetUI';
import { StatusChip } from '../sheet/StatusChip';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAssistant } from '../ai/Assistant';

/** The Kitsu-style sheet: one row per company (SPEC section 4). */
export function SheetView({ onImport }: { onImport: () => void }) {
  const { loading, board, companies, pages } = useWorkspace();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const { addColumn, openCompanyId, toggleCompany } = useSheetUI();

  const list = useMemo(
    () => visibleCompanies(board, companies, query, filter),
    [board, companies, query, filter],
  );
  const cols = sheetColumns(board, list);
  const sc = statusCol(board);
  const span = cols.length + 1;

  return (
    <>
      <section aria-label="Sheet" className="flex h-full min-h-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="sheet-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies"
            aria-label="Search companies"
            className="w-56 max-w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 outline-none transition-[border-color] focus:border-accent"
          />
          <FilterSwitch filter={filter} onChange={setFilter} />
          <span className="mr-auto font-mono text-xs text-muted tabular-nums">
            {list.length} of {companies.length} companies
          </span>
          <ColumnsPopover />
          <button type="button" className={btn.base} onClick={addColumn}>
            + Column
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface">
          <table className="sheet-grid w-max min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky-col w-56 min-w-52 px-3 py-2 text-left text-[12.5px] font-semibold text-muted">
                  Company
                </th>
                <ColumnHeader col={sc} extra={<StatusMix list={list} sc={sc} />} />
                {cols.map((col) => (
                  <ColumnHeader key={col.id} col={col} />
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {list.map((c) => (
                  <motion.tr
                    key={c.id}
                    className={`group ${openCompanyId === c.id ? 'is-open' : ''}`}
                    {...itemInOut}
                  >
                    <td className="sticky-col max-w-68">
                      <div className="flex items-center gap-1 pr-1">
                        <button
                          type="button"
                          data-keep-panel
                          onClick={() => toggleCompany(c.id)}
                          className="min-w-0 flex-1 truncate px-3 py-2.5 text-left font-semibold decoration-line-strong underline-offset-2 hover:underline"
                          title={`Open ${c.name}`}
                        >
                          {c.name || 'Untitled'}
                        </button>
                        <RowMenu company={c} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <StatusChip company={c} col={sc} />
                        <When company={c} page={pages[c.id]} />
                      </span>
                    </td>
                    {cols.map((col) => (
                      <MetaCell key={col.id} company={c} col={col} />
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
              <AddCompanyRow span={span} disabled={loading} />
            </tbody>
          </table>
          {loading ? (
            <SheetMessage>Loading your list…</SheetMessage>
          ) : !companies.length ? (
            <SheetMessage>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                No companies yet. Type a name above, or bring over everything from the prototype.
                <button type="button" className={`${btn.primary} ${btn.small}`} onClick={onImport}>
                  Import from the prototype
                </button>
              </span>
            </SheetMessage>
          ) : !list.length ? (
            <SheetMessage>Nothing matches.</SheetMessage>
          ) : null}
        </div>
      </section>
    </>
  );
}

/** The thin bar in the Status header showing the mix of statuses in view. */
function StatusMix({ list, sc }: { list: Company[]; sc: Column }) {
  const counts = new Map<string, number>();
  for (const c of list) {
    const k = String(c.meta?.status ?? '');
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const total = list.length || 1;
  return (
    <span className="flex h-1 min-w-28 overflow-hidden rounded-sm bg-line" aria-hidden="true">
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

/** A note under the table (loading, empty, no matches), pinned to the visible width. */
function SheetMessage({ children }: { children: React.ReactNode }) {
  return <div className="sticky left-0 px-3 py-4 text-muted">{children}</div>;
}

/** The last row: type a company name and press Enter. Focus stays for the next one. */
function AddCompanyRow({ span, disabled }: { span: number; disabled: boolean }) {
  const { actions } = useWorkspace();
  const { available, lookup } = useAssistant();
  const { openCompany } = useSheetUI();
  const toast = useToast();
  const [name, setName] = useState('');
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const existing = actions.findByName(n);
    if (existing) {
      toast(`${existing.name} is already on the list`);
      return;
    }
    const c = actions.addCompany(n);
    setName('');
    // Sure answers fill in quietly; a "which one?" opens the page to ask there.
    if (available) void lookup(c, { announce: true, onAsk: () => openCompany(c.id) });
  };
  return (
    <tr>
      <td className="sticky-col border-b-0">
        <input
          id="new-company"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="+ Add a company"
          aria-label="Add a company"
          autoComplete="off"
          className="w-full bg-transparent px-3 py-2.5 outline-none placeholder:text-faint"
        />
      </td>
      <td colSpan={span} className="border-b-0" />
    </tr>
  );
}

function FilterSwitch({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const opts: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'needs', label: 'Needs me' },
  ];
  return (
    <div
      role="group"
      aria-label="Filter"
      className="flex rounded-lg border border-line-strong bg-surface p-0.5"
    >
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={filter === o.id}
          onClick={() => onChange(o.id)}
          className="relative rounded-md px-2.5 py-1 text-muted transition-colors aria-pressed:text-fg"
        >
          {filter === o.id && (
            <motion.span
              layoutId="filter-highlight"
              transition={glide}
              className="absolute inset-0 rounded-md bg-accent-soft"
            />
          )}
          <span className="relative font-medium">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
