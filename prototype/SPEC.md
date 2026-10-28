# Reacher: spec

Reacher is the working name; the prototype was called Studio Outreach Tracker.

How the prototype (`prototype/studio-outreach-tracker.html`) works, and why. Everything here was built and tested with Zack in rounds. Keep it unless he changes it.

---

## 1. The big picture

| Kitsu idea | In this app |
|---|---|
| Shot | Company |
| Task status chip | Status chip (one per company) |
| Metadata columns | Custom columns (10 types) |
| Task side panel | Company page, docked right |

Two views share one switcher: **Sheet** and **Board**. **Email templates** and **Your details** live separately at top right. A **Quick update** bar sits under the header.

---

## 2. Columns

Company name and Status are required and always visible. Everything else is a custom column.

**Types:** Status, Text, Long text, Number, Checkbox, Date, Link, Person ({name, role, email}), List of values (pick one), List of tags (pick many), Checklist ([{t, done}]).

**Default columns:** Status, Outcome, Priority (Dream / Strong / Backup), Role I want, City, Main contact (Person), Company type (tags: Studio, Broadcast, Agency, In-house), Website, Size (Small (under 50) / Mid (50–200) / Large (200+)), Why them (Long text), Prep (Checklist).

**Per column:** rename, show or hide on the sheet (hidden columns still show on the company page, marked "Page only"), reorder, delete, edit choices.

- The **Columns** button in the toolbar lists every column with a show/hide checkbox and up/down arrows.
- **+ Column** opens an "Add Metadata Column" dialog: name, type, choices (for list and status types), show on sheet.
- Every column becomes an email template field automatically, named after the column.

---

## 3. Status

One status column per company. Choices are grouped into categories, and each choice has an id, label, category, color, optional icon (emoji) and a suggested email template.

Zack's current choices (ids are stable; labels can be renamed):

| id | Label | Category | Template |
|---|---|---|---|
| gathering | Gathering | Email outreach | First outreach |
| reached | Email (originally "Reached out") | Email outreach | Check-in |
| wroteback | Wrote back!! ❗ | Email outreach | (AI reply) |
| replied | Replied | Email outreach | Check-in |
| meeting | Meeting | Email outreach | Thank you |
| applied | Applied | Job application | Application follow-up |
| rejected | Rejected | Job application | none |
| interview | Interview | Job application | Thank you |

Empty status shows as "No status."

**Outcome** is a second status column: Hopeful, Offer!, Bad fit, Rejected.
- It only shows when Status is Meeting or Interview (`showWhen`).
- It clears when Status moves away from those.
- Any added status column can have its own `showWhen`.

**Picker:**
- Click a chip and the picker opens with a search box.
- Typing ranks choices: label starts with the text, then a word in the label starts with it, then the label contains it. Categories are matched only if no label matches.
- The matched letters are underlined. The highlighted row shows ↵, and Enter picks it. Arrow keys move.
- The picker also has Clear and Edit choices.

**Edit choices dialog** (for status columns): icon, label, category (with suggestions from existing categories), color, template, reorder, delete, add. For dependent columns it also has "Only show when Status is…" checkboxes.

**Automatic status changes:**
- Email from them added to a chain → Wrote back!!, if the current status is empty or in the outreach group. This also clears the follow-up date.
- Logging an email I sent: empty or Gathering → Email/Reached out; Wrote back!! → Replied. It also sets a follow-up date.
- Adding an application: empty or Gathering → Applied.
- Adding a meeting or interview → Meeting. It becomes Interview instead when it's an interview, or when the status was Applied or Rejected.
- Each change shows a short toast: "Status → X".

---

## 4. Sheet

- **Rows:** companies, in the order added. The company name cell is sticky on the left, and clicking the name opens its page. Clicking the open company again closes it.
- **Status cell:** the chip plus one of two indicators:
  - **Upcoming meeting or interview:** the date only (11/6). After a short hover delay a popup shows "11/6 at 12:30 pm" and "Interview with …".
  - **Otherwise, a follow-up date:** a countdown ("3d", "follow up today", "2d late").
- **Status header:** a thin bar showing the mix of statuses.
- **Toolbar:** search, an All / Needs me filter, a count, Columns, + Column.
  - **Needs me** = status is Wrote back!!, or the follow-up is due or late.
  - **Search** covers the name and every column's text. It treats abbreviations as the full thing: LA = Los Angeles, NYC/NY = New York, SF = San Francisco, VFX = visual effects, and so on. It matches both the raw text and the expanded form.
