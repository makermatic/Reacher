/**
 * The prompts, carried over from the prototype word for word (they were tuned
 * with Zack over many rounds), plus additions marked with the round they came from. Each one sends the instructions, the data and
 * the exact shape it wants back (SPEC section 9).
 */
import { meta, optionOf, optList, statusCol, valueText } from '../model/board';
import { todayISO } from '../model/dates';
import type { Board, Chain, Column, Company, Message, Page } from '../model/types';

export const MEDIA =
  'media companies: motion design and animation studios, advertising agencies, production companies, post houses, TV networks and broadcasters, film studios, video game studios, and in-house creative teams at brands';

/** What each built-in status means, so renamed labels still mean the same thing. */
const MEANING: Record<string, string> = {
  gathering: 'researching them',
  reached: 'I emailed or messaged them first',
  wroteback: 'they replied or reached out, and I owe a response',
  replied: 'I answered them and I am waiting on them',
  meeting: 'we talked (call, coffee chat, video)',
  applied: 'applied through a job posting',
  rejected: 'turned down',
  interview: 'formal interview after applying',
};

const label = (col: Column, id: string) => optionOf(col, id)?.label ?? id;
const byDate = <T extends { date: string }>(a: T, b: T) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

function statusMeanings(board: Board) {
  return optList(statusCol(board))
    .map((o) => `${o.label} = ${MEANING[o.id] ?? "(the job seeker's own choice)"}`)
    .join('; ');
}

/** Squashed for name matching: "Sibling Rivalry" matches "siblingrivalry". */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * What the tracker already has for the companies a note names, so the AI can
 * word a repeat as a follow-up ("Spoke again") instead of a copy (Zack, round 3).
 */
