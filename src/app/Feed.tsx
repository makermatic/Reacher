import { Bot, Calendar, Mail, UserRound } from 'lucide-react';
import { stageById } from '../model/stages';
import { BY_LABEL, dayOf, KIND_LABEL, timeOf } from '../model/events';
import { fmtDate, todayISO } from '../model/dates';
import type { EventBy, FeedEvent } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSprintInfo } from './sprintLabels';
import { colorVar, StatusTag } from './ui';

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

/** One event as a card: what it set (stage and status), who, when, the text. */
export function FeedCard({ event }: { event: FeedEvent }) {
  const { board } = useWorkspace();
  const info = useSprintInfo();

  return (
    <article className="grid gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-3">
      <header className="flex items-center gap-2.5">
        {event.status ? (
          <>
            <StageTag stage={event.status.stage} />
            <StatusTag board={board} value={event.status.to} />
          </>
        ) : (
          <KindTag kind={event.kind} />
        )}
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

/** A stage's name with its color, small (feeds, timelines). */
export function StageTag({ stage }: { stage: string }) {
  const { board } = useWorkspace();
  const s = stageById(board, stage);
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg">
      <span className="size-1.5 rounded-full" style={{ background: colorVar(s.color) }} />
      {s.name}
    </span>
  );
}
