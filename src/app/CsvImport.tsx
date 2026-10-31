/**
 * Import companies and contacts from a CSV (after M7g), Kitsu's way: upload
 * a file or paste from a spreadsheet, then a preview where every column is
 * matched to a place in Reacher (change any match, or ignore the column),
 * companies you already have are marked, and you choose whether they update.
 */
import { FileUp, Upload } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { parseCsv } from '../model/csv';
import {
  guessTargets,
  IGNORE,
  importTargets,
  NEW_FIELD,
  planImport,
  type ImportPlan,
  withNewFields,
  type RowState,
  type Target,
} from '../model/csvImport';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useSprintInfo } from './sprintLabels';
import { Tabs, ui } from './ui';

/** A button that opens the importer. */
export function CsvImportButton({ className = ui.button }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // A fresh importer each time it opens.
  const [round, setRound] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound(round + 1);
          setOpen(true);
        }}
        className={className}
      >
        <Upload size={15} aria-hidden="true" /> Import CSV
      </button>
      <CsvImportDialog key={round} open={open} onOpenChange={setOpen} />
    </>
  );
}

export function CsvImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={rows ? 'Check the import' : 'Import companies from a CSV'}
      wide={rows ? 'xl' : true}
    >
      {rows ? (
        <Preview table={rows} onBack={() => setRows(null)} onDone={() => onOpenChange(false)} />
      ) : (
        <Source onRead={setRows} />
      )}
    </Modal>
  );
}

/** Step 1: a file or a paste. */
function Source({ onRead }: { onRead: (rows: string[][]) => void }) {
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const read = (raw: string) => {
    const rows = parseCsv(raw);
    if (rows.length < 2)
      return setProblem('That needs a header row (the column names) and at least one company.');
    setProblem('');
    onRead(rows);
  };
  return (
    <div className="grid gap-4">
      <p className="m-0 text-[13.5px] text-muted">
        The first row should be the column names. Reacher matches each column to a place: the
        company name (needed), the contact’s name, email and title, Status, or any of your fields.
        You can change every match before anything is added.
      </p>
      <Tabs
        label="How to import"
        tabs={[
          { id: 'file', label: 'Upload a file' },
          { id: 'paste', label: 'Paste' },
        ]}
        current={tab}
        onChange={setTab}
      />
      {tab === 'file' ? (
        <label className="grid cursor-pointer place-items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-10 text-center text-[13.5px] text-muted transition-colors hover:border-selectable hover:bg-hover">
          <FileUp size={22} aria-hidden="true" />
          <span>
            <b className="text-fg">Choose a .csv file</b> (Excel, Numbers and Google Sheets all save
            one)
          </span>
          <input
            id="csv-file"
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) read(await file.text());
              e.target.value = '';
            }}
          />
        </label>
      ) : (
        <div className="grid gap-2">
          <textarea
            id="csv-paste"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Company,Contact,Email\nBuck,Fred Smith,fred@buck.co'}
            aria-label="CSV to import"
            className={`${ui.input} h-auto py-2 font-mono text-[12.5px]`}
          />
          <span className="text-[12px] text-faint">
            Copying cells straight from a spreadsheet works too.
          </span>
        </div>
      )}
      {problem && <p className="m-0 text-[13px] text-[var(--c-red)]">{problem}</p>}
      {tab === 'paste' && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => read(text)}
            className={ui.primary}
          >
            Preview
          </button>
        </div>
      )}
    </div>
  );
}

const STATE: Record<RowState, { label: string; row: string; tag: string }> = {
  new: { label: 'New', row: '', tag: 'bg-accent-soft text-accent-text' },
  update: {
    label: 'Updates',
    row: 'bg-[color-mix(in_srgb,var(--selectable)_10%,transparent)]',
    tag: 'bg-selected text-strong',
  },
  skip: { label: 'On your list', row: 'opacity-45', tag: 'bg-hover text-muted' },
  merged: { label: 'Same company', row: 'opacity-45', tag: 'bg-hover text-muted' },
  incomplete: {
    label: 'No company name',
    row: 'bg-[color-mix(in_srgb,var(--c-red)_8%,transparent)]',
    tag: 'bg-[color-mix(in_srgb,var(--c-red)_18%,transparent)] text-[var(--c-red)]',
  },
};

/** How many rows the preview shows; the import takes them all. */
const SHOWN = 200;

