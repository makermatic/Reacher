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
import {
  deleteStage,
  moveStage,
  newStage,
  newStatus,
  stageNameTaken,
  updateStage,
  updateStatus,
} from '../model/columns';
import { COLORS, type ColorName } from '../model/types';

const TAB_LABEL: Record<SettingsTab, string> = {
  details: 'Your details',
  stages: 'Stages & statuses',
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
        {tab === 'stages' && <StagesTab />}
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

/** Stages (the colored columns) and the statuses they share, like Kitsu's task types and statuses. */
function StagesTab() {
  const { board, actions } = useWorkspace();
  const toast = useToast();
  const [stageName, setStageName] = useState('');
  const [statusName, setStatusName] = useState('');
  const swatches = (value: ColorName | '', pick: (c: ColorName) => void, label: string) => (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => pick(c)}
          className="size-4 rounded-full ring-offset-2 ring-offset-surface aria-checked:ring-2 aria-checked:ring-fg"
          style={{ background: colorVar(c) }}
        />
      ))}
    </div>
  );
  return (
    <div className="grid max-w-3xl gap-8">
      <section className="grid gap-3">
        <h2 className={ui.sectionTitle}>Stages</h2>
        <p className="m-0 text-[13.5px] text-muted">
          Each stage is a colored column on the list, and every company has a status in each one.
        </p>
        <div className={`${ui.block} divide-y divide-line`}>
          {board.stages.map((st, i) => (
            <div key={st.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <input
                defaultValue={st.name}
                aria-label={`Name of ${st.name}`}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== st.name && !stageNameTaken(board, v, st.id))
                    actions.saveBoard(updateStage(board, st.id, { name: v }));
                }}
                className={`${ui.input} w-48`}
              />
              {swatches(
                st.color,
                (c) => actions.saveBoard(updateStage(board, st.id, { color: c })),
                `${st.name} color`,
              )}
              <span className="ml-auto flex gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => actions.saveBoard(moveStage(board, st.id, -1))}
                  aria-label={`Move ${st.name} left`}
                  className={`${ui.ghostIcon} disabled:opacity-30`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === board.stages.length - 1}
                  onClick={() => actions.saveBoard(moveStage(board, st.id, 1))}
                  aria-label={`Move ${st.name} right`}
                  className={`${ui.ghostIcon} disabled:opacity-30`}
                >
                  ↓
                </button>
                <span className="w-44">
                  <TwoClick
                    armed="Click again to delete"
                    onConfirm={() => actions.saveBoard(deleteStage(board, st.id))}
                  >
                    Delete stage
                  </TwoClick>
                </span>
              </span>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!stageName.trim() || stageNameTaken(board, stageName)) return;
            actions.saveBoard({ ...board, stages: [...board.stages, newStage(board, stageName)] });
            toast(`Added the ${stageName.trim()} stage`);
            setStageName('');
          }}
          className="flex gap-2"
        >
          <input
            id="new-stage"
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            placeholder="New stage, like Offer"
            aria-label="New stage"
            className={`${ui.input} w-64`}
          />
          <button type="submit" className={ui.primary}>
            Add stage
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className={ui.sectionTitle}>Statuses</h2>
        <p className="m-0 text-[13.5px] text-muted">
          Shared by every stage. The meaning helps the AI pick the right one, so keep it plain.
        </p>
        <div className={`${ui.block} divide-y divide-line`}>
          {board.statuses.map((st) => (
            <div
              key={st.id}
              className="grid gap-2 px-3 py-2.5 sm:grid-cols-[150px_auto_minmax(0,1fr)] sm:items-center"
            >
              <input
                defaultValue={st.label}
                aria-label={`Name of ${st.label}`}
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value.trim() !== st.label &&
                  actions.saveBoard(updateStatus(board, st.id, { label: e.target.value.trim() }))
                }
                className={ui.input}
              />
              {swatches(
                st.color,
                (c) => actions.saveBoard(updateStatus(board, st.id, { color: c })),
                `${st.label} color`,
              )}
              <input
                defaultValue={st.meaning}
                aria-label={`Meaning of ${st.label}`}
                placeholder="What it means"
                onBlur={(e) =>
                  e.target.value !== st.meaning &&
                  actions.saveBoard(updateStatus(board, st.id, { meaning: e.target.value }))
                }
                className={ui.input}
              />
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!statusName.trim()) return;
            actions.saveBoard({
              ...board,
              statuses: [...board.statuses, newStatus(board, statusName)],
            });
            setStatusName('');
          }}
          className="flex gap-2"
        >
          <input
            id="new-status"
            value={statusName}
            onChange={(e) => setStatusName(e.target.value)}
            placeholder="New status, like Ghosted"
            aria-label="New status"
            className={`${ui.input} w-64`}
          />
          <button type="submit" className={ui.primary}>
            Add status
          </button>
        </form>
      </section>
    </div>
  );
}
