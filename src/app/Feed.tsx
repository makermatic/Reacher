import { colById, colorFor, optionLabel, optionOf } from '../model/board';
import { Markdown } from '../lib/markdown';
import { dayOf, KIND_LABEL, timeOf } from '../model/events';
import { fmtDate, todayISO } from '../model/dates';
import type { FeedEvent } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSprintInfo } from './sprintLabels';
import { colorVar } from './ui';

/** The colored bar + word for an event's kind (Kitsu's task type tag). */
const KIND_COLOR: Record<FeedEvent['kind'], string> = {
  comment: 'var(--c-grey)',
  status: 'var(--c-blue)',
  email: 'var(--c-pink)',
  meeting: 'var(--c-teal)',
  application: 'var(--c-green)',
  field: 'var(--c-amber)',
  company: 'var(--c-violet)',
  sprint: 'var(--c-violet)',
};

export function KindTag({ kind }: { kind: FeedEvent['kind'] }) {
  return <DotLabel color={KIND_COLOR[kind]}>{KIND_LABEL[kind]}</DotLabel>;
}

/** A colored dot and a bold word: every feed line's label (Zack, after M7g). */
function DotLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-strong">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

/** "Today 14:05", "Oct 22 09:10". */
export function when(e: FeedEvent) {
  const day = dayOf(e);
  return `${day === todayISO() ? 'Today' : fmtDate(day)} ${timeOf(e)}`.trim();
}

/**
 * One event as a card: a dot and a bold label (what it is, or the status it
 * set), when, then the text. Your notes read the same as everything else.
 */
export function FeedCard({ event }: { event: FeedEvent }) {
  const info = useSprintInfo();
  return (
    <article className="grid gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-3">
      <header className="flex items-center gap-2">
        <EventTag event={event} />
        <span className="ml-auto text-[12px] whitespace-nowrap text-faint">{when(event)}</span>
      </header>
      <Markdown text={event.text} className="text-[14px] text-fg" />
      {event.sprintId && info[event.sprintId] && (
        <span className="text-[11.5px] text-faint">{info[event.sprintId]!.label}</span>
      )}
    </article>
  );
}

/** A status change shows the status it set, in its color; anything else, its kind. */
export function EventTag({ event }: { event: FeedEvent }) {
  const { board } = useWorkspace();
  const col = event.status ? colById(board, event.status.col) : undefined;
  const o = col && event.status?.to ? optionOf(col, event.status.to) : undefined;
  return o ? (
    <DotLabel color={colorVar(o.color || colorFor(col!, o.id))}>{optionLabel(o)}</DotLabel>
  ) : (
    <KindTag kind={event.kind} />
  );
}
