/** What every claude.ai connector call (Calendar, Gmail) can fail with, in plain words. */

export type ConnectorError = { code: string; message: string };

/** Errors that a click can fix by asking the viewer again. */
export const needsOk = (code: string) =>
  ['not_in_manifest', 'approval_required', 'consent_required'].includes(code);

/** Plain words for a connector error, by code (see contract/mcp.d.ts). */
export function connectorErrorMessage(e: unknown, server: string): string {
  const err = (e ?? {}) as Partial<ConnectorError>;
  switch (err.code) {
    case 'needs_reauth':
      return `Reconnect ${server} in claude.ai Settings → Connectors.`;
    case 'server_not_connected':
    case 'server_not_found':
      return `Add ${server} in claude.ai Settings → Connectors to use it here.`;
    case 'selection_required':
      return `You have more than one ${server} connected. Pick one when Claude asks.`;
    case 'not_in_manifest':
    case 'approval_required':
    case 'consent_required':
      return `Reacher needs your OK to use ${server}.`;
    case 'blocked_by_policy':
      return `Your organization doesn’t allow ${server} here.`;
    case 'server_unavailable':
      return `${server} didn’t answer. Try again in a moment.`;
    case 'not_granted':
    case 'capability_disabled':
    case 'capability_removed':
      return `${server} isn’t available in this view.`;
    case 'tool_error':
      return `${server} said: ${err.message ?? 'something went wrong'}`;
    default:
      return `Couldn’t reach ${server}. Try again.`;
  }
}
