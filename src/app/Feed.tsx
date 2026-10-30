import { Bot, Calendar, Mail, UserRound } from 'lucide-react';
import { colById } from '../model/board';
import { Markdown } from '../lib/markdown';
import { BY_LABEL, dayOf, KIND_LABEL, timeOf } from '../model/events';
import { fmtDate, todayISO } from '../model/dates';
import type { EventBy, FeedEvent } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSprintInfo } from './sprintLabels';
import { StatusTag } from './ui';

/** Who made it, as a small round badge. */
export function ByBadge({ by, size = 28 }: { by: EventBy; size?: number }) {
  const { me } = useWorkspace();
  const icon = { you: UserRound, ai: Bot, gmail: Mail, calendar: Calendar }[by];
  const Icon = icon;
  const color = { you: '#3ddc84', ai: '#a78bfa', gmail: '#ff6fb1', calendar: '#4c8dff' }[by];
  const initials =
    by === 'you'
      ? (me?.name || 'You')
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
      : null;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#0d0f12]"
    >
      {initials ?? <Icon size={size * 0.55} />}
    </span>
  );
}

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
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
      <span className="size-1.5 rounded-full" style={{ background: KIND_COLOR[kind] }} />
      {KIND_LABEL[kind]}
    </span>
  );
}

/** "Today 14:05", "Oct 22 09:10". */
export function when(e: FeedEvent) {
  const day = dayOf(e);
  return `${day === todayISO() ? 'Today' : fmtDate(day)} ${timeOf(e)}`.trim();
}

/**
 * One event as a card: what you typed reads like a note (Markdown works);
 * lines from the AI, Gmail or Calendar get a small mark. No names.
 */
export function FeedCard({ event }: { event: FeedEvent }) {
  const info = useSprintInfo();
  const mine = event.by === 'you';
  const tagged = !(mine && event.kind === 'comment');
  return (
    <article
      className={`grid gap-1.5 rounded-xl border px-3.5 py-3 ${
        mine ? 'border-line bg-surface' : 'border-line/70 bg-surface-2/60'
      }`}
    >
      <header className="flex min-h-5 items-center gap-2">
        {!mine && (
          <span title={BY_LABEL[event.by]} className="inline-flex">
            <ByBadge by={event.by} size={18} />
          </span>
        )}
        {tagged && <EventTag event={event} />}
        <span className="ml-auto text-[12px] whitespace-nowrap text-faint">{when(event)}</span>
      </header>
      <Markdown text={event.text} className="text-[14px] text-fg" />
      {event.sprintId && info[event.sprintId] && (
        <span className="text-[11.5px] text-faint">{info[event.sprintId]!.label}</span>
      )}
    </article>
  );
}

/** A status change shows the status it set; anything else, its kind. */
export function EventTag({ event }: { event: FeedEvent }) {
  const { board } = useWorkspace();
  const col = event.status ? colById(board, event.status.col) : undefined;
  return col && event.status?.to ? (
    <StatusTag col={col} value={event.status.to} />
  ) : (
    <KindTag kind={event.kind} />
  );
}
