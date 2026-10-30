import { addDays } from './dates';
import type { Meeting } from './types';

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
