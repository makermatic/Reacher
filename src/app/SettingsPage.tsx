import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { AiCheck } from '../components/AiCheck';
import { armedDanger, ConfirmButton } from '../components/ConfirmButton';
import { Templates } from '../components/TemplatesScreen';
import { useToast } from '../components/Toast';
import { DetailsForm, ExportButton } from '../components/YourDetailsDialog';
import { readPref, writePref } from '../lib/prefs';
import { shortDate } from '../model/sprints';
import type { Me } from '../model/types';
import { useRuntime } from '../runtime/RuntimeProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useAppUI } from './AppUI';
import { SETTINGS_TABS, type SettingsTab } from './route';
import { useSprintInfo } from './sprintLabels';
import { colorVar, ui } from './ui';
import { TwoClick } from './columns';
import { statusOptions, updateColumn } from '../model/columns';
import { slug, uid } from '../model/text';
import { COLORS, type Column, type ColorName, type StatusOption } from '../model/types';

const TAB_LABEL: Record<SettingsTab, string> = {
  details: 'Your details',
  statuses: 'Statuses',
  templates: 'Email templates',
  sprints: 'Sprints',
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
        {tab === 'templates' && (
          <div className={`${ui.block} flex min-h-[600px] flex-col overflow-hidden`}>
            <Templates />
          </div>
        )}
        {tab === 'statuses' && <StatusesTab />}
        {tab === 'sprints' && <SprintsTab />}
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
function SprintsTab() {
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
  const runtime = useRuntime();
  const on = runtime.status === 'ready' && !!runtime.gmail;
  return (
    <div className={`${ui.block} grid max-w-2xl gap-3 p-5 text-[14px]`}>
      <p className="m-0">
        Reacher uses your own Gmail and Google Calendar through your claude.ai connectors. It reads
        your email with companies, saves drafts (it never sends), and adds meetings to your
        calendar.
      </p>
      <p className="m-0 text-muted">
        {on
          ? 'Connectors are available here. Claude asks for your OK the first time Reacher uses each one.'
          : 'Connectors work when Reacher is open in Claude.'}{' '}
        To add or reconnect one, open claude.ai Settings → Connectors.
      </p>
    </div>
  );
}

function DataTab({ onImport }: { onImport: () => void }) {
  return (
    <div className={`${ui.block} grid max-w-2xl gap-3 p-5 text-[14px]`}>
      <p className="m-0">
        Your data is yours. Export everything as one file (a backup you can import back), or bring
        in an export from the prototype.
      </p>
      <div className="flex gap-2">
        <ExportButton />
        <button type="button" className={ui.button} onClick={onImport}>
          Import data
        </button>
      </div>
    </div>
  );
}

/** The choices of Status and Outcome: name, group, color, the template each suggests, order. */
function StatusesTab() {
  const { board } = useWorkspace();
  const cols = board.columns.filter((c) => c.type === 'status');
  return (
    <div className="grid max-w-4xl gap-8">
      {cols.map((col) => (
        <ChoicesEditor key={col.id} col={col} />
      ))}
    </div>
  );
}

function ChoicesEditor({ col }: { col: Column }) {
  const { board, templates, actions } = useWorkspace();
  const toast = useToast();
  const [name, setName] = useState('');
  const opts = statusOptions(col);
  const save = (options: StatusOption[]) =>
    actions.saveBoard(updateColumn(board, col.id, { options }));
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
      {col.id === 'status' && (
        <p className="m-0 text-[13.5px] text-muted">
          The status column on the sheet. The template is what the email writer suggests at that
          status.
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
            {col.id === 'status' && (
              <select
                value={o.tpl}
                onChange={(e) => patch(o.id, { tpl: e.target.value })}
                aria-label={`Template for ${o.label}`}
                className={`${ui.input} w-44`}
              >
                <option value="">No template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
          id={`new-${col.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={col.id === 'status' ? 'New status, like Ghosted' : `New ${col.name} choice`}
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