- **Add a company:** the last row. Enter adds it, then runs a lookup (section 9).
- **Row ⋯ menu:** open page, look up company details, delete (click twice).

---

## 5. Board

- Lanes are No status plus each status choice, in order, each with its category label and a color bar.
- Cards show the name, Outcome (if shown), the first List-of-values field (Priority), the main contact and the date or countdown.
- Drag a card to another lane to change its status. Click a card to open its page.
- Click anywhere on a lane header to collapse it. Collapsed lanes become a thin strip with a vertical name, a count and a color stripe on top. Clicking the strip expands it. Collapsed lanes are remembered per device.

---

## 6. Company page (side panel)

**Panel behavior:**
- Docks on the right.
- Drag the left edge to resize. Minimum 380px; the width is remembered per device and saved on every resize and on close.
- On wide screens the sheet shifts left so both are visible. On narrow screens the panel overlays.
- Clicking outside closes it. Escape closes it too.

**Header:** company name (click to rename), ⋯ menu, close. Then Status chip, Outcome chip (when shown), and a Follow up on date.

**Sections:** each collapses (click the title) and reorders (drag the header). Order and collapsed state are remembered per device.

1. **Details:** every column as a label/value row; click a value to edit it. Also has + Property and Look up company details.
2. **Email chains:** a company can have several chains.
   - Each chain shows its title (click to rename), count, date range and ⋯ (delete).
   - Inside: an AI summary (Summarize/Refresh, with "N new emails since this summary"), the emails (You/Them, date, long ones collapse), and an add form (From them / From me, date, paste box, Add email, Write a reply).
   - **+ New chain** creates an empty one.
   - Below the chains is **Write an email** (section 7).
3. **Notes:** dated entries. Enter adds; Shift+Enter is a new line.
4. **Applications:** role, date, posting link, result. Enter adds.
5. **Meetings & interviews:** Meeting/Interview toggle, date, start and end time, with whom, notes. Enter adds.
   - Each entry shows an "Upcoming" tag when it's in the future, plus an **Add to Google Calendar** link built from a calendar template URL.

Entries can be deleted (click twice) but not yet edited.

---

## 7. Writing emails

- **Send in:** "Start a new chain" or "Reply in: <chain>". The default is the latest chain when the status is in the email cycle.
- **Template:** defaults to the status choice's template.
- **To:** a plain email field.
  - On Enter or blur it saves into the Main contact (Person) and fills in the name. fred.smith@ becomes Fred Smith; shared inboxes like jobs@ or info@ are skipped; anything else is a quick AI guess.
  - If you type a different person's email, the name updates to match.
  - A toast confirms: "Saved to Main contact: Fred Smith."
- **Subject and body:** always editable, like any email app.
  - A template fills in from the company, the contact and Your details.
  - Blank fields appear as `[Priority]` or `[Contact first name]`. A warning lists them, each with a "set it" link.
  - Once a field is filled, its placeholder is replaced in the text automatically, even after edits.
  - Back to template discards edits.
- **Draft with AI:** writes a draft (or a reply in the chosen chain) into the editable box.
- **Buttons:** Copy email, Copy subject, Copy to, Open in mail app (mailto), and Log as sent. Logging adds the email to the chain, sets the follow-up (3/5/7/10/14 days) and moves status.

**Template fields:**
- Contact: first_name, contact_name, contact_role
- Company: company, plus one per column (slug of the column name, e.g. `role_i_want`)
- You: my_name, my_portfolio, my_reel, my_intro, my_phone

---

## 8. Email templates screen

A full-screen overlay:
- A list of templates on the left; name, subject and body on the right.
- Field buttons grouped by Contact / Company / You, labeled in plain words. Clicking one inserts `{{token}}` at the cursor.
- A live preview filled in for any company you pick (green = filled, yellow = blank).
- It shows which statuses suggest the template.

**Starting templates:**
- First outreach (`tpl-intro`)
- Check-in, no reply yet (`tpl-check`)
- Application follow-up (`tpl-app`)
- Thank you after interview (`tpl-thanks`)
- Ask a friend for a referral (`tpl-referral`)

---

## 9. AI features

All AI calls go through one place. In the prototype that's `window.claude.use('sample')`; in the rebuild it should be a server function calling the Claude API. Each call sends the instructions, the data and the exact JSON shape it wants back.

**Quick update.** Zack types something like "Reached out to Sibling Rivalry in January. In February we talked and it wasn't a good fit." The AI returns:

