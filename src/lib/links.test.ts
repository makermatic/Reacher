import { describe, expect, it } from 'vitest';
import { normalizeUrl } from './links';

describe('normalizeUrl', () => {
  it('adds https to a bare domain', () => {
    expect(normalizeUrl('zackzand.com')).toBe('https://zackzand.com');
    expect(normalizeUrl(' www.buck.tv/work ')).toBe('https://www.buck.tv/work');
    expect(normalizeUrl('zackzand.com:8080/reel')).toBe('https://zackzand.com:8080/reel');
  });

  it('keeps links that already say how to open', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('https://vimeo.com/1')).toBe('https://vimeo.com/1');
    expect(normalizeUrl('mailto:jobs@buck.tv')).toBe('mailto:jobs@buck.tv');
  });

  it('leaves blank blank', () => {
    expect(normalizeUrl('   ')).toBe('');
  });
});
