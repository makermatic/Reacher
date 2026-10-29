import { useState, type FormEvent } from 'react';
import { normalizeUrl } from '../lib/links';
import { todayISO } from '../model/dates';
import type { Me } from '../model/types';
import { useRuntime } from '../runtime/RuntimeProvider';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { btn, field, Modal } from './Modal';
import { useToast } from './Toast';
import { AiCheck } from './AiCheck';

const EMPTY: Me = { name: '', portfolio: '', reel: '', phone: '', intro: '' };

const FIELDS: {
  key: keyof Me;
  label: string;
  link?: boolean;
  type?: string;
  placeholder?: string;
}[] = [
  { key: 'name', label: 'Your name' },
  { key: 'portfolio', label: 'Portfolio link', link: true, placeholder: 'yoursite.com' },
  { key: 'reel', label: 'Reel link', link: true, placeholder: 'vimeo.com/…' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  // intro is the textarea below
];

/** Links are typed loosely ("zackzand.com") and saved as full links. */
const tidy = (v: Me): Me => ({
  ...v,
  portfolio: normalizeUrl(v.portfolio),
  reel: normalizeUrl(v.reel),
});

/** settings/me in the prototype: fills the my_* email template fields. */
export function YourDetailsDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: () => void;
}) {
  const { loading, me } = useWorkspace();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Your details"
      description="These fill the “You” fields in email templates, like your name and reel link."
    >
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <DetailsForm initial={{ ...EMPTY, ...me }} onDone={() => onOpenChange(false)} />
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4 text-[13px] text-muted">
        <span className="min-w-0 flex-1">
          Your data is yours. Export everything as one file anytime, or bring in an export.
        </span>
        <ExportButton />
        <button type="button" className={`${btn.base} ${btn.small}`} onClick={onImport}>
          Import data
        </button>
      </div>
      <div className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
        <AiCheck />
      </div>
    </Modal>
  );
}

function DetailsForm({ initial, onDone }: { initial: Me; onDone: () => void }) {
  const runtime = useRuntime();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof Me) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (runtime.status !== 'ready') return;
    setSaving(true);
    setError('');
    try {
      await runtime.store.setDoc('me', tidy(values));
      toast('Saved your details');
      onDone();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      {FIELDS.map((f) => (
        <label key={f.key} htmlFor={`me-${f.key}`} className="grid gap-1.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-medium">{f.label}</span>
            <span className="font-mono text-[11px] text-faint">{`#my_${f.key}`}</span>
          </span>
          <input
            id={`me-${f.key}`}
            type={f.type ?? 'text'}
            inputMode={f.link ? 'url' : undefined}
            value={values[f.key]}
            onChange={set(f.key)}
            onBlur={
              f.link
                ? () => setValues((v) => ({ ...v, [f.key]: normalizeUrl(v[f.key]) }))
                : undefined
            }
            placeholder={f.placeholder}
            className={`${field} py-2`}
          />
        </label>
      ))}
      <label htmlFor="me-intro" className="grid gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-medium">Intro paragraph</span>
          <span className="font-mono text-[11px] text-faint">#my_intro</span>
        </span>
        <textarea
          id="me-intro"
          rows={4}
          value={values.intro}
          onChange={set('intro')}
          placeholder="A few sentences about you and your work"
          className={`${field} resize-y py-2`}
        />
      </label>
      {error && <p className="m-0 text-[var(--c-red)]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className={btn.ghost} onClick={onDone}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${btn.primary} px-4 py-2`}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/** Export data (SPEC section 10): everything in one file, the same shape the import reads. */
function ExportButton() {
  const runtime = useRuntime();
  const { board, companies, chains, pages, templates, me } = useWorkspace();
  const toast = useToast();
  const saveFile = runtime.status === 'ready' ? runtime.saveFile : null;
  const exportAll = async () => {
    if (!saveFile) return toast('Export works when Reacher is open in Claude.');
    const data = {
      exported: new Date().toISOString(),
      board,
      companies,
      chains,
      pages,
      templates,
      me,
    };
    try {
      await saveFile(`reacher-${todayISO()}.json`, JSON.stringify(data, null, 2));
      toast('Exported');
    } catch (e) {
      if ((e as { code?: string } | null)?.code !== 'declined')
        toast("Couldn't export. Try again.");
    }
  };
  return (
    <button type="button" className={`${btn.base} ${btn.small}`} onClick={exportAll}>
      Export data
    </button>
  );
}
