import { ArrowUpRight, Check, Layers, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useAssistant } from '../ai/Assistant';
import { ApplicationsBody } from '../company/EntrySections';
import { LookupCard } from '../company/LookupCard';
import { MeetingsBody } from '../company/MeetingsBody';
import { NoticeCard } from '../components/QuickUpdateBar';
import { useToast } from '../components/Toast';
import { meta, statusCol } from '../model/board';
import { daysUntil } from '../model/dates';
import { eventsOf } from '../model/events';
import { nextSteps } from '../model/nextSteps';
import { inView } from '../model/sprints';
import type { Company } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { TwoClick } from './columns';
import { EmailsSection, FieldRows, Section } from './CompanySections';
import { FeedCard } from './Feed';
import { useSprintInfo } from './sprintLabels';
import { MenuItem, Pop, StatusPicker, ui } from './ui';

export const MIN_PANEL = 380;
export const clampPanel = (w: number) =>
  Math.round(Math.max(MIN_PANEL, Math.min(w, window.innerWidth - 360)));

/** How many feed lines show before "Show all". */
const FEED_PREVIEW = 5;

/**
 * The side panel (M7): the company's page, docked on the right, opened by
 * clicking its name or its status. On top, Kitsu's comment box with the
 * status next to Post; under it the feed; then its fields, emails, meetings
 * and applications. Drag the left edge to resize.
 */
export function SidePanel({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const { companies } = useWorkspace();
  const { selected, select } = useAppUI();
  const company = companies.find((c) => c.id === selected);

  useEffect(() => {
    if (selected && !company && companies.length) select(null);
  }, [selected, company, companies.length, select]);

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

  if (!company) return null;
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
      <CompanyPanel key={company.id} company={company} />
    </aside>
  );
}

function CompanyPanel({ company: stored }: { company: Company }) {
  const { board, pages, chains, templates, sprint, actions } = useWorkspace();
  const { openPage, select } = useAppUI();
  const assistant = useAssistant();
  const toast = useToast();
  const info = useSprintInfo();
  const company = inView(stored, sprint);
  const sc = statusCol(board);
  const current = (meta(company, 'status') as string | null) ?? null;
  // Like Kitsu: pick a status next to Post; Post applies it with the comment.
  const [status, setStatus] = useState(current);
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    setStatus(current);
  }
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [allFeed, setAllFeed] = useState(false);
  const busy = assistant.noticeOrigin === company.id && assistant.notice?.kind === 'busy';
  const changed = status !== current;

  const post = async (e?: FormEvent) => {
    e?.preventDefault();
    const note = text.trim();
    if (busy || (!note && !changed)) return;
    if (changed) actions.setMeta(company.id, 'status', status);
    if (!note) return;
    if (!assistant.available) {
      actions.comment(company.id, note);
      setText('');
      return;
    }
    // The comment goes in the feed straight away, whatever the AI makes of it.
    setText('');
    await assistant.quickUpdate(note, company);
  };

  const [preset, setPreset] = useState<{ template: string; target: string; key: number }>();
  const steps = nextSteps(company, pages[company.id], chains, templates);
  const events = eventsOf(pages[company.id]);
  const feed = allFeed ? events : events.slice(0, FEED_PREVIEW);
  const due = company.due ? daysUntil(company.due) : null;
  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-0.5 border-b border-line px-2.5">
        <button
          type="button"
          onClick={() => openPage(company.id)}
          aria-label="Open the company page"
          title="Open the full page"
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
              select(null);
              void actions.deleteCompany(company.id);
              toast(`Deleted ${company.name}`);
            }}
          >
            Delete {company.name}
          </TwoClick>
        </Pop>
        <button
          type="button"
          onClick={() => select(null)}
          aria-label="Close the panel"
          className={`${ui.ghostIcon} ml-auto`}
        >
          <X size={17} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-10">
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={() => openPage(company.id)}
            className="block min-w-0 flex-1 text-left"
          >
            <span className="block truncate font-display text-[22px] font-bold text-strong hover:underline">
              {company.name}
            </span>
            {sprint && info[sprint] && (
              <span className="text-[12.5px] text-faint">{info[sprint]!.label}</span>
            )}
          </button>
          <label className="grid shrink-0 gap-1">
            <span className={ui.label}>Follow up on</span>
            <span className="flex items-center gap-2">
              <input
                id="follow-up"
                type="date"
                value={company.due ?? ''}
                onChange={(e) => actions.setDue(company.id, e.target.value || null)}
                className={`${ui.input} h-8`}
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
              // Enter is a new line (like Kitsu); Ctrl/Cmd+Enter posts.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-2.5 py-2">
            <span className="ml-auto flex items-center gap-2">
              {changed && <span className="text-[12px] text-faint">Changes on Post</span>}
              <StatusPicker col={sc} value={status} onPick={setStatus} label="Status" />
              <button
                type="submit"
                disabled={busy || (!text.trim() && !changed)}
                className={ui.primary}
              >
                {busy ? 'Reading…' : 'Post'}
              </button>
            </span>
          </div>
        </form>
        <NoticeCard inline origin={company.id} onApplied={() => setText('')} />

        {steps.length > 0 && (
          <ul aria-label="Suggested" className="m-0 mt-3 grid list-none gap-1.5 p-0">
            {steps.map((st) => (
              <li key={st.id}>
                <button
                  type="button"
                  onClick={() =>
                    setPreset({ template: st.template, target: st.target, key: Date.now() })
                  }
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-2 text-left text-[13.5px] text-fg transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  <Sparkles size={14} className="shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{st.text}</span>
                  <span className="shrink-0 text-[12px] text-muted">Write it →</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2" role="feed" aria-label="Feed">
          {feed.length ? (
            feed.map((ev) => <FeedCard key={ev.id} event={ev} />)
          ) : (
            <p className="m-0 text-[13px] text-muted">
              Comments, status changes and emails show up here.
            </p>
          )}
          {events.length > FEED_PREVIEW && (
            <button
              type="button"
              onClick={() => setAllFeed(!allFeed)}
              className="justify-self-start text-[13px] text-muted hover:text-fg"
            >
              {allFeed ? 'Show less' : `Show all ${events.length}`}
            </button>
          )}
        </div>

        <div className="mt-8 grid gap-8">
          <Section title="Details">
            <FieldRows company={company} />
          </Section>
          <Section key={preset?.key ?? 0} title="Emails">
            <EmailsSection company={company} preset={preset} />
          </Section>
          <Section title="Meetings">
            <MeetingsBody company={company} />
          </Section>
          <Section title="Applications">
            <ApplicationsBody company={company} />
          </Section>
        </div>
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
