import { describe, expect, it } from 'vitest';
import { boardOrDefault } from './board';
import { DEFAULT_BOARD } from './defaults';
import { eventsOf } from './events';
import { parseExport } from './importData';
import type { Company, FeedEvent } from './types';
import { statusFromStages, unstageCompany } from './unstage';

/** A board as Reacher Test v12 saved it. */
const V3 = {
  version: 3,
  columns: [
    { id: 'outcome', name: 'Outcome', type: 'values', onSheet: true, options: ['Hopeful'] },
    { id: 'city', name: 'City', type: 'text', onSheet: false },
  ],
  stages: [{ id: 'outreach', name: 'Outreach', color: 'teal' }],
  statuses: [],
  suggest: [],
};

describe('moving stages back to one Status (round 1 of M7)', () => {
  it('turns a stages board back into Status, Outcome and the fields', () => {
    const b = boardOrDefault(V3);
    expect(b.version).toBe(2);
    expect(b.columns.map((c) => c.id)).toEqual(['status', 'outcome', 'city']);
    expect(b.columns[1]).toMatchObject({ type: 'status', showWhen: { col: 'status' } });
    // Starring stays as it was.
    expect(b.columns[2]!.onSheet).toBe(false);
  });

  it('the furthest stage decides the status', () => {
    expect(statusFromStages({ outreach: 'sent' })).toBe('reached');
    expect(statusFromStages({ outreach: 'reply' })).toBe('wroteback');
    expect(statusFromStages({ outreach: 'todo' })).toBe('gathering');
    expect(statusFromStages({ outreach: 'done', meeting: 'done' })).toBe('meeting');
    expect(statusFromStages({ application: 'sent', meeting: 'done' })).toBe('applied');
    expect(statusFromStages({ application: 'no' })).toBe('rejected');
    expect(statusFromStages({ application: 'done', interview: 'scheduled' })).toBe('interview');
    expect(statusFromStages({})).toBeNull();
  });

  it('a company gets its status back, in each sprint too, and Outcome its id', () => {
    const c = {
      id: 'c1',
      name: 'Psyop',
      order: 1,
      due: null,
      meta: { outcome: 'Hopeful', city: 'NYC' },
      stages: { outreach: 'reply' },
      sprints: { s1: { stages: { outreach: 'sent' }, added: '2026-10-29', updated: '2026-10-29' } },
    } as unknown as Company;
    const out = unstageCompany(DEFAULT_BOARD, c);
    expect(out.meta).toEqual({ status: 'wroteback', outcome: 'hopeful', city: 'NYC' });
    expect('stages' in out).toBe(false);
    expect(out.sprints!.s1!.meta).toEqual({ status: 'reached' });
  });

  it('imports a v12 export the same way', () => {
    const data = parseExport(
      JSON.stringify({
        board: V3,
        companies: [{ id: 'c1', name: 'Buck', meta: {}, stages: { application: 'sent' } }],
        chains: [],
        pages: {},
        templates: [],
      }),
    );
    expect(data.companies[0]!.meta.status).toBe('applied');
    expect(data.board.columns[0]!.id).toBe('status');
  });

  it('stage status events show as plain lines', () => {
    const e = {
      id: 'e1',
      at: '2026-10-30T10:00:00',
      kind: 'status',
      text: 'Outreach: Sent → Reply',
      by: 'you',
      status: { stage: 'outreach', from: 'sent', to: 'reply' },
    } as unknown as FeedEvent;
    const [shown] = eventsOf({ notes: [], meetings: [], applications: [], events: [e] } as never);
    expect(shown!.status).toBeUndefined();
    expect(shown!.text).toBe('Outreach: Sent → Reply');
  });
});
