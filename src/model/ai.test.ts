import { describe, expect, it } from 'vitest';
import { quickUpdatePrompt, lookupPrompt, fillableColumns } from '../ai/prompts';
import { cleanActions, describeAction, findCompany } from './aiActions';
import { DEFAULT_BOARD } from './defaults';
import { cleanCandidates, planCandidate, planQuick } from './quickPlan';
import type { Chain, Company } from './types';

const board = DEFAULT_BOARD;
const co = (id: string, name: string, meta: Record<string, unknown> = {}): Company => ({
  id,
  name,
  order: 1,
  meta,
  due: null,
  auto: {},
});
const psyop = co('co-psyop', 'Psyop', { status: 'reached' });
const chain: Chain = {
  id: 'ch-1',
  companyId: 'co-psyop',
  title: 'Intro to Sam',
  started: '2026-10-20',
  messages: [{ id: 'm1', dir: 'out', date: '2026-10-20', text: 'Hi' }],
  summary: null,
};
const state = { board, companies: [psyop], pages: {}, chains: [chain] };

describe('quick update: cleaning the AI answer', () => {
  it('keeps valid actions, fills dates, maps status values to labels', () => {
    const out = cleanActions(
      board,
      [
        { type: 'set_status', company: 'Psyop', column: 'status', value: 'wrote back!!' },
        { type: 'add_note', company: 'Psyop', text: 'Liked my reel' },
        {
          type: 'add_meeting',
          company: 'NY Life',
          date: '2026-11-06',
          start: '12:30',
          end: 'noon',
          kind: 'interview',
        },
        { type: 'set_status', company: 'Psyop', value: 'Hired' },
        { type: 'set_field', company: 'Psyop', column: 'Nope', value: 1 },
        { type: 'log_email', company: 'Psyop' },
        'junk',
      ],
      '2026-10-28',
    );
    expect(out).toEqual([
      { type: 'set_status', company: 'Psyop', column: 'Status', value: 'Wrote back!!' },
      { type: 'add_note', company: 'Psyop', date: '2026-10-28', text: 'Liked my reel' },
      {
        type: 'add_meeting',
        company: 'NY Life',
        date: '2026-11-06',
        start: '12:30',
        end: '',
        kind: 'interview',
        with: '',
        notes: '',
      },
    ]);
    expect(describeAction(board, out[2]!)).toMatch(
      /NY Life · interview on November 6, 2026, 12:30 pm/,
    );
  });

  it('finds tracked companies by name, loosely', () => {
    expect(findCompany([psyop], 'psyop')?.id).toBe('co-psyop');
    expect(findCompany([psyop], 'Psyop Inc')?.id).toBe('co-psyop');
    expect(findCompany([psyop], 'Buck')).toBeUndefined();
  });
});

describe('quick update: applying', () => {
  it('creates new companies and touches existing ones, with an undo snapshot', () => {
    const plan = planQuick(
      state,
      cleanActions(board, [
        { type: 'add_company', company: 'New York Life' },
        { type: 'set_status', company: 'New York Life', column: 'Status', value: 'Interview' },
        {
          type: 'add_meeting',
          company: 'New York Life',
          date: '2026-11-06',
          start: '12:30',
          end: '13:00',
          kind: 'interview',
        },
        {
          type: 'log_email',
          company: 'Psyop',
          chain: 'intro to sam',
          dir: 'in',
          date: '2026-10-27',
          text: 'Send your reel',
        },
        { type: 'set_status', company: 'Psyop', column: 'Status', value: 'Wrote back!!' },
        {
          type: 'set_field',
          company: 'Psyop',
          column: 'Company type',
          value: ['studio', 'VFX house'],
        },
      ]),
      1000,
    );
    expect(plan.created.map((c) => c.name)).toEqual(['New York Life']);
    expect(plan.created[0]!.meta.status).toBe('interview');
    expect(plan.pages[plan.created[0]!.id]!.meetings).toHaveLength(1);
    // The email joins the existing chain (title matched loosely), not a new one.
    expect(plan.chains).toHaveLength(1);
    expect(plan.chains[0]!.id).toBe('ch-1');
    expect(plan.chains[0]!.messages).toHaveLength(2);
    const p = plan.companies.find((c) => c.id === 'co-psyop')!;
    expect(p.meta.status).toBe('wroteback');
    expect(p.meta.tags).toEqual(['Studio', 'VFX house']);
    // "VFX house" is a new choice for Company type.
    expect(plan.board?.columns.find((c) => c.id === 'tags')?.options).toContain('VFX house');
    // Undo knows what to put back.
    expect(plan.undo.created).toEqual([plan.created[0]!.id]);
    expect(plan.undo.companies[0]!.meta.status).toBe('reached');
    expect(plan.undo.chains['co-psyop']![0]!.messages).toHaveLength(1);
    expect(plan.undo.board).not.toBeNull();
  });
});

