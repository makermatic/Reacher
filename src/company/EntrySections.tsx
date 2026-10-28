import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { googleCalendarLink } from '../model/automation';
import { fmtDate, fmtTime, todayISO } from '../model/dates';
import type { Company, Meeting } from '../model/types';
import { normalizeUrl } from '../lib/links';
import { btn, field } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { addForm, Entry } from './parts';

const newest = <T extends { date: string }>(list: T[]) =>
  [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** Enter submits; Shift+Enter is a new line (SPEC section 6). */
const submitOnEnter = (submit: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    submit();
  }
};

const hint = 'text-xs text-muted';
const dateField = `${field} w-auto`;

export function NotesBody({ company }: { company: Company }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [text, setText] = useState('');
  const [date, setDate] = useState(todayISO());
  const notes = actions.pageOf(company.id).notes;

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return toast('Write the note first');
    actions.addNote(company.id, { date: date || todayISO(), text: text.trim() });
    setText('');
    toast('Note added');
  };

  return (
    <>
      {newest(notes).map((n) => (
        <Entry
          key={n.id}
          date={fmtDate(n.date)}
          label="Delete note"
          onDelete={() => actions.deleteEntry(company.id, 'notes', n.id)}
        >
          {n.text}
        </Entry>
      ))}
      <form onSubmit={add} className={addForm}>
        <textarea
          id="note-text"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={submitOnEnter(add)}
          placeholder="What happened? Like: Met their EP at the SCAD career fair."
          aria-label="Note"
          className={`${field} resize-y`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="note-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className={dateField}
          />
          <button type="submit" className={`${btn.base} ${btn.small}`}>
            Add note
          </button>
          <span className={hint}>Enter to add · Shift+Enter for a new line</span>
        </div>
      </form>
    </>
  );
}

export function ApplicationsBody({ company }: { company: Company }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const roleDefault = String(company.meta?.role ?? '');
  const [role, setRole] = useState('');
  const [date, setDate] = useState(todayISO());
  const [link, setLink] = useState('');
  const [result, setResult] = useState('');
  const apps = actions.pageOf(company.id).applications;

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    const label = actions.addApplication(company.id, {
      date: date || todayISO(),
      role: role.trim() || roleDefault,
      link: normalizeUrl(link),
      result: result.trim(),
    });
    setRole('');
    setLink('');
    setResult('');
    toast(label ? `Application added. Status → ${label}` : 'Application added');
  };
  const enter = submitOnEnter(add);

  return (
    <>
      {newest(apps).map((a) => (
        <Entry
          key={a.id}
          date={fmtDate(a.date)}
          label="Delete application"
          onDelete={() => actions.deleteEntry(company.id, 'applications', a.id)}
        >
          <b className="font-semibold">{a.role || 'Application'}</b>
          {a.link && (
            <>
              {' · '}
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                posting
              </a>
            </>
          )}
          {a.result && <span className="block text-[12.5px] text-muted">{a.result}</span>}
        </Entry>
      ))}
      <form onSubmit={add} className={addForm}>
        <div className="flex flex-wrap gap-2">
          <input
            id="app-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            onKeyDown={enter}
            placeholder={`Role, like ${roleDefault || 'Motion Designer'}`}
            aria-label="Role"
            className={`${field} min-w-40 flex-1`}
          />
          <input
            id="app-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date applied"
            className={dateField}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            id="app-link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={enter}
            inputMode="url"
            placeholder="Job posting link"
            aria-label="Job posting link"
            className={`${field} min-w-40 flex-1`}
          />
          <input
            id="app-result"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            onKeyDown={enter}
            placeholder="Result, if any"
            aria-label="Result"
            className={`${field} min-w-40 flex-1`}
          />
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" className={`${btn.base} ${btn.small}`}>
            Add application
          </button>
          <span className={hint}>Enter to add</span>
        </div>
      </form>
    </>
  );
}

export function MeetingsBody({ company }: { company: Company }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [kind, setKind] = useState<Meeting['kind']>('meeting');
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [withWhom, setWithWhom] = useState('');
  const [notes, setNotes] = useState('');
  const meetings = actions.pageOf(company.id).meetings;
  const today = todayISO();
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    const label = actions.addMeeting(company.id, {
      date: date || todayISO(),
      start,
      end,
      kind,
      with: withWhom.trim(),
      notes: notes.trim(),
    });
    setStart('');
    setEnd('');
    setWithWhom('');
    setNotes('');
    toast(label ? `Added. Status → ${label}` : 'Added');
  };

  return (
    <>
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
          onDelete={() => actions.deleteEntry(company.id, 'meetings', m.id)}
        >
          <b className="font-semibold">{m.kind === 'interview' ? 'Interview' : 'Meeting'}</b>
          {m.with && ` with ${m.with}`}
          {m.date >= today && (
            <span className="eyebrow ml-1.5 rounded border border-accent/45 px-1 text-[10px] text-accent">
              Upcoming
            </span>
          )}
          {m.notes && <span className="block text-[12.5px] text-muted">{m.notes}</span>}
          <a
            href={googleCalendarLink(company.name, m, tz)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-accent underline underline-offset-2"
          >
            Add to Google Calendar
          </a>
        </Entry>
      ))}
      <form onSubmit={add} className={addForm}>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Kind"
            className="flex rounded-lg border border-line-strong bg-surface p-0.5"
          >
            {(['meeting', 'interview'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className="rounded-md px-2.5 py-1 text-muted transition-colors aria-pressed:bg-accent-soft aria-pressed:text-fg"
              >
                {k === 'meeting' ? 'Meeting' : 'Interview'}
              </button>
            ))}
          </div>
          <input
            id="meet-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
            className={dateField}
          />
          <input
            id="meet-start"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start time"
            className={dateField}
          />
          <span className="text-[12.5px] text-muted">to</span>
          <input
            id="meet-end"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End time"
            className={dateField}
          />
        </div>
        <input
          id="meet-with"
          value={withWhom}
          onChange={(e) => setWithWhom(e.target.value)}
          onKeyDown={submitOnEnter(add)}
          placeholder="With whom"
          aria-label="With whom"
          className={field}
        />
        <textarea
          id="meet-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={submitOnEnter(add)}
          placeholder="How did it go? Or what to prepare."
          aria-label="Notes"
          className={`${field} resize-y`}
        />
        <div className="flex items-center gap-2">
          <button type="submit" className={`${btn.base} ${btn.small}`}>
            Add
          </button>
          <span className={hint}>Enter to add · Shift+Enter for a new line</span>
        </div>
      </form>
    </>
  );
}
