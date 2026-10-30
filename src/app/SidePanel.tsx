import { ArrowUpRight, Check, ChevronDown, Layers, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { LookupCard } from '../company/LookupCard';
import { NoticeCard } from '../components/QuickUpdateBar';
import { useToast } from '../components/Toast';
import { daysUntil, fmtDate } from '../model/dates';
import { eventsOf } from '../model/events';
import { activeStage, stagesIn } from '../model/stages';
import type { Company } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { cellKey, sameCell, useAppUI, type Cell } from './AppUI';
import { TwoClick } from './columns';
import { FeedCard } from './Feed';
import { useSprintInfo } from './sprintLabels';
import { colorVar, MenuItem, Pop, StageName, StatusTag, ui } from './ui';

export const MIN_PANEL = 380;
export const clampPanel = (w: number) =>
  Math.round(Math.max(MIN_PANEL, Math.min(w, window.innerWidth - 360)));

/**
 * The side panel (M7), working like Kitsu's task panel. One cell selected: the
 * company in that stage, its status, a comment box (the AI reads a comment as
 * an update about this company) and its feed. Several: one status for all.
 * Drag the left edge to resize.
 */
export function SidePanel({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const { companies } = useWorkspace();
  const { selected, clearSelection } = useAppUI();
  const cells = selected.filter((s) => companies.some((c) => c.id === s.id));

  useEffect(() => {
    if (selected.length && !cells.length) clearSelection();
  }, [selected.length, cells.length, clearSelection]);

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => onResize(clampPanel(window.innerWidth - ev.clientX));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  if (!cells.length) return null;
  const one = cells.length === 1 || new Set(cells.map((c) => c.id)).size === 1;
  return (
    <aside
      aria-label="Company panel"
      style={{ width }}
      className="relative flex min-h-0 shrink-0 flex-col border-l border-line bg-panel max-[720px]:fixed max-[720px]:inset-0 max-[720px]:z-40 max-[720px]:w-full!"
    >
      <div
        onPointerDown={startResize}
        aria-hidden="true"
        title="Drag to resize"
        className="group/rz absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none"
      >
        <span className="absolute inset-y-0 left-0.5 w-0.5 bg-transparent transition-colors group-hover/rz:bg-selectable" />
      </div>
      {one ? (
        <OnePanel
          key={cells[0]!.id}
          company={companies.find((c) => c.id === cells[0]!.id)!}
          cell={cells[cells.length - 1]!}
        />
      ) : (
        <ManyPanel cells={cells} />
      )}
    </aside>
  );
}

function Bar({ children }: { children: React.ReactNode }) {
  const { clearSelection } = useAppUI();
  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 border-b border-line px-2.5">
      {children}
      <button
        type="button"
        onClick={clearSelection}
        aria-label="Close the panel"
        className={`${ui.ghostIcon} ml-auto`}
      >
        <X size={17} />
      </button>
    </div>
  );
}

/** Pick a stage's status: the tag, then a list. Changes right away. */
export function StatusPicker({
  value,
  onPick,
  label,
}: {
  value: string | null | undefined;
  onPick: (status: string | null) => void;
  label: string;
}) {
  const { board } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={220}
      label={label}
      trigger={
        <button
          type="button"
          aria-label={label}
          className="flex h-9 items-center gap-2 rounded-lg border border-line bg-bg px-2.5 hover:border-line-strong"
        >
          <StatusTag board={board} value={value} />
          <ChevronDown size={15} className="text-faint" />
        </button>
      }
    >
      {board.statuses.map((s) => (
        <MenuItem
          key={s.id}
          active={s.id === value}
          onSelect={() => {
            onPick(s.id);
            setOpen(false);
          }}
        >
          <StatusTag board={board} value={s.id} />
          <span className="ml-auto max-w-32 truncate text-[11.5px] text-faint">{s.meaning}</span>
        </MenuItem>
      ))}
      <MenuItem
        muted
        active={!value}
        onSelect={() => {
          onPick(null);
          setOpen(false);
        }}
      >
        No status
      </MenuItem>
    </Pop>
  );
}

