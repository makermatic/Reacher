import { CalendarDays, Mail, Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useAssistant } from '../ai/Assistant';
import { missingDetails } from '../ai/prompts';
import { AiCheck } from '../components/AiCheck';
import { Templates } from '../components/TemplatesScreen';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { useToast } from '../components/Toast';
import { DetailsForm, ExportButton } from '../components/YourDetailsDialog';
import { readPref, writePref } from '../lib/prefs';
import { shortDate } from '../model/sprints';
import type { Me } from '../model/types';
import { gmailErrorMessage } from '../runtime/gmail';
import { calendarAuto, useCalendar } from '../workspace/CalendarProvider';
import { GMAIL_ALL, useGmail } from '../workspace/GmailProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { SETTINGS_TABS, type SettingsTab } from './route';
import { CsvImportButton } from './CsvImport';
import { PeopleList, useList } from './listContext';
import { useSprintInfo } from './sprintLabels';
import { colorVar, ui } from './ui';
import { TwoClick } from './columns';
import { statusOptions, updateColumn } from '../model/columns';
import { slug, uid } from '../model/text';
import { COLORS, type Column, type ColorName, type StatusOption } from '../model/types';

const TAB_LABEL: Record<SettingsTab, string> = {
  details: 'Your details',
  appearance: 'Appearance',
  connections: 'Gmail & Calendar',
  data: 'Import & export',
  ai: 'AI check',
};

export type Theme = 'dark' | 'light';
const isTheme = (v: unknown): v is Theme => v === 'dark' || v === 'light';
export const readTheme = () => readPref<Theme>('theme', 'dark', isTheme);
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
}

const EMPTY: Me = { name: '', portfolio: '', reel: '', phone: '', intro: '' };

/** Settings (M7): one page with a list on the left, like Kitsu's admin pages. */
export function SettingsPage({ tab, onImport }: { tab: SettingsTab; onImport: () => void }) {
  const { navigate } = useAppUI();
  return (
    <div className="flex h-full min-h-0">
      <nav
        aria-label="Settings"
        className="w-56 shrink-0 overflow-y-auto border-r border-line px-3 pt-5"
      >
        {SETTINGS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={t === tab ? 'page' : undefined}
            onClick={() => navigate({ page: 'settings', tab: t })}
            className="block w-full rounded-lg px-3 py-2 text-left text-[15px] text-muted transition-colors hover:bg-hover hover:text-fg aria-[current=page]:bg-selected aria-[current=page]:text-white"
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-6 pb-12">
        <h1 className={`${ui.sectionTitle} mb-5`}>{TAB_LABEL[tab]}</h1>
        {tab === 'details' && <DetailsTab />}
        {tab === 'appearance' && <AppearanceTab />}
        {tab === 'connections' && <ConnectionsTab />}
        {tab === 'data' && <DataTab onImport={onImport} />}
        {tab === 'ai' && (
          <div className={`${ui.block} max-w-3xl p-5 text-[14px]`}>
            <AiCheck />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailsTab() {
  const { loading, me } = useWorkspace();
  const toast = useToast();
  return (
    <div className={`${ui.block} max-w-2xl p-5`}>
      <p className="mt-0 text-muted">
        These fill the “You” fields in email templates, like your name and reel link.
      </p>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <DetailsForm
          key={JSON.stringify(me)}
          initial={{ ...EMPTY, ...me }}
          onDone={() => toast('Saved')}
        />
      )}
    </div>
  );
}

/** Rename, re-date or delete sprints. Being over never stops you working in one. */
export function SprintsTab() {
  const { sprints, actions } = useWorkspace();
  const info = useSprintInfo();
  const toast = useToast();
  const [name, setName] = useState('');
  return (
    <div className="grid max-w-3xl gap-4">
      <p className="m-0 text-muted">
        A sprint is named with the day it starts, like “First Light{' '}
        {shortDate(new Date().toISOString().slice(0, 10))}”. When a newer sprint starts, or after
        two weeks with no activity, its end date is added. Set an end date here to close one early;
        you can keep working in any sprint.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          actions.createSprint(name);
          toast(`New sprint: ${name.trim()}`);
          setName('');
        }}
        className="flex gap-2"
      >
        <input
          id="settings-new-sprint"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New sprint name"
          aria-label="New sprint name"
          className={`${ui.input} w-72`}
        />
        <button type="submit" className={ui.primary}>
          Create
        </button>
      </form>
      {[...sprints].reverse().map((s) => (
        <div
          key={s.id}
          className={`${ui.block} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end`}
        >
          <label className="grid gap-1.5">
            <span className={ui.label}>Name · shows as “{info[s.id]?.label}”</span>
            <input
              defaultValue={s.name}
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value.trim() !== s.name &&
                actions.updateSprint({ ...s, name: e.target.value.trim() })
              }
              aria-label={`Name of ${s.name}`}
              className={ui.input}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={ui.label}>Start</span>
            <input
              type="date"
              value={s.start}
              onChange={(e) =>
                e.target.value && actions.updateSprint({ ...s, start: e.target.value })
              }
              className={ui.input}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={ui.label}>End {s.end ? '' : '(automatic)'}</span>
            <input
              type="date"
              value={s.end ?? ''}
              onChange={(e) => actions.updateSprint({ ...s, end: e.target.value || null })}
              className={ui.input}
            />
          </label>
          <ConfirmButton
            onConfirm={() => {
              actions.deleteSprint(s.id);
              toast(`Deleted ${s.name}. Its companies stay on your list.`);
            }}
            confirm="Delete sprint?"
            className={ui.button}
            armedClassName={`${armedDanger} h-10`}
          >
            Delete
          </ConfirmButton>
        </div>
      ))}
    </div>
  );
}

