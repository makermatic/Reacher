import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from './defaults';
import { eventsOf, makeEvent, stageText } from './events';
import { matchesQuery, parseQuery } from './query';
import {
  inView,
  joinPatch,
  newSprint,
  shortDate,
  sprintLabel,
  sprintState,
  targetSprint,
} from './sprints';
import { deriveTasks } from './tasks';
import { migrateBoard, migrateCompany, stagePatch } from './stages';
import { LEGACY_DEFAULT_BOARD } from './defaults';
import type { Company, Page, Sprint } from './types';

const board = DEFAULT_BOARD;
const s1: Sprint = { id: 's1', name: 'First Light', start: '2026-10-01', end: null, order: 1 };
const s2: Sprint = { id: 's2', name: 'Second Wind', start: '2026-10-20', end: null, order: 2 };
const buck: Company = {
  id: 'buck',
  name: 'Buck',
  order: 1,
  due: null,
  meta: { city: 'Los Angeles' },
  stages: { outreach: 'reply' },
  sprints: {
    s1: { stages: { outreach: 'sent' }, added: '2026-10-01', updated: '2026-10-05' },
    s2: { stages: { outreach: 'reply' }, added: '2026-10-20', updated: '2026-10-21' },
  },
};

describe('sprints', () => {
  it('names: custom name and start date, then the end date once it is over', () => {
    expect(shortDate('2026-10-29')).toBe('10/29/26');
    const s = newSprint('First Light', 1, '2026-10-29');
    expect(sprintLabel(s)).toBe('First Light 10/29/26');
    expect(sprintLabel(s, { end: '2026-11-15' })).toBe('First Light 10/29/26 - 11/15/26');
  });

  it('a sprint is over when a newer one exists or after two quiet weeks, ending on its last activity', () => {
    const pages: Record<string, Page> = {};
    expect(sprintState(s1, [s1, s2], [buck], pages, '2026-10-22')).toEqual({
      over: true,
      end: '2026-10-05',
      last: '2026-10-05',
    });
    expect(sprintState(s2, [s1, s2], [buck], pages, '2026-10-30').over).toBe(false);
    expect(sprintState(s2, [s1, s2], [buck], pages, '2026-11-05')).toMatchObject({
      over: true,
      end: '2026-10-21',
    });
    // Ended by hand.
    expect(
      sprintState({ ...s2, end: '2026-10-25' }, [s2], [buck], pages, '2026-10-26'),
    ).toMatchObject({
      over: true,
      end: '2026-10-25',
    });
  });

  it('each sprint keeps its own stage statuses; All companies shows the latest', () => {
    expect(inView(buck, 's1').stages).toEqual({ outreach: 'sent' });
    expect(inView(buck, 's2').stages).toEqual({ outreach: 'reply' });
    expect(inView(buck, null).stages).toEqual({ outreach: 'reply' });
    expect(stagePatch(buck, 's1', { outreach: 'done' }, '2026-10-30')).toEqual({
      stages: { outreach: 'done' },
      sprints: { s1: { stages: { outreach: 'done' }, updated: '2026-10-30' } },
    });
    expect(stagePatch(buck, 'nope', { outreach: 'done' })).toEqual({
      stages: { outreach: 'done' },
    });
  });

  it('changes land in the sprint on screen, else the newest the company is in', () => {
    expect(targetSprint(buck, [s1, s2], 's1')).toBe('s1');
    expect(targetSprint(buck, [s1, s2], null)).toBe('s2');
    expect(targetSprint(buck, [s1, s2], 'other')).toBe('s2');
    expect(targetSprint({ ...buck, sprints: {} }, [s1, s2], 's1')).toBeNull();
  });

  it('joining a sprint starts from the current stages', () => {
    expect(joinPatch(buck, 's3', '2026-10-30')).toEqual({
      sprints: {
        s3: { stages: { outreach: 'reply' }, added: '2026-10-30', updated: '2026-10-30' },
      },
    });
  });
});

