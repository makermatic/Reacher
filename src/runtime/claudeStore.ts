import type { Json, Store } from './store';

/**
 * A Store backed by the Claude artifact `db`, inside the viewer's private
 * subtree `data/users/<id>/`, which no one else can read, the artifact's
 * owner included.
 *
 * Layout:
 *   data/users/<id>/<name>                      named documents ("me", "board", ...)
 *   data/users/<id>/ws/<collection>/<itemId>    collection items ("companies", ...)
 */
export function createClaudeStore(db: DB, userId: string): Store {
  const base = `data/users/${userId}`;

  // The db wants one write at a time per document: queue writes by path.
  const queues = new Map<string, Promise<unknown>>();
  const enqueue = (ref: DocumentReference, write: () => Promise<void>) => {
    const next = (queues.get(ref.path) ?? Promise.resolve()).catch(() => {}).then(write);
    queues.set(ref.path, next);
    return next;
  };

  const doc = (name: string) => db.doc(`${base}/${name}`);
  const collection = (name: string) => db.doc(`${base}/ws`).collection(name);

  return {
    async getDoc<T extends Json>(name: string) {
      const snap = await doc(name).get();
      return snap.exists ? (snap.data() as T) : null;
    },
    async setDoc(name, value) {
      const ref = doc(name);
      await enqueue(ref, () => ref.set(value));
    },
    watchDoc<T extends Json>(name: string, onChange: (value: T | null) => void) {
      return doc(name).onSnapshot(
        (snap) => onChange(snap.exists ? (snap.data() as T) : null),
        (error) => console.error(`Reacher: stopped syncing "${name}"`, error),
      );
    },
    watchCollection<T extends Json>(name: string, onChange: (items: Record<string, T>) => void) {
      return collection(name).onSnapshot(
        (snap) => {
          const items: Record<string, T> = {};
          for (const d of snap.docs) if (d.exists) items[d.id] = d.data() as T;
          onChange(items);
        },
        (error) => console.error(`Reacher: stopped syncing "${name}"`, error),
      );
    },
    async setItem(name, id, value) {
      const ref = collection(name).doc(id);
      await enqueue(ref, () => ref.set(value));
    },
    async updateItem(name, id, patch) {
      const ref = collection(name).doc(id);
      await enqueue(ref, () => ref.update(patch));
    },
    async deleteItem(name, id) {
      const ref = collection(name).doc(id);
      await enqueue(ref, () => ref.delete());
    },
  };
}
