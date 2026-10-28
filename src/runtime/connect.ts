import { createClaudeAI, type AI } from './ai';
import { createClaudeStore } from './claudeStore';
import { createLocalStore } from './localStore';
import type { Store, StoreKind } from './store';

export type Connection = {
  /**
   * claude: the user's private space in Claude. local: this browser only.
   * no-access: inside Claude, but this viewer can't have a private space
   * (signed out, or not shared as a Contributor).
   */
  kind: StoreKind | 'no-access';
  store: Store;
  /** Claude on the viewer's own plan, or null where AI isn't available. */
  ai: AI | null;
};

/**
 * Work out where this visit's data lives and whether AI is available. Inside
 * a Claude artifact viewer that is the user's private db subtree and their
 * Claude plan; anywhere else, this browser's storage and no AI.
 */
export async function connect(): Promise<Connection> {
  const claude = (window as Partial<Window>).claude;
  if (!claude?.use) return { kind: 'local', store: createLocalStore(), ai: null };

  const [db, user, sample] = await Promise.all([
    claude.use('db'),
    claude.use('user'),
    claude.use('sample'),
  ]);
  const ai = sample ? createClaudeAI(sample) : null;
  if (!db || !user) return { kind: 'local', store: createLocalStore(), ai };

  const id = await user.id();
  if (!id) return { kind: 'no-access', store: createLocalStore(), ai };
  return { kind: 'claude', store: createClaudeStore(db, id), ai };
}
