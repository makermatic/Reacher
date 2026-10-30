import { describe, expect, it } from 'vitest';
import { CHECK_CASES, checkPrompt, grade } from '../ai/aiCheck';

const byNote = (start: string) => CHECK_CASES.find((c) => c.note.startsWith(start))!;
const allOk = (r: ReturnType<typeof grade>) => r.results.every((x) => x.ok);

describe('AI check', () => {
  it('passes a correct answer', () => {
    const r = grade(byNote('Interview with New York Life'), {
      actions: [
        { type: 'add_company', company: 'New York Life' },
        { type: 'set_status', company: 'New York Life', stage: 'Interview', status: 'Scheduled' },
        {
          type: 'add_meeting',
          company: 'New York Life',
          date: '2026-11-06',
          start: '12:30',
          end: '13:00',
          kind: 'interview',
        },
      ],
    });
    expect(r.results).toEqual([
      { label: 'adds New York Life', ok: true },
      { label: 'interview on Nov 6 at 12:30', ok: true },
      { label: 'Interview stage Scheduled', ok: true },
    ]);
  });

  it('fails a wrong one, check by check', () => {
    const r = grade(byNote('Reached out to Sibling'), {
      actions: [
        { type: 'add_meeting', company: 'Sibling Rivalry', date: '2026-02-01', kind: 'interview' },
        { type: 'set_field', company: 'Sibling Rivalry', column: 'Outcome', value: 'Bad fit' },
      ],
    });
    expect(r.results.map((x) => x.ok)).toEqual([false, true, true, false]);
  });

  it('nonsense: no actions and a question passes', () => {
    expect(allOk(grade(byNote('asdf'), { reply: 'What happened?', actions: [] }))).toBe(true);
    expect(allOk(grade(byNote('asdf'), null))).toBe(false);
  });

  it('prompts use the fixed tracker and date', () => {
    const p = checkPrompt(byNote('Psyop wrote back'));
    expect(p).toContain('Today is 2026-10-28');
    expect(p).toContain('Psyop [Outreach: Sent, Meeting: none');
  });
});
