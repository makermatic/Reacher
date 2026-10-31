/**
 * Gmail, the data side (M9): which threads belong to which company, and how
 * a thread's messages land in an email chain. No connector calls here; those
 * live in src/runtime/gmail.ts.
 */
import { companyDomains, companyEmails, inDomains } from './contacts';
import { similarText } from './quickPlan';
import { isPlainObject, uid } from './text';
import type { Board, Chain, Company, Message } from './types';

/** One email, trimmed to what Reacher uses. */
export type MailMessage = {
  id: string;
  /** The sender's address, lowercased. */
  from: string;
  /** Everyone else on it (to and cc), lowercased. */
  to: string[];
  /** YYYY-MM-DD. */
  date: string;
  subject: string;
  /** The new part of the email, quoted replies cut off. */
  text: string;
  /** Sent by the viewer. */
  sent: boolean;
};

export type MailThread = { id: string; link: string; subject: string; messages: MailMessage[] };
/** A search hit: enough to tell whether the thread has news. */
export type ThreadHit = { id: string; messageCount: number };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown) => (Array.isArray(v) ? v : []);

/** "Sam Lee <sam@psyop.tv>" or "sam@psyop.tv" → "sam@psyop.tv". */
export const addressOf = (s: string) => (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();

/** A chain still wearing the name it was started with ("Email chain Oct 31", "Email with Ana Oct 31"). */
export const isDefaultTitle = (title: string) =>
  /^Email (chain|with .+?)( [A-Z][a-z]{2} \d{1,2}(, \d{4})?)?$/.test(title.trim());

/** The subject of a pasted or logged email ("Subject: …" on its first lines), without Re:/Fwd:. */
export function subjectOf(text: string): string {
  const m = /^\s*subject:\s*(.+)$/im.exec(text.split('\n').slice(0, 4).join('\n'));
  return m ? baseSubject(m[1]!.trim()) : '';
}

/** "Re: Fwd: Hello" → "Hello". */
export const baseSubject = (s: string) => s.replace(/^\s*((re|fwd?|aw|sv)\s*:\s*)+/i, '').trim();

/**
 * The new part of an email: stops at the quoted earlier message ("On … wrote:",
 * "-----Original Message-----", an Outlook "From:" block or ">" lines).
 */
export function freshText(body: string): string {
  const out: string[] = [];
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const two = `${line} ${lines[i + 1] ?? ''}`;
    if (
      /^\s*>/.test(line) ||
      /^-{2,}\s*(original message|forwarded message)/i.test(line.trim()) ||
      /^on .{4,200}wrote:\s*$/i.test(line.trim()) ||
      /^on .{4,200}wrote:\s*$/i.test(two.trim()) ||
      (/^from:\s/i.test(line) && /^(sent|date):\s/i.test(lines[i + 1] ?? ''))
    )
      break;
    out.push(line);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000);
}

/** The threads in a search_threads answer ({threads: [...]}). */
export const toThreadHits = (payload: unknown): ThreadHit[] =>
  list(isPlainObject(payload) ? payload.threads : null)
    .filter(isPlainObject)
    .filter((t) => t.id)
    .map((t) => ({ id: String(t.id), messageCount: Number(t.messageCount) || 0 }));