function AppearanceTab() {
  const [theme, setTheme] = useState<Theme>(readTheme);
  const pick = (t: Theme) => {
    setTheme(t);
    writePref('theme', t);
    applyTheme(t);
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="flex gap-3">
      {(
        [
          ['dark', 'Dark', Moon],
          ['light', 'Light', Sun],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          onClick={() => pick(id)}
          className={`${ui.block} flex w-44 items-center gap-3 border-2 border-transparent p-4 text-left aria-checked:border-accent`}
        >
          <Icon size={22} className="text-muted" />
          <span className="text-[15px] font-bold text-strong">{label}</span>
        </button>
      ))}
    </div>
  );
}

function ConnectionsTab() {
  const gmail = useGmail();
  const calendar = useCalendar();
  const [auto, setAuto] = useState(calendarAuto.get);
  const all = gmail.status[GMAIL_ALL];
  const state = (on: boolean) => (
    <span
      className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${
        on ? 'bg-accent-soft text-accent-text' : 'bg-hover text-muted'
      }`}
    >
      {on ? 'Connected' : 'Only inside Claude'}
    </span>
  );
  return (
    <div className="grid max-w-2xl gap-4 text-[14px]">
      <section className={`${ui.block} grid gap-3 p-5`}>
        <div className="flex items-center gap-3">
          <Mail size={18} className="text-muted" aria-hidden="true" />
          <h2 className={`${ui.sectionTitle} text-[16px]`}>Gmail</h2>
          <span className="ml-auto">{state(gmail.available)}</span>
        </div>
        <p className="m-0 text-muted">
          Reacher checks your email with your companies when it opens and every 10 minutes while
          it’s open. New emails go into each company’s chains, and a reply sets Wrote back!! on its
          own. It saves drafts in Gmail; it never sends.
        </p>
        {gmail.available && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={all?.checking}
              onClick={() => void gmail.checkAll(true)}
              className={ui.button}
            >
              {all?.checking ? 'Checking…' : 'Check Gmail now'}
            </button>
            <span className="text-[13px] text-muted">
              {all?.error
                ? all.error.code === 'no_address'
                  ? all.error.message
                  : gmailErrorMessage(all.error)
                : all?.at
                  ? `Last checked ${new Date(all.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                  : 'Claude asks for your OK the first time.'}
            </span>
          </div>
        )}
      </section>
      <section className={`${ui.block} grid gap-3 p-5`}>
        <div className="flex items-center gap-3">
          <CalendarDays size={18} className="text-muted" aria-hidden="true" />
          <h2 className={`${ui.sectionTitle} text-[16px]`}>Google Calendar</h2>
          <span className="ml-auto">{state(calendar.available)}</span>
        </div>
        <p className="m-0 text-muted">
          Upcoming meetings and interviews can go on your calendar in one click, and calendar events
          that look like they’re about a company show up in its Meetings. Reacher never changes or
          deletes your events.
        </p>
        {calendar.available && (
          <label className="flex items-center gap-2 text-[13.5px]">
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => {
                setAuto(e.target.checked);
                calendarAuto.set(e.target.checked);
              }}
              className="accent-[var(--accent)]"
            />
            Add upcoming meetings to Google Calendar as I add them
          </label>
        )}
      </section>
      <p className="m-0 text-[13px] text-muted">
        Both use your own claude.ai connectors. To add or reconnect one, open claude.ai Settings →
        Connectors.
      </p>
    </div>
  );
}

