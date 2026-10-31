import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from './defaults';
import { mailQuery, threadCompany } from './gmail';
import { parseExport } from './importData';
import { contactsAt, contactsFromCompanies, movePatch, newContact } from './people';
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
