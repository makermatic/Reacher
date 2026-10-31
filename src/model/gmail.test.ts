import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from './defaults';
import {
  addressOf,
  baseSubject,
  freshText,
  knownCount,
  latestEmail,
  mailQuery,
  syncThread,
  threadCompany,
  toMailThread,
  toThreadHits,
  type MailThread,
} from './gmail';
import type { Chain, Company } from './types';

const site = DEFAULT_BOARD.columns.find((c) => c.type === 'link')!.id;
const contact = DEFAULT_BOARD.columns.find((c) => c.type === 'person')!.id;
const company = (id: string, meta: Record<string, unknown>): Company => ({
  id,
  name: id,
  order: 1,
  meta,
  due: null,
});
const psyop = company('psyop', { [site]: 'https://www.psyop.tv/work' });
const gretel = company('gretel', {
  [contact]: { name: 'Fred', email: 'Fred@gmail.com', role: '' },
});
const buck = company('buck', {});

const raw = {
  id: 't1',
  viewUrl: 'https://mail.google.com/t1',
  messages: [
    {
      id: 'm2',
      sender: 'Sam Lee <sam@psyop.tv>',
      toRecipients: ['me@gmail.com'],
      date: '2026-10-20T15:00:00Z',
      subject: 'Re: Motion designer',
      plaintextBody:
        'Thanks! Send your reel.\n\nOn Mon, Oct 19, 2026 at 9:00 AM Zack wrote:\n> Hi Sam',
      labelIds: ['INBOX'],
    },
    {
      id: 'm1',
      sender: 'me@gmail.com',
      toRecipients: ['sam@psyop.tv'],
      date: '2026-10-19T13:00:00Z',
      subject: 'Motion designer',
      plaintextBody: 'Hi Sam, I love your work.',
      labelIds: ['SENT'],
    },
    { id: 'd1', sender: 'me@gmail.com', labelIds: ['DRAFT'], date: '2026-10-21T00:00:00Z' },
  ],
};

describe('gmail: reading the connector', () => {
  it('addresses, subjects and quoted replies', () => {
    expect(addressOf('Sam Lee <Sam@Psyop.tv>')).toBe('sam@psyop.tv');
    expect(addressOf('sam@psyop.tv')).toBe('sam@psyop.tv');
    expect(baseSubject('Re: Fwd: RE: Hello')).toBe('Hello');
    expect(
      freshText(
        'Sounds good.\n\nOn Tue, Oct 20, 2026 at 3:00 PM Sam Lee <\nsam@psyop.tv> wrote:\n> old',
      ),
    ).toBe('Sounds good.');
    expect(freshText('Hi\n\nFrom: Sam\nSent: Monday\nOld stuff')).toBe('Hi');
    expect(freshText('Hi\n-----Original Message-----\nold')).toBe('Hi');
  });

  it('a thread: oldest first, drafts left out, sent marked, subject without Re:', () => {
    const t = toMailThread(raw)!;
    expect(t.subject).toBe('Motion designer');
    expect(t.link).toBe('https://mail.google.com/t1');
    expect(t.messages.map((m) => [m.id, m.sent, m.from, m.text])).toEqual([
      ['m1', true, 'me@gmail.com', 'Hi Sam, I love your work.'],
      ['m2', false, 'sam@psyop.tv', 'Thanks! Send your reel.'],
    ]);
    expect(toMailThread({})).toBeNull();
    expect(toThreadHits({ threads: [{ id: 'a', messageCount: 3 }, { nope: 1 }] })).toEqual([
      { id: 'a', messageCount: 3 },
    ]);
    expect(toThreadHits({})).toEqual([]);
  });
});

describe('gmail: companies', () => {
  it('searches by website domain and personal-address contacts', () => {
    expect(mailQuery(DEFAULT_BOARD, [psyop, gretel, buck], 30)).toBe(
      '(from:psyop.tv OR to:psyop.tv OR from:fred@gmail.com OR to:fred@gmail.com) newer_than:30d -category:promotions -category:social',
    );
    expect(mailQuery(DEFAULT_BOARD, [buck], 30)).toBeNull();
  });

  it('matches a thread by contact address, then by domain', () => {
    const t = toMailThread(raw)!;
    expect(threadCompany(DEFAULT_BOARD, [buck, gretel, psyop], t)?.id).toBe('psyop');
    const fred: MailThread = { ...t, messages: [{ ...t.messages[0]!, to: ['fred@gmail.com'] }] };
    expect(threadCompany(DEFAULT_BOARD, [psyop, gretel], fred)?.id).toBe('gretel');
    const other: MailThread = { ...t, messages: [{ ...t.messages[0]!, to: ['x@else.com'] }] };
    expect(threadCompany(DEFAULT_BOARD, [buck], other)).toBeNull();
  });
});

describe('gmail: into chains', () => {
  const thread = toMailThread(raw)!;

  it('a new thread becomes a new chain', () => {
    const r = syncThread(psyop, [], thread)!;
    expect(r.linked).toBe(true);
    expect(r.chain).toMatchObject({
      companyId: 'psyop',
      title: 'Motion designer',
      started: '2026-10-19',
      gmailThreadId: 't1',
    });
    expect(r.added.map((m) => [m.dir, m.gmailId])).toEqual([
      ['out', 'm1'],
      ['in', 'm2'],
    ]);
  });

  it('joins the chain with the same title and links pasted copies instead of doubling them', () => {
    const pasted: Chain = {
      id: 'c1',
      companyId: 'psyop',
      title: 'Motion designer',
      started: '2026-10-19',
      messages: [{ id: 'x', dir: 'out', date: '2026-10-19', text: 'Hi Sam, I love your work.' }],
      summary: null,
    };
    const r = syncThread(psyop, [pasted], thread)!;
    expect(r.chain.id).toBe('c1');
    expect(r.chain.messages.map((m) => [m.id === 'x', m.gmailId])).toEqual([
      [true, 'm1'],
      [false, 'm2'],
    ]);
    expect(r.added).toHaveLength(1);
    // Synced again with nothing new: no change.
    expect(syncThread(psyop, [r.chain], thread)).toBeNull();
    expect(knownCount([r.chain], 't1')).toBe(2);
    expect(latestEmail([r.chain], 'psyop')).toBe('2026-10-20');
  });
});