function DataTab({ onImport }: { onImport: () => void }) {
  return (
    <div className="grid max-w-2xl gap-4">
      <div className={`${ui.block} grid gap-3 p-5 text-[14px]`}>
        <p className="m-0">
          Your data is yours. Export everything as one file (a backup you can import back), bring in
          an export from the prototype, or add companies and contacts from a CSV.
        </p>
        <div className="flex gap-2">
          <ExportButton />
          <button type="button" className={ui.button} onClick={onImport}>
            Import data
          </button>
          <CsvImportButton />
        </div>
      </div>
      <FillDetails />
    </div>
  );
}

/**
 * Look up missing details for every company (after M11): website, city,
 * size, type. One at a time in the background; only what the AI is sure of.
 */
function FillDetails() {
  const { board, companies } = useWorkspace();
  const { available, fillMissing, filling, stopFilling } = useAssistant();
  const missing = companies.filter((c) => missingDetails(board, c));
  return (
    <div className={`${ui.block} grid gap-3 p-5 text-[14px]`}>
      <h2 className={`${ui.sectionTitle} text-[16px]`}>Fill in missing details</h2>
      <p className="m-0 text-muted">
        The AI looks up each company with empty fields (website, city, size, type) and fills only
        those, when it’s sure which company it is. Your own entries and names stay as they are.
      </p>
      {!available ? (
        <p className="m-0 text-[13px] text-faint">This uses AI, which works inside Claude.</p>
      ) : filling ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="ai-working rounded-lg px-3 py-1.5 text-[13.5px]">
            Looking up {filling.done + 1 > filling.total ? filling.total : filling.done + 1} of{' '}
            {filling.total}… {filling.filled} filled so far
          </span>
          <button type="button" className={ui.button} onClick={stopFilling}>
            Stop
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!missing.length}
            className={ui.primary}
            onClick={() => fillMissing(missing)}
          >
            {missing.length
              ? `Look up ${missing.length} ${missing.length === 1 ? 'company' : 'companies'}`
              : 'Every company has its details'}
          </button>
        </div>
      )}
    </div>
  );
}

/** The choices of Status and Outcome: name, group, color, the template each suggests, order. */
export function StatusesTab() {
  const { board } = useWorkspace();
  const cols = board.columns.filter((c) => c.type === 'status');
  return (
    <div className="grid max-w-4xl gap-8">
      <h2 className="m-0 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">
        Companies
      </h2>
      {cols.map((col) => (
        <ChoicesEditor key={col.id} col={col} />
      ))}
      <h2 className="m-0 mt-4 text-[12px] font-semibold tracking-[0.06em] text-faint uppercase">
        People
      </h2>
      <PeopleList>
        <PeopleStatuses />
      </PeopleList>
    </div>
  );
}

/** People's statuses (M11): thumbs up and down, editable like the rest. */
function PeopleStatuses() {
  const { board } = useList();
  return (
    <>
      {board.columns
        .filter((c) => c.type === 'status')
        .map((col) => (
          <ChoicesEditor key={col.id} col={col} />
        ))}
    </>
  );
}

