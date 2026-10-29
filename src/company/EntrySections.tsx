import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { fmtDate, todayISO } from '../model/dates';
import type { Company } from '../model/types';
import { normalizeUrl } from '../lib/links';
import { btn, field, fieldInline } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { addForm, Entry } from './parts';

export const newest = <T extends { date: string }>(list: T[]) =>
  [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

/** Enter submits; Shift+Enter is a new line (SPEC section 6). */
export const submitOnEnter = (submit: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
    e.preventDefault();
    submit();
  }
};

export const hint = 'text-xs text-muted';
const dateField = fieldInline;

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
