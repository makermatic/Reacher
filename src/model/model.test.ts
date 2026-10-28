import { describe, expect, it } from 'vitest';
import { colById, colorFor, metaPatch, sheetColumns, statusCol, valueText } from './board';
import { addDays, daysUntil, fmtTime, monthDay } from './dates';
import { DEFAULT_BOARD } from './defaults';
import { describeImport, ImportError, parseExport } from './importData';
import { rankOptions, splitMatch } from './picker';
import { matchesSearch, needsMe, visibleCompanies } from './search';
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

describe('status picker ranking', () => {
  const labels = (q: string) => rankOptions(statusCol(board), q).map((o) => o.label);

  it('lists every choice in order when nothing is typed', () => {
    expect(labels('')).toHaveLength(8);
    expect(labels('')[0]).toBe('Gathering');
  });

  it('puts labels that start with the text first, then word starts, then contains', () => {
    expect(labels('re')).toEqual(['Reached out', 'Replied', 'Rejected']);
    expect(labels('ed')).toEqual(['Reached out', 'Replied', 'Applied', 'Rejected']);
    expect(labels('back')).toEqual(['Wrote back!!']);
    expect(labels('ack')).toEqual(['Wrote back!!']);
  });

  it('falls back to categories only when no label matches', () => {
    expect(labels('job')).toEqual(['Applied', 'Rejected', 'Interview']);
  });

  it('splits a label around the match for underlining', () => {
    expect(splitMatch('Wrote back!!', 'BA')).toEqual(['Wrote ', 'ba', 'ck!!']);
    expect(splitMatch('Applied', 'x')).toEqual(['Applied', '', '']);
  });
});

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

  it('Needs me = wrote back, or follow-up due or late', () => {
    expect(needsMe(co('A', { status: 'wroteback' }), NOW)).toBe(true);
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
  it('clears Outcome when Status moves away from Meeting or Interview', () => {
    const c = co('IF', { status: 'meeting', outcome: 'hopeful' });
    expect(metaPatch(board, c, 'status', 'applied').meta).toEqual({
      status: 'applied',
      outcome: null,
    });
    expect(metaPatch(board, c, 'status', 'interview').meta).toEqual({ status: 'interview' });
  });

  it('only shows Outcome on the sheet when some company can have one', () => {
    const names = (cs: Company[]) => sheetColumns(board, cs).map((c) => c.id);
    expect(names([co('A', { status: 'applied' })])).not.toContain('outcome');
    expect(names([co('A', { status: 'meeting' })])).toContain('outcome');
    expect(names([])).not.toContain('website'); // hidden by default: page only
  });

  it('gives list choices steady, non-grey colors', () => {
    const priority = colById(board, 'priority')!;
    expect(colorFor(priority, 'Dream')).toBe('blue');
    expect(colorFor(priority, 'Strong')).toBe('teal');
    expect(colorFor(priority, 'Dream')).toBe(colorFor(priority, 'Dream'));
  });

  it('turns values into text for search', () => {
    expect(valueText(statusCol(board), 'wroteback')).toBe('Wrote back!!');
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
    board: DEFAULT_BOARD,
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
