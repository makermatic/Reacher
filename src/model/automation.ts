import { optionOf, statusCol } from './board';
import { addDays } from './dates';
import type { Board, Company, Meeting } from './types';

/** Things that happen on a company page that can move its status (SPEC section 3). */
export type StatusEvent =
  | { kind: 'sent' }
  | { kind: 'received' }
  | { kind: 'applied' }
  | { kind: 'meeting'; meetingKind: Meeting['kind'] };

const OUTREACH = ['', 'gathering', 'reached', 'wroteback', 'replied'];

/**
 * The status an event moves a company to, or null to leave it:
 * - Email I sent: empty or Gathering → Reached out; Wrote back!! → Replied.
 * - Email from them: empty or anything in outreach → Wrote back!!.
 * - Application: empty or Gathering → Applied.
 * - Meeting or interview → Meeting; Interview when it's an interview, or the
 *   status was Applied or Rejected. Already at Meeting or Interview: no change.
 * Only moves to statuses this board still has.
 */
export function nextStatus(board: Board, c: Company, event: StatusEvent): string | null {
  const col = statusCol(board);
  const has = (id: string) => !!optionOf(col, id);
  const cur = String(c.meta?.status ?? '');
  let next: string | null = null;
  switch (event.kind) {
    case 'sent':
      if (cur === '' || cur === 'gathering') next = 'reached';
      else if (cur === 'wroteback') next = 'replied';
      break;
    case 'received':
      if (OUTREACH.includes(cur)) next = 'wroteback';
      break;
    case 'applied':
      if (cur === '' || cur === 'gathering') next = 'applied';
      break;
    case 'meeting':
      if (cur !== 'meeting' && cur !== 'interview')
        next =
          (event.meetingKind === 'interview' || cur === 'applied' || cur === 'rejected') &&
          has('interview')
            ? 'interview'
            : 'meeting';
      break;
  }
  return next && has(next) && next !== cur ? next : null;
}

/**
 * An "Add to Google Calendar" link for a meeting (SPEC section 6). Untimed
 * meetings are all-day; a start with no end lasts 30 minutes.
 */
export function googleCalendarLink(companyName: string, m: Meeting, timeZone?: string) {
  const day = m.date.replace(/-/g, '');
  let dates: string;
  if (m.start) {
    let end = m.end;
    if (!end) {
      const [h, min] = m.start.split(':').map(Number) as [number, number];
      const t = h * 60 + min + 30;
      end = `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    }
    dates = `${day}T${m.start.replace(':', '')}00/${day}T${end.replace(':', '')}00`;
  } else {
    dates = `${day}/${addDays(m.date, 1).replace(/-/g, '')}`;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${m.kind === 'interview' ? 'Interview' : 'Meeting'}: ${companyName}`,
    dates,
    details: [m.with ? `With ${m.with}` : '', m.notes].filter(Boolean).join('\n'),
  });
  if (timeZone) params.set('ctz', timeZone);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