/** A get_thread answer → MailThread, or null. Drafts and spam never come through. */
export function toMailThread(payload: unknown): MailThread | null {
  if (!isPlainObject(payload) || !payload.id) return null;
  const messages = list(payload.messages)
    .filter(isPlainObject)
    .filter((m) => m.id && !list(m.labelIds).includes('DRAFT'))
    .map((m): MailMessage => {
      const labels = list(m.labelIds).map(String);
      const date = str(m.date) || new Date(Number(m.internalDate) || 0).toISOString();
      return {
        id: String(m.id),
        from: addressOf(str(m.sender)),
        to: [...list(m.toRecipients), ...list(m.ccRecipients)].map((x) => addressOf(String(x))),
        date: localDay(date),
        subject: str(m.subject),
        text: freshText(str(m.plaintextBody) || str(m.snippet)),
        sent: labels.includes('SENT'),
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return {
    id: String(payload.id),
    link: str(payload.viewUrl),
    subject: baseSubject(messages.find((m) => m.subject)?.subject ?? ''),
    messages,
  };
}

/** An ISO time ("…Z") as the viewer's own calendar day. */
function localDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The Gmail search for these companies' email: to or from their domains and
 * contact addresses, over the last `days`. Null when none of them has a
 * website or contact email to search by.
 */
/** People's emails by company id (M11), on top of the company's own fields. */
export type ExtraEmails = Record<string, string[]>;

const emailsOf = (board: Board, c: Company, extra: ExtraEmails) => [
  ...companyEmails(board, c),
  ...(extra[c.id] ?? []),
];

export function mailQuery(
  board: Board,
  companies: Company[],
  days: number,
  extra: ExtraEmails = {},
): string | null {
  const terms = new Set<string>();
  for (const c of companies) {
    const domains = companyDomains(board, c);
    for (const d of domains) terms.add(d);
    for (const e of emailsOf(board, c, extra)) if (!inDomains(e, domains)) terms.add(e);
  }
  if (!terms.size) return null;
  const who = [...terms].flatMap((t) => [`from:${t}`, `to:${t}`]).join(' OR ');
  return `(${who}) newer_than:${days}d -category:promotions -category:social`;
}

/** Which company a thread is with: a contact's exact address first, else a domain. */
export function threadCompany(
  board: Board,
  companies: Company[],
  thread: MailThread,
  extra: ExtraEmails = {},
): Company | null {
  const people = new Set(thread.messages.flatMap((m) => [m.from, ...m.to]));
  const byEmail = companies.find((c) => emailsOf(board, c, extra).some((e) => people.has(e)));
  if (byEmail) return byEmail;
  return (
    companies.find((c) => {
      const domains = companyDomains(board, c);
      return domains.length > 0 && [...people].some((p) => inDomains(p, domains));
    }) ?? null
  );
}

/** How many of a thread's messages a chain already has (to skip threads with no news). */
export const knownCount = (chains: Chain[], threadId: string) =>
  chains
    .filter((ch) => ch.gmailThreadId === threadId)
    // A chain from before M11 doesn't know who's on it yet: read it once more.
    .filter((ch) => ch.people?.length)
    .reduce(
      (n, ch) => n + ch.messages.filter((m) => m.gmailId).length + (ch.gmailSkip?.length ?? 0),
      0,
    );

export type ChainSync = {
  chain: Chain;
  added: Message[];
  /** True when this thread wasn't linked to a chain before. */
  linked: boolean;
};

/**
 * Brings one thread into a company's chains: into the chain already linked to
 * it, else the chain with the same title, else a new chain. Messages already
 * there (by Gmail id, or pasted by hand with the same day, direction and
 * text) aren't added twice. Null when nothing changes.
 */
export function syncThread(
  company: Company,
  chains: Chain[],
  thread: MailThread,
): ChainSync | null {
  const own = chains.filter((ch) => ch.companyId === company.id);
  const title = thread.subject || 'Email';
  const existing =
    own.find((ch) => ch.gmailThreadId === thread.id) ??
    own.find(
      (ch) => !ch.gmailThreadId && baseSubject(ch.title).toLowerCase() === title.toLowerCase(),
    );
  const chain: Chain = existing
    ? { ...existing, messages: [...existing.messages] }
    : {
        id: uid('ch'),
        companyId: company.id,
        title,
        started: thread.messages[0]?.date ?? '',
        messages: [],
        summary: null,
      };
  const linked = chain.gmailThreadId !== thread.id;
  // A chain started by hand takes the email's subject once Gmail links it (Zack).
  if (linked && isDefaultTitle(chain.title) && thread.subject) chain.title = baseSubject(title);
  chain.gmailThreadId = thread.id;
  // Who's on it, so each person's panel can show their emails (M11).
  const everyone = thread.messages.flatMap((m) => [m.from, ...m.to]).filter(Boolean);
  const people = [...new Set([...(chain.people ?? []), ...everyone])];
  const newPeople = people.length !== (chain.people ?? []).length;
  if (newPeople) chain.people = people;
  chain.gmailLink = thread.link;

  const added: Message[] = [];
  for (const m of thread.messages) {
    if (chain.messages.some((x) => x.gmailId === m.id) || chain.gmailSkip?.includes(m.id)) continue;
    const dir = m.sent ? 'out' : 'in';
    const pasted = chain.messages.findIndex(
      (x) => !x.gmailId && x.date === m.date && x.dir === dir && similarText(x.text, m.text),
    );
    if (pasted >= 0) {
      chain.messages[pasted] = { ...chain.messages[pasted]!, gmailId: m.id };
      continue;
    }
    const msg: Message = { id: uid('m'), dir, date: m.date, text: m.text, gmailId: m.id };
    chain.messages.push(msg);
    added.push(msg);
  }
  if (!added.length && !linked && !newPeople) return null;
  chain.messages.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (chain.messages[0] && (!chain.started || chain.messages[0].date < chain.started))
    chain.started = chain.messages[0].date;
  return { chain, added, linked };
}

/** The newest email date across a company's chains ('' if none). */
export const latestEmail = (chains: Chain[], companyId: string) =>
  chains
    .filter((ch) => ch.companyId === companyId)
    .flatMap((ch) => ch.messages.map((m) => m.date))
    .reduce((a, b) => (b > a ? b : a), '');
