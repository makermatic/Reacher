# How Kitsu works, and what Reacher takes from it

Research for M7 (2026-10-29). Sources: Kitsu's source code (github.com/cgwire/kitsu, Vue 3; API github.com/cgwire/zou) and a local Kitsu (Docker image `cgwire/cgwire`) filled with a fake job hunt: sequences as sprints, shots as companies. Screenshots are in `docs/research/kitsu/`. The docs site (kitsu.cg-wire.com) was blocked by the session's network settings; the source was enough.

## Kitsu's layout

- **Top bar** (`components/tops/Topbar.vue`): a breadcrumb of dropdowns. Production ▾ › Section ▾ (Assets, Shots, Sequences, Breakdown, Playlists, News Feed, Schedule, …) › Episode ▾. On the right: notifications, help, avatar. The fox logo opens the sidebar.
- **Sidebar** (`sides/Sidebar.vue`): slides in over the page from the logo, closes on any pick. Groups: Workspace (My Tasks, My Checks, Entity Chats, My Productions), Studio (Productions, People, Timesheets, Schedules, All tasks, News Feed, Asset Library), Admin (Departments, Task Types, Task Status, Automations, Settings, …). Screenshot 6.
- **Entity list** (`lists/ShotList.vue`, `composables/entityList.js`). Screenshot 1.
  - Toolbar: search box with saved searches, filter builder, department filter, Display Settings, import/export, "Create shots".
  - Columns: checkbox, thumbnail + name (sticky), description, one column per metadata field (custom fields, added from the header "+"), then one colored column per task type with a status chip and assignee avatars, then "+ Add tasks".
  - Rows are grouped under their sequence (a header row per sequence) when no single sequence is picked.
  - Header menus: sort, stick (pin) a column, minimize it, edit or delete a field.
  - Arrow keys move between editable cells; row hover shows actions (history, edit, delete).
- **Clicking a status cell** selects it and opens the **task panel** on the right (`sides/TaskInfo.vue`). Screenshot 1.
  - Top: status dropdown, comment box, "Change status for the selected task". Icon buttons: assign, priority, subscribe, preview, delete.
  - Then: breadcrumb (E01 / Sprint 1 / Buck), preview player, "Post comment | Publish revision" tabs, comment box with a status picker next to **Post**.
  - Then the feed: each comment shows the status it set, author, time, text, likes, Reply.
- **Posting a comment can change the status**: a comment is the event that carries a status change (zou model `Comment`: `object_id` (the task), `task_status_id`, `text`, `replies`, `checklist`, `pinned`, `links`, `person_id`).
- **Multi-select**: Ctrl/Shift-click more cells and the panel becomes "Change status for the N selected tasks" with the list of what's selected. Screenshot 2.
- **Entity page** (click a shot name; `pages/Shot.vue`): tabs (Info, Chat, Casting, Schedule, Preview Files, Timelog, Output Files). Info has the task table and the fields. On the right, a vertical **timeline** of every status change. Screenshot 3.
- **News Feed** (`pages/ProductionNewsFeed.vue`): one vertical timeline grouped by day. Each line shows time, avatar, task type, status chip, entity. Filters: episode, status, task type, person. Clicking a line opens the task panel on the right. Screenshot 4.
- **My Tasks** (`pages/Todos.vue`): tabs Tasks | Board | Calendar | Pending | Validated | Timelog | Days Off. Filters: search, production, type, due date; "Sorted by". Columns: production, type, entity, estimate, duration, start date, due date, status, last comment. Screenshot 5.
- **Search syntax** (`docs/filtering.md`): words match names; `type=status` (`anim=wip`, `anim=wip,wfa`), `status=done`, field values (`city=la`, `family=[blue,red]`), `-word` excludes, `+(a=b c=d)` ORs a group. Saved searches show as chips under the box.
- **Breakdown / casting**: one asset can be cast into many shots. This is Kitsu's many-to-many, the same shape as companies in many sprints.

## How Reacher maps onto it

| Kitsu | Reacher |
|---|---|
| Production ▾ (top bar) | Sprint ▾: All companies, each sprint, + New sprint |
| Sequence (group header in the list) | Sprint (group header when viewing All) |
| Shot | Company |
| Asset cast into many shots | A company in many sprints (`sprintIds`) |
| Description column | Status column |
| Task-type columns | Field columns (City, Priority, Role, …) |
| Comment with a status (task panel) | Comment on a company: can set its status, and the AI turns it into changes (like a quick update for that one company) |
| Shot page timeline | Company page timeline (every event) |
| News Feed | News Feed (every event, all companies) |
| My Tasks | My Tasks: reply owed, follow-ups due, meetings and interviews to prep |
| Settings / profile | Settings (Your details, templates, connectors, export) |
