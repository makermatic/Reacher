/**
 * Stages (M7), the way Kitsu tracks task types: each company has a status in
 * every stage (Outreach, Meeting, Application, Interview), each shown as a
 * colored column. Statuses are shared by all stages. A company keeps separate
 * stage statuses per sprint; `company.stages` is the latest of them.
 */
import { addDays, todayISO } from './dates';
import type {
  Board,
  Column,
  Company,
  LegacyBoard,
  Meeting,
  Page,
  Stage,
  StageStatus,
  StatusOption,
  Suggest,
} from './types';

export const DEFAULT_STAGES: Stage[] = [
  { id: 'outreach', name: 'Outreach', color: 'teal' },
  { id: 'meeting', name: 'Meeting', color: 'amber' },
  { id: 'application', name: 'Application', color: 'blue' },
  { id: 'interview', name: 'Interview', color: 'violet' },
];

export const DEFAULT_STATUSES: StageStatus[] = [
  { id: 'todo', label: 'To do', color: 'grey', meaning: 'not started yet' },
  { id: 'sent', label: 'Sent', color: 'blue', meaning: 'done my part; waiting on them' },
  { id: 'reply', label: 'Reply', color: 'pink', meaning: 'they answered or reached out; my move' },
  { id: 'scheduled', label: 'Scheduled', color: 'violet', meaning: 'on the calendar' },
  { id: 'done', label: 'Done', color: 'green', meaning: 'finished' },
  { id: 'no', label: 'No', color: 'red', meaning: 'turned down, not a fit, or closed' },
];

/** The prototype's template suggestions, per stage and status. */
export const DEFAULT_SUGGEST: Suggest[] = [
  { stage: 'outreach', status: 'todo', tpl: 'tpl-intro' },
  { stage: 'outreach', status: 'sent', tpl: 'tpl-check' },
  { stage: 'meeting', status: 'done', tpl: 'tpl-thanks' },
  { stage: 'application', status: 'sent', tpl: 'tpl-app' },
  { stage: 'interview', status: 'done', tpl: 'tpl-thanks' },
];

export const stageById = (board: Board, id: string) => board.stages.find((s) => s.id === id);
export const statusById = (board: Board, id: unknown) => board.statuses.find((s) => s.id === id);
export const statusLabel = (board: Board, id: unknown) =>
  (statusById(board, id)?.label ?? (id ? String(id) : '')) || '';

/** A company's stage statuses, as seen from a sprint (or the latest, from All). */
export function stagesIn(c: Company, sprintId: string | null): Record<string, string | null> {
  const e = sprintId ? c.sprints?.[sprintId] : null;
  return e ? { ...e.stages } : { ...(c.stages ?? {}) };
}

/** The furthest stage that's still going (not empty, Done or No), else the first stage. */
export function activeStage(board: Board, stages: Record<string, string | null>) {
  const going = [...board.stages]
    .reverse()
    .find((s) => stages[s.id] && stages[s.id] !== 'done' && stages[s.id] !== 'no');
  return going?.id ?? board.stages[0]?.id ?? null;
}

/** Things that happen to a company that can move a stage, like Kitsu's status automations. */
export type StageEvent =
  | { kind: 'sent' }
  | { kind: 'received' }
  | { kind: 'applied' }
  | { kind: 'meeting'; meetingKind: Meeting['kind']; date: string };

/**
 * Which stages an event moves, and to what (only stages and statuses this
 * board has):
 * - Email from them: the active stage → Reply (your move).
 * - Email I sent: a stage at Reply → Sent; else Outreach (not started) → Sent.
 * - Application: Application (not started) → Sent.
 * - Meeting: Meeting → Scheduled (upcoming) or Done; Outreach waiting → Done.
 * - Interview: Interview → Scheduled or Done; Application at Sent → Done.
 */
export function stageMoves(
  board: Board,
  stages: Record<string, string | null>,
  event: StageEvent,
  today = todayISO(),
): Record<string, string> {
  const hasStage = (id: string) => !!stageById(board, id);
  const hasStatus = (id: string) => !!statusById(board, id);
  const moves: Record<string, string> = {};
  const set = (stage: string, status: string) => {
    if (hasStage(stage) && hasStatus(status) && stages[stage] !== status) moves[stage] = status;
  };
  const fresh = (stage: string) => !stages[stage] || stages[stage] === 'todo';
  switch (event.kind) {
    case 'received': {
      const a = activeStage(board, stages);
      if (a) set(a, 'reply');
      break;
    }
    case 'sent': {
      const waiting = board.stages.filter((s) => stages[s.id] === 'reply');
      if (waiting.length) waiting.forEach((s) => set(s.id, 'sent'));
      else if (fresh('outreach')) set('outreach', 'sent');
      break;
    }
    case 'applied':
      if (fresh('application')) set('application', 'sent');
      break;
    case 'meeting': {
      const when = event.date >= today ? 'scheduled' : 'done';
      if (event.meetingKind === 'interview') {
        set('interview', when);
        if (stages.application === 'sent') set('application', 'done');
      } else {
        set('meeting', when);
        if (stages.outreach === 'sent' || stages.outreach === 'reply') set('outreach', 'done');
      }
      break;
    }
  }
  return moves;
}

