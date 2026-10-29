# Reacher: roadmap

The project plan and status board. Claude keeps this file current: update it at the end of every session (tick what's done, add what was learned, move the "Now" marker). Zack only needs to read **Waiting on Zack** and **Now**.

Legend: ✅ done · 🔨 in progress · ⏳ waiting on Zack · ⬜ not started

---

## Waiting on Zack

1. ⏳ **Test round 3 fixes + Google Calendar (M8)** and **Gmail (M9)** on Reacher Test (version 11). The test lists are under M8 and M9 below. Send numbered notes with screenshots.
2. ⏳ **M7 decisions** (sprint status, sprint dates, theme, comments → AI, Board). See M7 below and Claude's message of 2026-10-29.

## Now

Round 3 fixes, M6.5 (browser test suite, AI check), M8 (Google Calendar) and M9 (Gmail) are published to Reacher Test v11. Every milestone up to M9 is built; M7 (the sprint-based UI rework) waits on Zack's plan. Moving real data to the real Reacher artifact waits for Zack's OK.

## Links

- **Reacher Test:** https://claude.ai/artifact/J86CzpMXjnr8dryxLmbckc (publish from `dist-artifact/reacher-test.html`)
- **Reacher (real):** not published yet. First publish is at M2, once there's data worth keeping.

---

## Stack (approved 2026-10-28)

**Reacher runs inside Claude, as a Claude app (an "artifact"), the same way the prototype did.** Everyone who opens it is signed in with their own Claude account, so:

- **AI uses each person's own Claude plan.** No API key and no separate bill.
- **Data is private per person.** Each user's data lives in their own private space that no one else can read, not even the owner. It syncs across devices through their Claude login.
- **Gmail and Calendar go through each person's Claude connectors.** No Google Cloud project, and no Google security review for a public app.
- **Nothing to host.** No Vercel, Supabase or Google Cloud accounts.

| Layer | Pick |
|---|---|
| App | Vite + React + TypeScript, bundled into one artifact |
| UI | Tailwind CSS, Radix UI primitives, Motion (Framer Motion), TanStack Table, dnd-kit |
| Data | Artifact `db` (per-user private documents under `data/users/<id>/`) |
| AI | Artifact `sample` (Claude, using the viewer's plan) |
| Gmail and Calendar | Artifact `mcp` (the viewer's claude.ai connectors) |
| Export | Artifact `downloads` |
| Tests | Vitest for logic, Playwright for click-through tests against a local mock of the Claude runtime |

**Escape hatch.** All data and AI calls go through two small adapter files. If Reacher ever outgrows Claude (people without Claude accounts, background Gmail sync, its own domain), we swap those two adapters for Supabase plus the Claude API and keep the rest of the app.

**Tradeoffs we accept:**
- It opens at a claude.ai link, not its own domain.
- Friends need a Claude account. Their AI use counts against their own plan.
- Gmail syncs while Reacher is open, not in the background.
- We depend on Anthropic's artifact platform and its limits.

**Ruled out:** "Sign in with Claude" on a standalone website. Anthropic doesn't let outside apps run on someone's Claude plan; artifacts are the sanctioned way to do it.

---

## How we work

- Code lives in this repo. Claude builds it, bundles it and publishes it as an artifact.
- There are two artifacts: **Reacher Test** (each round lands here first, using test data) and **Reacher** (the real one with Zack's data). A round moves to Reacher only after Zack OKs it.
- Each round ends with a short numbered test list: what to click, what should happen.
- Every prototype behavior in `docs/SPEC.md` is kept unless Zack changes it. Changes Zack makes get written back into the spec.
- Multi-user from day one: nothing assumes the user is Zack.

---

## Design direction (from Zack, 2026-10-28)

- **Kitsu:** the layout, density, status chips and side panel, and its animations. Kitsu is open source, so Claude can read its code for the motion instead of hosting it.
- **ClickUp and Notion:** clean type, quiet chrome, controls that appear on hover, the side-peek page.
- **zackzand.com:** lots of easing, fades in and out, smooth transitions between pages. Claude will study it once the domain is allowed.
- Working principle: everything eases, nothing snaps. Views cross-fade, the panel glides in, chips and cards animate their changes.

---

## Milestones

### M0: Setup ✅
- ✅ Read the prototype and spec.
- ✅ Repo layout: `CLAUDE.md` at the root, `docs/SPEC.md`, `docs/ROADMAP.md`, `prototype/studio-outreach-tracker.html`.
- ✅ Audience decided: Zack first, then friends, then a public app.
- ✅ Design references collected; zackzand.com motion studied.
- ✅ Stack approved.
- ✅ Gmail and Google Calendar connectors connected and confirmed.

### M1: Empty app, live link ✅ (Zack tested 1–4 on desktop; asked for links without https, fixed)
- ✅ Vite + React + TS, Tailwind, ESLint, Prettier, Vitest, GitHub Actions CI.
- ✅ Storage adapter (`src/runtime/`): Claude db and browser-only versions behind one interface. The AI adapter comes with M5.
- ✅ Design tokens: the prototype's palette (light and dark) and fonts. Motion tokens in `src/motion.ts`.
- ✅ App shell: header with sync badge, Sheet/Board switcher (gliding highlight, cross-fade between views), quick update bar (not working yet), Your details (saves to the user's private space), empty Sheet and Board.
- ✅ Published to Reacher Test.
- **Test list:**
  1. Open Reacher Test on your laptop. The badge next to "Reacher" says **Synced** after a moment.
  2. Click **Board**. The green highlight glides over, and the sheet fades up and out as the board fades in.
  3. Reload. You're still on Board (the view is remembered per device).
  4. Click **Your details**, fill in your name and reel link, and Save. A "Saved your details" toast appears.
  5. Open Reacher Test on your phone. The badge says Synced, and **Your details** shows what you typed on the laptop.
  6. Switch your Claude theme between light and dark. Reacher follows it.
  7. Tell Claude about anything that looks off, feels slow, or animates wrong (numbered notes, screenshots welcome).

### M2: Data model, Sheet, import ✅ (Zack tested 1–8; notes: city autofill, slower hover, faster motion — all done)
- ✅ Data model in `src/model/` (same shapes as the prototype), with unit tests for search, the picker ranking, Outcome clearing, dates and import.
- ✅ Workspace (`src/workspace/`): loads everything live, holds every action. Writes queue one at a time per record.
- ✅ Sheet: add companies (duplicates caught), status picker, all column types editable, row ⋯ menu (rename, delete), follow-up countdown and upcoming-meeting date with hover details.
- ✅ Toolbar: search with abbreviations, All / Needs me, count, Columns, + Column, column header menu, Edit choices (with Only show when Status is…).
- ✅ Import from the prototype's Export file (Sheet empty state, or Your details → Import data).
- ✅ Board shows cards in lanes (drag and collapse come in M4).
- Not yet: the company page (M3); clicking a name does nothing until then. Company lookup on add arrives with AI (M5).
- **Test list (Reacher Test):**
  1. In the prototype, click Your details → Export data and save the file.
  2. In Reacher Test, click **Import from the prototype** and pick that file. The confirm step lists your companies, chains, notes and so on. Click Import, then Done.
  3. Your companies appear in the order you added them, with your own status names and colors.
  4. Click a status chip, type "re" and press Enter. The top match is picked and underlined letters show what matched.
  5. Click a City cell, type something, press Enter. Click a Main contact cell: name, role and email. Click a Company type cell: tick tags.
  6. Set a company to Meeting: the Outcome column shows up and a message says you can set it. Move it to Applied: Outcome clears.
  7. Search "LA" or "NYC": the abbreviations match the full city names. Click **Needs me**: only Wrote back!! and due or late follow-ups stay.
  8. Click **+ Column**, add a "List of values" column with a few choices. Click a column header to rename it, hide it, or move it. Use **Columns** to show or hide several at once.
  9. Hover an upcoming meeting's date next to a status chip: a popup shows the time and who it's with.
  10. Type a new company name in the last row and press Enter; type an existing one and you're told it's already there. Use the ⋯ at the end of a name to rename or delete (delete needs a second click).
  11. Switch to Board: every company sits in its status lane.
- Per-user data: board config (columns), companies, chains, pages (notes, applications, meetings), templates, Your details.
- Sheet view: sticky name column, status chip and picker (ranked search, underlined matches, keyboard), all 11 column types editable in cells, add-company row, row ⋯ menu.
- Toolbar: search with abbreviation expansion, All / Needs me, count, Columns dialog, + Column dialog, Edit choices dialog, `showWhen` for Outcome.
- Status header bar and follow-up countdowns.
- **Import:** an "Import from prototype" button that loads the prototype's Export JSON.
- **Test:** import your export, check every company and column came across, edit cells, search "LA".

### M3: Company page ✅ (Zack tested in round 2)
- Docked side panel: resize (min 380px, remembered), shift vs overlay, click outside or Escape to close.
- Header: rename, ⋯ menu, Status, Outcome, Follow up on.
- Sections (collapsible, drag to reorder, remembered): Details, Email chains (manual add, no AI yet), Notes, Applications, Meetings & interviews with Add to Google Calendar links.
- Automatic status changes and "Status → X" toasts.
- Built: `src/company/` (panel, sections, chains, entries) and `src/model/automation.ts` (status rules and calendar links, unit tested). AI summary (M5) and Write an email (M6) aren't in yet.
- **Test list (Reacher Test):**
  1. Click a company name. Its page slides in on the right and the sheet shifts left to make room. Click the same name again: it closes.
  2. Drag the panel's left edge to resize it. Close it and open another company: the width is remembered.
  3. Press Escape, or click an empty part of the sheet: the page closes. Clicking inside a menu or picker doesn't close it.
  4. Click the company name at the top of the page to rename it. Change Status and Follow up on from the header.
  5. In Details, click any value to edit it; hidden columns say PAGE ONLY. + Property adds a column.
  6. Email chains: open a chain, choose From them, paste an email, Add email. Status moves to Wrote back!! and the follow-up date clears. Try From me on a Gathering company: it moves to Reached out. + New chain starts one; click its title to rename; ⋯ deletes it.
  7. Notes: type and press Enter (Shift+Enter for a new line). Applications: add one on a company with no status: it becomes Applied.
  8. Meetings & interviews: pick Interview, set a future date and time, add it. Status moves to Interview, the entry says Upcoming, and Add to Google Calendar opens a filled-in event. The sheet shows its date next to the status.
  9. Click a section title to collapse it; drag the ⋮⋮ grip (appears on hover) to reorder sections. Reload: both are remembered.
  10. On Board, click a card: its page opens.

### M4: Board ✅ (Zack tested in round 2)
- ✅ Lanes per status with category labels and color bars, cards, drag to change status (dnd-kit: mouse drag, or press and hold on touch), collapsible lanes (remembered).
- **Test list:**
  1. On Board, drag a card to another lane. The lane lights up as you hover it; drop it and a message says "Name → Status". The Sheet shows the new status too.
  2. A plain click on a card opens its page.
  3. Click a lane's header: it shrinks to a thin strip with the name running vertically and the count on top. Click the strip to open it again. Reload: collapsed lanes stay collapsed.
  4. Drop a card onto a collapsed strip: that works too.

### M5: AI features ✅ (Zack tested in round 2)
- ✅ AI adapter (`src/runtime/ai.ts`) on the artifact's `sample` capability: runs on the viewer's own Claude plan. Default tier for quick update and lookup, quick tier for summaries.
- ✅ Prompts carried over word for word from the prototype (`src/ai/prompts.ts`).
- ✅ Quick update: actions apply straight away with an Updated card and Undo (restores every touched company, page, chain and column choices), or Apply / Discard when the AI isn't sure. New companies get a quiet lookup using the note as context. The card fades after about 7 seconds and stays while hovered.
- ✅ Company lookup: on adding a company, from the row ⋯ menu, and from Details. Sure: fills empty fields and fixes the name, with "Not it? Did you mean…". Not sure: "Which X did you mean?" cards plus None of these.
- ✅ Chain summary: Summarize / Refresh, three lines, "N new emails since this summary".
- ✅ Unit tests for cleaning the AI's answer, applying it, undo snapshots, lookup filling, and the prompts. End-to-end test with a stand-in AI.
- Moved to M6: Draft with AI and the name-from-email guess (both live in the email writer).
- Prompt regression set: still to do. The AI only runs inside Claude, so this needs a small in-app "AI check" page; planned with M6.
- **Test list (Reacher Test, inside Claude):**
  1. Type "Interview with New York Life on 11/6 at 12:30" in Quick update and press Enter. Claude asks once for permission to use AI; allow it. An "Updated" card lists what changed; New York Life appears with Interview and 11/6. A moment later a message says it filled in details.
  2. Click Undo on the card: New York Life disappears.
  3. Try the Sibling Rivalry note from the spec: "Reached out to Sibling Rivalry in January. In February we talked and it wasn't a good fit." Two separate dates, a chain, a meeting, Outcome Bad fit.
  4. Type something vague. The card should ask a question, or show Apply / Discard.
  5. Add a company by name in the last row (try an ambiguous one, like "Big Star"). It's looked up: either filled in, or "Which … did you mean?" with choices.
  6. Open a company with an email chain and click Summarize: three lines appear. Add an email and the summary says "1 new email since this summary".
  7. Tell Claude when an answer is wrong: what you typed, what it did, what you expected.

### M6: Writing emails, templates, Your details ✅ (Zack tested in round 2)
- ✅ Email logic in `src/model/email.ts` (fields, placeholders, default template and chain, name guessing), unit tested.
- ✅ Write an email under Email chains: Send in, template (status-suggested), To (saves into the contact and fills the name: first.last, shared inboxes skipped, else an AI guess), editable subject and body, "Fill in before sending" with set it / add it links, placeholders filled automatically even after edits, Back to template, Draft with AI, Copy email / subject / to, Open in mail app, Log as sent with follow-up days.
- ✅ Email templates screen: list, editor, click-to-insert fields at the cursor, live preview for any company (green filled, yellow blank), Suggested at, save and delete. New accounts start with the five starting templates (made generic).
- ✅ Your details shows which field each value fills; Export data saves everything as one file (same shape the import reads).
- Not yet: the "AI check" page for the prompt regression set (moved to the fix round after this test).
- **Milestone reached: feature parity.** Reacher does everything the prototype does.

#### Test regimen for M3–M6 (Reacher Test)
Before you start: Reacher Test already has your imported data. Use it freely; the real Reacher gets a fresh import later.

**A. Company page (M3)**
1. Click a company name: its page slides in from the right and the sheet shifts left. Click the same name: it closes.
2. Drag the page's left edge to resize. Close it, open another: the width stuck.
3. Escape closes it; so does clicking an empty part of the sheet. Clicks inside menus and pickers don't.
4. Click the company name at the top to rename it. Change Status, Outcome (at Meeting or Interview) and Follow up on from the header.
5. Details: edit a few values; hidden columns say PAGE ONLY; + Property adds a column.
6. Collapse a section by its title; drag a section by its ⋮⋮ grip (shows on hover) to reorder. Reload: both remembered.
7. Email chains: + New chain, rename it by clicking the title, paste an email From them (status → Wrote back!!, follow-up clears), paste one From me on a Gathering company (→ Reached out). Long emails collapse with Show all. ⋯ deletes a chain (second click confirms).
8. Notes: Enter adds, Shift+Enter is a new line. Applications on a company with no status → Applied. Meetings: Interview, future date and time → Interview status, Upcoming tag, the sheet shows the date, Add to Google Calendar opens a filled-in event.
9. Delete an entry with × (it asks "Delete?" first).

**B. Board (M4)**
10. Drag a card to another lane: the lane lights up, the status changes, a message confirms. A plain click opens the page.
11. Click a lane header to collapse it into a strip; click the strip to open it. Reload: remembered. Drop a card on a strip.

**C. AI (M5)** (Claude asks permission the first time; allow it)
12. Quick update: "Interview with New York Life on 11/6 at 12:30". The Updated card lists the changes; New York Life appears with Interview and 11/6; a moment later it says it filled in details. Hover the card: it stays. Click Undo: it's all gone.
13. Quick update: "Reached out to Sibling Rivalry in January. In February we talked and it wasn't a good fit." Expect two dates, an email chain, a meeting, Outcome Bad fit.
14. Quick update something vague: it asks a question, or shows Apply / Discard.
15. Add "Big Star" in the sheet's last row: it's looked up (filled in, or "Which … did you mean?"). Also try ⋯ → Look up company details on an existing company.
16. Open a chain and click Summarize: three lines. Add an email: "1 new email since this summary"; Refresh.

**D. Emails (M6)**
17. Open a Gathering or no-status company: Write an email picks First outreach and Start a new chain. On a Reached out or Wrote back!! company it picks the status template and replies in the latest chain.
18. In To, type firstname.lastname@company.com and press Enter: the name fills in and "Hi [Contact first name]" becomes their name. Try jobs@… (no name guessed) and an address like jsmith@… (AI guesses).
19. Blank fields show as [Why them] etc. with a set it / add it link. Edit the body, then click set it and fill the field: your edits stay and the placeholder fills in. Back to template resets.
20. Draft with AI: a draft appears (under 140 words, signed with your first name). Try another gives a new one.
21. Copy email, Copy subject, Copy (To). Open in mail app (may do nothing in some setups; that's the platform).
22. Log as sent with "follow up in 5 days": the email lands in the chain, status moves (Gathering → Reached out, Wrote back!! → Replied), Follow up on is set.
23. Email templates (top right): pick one, click in the body, click a field button (it inserts at the cursor), switch the preview company and watch green and yellow, Save. Make a new template; delete one.
24. Your details: each field shows its {{my_…}} name. Export data offers a file to save; it can be imported back.

**E. Anything else**
25. Look and feel: anything that animates too much or too little, feels slow, or reads wrong. Note it with a screenshot.

### Round 2 fixes ✅ (Zack checked in round 3)
Zack's notes on the M3–M6 regimen, and what changed:
- 1, 2: the company page appears and resizes instantly (no slide, no squish), like Kitsu.
- 4: the company name at the top is plain text with a caret: click and type. Enter or click away saves, Escape undoes.
- 5: editing a text, number, date, link or person value opens the editor right on top of the value, text lined up.
- 6: drag a section by anywhere on its header row. Rebuilt on the same drag library as the Board (dnd-kit), which also fixed reordering on a scrolled page.
- 7: + New chain sits under the chains; + Property and Look up company details sit under Details.
- 9: every two-click delete grows into "Delete?" with a short animation (one shared `ConfirmButton`).
- 10: the Board sorts like Trello: cards make room as you drag, drop between any two cards, order is saved (`rank` on each company, `src/model/ranking.ts`). Drops land where the pointer is.
- 13: quick update skips things already there (same-date meeting of the same kind, same note, same application, same email, unchanged values). The card lists "Already there, skipped", or says "Nothing new".
- 15: lookup results and "Which … did you mean?" show on the company's own page, not under Quick update. Adding an unclear company opens its page to ask.
- 20: AI work shows a thin light running around the box: Quick update, Draft with AI, Summarize, lookups.
- 22: in Email templates, type @ in the subject or body for a field menu (Discord-style). Arrows, Enter or Tab, Escape. Email addresses don't trigger it.
- Answered, no change: 16 (the summary was right for nonsense input), 18 (To saves the address into the contact and fills their name), 21 (real sending comes with Gmail in M9), 23 (Export = a backup file).
- **Test list (Reacher Test):**
  1. Open a company: the page appears instantly. Drag its edge: text reflows with no animation.
  2. Click the company name at the top: a caret, no box. Type, press Enter. Try again and press Escape: it reverts and the page stays open.
  3. In the sheet, click a City or Role value: the editor opens on top, with the text in the same spot.
  4. Drag a section by its title row (not just the grip) above another. Reload: the order stays.
  5. Delete a note with ×: the button grows into "Delete?" Click again to delete. Same feel on chains, rows, columns and templates.
  6. Board: drag a card within a lane: the others slide to make room. Drop it between two cards in another lane: it lands exactly there. Reload: order stays.
  7. Quick update the Sibling Rivalry note twice. The second time: "Nothing new", or a list under "Already there, skipped". No duplicate meeting.
  8. Add "Big Star" in the sheet's last row: its page opens and asks "Which … did you mean?" there. Pick one. Also try Look up company details at the bottom of Details.
  9. Draft with AI, Summarize, and a quick update: a light runs around the box while the AI works.
  10. Email templates: in the body, type "@por" and press Enter: {{my_portfolio}} goes in. Type an email address with @: no menu.

### Round 3 fixes ✅ (published to Reacher Test v10)
Zack's notes on the round 2 list:
- 1: Email templates and Your details are now small ✉️ and ⚙️ buttons; the top bar never wraps.
- 2: the company name editor shows only a caret (the green focus outline is gone).
- 5: the "Delete?" label slides in from the right.
- 7: quick update now sees what the tracker already has for the companies a note names, and words a repeat as a follow-up ("Spoke again…") without copying old details.
- 10: template fields are typed with **#** (Discord-style): # opens a menu of every field, typing narrows it, Enter fills in. The menu shows plain names. Templates are still stored as {{field}}, so exports and the email writer are unchanged.
- 3, 4, 6, 9: good for now; freer dragging (x and y) and a calmer email writer go into the UI rework.

### M6.5: Prep for the UI overhaul ✅
- ✅ **Safety net:** 31 browser tests in `e2e/` (`npm run e2e`, also in CI) on the built page, with a stand-in AI and Calendar. Covers sheet, company page, board, AI, emails, templates, AI check and Calendar.
- ✅ **AI check:** ⚙️ Your details → Run AI check. Six sample quick updates, each graded (✓/✗) against the real AI. Cases live in `src/ai/aiCheck.ts`.
- Dropped: the shared UI kit. Zack expects the UI rework to be a rewrite (see M7), so that waits for the new design.

### M7: Kitsu-style rework (sprints) ⏳ plan proposed, waiting on Zack's decisions
Zack's direction (2026-10-29): rework the whole app after Kitsu. Sprints → companies the way sequences → shots work, while still seeing every company. Clicking a status opens the side panel with a comment feed and status change (comments replace notes, and they update details, chains and meetings). Quick update stays. Sidebar pages: My Tasks, News Feed, Settings. Research: `docs/research/KITSU.md` (from Kitsu's source and a local Kitsu with fake data; screenshots in `docs/research/kitsu/`).

**Approach: rewrite the screens, extend the data.**
- **Screens: new.** A new UI layer (`src/app/`: shell, pages, side panel, its own small kit) replaces `src/views`, `src/sheet`, `src/company` and most of `src/components` as each page lands. Reused as-is: `src/model`, `src/runtime`, `src/ai`, `src/workspace`, the prompts, Calendar and Gmail. The e2e tests are rewritten page by page.
- **Data: extended, not rewritten.** Kitsu's own answer to "one thing in many groups" is casting (one asset in many shots), and Reacher's data already hangs everything off companies:
  - `sprints` collection: name, optional start/end dates, order, archived.
  - Companies get `sprintIds` (a company can be in any number of sprints; "All companies" ignores it).
  - `events` collection: the feed. One event per comment, status change, email (pasted or from Gmail), meeting, application, field change or AI action. Each has company, time, kind, text, the status it set (if any), a link to what it touched, and who made it (you, AI, Gmail, Calendar).
  - Notes become comment events. A one-time migration runs on load, and the prototype export still imports.
  - My Tasks is computed, not stored: replies owed (Wrote back!!), follow-ups due or late, meetings and interviews coming up (prep), applications gone quiet.

**Milestones**
- M7a Data: sprints, `sprintIds`, events (every write logs one), notes → comments migration, unit tests. Invisible.
- M7b Shell: Kitsu top bar (Sprint ▾ › View ▾), sliding sidebar from the logo (My Tasks, News Feed, Settings), Kitsu-like theme.
- M7c Companies list: grouped by sprint under All; add-company row that finds existing companies (adds them to the sprint) or creates and AI-scouts new ones; field columns; checkboxes and bulk status; Kitsu search syntax (`status=wrote back`, `city=la`, `-buck`) with saved searches; Display settings.
- M7d Side panel: click a status → status picker, comment box, Post; the company's event feed. A comment runs through the AI like a quick update for that company (with Undo).
- M7e Company page: tabs (Info, Emails, Meetings, Applications) plus the timeline.
- M7f My Tasks (List, Board, Calendar), News Feed (day timeline, filters, click opens the panel), Settings.
- M7g Motion and polish rounds with Zack.

### M8: Google Calendar 🔨 (published to Reacher Test v10–11, waiting on Zack's test)
- ✅ Through the viewer's own Google Calendar connector (artifact `mcp` capability; tools `create_event` and `list_events` only). Nothing is fetched until a company page is open.
- ✅ Adding an upcoming meeting or interview puts it on Google Calendar (checkbox "Also add upcoming ones", on by default, remembered per device). Quick update does the same.
- ✅ Each meeting shows "On your Google Calendar ↗", or an "Add to Google Calendar" button. Outside Claude the old template link stays.
- ✅ The company page lists upcoming calendar events (next 60 days) that look like they're about that company (its name in the title, or an attendee from its website or contact domain), each with "Add to Meetings".
- ✅ Connector errors in plain words, with "Allow Google Calendar" when Reacher needs the OK.
- Not yet: Undo and deleting a meeting leave the calendar event (delete it in Google Calendar). Moving a meeting needs entry editing (backlog).
- Code: `src/model/calendar.ts` (meetings ↔ events, matching; unit tested), `src/runtime/calendar.ts` (connector calls), `src/workspace/CalendarProvider.tsx`, `src/company/MeetingsBody.tsx`.

#### Test list for round 3 + M8 (Reacher Test)
**A. Round 3 fixes**
1. Open a company page and drag its left edge far to the left so the sheet gets narrow. The top bar stays on one line. Email templates and Your details are the ✉️ and ⚙️ buttons at the top right (hover to see their names).
2. Click the company name at the top of a company page. You only see a blinking caret: no outline, no box.
3. Delete a note with ×: it grows into "Delete?", and the word slides in from the right.
4. Quick update "I spoke to Sibling Rivalry last week" (a company that already has a meeting). The new meeting's text reads like a follow-up and doesn't copy old details like "not a good fit".
5. The Big Star test, step by step: in the Sheet, the very last row says "+ Add a company". Click it, type **Big Star**, press Enter. Expected: Big Star's company page opens by itself and asks "Which 'Big Star' did you mean?" with two or more cards. Click one: the name changes and details like City fill in.
6. ✉️ Email templates: pick a template, click at the end of the body, type **#**. A menu of every field pops up above the cursor. Type **por**: the list narrows to Portfolio. Press Enter: **#my_portfolio** goes in, and the Preview below shows your portfolio link. Escape closes the menu without closing the screen.
7. ⚙️ Your details: scroll to the bottom and click **Run AI check**. It runs 6 sample updates (about a minute) and shows ✓ or ✗ for each check. Screenshot any ✗.

**B. Google Calendar (M8)**
Before you start: the first calendar action makes Claude ask whether Reacher may use your Google Calendar. Allow it. Everything Reacher adds says "Added by Reacher" in the event description; delete the test events afterwards.
8. Open a company, go to Meetings & interviews. Under the form, "Also add upcoming ones to Google Calendar" is ticked. Pick Interview, a date later this week, a start time, and press Add. Expect two messages ("Added…" and "Added to Google Calendar") and the entry says **On your Google Calendar ↗**. Click it: the event opens in Google Calendar, titled "Interview: (company)".
9. Untick the box and add another upcoming meeting. It does not go on your calendar; its entry shows an **Add to Google Calendar** button. Click it: it turns into "On your Google Calendar ↗". Reload: the box is still unticked.
10. In Google Calendar, make an event in the next few weeks with a company's name in the title (for example "Coffee with Psyop"). In Reacher, reload and open that company. A box "On your Google Calendar" lists the event with **Add to Meetings**. Click it: it becomes a meeting entry (a title with "interview" makes it an interview). Events about other companies don't show there.
11. Quick update "Interview with Psyop next Tuesday at 2pm". The interview is added and a message says "Added to Google Calendar: Psyop".
12. If a company page ever says "Reacher needs your OK to use Google Calendar", click **Allow Google Calendar**: the events appear.

### M9: Gmail 🔨 (published to Reacher Test v11, waiting on Zack's test)
- ✅ Through the viewer's own Gmail connector (tools `search_threads`, `get_thread`, `create_draft` only). **Reacher never sends email.**
- ✅ A company's emails are found by its Website domain and its contacts' addresses (personal addresses like gmail.com match only that exact address).
- ✅ Company page, Email chains: "Check Gmail" brings in that company's last year of email. Each thread joins the chain with the same title (or the one it's linked to), else becomes a new chain; pasted copies aren't doubled; quoted replies are cut off. Chains link to the thread ("Gmail ↗").
- ✅ Once Gmail is allowed, opening Reacher checks every company's last 30 days, again every 10 minutes, and each company page re-checks when opened. A new reply moves the status like a pasted one (→ Wrote back!!, follow-up cleared). Only the newest email moves it, so old history doesn't.
- ✅ Write an email → **Save to Gmail drafts**: a draft in Gmail (a reply in the thread when the chain follows one). You send it from Gmail; the next check adds it to the chain.
- ✅ Deleting a synced email or chain sticks: checks don't bring it back.
- Not yet: attachments (names only show in Gmail), and threads with someone at a company who isn't a saved contact on a personal address.
- Code: `src/model/gmail.ts` (threads → chains; unit tested), `src/model/contacts.ts` (company domains and addresses, shared with Calendar), `src/runtime/gmail.ts`, `src/workspace/GmailProvider.tsx`.

#### Test list for M9 (Reacher Test)
Reacher Test has the demo companies, whose addresses aren't real. So first point one company at someone you've really emailed:
1. Open a company (or add a new one in the Sheet's last row). In Details, set **Website** to the real company's site (for example buck.co), or set **Main contact** to the real email address of someone you've emailed.
2. On its page, under Email chains, click **Check Gmail**. Claude asks whether Reacher may use Gmail: allow it. Expect "Checking your email with …", then a message like "Buck: 3 new emails from Gmail", your threads as chains (titled by subject, oldest email first, quoted replies cut off), and a **Gmail ↗** link that opens the thread.
3. Click **Check now**: nothing is added twice.
4. If the newest email in those threads is from them, the status moves to Wrote back!! and Follow up on clears. If it's from you, a Gathering company moves to Reached out.
5. Delete one synced email (×, then Delete?) and click Check now: it doesn't come back. Same for a whole chain (⋯ → Delete this chain).
6. In Write an email, fill in To, then click **Save to Gmail drafts**. Expect "Saved in your Gmail drafts. Open it in Gmail ↗". In Gmail the draft is there (a reply inside the thread if the chain came from Gmail). Nothing was sent. Send it from Gmail if you like: on the next check it shows up in the chain.
7. Reload Reacher and wait a few seconds: once Gmail is allowed, it checks every company's last 30 days by itself and tells you what's new.
8. A company with no Website and no contact email: Check Gmail says what to add.

### Backlog (after M9, in Zack's priority order)
- Edit entries after adding (today: delete only).
- Saved email drafts (possibly real Gmail drafts through the connector).
- Company lookup with live web search, if the artifact AI supports it.
- Saved sheet views (Notion-style).
- Onboarding for friends: a first-run screen, default columns and templates.

---

## Decisions log

| Date | Decision |
|---|---|
| 2026-10-28 | Repo reorganized to match CLAUDE.md. Handoff zip unpacked and removed (it's still in git history). |
| 2026-10-28 | Audience: Zack first, then friends, then public. Build multi-user from the start. |
| 2026-10-28 | No separate AI billing: Reacher runs as a Claude artifact on each user's own plan. Approved. |
| 2026-10-28 | Database access: each user writes only their own private space; shared data is owner-only. Friends must be shared as **Contributor**. |
| 2026-10-28 | UI overhaul: briefly moved to after M3, then back to M7 at Zack's call (build everything first). References: Notion, ClickUp, Kitsu. |
| 2026-10-28 | Motion: subtle, fast and functional. 120–250ms, opacity and small transforms, ease-out, no bounce (`src/motion.ts`). Hover popups wait 1.5s. |
| 2026-10-28 | Text cells autofill from values already in the column, with abbreviations expanded ("LA" → "Los Angeles"). |
| 2026-10-28 | M1 keeps the prototype's palette and fonts so it feels familiar; the redesign is M7. |
| 2026-10-28 | Animation starting point: zackzand.com's curve (cubic-bezier(0.4, 0, 0.2, 1)), 350–500ms fades with a small upward drift. Zack expects to change it; every value lives in `src/motion.ts`. |
| 2026-10-28 | Source of truth is this GitHub repo. The artifact is only the built output, published from the repo. |
| 2026-10-28 | Design references: Kitsu, ClickUp, Notion, zackzand.com (eased fades, smooth transitions). |
| 2026-10-29 | Company page: no open/close or resize animation (Kitsu-style). |
| 2026-10-29 | Board cards keep a manual order (`rank`); dragging sorts like Trello. |
| 2026-10-29 | One drag library (dnd-kit) for every drag: Board cards and page sections. |
| 2026-10-29 | AI results about a company (lookups) live on that company's page; Quick update's card is only for quick updates. |
| 2026-10-29 | Before M7: a committed browser test suite and a shared UI kit, so the overhaul restyles instead of rewriting (Zack: "built for scalability first"). |
| 2026-10-29 | Template fields are typed as #field in the editor (Discord-style); storage stays {{field}}. |
| 2026-10-29 | UI kit dropped: Zack expects M7 to be a rewrite around Kitsu-style sprints. Build what survives a rewrite (data, AI, connectors, e2e tests) until the plan is final. |
| 2026-10-29 | M8 before M7: Calendar logic lives below the UI. Reacher reads and creates events only (no edits or deletes on Zack's calendar yet). |
| 2026-10-29 | Gmail: Reacher reads threads and saves drafts; it never sends (Zack presses Send in Gmail). Automatic checks only after Zack has allowed Gmail once. |
| 2026-10-29 | M7 goes Kitsu-style. Claude's plan: new screens (`src/app/`), data extended (sprints, `sprintIds`, an events feed) rather than rewritten. Pending Zack's OK. |

## Notes and risks

- The artifact platform has limits (page size 16MB, rate limits on AI calls). A bundled React app is well under the size limit. Rate limits get checked in M5.
- **Capacity:** one artifact database holds 25,000 documents across all users. At roughly 200 per user that's about 100 users. Past that, move to a server through the storage adapter.
- **Connectors confirmed (2026-10-28):** Gmail can search and read threads, create, update and delete drafts, send, reply and label. Calendar can list, search, create, update and delete events. M8 and M9 can create real calendar events and send email.
- AI answers vary run to run. The prompt regression set in M5 is the guard against that.
- The repo can go private at any time. Cloud Claude sessions reach private repos through the Claude GitHub app.
