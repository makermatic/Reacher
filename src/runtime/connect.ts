import { createClaudeAI, type AI } from './ai';
import { createClaudeCalendar, type Calendar } from './calendar';
import { createClaudeGmail, type Gmail } from './gmail';
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
  /** Offers the viewer a file to save (Export), or null where that isn't available. */
  saveFile: ((filename: string, data: string) => Promise<void>) | null;
  /** The viewer's Google Calendar through their connector, or null where connectors aren't available. */
  calendar: Calendar | null;
  /** The viewer's Gmail through their connector, or null where connectors aren't available. */
  gmail: Gmail | null;
};

/**
 * Work out where this visit's data lives and whether AI is available. Inside
 * a Claude artifact viewer that is the user's private db subtree and their
 * Claude plan; anywhere else, this browser's storage and no AI.
 */
export async function connect(): Promise<Connection> {
  const claude = (window as Partial<Window>).claude;
  if (!claude?.use)
    return {
      kind: 'local',
      store: createLocalStore(),
      ai: null,
      saveFile: null,
      calendar: null,
      gmail: null,
    };

  const [db, user, sample, downloads, mcp] = await Promise.all([
    claude.use('db'),
    claude.use('user'),
    claude.use('sample'),
    claude.use('downloads'),
    claude.use('mcp'),
  ]);
  const calendar = mcp ? createClaudeCalendar(mcp) : null;
  const gmail = mcp ? createClaudeGmail(mcp, await claude.use('permissions')) : null;
  const ai = sample ? createClaudeAI(sample) : null;
  const saveFile = downloads
    ? async (filename: string, data: string) => {
        await downloads.save({ filename, data });
      }
    : null;
  if (!db || !user)
    return { kind: 'local', store: createLocalStore(), ai, saveFile, calendar, gmail };

  const id = await user.id();
  if (!id) return { kind: 'no-access', store: createLocalStore(), ai, saveFile, calendar, gmail };
  return { kind: 'claude', store: createClaudeStore(db, id), ai, saveFile, calendar, gmail };
}
