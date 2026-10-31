import { motion } from 'motion/react';
import { useState, type ChangeEvent } from 'react';
import { describeImport, ImportError, parseExport, type ImportData } from '../model/importData';
import { glide } from '../motion';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { btn, Modal } from './Modal';
import { useToast } from './Toast';

type Step =
  | { kind: 'pick'; error?: string }
  | { kind: 'confirm'; data: ImportData; fileName: string }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; summary: string[] }
  | { kind: 'failed'; message: string };

/** Bring over everything from the prototype's Export file. */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Import from the prototype"
      description="In the prototype, open Your details and click Export data. Then pick that file here."
    >
      <ImportFlow onDone={() => onOpenChange(false)} />
    </Modal>
  );
}

function ImportFlow({ onDone }: { onDone: () => void }) {
  const { companies, actions } = useWorkspace();
  const toast = useToast();
  const [step, setStep] = useState<Step>({ kind: 'pick' });

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setStep({ kind: 'confirm', data: parseExport(await file.text()), fileName: file.name });
    } catch (err) {
      setStep({
        kind: 'pick',
        error: err instanceof ImportError ? err.message : "Couldn't read that file.",
      });
    }
  };

  const run = async (data: ImportData) => {
    setStep({ kind: 'importing', done: 0, total: 1 });
    try {
      await actions.importData(data, (done, total) => setStep({ kind: 'importing', done, total }));
      setStep({ kind: 'done', summary: describeImport(data) });
      toast('Import finished');
    } catch (err) {
      console.warn('Reacher: import failed', err);
      setStep({
        kind: 'failed',
        message:
          (err as { code?: string })?.code === 'quota_exceeded'
            ? 'Storage is full, so the import stopped partway. Nothing was lost; delete some data and import again.'
            : 'The import stopped partway. Importing the same file again is safe: it fills in what’s missing.',
      });
    }
  };

  switch (step.kind) {
    case 'pick':
      return (
        <div className="grid gap-3">
          <label
            htmlFor="import-file"
            className="grid cursor-pointer place-items-center gap-1 rounded-xl border-2 border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-soft"
          >
            <span className="font-semibold">Choose the export file</span>
            <span className="text-[12.5px] text-muted">
              A .json file, like studio-outreach-tracker-2026-10-28.json
            </span>
            <input
              id="import-file"
              type="file"
              accept=".json,application/json"
              onChange={pick}
              className="sr-only"
            />
          </label>
          {step.error && <p className="m-0 text-[var(--c-red)]">{step.error}</p>}
        </div>
      );
    case 'confirm': {
      const summary = describeImport(step.data);
      return (
        <div className="grid gap-4">
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <div className="eyebrow text-[10.5px] text-muted">{step.fileName}</div>
            <p className="mt-1 mb-0">
              {summary.length ? summary.join(', ') : 'No companies in this file.'}
            </p>
          </div>
          <p className="m-0 text-muted">
            This also brings over your columns, status choices and Your details.
            {companies.length > 0 &&
              ` You already have ${companies.length} ${companies.length === 1 ? 'company' : 'companies'} here; they stay, and anything with the same id is replaced by the file's version.`}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn.ghost} onClick={() => setStep({ kind: 'pick' })}>
              Pick another file
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => run(step.data)}
              disabled={!summary.length}
            >
              Import
            </button>
          </div>
        </div>
      );
    }
    case 'importing':
      return (
        <div className="grid gap-2" role="status">
          <span>
            Importing… {step.done} of {step.total}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-line">
            <motion.span
              className="block h-full bg-accent"
              animate={{ width: `${(step.done / Math.max(1, step.total)) * 100}%` }}
              transition={glide}
            />
          </span>
        </div>
      );
    case 'done':
      return (
        <div className="grid gap-4">
          <p className="m-0">Imported {step.summary.join(', ')}.</p>
          <div className="flex justify-end">
            <button type="button" className={btn.primary} onClick={onDone}>
              Done
            </button>
          </div>
        </div>
      );
    case 'failed':
      return (
        <div className="grid gap-4">
          <p className="m-0 text-[var(--c-red)]">{step.message}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn.ghost} onClick={onDone}>
              Close
            </button>
            <button type="button" className={btn.primary} onClick={() => setStep({ kind: 'pick' })}>
              Try again
            </button>
          </div>
        </div>
      );
  }
}
