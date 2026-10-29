import { Bot, Calendar, Mail, UserRound } from 'lucide-react';
import { colById } from '../model/board';
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
  const color = { you: '#a7d930', ai: '#7375bc', gmail: '#e8459a', calendar: '#3273dc' }[by];
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
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-[#202225]"
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
    <span
      className="inline-flex items-center rounded-sm border-l-[3px] bg-surface-2 px-2 py-0.5 text-[12.5px] font-bold text-fg"
      style={{ borderLeftColor: KIND_COLOR[kind] }}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

/** "Today 14:05", "Oct 22 09:10". */
export function when(e: FeedEvent) {
  const day = dayOf(e);
  return `${day === todayISO() ? 'Today' : fmtDate(day)} ${timeOf(e)}`.trim();
}

/** One event as a Kitsu comment card: status tag (if it set one), who, when, text. */
export function FeedCard({ event }: { event: FeedEvent }) {
  const { board } = useWorkspace();
  const info = useSprintInfo();
  const col = event.status ? colById(board, event.status.col) : undefined;
  return (
    <article className="grid gap-2 rounded-[10px] bg-surface px-3.5 py-3">
      <header className="flex items-center gap-2.5">
        {col ? <StatusTag col={col} value={event.status!.to} /> : <KindTag kind={event.kind} />}
        <ByBadge by={event.by} size={24} />
        <b className="text-[14px] text-strong">{BY_LABEL[event.by]}</b>
        <span className="ml-auto text-[12px] whitespace-nowrap text-muted">{when(event)}</span>
      </header>
      <p className="m-0 text-[14px] whitespace-pre-wrap text-fg">{event.text}</p>
      {event.sprintId && info[event.sprintId] && (
        <span className="text-[11.5px] text-faint">{info[event.sprintId]!.label}</span>
      )}
    </article>
  );
}
