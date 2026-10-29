/**
 * Google Calendar through the viewer's own claude.ai connector (M8). Calls run
 * with the viewer's Google account; Reacher never sees a token. The data side
 * (meetings ↔ events) is in src/model/calendar.ts.
 */
import { addDays, todayISO } from '../model/dates';
import { createdId, toCalEvents, type CalEvent, type eventInput } from '../model/calendar';

/** The connector's display name in claude.ai, as declared in the publish manifest. */
export const CALENDAR = 'Google Calendar';
/** How far ahead "From your calendar" looks. */
const LOOKAHEAD_DAYS = 60;

export type CalendarError = { code: string; message: string };

export interface Calendar {
  /** Creates an event; resolves its id and link. */
  add(input: ReturnType<typeof eventInput>): Promise<{ id: string; link: string }>;
  /** Upcoming events, kept current; returns an unsubscribe. */
  watchUpcoming(
    onEvents: (events: CalEvent[]) => void,
    onError: (e: CalendarError) => void,
  ): () => void;
  /** Fetches upcoming events now (also how a viewer gives the first OK). */
  refresh(): Promise<CalEvent[]>;
}

type Mcp = typeof Claude.mcp;

const upcomingInput = () => {
  const today = todayISO();
  return {
    startTime: `${today}T00:00:00`,
    endTime: `${addDays(today, LOOKAHEAD_DAYS)}T00:00:00`,
    orderBy: 'startTime',
    pageSize: 250,
  };
};

export function createClaudeCalendar(mcp: Mcp): Calendar {
  return {
    async add(input) {
      const r = await mcp.callTool(CALENDAR, 'create_event', input);
      const made = createdId(r.payload);
      if (!made)
        throw { code: 'tool_error', message: 'The calendar didn’t say which event it made.' };
      return made;
    },
    watchUpcoming(onEvents, onError) {
      return mcp.watchTool(
        CALENDAR,
        'list_events',
        upcomingInput(),
        (ev) => (ev.type === 'data' ? onEvents(toCalEvents(ev.result.payload)) : onError(ev.error)),
        { cache: { staleTime: 60_000, gcTime: 30 * 60_000 }, refetchInterval: 5 * 60_000 },
      );
    },
    async refresh() {
      const r = await mcp.callTool(CALENDAR, 'list_events', upcomingInput(), {
        cache: { staleTime: 0, gcTime: 30 * 60_000, refresh: true },
      });
      return toCalEvents(r.payload);
    },
  };
}

/** Errors that a click can fix by asking the viewer again. */
export const needsOk = (code: string) =>
  ['not_in_manifest', 'approval_required', 'consent_required'].includes(code);

/** Plain words for a connector error, by code. */
export function calendarErrorMessage(e: unknown): string {
  const err = (e ?? {}) as Partial<CalendarError>;
  switch (err.code) {
    case 'needs_reauth':
      return 'Reconnect Google Calendar in claude.ai Settings → Connectors.';
    case 'server_not_connected':
    case 'server_not_found':
      return 'Add Google Calendar in claude.ai Settings → Connectors to use it here.';
    case 'selection_required':
      return 'You have more than one Google Calendar connected. Pick one when Claude asks.';
    case 'not_in_manifest':
    case 'approval_required':
    case 'consent_required':
      return 'Reacher needs your OK to use Google Calendar.';
    case 'blocked_by_policy':
      return 'Your organization doesn’t allow Google Calendar here.';
    case 'server_unavailable':
      return 'Google Calendar didn’t answer. Try again in a moment.';
    case 'not_granted':
    case 'capability_disabled':
    case 'capability_removed':
      return 'Google Calendar isn’t available in this view.';
    case 'tool_error':
      return `Google Calendar said: ${err.message ?? 'something went wrong'}`;
    default:
      return 'Couldn’t reach Google Calendar. Try again.';
  }
}
