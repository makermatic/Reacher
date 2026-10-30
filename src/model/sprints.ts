/**
 * Sprints (M7): blocks of time to organize the hunt, like sequences in Kitsu.
 * A company can be in any number of sprints and keeps a separate status in
 * each (Zack, 2026-10-29). Its `meta` holds the latest status from any of
 * them, which "All companies" shows.
 */
import { metaPatch } from './board';
import { addDays, daysUntil, isISODate, todayISO } from './dates';
import { uid } from './text';
import type { Board, Company, FeedEvent, Page, Sprint, SprintEntry } from './types';

/** Two weeks without activity, or a newer sprint, ends a sprint. */
export const QUIET_DAYS = 14;

/** "10/29/26". */
export function shortDate(iso: string) {
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${m}/${d}/${String(y).slice(2)}`;
}

export function newSprint(name: string, order: number, today = todayISO()): Sprint {
  return { id: uid('sp'), name: name.trim() || 'Sprint', start: today, end: null, order };
}

/** Oldest first. */
export const bySprintStart = (a: Sprint, b: Sprint) =>
  a.start < b.start ? -1 : a.start > b.start ? 1 : a.order - b.order;

/** The company's entry in a sprint, if it's in it. */
export const entryOf = (c: Company, sprintId: string): SprintEntry | null =>
  c.sprints?.[sprintId] ?? null;

export const inSprint = (c: Company, sprintId: string) => !!entryOf(c, sprintId);

/** The sprints a company is in, oldest first. */
export const sprintsOf = (c: Company, sprints: Sprint[]) =>
  sprints.filter((s) => inSprint(c, s.id)).sort(bySprintStart);

/**
 * Where a change to a company lands: the sprint you're looking at if the
 * company is in it, else the newest sprint it's in, else none.
 */
export function targetSprint(c: Company, sprints: Sprint[], active: string | null) {
  if (active && inSprint(c, active)) return active;
  return sprintsOf(c, sprints).at(-1)?.id ?? null;
}

/**
 * The company as seen from a sprint: its status columns from that sprint.
 * From "All companies" (null) it's the company as stored (the latest status).
 */
export function inView(c: Company, sprintId: string | null): Company {
  if (!sprintId) return c;
  const e = entryOf(c, sprintId);
  return e ? { ...c, meta: { ...c.meta, ...e.meta } } : c;
}

/**
 * One status-column change: into the sprint's entry (when there is one) and
 * into the company's latest status, clearing dependent columns (like Outcome)
 * in both. Returns the store patch.
 */
export function statusPatch(
  board: Board,
  c: Company,
  sprintId: string | null,
  colId: string,
  value: unknown,
  today = todayISO(),
) {
  const overall = metaPatch(board, c, colId, value);
  if (!sprintId || !inSprint(c, sprintId)) return overall;
  const inSprintView = metaPatch(board, inView(c, sprintId), colId, value);
  return {
    ...overall,
    sprints: { [sprintId]: { meta: inSprintView.meta, updated: today } },
  };
}

/** Adds a company to a sprint, starting from its current statuses. */
export function joinPatch(board: Board, c: Company, sprintId: string, today = todayISO()) {
  const statusCols = board.columns.filter((col) => col.type === 'status').map((col) => col.id);
  const meta = Object.fromEntries(
    statusCols.filter((id) => c.meta?.[id] != null).map((id) => [id, c.meta[id]]),
  );
  return { sprints: { [sprintId]: { meta, added: today, updated: today } } };
}

/** The latest day anything happened in a sprint (at least its start). */
export function lastActivity(s: Sprint, companies: Company[], pages: Record<string, Page>) {
  let last = s.start;
  for (const c of companies) {
    const e = entryOf(c, s.id);
    if (e?.updated && e.updated > last) last = e.updated;
    for (const ev of pages[c.id]?.events ?? []) {
      const day = ev.at.slice(0, 10);
      if (ev.sprintId === s.id && day > last) last = day;
    }
  }
  return last;
}

export type SprintState = {
  /** Over: ended by hand, a newer sprint exists, or two quiet weeks. */
  over: boolean;
  /** The end date shown once it's over. */
  end: string | null;
  last: string;
};

export function sprintState(
  s: Sprint,
  all: Sprint[],
  companies: Company[],
  pages: Record<string, Page>,
  today = todayISO(),
): SprintState {
  const last = lastActivity(s, companies, pages);
  const newer = all.some((x) => x.id !== s.id && bySprintStart(x, s) > 0);
  const quiet = -daysUntil(last, new Date(`${today}T12:00:00`)) > QUIET_DAYS;
  const over = !!s.end || newer || quiet;
  return { over, end: s.end || (over ? last : null), last };
}

/** "First Light 10/29/26", or "First Light 10/29/26 - 11/15/26" once it's over. */
export function sprintLabel(s: Sprint, state?: Pick<SprintState, 'end'>) {
  const end = state?.end && state.end !== s.start ? ` - ${shortDate(state.end)}` : '';
  return `${s.name} ${shortDate(s.start)}${end}`;
}

/** The sprint to show by default: the newest one. */
export const newestSprint = (sprints: Sprint[]) => [...sprints].sort(bySprintStart).at(-1) ?? null;

/** Feed events from a sprint (for its own timeline). */
export const eventsIn = (events: FeedEvent[], sprintId: string) =>
  events.filter((e) => e.sprintId === sprintId);

/** The day a quiet sprint will close on its own. */
export const quietEnd = (last: string) => addDays(last, QUIET_DAYS);

/**
 * After a change written to the company's latest status (a quick update),
 * copies the status columns that moved into its entry for `sprintId`.
 */
export function mirrorStatus(
  board: Board,
  before: Company | undefined,
  after: Company,
  sprintId: string | null,
  today = todayISO(),
): Company {
  const e = sprintId ? after.sprints?.[sprintId] : null;
  if (!sprintId || !e) return after;
  const moved = board.columns
    .filter((col) => col.type === 'status')
    .map((col) => col.id)
    .filter((id) => (before?.meta?.[id] ?? null) !== (after.meta?.[id] ?? null));
  if (!moved.length) return after;
  const meta = {
    ...e.meta,
    ...Object.fromEntries(moved.map((id) => [id, after.meta[id] ?? null])),
  };
  return { ...after, sprints: { ...after.sprints, [sprintId]: { ...e, meta, updated: today } } };
}