/**
 * A stage status change as a store patch: into the sprint's entry (when the
 * company is in it) and into the company's latest stages.
 */
export function stagePatch(
  c: Company,
  sprintId: string | null,
  moves: Record<string, string | null>,
  today = todayISO(),
) {
  const patch: Record<string, unknown> = { stages: { ...moves } };
  if (sprintId && c.sprints?.[sprintId])
    patch.sprints = { [sprintId]: { stages: { ...moves }, updated: today } };
  return patch;
}

/** The template to suggest for a company: for its active stage's status. */
export function suggestedTemplate(board: Board, stages: Record<string, string | null>) {
  const a = activeStage(board, stages);
  const status = (a && stages[a]) || 'todo';
  return board.suggest.find((s) => s.stage === a && s.status === status)?.tpl ?? '';
}

/** Needs you: some stage is at Reply. */
export const yourMove = (stages: Record<string, string | null>) =>
  Object.values(stages).includes('reply');

// ---------- moving data from before M7 ----------

const OLD_TO_STAGES: Record<string, Record<string, string>> = {
  gathering: { outreach: 'todo' },
  reached: { outreach: 'sent' },
  wroteback: { outreach: 'reply' },
  replied: { outreach: 'sent' },
  meeting: { outreach: 'done', meeting: 'done' },
  applied: { application: 'sent' },
  rejected: { application: 'no' },
  interview: { application: 'done', interview: 'done' },
};

/**
 * A board from before M7 → version 3: Status becomes the stages (the default
 * four), Outcome becomes a plain list field, other fields stay as they were.
 */
export function migrateBoard(old: LegacyBoard): Board {
  const outcome = old.columns.find((c) => c.id === 'outcome');
  const columns: Column[] = old.columns.filter((c) => c.type !== 'status').map((c) => ({ ...c }));
  if (outcome)
    columns.unshift({
      id: 'outcome',
      name: outcome.name,
      type: 'values',
      onSheet: outcome.onSheet,
      options: (outcome.options ?? []).map((o) => (typeof o === 'string' ? o : o.label)),
    });
  const status = old.columns.find((c) => c.id === 'status');
  const tplOf = (id: string) =>
    (status?.options ?? []).find((o): o is StatusOption => typeof o !== 'string' && o.id === id)
      ?.tpl ?? '';
  // Keep the user's own template picks where the old status maps to one stage status.
  const suggest = DEFAULT_SUGGEST.map((s) => {
    const old = Object.entries(OLD_TO_STAGES).find(
      ([, m]) => Object.keys(m).length === 1 && m[s.stage] === s.status,
    )?.[0];
    const tpl = old ? tplOf(old) : '';
    return tpl ? { ...s, tpl } : s;
  });
  return {
    version: 3,
    columns,
    stages: DEFAULT_STAGES,
    statuses: DEFAULT_STATUSES,
    suggest,
  };
}

/**
 * A company from before M7: its Status becomes stage statuses (an upcoming
 * meeting or interview shows as Scheduled), its Outcome a plain value.
 */
export function migrateCompany(old: LegacyBoard, c: Company, page?: Page, today = todayISO()) {
  const status = String(c.meta?.status ?? '');
  const stages: Record<string, string> = { ...(OLD_TO_STAGES[status] ?? {}) };
  for (const m of page?.meetings ?? []) {
    if (m.date < today) continue;
    if (m.kind === 'interview') stages.interview = 'scheduled';
    else if (!stages.meeting || stages.meeting === 'done') stages.meeting = 'scheduled';
  }
  const meta: Record<string, unknown> = { ...c.meta };
  delete meta.status;
  const outcomeCol = old.columns.find((x) => x.id === 'outcome');
  if (meta.outcome != null && outcomeCol) {
    const o = (outcomeCol.options ?? []).find(
      (x): x is StatusOption => typeof x !== 'string' && x.id === meta.outcome,
    );
    meta.outcome = o?.label ?? meta.outcome;
  }
  return { ...c, meta, stages };
}

/** Whether a stored board is from before M7. */
export const isLegacyBoard = (b: unknown): b is LegacyBoard =>
  !!b && typeof b === 'object' && (b as { version?: unknown }).version === 2;

/** A quiet application: Sent for this long gets a check-in task. */
export const CHECK_IN_DAYS = 14;
export const checkInDue = (since: string) => addDays(since, CHECK_IN_DAYS);
