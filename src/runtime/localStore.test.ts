import { beforeEach, describe, expect, it } from 'vitest';
import { createLocalStore } from './localStore';

const nextTick = () => new Promise((r) => setTimeout(r, 0));

describe('localStore', () => {
  beforeEach(() => localStorage.clear());

  it('reads back a document it wrote', async () => {
    const store = createLocalStore();
    expect(await store.getDoc('me')).toBeNull();
    await store.setDoc('me', { name: 'Zack' });
    expect(await store.getDoc('me')).toEqual({ name: 'Zack' });
  });

  it('notifies document watchers on subscribe and on change', async () => {
    const store = createLocalStore();
    const seen: unknown[] = [];
    const stop = store.watchDoc('me', (v) => seen.push(v));
    await nextTick();
    await store.setDoc('me', { name: 'Zack' });
    stop();
    await store.setDoc('me', { name: 'Ignored' });
    expect(seen).toEqual([null, { name: 'Zack' }]);
  });

  it('keeps collection items by id', async () => {
    const store = createLocalStore();
    const seen: Record<string, unknown>[] = [];
    store.watchCollection('companies', (items) => seen.push(items));
    await nextTick();
    await store.setItem('companies', 'a', { name: 'Buck' });
    await store.setItem('companies', 'b', { name: 'Gunner' });
    await store.deleteItem('companies', 'a');
    expect(seen.at(-1)).toEqual({ b: { name: 'Gunner' } });
  });
});
