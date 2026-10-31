/**
 * The one storage interface the app talks to. Everything is scoped to the
 * signed-in user, so callers never see user ids or backend paths.
 *
 * Today it's backed by the Claude artifact `db` (claudeStore.ts) or by
 * localStorage during local development and tests (localStore.ts). Moving
 * Reacher to its own server means writing one more implementation of this.
 */

/** A plain JSON object, the only shape a stored value can take. */
export type Json = { [key: string]: unknown };

export type Unsubscribe = () => void;

export interface Store {
  /** Read a single named document (e.g. "me"). Resolves null when absent. */
  getDoc<T extends Json>(name: string): Promise<T | null>;
  /** Replace a single named document. */
  setDoc<T extends Json>(name: string, value: T): Promise<void>;
  /** Live updates for a named document. Fires soon after subscribing, then on every change. */
  watchDoc<T extends Json>(name: string, onChange: (value: T | null) => void): Unsubscribe;

  /** Live updates for every item in a collection (e.g. "companies"), keyed by item id. */
  watchCollection<T extends Json>(
    collection: string,
    onChange: (items: Record<string, T>) => void,
  ): Unsubscribe;
  /** Create or replace one item in a collection. */
  setItem<T extends Json>(collection: string, id: string, value: T): Promise<void>;
  /**
   * Merge fields into an existing item: nested objects merge, anything else
   * (arrays included) replaces. `null` stores null. Rejects if the item doesn't exist.
   */
  updateItem(collection: string, id: string, patch: Json): Promise<void>;
  /** Delete one item from a collection. */
  deleteItem(collection: string, id: string): Promise<void>;
}

/** Where the data lives for this visit. */
export type StoreKind =
  /** Saved to the user's private space in Claude, synced across devices. */
  | 'claude'
  /** Saved in this browser only (local development, or opened outside Claude). */
  | 'local';
