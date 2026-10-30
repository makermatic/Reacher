import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { fmtDate, todayISO } from '../model/dates';
import type { Application, Company } from '../model/types';
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

export function ApplicationsBody({ company }: { company: Company }) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const apps = actions.pageOf(company.id).applications;

  return (
    <>
      {apps.length > 0 && (
        <div className="grid">
          {newest(apps).map((a) => (
            <Entry
              key={a.id}
              date={fmtDate(a.date)}
              label="Delete application"
              editLabel="Edit application"
              onDelete={() => actions.deleteEntry(company.id, 'applications', a.id)}
              editor={(done) => (
                <AppForm
                  company={company}
                  initial={a}
                  submitLabel="Save"
                  onCancel={done}
                  onSubmit={(app) => {
                    actions.patchApplication(company.id, a.id, app);
                    toast('Application saved');
                    done();
                  }}
                />
              )}
            >
              <b className="font-semibold text-strong">{a.role || 'Application'}</b>
              {a.link && (
                <>
                  {' · '}
                  <a
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-selectable underline underline-offset-2"
                  >
                    posting
                  </a>
                </>
              )}
              {a.result && <span className="block text-[12.5px] text-muted">{a.result}</span>}
            </Entry>
          ))}
        </div>
      )}
      <div className={addForm}>
        <AppForm
          company={company}
          submitLabel="Add application"
          onSubmit={(app) => {
            const label = actions.addApplication(company.id, app);
            toast(label ? `Application added. Status → ${label}` : 'Application added');
          }}
        />
      </div>
    </>
  );
}

/** Role, date, link and result: the add form, and the edit form in place. */
function AppForm({
  company,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  company: Company;
  initial?: Omit<Application, 'id'>;
  submitLabel: string;
  onSubmit: (app: Omit<Application, 'id'>) => void;
  onCancel?: () => void;
}) {
  const roleDefault = String(company.meta?.role ?? '');
  const [role, setRole] = useState(initial?.role ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [link, setLink] = useState(initial?.link ?? '');
  const [result, setResult] = useState(initial?.result ?? '');
  // Edit forms get their own ids; the add form keeps the ones tests and labels use.
  const id = (k: string) => (initial ? undefined : `app-${k}`);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    onSubmit({
      date: date || todayISO(),
      role: role.trim() || (initial ? '' : roleDefault),
      link: normalizeUrl(link),
      result: result.trim(),
    });
    if (!initial) {
      setRole('');
      setLink('');
      setResult('');
    }
  };
  const enter = submitOnEnter(submit);

  return (
    <form onSubmit={submit} className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          id={id('role')}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          onKeyDown={enter}
          placeholder={`Role, like ${roleDefault || 'Motion Designer'}`}
          aria-label="Role"
          className={`${field} min-w-40 flex-1`}
        />
        <input
          id={id('date')}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date applied"
          className={dateField}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          id={id('link')}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={enter}
          inputMode="url"
          placeholder="Job posting link"
          aria-label="Job posting link"
          className={`${field} min-w-40 flex-1`}
        />
        <input
          id={id('result')}
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
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={`${btn.ghost} ${btn.small}`}>
            Cancel
          </button>
        )}
        <span className={hint}>Enter to {initial ? 'save' : 'add'}</span>
      </div>
    </form>
  );
}
