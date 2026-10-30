import { describe, expect, it } from 'vitest';
import { colById, colorFor, valueText } from './board';
import { addDays, daysUntil, fmtTime, monthDay } from './dates';
import { DEFAULT_BOARD, LEGACY_DEFAULT_BOARD } from './defaults';
import { describeImport, ImportError, parseExport } from './importData';
import { matchesSearch, needsMe, visibleCompanies } from './search';
import { textSuggestions } from './suggest';
import { googleCalendarLink } from './automation';
import { stageMoves } from './stages';
import { byRank, rankBetween } from './ranking';
import type { Company } from './types';

const board = DEFAULT_BOARD;
const co = (
  name: string,
  meta: Record<string, unknown> = {},
  extra: Partial<Company> = {},
): Company => ({
  id: `co-${name}`,
  name,
  order: 0,
  meta,
  due: null,
  ...extra,
});
const NOW = new Date(2026, 9, 28); // Oct 28 2026

describe('search', () => {
  const nyc = co('Psyop', { city: 'New York', tags: ['Studio'] });
  const la = co('Buck', { city: 'Los Angeles' });
  const vfx = co('Framestore', { role: 'Visual effects compositor' });

  it('treats abbreviations as the full thing', () => {
    expect(matchesSearch(board, la, 'LA')).toBe(true);
    expect(matchesSearch(board, nyc, 'NYC')).toBe(true);
    expect(matchesSearch(board, nyc, 'ny')).toBe(true);
    expect(matchesSearch(board, vfx, 'vfx')).toBe(true);
    expect(matchesSearch(board, la, 'NYC')).toBe(false);
  });

  it('searches names and every column, including list values', () => {
    expect(matchesSearch(board, nyc, 'psy')).toBe(true);
    expect(matchesSearch(board, nyc, 'studio')).toBe(true);
  });

  it('Needs me = a stage at Reply, or follow-up due or late', () => {
    expect(needsMe(co('A', {}, { stages: { outreach: 'reply' } }), NOW)).toBe(true);
    expect(needsMe(co('B', {}, { due: '2026-10-28' }), NOW)).toBe(true);
    expect(needsMe(co('C', {}, { due: '2026-10-20' }), NOW)).toBe(true);
    expect(needsMe(co('D', {}, { due: '2026-11-02' }), NOW)).toBe(false);
  });

  it('keeps rows in the order they were added', () => {
    const rows = visibleCompanies(
      board,
      [co('B', {}, { order: 2 }), co('A', {}, { order: 1 })],
      '',
      'all',
    );
    expect(rows.map((c) => c.name)).toEqual(['A', 'B']);
  });
});

describe('board helpers', () => {
  it('gives list choices steady, non-grey colors', () => {
    const priority = colById(board, 'priority')!;
    expect(colorFor(priority, 'Dream')).toBe('blue');
    expect(colorFor(priority, 'Strong')).toBe('teal');
    expect(colorFor(priority, 'Dream')).toBe(colorFor(priority, 'Dream'));
  });

  it('turns values into text for search', () => {
    expect(valueText(colById(board, 'outcome')!, 'Hopeful')).toBe('Hopeful');
    expect(valueText(colById(board, 'contact')!, { name: 'Fred Smith', role: '', email: '' })).toBe(
      'Fred Smith',
    );
  });
});

