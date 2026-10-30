/**
 * My Tasks (M7), like Kitsu's: what needs you now. Worked out from the data,
 * never stored, so a task goes away once it's handled (you reply, the
 * follow-up moves, the meeting passes).
 */
import { meta, optionOf, statusCol } from './board';
import { addDays, todayISO } from './dates';
import { eventsOf } from './events';
import { inView, sprintsOf } from './sprints';
import type { Board, Chain, Company, Page, Sprint } from './types';

export type TaskKind = 'reply' | 'follow-up' | 'prep' | 'check-in';

export type Task = {
  id: string;
  kind: TaskKind;
  company: Company;
  /** The sprint it belongs to (the company's newest), if any. */
  sprintId: string | null;
  /** YYYY-MM-DD it's due. */
  due: string;
  title: string;
  /** The status it's about (option id), for the chip. */
  status: string | null;
};

export const TASK_LABEL: Record<TaskKind, string> = {
  reply: 'Reply',
  'follow-up': 'Follow up',
  prep: 'Prep',
  'check-in': 'Check in',
};

/** How far ahead meetings show up to prep for, and how long an application waits before a check-in. */
const PREP_DAYS = 14;
const QUIET_APPLICATION_DAYS = 14;

export function deriveTasks(
  board: Board,
  companies: Company[],
  pages: Record<string, Page>,
  chains: Chain[],
  sprints: Sprint[],
  today = todayISO(),
): Task[] {
  const tasks: Task[] = [];
  const sc = statusCol(board);
  for (const c of companies) {
    const sprintId = sprintsOf(c, sprints).at(-1)?.id ?? null;
    const status = String(meta(inView(c, sprintId), 'status') ?? '') || null;
    const base = { company: c, sprintId, status };
    const label = optionOf(sc, status)?.label;

    if (status === 'wroteback') {
      const lastIn = chains
        .filter((ch) => ch.companyId === c.id)
        .flatMap((ch) => ch.messages.filter((m) => m.dir === 'in').map((m) => m.date))
        .sort()
        .at(-1);
      tasks.push({
        ...base,
        id: `reply:${c.id}`,
        kind: 'reply',
        due: lastIn ?? today,
        title: `Reply to ${c.name}`,
      });
    }

    if (c.due && status !== 'wroteback')
      tasks.push({
        ...base,
        id: `follow:${c.id}`,
        kind: 'follow-up',
        due: c.due,
        title: `Follow up with ${c.name}`,
      });

    const page = pages[c.id];
    for (const m of page?.meetings ?? [])
      if (m.date >= today && m.date <= addDays(today, PREP_DAYS))
        tasks.push({
          ...base,
          id: `prep:${c.id}:${m.id}`,
          kind: 'prep',
          due: m.date,
          title: `Prep for ${m.kind === 'interview' ? 'interview' : 'meeting'} with ${c.name}${m.start ? ` at ${m.start}` : ''}`,
        });

    if (status === 'applied') {
      const last = eventsOf(page)[0]?.at.slice(0, 10) ?? page?.applications.at(-1)?.date;
      if (last && addDays(last, QUIET_APPLICATION_DAYS) <= today)
        tasks.push({
          ...base,
          id: `checkin:${c.id}`,
          kind: 'check-in',
          due: addDays(last, QUIET_APPLICATION_DAYS),
          title: `Check in on your ${label ?? 'application'} at ${c.name}`,
        });
    }
  }
  return tasks.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}