```
{ confirm: bool, reply: string, actions: [...] }
```

Action types:
- `add_company`
- `set_status` (column, choice label)
- `log_email` (chain title, in/out, date, text)
- `add_note`
- `add_application`
- `add_meeting` (date, start/end in 24-hour time, kind, with, notes)
- `set_follow_up`
- `set_field`

The prompt includes the status choices, what each means (built from the current labels), the other fields, the tracked companies with their statuses and chain titles, and today's date. The rules it follows:
- Every separate event gets its own action with its own date.
- Record only what the note says. Never invent emails, meetings or outcomes.
- Coffee chats and calls count as meetings. If they reached out and asked for something, status is Wrote back!!. A coffee invite with no date yet is a note.
- Scheduled future interviews become meetings with times, and get no follow-up unless asked.
- Dates: a month alone means the 1st. A past event with no year is the most recent past one.
- Use exact names for tracked companies and official spelling for new ones (BigStar). Store abbreviations in full.
- Set `confirm: true` only when genuinely unsure.

**Applying the result:**
- If `confirm` is false, changes apply immediately. A small "Updated" card lists them with **Undo**, which restores a snapshot of every touched company, chain, page and the column setup. The card fades after about 7 seconds and stays while you hover.
- If `confirm` is true, the card shows the question with Apply / Discard.
- New companies then get a quiet lookup, using the note as context.

**Company lookup:**
- Triggered by adding a company, the row menu, or the Details section.
- The AI sees the typed name, any context and the fillable columns (it skips personal ones like Priority, Role I want, Why them, Prep and Main contact). It returns `{ sure, candidates: [{name, about, fields}] }`, up to 4 candidates, and fills only empty fields.
- **Sure** (one obvious match, e.g. NBA = the league): it fills in and fixes the name automatically, shows "Filled in X" with "Not it? Did you mean…" alternatives, and fades.
- **Not sure:** it shows "Which X did you mean?" as one-click cards, plus None of these.
- **No match:** a short message.
- Scope is all media companies: motion design and animation studios, ad agencies, production companies, post houses, TV networks, film studios, game studios and in-house creative teams.

**Chain summary:** three plain lines: Where it stands / You owe them / Next step.

**Draft with AI:** under 140 words, only the facts given, signed with the sender's first name. Returns `{subject, body}`.

**Name from email:** a quick AI guess when the address isn't obviously "first.last".

**Feedback notes from Zack on AI messages:** keep them short. Informational messages hide themselves after a few seconds. Don't over-explain.

---

## 10. Your details

Name, portfolio, reel link, phone and an intro paragraph. These fill the `my_*` fields. It also has **Export data**, which downloads one JSON file of everything.

---

## 11. Data model (prototype storage)

Documents in the artifact database. Map these to tables in the rebuild.

- `config/board`: `{ version: 2, columns: [{ id, name, type, onSheet, locked?, options?, showWhen?: {col, values[]} }] }`. Status options are `{id, label, group, color, tpl, icon}`; list options are plain strings.
- `companies/<id>`: `{ name, order, meta: { <columnId>: value }, due: 'YYYY-MM-DD' | null, auto?, example? }`
- `chains/<id>`: `{ companyId, title, started, messages: [{ id, dir: 'in'|'out', date, text }], summary: { text, at, count } | null }`
- `pages/<companyId>`: `{ notes: [{id, date, text}], applications: [{id, date, role, link, result}], meetings: [{id, date, start, end, kind, with, notes}] }`
- `templates/<id>`: `{ name, subject, body }`
- `settings/me`: `{ name, portfolio, reel, phone, intro }`

**Per-device preferences** (browser storage): view (sheet/board), panel width, section order, collapsed sections, collapsed lanes.

**Colors:** grey, blue, teal, green, amber, pink, red, violet, each with light and dark theme values. The accent is green, like Kitsu.

---

## 12. Backlog and open items

- **Gmail:** pull email threads into chains automatically, match them to companies, and set Wrote back!! when someone replies.
- **Google Calendar:** add meetings and interviews automatically (today it's a one-click link).
- **Saved email drafts.**
- **Edit entries after adding** (today: delete only).
- **UI rework and animations** throughout, with Zack directing the look.
- **Maybe:** saved sheet views (Notion-style).
- **Accounts and multi-device sync** through the new database.

**Known rough edges:**
- AI answers vary run to run.
- Lookups use the model's general knowledge, not live web search.
