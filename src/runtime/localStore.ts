import type { Json, Store, Unsubscribe } from './store';

/**
 * A Store kept in this browser's localStorage. Used for local development,
 * tests, and as the fallback when Reacher is opened outside Claude.
 * Changes reach other listeners in the same page immediately.
 */
export function createLocalStore(prefix = 'reacher:'): Store {
  const memory = new Map<string, string>();
  const listeners = new Map<string, Set<() => void>>();

  const read = (key: string): Json | null => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(prefix + key);
    } catch {
      raw = memory.get(key) ?? null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as Json;
    } catch {
      return null;
    }
  };

  const write = (key: string, value: Json | null) => {
    const raw = value === null ? null : JSON.stringify(value);
    try {
      if (raw === null) localStorage.removeItem(prefix + key);
      else localStorage.setItem(prefix + key, raw);
    } catch {
      if (raw === null) memory.delete(key);
      else memory.set(key, raw);
    }
    listeners.get(key)?.forEach((fn) => fn());
  };

  const listen = (key: string, fn: () => void): Unsubscribe => {
    let set = listeners.get(key);
    if (!set) listeners.set(key, (set = new Set()));
    set.add(fn);
    // Fire asynchronously, like the real store does.
    queueMicrotask(fn);
    return () => set.delete(fn);
  };

  const docKey = (name: string) => `doc/${name}`;
  const colKey = (collection: string) => `col/${collection}`;
  const readCollection = (collection: string) => (read(colKey(collection)) ?? {}) as Json;

  return {
    async getDoc<T extends Json>(name: string) {
      return read(docKey(name)) as T | null;
    },
    async setDoc(name, value) {
      write(docKey(name), value);
    },
    watchDoc<T extends Json>(name: string, onChange: (value: T | null) => void) {
      return listen(docKey(name), () => onChange(read(docKey(name)) as T | null));
    },
    watchCollection<T extends Json>(
      collection: string,
      onChange: (items: Record<string, T>) => void,
    ) {
      return listen(colKey(collection), () =>
        onChange(readCollection(collection) as Record<string, T>),
      );
    },
    async setItem(collection, id, value) {
      write(colKey(collection), { ...readCollection(collection), [id]: value });
    },
    async deleteItem(collection, id) {
      const items = { ...readCollection(collection) };
      delete items[id];
      write(colKey(collection), items);
    },
  };
}
