import { useMemo, useState } from 'react';
import { colById, optList, statusCol } from '../model/board';
import { allEvents, BY_LABEL, dayOf, KIND_LABEL, timeOf } from '../model/events';
import type { EventBy, EventKind } from '../model/types';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { ByBadge, KindTag } from './Feed';
import { useSprintInfo } from './sprintLabels';
import { Dropdown, MenuItem, StatusTag, ui } from './ui';

/**
 * Kitsu's News Feed (M7): everything that happened, newest first, grouped by
 * day on one line. Follows the sprint chosen in the top bar. Click a line to
 * open its company in the side panel.
 */
export function NewsFeedPage() {
  const { board, companies, pages, sprint } = useWorkspace();
  const { select, selected } = useAppUI();
  const info = useSprintInfo();
  const sc = statusCol(board);
  const [kind, setKind] = useState<EventKind | null>(null);
  const [by, setBy] = useState<EventBy | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const events = useMemo(
    () =>
      allEvents(companies, pages).filter(
        ({ event: e, company: c }) =>
          (!sprint || e.sprintId === sprint || (!e.sprintId && c.sprints?.[sprint])) &&
          (!kind || e.kind === kind) &&
          (!by || e.by === by) &&
          (!status || e.status?.to === status),
      ),
    [companies, pages, sprint, kind, by, status],
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
    items: [T, string][],
    set: (v: T | null) => void,
    show: (v: T) => React.ReactNode = (v) => items.find((x) => x[0] === v)?.[1],
  ) => (
    <div className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      <Dropdown
        open={open === id}
        onOpenChange={(o) => setOpen(o ? id : null)}
        ariaLabel={label}
        label={value ? show(value) : 'All'}
        width={240}
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
      <div className={`${ui.block} mx-auto max-w-[920px] px-6 pt-5 pb-8`}>
        <div className="flex flex-wrap items-end gap-4">
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
            'status',
            'Status',
            status,
            optList(sc).map((o): [string, string] => [o.id, o.label]),
            setStatus,
            (v) => (
              <StatusTag col={sc} value={v} />
            ),
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

        {!days.length && <p className="mt-10 text-center text-muted">There is no news yet.</p>}
        {days.map(({ day, items }) => (
          <section key={day} className="relative mt-6 border-l-2 border-selectable pl-6">
            <h2 className="m-0 mb-3 text-center text-[17px] font-normal tracking-[0.12em] text-muted uppercase">
              {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </h2>
            <ol className="m-0 grid list-none gap-1 p-0">
              {items.map(({ event: e, company: c }) => {
                const col = e.status ? colById(board, e.status.col) : undefined;
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute top-4 -left-[31px] size-2.5 rounded-full bg-selectable" />
                    <button
                      type="button"
                      onClick={() => select(c.id, 'only')}
                      aria-current={selected.includes(c.id) || undefined}
                      className="grid w-full grid-cols-[48px_28px_120px_minmax(0,1fr)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover aria-[current]:outline aria-[current]:outline-2 aria-[current]:outline-selectable"
                    >
                      <span className="text-[12px] text-muted">{timeOf(e)}</span>
                      <ByBadge by={e.by} size={26} />
                      <span className="flex">
                        {col ? (
                          <StatusTag col={col} value={e.status!.to} />
                        ) : (
                          <KindTag kind={e.kind} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <b className="text-strong">
                          {e.sprintId && info[e.sprintId] ? (
                            <span className="font-normal text-muted">
                              {info[e.sprintId]!.label} /{' '}
                            </span>
                          ) : null}
                          {c.name}
                        </b>
                        <span className="block truncate text-[13px] text-muted">{e.text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
