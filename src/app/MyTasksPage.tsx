import { statusCol } from '../model/board';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, daysUntil, fmtDate, todayISO } from '../model/dates';
import { eventsOf } from '../model/events';
import { inSprint } from '../model/sprints';
import { deriveTasks, TASK_LABEL, type Task, type TaskKind } from '../model/tasks';
import { norm } from '../model/text';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { TASKS_TABS, type TasksTab } from './route';
import { useSprintInfo } from './sprintLabels';
import { Dropdown, MenuItem, StatusTag, Tabs, ui } from './ui';

const TAB_LABEL: Record<TasksTab, string> = { list: 'Tasks', board: 'Board', calendar: 'Calendar' };
const KINDS: TaskKind[] = ['reply', 'follow-up', 'prep', 'check-in'];
const KIND_COLOR: Record<TaskKind, string> = {
  reply: 'var(--c-pink)',
  'follow-up': 'var(--warn)',
  prep: 'var(--c-teal)',
  'check-in': 'var(--c-violet)',
};
type Due = 'all' | 'late' | 'week';

/**
 * Kitsu's My Tasks, for the hunt (M7): replies you owe, follow-ups, meetings
 * and interviews to prep for, applications gone quiet. Worked out from your
 * data, so they clear themselves once handled. Click one to open its company.
 */
