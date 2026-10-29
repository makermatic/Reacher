/**
 * Gmail through the viewer's own claude.ai connector (M9). Reacher reads
 * threads and saves drafts; it never sends. The data side (threads ↔ chains)
 * is in src/model/gmail.ts.
 */
import { toMailThread, toThreadHits, type MailThread, type ThreadHit } from '../model/gmail';
import { connectorErrorMessage } from './connectors';

/** The connector's display name in claude.ai, as declared in the publish manifest. */
export const GMAIL = 'Gmail';

export type DraftInput = {
  to: string[];
  subject: string;
  body: string;
  /** Makes it a reply in that message's thread. */
  replyToMessageId?: string;
};

export interface Gmail {
  /** Thread ids (and message counts) matching a Gmail search. */
  search(query: string, pageSize?: number): Promise<ThreadHit[]>;
  /** One thread with every message's text. */
  thread(id: string): Promise<MailThread | null>;
  /** Saves a draft in the viewer's Gmail; resolves its thread and a link. */
  draft(input: DraftInput): Promise<{ threadId: string; link: string }>;
  /** Has the viewer already allowed Gmail for Reacher? Reads only; never asks. */
  allowed(): Promise<boolean>;
}

type Mcp = typeof Claude.mcp;
type Permissions = typeof Claude.permissions;

export function createClaudeGmail(mcp: Mcp, permissions: Permissions | null): Gmail {
  return {
    async search(query, pageSize = 20) {
      const r = await mcp.callTool(GMAIL, 'search_threads', {
        query,
        pageSize,
        view: 'THREAD_VIEW_METADATA_ONLY',
      });
      return toThreadHits(r.payload);
    },
    async thread(id) {
      const r = await mcp.callTool(GMAIL, 'get_thread', {
        threadId: id,
        messageFormat: 'PLAIN_TEXT',
      });
      return toMailThread(r.payload);
    },
    async draft(input) {
      const r = await mcp.callTool(GMAIL, 'create_draft', input);
      const p = (r.payload ?? {}) as { threadId?: unknown; viewUrl?: unknown };
      return { threadId: String(p.threadId ?? ''), link: String(p.viewUrl ?? '') };
    },
    async allowed() {
      if (!permissions) return false;
      return (await permissions.state(`mcp:${GMAIL}`).catch(() => 'unavailable')) === 'granted';
    },
  };
}

/** Plain words for a Gmail connector error. */
export const gmailErrorMessage = (e: unknown) => connectorErrorMessage(e, GMAIL);
