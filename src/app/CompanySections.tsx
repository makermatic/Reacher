/**
 * The parts of a company shared by the side panel and the company page:
 * its fields (star one to show it on the sheet), its
 * status in each sprint, and its emails.
 */
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChainCard, ChainsBody, NewChainButton } from '../company/ChainsBody';
import { useToast } from '../components/Toast';
import { chainsOf } from '../model/people';
import { ComposeEmail } from '../company/ComposeEmail';
import { colShows, meta, statusCol } from '../model/board';
import { updateColumn } from '../model/columns';
import { fmtDate, todayISO } from '../model/dates';
import { sprintsOf } from '../model/sprints';
import type { Company, Contact } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useList, type Row } from './listContext';
import { FieldInput } from './fields';
import { useSprintInfo } from './sprintLabels';
import { StatusTag, ui } from './ui';

/** A heading that folds its section away. */
export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="grid gap-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-left"
      >
        {open ? (
          <ChevronDown size={16} className="text-faint" />
        ) : (
          <ChevronRight size={16} className="text-faint" />
        )}
        <h2 className={ui.sectionTitle}>{title}</h2>
      </button>
      {open && children}
    </section>
  );
}

/**
 * Every field but Status, each with a star: starred fields are columns on
 * the sheet. Outcome only shows once there's been a meeting or interview.
 */
export function FieldRows({ company }: { company: Row }) {
  const { board, saveBoard } = useList();
  const cols = board.columns.filter(
    (col) => col.id !== 'status' && (colShows(col, company) || meta(company, col.id) != null),
  );
  return (
    <div className="grid grid-cols-[26px_minmax(110px,170px)_minmax(0,1fr)] overflow-hidden rounded-xl border border-line">
      {cols.map((col) => {
        const starred = col.onSheet !== false;
        return (
          <div key={col.id} className="contents">
            <div className="flex min-h-11 items-center justify-center border-b border-line">
              <button
                type="button"
                aria-pressed={starred}
                onClick={() => saveBoard(updateColumn(board, col.id, { onSheet: !starred }))}
                aria-label={`Show ${col.name} on the sheet`}
                title={starred ? 'On the sheet. Click to take it off' : 'Star to show on the sheet'}
                className="grid size-5 place-items-center rounded text-faint transition-colors hover:bg-hover hover:text-fg aria-pressed:text-[var(--warn)]"
              >
                <Star size={9} fill={starred ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className="flex min-h-11 items-center border-b border-line pr-2 text-[13px] text-muted">
              {col.name}
            </div>
            <div className="flex min-h-11 min-w-0 items-center border-b border-line px-1">
              <FieldInput company={company} col={col} variant="row" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Its status now and in every sprint it's in (each sprint keeps its own). */
export function SprintStatuses({ company }: { company: Company }) {
  const { board, sprints } = useWorkspace();
  const info = useSprintInfo();
  const sc = statusCol(board);
  const outcome = board.columns.find((c) => c.id === 'outcome');
  const mine = sprintsOf(company, sprints).reverse();
  const rows = [
    { key: 'latest', label: 'Latest', meta: company.meta, note: '' },
    ...mine.map((s) => {
      const e = company.sprints![s.id]!;
      return {
        key: s.id,
        label: info[s.id]?.label ?? s.name,
        meta: e.meta,
        note: `Added ${fmtDate(e.added)} · last change ${fmtDate(e.updated)}`,
      };
    }),
  ];
  const cell = 'border-b border-line px-3 py-2.5';
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className={`${cell} ${ui.label}`}>Sprint</th>
              <th className={`${cell} ${ui.label}`}>{sc.name}</th>
              {outcome && <th className={`${cell} ${ui.label}`}>{outcome.name}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className={cell}>
                  <b className="text-[13.5px] text-strong">{r.label}</b>
                  {r.note && <span className="block text-[11.5px] text-faint">{r.note}</span>}
                </td>
                <td className={cell}>
                  <StatusTag col={sc} value={r.meta?.status} />
                </td>
                {outcome && (
                  <td className={cell}>
                    <StatusTag col={outcome} value={r.meta?.[outcome.id]} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!mine.length && (
        <p className="m-0 text-[13px] text-muted">
          Not in a sprint. Add it from a sprint’s list, or the sprint menu at the top of its panel.
        </p>
      )}
    </div>
  );
}

/** Its email chains (the newest starts open), a new chain, and the writer. */
export function EmailsSection({
  company,
  preset,
}: {
  company: Company;
  /** A suggested next step to start the writer from; it scrolls into view. */
  preset?: { template: string; target: string; key: number };
}) {
  const { chains } = useWorkspace();
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const latest = chains
      .filter((ch) => ch.companyId === company.id)
      .sort((a, b) => (a.started < b.started ? 1 : -1))[0];
    return latest ? { [latest.id]: true } : {};
  });
  const setChainOpen = (id: string, o: boolean) => setOpen((cur) => ({ ...cur, [id]: o }));
  const writer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preset) writer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [preset]);
  return (
    <>
      <ChainsBody company={company} open={open} setOpen={setChainOpen} />
      <div>
        <NewChainButton company={company} onCreated={(id) => setChainOpen(id, true)} />
      </div>
      <div ref={writer} className="scroll-mt-4">
        <ComposeEmail key={preset?.key ?? 0} company={company} preset={preset} />
      </div>
    </>
  );
}

/**
 * A person's emails (M11): Gmail threads they're on and chains started with
 * them, each the same chain card as on the company.
 */
export function PersonEmails({ person }: { person: Contact }) {
  const { chains, actions } = useWorkspace();
  const toast = useToast();
  const mine = chainsOf(person, chains);
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    mine[0] ? { [mine[0].id]: true } : {},
  );
  const first = person.name.split(/\s+/)[0] || person.name;
  return (
    <div className="grid gap-2">
      {mine.length ? (
        mine.map((ch) => (
          <ChainCard
            key={ch.id}
            chain={ch}
            open={!!open[ch.id]}
            onToggle={() => setOpen((cur) => ({ ...cur, [ch.id]: !cur[ch.id] }))}
          />
        ))
      ) : (
        <p className="m-0 text-[13px] text-muted">
          No emails with {first} yet. Gmail threads they’re on show up here.
        </p>
      )}
      {person.companyId ? (
        <div>
          <button
            type="button"
            className={ui.button}
            onClick={() => {
              const id = actions.newChain(
                person.companyId!,
                `Email with ${first} ${fmtDate(todayISO())}`,
                person.id,
              );
              setOpen((cur) => ({ ...cur, [id]: true }));
              toast('New chain started. Paste the first email, or rename it.');
            }}
          >
            + New chain with {first}
          </button>
        </div>
      ) : (
        <p className="m-0 text-[12.5px] text-faint">
          Put them at a company to keep emails with them.
        </p>
      )}
    </div>
  );
}
