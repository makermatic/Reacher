import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { fade, popIn } from '../motion';
import { useDoc, useRuntime } from '../runtime/RuntimeProvider';
import { useToast } from './Toast';

/** settings/me in the prototype: fills the my_* email template fields. */
export type Me = { name: string; portfolio: string; reel: string; phone: string; intro: string };

const EMPTY: Me = { name: '', portfolio: '', reel: '', phone: '', intro: '' };

const FIELDS: { key: keyof Me; label: string; type?: string; placeholder?: string }[] = [
  { key: 'name', label: 'Your name' },
  { key: 'portfolio', label: 'Portfolio link', type: 'url', placeholder: 'https://' },
  { key: 'reel', label: 'Reel link', type: 'url', placeholder: 'https://' },
  { key: 'phone', label: 'Phone', type: 'tel' },
];

const input =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 outline-none transition-[border-color] duration-200 focus:border-accent';

export function YourDetailsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const me = useDoc<Me>('me');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                variants={fade}
                initial="initial"
                animate="enter"
                exit="exit"
                className="fixed inset-0 z-40 bg-black/30"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                variants={popIn}
                initial="initial"
                animate="enter"
                exit="exit"
                className="fixed inset-x-4 top-[8vh] z-50 mx-auto max-h-[84vh] max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-panel"
              >
                <Dialog.Title className="m-0 font-display text-xl font-bold">
                  Your details
                </Dialog.Title>
                <p className="mt-1 mb-5 text-muted">
                  These fill the “You” fields in email templates, like your name and reel link.
                </p>
                {me === undefined ? (
                  <p className="text-muted">Loading…</p>
                ) : (
                  <DetailsForm initial={{ ...EMPTY, ...me }} onDone={() => onOpenChange(false)} />
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (runtime.status !== 'ready') return;
    setSaving(true);
    setError('');
    try {
      await runtime.store.setDoc('me', values);
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
          <span className="font-medium">{f.label}</span>
          <input
            id={`me-${f.key}`}
            type={f.type ?? 'text'}
            value={values[f.key]}
            onChange={set(f.key)}
            placeholder={f.placeholder}
            className={input}
          />
        </label>
      ))}
      <label htmlFor="me-intro" className="grid gap-1.5">
        <span className="font-medium">Intro paragraph</span>
        <textarea
          id="me-intro"
          rows={4}
          value={values.intro}
          onChange={set('intro')}
          placeholder="A few sentences about you and your work"
          className={`${input} resize-y`}
        />
      </label>
      {error && <p className="m-0 text-[var(--c-red)]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Dialog.Close className="rounded-lg px-3.5 py-2 font-medium text-muted transition-colors hover:bg-hover">
          Cancel
        </Dialog.Close>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