describe('dates', () => {
  it('counts days until a date', () => {
    expect(daysUntil('2026-10-31', NOW)).toBe(3);
    expect(daysUntil('2026-10-26', NOW)).toBe(-2);
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('formats short dates and times', () => {
    expect(monthDay('2026-11-06')).toBe('11/6');
    expect(fmtTime('12:30')).toBe('12:30 pm');
    expect(fmtTime('09:05')).toBe('9:05 am');
    expect(fmtTime('00:15')).toBe('12:15 am');
  });
});

describe('import', () => {
  const file = {
    exported: '2026-10-28T20:00:00Z',
    board: LEGACY_DEFAULT_BOARD,
    companies: [
      { id: 'co-1', name: 'Psyop', order: 1, meta: { status: 'reached' }, due: '2026-10-30' },
      { id: 'co-2', name: 'Buck', order: 2, meta: {}, due: null },
      { name: 'No id, skipped' },
    ],
    chains: [
      {
        id: 'ch-1',
        companyId: 'co-1',
        title: 'Intro',
        started: '2026-10-20',
        messages: [{ id: 'm-1', dir: 'out', date: '2026-10-20', text: 'Hi' }],
        summary: null,
      },
      { id: 'ch-orphan', companyId: 'gone', title: 'x', messages: [] },
    ],
    pages: {
      'co-1': {
        notes: [{ id: 'n-1', date: '2026-10-21', text: 'Met at a review' }],
        applications: [],
        meetings: [],
      },
    },
    templates: [{ id: 'tpl-intro', name: 'First outreach', subject: 'Hi', body: 'Hello' }],
    me: { name: 'Zack', portfolio: 'zackzand.com', reel: '', phone: '', intro: '' },
  };

  it('reads a prototype export', () => {
    const d = parseExport(JSON.stringify(file));
    expect(d.companies.map((c) => c.name)).toEqual(['Psyop', 'Buck']);
    // M7: the prototype's Status moves to stages; the board gets the four stages.
    expect(d.companies[0]?.stages).toEqual({ outreach: 'sent' });
    expect(d.companies[0]?.meta.status).toBeUndefined();
    expect(d.board.version).toBe(3);
    expect(d.board.stages.map((x) => x.id)).toEqual([
      'outreach',
      'meeting',
      'application',
      'interview',
    ]);
    expect(d.chains.map((c) => c.id)).toEqual(['ch-1']);
    expect(d.pages['co-1']?.notes).toHaveLength(1);
    expect(d.me?.name).toBe('Zack');
    expect(describeImport(d)).toEqual([
      '2 companies',
      '1 email chain',
      '1 note',
      '1 email template',
    ]);
  });

  it('explains files it cannot read', () => {
    expect(() => parseExport('not json')).toThrow(ImportError);
    expect(() => parseExport('{"hello":1}')).toThrow(/Export data/);
  });
});

describe('text autofill', () => {
  const cities = ['New York', 'New York', 'Los Angeles', 'Atlanta', 'new york ', 'Brooklyn'];

  it('lists used values, most used first, without duplicates', () => {
    expect(textSuggestions(cities, '')).toEqual(['New York', 'Los Angeles', 'Atlanta', 'Brooklyn']);
  });

  it('expands abbreviations to the full name, first', () => {
    expect(textSuggestions(cities, 'LA')[0]).toBe('Los Angeles');
    expect(textSuggestions(cities, 'nyc')).toEqual(['New York']);
    expect(textSuggestions([], 'sf')).toEqual(['San Francisco']);
  });

  it('ranks starts-with before contains', () => {
    expect(textSuggestions(cities, 'a')).toEqual(['Atlanta', 'Los Angeles']);
    expect(textSuggestions(['Motion Designer', 'Designer / Animator'], 'des')).toEqual([
      'Designer / Animator',
      'Motion Designer',
    ]);
  });
});

describe('stage automations (M7)', () => {
  const moves = (stages: Record<string, string>, e: Parameters<typeof stageMoves>[2]) =>
    stageMoves(board, stages, e, '2026-10-28');

  it('an email I send: Outreach → Sent, or a stage at Reply → Sent', () => {
    expect(moves({}, { kind: 'sent' })).toEqual({ outreach: 'sent' });
    expect(moves({ outreach: 'todo' }, { kind: 'sent' })).toEqual({ outreach: 'sent' });
    expect(moves({ outreach: 'reply' }, { kind: 'sent' })).toEqual({ outreach: 'sent' });
    expect(moves({ outreach: 'done', interview: 'reply' }, { kind: 'sent' })).toEqual({
      interview: 'sent',
    });
    expect(moves({ outreach: 'sent' }, { kind: 'sent' })).toEqual({});
  });

  it('an email from them: the active stage → Reply', () => {
    expect(moves({ outreach: 'sent' }, { kind: 'received' })).toEqual({ outreach: 'reply' });
    expect(moves({ outreach: 'done', application: 'sent' }, { kind: 'received' })).toEqual({
      application: 'reply',
    });
    expect(moves({}, { kind: 'received' })).toEqual({ outreach: 'reply' });
    expect(moves({ outreach: 'reply' }, { kind: 'received' })).toEqual({});
  });

  it('applying: Application → Sent when not started', () => {
    expect(moves({}, { kind: 'applied' })).toEqual({ application: 'sent' });
    expect(moves({ application: 'no' }, { kind: 'applied' })).toEqual({});
  });

  it('meetings and interviews: Scheduled when upcoming, Done when past', () => {
    expect(
      moves({ outreach: 'reply' }, { kind: 'meeting', meetingKind: 'meeting', date: '2026-11-02' }),
    ).toEqual({
      meeting: 'scheduled',
      outreach: 'done',
    });
    expect(
      moves(
        { application: 'sent' },
        { kind: 'meeting', meetingKind: 'interview', date: '2026-10-01' },
      ),
    ).toEqual({
      interview: 'done',
      application: 'done',
    });
  });
});

describe('Google Calendar link', () => {
  const m = {
    id: 'm',
    date: '2026-11-06',
    start: '12:30',
    end: '',
    kind: 'interview' as const,
    with: 'Alex',
    notes: 'Bring reel',
  };

  it('builds a timed event, 30 minutes when there is no end', () => {
    const url = new URL(googleCalendarLink('New York Life', m, 'America/New_York'));
    expect(url.searchParams.get('text')).toBe('Interview: New York Life');
    expect(url.searchParams.get('dates')).toBe('20261106T123000/20261106T130000');
    expect(url.searchParams.get('details')).toBe('With Alex\nBring reel');
    expect(url.searchParams.get('ctz')).toBe('America/New_York');
  });

  it('makes untimed meetings all-day', () => {
    const url = new URL(googleCalendarLink('Buck', { ...m, start: '', kind: 'meeting' }));
    expect(url.searchParams.get('dates')).toBe('20261106/20261107');
  });
});

describe('board card order', () => {
  it('puts a dropped card between its neighbours', () => {
    expect(rankBetween(10, 20)).toBe(15);
    expect(rankBetween(undefined, 20)).toBeLessThan(20);
    expect(rankBetween(10, undefined)).toBeGreaterThan(10);
  });

  it('sorts by board position, falling back to the order added', () => {
    const cards = [
      { id: 'a', order: 3 },
      { id: 'b', order: 1, rank: 5 },
      { id: 'c', order: 2 },
    ];
    expect(byRank(cards).map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });
});
