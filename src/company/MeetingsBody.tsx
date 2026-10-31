import { useEffect, useState, type FormEvent } from 'react';
import { btn, field, fieldInline } from '../components/Modal';
import { useToast } from '../components/Toast';
import { googleCalendarLink } from '../model/automation';
import { eventMatches, meetingFromEvent, type CalEvent } from '../model/calendar';
import { fmtDate, fmtTime, todayISO } from '../model/dates';
import { uid } from '../model/text';
import type { Company, Meeting } from '../model/types';
import { calendarErrorMessage } from '../runtime/calendar';
import { needsOk } from '../runtime/connectors';
import { calendarAuto, useCalendar } from '../workspace/CalendarProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { hint, newest, submitOnEnter } from './EntrySections';
import { addForm, Entry } from './parts';

const link = 'text-xs text-selectable underline underline-offset-2';

let tz: string | undefined;
try {
  tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
} catch {
  tz = undefined;
}

/**
 * Meetings & interviews (SPEC section 6), with Google Calendar (M8): put an
 * upcoming meeting on your calendar in one click (or as you add it), and see
 * calendar events that look like they're about this company.
 */
export function MeetingsBody({ company }: { company: Company }) {
  const { actions } = useWorkspace();
  const calendar = useCalendar();
  const toast = useToast();
  const meetings = actions.pageOf(company.id).meetings;
  const today = todayISO();

  const add = async (meeting: Meeting, alsoCalendar: boolean) => {
    const label = actions.addMeeting(company.id, meeting);
    toast(label ? `Added. Status → ${label}` : 'Added');
    if (calendar.available && alsoCalendar && meeting.date >= today) {
      const problem = await calendar.addToCalendar(company, meeting);
      toast(problem ?? 'Added to Google Calendar');
    }
  };

  return (
    <>
      {meetings.length > 0 && (
        <div className="grid">
          {newest(meetings).map((m) => (
            <Entry
              key={m.id}
              date={
                <>
                  {fmtDate(m.date)}
                  {m.start && (
                    <span className="block">
                      {fmtTime(m.start)}
                      {m.end && `–${fmtTime(m.end)}`}
                    </span>
                  )}
                </>
              }
              label={`Delete ${m.kind}`}
              editLabel={`Edit ${m.kind}`}
              onDelete={() => actions.deleteEntry(company.id, 'meetings', m.id)}
              editor={(done) => (
                <MeetingForm
                  initial={m}
                  submitLabel="Save"
                  onCancel={done}
                  onSubmit={(e) => {
                    actions.patchMeeting(company.id, m.id, {
                      kind: e.kind,
                      date: e.date,
                      start: e.start,
                      end: e.end,
                      with: e.with,
                      notes: e.notes,
                    });
                    toast(
                      m.calendarEventId
                        ? 'Saved. Your Google Calendar event stays as it was.'
                        : 'Saved',
                    );
                    done();
                  }}
                />
              )}
            >
              <b className="font-semibold text-strong">
                {m.kind === 'interview' ? 'Interview' : 'Meeting'}
              </b>
              {m.with && ` with ${m.with}`}
              {m.date >= today && (
                <span className="ml-1.5 rounded-md bg-accent-soft px-1.5 py-px text-[11px] font-semibold text-accent-text">
                  Upcoming
                </span>
              )}
              {m.notes && <span className="block text-[12.5px] text-muted">{m.notes}</span>}
              <CalendarLink company={company} meeting={m} />
            </Entry>
          ))}
        </div>
      )}
      {calendar.available && <FromCalendar company={company} meetings={meetings} />}
      <div className={addForm}>
        <MeetingForm submitLabel="Add" onSubmit={(m, also) => void add(m, also)} />
      </div>
    </>
  );
}

