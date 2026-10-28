# Reacher

Working name, may change. The prototype was called Studio Outreach Tracker.

A job-hunt tracker for Zack, a motion designer. Think Kitsu (the production tracker) for job hunting: a sheet of companies with status chips, a company page that docks on the right, email chains, notes, interviews, and AI that turns plain-language updates into changes.

This repo is the rebuild. A working prototype already exists as one HTML file: `prototype/studio-outreach-tracker.html`. It ran as a claude.ai artifact and was tested heavily. Treat it as the reference for behavior. `docs/SPEC.md` describes every feature, the data model and the decisions behind them. Read both before changing anything.

## Goal of this repo
Turn the prototype into a real web app:
- Modular code instead of one file.
- A proper UI rework with animations (Zack will direct the look).
- Accounts, so Zack's data is saved and works on any device.
- Gmail and Google Calendar integration (see the spec's backlog).

Keep every prototype behavior unless Zack says otherwise. The prototype is the contract.

## Stack
The current stack lives in `docs/ROADMAP.md`. Recommended there: run Reacher as a Claude artifact, so AI uses each user's own Claude plan with no separate billing. The original suggestions below are the fallback if Reacher ever moves to a standalone site:
- **Frontend**: Vite + React + TypeScript. Framer Motion for animation.
- **Data + accounts**: Supabase (Postgres, auth, row-level security so each user only sees their own data).
- **AI**: Claude API, called from a server function (never put the API key in the browser).
- **Hosting**: Vercel.
- **Google**: Gmail and Google Calendar APIs with Google sign-in (OAuth). This needs a Google Cloud project.

These are suggestions, not decisions. Explain the tradeoffs in plain words and let Zack pick.

## Project management
Claude is the project manager. `docs/ROADMAP.md` is the plan and status board: milestones, what's done, what's waiting on Zack, and the decisions log. Read it at the start of every session and update it before the session ends. Go to Zack only for decisions and testing.

## Working with Zack
- Give the direct answer first. Start simple and only add complexity if the simple way doesn't work.
- Plain language. If a technical term is needed, define it in a few words.
- No walls of caveats.
- He thinks in production-tracker terms (Kitsu, ShotGrid): shots = companies, task status = status chips, the side panel = the company page.
- He tests in rounds and sends numbered notes with screenshots. After each round, give him a short numbered test list he can run, with what should happen at each step.
- When he edits his own writing, fix mechanics only. Keep his wording.

## Migrating his data
In the prototype, **Your details → Export data** downloads one JSON file:
`{ exported, board, companies, chains, pages, templates, me }`. Write an import script that loads that file into the new database. Field shapes are documented in `docs/SPEC.md`.

## Suggested first session
1. Read the prototype and the spec. Ask Zack anything unclear.
2. Agree on the stack, then scaffold the repo and deploy an empty app so there's a live link from day one.
3. Rebuild the data model and the Sheet view first, then the company page, then Board, quick update, lookups and email.
4. Import his exported data.
5. Then the UI rework and animations with Zack, then Gmail and Calendar.
