# Reacher: roadmap

The project plan and status board. Claude keeps this file current: update it at the end of every session (tick what's done, add what was learned, move the "Now" marker). Zack only needs to read **Waiting on Zack** and **Now**.

Legend: ✅ done · 🔨 in progress · ⏳ waiting on Zack · ⬜ not started

---

## Waiting on Zack

1. ⏳ **Test M3** (company page), **M4** (Board) and **M5** (AI) on Reacher Test. Test lists in those sections. The first AI use asks permission to use your Claude; allow it.

## Now

M3, M4 and M5 published. Next: M6 (writing emails, templates, Your details export), which reaches feature parity.

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

### M3: Company page 🔨 (published, waiting on Zack's test)
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

### M4: Board 🔨 (published, waiting on Zack's test)
- ✅ Lanes per status with category labels and color bars, cards, drag to change status (dnd-kit: mouse drag, or press and hold on touch), collapsible lanes (remembered).
- **Test list:**
  1. On Board, drag a card to another lane. The lane lights up as you hover it; drop it and a message says "Name → Status". The Sheet shows the new status too.
  2. A plain click on a card opens its page.
  3. Click a lane's header: it shrinks to a thin strip with the name running vertically and the count on top. Click the strip to open it again. Reload: collapsed lanes stay collapsed.
  4. Drop a card onto a collapsed strip: that works too.

### M5: AI features 🔨 (published, waiting on Zack's test)
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

### M6: Writing emails, templates, Your details ⬜
- Draft with AI and the name-from-email guess (moved from M5).
- An "AI check" page that runs the prompt regression set inside Claude.
- Write an email panel: Send in, template, To (saves into Main contact), editable subject and body, blank-field warnings, live placeholder replacement, Back to template, copy buttons, mailto, Log as sent with follow-up.
- Email templates screen with field buttons and live preview.
- Your details and Export data.
- **Milestone: feature parity. Zack moves his real data into Reacher and stops using the prototype.**

### M7: UI overhaul and motion pass ⬜
- After feature parity (M6). Zack directs the look; references: Notion, ClickUp, Kitsu. Claude builds options, Zack picks and gives notes in rounds.
- Motion stays subtle, fast and functional (see Decisions).

### M8: Google Calendar ⬜
- Through the viewer's Google Calendar connector: meetings and interviews show up on the calendar, and upcoming events can be pulled in. What the connector can write gets confirmed first; the one-click link stays as a fallback.

### M9: Gmail ⬜
- Through the viewer's Gmail connector: match threads to companies by contact email and domain, pull them into chains, and set Wrote back!! when someone replies. This runs when Reacher opens and on demand.

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

## Notes and risks

- The artifact platform has limits (page size 16MB, rate limits on AI calls). A bundled React app is well under the size limit. Rate limits get checked in M5.
- **Capacity:** one artifact database holds 25,000 documents across all users. At roughly 200 per user that's about 100 users. Past that, move to a server through the storage adapter.
- **Connectors confirmed (2026-10-28):** Gmail can search and read threads, create, update and delete drafts, send, reply and label. Calendar can list, search, create, update and delete events. M8 and M9 can create real calendar events and send email.
- AI answers vary run to run. The prompt regression set in M5 is the guard against that.
- The repo can go private at any time. Cloud Claude sessions reach private repos through the Claude GitHub app.
