import { useState } from 'react';
import { useAssistant } from '../ai/Assistant';
import { colByName } from '../model/board';
import {
  defaultTarget,
  defaultTemplateId,
  fillWithPlaceholders,
  guessName,
  isSharedInbox,
  missingFields,
  peopleOf,
  placeholder,
  replaceFilled,
  tokenLabel,
  tokenMap,
} from '../model/email';
import { norm, slug } from '../model/text';
import type { Column, Company } from '../model/types';
import { btn, fieldInline } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useState as useLocalState } from 'react';
import { FieldInput } from '../app/fields';
import { useAppUI } from '../app/AppUI';
import { Pop } from '../app/ui';
import { useWorkspace } from '../workspace/WorkspaceProvider';
import { useGmail } from '../workspace/GmailProvider';

const FOLLOW_DAYS = [3, 5, 7, 10, 14];

type Edit = { subject: string; body: string; fromAI: boolean } | null;

/**
 * "Write an email" on the company page (SPEC section 7): pick a chain and a
 * template, fill it from the company, contact and Your details, edit freely,
 * then copy it, open it in a mail app, or log it as sent.
 */
export function ComposeEmail({
  company,
  preset,
}: {
  company: Company;
  /** Start from a suggested next step (M7 round 2): its template and chain. */
  preset?: { template: string; target: string };
}) {
  const { board, chains, templates, me, actions } = useWorkspace();
  const assistant = useAssistant();
  const { navigate } = useAppUI();
  const openDetails = () => navigate({ page: 'settings', tab: 'details' });
  const toast = useToast();

  const myChains = chains
    .filter((ch) => ch.companyId === company.id)
    .sort((a, b) => (a.started < b.started ? 1 : -1));
  const [target, setTarget] = useState(() => preset?.target ?? defaultTarget(company, chains));
  const [tplId, setTplId] = useState(
    () => preset?.template || defaultTemplateId(board, company, templates),
  );
  const [personCol, setPersonCol] = useState('');
  const [edit, setEdit] = useState<Edit>(null);
  const [followDays, setFollowDays] = useState(7);
  const [drafting, setDrafting] = useState(false);
  const gmail = useGmail();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const people = peopleOf(board, company);
  const sel = people.find((x) => x.col.id === personCol) ?? people[0];
  const contactCol = sel?.col ?? board.columns.find((c) => c.type === 'person');
  const m = tokenMap(board, company, sel?.p, me);
  const tpl = templates.find((t) => t.id === tplId);
  const chainForTarget = target === 'new' ? null : (myChains.find((c) => c.id === target) ?? null);

  // Untouched text follows the template; edited text keeps the edits but fills
  // placeholders as their fields get values.
  const subject = edit
    ? replaceFilled(board, edit.subject, m)
    : fillWithPlaceholders(board, tpl?.subject ?? '', m);
  const body = edit
    ? replaceFilled(board, edit.body, m)
    : fillWithPlaceholders(board, tpl?.body ?? '', m);
  const missing = missingFields(board, [subject, body], tpl, m);
  const to = sel?.p.email ?? '';

  const setText = (k: 'subject' | 'body', v: string) =>
    setEdit({ subject, body, fromAI: edit?.fromAI ?? false, [k]: v });

  const copy = async (what: string, text: string) => {
    if (!text.trim()) return toast('Nothing to copy yet');
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copied ${what}`);
    } catch {
      toast('Copy was blocked. Select the text and press Ctrl+C.');
    }
  };

  const draft = async () => {
    setDrafting(true);
    const r = await assistant.draft(
      company,
      sel ? { name: sel.p.name, role: sel.p.role } : null,
      chainForTarget,
    );
    setDrafting(false);
    if (r) setEdit({ ...r, fromAI: true });
  };

  const logSent = () => {
    if (!body.trim()) return toast('Write the email first');
    const r = actions.logSent(company, target, subject.trim(), body, followDays);
    setTarget(r.chainId);
    setEdit(null);
    toast(r.toast);
  };

  /** Into Gmail's drafts (M9), as a reply when the chain follows a Gmail thread. Never sent from here. */
  const saveDraft = async () => {
    if (!to) return toast('Add who it’s to first');
    if (!body.trim()) return toast('Write the email first');
    setSaving(true);
    const r = await gmail.saveDraft(chainForTarget, { to: [to], subject: subject.trim(), body });
    setSaving(false);
    if ('error' in r) return toast(r.error);
    setSaved(r.link || '');
  };

  const mailto =
    to && body.trim()
      ? `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : '';

  return (
    <div className="mt-1.5 grid gap-2">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-[10.5px] font-semibold text-muted">Write an email</span>
        {assistant.available && (
          <button
            type="button"
            onClick={draft}
            disabled={drafting}
            className={`${btn.base} ${btn.small}`}
          >
            {drafting ? 'Writing…' : edit?.fromAI ? 'Try another' : 'Draft with AI'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          id="compose-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Which chain"
          className={fieldInline}
        >
          <option value="new">Start a new chain</option>
          {myChains.map((ch) => (
            <option key={ch.id} value={ch.id}>
              Reply in: {ch.title}
            </option>
          ))}
        </select>
        <select
          id="compose-template"
          value={edit ? '' : tplId}
          onChange={(e) => {
            if (!e.target.value) return;
            setTplId(e.target.value);
            setEdit(null);
          }}
          aria-label="Template"
          className={fieldInline}
        >
          <option value="">
            {edit ? (edit.fromAI ? 'AI draft' : 'Your edits') : 'Pick a template…'}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {people.length > 1 && (
          <select
            id="compose-person"
            value={sel?.col.id}
            onChange={(e) => setPersonCol(e.target.value)}
            aria-label="Recipient"
            className={fieldInline}
          >
            {people.map((x) => (
              <option key={x.col.id} value={x.col.id}>
                {x.p.name || x.p.email}
              </option>
            ))}
          </select>
        )}
      </div>

      <div
        className={`${drafting ? 'ai-working ' : ''}overflow-hidden rounded-xl border border-line-strong`}
      >
        <Row label="To" onCopy={to ? () => copy('address', to) : undefined}>
          <RecipientField
            key={`${company.id}:${sel?.col.id ?? ''}:${to}`}
            company={company}
            current={sel?.p ?? null}
            colId={contactCol?.id}
            colName={contactCol?.name}
            guessWithAI={assistant.available ? assistant.guessName : null}
          />
        </Row>
        <Row label="Subject" onCopy={subject ? () => copy('subject', subject) : undefined}>
          <input
            id="compose-subject"
            value={subject}
            onChange={(e) => setText('subject', e.target.value)}
            placeholder="Subject"
            aria-label="Subject"
            className="w-full bg-transparent py-0.5 outline-none"
          />
        </Row>
        <textarea
          id="compose-body"
          value={body}
          onChange={(e) => setText('body', e.target.value)}
          aria-label="Email body"
          rows={Math.max(8, body.split('\n').length + 1)}
          placeholder={
            company.meta?.status === 'wroteback' && assistant.available
              ? 'They wrote back. Draft with AI for a reply, pick a template, or just start typing.'
              : 'Pick a template, draft with AI, or just start typing.'
          }
          className="block w-full resize-y bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed outline-none"
        />
        {edit && (
          <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-3 py-1.5 text-xs text-muted">
            {edit.fromAI ? 'AI draft' : 'Edited'}
            <button
              type="button"
              onClick={() => setEdit(null)}
              className={`${btn.ghost} ${btn.small}`}
            >
              Back to template
            </button>
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg bg-[color-mix(in_srgb,var(--c-amber)_16%,var(--surface))] px-3 py-2 text-[13px]">
          <span>Fill in before sending:</span>
          {missing.map((k, i) => (
            <span key={k} className="inline-flex items-center gap-1">
              <b>{placeholder(board, k)}</b>
              <FixLink
                fieldKey={k}
                company={company}
                onOpenDetails={openDetails}
                contactColId={contactCol?.id}
              />
              {i < missing.length - 1 && <span className="text-muted">·</span>}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => copy('email', body)} className={btn.primary}>
          Copy email
        </button>
        {gmail.available && (
          <button type="button" onClick={saveDraft} disabled={saving} className={btn.base}>
            {saving ? 'Saving…' : 'Save to Gmail drafts'}
          </button>
        )}
        {mailto && (
          <a href={mailto} className={btn.base}>
            Open in mail app
          </a>
        )}
        <button type="button" onClick={logSent} className={btn.base}>
          Log as sent
        </button>
        <span className="text-[12.5px] text-muted">follow up in</span>
        <select
          id="compose-follow"
          value={followDays}
          onChange={(e) => setFollowDays(Number(e.target.value))}
          aria-label="Follow up in"
          className={`${fieldInline} py-1`}
        >
          {FOLLOW_DAYS.map((n) => (
            <option key={n} value={n}>
              {n} days
            </option>
          ))}
        </select>
      </div>
      {saved !== null && (
        <p className="m-0 text-[12.5px] text-muted">
          Saved in your Gmail drafts.{' '}
          {saved && (
            <a
              href={saved}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline underline-offset-2"
            >
              Open it in Gmail ↗
            </a>
          )}{' '}
          Once you send it, it shows up in this company’s email chains on the next Gmail check.
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  onCopy,
  children,
}: {
  label: string;
  onCopy?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 border-b border-line bg-surface px-3">
      <span className="eyebrow w-14 shrink-0 text-[10.5px] text-muted">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {onCopy && (
        <button type="button" onClick={onCopy} className={`${btn.ghost} ${btn.small}`}>
          Copy
        </button>
      )}
    </div>
  );
}

/**
 * The To field: typing an address saves it into the contact and fills in the
 * name: fred.smith@ → Fred Smith, shared inboxes skipped, otherwise a quick
 * AI guess (SPEC section 7).
 */
function RecipientField({
  company,
  current,
  colId,
  colName,
  guessWithAI,
}: {
  company: Company;
  current: { name: string; role: string; email: string } | null;
  colId: string | undefined;
  colName: string | undefined;
  guessWithAI: ((email: string) => Promise<string>) | null;
}) {
  const { actions } = useWorkspace();
  const toast = useToast();
  const [value, setValue] = useState(current?.email ?? '');

  const save = async () => {
    const v = value.trim();
    if (!colId) return toast('Add a Person column first (+ Column → Person)');
    const cur = current ?? { name: '', role: '', email: '' };
    if (v === (cur.email || '')) return;
    let name = cur.name || '';
    const local = norm(v.split('@')[0]);
    const first = norm(cur.name.split(/\s+/)[0]);
    // A different person's address: the name should follow it.
    const newPerson = !name || (!!cur.email && !!first && !local.includes(first));
    if (v && newPerson) {
      name = guessName(v);
      if (!name && guessWithAI && !isSharedInbox(v)) name = await guessWithAI(v);
    }
    actions.setMeta(company.id, colId, {
      name,
      role: newPerson && cur.email ? '' : cur.role || '',
      email: v,
    });
    toast(
      v
        ? `Saved to ${colName}${name ? `: ${name}` : '. Add their name on the Details card.'}`
        : `Removed the email from ${colName}`,
    );
  };

  return (
    <span className="flex items-center gap-2">
      <input
        id="compose-to"
        type="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void save()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Type their email, the name fills in"
        aria-label="Recipient email"
        title={colName ? `Saved to ${colName}` : undefined}
        className="min-w-0 flex-1 bg-transparent py-0.5 outline-none"
      />
      {current?.name && <span className="shrink-0 text-[12.5px] text-muted">{current.name}</span>}
    </span>
  );
}

/** The "set it" / "add it" link next to a blank field in the warning. */
function FixLink({
  fieldKey,
  company,
  onOpenDetails,
  contactColId,
}: {
  fieldKey: string;
  company: Company;
  onOpenDetails: () => void;
  contactColId: string | undefined;
}) {
  const { board } = useWorkspace();
  const link = 'text-accent underline underline-offset-2';
  if (fieldKey.startsWith('my_'))
    return (
      <button type="button" onClick={onOpenDetails} className={link}>
        add it
      </button>
    );
  const colId = ['first_name', 'contact_name', 'contact_role'].includes(fieldKey)
    ? contactColId
    : board.columns.find((c) => slug(c.name) === fieldKey)?.id;
  const col = colId
    ? board.columns.find((c) => c.id === colId)
    : colByName(board, tokenLabel(board, fieldKey));
  if (!col) return <span className="text-muted">(not a field, check the template)</span>;
  return <SetIt company={company} col={col} className={link} />;
}

/** "set it": that field's editor in a small popover. */
function SetIt({ company, col, className }: { company: Company; col: Column; className: string }) {
  const [open, setOpen] = useLocalState(false);
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      width={300}
      label={`Set ${col.name}`}
      trigger={
        <button
          type="button"
          aria-label={`Edit ${col.name} for ${company.name}`}
          className={className}
        >
          set it
        </button>
      }
    >
      <FieldInput company={company} col={col} variant="row" />
    </Pop>
  );
}
