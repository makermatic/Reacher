import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { inline, parseBlocks } from '../lib/markdown';
import { feedLineFor, feedLines } from './aiActions';
import { nextSteps } from './nextSteps';
import { DEFAULT_TEMPLATES } from './defaults';
import type { Chain, Company, Page } from './types';

const TODAY = '2026-10-30';
const co = (meta: Record<string, unknown>, due: string | null = null): Company => ({
  id: 'c1',
  name: 'Psyop',
  order: 1,
  meta,
  due,
});
const page = (meetings: Page['meetings'] = []): Page =>
  ({ notes: [], meetings, applications: [], events: [] }) as unknown as Page;
const chain = (messages: Chain['messages']): Chain =>
  ({ id: 'ch1', companyId: 'c1', title: 'Intro', started: '2026-10-01', messages }) as Chain;

describe('markdown', () => {
  it('groups lines into paragraphs, lists, quotes and headings', () => {
    const b = parseBlocks('# Plan\nline one\nline two\n\n- a\n- b\n1. x\n> quoted');
    expect(b.map((x) => x.kind)).toEqual(['h', 'p', 'ul', 'ol', 'quote']);
    expect(b[1]).toEqual({ kind: 'p', lines: ['line one', 'line two'] });
    expect(b[2]).toEqual({ kind: 'ul', items: ['a', 'b'] });
  });

  it('reads bold, italic, code and links, and never makes a script link', () => {
    const tags = (nodes: ReactNode[]) =>
      nodes.map((n) => (isValidElement(n) ? (n as ReactElement).type : 'text'));
    expect(tags(inline('**big** and *small* and `x`'))).toEqual([
      'strong',
      'text',
      'em',
      'text',
      'code',
    ]);
    const [link] = inline('[reel](zackzand.com)') as ReactElement<{ href: string }>[];
    expect(isValidElement(link)).toBe(true);
    // The link itself checks the address when it renders.
    expect((link as ReactElement<{ href: string }>).props.href).toBe('zackzand.com');
    expect(tags(inline('snake_case_name stays plain'))).toEqual(['text']);
  });
});

describe('AI feed lines', () => {
  it('keeps short strings and matches names loosely', () => {
    const lines = feedLines({
      'Sibling Rivalry': "Sibling Rivalry isn't hiring as of 10/30",
      x: 3,
    });
    expect(Object.keys(lines)).toEqual(['Sibling Rivalry']);
    expect(feedLineFor(lines, 'sibling rivalry')).toContain('as of 10/30');
    expect(feedLineFor(lines, 'Buck')).toBeNull();
    expect(feedLines('nope')).toEqual({});
  });
});

describe('suggested next steps', () => {
  it('nothing to suggest when nothing is owed', () => {
    expect(nextSteps(co({ status: 'gathering' }), page(), [], DEFAULT_TEMPLATES, TODAY)).toEqual(
      [],
    );
    expect(
      nextSteps(co({ status: 'reached' }, '2026-11-05'), page(), [], DEFAULT_TEMPLATES, TODAY),
    ).toEqual([]);
  });

  it('they wrote back: reply in the latest chain', () => {
    const [s] = nextSteps(
      co({ status: 'wroteback' }),
      page(),
      [chain([])],
      DEFAULT_TEMPLATES,
      TODAY,
    );
    expect(s).toMatchObject({ id: 'reply', target: 'ch1' });
  });

  it('a follow-up that is due: a check-in', () => {
    const [s] = nextSteps(
      co({ status: 'reached' }, '2026-10-28'),
      page(),
      [],
      DEFAULT_TEMPLATES,
      TODAY,
    );
    expect(s).toMatchObject({ id: 'follow-up', template: 'tpl-check' });
    expect(s!.text).toContain('was due');
  });

  it('a thank-you after a recent interview, until one goes out', () => {
    const met = page([
      { id: 'm1', date: '2026-10-27', start: '', end: '', kind: 'interview', with: '', notes: '' },
    ]);
    const steps = nextSteps(co({ status: 'interview' }), met, [], DEFAULT_TEMPLATES, TODAY);
    expect(steps.map((s) => s.id)).toEqual(['thanks']);
    expect(steps[0]!.template).toBe('tpl-thanks');
    const sent = chain([{ id: 'x', dir: 'out', date: '2026-10-28', text: 'Thanks!' }]);
    expect(nextSteps(co({ status: 'interview' }), met, [sent], DEFAULT_TEMPLATES, TODAY)).toEqual(
      [],
    );
  });
});
