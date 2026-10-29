/**
 * Google Calendar, the data side (M8): meetings → calendar events, and
 * calendar events → which company they're about. No connector calls here;
 * those live in src/runtime/calendar.ts.
 */
import { asPerson, meta } from './board';
import { addDays } from './dates';
import { isPlainObject, norm } from './text';
import type { Board, Company, Meeting } from './types';

/** One calendar event, trimmed to what Reacher uses. */
export type CalEvent = {
  id: string;
  title: string;
  /** YYYY-MM-DD in the calendar's own time zone. */
  date: string;
  /** 24-hour HH:MM, or '' for all-day events. */
  start: string;
  end: string;
  link: string;
  location: string;
  description: string;
  attendees: string[];
};

/** What create_event needs for a meeting. Times are local (no offset), as the connector asks. */
export function eventInput(companyName: string, m: Meeting) {
  const title = `${m.kind === 'interview' ? 'Interview' : 'Meeting'}: ${companyName}`;
  const description = [m.with ? `With ${m.with}` : '', m.notes, 'Added by Reacher']
    .filter(Boolean)
    .join('\n');
  if (!m.start)
    return {
      summary: title,
      description,
      allDay: true,
      startTime: `${m.date}T00:00:00`,
      endTime: `${addDays(m.date, 1)}T00:00:00`,
    };
  const end = m.end || plusMinutes(m.start, 30);
  // An end before the start runs past midnight.
  const endDate = end > m.start ? m.date : addDays(m.date, 1);
  return {
    summary: title,
    description,
    startTime: `${m.date}T${m.start}:00`,
    endTime: `${endDate}T${end}:00`,
  };
}

const plusMinutes = (hhmm: string, add: number) => {
  const [h, min] = hhmm.split(':').map(Number) as [number, number];
  const t = (h * 60 + min + add) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** A connector event: {start: {dateTime | date}, ...} → CalEvent, or null. */
export function toCalEvent(raw: unknown): CalEvent | null {
  if (!isPlainObject(raw) || !raw.id) return null;
  const when = (v: unknown) => {
    if (!isPlainObject(v)) return null;
    const dt = str(v.dateTime);
    if (dt) return { date: dt.slice(0, 10), time: dt.slice(11, 16) };
    const d = str(v.date);
    return d ? { date: d, time: '' } : null;
  };
  const s = when(raw.start);
  if (!s || raw.status === 'cancelled') return null;
  const e = when(raw.end);
  return {
    id: String(raw.id),
    title: str(raw.summary),
    date: s.date,
    start: s.time,
    end: e?.time ?? '',
    link: str(raw.htmlLink),
    location: str(raw.location),
    description: str(raw.description),
    attendees: Array.isArray(raw.attendees)
      ? raw.attendees.map((a) => (isPlainObject(a) ? str(a.email) : '')).filter(Boolean)
      : [],
  };
}

/** The events in a list_events answer ({events: [...]}). */
export const toCalEvents = (payload: unknown): CalEvent[] =>
  (isPlainObject(payload) && Array.isArray(payload.events) ? payload.events : [])
    .map(toCalEvent)
    .filter((e): e is CalEvent => !!e);

/** The id of a created event, wherever the connector put it. */
export function createdId(payload: unknown): { id: string; link: string } | null {
  const ev = isPlainObject(payload) && isPlainObject(payload.event) ? payload.event : payload;
  if (!isPlainObject(ev) || !ev.id) return null;
  return { id: String(ev.id), link: str(ev.htmlLink) };
}

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const SHARED_MAIL = /^(gmail|googlemail|yahoo|hotmail|outlook|icloud|me|aol|proton|protonmail)\./;

/** Web and email domains that identify a company: its website and its contacts' addresses. */
function domainsOf(board: Board, c: Company): string[] {
  const out = new Set<string>();
  for (const col of board.columns) {
    const v = meta(c, col.id);
    if (col.type === 'link' && typeof v === 'string') {
      const host = v
        .replace(/^https?:\/\//, '')
        .split('/')[0]!
        .replace(/^www\./, '');
      if (host.includes('.')) out.add(host.toLowerCase());
    }
    if (col.type === 'person') {
      const p = asPerson(v);
      const d = p?.email.split('@')[1]?.toLowerCase();
      if (d && !SHARED_MAIL.test(d)) out.add(d);
    }
  }
  return [...out];
}

/**
 * Does this event look like it's about this company? Its name in the title
 * (as whole words), or an attendee from its domain. Short names
 * (under 3 letters) only match through attendees.
 */
export function eventMatches(board: Board, c: Company, ev: CalEvent): boolean {
  const name = words(c.name);
  if (name.length >= 3) {
    if (` ${words(ev.title)} `.includes(` ${name} `)) return true;
    // "Loyal Kaspar" for loyalkaspar; long names only, so Buck doesn't match Buckingham.
    if (norm(c.name).length >= 6 && norm(ev.title).includes(norm(c.name))) return true;
  }
  const domains = domainsOf(board, c);
  return ev.attendees.some((a) => {
    const d = a.split('@')[1]?.toLowerCase() ?? '';
    return domains.some((x) => d === x || d.endsWith(`.${x}`));
  });
}

/** A calendar event as a meeting entry. "Interview" in the title makes it an interview. */
export function meetingFromEvent(ev: CalEvent): Omit<Meeting, 'id'> {
  return {
    date: ev.date,
    start: ev.start,
    end: ev.end,
    kind: /interview/i.test(ev.title) ? 'interview' : 'meeting',
    with: '',
    notes: ev.title,
    calendarEventId: ev.id,
    calendarLink: ev.link,
  };
}
