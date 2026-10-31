import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from './defaults';
import { isDefaultTitle, mailQuery, subjectOf, threadCompany } from './gmail';
import { parseExport } from './importData';
import {
  chainsOf,
  contactsAt,
  contactsFromCompanies,
  mentionedIn,
  movePatch,
  newContact,
} from './people';
import type { Company, Contact } from './types';

const co = (id: string, name: string, meta: Record<string, unknown> = {}): Company => ({
  id,
  name,
  order: 1,
  meta,
  due: null,
});

describe('people (M11)', () => {
  it('a new person is thumbs up', () => {
    expect(newContact(' Ana ', 'c1').meta.status).toBe('up');
    expect(newContact('Ana', null).name).toBe('Ana');
  });

  it('Main contacts become people once, with role and email', () => {
    const companies = [
      co('c1', 'Psyop', { contact: { name: 'Sam', email: 'sam@psyop.com', role: 'Recruiter' } }),
      co('c2', 'Buck', { contact: { name: '', email: '', role: '' } }),
    ];
    const made = contactsFromCompanies(DEFAULT_BOARD, companies, []);
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({
      name: 'Sam',
      companyId: 'c1',
      meta: { status: 'up', role: 'Recruiter', email: 'sam@psyop.com' },
    });
    // Not again once they exist.
    expect(contactsFromCompanies(DEFAULT_BOARD, companies, made)).toEqual([]);
  });

  it('moving keeps where they were; thumbs down sorts last', () => {
    const p: Contact = { ...newContact('Ana', 'c1'), id: 'pe-1' };
    expect(movePatch(p, 'c2', '2026-10-31')).toEqual({
      companyId: 'c2',
      pastCompanies: [{ companyId: 'c1', until: '2026-10-31' }],
    });
    expect(movePatch(p, 'c1', '2026-10-31')).toEqual({});
    const down: Contact = { ...newContact('Bo', 'c1'), id: 'pe-2', order: 0 };
    down.meta.status = 'down';
    expect(contactsAt([down, p], 'c1').map((x) => x.name)).toEqual(['Ana', 'Bo']);
  });

  it("people's emails count for Gmail", () => {
    const c = co('c1', 'Oddfellows');
    expect(mailQuery(DEFAULT_BOARD, [c], 30)).toBeNull();
    expect(mailQuery(DEFAULT_BOARD, [c], 30, { c1: ['ana@odd.co'] })).toContain('from:ana@odd.co');
    const thread = {
      id: 't',
      subject: '',
      messages: [{ id: 'm', from: 'ana@odd.co', to: ['me@x.co'], date: '2026-10-30', text: '' }],
    };
    expect(threadCompany(DEFAULT_BOARD, [c], thread as never, { c1: ['ana@odd.co'] })?.id).toBe(
      'c1',
    );
  });

  it('exports keep people; old exports have none', () => {
    const d = parseExport(
      JSON.stringify({
        companies: [{ id: 'c1', name: 'Psyop', meta: {} }],
        people: [{ id: 'pe-1', name: 'Sam', companyId: 'c1', meta: { status: 'down' } }],
        pages: { 'pe-1': { notes: [], meetings: [], applications: [], events: [] } },
        chains: [],
        templates: [],
      }),
    );
    expect(d.people[0]).toMatchObject({ name: 'Sam', companyId: 'c1', meta: { status: 'down' } });
    expect(Object.keys(d.pages)).toContain('pe-1');
    expect(parseExport(JSON.stringify({ companies: [], chains: [], pages: {} })).people).toEqual(
      [],
    );
  });
});

describe('notes and emails for a person (M11)', () => {
  const at = (name: string, id: string, email = ''): Contact => ({
    ...newContact(name, 'c1', email ? { email } : {}),
    id,
  });
  const people = [at('Ana Ruiz', 'pe-1'), at('Ben Lee', 'pe-2'), at('Ben Ortiz', 'pe-3')];

  it('a note names someone by full name, or a first name only one of them has', () => {
    expect(mentionedIn(people, 'c1', 'Talked to ana about the reel').map((p) => p.id)).toEqual([
      'pe-1',
    ]);
    // Two Bens: only the full name counts.
    expect(mentionedIn(people, 'c1', 'Ben said hi')).toEqual([]);
    expect(mentionedIn(people, 'c1', 'Ben Lee said hi').map((p) => p.id)).toEqual(['pe-2']);
    // Not inside other words, and only people at that company.
    expect(mentionedIn(people, 'c1', 'Banana bread')).toEqual([]);
    expect(mentionedIn(people, 'c2', 'Ana')).toEqual([]);
  });

  it("a person's chains: threads they're on, and chains started with them", () => {
    const ana = at('Ana Ruiz', 'pe-1', 'Ana@Odd.co');
    const chain = (id: string, extra: object) =>
      ({
        id,
        companyId: 'c1',
        title: id,
        started: '2026-10-01',
        messages: [],
        summary: null,
        ...extra,
      }) as never;
    const list = [
      chain('a', { people: ['ana@odd.co', 'me@x.co'] }),
      chain('b', { personIds: ['pe-1'] }),
      chain('c', { people: ['ben@odd.co'] }),
    ];
    expect(
      chainsOf(ana, list)
        .map((c: { id: string }) => c.id)
        .sort(),
    ).toEqual(['a', 'b']);
  });
});

describe('chain names', () => {
  it('a chain on its starting name takes the email subject', () => {
    expect(isDefaultTitle('Email chain Oct 31')).toBe(true);
    expect(isDefaultTitle('Email with Ana Oct 31')).toBe(true);
    expect(isDefaultTitle('Intro to Sam')).toBe(false);
    expect(subjectOf('Subject: Re: Motion designer\n\nHi')).toBe('Motion designer');
    expect(subjectOf('Hi Sam,\nno subject here')).toBe('');
  });
});
