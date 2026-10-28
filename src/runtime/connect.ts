import { createClaudeStore } from './claudeStore';
import { createLocalStore } from './localStore';
import type { Store, StoreKind } from './store';

export type Connection =
  | { kind: StoreKind; store: Store }
  /** Inside Claude, but this viewer can't have a private space (signed out, or not shared as a Contributor). */
  | { kind: 'no-access'; store: Store };

/**
 * Work out where this visit's data lives. Inside a Claude artifact viewer that
 * is the user's private db subtree; anywhere else, this browser's storage.
 */
export async function connect(): Promise<Connection> {
  const claude = (window as Partial<Window>).claude;
  if (!claude?.use) return { kind: 'local', store: createLocalStore() };

  const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  if (!db || !user) return { kind: 'local', store: createLocalStore() };

  const id = await user.id();
  if (!id) return { kind: 'no-access', store: createLocalStore() };
  return { kind: 'claude', store: createClaudeStore(db, id) };
}
