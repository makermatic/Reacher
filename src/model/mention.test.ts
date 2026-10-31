import { describe, expect, it } from 'vitest';
import {
  fromHashes,
  insertField,
  matchFields,
  mentionAt,
  toHashes,
  type FieldItem,
} from './mention';

const items: FieldItem[] = [
  { key: 'first_name', label: 'First name', group: 'Contact' },
  { key: 'contact_name', label: 'Full name', group: 'Contact' },
  { key: 'company', label: 'Company name', group: 'Company' },
  { key: 'city', label: 'City', group: 'Company' },
  { key: 'my_name', label: 'Your name', group: 'You' },
];

describe('mentionAt', () => {
  it('opens on a # that starts a word, even after punctuation', () => {
    expect(mentionAt('Hi #', 4)).toEqual({ start: 3, query: '' });
    expect(mentionAt('#fir', 4)).toEqual({ start: 0, query: 'fir' });
    expect(mentionAt('Hi\n#co', 6)).toEqual({ start: 3, query: 'co' });
    expect(mentionAt('need.#por', 9)).toEqual({ start: 5, query: 'por' });
  });
  it('ignores # inside words and finished words', () => {
    expect(mentionAt('C#', 2)).toBeNull();
    expect(mentionAt('Hi #first name', 14)).toBeNull();
    expect(mentionAt('no hash', 5)).toBeNull();
  });
  it('only looks before the caret', () => {
    expect(mentionAt('Hi #fi and more', 6)).toEqual({ start: 3, query: 'fi' });
  });
});

describe('matchFields', () => {
  it('shows everything for an empty query', () => {
    expect(matchFields(items, '')).toHaveLength(items.length);
  });
  it('puts prefix matches first, then word starts', () => {
    expect(matchFields(items, 'name').map((i) => i.key)).toEqual([
      'first_name',
      'contact_name',
      'company',
      'my_name',
    ]);
    expect(matchFields(items, 'co').map((i) => i.key)).toEqual(['contact_name', 'company']);
    expect(matchFields(items, 'first_n').map((i) => i.key)).toEqual(['first_name']);
  });
});

describe('insertField', () => {
  it('replaces the #query with the field', () => {
    expect(insertField('Hi #fir!', 3, 7, 'first_name')).toEqual({
      text: 'Hi #first_name!',
      caret: 14,
    });
  });
});

describe('# and {{}} round trip', () => {
  const keys = new Set(['first_name', 'company', 'company_type', 'my_portfolio']);
  it('shows known fields as # and leaves the rest', () => {
    expect(toHashes('Hi {{first_name}}, {{unknown}} at {{company}}.', keys)).toBe(
      'Hi #first_name, {{unknown}} at #company.',
    );
  });
  it('stores # fields as {{}}, longest field first, with trailing text kept', () => {
    expect(fromHashes("Hi #first_name, #company's #company_type work. C# #nope", keys)).toBe(
      "Hi {{first_name}}, {{company}}'s {{company_type}} work. C# #nope",
    );
    expect(fromHashes('#companyX', keys)).toBe('{{company}}X');
  });
  it('round-trips', () => {
    const t = 'Hi {{first_name}},\n{{my_portfolio}}';
    expect(fromHashes(toHashes(t, keys), keys)).toBe(t);
  });
});
