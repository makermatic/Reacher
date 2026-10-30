import { AnimatePresence, motion } from 'motion/react';
import { armedDanger, ConfirmButton } from './ConfirmButton';
import { useRef, useState } from 'react';
import { stageById, statusLabel } from '../model/stages';
import { peopleOf, previewParts, tokenGroups, tokenMap } from '../model/email';
import { uid } from '../model/text';
import type { Template } from '../model/types';
import { dialogIn, fade } from '../motion';
import { useAppUI } from '../app/AppUI';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { btn, field, fieldInline } from './Modal';
import { useToast } from './Toast';
import { useFieldPicker } from './FieldPicker';
import { fromHashes, toHashes } from '../model/mention';

/** The Email templates editor (SPEC section 8), shown in Settings → Email templates. */
export function TemplatesScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            variants={fade}
            initial="initial"
            animate="enter"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
          />
          <motion.div
            role="dialog"
            aria-label="Email templates"
            variants={dialogIn}
            initial="initial"
            animate="enter"
            exit="exit"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            className="fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-panel sm:inset-6"
          >
            <Templates onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function Templates({ onClose }: { onClose?: () => void }) {
  const { templates } = useWorkspace();
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
  const [selected, setSelected] = useState<Template | null>(sorted[0] ?? null);

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="m-0 font-display text-xl font-bold">Email templates</h2>
        {onClose && (
          <button type="button" onClick={onClose} className={btn.base} autoFocus>
            Done
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <nav className="grid content-start gap-1 overflow-y-auto border-line p-3 max-md:border-b md:border-r">
          {sorted.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={selected?.id === t.id}
              onClick={() => setSelected(t)}
              className="grid gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-hover aria-[current=true]:bg-accent-soft"
            >
              <span className="font-medium">{t.name}</span>
              <small className="truncate text-xs text-muted">
                {t.subject.replace(/\{\{(\w+)\}\}/g, '#$1') || 'No subject'}
              </small>
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              setSelected({
                id: uid('tpl'),
                name: 'New template',
                subject: '',
                body: 'Hi {{first_name}},\n\n\n\nThanks,\n{{my_name}}',
              })
            }
            className={`${btn.ghost} mt-1.5 justify-start`}
          >
            + New template
          </button>
        </nav>
        <section className="min-h-0 overflow-y-auto p-5">
          {selected ? (
            <TemplateEditor
              key={selected.id}
              initial={selected}
              onDeleted={() => setSelected(null)}
            />
          ) : (
            <p className="text-muted">Pick a template or make a new one.</p>
          )}
        </section>
      </div>
    </>
  );
}

function TemplateEditor({ initial, onDeleted }: { initial: Template; onDeleted: () => void }) {
  const { board, companies, me, actions } = useWorkspace();
  const openCompanyId = useAppUI().selected[0]?.id ?? null;
  const toast = useToast();
  const fields = tokenGroups(board).flatMap((g) =>
    g.items.map(([key, label]) => ({ key, label, group: g.name })),
  );
  const keys = new Set(fields.map((f) => f.key));
  // The editor shows fields as #first_name; they're stored as {{first_name}}.
  const [draft, setDraft] = useState(() => ({
    ...initial,
    subject: toHashes(initial.subject, keys),
    body: toHashes(initial.body, keys),
  }));
  const stored = {
    ...draft,
    subject: fromHashes(draft.subject, keys),
    body: fromHashes(draft.body, keys),
  };
  const [previewId, setPreviewId] = useState(
    () => openCompanyId ?? [...companies].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? '',
  );
  const focus = useRef<'subject' | 'body'>('body');
  const subjectPicker = useFieldPicker<HTMLInputElement>({
    items: fields,
    onChange: (subject) => setDraft((d) => ({ ...d, subject })),
  });
  const bodyPicker = useFieldPicker<HTMLTextAreaElement>({
    items: fields,
    onChange: (body) => setDraft((d) => ({ ...d, body })),
  });
  const del = () => {
    actions.deleteTemplate(draft.id);
    toast('Template deleted');
    onDeleted();
  };

  const preview = companies.find((c) => c.id === previewId);
  const m = tokenMap(board, preview, preview ? peopleOf(board, preview)[0]?.p : null, me);
  // M7: suggested for a stage at a status (Board.suggest).
  const usedBy = board.suggest
    .filter((x) => x.tpl === draft.id)
    .map((x) => `${stageById(board, x.stage)?.name ?? x.stage}: ${statusLabel(board, x.status)}`);

  /** Insert #field at the cursor of whichever box was last focused. */
  const insert = (key: string) => {
    const which = focus.current;
    const el = (which === 'subject' ? subjectPicker : bodyPicker).fieldProps.ref.current;
    const tok = `#${key}`;
    const text = draft[which];
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setDraft({ ...draft, [which]: text.slice(0, start) + tok + text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + tok.length, start + tok.length);
    });
  };

  const renderPreview = (text: string) => (
    <>
      {previewParts(board, text, m).map((p, i) =>
        p.kind === 'plain' ? (
          <span key={i}>{p.text}</span>
        ) : (
          <span
            key={i}
            className={
              p.kind === 'filled'
                ? 'rounded bg-[color-mix(in_srgb,var(--c-green)_18%,transparent)] px-0.5'
                : 'rounded bg-[color-mix(in_srgb,var(--c-amber)_26%,transparent)] px-0.5'
            }
          >
            {p.text}
          </span>
        ),
      )}
    </>
  );

  return (
    <div className="grid max-w-3xl gap-4">
      <label htmlFor="tpl-name" className="grid gap-1">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">Template name</span>
        <input
          id="tpl-name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className={field}
        />
      </label>
      <label htmlFor="tpl-subject" className="grid gap-1">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">Subject</span>
        <input
          id="tpl-subject"
          {...subjectPicker.fieldProps}
          value={draft.subject}
          onFocus={() => (focus.current = 'subject')}
          autoComplete="off"
          className={field}
        />
        {subjectPicker.menu}
      </label>
      <label htmlFor="tpl-body" className="grid gap-1">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">Body</span>
        <textarea
          id="tpl-body"
          {...bodyPicker.fieldProps}
          rows={14}
          value={draft.body}
          onFocus={() => (focus.current = 'body')}
          className={`${field} resize-y leading-relaxed`}
        />
        {bodyPicker.menu}
      </label>

      <div className="grid gap-2">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">
          Fill-in fields · type # in the subject or body, or click one
        </span>
        {tokenGroups(board).map((g) => (
          <div key={g.name} className="grid gap-1">
            <b className="text-[13px]">{g.name}</b>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  title={`Inserts #${k}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insert(k)}
                  className="rounded-full border border-line-strong px-2.5 py-0.5 text-[12.5px] transition-colors hover:border-accent hover:bg-accent-soft"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        ))}
        <span className="text-xs text-muted">Every column you add shows up under Company.</span>
      </div>

      <div className="grid gap-2">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">Preview</span>
        <select
          id="tpl-preview-company"
          value={previewId}
          onChange={(e) => setPreviewId(e.target.value)}
          aria-label="Preview with company"
          className={fieldInline}
        >
          {companies.length ? (
            [...companies]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Filled in for {c.name}
                </option>
              ))
          ) : (
            <option value="">No companies yet</option>
          )}
        </select>
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13.5px]">
          <div className="mb-2 border-b border-line pb-2">
            <span className="eyebrow mr-2 text-[10.5px] text-muted">Subject</span>
            {renderPreview(stored.subject)}
          </div>
          <div className="whitespace-pre-wrap">{renderPreview(stored.body)}</div>
        </div>
        <span className="text-xs text-muted">
          Green = filled in from the company. Yellow = blank for this company.
        </span>
      </div>

      <p className="m-0 text-[13px] text-muted">
        {usedBy.length ? `Suggested at: ${usedBy.join(', ')}` : 'Not suggested at any stage yet.'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            actions.saveTemplate({ ...stored, name: draft.name.trim() || 'Untitled' });
            toast('Template saved');
          }}
          className={btn.primary}
        >
          Save template
        </button>
        <ConfirmButton
          onConfirm={del}
          confirm="Click again to delete"
          className={`${btn.base} ${btn.danger}`}
          armedClassName={`${armedDanger} px-3 py-1.5 text-sm`}
        >
          Delete
        </ConfirmButton>
      </div>
    </div>
  );
}