export function MyTasksPage({ tab }: { tab: TasksTab }) {
  const { board, companies, pages, chains, sprints } = useWorkspace();
  const { navigate } = useAppUI();
  const info = useSprintInfo();
  const [query, setQuery] = useState('');
  const [sprintFilter, setSprintFilter] = useState<string | null>(null);
  const [kind, setKind] = useState<TaskKind | null>(null);
  const [due, setDue] = useState<Due>('all');
  const [open, setOpen] = useState<string | null>(null);

  const all = useMemo(
    () => deriveTasks(board, companies, pages, chains, sprints),
    [board, companies, pages, chains, sprints],
  );
  const today = todayISO();
  const tasks = all.filter(
    (t) =>
      (!query || norm(t.title).includes(norm(query))) &&
      (!sprintFilter || inSprint(t.company, sprintFilter)) &&
      (!kind || t.kind === kind) &&
      (due === 'all' || (due === 'late' ? t.due < today : t.due <= addDays(today, 7))),
  );

  const filter = (
    id: string,
    label: string,
    value: string,
    items: [string | null, string][],
    set: (v: string | null) => void,
  ) => (
    <div className="grid gap-1.5">
      <span className={ui.label}>{label}</span>
      <Dropdown
        open={open === id}
        onOpenChange={(o) => setOpen(o ? id : null)}
        ariaLabel={label}
        label={value}
        width={260}
      >
        {items.map(([v, l]) => (
          <MenuItem
            key={l}
            active={l === value}
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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto px-6 pt-4 pb-8">
      <Tabs
        label="My Tasks"
        tabs={TASKS_TABS.map((t) => ({ id: t, label: TAB_LABEL[t] }))}
        current={tab}
        onChange={(t) => navigate({ page: 'tasks', tab: t })}
      />
      <div className={`${ui.block} flex flex-wrap items-end gap-4 px-4 py-3`}>
        <div className="grid gap-1.5">
          <label htmlFor="tasks-search" className={ui.label}>
            Search query
          </label>
          <input
            id="tasks-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company or task"
            className={`${ui.input} w-64`}
          />
        </div>
        {filter(
          'sprint',
          'Sprint',
          sprintFilter ? (info[sprintFilter]?.label ?? 'Sprint') : 'All',
          [
            [null, 'All'],
            ...[...sprints]
              .reverse()
              .map((s): [string, string] => [s.id, info[s.id]?.label ?? s.name]),
          ],
          setSprintFilter,
        )}
        {filter(
          'type',
          'Type',
          kind ? TASK_LABEL[kind] : 'All',
          [[null, 'All'], ...KINDS.map((k): [string, string] => [k, TASK_LABEL[k]])],
          (v) => setKind(v as TaskKind | null),
        )}
        {filter(
          'due',
          'Due date',
          { all: 'All tasks', late: 'Late', week: 'Due this week' }[due],
          [
            ['all', 'All tasks'],
            ['late', 'Late'],
            ['week', 'Due this week'],
          ],
          (v) => setDue((v as Due) ?? 'all'),
        )}
      </div>
      {tab === 'list' && <TaskTable tasks={tasks} />}
      {tab === 'board' && <TaskBoard tasks={tasks} />}
      {tab === 'calendar' && <TaskCalendar tasks={tasks} />}
    </div>
  );
}

function KindLabel({ kind }: { kind: TaskKind }) {
  return (
    <span
      className="inline-flex rounded-sm border-l-[3px] bg-surface-2 px-2 py-0.5 text-[13px] font-bold whitespace-nowrap"
      style={{ borderLeftColor: KIND_COLOR[kind] }}
    >
      {TASK_LABEL[kind]}
    </span>
  );
}

function DueText({ due }: { due: string }) {
  const d = daysUntil(due);
  const tone =
    d < 0
      ? 'text-[var(--c-red)] font-bold'
      : d === 0
        ? 'text-[var(--warn)] font-bold'
        : 'text-muted';
  return (
    <span className={tone}>
      {fmtDate(due)}
      {d < 0 ? ` · ${-d}d late` : d === 0 ? ' · today' : ''}
    </span>
  );
}

function TaskTable({ tasks }: { tasks: Task[] }) {
  const { board, pages } = useWorkspace();
  const { showCompany, selected } = useAppUI();
  const info = useSprintInfo();
  if (!tasks.length)
    return (
      <div
        className={`${ui.block} grid place-items-center gap-2 px-6 py-16 text-center text-muted`}
      >
        <span className="text-[40px]" aria-hidden="true">
          🏖️
        </span>
        Nothing needs you right now.
      </div>
    );
  return (
    <div className={`${ui.block} overflow-x-auto`}>
      <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            {['Sprint', 'Type', 'Task', 'Due date', 'Status', 'Last comment'].map((h) => (
              <th key={h} className="eyebrow border-b border-line px-3 py-3 text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const last = eventsOf(pages[t.company.id]).find((e) => e.kind === 'comment');
            return (
              <tr
                key={t.id}
                onClick={() => showCompany(t.company.id)}
                aria-selected={selected === t.company.id}
                className="cursor-pointer transition-colors hover:bg-hover aria-selected:bg-selected/40"
              >
                <td className="border-b border-line px-3 py-3 text-[13px] text-muted">
                  {t.sprintId ? (info[t.sprintId]?.label ?? '') : '—'}
                </td>
                <td className="border-b border-line px-3 py-3">
                  <KindLabel kind={t.kind} />
                </td>
                <td className="border-b border-line px-3 py-3 font-bold text-strong">{t.title}</td>
                <td className="border-b border-line px-3 py-3 text-[13.5px]">
                  <DueText due={t.due} />
                </td>
                <td className="border-b border-line px-3 py-3">
                  <StatusTag col={statusCol(board)} value={t.status} />
                </td>
                <td className="max-w-72 truncate border-b border-line px-3 py-3 text-[13px] text-muted">
                  {last?.text ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const { board } = useWorkspace();
  const { showCompany } = useAppUI();
  return (
    <button
      type="button"
      onClick={() => showCompany(task.company.id)}
      className="grid gap-2 rounded-[10px] bg-surface p-3 text-left transition-colors hover:bg-hover"
    >
      <b className="text-[14px] text-strong">{task.title}</b>
      <span className="flex items-center justify-between gap-2 text-[12.5px]">
        <DueText due={task.due} />
        <StatusTag col={statusCol(board)} value={task.status} />
      </span>
    </button>
  );
}

function TaskBoard({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KINDS.map((k) => {
        const list = tasks.filter((t) => t.kind === k);
        return (
          <div
            key={k}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-[10px] bg-surface-2 p-2.5"
          >
            <div className="flex items-center justify-between px-1">
              <KindLabel kind={k} />
              <span className="text-[13px] text-muted">{list.length}</span>
            </div>
            {list.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
            {!list.length && (
              <p className="m-0 px-1 py-4 text-center text-[13px] text-faint">Nothing</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskCalendar({ tasks }: { tasks: Task[] }) {
  const { showCompany } = useAppUI();
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(y, m - 1, 1);
  // Weeks start on Monday, like Kitsu's calendar.
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? `${month}-${String(d).padStart(2, '0')}` : null;
  });
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className={`${ui.block} p-4`}>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => setMonth(today.slice(0, 7))} className={ui.button}>
          Today
        </button>
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className={ui.ghostIcon}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className={ui.ghostIcon}
        >
          <ChevronRight size={18} />
        </button>
        <b className="text-[18px] text-strong">
          {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </b>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="eyebrow border-b border-line px-2 py-1.5 text-muted">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`min-h-24 border-b border-l border-line p-1.5 ${day === today ? 'bg-selected/25' : ''}`}
          >
            {day && <div className="mb-1 text-[12px] text-muted">{Number(day.slice(8))}</div>}
            {day &&
              tasks
                .filter((t) => t.due === day)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => showCompany(t.company.id)}
                    className="mb-1 block w-full truncate rounded border-l-[3px] bg-surface-2 px-1.5 py-0.5 text-left text-[12px] text-fg hover:bg-hover"
                    style={{ borderLeftColor: KIND_COLOR[t.kind] }}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
          </div>
        ))}
      </div>
    </div>
  );
}
