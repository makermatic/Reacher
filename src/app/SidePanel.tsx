import { Check, ExternalLink, Layers, Search, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { LookupCard } from '../company/LookupCard';
import { ConfirmButton, armedDanger } from '../components/ConfirmButton';
import { NoticeCard } from '../components/QuickUpdateBar';
import { useToast } from '../components/Toast';
import { colShows, optList, statusCol } from '../model/board';
import { eventsOf } from '../model/events';
import { inView } from '../model/sprints';
import type { Company } from '../model/types';
import { StatusChip } from '../sheet/StatusChip';
import { When } from '../sheet/When';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { FeedCard } from './Feed';
import { useSprintInfo } from './sprintLabels';
import { Dropdown, MenuItem, ui } from './ui';

export const MIN_PANEL = 380;
export const clampPanel = (w: number) =>
  Math.round(Math.max(MIN_PANEL, Math.min(w, window.innerWidth - 360)));

/**
 * Kitsu's task panel, for companies (M7). One company: its status (in the
 * sprint on screen), a comment box whose comments the AI reads as an update
 * about this company, and its feed. Several: change all their statuses at
 * once. Drag the left edge to resize.
 */
export function SidePanel({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const { companies } = useWorkspace();
  const { selected, clearSelection } = useAppUI();
  const chosen = companies.filter((c) => selected.includes(c.id));

  // Deleted companies drop out; nothing left closes the panel.
  useEffect(() => {
    if (selected.length && !chosen.length) clearSelection();
  }, [selected.length, chosen.length, clearSelection]);

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

  if (!chosen.length) return null;
  return (
    <aside
      aria-label="Company panel"
      style={{ width }}
      className="relative flex min-h-0 shrink-0 flex-col border-l-[3px] border-line bg-panel max-[720px]:fixed max-[720px]:inset-0 max-[720px]:z-40 max-[720px]:w-full!"
    >
      <div
        onPointerDown={startResize}
        aria-hidden="true"
        title="Drag to resize"
        className="group/rz absolute inset-y-0 -left-1.5 z-10 w-2.5 cursor-col-resize touch-none"
      >
        <span className="absolute inset-y-0 left-1 w-0.5 bg-transparent transition-colors group-hover/rz:bg-accent" />
      </div>
      {chosen.length === 1 ? <OnePanel company={chosen[0]!} /> : <ManyPanel companies={chosen} />}
    </aside>
  );
}

function PanelBar({ children }: { children: React.ReactNode }) {
  const { clearSelection } = useAppUI();
  return (
    <div className="flex h-[54px] shrink-0 items-center gap-1 border-b border-line px-3">
      {children}
      <button
        type="button"
        onClick={clearSelection}
        aria-label="Close the panel"
        className={`${ui.ghostIcon} ml-auto`}
      >
        <X size={18} />
      </button>
    </div>
  );
}

function OnePanel({ company: stored }: { company: Company }) {
  const { board, pages, sprint, actions } = useWorkspace();
  const { openPage, clearSelection } = useAppUI();
  const assistant = useAssistant();
  const toast = useToast();
  const info = useSprintInfo();
  const company = inView(stored, sprint);
  const sc = statusCol(board);
  const dependents = board.columns.filter((c) => c.type === 'status' && c.showWhen);
  const [text, setText] = useState('');
  const busy = assistant.noticeOrigin === stored.id && assistant.notice?.kind === 'busy';

  const post = async (e?: FormEvent) => {
    e?.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    if (!assistant.available) {
      actions.comment(stored.id, note);
      setText('');
      return;
    }
    // The AI reads it as an update about this company; the note goes in the feed either way.
    if (await assistant.quickUpdate(note, stored)) setText('');
  };

  const events = eventsOf(pages[stored.id]);
  return (
    <>
      <PanelBar>
        <button
          type="button"
          onClick={() => openPage(stored.id)}
          aria-label="Open the company page"
          title="Open the company page"
          className={ui.ghostIcon}
        >
          <ExternalLink size={18} />
        </button>
        {assistant.available && (
          <button
            type="button"
            onClick={() => void assistant.lookup(stored)}
            aria-label="Look up company details"
            title="Look up company details"
            className={ui.ghostIcon}
          >
            <Search size={18} />
          </button>
        )}
        <SprintsMenu company={stored} />
        <ConfirmButton
          label={`Delete ${stored.name}`}
          onConfirm={() => {
            clearSelection();
            void actions.deleteCompany(stored.id);
            toast(`Deleted ${stored.name}`);
          }}
          confirm="Delete company?"
          className={ui.ghostIcon}
          armedClassName={armedDanger}
        >
          <Trash2 size={18} />
        </ConfirmButton>
      </PanelBar>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        <div className="mb-3 flex items-center gap-3">
          <span
            className="rounded-sm border-l-[3px] bg-surface-2 px-2 py-0.5 text-[13px] font-bold"
            style={{ borderLeftColor: 'var(--accent)' }}
          >
            Company
          </span>
          <button
            type="button"
            onClick={() => openPage(stored.id)}
            className="min-w-0 truncate text-left text-[20px] text-muted hover:text-fg"
          >
            {sprint && info[sprint] ? `${info[sprint]!.label} / ` : ''}
            <span className="text-strong">{stored.name}</span>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div className="grid gap-1">
            <span className={ui.label}>{sc.name}</span>
            <StatusChip company={company} col={sc} />
          </div>
          {dependents
            .filter((col) => colShows(col, company))
            .map((col) => (
              <div key={col.id} className="grid gap-1">
                <span className={ui.label}>{col.name}</span>
                <StatusChip company={company} col={col} />
              </div>
            ))}
          <div className="grid gap-1">
            <label htmlFor="follow-up" className={ui.label}>
              Follow up on
            </label>
            <div className="flex items-center gap-2">
              <input
                id="follow-up"
                type="date"
                value={stored.due ?? ''}
                onChange={(e) => actions.setDue(stored.id, e.target.value || null)}
                className={`${ui.input} h-9`}
              />
              {stored.due && <When company={stored} page={undefined} />}
            </div>
          </div>
        </div>

        <LookupCard company={stored} />

        <form
          onSubmit={post}
          className={`relative mt-3 rounded-[10px] border border-line-strong/50 bg-surface ${busy ? 'ai-working' : ''}`}
        >
          <div className="border-b border-line px-3 py-2 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-strong">
            {assistant.available ? 'Comment or update' : 'Post comment'}
          </div>
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
                ? `Leave a comment… like “they’re not hiring”. The AI updates ${stored.name} from it.`
                : 'Leave a comment…'
            }
            className="block w-full resize-y border-0 bg-transparent px-3 py-2.5 text-[14px] text-fg outline-none placeholder:text-faint"
          />
          <div className="flex items-center gap-2 border-t border-line px-2.5 py-2">
            <span className="text-[12px] text-faint">
              Enter to post · Shift+Enter for a new line
            </span>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className={`${ui.primary} ml-auto`}
            >
              {busy ? 'Reading…' : 'Post'}
            </button>
          </div>
          <NoticeCard origin={stored.id} onApplied={() => setText('')} />
        </form>

        <div className="mt-4 grid gap-2.5">
          {events.length ? (
            events.map((ev) => <FeedCard key={ev.id} event={ev} />)
          ) : (
            <p className="m-0 text-center text-[13px] text-muted">
              Nothing here yet. Comments, status changes and emails show up here.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

/** Kitsu's multi-selection: one status (and comment) for all of them. */
function ManyPanel({ companies }: { companies: Company[] }) {
  const { board, actions } = useWorkspace();
  const { select } = useAppUI();
  const toast = useToast();
  const sc = statusCol(board);
  const [status, setStatus] = useState<string>(optList(sc)[0]?.id ?? '');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const label = optList(sc).find((o) => o.id === status)?.label ?? 'Status';

  const apply = () => {
    actions.setStatusMany(
      companies.map((c) => c.id),
      'status',
      status,
      text,
    );
    toast(`${companies.length} companies → ${label}`);
    setText('');
  };

  return (
    <>
      <PanelBar>
        <span className="text-[14px] font-bold text-strong">{companies.length} selected</span>
      </PanelBar>
      <div className="grid content-start gap-3 overflow-y-auto px-4 pt-4 pb-8">
        <div className="flex items-center gap-2">
          <Dropdown
            open={open}
            onOpenChange={setOpen}
            ariaLabel="New status"
            label={label}
            width={240}
          >
            {optList(sc).map((o) => (
              <MenuItem
                key={o.id}
                active={o.id === status}
                onSelect={() => {
                  setStatus(o.id);
                  setOpen(false);
                }}
              >
                <span className={`schip c-${o.color || 'grey'}`}>{o.label}</span>
              </MenuItem>
            ))}
          </Dropdown>
        </div>
        <textarea
          id="many-comment"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a comment for all of them (optional)"
          aria-label="Comment for all"
          className={`${ui.input} h-auto py-2`}
        />
        <button type="button" onClick={apply} className={ui.primary}>
          Change status for the {companies.length} selected companies
        </button>
        <h2 className="mt-3 mb-0 text-[16px] font-normal uppercase tracking-[0.08em] text-muted">
          Selected ({companies.length})
        </h2>
        <ul className="m-0 grid list-none gap-1 p-0">
          {companies.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-[14px]">
              <span
                className="rounded-sm border-l-[3px] bg-surface-2 px-2 py-0.5 text-[12px] font-bold"
                style={{ borderLeftColor: 'var(--accent)' }}
              >
                Company
              </span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              <button
                type="button"
                aria-label={`Unselect ${c.name}`}
                onClick={() => select(c.id, 'toggle')}
                className={ui.ghostIcon}
              >
                <X size={14} />
              </button>
            </li>
          ))}
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
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      ariaLabel="Sprints"
      label=""
      icon={<Layers size={18} />}
      width={300}
      className="h-8 border-0 bg-transparent px-1.5"
    >
      <div className={`${ui.label} px-2.5 py-1.5`}>In sprints</div>
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
    </Dropdown>
  );
}
