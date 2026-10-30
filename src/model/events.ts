/**
 * The feed (M7): every comment, status change, email, meeting and AI change
 * is an event on its company's page. The side panel, the company timeline and
 * the News Feed all read these. Notes from before M7 show as comments.
 */
import { stageById, statusLabel } from './stages';
import { uid } from './text';
import type { Board, Company, EventBy, EventKind, FeedEvent, Page } from './types';

export const nowISO = () => new Date().toISOString();

export function makeEvent(
  kind: EventKind,
  text: string,
  by: EventBy,
  extra: Partial<Pick<FeedEvent, 'sprintId' | 'status' | 'at'>> = {},
): FeedEvent {
  return { id: uid('ev'), at: extra.at ?? nowISO(), kind, text, by, ...extra };
}

/** A company's events, newest first, with old notes as comments. */
export function eventsOf(page: Page | undefined): FeedEvent[] {
  if (!page) return [];
  const events = page.events ?? [];
  const known = new Set(events.map((e) => e.id));
  const notes = (page.notes ?? [])
    .filter((n) => !known.has(n.id))
    .map((n): FeedEvent => ({
      id: n.id,
      at: `${n.date}T12:00:00`,
      kind: 'comment',
      text: n.text,
      by: 'you',
    }));
  return [...events, ...notes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Every company's events, newest first: the News Feed. */
export function allEvents(companies: Company[], pages: Record<string, Page>) {
  return companies
    .flatMap((company) => eventsOf(pages[company.id]).map((event) => ({ event, company })))
    .sort((a, b) => (a.event.at < b.event.at ? 1 : a.event.at > b.event.at ? -1 : 0));
}

/** "Outreach: Sent → Reply" */
export function stageText(board: Board, stageId: string, from: unknown, to: unknown) {
  const label = (v: unknown) => statusLabel(board, v) || 'none';
  return `${stageById(board, stageId)?.name ?? stageId}: ${label(from)} → ${label(to)}`;
}

/** The event's day, YYYY-MM-DD (local). */
export function dayOf(e: FeedEvent) {
  const d = new Date(e.at);
  if (Number.isNaN(d.getTime())) return e.at.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "14:05" */
export function timeOf(e: FeedEvent) {
  const d = new Date(e.at);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const BY_LABEL: Record<EventBy, string> = {
  you: 'You',
  ai: 'AI',
  gmail: 'Gmail',
  calendar: 'Calendar',
};

export const KIND_LABEL: Record<EventKind, string> = {
  comment: 'Comment',
  status: 'Status',
  email: 'Email',
  meeting: 'Meeting',
  application: 'Application',
  field: 'Details',
  company: 'Company',
  sprint: 'Sprint',
};