/** Kind, date, times, who and notes: the add form, and the edit form in place. */
function MeetingForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Meeting;
  submitLabel: string;
  onSubmit: (meeting: Meeting, alsoCalendar: boolean) => void;
  onCancel?: () => void;
}) {
  const calendar = useCalendar();
  const [kind, setKind] = useState<Meeting['kind']>(initial?.kind ?? 'meeting');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');
  const [withWhom, setWithWhom] = useState(initial?.with ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [alsoCalendar, setAlsoCalendar] = useState(calendarAuto.get);
  // Edit forms get their own ids; the add form keeps the ones tests and labels use.
  const id = (k: string) => (initial ? undefined : `meet-${k}`);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    onSubmit(
      {
        ...initial,
        id: initial?.id ?? uid('mt'),
        date: date || todayISO(),
        start,
        end,
        kind,
        with: withWhom.trim(),
        notes: notes.trim(),
      },
      alsoCalendar,
    );
    if (!initial) {
      setStart('');
      setEnd('');
      setWithWhom('');
      setNotes('');
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Kind"
          className="flex rounded-lg border border-line bg-bg p-0.5"
        >
          {(['meeting', 'interview'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className="rounded-md px-2.5 py-1 text-[13px] text-muted transition-colors aria-pressed:bg-hover aria-pressed:text-strong"
            >
              {k === 'meeting' ? 'Meeting' : 'Interview'}
            </button>
          ))}
        </div>
        <input
          id={id('date')}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={fieldInline}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id('start')}
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="Start time"
          className={`${fieldInline} min-w-0 flex-1`}
        />
        <span className="text-[12.5px] text-muted">to</span>
        <input
          id={id('end')}
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="End time"
          className={`${fieldInline} min-w-0 flex-1`}
        />
      </div>
      <input
        id={id('with')}
        value={withWhom}
        onChange={(e) => setWithWhom(e.target.value)}
        onKeyDown={submitOnEnter(() => submit())}
        placeholder="With whom"
        aria-label="With whom"
        className={field}
      />
      <textarea
        id={id('notes')}
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={submitOnEnter(() => submit())}
        placeholder="How did it go? Or what to prepare."
        aria-label="Notes"
        className={`${field} resize-y`}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="submit" className={`${btn.base} ${btn.small}`}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btn.ghost} ${btn.small}`}>
            Cancel
          </button>
        )}
        {calendar.available && !initial && (
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
            <input
              id="meet-calendar"
              type="checkbox"
              checked={alsoCalendar}
              onChange={(e) => {
                setAlsoCalendar(e.target.checked);
                calendarAuto.set(e.target.checked);
              }}
              className="accent-[var(--accent)]"
            />
            Also add upcoming ones to Google Calendar
          </label>
        )}
        <span className={hint}>
          Enter to {initial ? 'save' : 'add'} · Shift+Enter for a new line
        </span>
      </div>
    </form>
  );
}

/** "On your Google Calendar", a one-click add, or (outside Claude) the old template link. */
function CalendarLink({ company, meeting: m }: { company: Company; meeting: Meeting }) {
  const calendar = useCalendar();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (m.calendarEventId)
    return m.calendarLink ? (
      <a
        href={m.calendarLink}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${link}`}
      >
        On your Google Calendar ↗
      </a>
    ) : (
      <span className="block text-xs text-muted">On your Google Calendar</span>
    );

  if (!calendar.available || m.date < todayISO())
    return (
      <a
        href={googleCalendarLink(company.name, m, tz)}
        target="_blank"
        rel="noopener noreferrer"
        className={`block ${link}`}
      >
        Add to Google Calendar
      </a>
    );

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const problem = await calendar.addToCalendar(company, m);
        setBusy(false);
        toast(problem ?? 'Added to Google Calendar');
      }}
      className={`block ${link} disabled:opacity-60`}
    >
      {busy ? 'Adding…' : 'Add to Google Calendar'}
    </button>
  );
}

/** Upcoming calendar events that look like they're about this company and aren't in Meetings yet. */
function FromCalendar({ company, meetings }: { company: Company; meetings: Meeting[] }) {
  const { board, actions } = useWorkspace();
  const calendar = useCalendar();
  const toast = useToast();
  const { watch } = calendar;
  useEffect(watch, [watch]);

  if (calendar.error)
    return (
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        <span>{calendarErrorMessage(calendar.error)}</span>
        {(needsOk(calendar.error.code) || calendar.error.code === 'server_unavailable') && (
          <button
            type="button"
            onClick={() => void calendar.retry()}
            className={`${btn.ghost} ${btn.small}`}
          >
            {needsOk(calendar.error.code) ? 'Allow Google Calendar' : 'Try again'}
          </button>
        )}
      </div>
    );

  const linked = new Set(meetings.map((m) => m.calendarEventId).filter(Boolean));
  const already = (ev: CalEvent) =>
    linked.has(ev.id) || meetings.some((m) => m.date === ev.date && m.start === ev.start);
  const found = (calendar.events ?? []).filter(
    (ev) => eventMatches(board, company, ev) && !already(ev),
  );
  if (!found.length) return null;

  return (
    <div className="grid gap-1.5 rounded-xl border border-dashed border-line-strong px-3 py-2.5">
      <span className="text-[11.5px] font-semibold tracking-[0.06em] text-faint uppercase">
        On your Google Calendar
      </span>
      {found.map((ev) => (
        <div key={ev.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[12.5px] text-muted tabular-nums">
            {fmtDate(ev.date)}
            {ev.start && ` ${fmtTime(ev.start)}`}
          </span>
          <span className="min-w-0 flex-1">{ev.title || '(No title)'}</span>
          <button
            type="button"
            onClick={() => {
              const label = actions.addMeeting(company.id, meetingFromEvent(ev));
              toast(label ? `Added to Meetings. Status → ${label}` : 'Added to Meetings');
            }}
            className={`${btn.base} ${btn.small}`}
          >
            Add to Meetings
          </button>
        </div>
      ))}
    </div>
  );
}
