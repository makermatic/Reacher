import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, DEFAULT_TEMPLATES } from './defaults';
import {
  defaultTarget,
  defaultTemplateId,
  fillWithPlaceholders,
  guessName,
  missingFields,
  previewParts,
  replaceFilled,
  tokenMap,
} from './email';
import type { Chain, Company } from './types';

const board = DEFAULT_BOARD;
const me = {
  name: 'Zack Zand',
  portfolio: 'https://zackzand.com',
  reel: '',
  phone: '',
  intro: 'Hi, I animate.',
};
const co = (stages: Record<string, string> = {}, meta: Record<string, unknown> = {}): Company => ({
  id: 'c1',
  name: 'Psyop',
  order: 1,
  meta,
  stages,
  due: null,
});
const intro = DEFAULT_TEMPLATES[0]!;

describe('email fields', () => {
  it('fills known fields and leaves readable placeholders for blanks', () => {
    const c = co(
      {},
      {
        role: 'Motion Designer',
        contact: { name: 'Sam Example', role: 'Recruiter', email: 'sam@psyop.com' },
      },
    );
    const m = tokenMap(board, c, { name: 'Sam Example', role: 'Recruiter', email: '' }, me);
    expect(m.first_name).toBe('Sam');
    expect(m.role_i_want).toBe('Motion Designer');
    const body = fillWithPlaceholders(board, intro.body, m);
    expect(body).toContain('Hi Sam,');
    expect(body).toContain('[Why them]');
    expect(missingFields(board, [body], intro, m)).toEqual(['why_them']);
  });

  it('replaces a placeholder once its field is filled, even in edited text', () => {
    const edited = 'Hey [Contact first name], quick note about [Why them]!';
    const m = tokenMap(
      board,
      co({}, { why: 'Your broadcast work' }),
      { name: 'Sam', role: '', email: '' },
      me,
    );
    expect(replaceFilled(board, edited, m)).toBe('Hey Sam, quick note about Your broadcast work!');
  });

  it('splits a template into filled and missing parts for the preview', () => {
    const m = tokenMap(board, co(), null, me);
    expect(previewParts(board, 'Hi {{first_name}}, {{my_name}} here', m)).toEqual([
      { text: 'Hi ', kind: 'plain' },
      { text: 'Contact first name', kind: 'missing' },
      { text: ', ', kind: 'plain' },
      { text: 'Zack Zand', kind: 'filled' },
      { text: ' here', kind: 'plain' },
    ]);
  });
});

describe('email defaults', () => {
  it('suggests the template for the active stage, or First outreach when nothing has started', () => {
    expect(defaultTemplateId(board, co(), DEFAULT_TEMPLATES)).toBe('tpl-intro');
    expect(defaultTemplateId(board, co({ outreach: 'sent' }), DEFAULT_TEMPLATES)).toBe('tpl-check');
    expect(defaultTemplateId(board, co({ outreach: 'reply' }), DEFAULT_TEMPLATES)).toBe('');
    expect(
      defaultTemplateId(board, co({ outreach: 'done', application: 'sent' }), DEFAULT_TEMPLATES),
    ).toBe('tpl-app');
  });

  it('replies in the latest chain once outreach has started', () => {
    const ch = (id: string, started: string): Chain => ({
      id,
      companyId: 'c1',
      title: id,
      started,
      messages: [],
      summary: null,
    });
    const chains = [ch('ch-old', '2026-09-01'), ch('ch-latest', '2026-10-01')];
    expect(defaultTarget(co({ outreach: 'reply' }), chains)).toBe('ch-latest');
    expect(defaultTarget(co({ application: 'sent' }), chains)).toBe('new');
    expect(defaultTarget(co({ outreach: 'todo' }), chains)).toBe('new');
  });
});

describe('name from email', () => {
  it('reads first.last addresses and skips shared inboxes', () => {
    expect(guessName('fred.smith@buck.co')).toBe('Fred Smith');
    expect(guessName('jane-doe2@x.com')).toBe('Jane Doe');
    expect(guessName('jobs@psyop.com')).toBe('');
    expect(guessName('fsmith@buck.co')).toBe('');
  });
});