function OnePanel({ company, cell }: { company: Company; cell: Cell }) {
  const { board, pages, sprint, actions } = useWorkspace();
  const { openPage, select, clearSelection } = useAppUI();
  const assistant = useAssistant();
  const toast = useToast();
  const info = useSprintInfo();
  const stages = stagesIn(company, sprint);
  const stageId = cell.stage ?? activeStage(board, stages);
  const stage = board.stages.find((s) => s.id === stageId) ?? board.stages[0];
  const [text, setText] = useState('');
  const busy = assistant.noticeOrigin === company.id && assistant.notice?.kind === 'busy';
  const [deleting, setDeleting] = useState(false);

  const post = async (e?: FormEvent) => {
    e?.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    if (!assistant.available) {
      actions.comment(company.id, note);
      setText('');
      return;
    }
    if (await assistant.quickUpdate(note, company)) setText('');
  };

  const events = eventsOf(pages[company.id]);
  const due = company.due ? daysUntil(company.due) : null;
  return (
    <>
      <Bar>
        <button
          type="button"
          onClick={() => openPage(company.id)}
          aria-label="Open the company page"
          title="Open the company page"
          className={ui.ghostIcon}
        >
          <ArrowUpRight size={17} />
        </button>
        {assistant.available && (
          <button
            type="button"
            onClick={() => void assistant.lookup(company)}
            aria-label="Look up company details"
            title="Look up company details"
            className={ui.ghostIcon}
          >
            <Search size={16} />
          </button>
        )}
        <SprintsMenu company={company} />
        <Pop
          open={deleting}
          onOpenChange={setDeleting}
          width={230}
          label={`Delete ${company.name}`}
          trigger={
            <button
              type="button"
              aria-label={`Delete ${company.name}`}
              title="Delete"
              className={ui.ghostIcon}
            >
              <Trash2 size={16} />
            </button>
          }
        >
          <TwoClick
            armed="Click again to delete"
            onConfirm={() => {
              clearSelection();
              void actions.deleteCompany(company.id);
              toast(`Deleted ${company.name}`);
            }}
          >
            Delete {company.name}
          </TwoClick>
        </Pop>
      </Bar>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-10">
        <button
          type="button"
          onClick={() => openPage(company.id)}
          className="block max-w-full text-left"
        >
          <span className="block truncate font-display text-[22px] font-bold text-strong hover:underline">
            {company.name}
          </span>
          {sprint && info[sprint] && (
            <span className="text-[12.5px] text-faint">{info[sprint]!.label}</span>
          )}
        </button>

        <div role="tablist" aria-label="Stages" className="mt-3 flex flex-wrap gap-1.5">
          {board.stages.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === stage?.id}
              onClick={() => select({ id: company.id, stage: s.id })}
              className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12.5px] text-muted transition-colors hover:text-fg aria-selected:border-[var(--tint)] aria-selected:text-strong"
              style={{ '--tint': colorVar(s.color) } as React.CSSProperties}
            >
              <span className="size-1.5 rounded-full" style={{ background: colorVar(s.color) }} />
              {s.name}
              <StatusTag board={board} value={stages[s.id]} className="px-1.5 text-[11px]" />
            </button>
          ))}
        </div>

        {stage && (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="grid gap-1">
              <span className={ui.label}>
                <StageName name={stage.name} color={stage.color} />
              </span>
              <StatusPicker
                value={stages[stage.id]}
                label={`${stage.name} status`}
                onPick={(st) => actions.setStage(company.id, stage.id, st)}
              />
            </div>
            <label className="grid gap-1">
              <span className={ui.label}>Follow up on</span>
              <span className="flex items-center gap-2">
                <input
                  id="follow-up"
                  type="date"
                  value={company.due ?? ''}
                  onChange={(e) => actions.setDue(company.id, e.target.value || null)}
                  className={ui.input}
                />
                {due != null && (
                  <span
                    className={`text-[12px] ${due < 0 ? 'text-[var(--c-red)]' : due === 0 ? 'text-[var(--c-amber)]' : 'text-faint'}`}
                  >
                    {due < 0 ? `${-due}d late` : due === 0 ? 'today' : `in ${due}d`}
                  </span>
                )}
              </span>
            </label>
          </div>
        )}

        <div className="mt-3">
          <LookupCard company={company} />
        </div>

        <form
          onSubmit={post}
          className={`relative mt-4 rounded-xl border border-line bg-surface ${busy ? 'ai-working' : ''}`}
        >
          <label htmlFor="comment-text" className="sr-only">
            Comment
          </label>
          <textarea
            id="comment-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void post();
              }
            }}
            placeholder={
              assistant.available
                ? `Comment or update, like “they’re not hiring”. Reacher updates ${company.name} from it.`
                : 'Leave a comment…'
            }
            className="block w-full resize-y rounded-t-xl border-0 bg-transparent px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
            <span className="text-[12px] text-faint">
              Enter to post · Shift+Enter for a new line
            </span>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className={`${ui.primary} ml-auto h-8`}
            >
              {busy ? 'Reading…' : 'Post'}
            </button>
          </div>
          <NoticeCard origin={company.id} onApplied={() => setText('')} />
        </form>

        <div className="mt-5 grid gap-2">
          <span className={ui.label}>Activity</span>
          {events.length ? (
            events.map((ev) => <FeedCard key={ev.id} event={ev} />)
          ) : (
            <p className="m-0 text-[13px] text-muted">
              Comments, status changes and emails show up here.
            </p>
          )}
        </div>
        {company.due && <span className="sr-only">Follow up {fmtDate(company.due)}</span>}
      </div>
    </>
  );
}

