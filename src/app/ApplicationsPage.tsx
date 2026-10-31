/**
 * Applications (Zack, round 5): every job application, across companies, as
 * a third list next to Companies and People. Each row is one application on a
 * company's page (role, date, posting, result), edited in place. A sprint
 * shows the applications at its companies. Click a company for its side panel.
 */
import { ExternalLink, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { useToast } from '../components/Toast';
import { normalizeUrl } from '../lib/links';
import { statusCol } from '../model/board';
import { todayISO } from '../model/dates';
import { inSprint } from '../model/sprints';
import type { Application, Company } from '../model/types';
import { chipPop, rowInOut } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { TwoClick } from './columns';
import { useSprintInfo } from './sprintLabels';
import { MenuItem, Pop, StatusTag, ui } from './ui';

type Row = { app: Application; company: Company };

export function ApplicationsPage() {
  const { companies, pages, sprint, loading, actions } = useWorkspace();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');

  const inScope = useMemo(
    () => companies.filter((c) => !sprint || inSprint(c, sprint)),
    [companies, sprint],
  );
  const rows = useMemo(() => {
    const all: Row[] = inScope.flatMap((company) =>
      actions.pageOf(company.id).applications.map((app) => ({ app, company })),
    );
    // Newest first.
    return all.sort((a, b) => (a.app.date < b.app.date ? 1 : a.app.date > b.app.date ? -1 : 0));
    // pageOf reads pages, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inScope, pages]);
  const list = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((r) => {
      const text =
        `${r.company.name} ${r.app.role} ${r.app.result} ${r.app.link} ${r.app.date}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [rows, query]);

  return (
    <section
      aria-label="Applications"
      className="flex h-full min-h-0 flex-col gap-3 px-6 pt-5 pb-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-9 w-[360px] max-w-full items-center gap-2 rounded-lg border border-line bg-surface pr-1 pl-3 transition-colors focus-within:border-selectable">
          <Search size={16} className="shrink-0 text-faint" aria-hidden="true" />
          <input
            id="applications-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search applications"
            aria-label="Search applications"
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
      </div>
      <div className="min-h-0 flex-1">
        <ApplicationsTable list={list} companies={inScope} />
      </div>
      <div className="text-center text-[13px] text-muted">
        {loading
          ? 'Loading…'
          : `${list.length} ${list.length === 1 ? 'application' : 'applications'}`}
        {sprint && info[sprint] ? ` at companies in ${info[sprint]!.label}` : ''}
        {list.length !== rows.length ? ` (of ${rows.length})` : ''}
      </div>
    </section>
  );
}

const head =
  'flex h-10 items-center px-3 text-[12px] font-semibold uppercase tracking-[0.05em] text-muted';
const cellInput =
  'h-full min-h-[44px] w-full bg-transparent px-3 text-[13.5px] text-fg outline-none placeholder:text-faint focus:bg-bg focus:shadow-[inset_0_0_0_1px_var(--selectable)]';

function ApplicationsTable({ list, companies }: { list: Row[]; companies: Company[] }) {
  const { board, loading, actions } = useWorkspace();
  const { selected, select } = useAppUI();
  const toast = useToast();
  const sc = statusCol(board);
  const patch = (r: Row, p: Partial<Omit<Application, 'id'>>) =>
    actions.patchApplication(r.company.id, r.app.id, p);

  return (
    <div className="h-full overflow-auto rounded-xl border border-line bg-surface">
      <table className="rtable w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky-a w-56 min-w-52">
              <span className={head}>Company</span>
            </th>
            <th className="min-w-56">
              <span className={head}>Role</span>
            </th>
            <th className="min-w-40">
              <span className={head}>Applied</span>
            </th>
            <th className="min-w-56">
              <span className={head}>Job posting</span>
            </th>
            <th className="min-w-48">
              <span className={head}>Result</span>
            </th>
            <th className="stage-col min-w-44">
              <span className={head}>{sc.name}</span>
            </th>
            <th className="w-full" />
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {list.map((r) => {
              const open = selected === r.company.id;
              const name = r.company.name;
              const what = r.app.role ? `${r.app.role} at ${name}` : `the application to ${name}`;
              return (
                <motion.tr
                  key={r.app.id}
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
                        onClick={() => select(r.company.id)}
                        data-opens-panel
                        title={`Open ${name}`}
                        className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[14px] font-semibold text-strong hover:underline"
                      >
                        {name || 'Untitled'}
                      </button>
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <DeleteApp
                          label={`Delete ${what}`}
                          onDelete={() => {
                            actions.deleteEntry(r.company.id, 'applications', r.app.id);
                            toast('Application deleted');
                          }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="field-cell">
                    <CellText
                      value={r.app.role}
                      label={`Role at ${name}`}
                      onSave={(v) => patch(r, { role: v })}
                    />
                  </td>
                  <td className="field-cell">
                    <CellText
                      type="date"
                      value={r.app.date}
                      label={`Applied to ${name}`}
                      onSave={(v) => patch(r, { date: v || todayISO() })}
                    />
                  </td>
                  <td className="field-cell">
                    <CellText
                      value={r.app.link}
                      label={`Job posting at ${name}`}
                      link
                      onSave={(v) => patch(r, { link: normalizeUrl(v) })}
                    />
                  </td>
                  <td className="field-cell">
                    <CellText
                      value={r.app.result}
                      label={`Result at ${name}`}
                      onSave={(v) => patch(r, { result: v })}
                    />
                  </td>
                  <td
                    onClick={() => select(r.company.id)}
                    data-opens-panel
                    aria-selected={open}
                    aria-label={`${sc.name} for ${name}`}
                    className="stage-cell cursor-pointer px-3"
                  >
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={String(r.company.meta?.status ?? '')}
                        {...chipPop}
                        className="inline-block"
                      >
                        <StatusTag col={sc} value={r.company.meta?.status} />
                      </motion.span>
                    </AnimatePresence>
                  </td>
                  <td />
                </motion.tr>
              );
            })}
          </AnimatePresence>
          <AddApplicationRow companies={companies} disabled={loading} />
        </tbody>
      </table>
      {!loading && !list.length && (
        <p className="sticky left-0 m-0 px-4 py-5 text-[13.5px] text-muted">
          No applications yet. Add one in the last row, or from a company’s panel.
        </p>
      )}
    </div>
  );
}

/** A cell that saves on Enter or when you click away; Escape puts it back. */
function CellText({
  value,
  label,
  onSave,
  type = 'text',
  link = false,
}: {
  value: string;
  label: string;
  onSave: (v: string) => void;
  type?: 'text' | 'date';
  link?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setDraft(value);
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(value);
      const t = e.currentTarget;
      requestAnimationFrame(() => t.blur());
    }
  };
  return (
    <span className="relative flex h-full items-center">
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() !== value && onSave(draft.trim())}
        onKeyDown={onKeyDown}
        aria-label={label}
        className={`${cellInput} ${link && draft ? 'pr-8 text-selectable' : ''}`}
      />
      {link && value && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${value}`}
          className="absolute right-2 text-faint hover:text-fg"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </span>
  );
}

function DeleteApp({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={240}
      align="end"
      label={label}
      trigger={
        <button type="button" aria-label={label} className={ui.ghostIcon}>
          <X size={15} />
        </button>
      }
    >
      <TwoClick armed="Click again to delete" onConfirm={onDelete}>
        Delete this application
      </TwoClick>
    </Pop>
  );
}

/**
 * The last row: type a company (yours come up as you type; a new name adds
 * it), then the role, and Enter. Adding moves its status like the panel does.
 */
function AddApplicationRow({ companies, disabled }: { companies: Company[]; disabled: boolean }) {
  const { companies: everyone, actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Company | null>(null);

  const n = name.trim().toLowerCase();
  // Companies on screen first, then the rest you have.
  const pool = [...companies, ...everyone.filter((c) => !companies.includes(c))];
  const matches =
    n && !picked
      ? pool
          .filter((c) => c.name.toLowerCase().includes(n))
          .sort(
            (a, b) =>
              Number(b.name.toLowerCase().startsWith(n)) -
              Number(a.name.toLowerCase().startsWith(n)),
          )
          .slice(0, 6)
      : [];
  const showList = open && matches.length > 0;

  const pick = (c: Company) => {
    setPicked(c);
    setName(c.name);
    setOpen(false);
    requestAnimationFrame(() => document.getElementById('new-application-role')?.focus());
  };
  const add = () => {
    if (!name.trim()) return;
    const company = picked ?? actions.findByName(name) ?? actions.addCompany(name);
    const label = actions.addApplication(company.id, {
      date: todayISO(),
      role: role.trim() || String(company.meta?.role ?? ''),
      link: '',
      result: '',
    });
    toast(
      label
        ? `Application to ${company.name} added. Status → ${label}`
        : `Application to ${company.name} added`,
    );
    setName('');
    setRole('');
    setPicked(null);
    document.getElementById('new-application')?.focus();
  };

  return (
    <tr className="add-row">
      <td className="sticky-a relative">
        <input
          id="new-application"
          value={name}
          disabled={disabled}
          onChange={(e) => {
            setName(e.target.value);
            setPicked(null);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown' && showList) {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === 'ArrowUp' && showList) {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (showList) pick(matches[active]!);
              else if (name.trim()) add();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              if (showList) setOpen(false);
              else {
                setName('');
                setPicked(null);
              }
            }
          }}
          placeholder="+ Add an application"
          aria-label="Application to which company"
          aria-expanded={showList}
          autoComplete="off"
          className="w-full bg-transparent px-3 py-3 text-[14px] text-muted outline-none placeholder:text-faint"
        />
        {showList && (
          <div
            role="listbox"
            aria-label="Companies you have"
            onMouseDown={(e) => e.preventDefault()}
            className={`${ui.menu} absolute top-full left-2 w-80`}
          >
            {matches.map((c, i) => (
              <MenuItem key={c.id} active={active === i} onSelect={() => pick(c)}>
                <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
              </MenuItem>
            ))}
          </div>
        )}
      </td>
      <td>
        {name.trim() && (
          <input
            id="new-application-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Role, then Enter"
            aria-label="Role"
            className="h-11 w-full bg-transparent px-3 text-[13.5px] text-fg outline-none placeholder:text-faint"
          />
        )}
      </td>
      <td colSpan={5} />
    </tr>
  );
}
