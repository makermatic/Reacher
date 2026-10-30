import { describe, expect, it } from 'vitest';
import { detectSeparator, parseCsv } from './csv';
import { cellValue, guessTargets, IGNORE, NEW_FIELD, planImport, withNewFields } from './csvImport';
import { colById } from './board';
import { DEFAULT_BOARD } from './defaults';
import type { Company } from './types';

const B = DEFAULT_BOARD;
const psyop: Company = {
  id: 'c1',
  name: 'Psyop',
  order: 1,
  due: null,
  meta: { status: 'reached', contact: { name: 'Sam', email: '', role: 'Recruiter' } },
};

describe('reading CSV', () => {
  it('handles quotes, commas, line breaks inside, and blank lines', () => {
    const rows = parseCsv('Company,Notes\n"Buck, Inc","said ""hi""\nthen left"\n\nPsyop,ok\n');
    expect(rows).toEqual([
      ['Company', 'Notes'],
      ['Buck, Inc', 'said "hi"\nthen left'],
      ['Psyop', 'ok'],
    ]);
  });
  it('finds tabs from a spreadsheet paste, and semicolons', () => {
    expect(detectSeparator('Company\tEmail\nBuck\ta@b.co')).toBe('\t');
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('matching columns', () => {
  it('by header: field names, common names, and Name as the company', () => {
    const header = ['Name', 'Contact', 'E-mail', 'Job Title', 'City', 'Stage', 'Whatever'];
    expect(guessTargets(B, header, [])).toEqual([
      'company',
      'person:contact:name',
      'person:contact:email',
      'person:contact:role',
      'col:city',
      'status',
      IGNORE,
    ]);
  });
  it('Name is the contact when another column is the company; first and last names', () => {
    expect(guessTargets(B, ['Studio', 'Name', 'First Name', 'Last Name'], [])).toEqual([
      'company',
      'person:contact:name',
      'person:contact:first',
      'person:contact:last',
    ]);
  });
  it('by contents when the header says nothing', () => {
    const rows = [
      ['Buck', 'fred@buck.co', 'buck.co'],
      ['Psyop', 'sam@psyop.com', 'https://psyop.com'],
    ];
    expect(guessTargets(B, ['Company', 'col2', 'col3'], rows)).toEqual([
      'company',
      'person:contact:email',
      'col:website',
    ]);
  });
});

describe('values', () => {
  it('reads status words, dates, tags and numbers', () => {
    const status = colById(B, 'status')!;
    expect(cellValue(status, 'Emailed')).toBe('reached');
    expect(cellValue(status, 'Wrote back!!')).toBe('wroteback');
    expect(cellValue(status, 'mystery')).toBeNull();
    expect(cellValue({ id: 'd', name: 'D', type: 'date' }, '11/6/2026')).toBe('2026-11-06');
    expect(cellValue({ id: 't', name: 'T', type: 'tags' }, 'Studio; Broadcast')).toEqual([
      'Studio',
      'Broadcast',
    ]);
    expect(cellValue({ id: 'n', name: 'N', type: 'number' }, '$1,200')).toBe(1200);
  });
});

describe('planning an import', () => {
  const header = ['Company', 'Contact', 'Email'];
  const rows = [
    ['Psyop', '', 'sam@psyop.com'],
    ['Oddfellows', 'Ana', 'ana@odd.co'],
    ['Oddfellows', 'Ben', 'ben@odd.co'],
    ['', 'Nobody', ''],
  ];
  const targets = guessTargets(B, header, rows);

  it('finds companies you have; skips them unless updating', () => {
    const skip = planImport(B, [psyop], header, rows, targets, false);
    expect(skip.rows.map((r) => r.state)).toEqual(['skip', 'new', 'merged', 'incomplete']);
    expect(skip.counts).toEqual({ create: 1, update: 0, skip: 2 });
    const upd = planImport(B, [psyop], header, rows, targets, true);
    expect(upd.rows[0]!.state).toBe('update');
    // The update keeps the contact's name and role, and adds the email.
    expect(upd.rows[0]!.meta.contact).toEqual({
      name: 'Sam',
      email: 'sam@psyop.com',
      role: 'Recruiter',
    });
  });

  it('the same company twice is one company; the first contact stays', () => {
    const plan = planImport(B, [], header, rows, targets, false);
    expect(plan.rows[1]!.meta.contact).toEqual({ name: 'Ana', email: 'ana@odd.co', role: '' });
    expect(plan.rows[2]).toMatchObject({ state: 'merged', into: 3 });
  });

  it('a place used twice keeps the first column', () => {
    const plan = planImport(
      B,
      [],
      ['Company', 'Studio'],
      [['A', 'B']],
      ['company', 'company'],
      false,
    );
    expect(plan.duplicates).toEqual(['company']);
    expect(plan.rows[0]!.name).toBe('A');
  });
});

describe('new fields from a file', () => {
  it('a column marked New field becomes a text field (or finds one with its name)', () => {
    const made = withNewFields(
      B,
      ['Company', 'Favorite color', 'City'],
      ['company', NEW_FIELD, NEW_FIELD],
    );
    const added = made.board.columns.at(-1)!;
    expect(added).toMatchObject({ name: 'Favorite color', type: 'text', onSheet: false });
    expect(made.targets).toEqual(['company', `col:${added.id}`, 'col:city']);
    const plan = planImport(
      made.board,
      [],
      ['Company', 'Favorite color'],
      [['A', 'blue']],
      made.targets,
      false,
    );
    expect(plan.rows[0]!.meta[added.id]).toBe('blue');
    expect(withNewFields(B, ['Company'], ['company']).board).toBe(B);
  });
});
