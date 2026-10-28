# Reacher: roadmap

The project plan and status board. Claude keeps this file current: update it at the end of every session (tick what's done, add what was learned, move the "Now" marker). Zack only needs to read **Waiting on Zack** and **Now**.

Legend: ✅ done · 🔨 in progress · ⏳ waiting on Zack · ⬜ not started

---

## Waiting on Zack

1. ⏳ **Approve the stack** (below), or say what to change.
2. ⏳ **Who will use it?** Just Zack, or other artists later? This decides how much Google paperwork the Gmail feature needs.
3. ⏳ **AI model and budget.** The default is Claude Opus 5.5 for everything (about 3–5¢ per quick update). The option: use Haiku 5.5 for small jobs (name guesses, lookups) at a fraction of a cent each.
4. ⏳ **Look and feel references.** 2–5 apps or screenshots whose look or motion you like, so the base design starts close to your taste.
5. ⏳ **Accounts for Milestone 1** (step-by-step instructions come once the stack is approved): Vercel, Supabase, Anthropic Console API key.

---

## Stack (proposed, not yet approved)

| Layer | Pick | Why |
|---|---|---|
| App | Vite + React + TypeScript | Standard, fast, huge ecosystem. TypeScript catches mistakes before Zack sees them. |
| UI building blocks | Tailwind CSS, Radix UI primitives, Motion (Framer Motion) | Tailwind for a consistent design system (colors, spacing, light/dark). Radix for accessible menus, popovers and dialogs. Motion for animation. |
| Sheet and board | TanStack Table (with virtual scrolling), dnd-kit | Spreadsheet-grade table, drag and drop for Board lanes and section reordering. |
| Data and accounts | Supabase (Postgres, Auth, row-level security) | Real database, login built in, each user can only read their own rows. Free tier. |
| AI | Claude API through a server function, Anthropic TypeScript SDK, structured outputs | The API key never reaches the browser. Structured outputs guarantee the JSON shape the quick update expects. |
| Hosting and server functions | Vercel | Deploys on every push, gives a preview link per change, and runs the AI server functions. Free (Hobby) tier. |
| Google | Gmail API and Calendar API, Google OAuth | Needs a Google Cloud project, but not until Milestone 8. |
| Tests | Vitest for logic, Playwright for click-through tests | The prototype's rules (status automation, search abbreviations, quick update cleanup) become automated tests. |

**Monthly cost:** Vercel, Supabase and Google are free at this size. The only real cost is Claude API usage, which is pay-as-you-go and separate from a Claude.ai subscription.

---

## How we work

- `main` is the live app. Every milestone is a branch and a pull request.
- Vercel builds a **preview link** for each pull request. Zack tests the preview, sends numbered notes, Claude fixes, and the pull request merges once Zack OKs it.
- Each round ends with a short numbered test list: what to click, what should happen.
- Every prototype behavior in `docs/SPEC.md` is kept unless Zack changes it. Changes Zack makes get written back into the spec.

---

## Milestones

### M0: Setup 🔨
- ✅ Read the prototype and spec.
- ✅ Repo layout: `CLAUDE.md` at the root, `docs/SPEC.md`, `docs/ROADMAP.md`, `prototype/studio-outreach-tracker.html`.
- ⏳ Stack approved.
- ⏳ Accounts created (Vercel, Supabase, Anthropic API key).

### M1: Empty app, live link ⬜
- Scaffold Vite + React + TS, Tailwind, lint, format, tests, GitHub Actions CI.
- Base design system: color tokens (the 8 status colors, light and dark), type scale, spacing, green accent.
- Supabase project wired up; sign in with an email link (Google sign-in comes with M8).
- App shell: header, Sheet/Board switcher, quick update bar (not working yet), Templates and Your details buttons.
- Deployed to Vercel. **Test:** sign in on phone and laptop, see the empty shell.

### M2: Data model, Sheet, import ⬜
- Database tables for board config (columns), companies, chains, pages (notes, applications, meetings), templates and Your details, with row-level security.
- Sheet view: sticky name column, status chip and picker (ranked search, underlined matches, keyboard), all 11 column types editable in cells, add-company row, row ⋯ menu.
- Toolbar: search with abbreviation expansion, All / Needs me, count, Columns dialog, + Column dialog, Edit choices dialog, `showWhen` for Outcome.
- Status header bar and follow-up countdowns.
- **Import:** load the prototype's Export JSON into the database, so testing happens on real data.
- **Test:** import your export, check every company and column came across, edit cells, search "LA".

### M3: Company page ⬜
- Docked side panel: resize (min 380px, remembered), shift vs overlay, click outside or Escape to close.
- Header: rename, ⋯ menu, Status, Outcome, Follow up on.
- Sections (collapsible, drag to reorder, remembered): Details, Email chains (manual add, no AI yet), Notes, Applications, Meetings & interviews with Add to Google Calendar links.
- Automatic status changes and "Status → X" toasts.

### M4: Board ⬜
- Lanes per status with category labels and color bars, cards, drag to change status, collapsible lanes (remembered).

### M5: AI features ⬜
- One server function for all Claude calls.
- Quick update: actions, apply immediately with Undo card, or Confirm with Apply / Discard; quiet lookup for new companies.
- Company lookup (sure / not sure / no match).
- Chain summary, Draft with AI, name-from-email guess.
- Prompt regression tests: a saved set of example notes (like the Sibling Rivalry one) with the expected actions, rerun whenever a prompt changes.

### M6: Writing emails, templates, Your details ⬜
- Write an email panel: Send in, template, To (saves into Main contact), editable subject and body, blank-field warnings, live placeholder replacement, Back to template, copy buttons, mailto, Log as sent with follow-up.
- Email templates screen with field buttons and live preview.
- Your details and Export data.
- **Milestone: feature parity. Zack switches from the prototype to Reacher for the job hunt.**

### M7: UI rework and animation ⬜
- Zack directs the look. Claude builds options, Zack picks and gives notes in rounds.
- Motion pass: panel open and close, chip changes, board drags, toasts, the quick update card.

### M8: Google sign-in and Calendar ⬜
- Google Cloud project, sign in with Google.
- Meetings and interviews create, update and delete real Calendar events.

### M9: Gmail ⬜
- Connect Gmail (read-only to start). Match threads to companies by contact email and domain, pull them into chains, and set Wrote back!! when someone replies.
- Google paperwork: Gmail read access is a "restricted" permission. For a handful of users it works as an unverified app (users click past a warning once). A public app needs Google's security review, which costs money and time. Answer #2 under Waiting on Zack decides this.

### Backlog (after M9, in Zack's priority order)
- Edit entries after adding (today: delete only).
- Saved email drafts.
- Company lookup with live web search (fixes "lookups use the model's general knowledge").
- Saved sheet views (Notion-style).
- Send email directly from Reacher through Gmail.

---

## Decisions log

| Date | Decision |
|---|---|
| 2026-10-28 | Repo reorganized to match CLAUDE.md. Handoff zip unpacked and removed (it's still in git history). |

## Notes and risks

- Supabase free projects pause after a week with no activity. Daily use keeps them awake. If one pauses, it can be restored from the dashboard.
- Google apps left in "Testing" mode make Gmail and Calendar connections expire every 7 days. Plan: set the app to "In production" (unverified) at M8.
- AI answers vary run to run. The prompt regression tests in M5 are the guard against that.
