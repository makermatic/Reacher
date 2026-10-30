/**
 * My Tasks (M7), like Kitsu's: what needs you now. Worked out from the data,
 * never stored, so a task goes away once it's handled (you reply, the
 * follow-up moves, the meeting passes).
 */
import { addDays, todayISO } from './dates';
import { eventsOf } from './events';
import { checkInDue, stageById } from './stages';
import { inView, sprintsOf } from './sprints';
import type { Board, Chain, Company, Page, Sprint } from './types';

export type TaskKind = 'reply' | 'follow-up' | 'prep' | 'check-in';

export type Task = {
  id: string;
  kind: TaskKind;
  company: Company;
  /** The sprint it belongs to (the company's newest), if any. */
  sprintId: string | null;
  /** The stage it's about, if any (Reply in Outreach...). */
  stage: string | null;
  /** YYYY-MM-DD it's due. */
  due: string;
  title: string;
  /** That stage's status, for the chip. */
  status: string | null;
};

export const TASK_LABEL: Record<TaskKind, string> = {
  reply: 'Reply',
  'follow-up': 'Follow up',
  prep: 'Prep',
  'check-in': 'Check in',
};

/** How far ahead meetings show up to prep for. */
const PREP_DAYS = 14;

export function deriveTasks(
  board: Board,
  companies: Company[],
  pages: Record<string, Page>,
  chains: Chain[],
  sprints: Sprint[],
  today = todayISO(),
): Task[] {
  const tasks: Task[] = [];
  for (const raw of companies) {
    const sprintId = sprintsOf(raw, sprints).at(-1)?.id ?? null;
    const c = inView(raw, sprintId);
    const stages = c.stages ?? {};
    const page = pages[c.id];
    const base = { company: raw, sprintId };

    // Every stage at Reply: you owe them an answer.
    const lastIn = chains
      .filter((ch) => ch.companyId === c.id)
      .flatMap((ch) => ch.messages.filter((m) => m.dir === 'in').map((m) => m.date))
      .sort()
      .at(-1);
    for (const s of board.stages)
      if (stages[s.id] === 'reply')
        tasks.push({
          ...base,
          id: `reply:${c.id}:${s.id}`,
          kind: 'reply',
          stage: s.id,
          status: 'reply',
          due: lastIn ?? today,
          title: `Reply to ${c.name} (${s.name})`,
        });

    if (c.due && !Object.values(stages).includes('reply'))
      tasks.push({
        ...base,
        id: `follow:${c.id}`,
        kind: 'follow-up',
        stage: null,
        status: null,
        due: c.due,
        title: `Follow up with ${c.name}`,
      });

    for (const m of page?.meetings ?? [])
      if (m.date >= today && m.date <= addDays(today, PREP_DAYS)) {
        const stage = m.kind === 'interview' ? 'interview' : 'meeting';
        tasks.push({
          ...base,
          id: `prep:${c.id}:${m.id}`,
          kind: 'prep',
          stage: stageById(board, stage) ? stage : null,
          status: stages[stage] ?? null,
          due: m.date,
          title: `Prep for ${m.kind === 'interview' ? 'interview' : 'meeting'} with ${c.name}${m.start ? ` at ${m.start}` : ''}`,
        });
      }

    if (stages.application === 'sent') {
      const last = eventsOf(page)[0]?.at.slice(0, 10) ?? page?.applications.at(-1)?.date;
      if (last && checkInDue(last) <= today)
        tasks.push({
          ...base,
          id: `checkin:${c.id}`,
          kind: 'check-in',
          stage: 'application',
          status: 'sent',
          due: checkInDue(last),
          title: `Check in on your application at ${c.name}`,
        });
    }
  }
  return tasks.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}
