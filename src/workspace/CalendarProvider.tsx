import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readPref, writePref } from '../lib/prefs';
import { eventInput, type CalEvent } from '../model/calendar';
import type { Company, Meeting } from '../model/types';
import { calendarErrorMessage, type CalendarError } from '../runtime/calendar';
import { useRuntime } from '../runtime/RuntimeProvider';
import { useWorkspace, type Workspace } from './WorkspaceProvider';

type CalendarState = {
  /** The Google Calendar connector can be used from this view. */
  available: boolean;
  /** Upcoming events (next 60 days); null until loaded. */
  events: CalEvent[] | null;
  error: CalendarError | null;
  /** Start keeping upcoming events current (called by whatever shows them). */
  watch: () => void;
  /** Fetch again now; this also asks the viewer for their OK if needed. */
  retry: () => Promise<void>;
  /** Puts a meeting on Google Calendar and remembers the event. Resolves an error message, or null. */
  addToCalendar: (company: Company, meeting: Meeting) => Promise<string | null>;
};

/** "Also add upcoming meetings to Google Calendar", remembered per device. On by default. */
export const calendarAuto = {
  get: () => readPref('calendar-auto', true, (v): v is boolean => typeof v === 'boolean'),
  set: (on: boolean) => writePref('calendar-auto', on),
};

const CalendarContext = createContext<CalendarState | null>(null);

export function useCalendar() {
  const c = useContext(CalendarContext);
  if (!c) throw new Error('useCalendar needs a CalendarProvider');
  return c;
}

/**
 * Google Calendar for the whole app (M8). Nothing is fetched until a company
 * page asks (`watch`), so opening Reacher never prompts for the calendar.
 */
export function CalendarProvider({ children }: { children: ReactNode }) {
  const runtime = useRuntime();
  const ws = useWorkspace();
  const calendar = runtime.status === 'ready' ? runtime.calendar : null;
  const [watching, setWatching] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [error, setError] = useState<CalendarError | null>(null);

  // Calendar answers arrive after a wait; write to the latest data.
  const wsRef = useRef<Workspace>(ws);
  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  useEffect(() => {
    if (!calendar || !watching) return;
    return calendar.watchUpcoming(
      (list) => {
        setEvents(list);
        setError(null);
      },
      (e) => {
        setError(e);
        // Denials take the data away; a blip keeps what's shown.
        if (e.code !== 'server_unavailable') setEvents(null);
      },
    );
  }, [calendar, watching, epoch]);

  const watch = useCallback(() => setWatching(true), []);

  const retry = useCallback(async () => {
    if (!calendar) return;
    try {
      setEvents(await calendar.refresh());
      setError(null);
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(e as CalendarError);
    }
  }, [calendar]);

  const addToCalendar = useCallback(
    async (company: Company, meeting: Meeting) => {
      if (!calendar) return 'Google Calendar works when Reacher is open in Claude.';
      try {
        const made = await calendar.add(eventInput(company.name, meeting));
        wsRef.current.actions.patchMeeting(company.id, meeting.id, {
          calendarEventId: made.id,
          calendarLink: made.link,
        });
        return null;
      } catch (e) {
        return calendarErrorMessage(e);
      }
    },
    [calendar],
  );

  const value = useMemo<CalendarState>(
    () => ({ available: !!calendar, events, error, watch, retry, addToCalendar }),
    [calendar, events, error, watch, retry, addToCalendar],
  );
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}