describe('events', () => {
  it('old notes show as comments, newest first', () => {
    const page: Page = {
      notes: [{ id: 'n1', date: '2026-10-01', text: 'Met at SCAD' }],
      applications: [],
      meetings: [],
      events: [makeEvent('status', 'moved', 'you', { at: '2026-10-05T10:00:00Z' })],
    };
    expect(eventsOf(page).map((e) => [e.kind, e.text])).toEqual([
      ['status', 'moved'],
      ['comment', 'Met at SCAD'],
    ]);
    expect(stageText(board, 'outreach', 'sent', 'reply')).toBe('Outreach: Sent → Reply');
  });
});

describe('search', () => {
  it('words, stage=status, status=any stage, fields, either-or and leaving out', () => {
    const q = (s: string) => matchesQuery(board, buck, parseQuery(s));
    expect(q('buck')).toBe(true);
    expect(q('LA')).toBe(true);
    expect(q('reply')).toBe(true);
    expect(q('outreach=reply')).toBe(true);
    expect(q('outreach=sent')).toBe(false);
    expect(q('interview=none')).toBe(true);
    expect(q('status=reply')).toBe(true);
    expect(q('status=done')).toBe(false);
    expect(q('status=done,reply')).toBe(true);
    expect(q('status=-reply')).toBe(false);
    expect(q('city=la')).toBe(true);
    expect(q('-buck')).toBe(false);
    expect(parseQuery('psyop status=[to do] -gretel')).toEqual({
      words: ['psyop'],
      excludes: ['gretel'],
      filters: [{ key: 'status', values: ['to do'], not: false }],
    });
  });
});

describe('my tasks', () => {
  it('reply, follow up, prep and check in', () => {
    const psyop: Company = {
      id: 'psyop',
      name: 'Psyop',
      order: 2,
      meta: {},
      stages: { outreach: 'sent' },
      due: '2026-10-29',
    };
    const nyl: Company = {
      id: 'nyl',
      name: 'New York Life',
      order: 3,
      meta: {},
      stages: { application: 'sent' },
      due: null,
    };
    const pages: Record<string, Page> = {
      psyop: {
        notes: [],
        applications: [],
        meetings: [
          {
            id: 'm',
            date: '2026-11-02',
            start: '12:30',
            end: '',
            kind: 'interview',
            with: '',
            notes: '',
          },
        ],
      },
      nyl: {
        notes: [],
        applications: [{ id: 'a', date: '2026-10-01', role: 'Designer', link: '', result: '' }],
        meetings: [],
      },
    };
    const tasks = deriveTasks(board, [buck, psyop, nyl], pages, [], [s1, s2], '2026-10-30');
    expect(tasks.map((t) => [t.kind, t.company.name, t.due])).toEqual(
      [
        ['check-in', 'New York Life', '2026-10-15'],
        ['reply', 'Buck', '2026-10-30'],
        ['follow-up', 'Psyop', '2026-10-29'],
        ['prep', 'Psyop', '2026-11-02'],
      ].sort((a, b) => (a[2]! < b[2]! ? -1 : 1)),
    );
  });
});

describe('moving data from before stages', () => {
  it('turns Status into stages and Outcome into a plain value', () => {
    const old: Company = {
      id: 'if',
      name: 'Imaginary Forces',
      order: 1,
      due: null,
      meta: { status: 'meeting', outcome: 'hopeful', city: 'New York' },
    };
    const page: Page = {
      notes: [],
      applications: [],
      meetings: [
        { id: 'm', date: '2026-11-06', start: '', end: '', kind: 'meeting', with: '', notes: '' },
      ],
    };
    const moved = migrateCompany(LEGACY_DEFAULT_BOARD, old, page, '2026-10-30');
    expect(moved.stages).toEqual({ outreach: 'done', meeting: 'scheduled' });
    expect(moved.meta).toEqual({ outcome: 'Hopeful', city: 'New York' });
    const b = migrateBoard(LEGACY_DEFAULT_BOARD);
    expect(b.columns.find((c) => c.id === 'outcome')).toMatchObject({
      type: 'values',
      options: ['Hopeful', 'Offer!', 'Bad fit', 'Rejected'],
    });
    expect(b.columns.some((c) => c.type === 'status')).toBe(false);
    expect(b.suggest).toContainEqual({ stage: 'outreach', status: 'todo', tpl: 'tpl-intro' });
  });
});
