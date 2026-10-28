# Reacher: roadmap

The project plan and status board. Claude keeps this file current: update it at the end of every session (tick what's done, add what was learned, move the "Now" marker). Zack only needs to read **Waiting on Zack** and **Now**.

Legend: ✅ done · 🔨 in progress · ⏳ waiting on Zack · ⬜ not started

---

## Waiting on Zack

1. ⏳ **Approve "Reacher runs inside Claude"** (see Stack). A yes is enough.
2. ⏳ **Allow `zackzand.com`** in this cloud environment's network settings, so Claude can study the site's motion. Environment menu in the session title bar → Edit → Network access → add `zackzand.com` under Allowed domains, leaving "Allow package managers" ticked. Steps: https://code.claude.com/docs/en/cloud-environments#network-access
3. ⏳ **Connect Gmail and Google Calendar** in claude.ai (Settings → Connectors). This isn't urgent. It lets Claude check early what the connectors can do.

## Now

Stack decision. Once it's approved: M1.

---

## Stack (recommended 2026-10-28, waiting on Zack's yes)

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

### M0: Setup 🔨
- ✅ Read the prototype and spec.
- ✅ Repo layout: `CLAUDE.md` at the root, `docs/SPEC.md`, `docs/ROADMAP.md`, `prototype/studio-outreach-tracker.html`.
- ✅ Audience decided: Zack first, then friends, then a public app.
- ✅ Design references collected.
- ⏳ Stack approved.

### M1: Empty app, live link ⬜
- Scaffold Vite + React + TS, Tailwind, lint, format, tests, GitHub Actions CI.
- Data and AI adapters, plus a local mock so the app runs and is tested outside Claude.
- Base design system: color tokens (the 8 status colors, light and dark), type scale, spacing, easing and duration tokens, green accent.
- App shell: header, Sheet/Board switcher with a cross-fade, quick update bar (not working yet), Templates and Your details buttons.
- Published as Reacher Test. **Test:** open it on laptop and phone, switch views, toggle dark mode.

### M2: Data model, Sheet, import ⬜
- Per-user data: board config (columns), companies, chains, pages (notes, applications, meetings), templates, Your details.
- Sheet view: sticky name column, status chip and picker (ranked search, underlined matches, keyboard), all 11 column types editable in cells, add-company row, row ⋯ menu.
- Toolbar: search with abbreviation expansion, All / Needs me, count, Columns dialog, + Column dialog, Edit choices dialog, `showWhen` for Outcome.
- Status header bar and follow-up countdowns.
- **Import:** an "Import from prototype" button that loads the prototype's Export JSON.
- **Test:** import your export, check every company and column came across, edit cells, search "LA".

### M3: Company page ⬜
- Docked side panel: resize (min 380px, remembered), shift vs overlay, click outside or Escape to close.
- Header: rename, ⋯ menu, Status, Outcome, Follow up on.
- Sections (collapsible, drag to reorder, remembered): Details, Email chains (manual add, no AI yet), Notes, Applications, Meetings & interviews with Add to Google Calendar links.
- Automatic status changes and "Status → X" toasts.

### M4: Board ⬜
- Lanes per status with category labels and color bars, cards, drag to change status, collapsible lanes (remembered).

### M5: AI features ⬜
- One AI module for every Claude call.
- Quick update: actions, apply immediately with Undo card, or Confirm with Apply / Discard; quiet lookup for new companies.
- Company lookup (sure / not sure / no match).
- Chain summary, Draft with AI, name-from-email guess.
- Prompt regression set: example notes (like the Sibling Rivalry one) with the expected actions, rerun whenever a prompt changes.

### M6: Writing emails, templates, Your details ⬜
- Write an email panel: Send in, template, To (saves into Main contact), editable subject and body, blank-field warnings, live placeholder replacement, Back to template, copy buttons, mailto, Log as sent with follow-up.
- Email templates screen with field buttons and live preview.
- Your details and Export data.
- **Milestone: feature parity. Zack moves his real data into Reacher and stops using the prototype.**

### M7: UI rework and animation ⬜
- Zack directs the look. Claude builds options, Zack picks and gives notes in rounds.
- Motion pass: panel open and close, chip changes, board drags, toasts, the quick update card, view transitions.

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
| 2026-10-28 | No separate AI billing. Recommended: run as a Claude artifact on each user's own plan (waiting on Zack's yes). |
| 2026-10-28 | Design references: Kitsu, ClickUp, Notion, zackzand.com (eased fades, smooth transitions). |

## Notes and risks

- The artifact platform has limits (page size 16MB, rate limits on AI calls). A bundled React app is well under the size limit. Rate limits get checked in M5.
- What the Gmail and Calendar connectors can do (read only, drafts, creating events) has to be confirmed before M8 and M9.
- AI answers vary run to run. The prompt regression set in M5 is the guard against that.
- The repo can go private at any time. Cloud Claude sessions reach private repos through the Claude GitHub app.
