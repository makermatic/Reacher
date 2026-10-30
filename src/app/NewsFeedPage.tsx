import { useMemo, useState } from 'react';
import { allEvents, BY_LABEL, dayOf, KIND_LABEL, timeOf } from '../model/events';
import type { EventBy, EventKind } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { ByBadge, KindTag, StageTag } from './Feed';
import { useSprintInfo } from './sprintLabels';
import { Dropdown, MenuItem, StageName, StatusTag, ui } from './ui';

/**
 * The News Feed (M7), like Kitsu's: everything that happened, newest first,
 * grouped by day. Follows the sprint in the top bar. Click a line to open its
 * company in the side panel.
 */
export function NewsFeedPage() {
  const { board, companies, pages, sprint } = useWorkspace();
  const { select, selected } = useAppUI();
  const info = useSprintInfo();
  const [kind, setKind] = useState<EventKind | null>(null);
  const [by, setBy] = useState<EventBy | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const events = useMemo(
    () =>
      allEvents(companies, pages).filter(
        ({ event: e, company: c }) =>
          (!sprint || e.sprintId === sprint || (!e.sprintId && c.sprints?.[sprint])) &&
          (!kind || e.kind === kind) &&
          (!by || e.by === by) &&
          (!stage || e.status?.stage === stage) &&
          (!status || e.status?.to === status),
      ),
    [companies, pages, sprint, kind, by, stage, status],
  );
  const days: { day: string; items: typeof events }[] = [];
  for (const item of events) {
    const day = dayOf(item.event);
    if (days.at(-1)?.day !== day) days.push({ day, items: [] });
    days.at(-1)!.items.push(item);
  }

  const filter = <T extends string>(
    id: string,
    label: string,
    value: T | null,
    items: [T, React.ReactNode][],
    set: (v: T | null) => void,
  ) => (
    <div className="grid gap-1">
      <span className={ui.label}>{label}</span>
      <Dropdown
        open={open === id}
        onOpenChange={(o) => setOpen(o ? id : null)}
        ariaLabel={label}
        label={value ? items.find((x) => x[0] === value)?.[1] : 'All'}
        width={220}
      >
        <MenuItem
          active={!value}
          onSelect={() => {
            set(null);
            setOpen(null);
          }}
        >
          All
        </MenuItem>
        {items.map(([v, l]) => (
          <MenuItem
            key={v}
            active={v === value}
            onSelect={() => {
              set(v);
              setOpen(null);
            }}
          >
            {l}
          </MenuItem>
        ))}
      </Dropdown>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-6 pt-5 pb-10">
      <div className="mx-auto grid max-w-[900px] gap-5">
        <div className="flex flex-wrap items-end gap-3">
          {filter(
            'kind',
            'Type',
            kind,
            (Object.keys(KIND_LABEL) as EventKind[]).map((k): [EventKind, string] => [
              k,
              KIND_LABEL[k],
            ]),
            setKind,
          )}
          {filter(
            'stage',
            'Stage',
            stage,
            board.stages.map((s): [string, React.ReactNode] => [
              s.id,
              <StageName key={s.id} name={s.name} color={s.color} />,
            ]),
            setStage,
          )}
          {filter(
            'status',
            'Status',
            status,
            board.statuses.map((s): [string, React.ReactNode] => [
              s.id,
              <StatusTag key={s.id} board={board} value={s.id} />,
            ]),
            setStatus,
          )}
          {filter(
            'by',
            'Who',
            by,
            (Object.keys(BY_LABEL) as EventBy[]).map((b): [EventBy, string] => [b, BY_LABEL[b]]),
            setBy,
          )}
          <span className="ml-auto text-[13px] text-muted">
            {sprint && info[sprint] ? info[sprint]!.label : 'All companies'}
          </span>
        </div>

        {!days.length && <p className="mt-8 text-center text-muted">There is no news yet.</p>}
        {days.map(({ day, items }) => (
          <section key={day} className="grid gap-1.5">
            <h2 className="m-0 text-[13px] font-semibold text-muted">
              {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h2>
            <ol className="m-0 grid list-none overflow-hidden rounded-xl border border-line bg-surface p-0">
              {items.map(({ event: e, company: c }) => (
                <li key={e.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => select({ id: c.id, stage: e.status?.stage ?? null })}
                    aria-current={selected.some((x) => x.id === c.id) || undefined}
                    className="grid w-full grid-cols-[44px_26px_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-hover aria-[current]:bg-selected"
                  >
                    <span className="text-[12px] text-faint">{timeOf(e)}</span>
                    <ByBadge by={e.by} size={26} />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <b className="text-[14px] text-strong">{c.name}</b>
                        {e.status ? (
                          <>
                            <StageTag stage={e.status.stage} />
                            <StatusTag board={board} value={e.status.to} />
                          </>
                        ) : (
                          <KindTag kind={e.kind} />
                        )}
                        {e.sprintId && info[e.sprintId] && !sprint && (
                          <span className="text-[12px] text-faint">{info[e.sprintId]!.label}</span>
                        )}
                      </span>
                      <span className="block truncate text-[13px] text-muted">{e.text}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