/** Several cells: one status for all of them, with an optional comment. */
function ManyPanel({ cells }: { cells: Cell[] }) {
  const { board, companies, actions } = useWorkspace();
  const { select } = useAppUI();
  const toast = useToast();
  const [status, setStatus] = useState<string | null>(board.statuses[0]?.id ?? null);
  const [text, setText] = useState('');
  const withStage = cells.map((c) => ({
    id: c.id,
    stage: c.stage ?? activeStage(board, companies.find((x) => x.id === c.id)?.stages ?? {}) ?? '',
  }));

  const apply = () => {
    actions.setStagesMany(withStage, status, text);
    toast(`${cells.length} updated`);
    setText('');
  };

  return (
    <>
      <Bar>
        <span className="px-1.5 text-[14px] font-semibold text-strong">
          {cells.length} selected
        </span>
      </Bar>
      <div className="grid content-start gap-3 overflow-y-auto px-4 pt-4 pb-8">
        <div className="grid gap-1">
          <span className={ui.label}>New status</span>
          <StatusPicker value={status} onPick={setStatus} label="New status" />
        </div>
        <textarea
          id="many-comment"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A comment for all of them (optional)"
          aria-label="Comment for all"
          className={`${ui.input} h-auto py-2`}
        />
        <button type="button" onClick={apply} className={ui.primary}>
          Change status for the {cells.length} selected
        </button>
        <span className={`${ui.label} mt-2`}>Selected</span>
        <ul className="m-0 grid list-none gap-1 p-0">
          {withStage.map((c) => {
            const company = companies.find((x) => x.id === c.id);
            const stage = board.stages.find((s) => s.id === c.stage);
            return (
              <li key={cellKey(c)} className="flex items-center gap-2 text-[13.5px]">
                <span className="min-w-0 flex-1 truncate">
                  {company?.name}
                  {stage && (
                    <span className="ml-2 text-muted">
                      <StageName name={stage.name} color={stage.color} />
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={`Unselect ${company?.name} ${stage?.name ?? ''}`}
                  onClick={() => select(cells.find((x) => sameCell(x, c)) ?? c, 'toggle')}
                  className={ui.ghostIcon}
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/** Which sprints the company is in: tick to add, untick to take out. */
function SprintsMenu({ company }: { company: Company }) {
  const { sprints, actions } = useWorkspace();
  const info = useSprintInfo();
  const [open, setOpen] = useState(false);
  if (!sprints.length) return null;
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={290}
      label="Sprints"
      trigger={
        <button type="button" aria-label="Sprints" title="Sprints" className={ui.ghostIcon}>
          <Layers size={16} />
        </button>
      }
    >
      <div className={`${ui.label} px-2.5 py-1`}>In sprints</div>
      {[...sprints].reverse().map((s) => {
        const on = !!company.sprints?.[s.id];
        return (
          <MenuItem
            key={s.id}
            onSelect={() =>
              on
                ? actions.removeFromSprint(company.id, s.id)
                : actions.addToSprint(company.id, s.id)
            }
          >
            <span className="grid size-4 place-items-center rounded border border-line-strong">
              {on && <Check size={12} />}
            </span>
            <span className="min-w-0 flex-1 truncate">{info[s.id]?.label ?? s.name}</span>
          </MenuItem>
        );
      })}
    </Pop>
  );
}