export function noteHistory(companies: Company[], pages: Record<string, Page>, note: string) {
  const n = squash(note);
  return companies
    .filter((c) => squash(c.name).length >= 3 && n.includes(squash(c.name)))
    .map((c) => {
      const page = pages[c.id];
      if (!page) return '';
      const lines = [
        ...page.meetings.map(
          (m) =>
            `[${m.date}] ${m.kind === 'interview' ? 'INTERVIEW' : 'MEETING'}: ${m.notes || ''}`,
        ),
        ...page.notes.map((x) => `[${x.date}] NOTE: ${x.text}`),
        ...page.applications.map((a) => `[${a.date}] APPLIED: ${a.role}`),
      ]
        .sort()
        .slice(-6);
      return lines.length ? `${c.name} so far:\n${lines.join('\n')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

export function quickUpdatePrompt(
  board: Board,
  companies: Company[],
  chains: Chain[],
  note: string,
  today = todayISO(),
  pages: Record<string, Page> = {},
) {
  const history = noteHistory(companies, pages, note);
  const sc = statusCol(board);
  const statusCols = board.columns
    .filter((c) => c.type === 'status')
    .map(
      (c) =>
        `"${c.name}": ${optList(c)
          .map((o) => `${o.label}${o.group ? ` (${o.group})` : ''}`)
          .join(', ')}${
          c.showWhen
            ? ` [only used once Status is ${c.showWhen.values.map((v) => label(sc, v)).join(' or ')}]`
            : ''
        }`,
    )
    .join('\n');
  const others = board.columns
    .filter((c) => c.type !== 'status' && c.type !== 'checklist')
    .map((c) => `${c.name} (${c.type}${c.options ? `: ${c.options.map(String).join(', ')}` : ''})`)
    .join('; ');
  const tracked =
    companies
      .map(
        (c) =>
          `${c.name} [Status: ${valueText(sc, meta(c, 'status')) || 'none'}; chains: ${
            chains
              .filter((x) => x.companyId === c.id)
              .map((x) => x.title)
              .join(' | ') || 'none'
          }]`,
      )
      .join('; ') || 'none';
  const wroteBack = label(sc, 'wroteback');

  return `You update a job seeker's tracker from a short note they typed. They're a motion designer looking for work at ${MEDIA}. Today is ${today}.

Status columns and their choices:
${statusCols}
Status meanings: ${statusMeanings(board)}
Other fields: ${others}
Companies already tracked: ${tracked}
${history ? `What the tracker already has for the companies in this note:\n${history}\n` : ''}
The note: """${note}"""

Reply with only JSON: {"confirm": false, "reply": "one short sentence saying what you understood", "actions": [ ... ]}
Set "confirm" to true only when you're genuinely unsure (which company is meant, an ambiguous date, conflicting details), and put the question in "reply". Otherwise false: the changes are applied straight away.
Action shapes:
{"type":"add_company","company":"Official name"}   only if not already tracked
{"type":"set_status","company":"Name","column":"Status","value":"<choice label>"}
{"type":"log_email","company":"Name","chain":"short chain title, reuse an existing title if it's the same thread","dir":"out"|"in","date":"YYYY-MM-DD","text":"one line on what the email said"}
{"type":"add_note","company":"Name","date":"YYYY-MM-DD","text":"short, past tense, in the job seeker's words"}
{"type":"add_application","company":"Name","date":"YYYY-MM-DD","role":"...","link":"","result":""}
{"type":"add_meeting","company":"Name","date":"YYYY-MM-DD","start":"HH:MM" or "","end":"HH:MM" or "","kind":"meeting"|"interview","with":"","notes":"how it went, or what it is if it hasn't happened yet"}
{"type":"set_follow_up","company":"Name","date":"YYYY-MM-DD"}
{"type":"set_field","company":"Name","column":"<field name>","value": ...}
Rules:
- Every separate event gets its own action with its own date. If the note says January for one thing and February for another, use two different dates.
- Record only what the note says. Never add an email, meeting, interview, application or outcome the note doesn't describe.
- Reaching out / emailing = log_email (dir "out"). A conversation, call, chat, coffee chat or virtual coffee = add_meeting (kind "meeting", or "interview" if they call it that). Feelings, impressions and things they learned = add_note.
- If the company reached out to the job seeker (email, LinkedIn, anywhere) and asked for something, Status is "${wroteBack}" (their move is done, the job seeker owes a reply). If they asked for a coffee chat or call with no date yet, add a note saying so; add_meeting only once there's a date.
- Set Status to the latest state. Set Outcome only when a meeting or interview happened and the note says how it went (e.g. not a good fit = Bad fit).
- Scheduled future meetings and interviews are add_meeting with their future date and 24-hour start/end times (12-12:20 pm = 12:00 to 12:20). Don't add a follow-up unless the note asks for a reminder.
- A month with no day means the 1st. A past event with no year is the most recent past one, never in the future. "Next week" etc. are relative to today.
- Use the tracked company's exact name when the note refers to it. Use the company's official spelling for new ones (e.g. BigStar, not Big Star).
- Treat abbreviations as the full thing (LA = Los Angeles, NYC = New York) and store full names in fields.
- When the note repeats something the tracker already has (another call, another email), word the new entry as a follow-up ("Spoke again…", "Followed up…"). Never copy details from older entries into the new one.
- If the note is too unclear to act on, return no actions and ask one short question in "reply".`;
}

/** Columns lookup may fill: facts about the company, never the job seeker's own fields. */
const PERSONAL = /priority|role i want|why|note|prep|interest|fit|contact/i;
export const fillableColumns = (board: Board) =>
  board.columns.filter(
    (col) =>
      ['text', 'number', 'link', 'values', 'tags', 'checkbox'].includes(col.type) &&
      !PERSONAL.test(col.name),
  );

export type LookupReply = {
  sure?: boolean;
  candidates?: { name?: unknown; about?: unknown; fields?: unknown }[];
};

export function lookupPrompt(board: Board, typed: string, context?: string) {
  const cols = fillableColumns(board);
  return `A motion designer is adding a company to their job-hunt tracker. They work with ${MEDIA}.
They typed: "${typed}" (spacing, spelling or capitalization may be off).
${context ? `What they wrote about it: "${context}"\n` : ''}Work out which real company they mean. List up to 4 candidates, best first. Set "sure": true when one is the obvious match: it's far better known (NBA = the basketball league), or the context makes it clear. Set "sure": false only when genuinely different companies are equally likely.
For each candidate give its official name, a one-line description (what they do and their main city), and these fields when you're confident (write city names in full, e.g. Los Angeles, not LA):
${cols.map((col) => `- ${col.name} (${col.type}${col.options ? `, choose from: ${col.options.map(String).join(' | ')}` : ''})`).join('\n')}
Tags fields are a list of strings. Links are full https URLs. City = main office most relevant to creative hiring.
Reply with only JSON: {"sure": true|false, "candidates": [{"name": "...", "about": "...", "fields": {"<field name>": <value>}}]}
If you don't know any matching company, return {"sure": false, "candidates": []}.`;
}

/** The company's facts, notes and meetings, for prompts that need background. */
export function companyContext(board: Board, c: Company, page: Page) {
  const facts = board.columns
    .map((col) => {
      const t = valueText(col, meta(c, col.id));
      return t ? `${col.name}: ${t}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const notes = [...page.notes]
    .sort(byDate)
    .map((n) => `[${n.date}] NOTE: ${n.text}`)
    .join('\n');
  const meets = [...page.meetings]
    .sort(byDate)
    .map(
      (m) =>
        `[${m.date}] ${m.kind === 'interview' ? 'INTERVIEW' : 'MEETING'}${m.with ? ` with ${m.with}` : ''}: ${m.notes || ''}`,
    )
    .join('\n');
  return `Company: ${c.name}\n${facts}${notes ? `\nNotes:\n${notes}` : ''}${meets ? `\nMeetings:\n${meets}` : ''}`.slice(
    0,
    8000,
  );
}

export const chainText = (msgs: Message[]) =>
  [...msgs]
    .sort(byDate)
    .map((m) => `[${m.date}] ${m.dir === 'in' ? 'THEM' : 'ME'}: ${m.text.slice(0, 4000)}`)
    .join('\n\n')
    .slice(-60000);

export function summaryPrompt(
  board: Board,
  c: Company,
  page: Page,
  chain: Chain,
  today = todayISO(),
) {
  return `You help a job seeker (a motion designer) keep track of email chains with companies. Today is ${today}.
${companyContext(board, c, page)}

Email chain "${chain.title}", oldest first (ME = the job seeker, THEM = the company):
${chainText(chain.messages)}

Write exactly three short lines in plain text, no markdown:
Where it stands: ...
You owe them: ... (write "Nothing right now" if nothing)
Next step: ...`;
}

export type DraftReply = { subject?: unknown; body?: unknown };

/** Draft with AI (SPEC section 9): under 140 words, only the facts given. */
export function draftPrompt(
  board: Board,
  c: Company,
  page: Page,
  me: { name: string; portfolio: string; intro: string } | null,
  recipient: { name: string; role: string } | null,
  chain: Chain | null,
) {
  return `Write the next email a job seeker should send. Plain, warm, specific, under 140 words. Use only the facts given; don't invent projects, dates or names. Sign off with the sender's first name.
Sender: ${me?.name || 'the sender'}. Portfolio: ${me?.portfolio || 'n/a'}. About the sender: ${me?.intro || 'n/a'}
Recipient: ${recipient ? `${recipient.name || ''} (${recipient.role || ''})` : 'unknown, so open with "Hi there,"'}
Status: ${valueText(statusCol(board), meta(c, 'status')) || 'none yet'}
${companyContext(board, c, page)}
${chain ? `This is a reply in the email chain "${chain.title}", oldest first:\n${chainText(chain.messages)}` : 'This starts a new email chain.'}

Reply with only JSON: {"subject": "...", "body": "..."}`;
}

/** A quick guess at a name when the address isn't plainly first.last. */
export const namePrompt = (email: string) =>
  `Guess the person's name from this work email address: ${email}
Reply with only JSON {"name": "First Last"}. Use "" if it's a shared inbox or you can't tell. A lone first name is fine.`;
