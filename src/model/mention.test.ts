import { describe, expect, it } from 'vitest';
import { insertField, matchFields, mentionAt, type FieldItem } from './mention';

const items: FieldItem[] = [
  { key: 'first_name', label: 'First name', group: 'Contact' },
  { key: 'contact_name', label: 'Full name', group: 'Contact' },
  { key: 'company', label: 'Company name', group: 'Company' },
  { key: 'city', label: 'City', group: 'Company' },
  { key: 'my_name', label: 'Your name', group: 'You' },
];

describe('mentionAt', () => {
  it('opens on an @ at the start of a word', () => {
    expect(mentionAt('Hi @', 4)).toEqual({ start: 3, query: '' });
    expect(mentionAt('@fir', 4)).toEqual({ start: 0, query: 'fir' });
    expect(mentionAt('Hi\n@co', 6)).toEqual({ start: 3, query: 'co' });
  });
  it('ignores email addresses and finished words', () => {
    expect(mentionAt('zack@studio', 11)).toBeNull();
    expect(mentionAt('Hi @first name', 14)).toBeNull();
    expect(mentionAt('no at sign', 5)).toBeNull();
  });
  it('only looks before the caret', () => {
    expect(mentionAt('Hi @fi and more', 6)).toEqual({ start: 3, query: 'fi' });
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
  it('replaces the @query with the token', () => {
    expect(insertField('Hi @fir!', 3, 7, 'first_name')).toEqual({
      text: 'Hi {{first_name}}!',
      caret: 17,
    });
  });
});