describe('company lookup', () => {
  it('fills only empty or looked-up fields and fixes the name', () => {
    const c = co('co-x', 'big star', { city: 'New York' });
    const cands = cleanCandidates({
      sure: true,
      candidates: [
        {
          name: 'BigStar',
          about: 'Studio',
          fields: { City: 'Brooklyn', Website: 'bigstar.tv', Priority: 'Dream' },
        },
        { nope: 1 },
      ],
    });
    expect(cands).toHaveLength(1);
    const fill = fillableColumns(board).map((x) => x.id);
    const { patch, filled } = planCandidate(board, c, cands[0]!, fill);
    expect(patch.name).toBe('BigStar');
    expect(patch.meta).toEqual({ website: 'https://bigstar.tv' });
    expect(filled).toEqual(['Website']);
  });
});

describe('prompts', () => {
  it('quick update prompt carries the board, tracked companies and today', () => {
    const p = quickUpdatePrompt(
      board,
      [psyop],
      [chain],
      'Interview with NY Life 11/6',
      '2026-10-28',
    );
    expect(p).toContain('Today is 2026-10-28');
    expect(p).toContain('Psyop [Status: Reached out; chains: Intro to Sam]');
    expect(p).toContain('"""Interview with NY Life 11/6"""');
    expect(p).toContain('Status is "Wrote back!!"');
  });

  it('quick update prompt includes history for companies the note names', () => {
    const page = {
      notes: [],
      applications: [],
      meetings: [
        {
          id: 'm1',
          date: '2026-02-01',
          kind: 'meeting' as const,
          start: '',
          end: '',
          with: '',
          notes: 'Not a good fit',
        },
      ],
    };
    const p = quickUpdatePrompt(board, [psyop], [], 'spoke to psyop last week', '2026-10-28', {
      [psyop.id]: page,
    });
    expect(p).toContain('Psyop so far:\n[2026-02-01] MEETING: Not a good fit');
    expect(p).toContain('Spoke again');
    expect(
      quickUpdatePrompt(board, [psyop], [], 'met buck', '2026-10-28', { [psyop.id]: page }),
    ).not.toContain('so far:');
  });

  it('lookup skips personal columns', () => {
    const p = lookupPrompt(board, 'buck');
    expect(p).toContain('- City (text)');
    expect(p).not.toContain('Priority');
    expect(p).not.toContain('Main contact');
  });
});

describe('quick update: no duplicates (round 2)', () => {
  it('skips a meeting, note or email the tracker already has', () => {
    const sr = co('co-sr', 'Sibling Rivalry', { status: 'meeting' });
    const pages = {
      'co-sr': {
        notes: [{ id: 'n1', date: '2026-02-01', text: 'We talked and it was not a good fit' }],
        applications: [],
        meetings: [
          {
            id: 'm1',
            date: '2026-02-01',
            start: '',
            end: '',
            kind: 'meeting' as const,
            with: '',
            notes: 'We talked',
          },
        ],
      },
    };
    const chains: Chain[] = [
      {
        id: 'ch-sr',
        companyId: 'co-sr',
        title: 'Outreach',
        started: '2026-01-01',
        messages: [
          { id: 'e1', dir: 'out', date: '2026-01-01', text: 'Reached out to Sibling Rivalry' },
        ],
        summary: null,
      },
    ];
    const plan = planQuick(
      { board, companies: [sr], pages, chains },
      cleanActions(board, [
        {
          type: 'log_email',
          company: 'Sibling Rivalry',
          chain: 'First outreach',
          dir: 'out',
          date: '2026-01-01',
          text: 'Reached out to Sibling Rivalry',
        },
        {
          type: 'add_meeting',
          company: 'Sibling Rivalry',
          date: '2026-02-01',
          kind: 'meeting',
          notes: 'Had a conversation. It did not feel like a good fit.',
        },
        {
          type: 'add_note',
          company: 'Sibling Rivalry',
          date: '2026-02-01',
          text: "We talked and it wasn't a good fit",
        },
        { type: 'set_status', company: 'Sibling Rivalry', column: 'Status', value: 'Meeting' },
        {
          type: 'add_note',
          company: 'Sibling Rivalry',
          date: '2026-03-01',
          text: 'They are hiring in spring',
        },
      ]),
    );
    expect(plan.skipped.map((a) => a.type)).toEqual([
      'log_email',
      'add_meeting',
      'add_note',
      'set_status',
    ]);
    expect(plan.applied.map((a) => a.type)).toEqual(['add_note']);
    expect(plan.chains).toHaveLength(0);
    expect(plan.pages['co-sr']!.meetings).toHaveLength(1);
  });
});
