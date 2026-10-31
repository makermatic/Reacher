/**
 * The AI check: sample notes with what the quick update must do for each,
 * run against the real AI from Your details. AI answers vary run to run, so
 * this is how a prompt change (or a model update) gets caught before it
 * reaches Zack's tracker. Checks are loose on wording and strict on facts.
 */
import { cleanActions, type QuickAction, type QuickReply } from '../model/aiActions';
import { DEFAULT_BOARD } from '../model/defaults';
import type { Chain, Company } from '../model/types';
import { quickUpdatePrompt } from './prompts';

export const CHECK_TODAY = '2026-10-28';

/** A small fixed tracker so answers don't depend on anyone's data. */
const PSYOP: Company = {
  id: 'c-psyop',
  name: 'Psyop',
  meta: { status: 'reached', city: 'New York' },
  due: null,
  order: 1,
};
const CHAINS: Chain[] = [
  {
    id: 'ch-psyop',
    companyId: PSYOP.id,
    title: 'Intro to Sam',
    started: '2026-10-01',
    messages: [{ id: 'm1', dir: 'out', date: '2026-10-01', text: 'Hi Sam, I love your work.' }],
    summary: null,
  },
];

type Check = { label: string; ok: (a: QuickAction[], reply: string) => boolean };
export type CheckCase = { note: string; checks: Check[] };

const is = (s: string, ...want: string[]) => want.some((w) => s.toLowerCase().includes(w));
const has = <T extends QuickAction['type']>(
  a: QuickAction[],
  type: T,
  test: (x: Extract<QuickAction, { type: T }>) => boolean = () => true,
) => a.some((x) => x.type === type && test(x as Extract<QuickAction, { type: T }>));
const status = (a: QuickAction[], column: string, value: string) =>
  has(a, 'set_status', (x) => x.column === column && x.value.toLowerCase() === value.toLowerCase());

export const CHECK_CASES: CheckCase[] = [
  {
    note: 'Interview with New York Life on 11/6 at 12:30',
    checks: [
      {
        label: 'adds New York Life',
        ok: (a) => has(a, 'add_company', (x) => is(x.company, 'new york life')),
      },
      {
        label: 'interview on Nov 6 at 12:30',
        ok: (a) =>
          has(
            a,
            'add_meeting',
            (x) => x.kind === 'interview' && x.date === '2026-11-06' && x.start === '12:30',
          ),
      },
      { label: 'status Interview', ok: (a) => status(a, 'Status', 'Interview') },
    ],
  },
  {
    note: "Reached out to Sibling Rivalry in January. In February we talked and it wasn't a good fit.",
    checks: [
      {
        label: 'an email out in January',
        ok: (a) => has(a, 'log_email', (x) => x.dir === 'out' && x.date.startsWith('2026-01')),
      },
      {
        label: 'a meeting in February',
        ok: (a) => has(a, 'add_meeting', (x) => x.date.startsWith('2026-02')),
      },
      { label: 'Outcome Bad fit', ok: (a) => status(a, 'Outcome', 'Bad fit') },
      { label: 'no interview', ok: (a) => !has(a, 'add_meeting', (x) => x.kind === 'interview') },
    ],
  },
  {
    note: 'Psyop wrote back asking for my reel',
    checks: [
      { label: 'status Wrote back!!', ok: (a) => status(a, 'Status', 'Wrote back!!') },
      { label: "doesn't add Psyop again", ok: (a) => !has(a, 'add_company') },
      {
        label: 'logs their email in the existing chain',
        ok: (a) => has(a, 'log_email', (x) => x.dir === 'in' && x.chain === 'Intro to Sam'),
      },
    ],
  },
  {
    note: 'Applied to Buck for Motion Designer today',
    checks: [
      {
        label: 'an application for Motion Designer today',
        ok: (a) =>
          has(a, 'add_application', (x) => is(x.role, 'motion designer') && x.date === CHECK_TODAY),
      },
      { label: 'status Applied', ok: (a) => status(a, 'Status', 'Applied') },
    ],
  },
  {
    note: 'Spoke to Psyop again last week',
    checks: [
      {
        label: 'a meeting last week',
        ok: (a) => has(a, 'add_meeting', (x) => x.date >= '2026-10-19' && x.date <= '2026-10-25'),
      },
      { label: 'no made-up outcome', ok: (a) => !status(a, 'Outcome', 'Bad fit') },
    ],
  },
  {
    note: 'asdf',
    checks: [
      { label: 'changes nothing', ok: (a) => a.length === 0 },
      { label: 'asks what you meant', ok: (_a, reply) => reply.trim().length > 0 },
    ],
  },
];

export const checkPrompt = (c: CheckCase) =>
  quickUpdatePrompt(DEFAULT_BOARD, [PSYOP], CHAINS, c.note, CHECK_TODAY);

export type CheckResult = {
  note: string;
  results: { label: string; ok: boolean }[];
  actions: QuickAction[];
};

export function grade(c: CheckCase, reply: QuickReply | null): CheckResult {
  const actions = cleanActions(DEFAULT_BOARD, reply?.actions, CHECK_TODAY);
  const text = String(reply?.reply ?? '');
  return {
    note: c.note,
    actions,
    results: c.checks.map((k) => ({ label: k.label, ok: k.ok(actions, text) })),
  };
}