function ChoicesEditor({ col }: { col: Column }) {
  const { templates } = useWorkspace();
  const { board, saveBoard, kind } = useList();
  // Only a company's Status suggests an email.
  const mainStatus = kind === 'company' && col.id === 'status';
  const toast = useToast();
  const [name, setName] = useState('');
  const opts = statusOptions(col);
  const save = (options: StatusOption[]) => saveBoard(updateColumn(board, col.id, { options }));
  const patch = (id: string, p: Partial<StatusOption>) =>
    save(opts.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const move = (i: number, d: -1 | 1) => {
    const list = [...opts];
    [list[i], list[i + d]] = [list[i + d]!, list[i]!];
    save(list);
  };
  const groups = [...new Set(opts.map((o) => o.group).filter(Boolean))];
  const swatches = (o: StatusOption) => (
    <div className="flex gap-1" role="radiogroup" aria-label={`${o.label} color`}>
      {COLORS.map((c: ColorName) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={o.color === c}
          aria-label={c}
          onClick={() => patch(o.id, { color: c })}
          className="size-4 rounded-full ring-offset-2 ring-offset-surface aria-checked:ring-2 aria-checked:ring-fg"
          style={{ background: colorVar(c) }}
        />
      ))}
    </div>
  );
  return (
    <section className="grid gap-3">
      <h2 className={ui.sectionTitle}>{col.name}</h2>
      {mainStatus && (
        <p className="m-0 text-[13.5px] text-muted">
          The status column on the sheet. “Suggested email” is the template the email writer starts
          with when a company is at that status (for example, Reached out → Check-in).
        </p>
      )}
      <div className={`${ui.block} divide-y divide-line`}>
        {opts.map((o, i) => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <input
              defaultValue={o.label}
              aria-label={`Name of ${o.label}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== o.label) patch(o.id, { label: v });
              }}
              className={`${ui.input} w-40`}
            />
            {groups.length > 0 && (
              <select
                value={o.group}
                onChange={(e) => patch(o.id, { group: e.target.value })}
                aria-label={`Group of ${o.label}`}
                className={`${ui.input} w-40`}
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
            {swatches(o)}
            {mainStatus && (
              <label className="flex items-center gap-2 text-[12.5px] text-muted">
                Suggested email
                <select
                  value={o.tpl}
                  onChange={(e) => patch(o.id, { tpl: e.target.value })}
                  aria-label={`Suggested email for ${o.label}`}
                  className={`${ui.input} w-44`}
                >
                  <option value="">None</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${o.label} up`}
                className={`${ui.ghostIcon} disabled:opacity-30`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === opts.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${o.label} down`}
                className={`${ui.ghostIcon} disabled:opacity-30`}
              >
                ↓
              </button>
              <span className="w-36">
                <TwoClick
                  armed="Click again"
                  onConfirm={() => save(opts.filter((x) => x.id !== o.id))}
                >
                  Delete
                </TwoClick>
              </span>
            </span>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const label = name.trim();
          if (!label) return;
          const id =
            slug(label) && !opts.some((o) => o.id === slug(label)) ? slug(label) : uid('opt');
          const color = COLORS[(opts.length + 1) % COLORS.length]!;
          save([...opts, { id, label, group: opts.at(-1)?.group ?? '', color, tpl: '' }]);
          toast(`Added ${label}`);
          setName('');
        }}
        className="flex gap-2"
      >
        <input
          id={`new-${kind === 'person' ? 'person-' : ''}${col.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={mainStatus ? 'New status, like Ghosted' : `New ${col.name} choice`}
          aria-label={`New ${col.name} choice`}
          className={`${ui.input} w-64`}
        />
        <button type="submit" className={ui.primary}>
          Add
        </button>
      </form>
    </section>
  );
}

/** A page of its own from the menu: Statuses, Email templates, Sprints (Zack, M7 round 2). */
export function ManagePage({ page }: { page: 'statuses' | 'templates' | 'sprints' }) {
  const title = { statuses: 'Status types', templates: 'Email templates', sprints: 'Sprints' }[
    page
  ];
  return (
    <div className="h-full min-h-0 overflow-y-auto px-8 pt-6 pb-12">
      <h1 className={`${ui.sectionTitle} mb-5 text-[22px]`}>{title}</h1>
      {page === 'statuses' && <StatusesTab />}
      {page === 'sprints' && <SprintsTab />}
      {page === 'templates' && (
        <div className={`${ui.block} flex min-h-[600px] flex-col overflow-hidden`}>
          <Templates />
        </div>
      )}
    </div>
  );
}
