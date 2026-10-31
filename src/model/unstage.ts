/**
 * For about a day (Reacher Test v12) Reacher stored a status per stage
 * (Outreach, Meeting, Application, Interview) instead of one Status column.
 * Zack asked for one Status column again (2026-10-30). This moves data saved
 * in that shape back, once, the first time it loads or is imported.
 */
import { DEFAULT_BOARD } from './defaults';
import { isPlainObject, norm } from './text';
import type { Board, Column, Company, FeedEvent, SprintEntry } from './types';

type Stages = Record<string, unknown>;

/** A board saved with stages (version 3). */
export const isStagesBoard = (b: unknown): b is { columns: Column[]; stages: unknown[] } =>
  isPlainObject(b) && Array.isArray(b.stages) && Array.isArray(b.columns);

/** The prototype's Status and Outcome columns in front of the fields it had. */
export function unstageBoard(b: { columns: Column[] }): Board {
  const status = DEFAULT_BOARD.columns.find((c) => c.id === 'status')!;
  const outcome = DEFAULT_BOARD.columns.find((c) => c.id === 'outcome')!;
  const columns = b.columns
    .filter((c) => c.id !== 'status')
    .map((c) =>
      c.id === 'outcome' ? { ...outcome, name: c.name, onSheet: c.onSheet !== false } : c,
    );
  if (!columns.some((c) => c.id === 'outcome')) columns.unshift(outcome);
  return { version: 2, columns: [status, ...columns] };
}

const active = (v: unknown) => !!v && v !== 'todo';

/** The one status the stage statuses add up to: the furthest along wins. */
export function statusFromStages(st: Stages): string | null {
  if (active(st.interview)) return st.interview === 'no' ? 'rejected' : 'interview';
  if (active(st.application)) return st.application === 'no' ? 'rejected' : 'applied';
  if (active(st.meeting)) return st.meeting === 'no' ? 'rejected' : 'meeting';
  switch (st.outreach) {
    case 'reply':
      return 'wroteback';
    case 'sent':
      return 'reached';
    case 'done':
    case 'scheduled':
      return 'replied';
    case 'no':
      return 'rejected';
    case 'todo':
      return 'gathering';
  }
  return null;
}

/** Outcome went back to a plain label in v12; find its choice again. */
function outcomeId(board: Board, v: unknown) {
  const col = board.columns.find((c) => c.id === 'outcome');
  const hit = (col?.options ?? []).find(
    (o) => typeof o !== 'string' && (o.id === v || norm(o.label) === norm(v)),
  );
  return hit && typeof hit !== 'string' ? hit.id : v;
}

/** A company saved with stages, back to one Status (also in each sprint). */
export function unstageCompany(board: Board, c: Company): Company {
  const raw = c as Company & { stages?: Stages };
  if (!raw.stages) return c;
  const { stages, ...rest } = raw;
  const meta: Record<string, unknown> = { ...c.meta, status: statusFromStages(stages) };
  if (meta.outcome != null) meta.outcome = outcomeId(board, meta.outcome);
  const sprints: Record<string, SprintEntry | null> = {};
  for (const [id, e] of Object.entries(c.sprints ?? {})) {
    const old = e as (SprintEntry & { stages?: Stages }) | null;
    sprints[id] = old
      ? {
          meta: old.meta ?? { status: statusFromStages(old.stages ?? {}) },
          added: old.added,
          updated: old.updated,
        }
      : null;
  }
  return { ...rest, meta, ...(c.sprints ? { sprints } : {}) };
}

/** A status event saved with a stage shows as plain text (its chip ids were stage ones). */
export const unstageEvent = (e: FeedEvent): FeedEvent => {
  if (!e.status || 'col' in e.status) return e;
  const rest = { ...e };
  delete rest.status;
  return rest;
};