/** Step 2: the preview, with a match for every column. */
function Preview({
  table,
  onBack,
  onDone,
}: {
  table: string[][];
  onBack: () => void;
  onDone: () => void;
}) {
  const { board, companies, sprint, actions } = useWorkspace();
  const info = useSprintInfo();
  const toast = useToast();
  const [header, ...body] = table as [string[], ...string[][]];
  const width = Math.max(header.length, ...body.map((r) => r.length));
  const cols = Array.from({ length: width }, (_, i) => header[i] ?? '');
  const [targets, setTargets] = useState<Target[]>(() => guessTargets(board, cols, body));
  const [update, setUpdate] = useState(false);
  const options = importTargets(board);
  const groups = [...new Set(options.map((o) => o.group))];
  // Once imported, the preview stays as it was while the dialog closes.
  const [imported, setImported] = useState<ImportPlan | null>(null);
  const live = useMemo(
    () => planImport(board, companies, cols, body, targets, update),
    // cols and body come from the table, which doesn't change here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, companies, targets, update],
  );
  const plan = imported ?? live;
  const hasCompany = targets.includes('company');
  const { create, update: updates, skip } = plan.counts;
  const canImport = create + updates + plan.counts.people > 0;
  const label = (t: Target) => options.find((o) => o.id === t)?.label ?? t;

  const run = () => {
    setImported(plan);
    // Columns marked "New field" become fields first, then everything goes in.
    const made = withNewFields(board, cols, targets);
    const final =
      made.board === board
        ? plan
        : planImport(made.board, companies, cols, body, made.targets, update);
    const done = actions.importRows(final, made.board);
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    const added = [
      done.created && n(done.created, 'company', 'companies'),
      done.people && n(done.people, 'person', 'people'),
    ].filter(Boolean);
    toast(
      [added.length && `Added ${added.join(' and ')}`, done.updated && `updated ${done.updated}`]
        .filter(Boolean)
        .join(', ') || 'Nothing to import',
    );
    onDone();
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            id="csv-update"
            type="checkbox"
            checked={update}
            onChange={(e) => setUpdate(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Update companies you already have
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Legend">
          {(['new', 'update', 'skip', 'incomplete'] as RowState[]).map((s) => (
            <Tag key={s} state={s} />
          ))}
        </div>
      </div>

      {!hasCompany && (
        <Note>Pick which column is the company name: it’s the one thing every row needs.</Note>
      )}
      {plan.duplicates.length > 0 && (
        <Note>
          {plan.duplicates.map(label).join(', ')} is picked for more than one column; only the first
          is used.
        </Note>
      )}

      <div className="max-h-[52vh] overflow-auto rounded-xl border border-line">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              <th className="border-b border-line px-3 py-2 text-[11.5px] font-semibold text-faint">
                Line
              </th>
              {cols.map((h, i) => (
                <th key={i} className="min-w-44 border-b border-l border-line px-2 py-2 align-top">
                  <select
                    value={targets[i] ?? IGNORE}
                    onChange={(e) => {
                      const next = [...targets];
                      next[i] = e.target.value;
                      setTargets(next);
                    }}
                    aria-label={`Column ${h || i + 1}`}
                    className={`${ui.input} h-8 w-full ${targets[i] === IGNORE ? 'text-faint' : 'text-strong'}`}
                  >
                    <option value={IGNORE}>Don’t import</option>
                    {h && <option value={NEW_FIELD}>New field: {h}</option>}
                    {groups.map((g) => (
                      <optgroup key={g} label={g}>
                        {options
                          .filter((o) => o.group === g)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="mt-1 block truncate px-1 text-[12px] font-normal text-muted">
                    {h || '(no header)'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.rows.slice(0, SHOWN).map((r, i) => (
              <tr key={r.line} className={STATE[r.state].row}>
                <td className="border-b border-line px-3 py-1.5 whitespace-nowrap">
                  <span className="mr-2 text-faint tabular-nums">{r.line}</span>
                  <Tag
                    state={r.state}
                    text={r.state === 'merged' ? `Same as line ${r.into}` : undefined}
                  />
                </td>
                {cols.map((_, j) => (
                  <td
                    key={j}
                    className={`max-w-64 truncate border-b border-l border-line px-3 py-1.5 ${targets[j] === IGNORE ? 'text-faint' : ''}`}
                  >
                    {body[i]?.[j] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {plan.rows.length > SHOWN && (
        <p className="m-0 text-[12.5px] text-muted">
          Showing the first {SHOWN} of {plan.rows.length} rows. The import takes them all.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13.5px] text-muted">
          Adds <b className="text-strong">{create}</b> new {create === 1 ? 'company' : 'companies'}
          {sprint && info[sprint] ? ` to ${info[sprint]!.label}` : ''}
          {updates > 0 && (
            <>
              , updates <b className="text-strong">{updates}</b>
            </>
          )}
          {skip > 0 && `, skips ${skip}`}
          {plan.counts.people > 0 && (
            <>
              {' '}
              and adds <b className="text-strong">{plan.counts.people}</b>{' '}
              {plan.counts.people === 1 ? 'person' : 'people'}
            </>
          )}
          .
        </span>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onBack} className={ui.button}>
            Back
          </button>
          <button
            type="button"
            disabled={!hasCompany || !canImport}
            onClick={run}
            className={ui.primary}
          >
            Import
          </button>
        </span>
      </div>
    </div>
  );
}

function Tag({ state, text }: { state: RowState; text?: string }) {
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap ${STATE[state].tag}`}
    >
      {text ?? STATE[state].label}
    </span>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-lg bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-3 py-2 text-[13px] text-fg">
      {children}
    </p>
  );
}
