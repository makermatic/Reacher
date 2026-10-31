import { describe, expect, it } from 'vitest';
import { createdId, eventInput, eventMatches, meetingFromEvent, toCalEvents } from './calendar';
import { DEFAULT_BOARD } from './defaults';
import type { Company, Meeting } from './types';

const meeting = (m: Partial<Meeting>): Meeting => ({
  id: 'm',
  date: '2026-11-06',
  start: '',
  end: '',
  kind: 'meeting',
  with: '',
  notes: '',
  ...m,
});
const company = (name: string, meta: Record<string, unknown> = {}): Company => ({
  id: name,
  name,
  order: 1,
  meta,
  due: null,
});

describe('calendar: meetings to events', () => {
  it('timed: local times, 30 minutes when no end', () => {
    expect(
      eventInput('Buck', meeting({ kind: 'interview', start: '12:30', with: 'Alex' })),
    ).toEqual({
      summary: 'Interview: Buck',
      description: 'With Alex\nAdded by Reacher',
      startTime: '2026-11-06T12:30:00',
      endTime: '2026-11-06T13:00:00',
    });
  });
  it('past midnight ends the next day; no time is all day', () => {
    expect(eventInput('Buck', meeting({ start: '23:45', end: '00:15' })).endTime).toBe(
      '2026-11-07T00:15:00',
    );
    expect(eventInput('Buck', meeting({}))).toMatchObject({
      allDay: true,
      startTime: '2026-11-06T00:00:00',
      endTime: '2026-11-07T00:00:00',
    });
  });
});

describe('calendar: events from the connector', () => {
  const payload = {
    events: [
      {
        id: 'e1',
        summary: 'Interview with Buck',
        start: { dateTime: '2026-11-06T12:30:00-05:00' },
        end: { dateTime: '2026-11-06T13:15:00-05:00' },
        htmlLink: 'https://calendar/e1',
        attendees: [{ email: 'alex@buck.co' }],
      },
      { id: 'e2', summary: 'Holiday', start: { date: '2026-11-26' }, end: { date: '2026-11-27' } },
      { id: 'e3', summary: 'Gone', status: 'cancelled', start: { date: '2026-11-26' } },
      { summary: 'No id', start: { date: '2026-11-26' } },
    ],
  };
  const events = toCalEvents(payload);

  it('reads dates and times as written, skips cancelled and broken ones', () => {
    expect(events.map((e) => [e.id, e.date, e.start, e.end])).toEqual([
      ['e1', '2026-11-06', '12:30', '13:15'],
      ['e2', '2026-11-26', '', ''],
    ]);
    expect(toCalEvents(null)).toEqual([]);
  });

  it('turns one into a meeting; "interview" in the title makes it an interview', () => {
    expect(meetingFromEvent(events[0]!)).toEqual({
      date: '2026-11-06',
      start: '12:30',
      end: '13:15',
      kind: 'interview',
      with: '',
      notes: 'Interview with Buck',
      calendarEventId: 'e1',
      calendarLink: 'https://calendar/e1',
    });
  });

  it('matches by whole name in the title, or an attendee from the company domain', () => {
    const e1 = events[0]!;
    expect(eventMatches(DEFAULT_BOARD, company('Buck'), e1)).toBe(true);
    expect(eventMatches(DEFAULT_BOARD, company('Bu'), e1)).toBe(false);
    expect(eventMatches(DEFAULT_BOARD, company('Buckingham'), e1)).toBe(false);
    expect(
      eventMatches(DEFAULT_BOARD, company('loyalkaspar'), { ...e1, title: 'Call w/ Loyal Kaspar' }),
    ).toBe(true);
    const site = DEFAULT_BOARD.columns.find((c) => c.type === 'link')!;
    const byDomain = company('Something Else', { [site.id]: 'https://www.buck.co/work' });
    expect(eventMatches(DEFAULT_BOARD, byDomain, e1)).toBe(true);
    const contact = DEFAULT_BOARD.columns.find((c) => c.type === 'person')!;
    const gmail = company('Other', { [contact.id]: { name: 'A', email: 'a@gmail.com', role: '' } });
    expect(eventMatches(DEFAULT_BOARD, gmail, { ...e1, attendees: ['b@gmail.com'] })).toBe(false);
  });

  it('finds a created event id at the top or under event', () => {
    expect(createdId({ id: 'x', htmlLink: 'l' })).toEqual({ id: 'x', link: 'l' });
    expect(createdId({ event: { id: 'y' } })).toEqual({ id: 'y', link: '' });
    expect(createdId('nope')).toBeNull();
  });
});
