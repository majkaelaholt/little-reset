# Codex Guide for Little Reset

Future Codex chats should read this file before changing the app. This repository is a small, static, local-first PWA. Keep changes practical, scoped, and respectful of the app's low-pressure cleaning philosophy.

## App Overview

Little Reset is a cozy cleaning tracker that helps users maintain a home through small recurring room-based tasks. The core product idea is that one small task still counts. The app avoids shame-based streaks and treats skipped tasks as planning, not failure.

The app is static and GitHub Pages-friendly. There is no backend, no account system, no cloud sync, no Supabase, and no build step.

## Current Known Version

- App data version: `APP_VERSION = 1` in `app.js`.
- localStorage key: `little-reset-data-v1`.
- Service worker cache name: `little-reset-v1-20260630` in `sw.js`.
- There is no separate semantic app release version or changelog file yet. If future work changes the persisted data shape, add migration notes to README and consider starting a `CHANGELOG.md`.

## File Structure

Current root-level app files:

- `index.html` - static app shell, PWA meta tags, manifest/style/script links.
- `styles.css` - all responsive layout, visual styling, cards, modals, bottom nav, desktop sidebar, charts, and compact mode.
- `app.js` - all app state, sample data, rendering, scheduling, forms, event handlers, localStorage, JSON import/export, and review calculations.
- `manifest.webmanifest` - PWA metadata and icon reference.
- `sw.js` - lightweight service worker for static asset caching and fallback to `index.html`.
- `icon.svg` - SVG app icon referenced by the manifest and HTML.
- `README.md` - user-facing project notes, local running instructions, backup/import notes, and GitHub Pages settings.
- `CODEX.md` - this guide.

There are no package manager files, build configs, server files, database files, or external dependencies in the current app.

## Main Pages and User-Facing Features

The app has five tabs, defined in `TABS` in `app.js`:

- Today - daily summary, tiny reset recommendations, overdue tasks, due today tasks, quick wins, one-thing picker, and completed today.
- Rooms - room cards, room detail views, reset level, overdue/due/upcoming/recent groupings, room reset mode, room add/edit/delete-or-hide/reorder.
- Tasks - all-task search, filters, sorting, selection, and bulk complete/snooze/skip actions.
- Review - completed week/month counts, average per day, overdue count, 7/30 day completion chart, room breakdowns, attention rooms, reflection notes.
- Settings - theme accent, compact mode, default task preferences, room manager, task templates, export/import/reset sample data.

Important user-facing behaviors to preserve:

- Completing a task shows supportive feedback such as `Nice, that counts.`
- Good-enough completion is valid and should continue to count as completion.
- Skipping once should not punish the user. It should create a skipped history entry and move the task to the next scheduled occurrence.
- Snoozing moves a task out of today without marking it complete.
- Review language should stay non-judgmental.
- As-needed and seasonal/paused tasks should not receive normal due dates.

## Data Storage

All user data is stored locally in the browser with `localStorage`. The app reads and writes one versioned object under `little-reset-data-v1`.

Current top-level state shape:

```js
{
  version,
  meta,
  rooms,
  tasks,
  history,
  settings,
  templates
}
```

Current room fields include:

- `id`
- `name`
- `icon`
- `color`
- `sortOrder`
- `notes`
- `archived`

Current task fields include:

- `id`
- `roomId`
- `title`
- `description`
- `frequencyType`
- `frequencyInterval`
- `weekdays`
- `nextDueDate`
- `estimatedMinutes`
- `effort`
- `priority`
- `status`
- `lastCompletedDate`
- `completionHistory`
- `snoozeDate`
- `seasonalPaused`
- `tags`
- `taskType`

Current settings include:

- `theme`
- `accentColor`
- `compactMode`
- `defaultFrequencyType`
- `defaultFrequencyInterval`
- `defaultEffort`
- `defaultEstimatedMinutes`
- `energyMode`
- `reflectionNotes`

## Data Migration Rules

`migrateState(data)` is the compatibility point. Preserve it when editing app state.

When changing persisted data:

- Bump `APP_VERSION` only when the saved schema changes.
- Keep older backups importable where reasonable.
- Add defaults in `migrateState`, `normalizeRoom`, `normalizeTask`, `normalizeTemplate`, and/or `defaultSettings` as appropriate.
- Do not rename or remove existing saved fields without a migration path.
- Preserve existing completion and history arrays during task edits.
- Keep `version` on the exported/imported object.

## Scheduling and Status Logic

Scheduling is in these functions:

- `calculateNextDueDate(task, fromDate)`
- `nextWeekdayAfter(baseKey, weekdays)`
- `getTaskStatus(task)`
- `effectiveDueDate(task)`
- `dateDiff`, `addDays`, `addMonths`, and date-key helpers

Supported frequency types:

- `daily`
- `every-days`
- `weekly`
- `every-weeks`
- `monthly`
- `every-months`
- `weekdays`
- `seasonal`
- `one-time`
- `as-needed`

Preserve these semantics:

- Complete recurring tasks from today's date and compute the next occurrence.
- Complete one-time tasks by setting status to `completed` and clearing `nextDueDate`.
- As-needed and seasonal tasks stay active/paused without normal next due dates.
- Snooze date overrides normal due date while the snooze date is today or later.
- Room reset level is intentionally gentle: overdue tasks reduce it, recent completions improve it.

## History Rules

The global `history` array is used for review and audit behavior. Preserve history entries for:

- `completed`
- `skipped`
- `snoozed`
- `rescheduled`
- `archived`
- `created`
- `updated`

Task-level `completionHistory` is also maintained on each task. Do not drop either history surface during edits.

## Import, Export, and Backup Rules

JSON backup/export is implemented in `exportData()`.

JSON import is implemented in `importData(file)` and `validateImportedState(data)`.

Preserve these rules:

- Export the full app state object as formatted JSON.
- Default backup filename pattern is `little-reset-backup-YYYY-MM-DD.json`.
- Import must parse JSON, run migration, validate rooms/tasks/history, and ask for confirmation before replacing local state.
- Import replaces local browser data only after confirmation.
- Do not add network upload, analytics, or cloud sync behavior without explicit user request.
- Do not add CSV import/export unless the user asks and the README/CODEX docs are updated truthfully.

## PWA and GitHub Pages Rules

This app is intended to publish from the repository root on GitHub Pages.

Recommended Pages settings:

- Source: Deploy from a branch
- Branch: main
- Folder: /root

PWA behavior:

- `index.html` links `manifest.webmanifest?v=20260630`, `styles.css?v=20260630`, and `app.js?v=20260630`.
- `manifest.webmanifest` references `icon.svg`.
- `sw.js` caches root app assets and cache-busted CSS/JS/manifest URLs.
- Service worker registration only runs when `location.protocol !== "file:"`.

When changing static assets:

- Keep asset paths relative so GitHub Pages project hosting works.
- If changing cache-busted URLs in `index.html`, update `sw.js` `ASSETS` too.
- If changing service worker caching behavior, test a hard refresh or cache version bump.
- Keep `start_url` and `scope` relative (`./`) unless the hosting model changes.

## Mobile and iPhone Layout Rules

The app is mobile-first. Preserve the app-like mobile shell.

Important CSS behavior:

- `.bottom-nav` is fixed on mobile with five tab buttons.
- `.fab` floats above the bottom nav for quick task add.
- Safe-area padding uses `env(safe-area-inset-*)` to avoid iPhone edges.
- Desktop behavior begins around `900px`, where `.sidebar` is shown and `.bottom-nav`/`.fab` are hidden.
- Cards use `--radius: 8px` and a warm neutral visual system.
- Compact mode reduces card and icon sizing through `body.compact` selectors.

When editing UI:

- Avoid crowded controls near mobile screen edges.
- Keep buttons tappable and text wrapping safe.
- Do not remove bottom nav unless replacing it with an equally mobile-friendly pattern.
- Keep desktop as a wider dashboard, not a separate app.

## UI and Design Style

The design is warm, calm, and practical.

Preserve:

- Cozy neutral background and soft card surfaces.
- Gentle accent color customization through `settings.accentColor` and CSS `--accent`.
- Rounded cards and buttons using the existing 8px radius style.
- Emojis/icons for rooms, tabs, and task context.
- Supportive copy: `Nice, that counts.`, `Good enough counts.`, and skip-as-planning language.
- Review as pattern-finding, not judgment.

Avoid:

- Shame-based streaks, failure scores, or punitive missed-task copy.
- Corporate dashboard tone.
- Large new dependencies or a build system unless explicitly justified.
- Visual changes that make mobile feel like a cramped webpage.

## Required Workflow for Future Codex Changes

Before editing:

1. Read `CODEX.md` first.
2. Read `README.md`.
3. Inspect the files you will touch, especially `app.js` and `styles.css` for feature/UI changes.
4. Identify whether the change affects saved data, task scheduling, import/export, PWA caching, or mobile layout.

When editing:

- Keep changes scoped.
- Preserve localStorage compatibility.
- Update README and CODEX when behavior, setup, data shape, Pages settings, or backup rules change.
- Do not delete user-facing features unless explicitly asked.
- Avoid introducing private/personal data into the repo.

After editing:

- Run JavaScript syntax checks for `app.js` and `sw.js`.
- Manually test the affected flows in a browser where possible.
- Verify mobile layout if touching CSS, nav, cards, modals, or forms.
- Verify import/export if touching data, migration, task/room shape, or backup code.

## Testing Checklist

At minimum, use these checks for relevant changes:

- `app.js` parses without syntax errors.
- `sw.js` parses without syntax errors.
- App loads from a static server, not just `file://`, when testing PWA behavior.
- Today tab renders sample data on a fresh browser profile/localStorage.
- Add room.
- Add task.
- Edit task.
- Complete task.
- Good-enough complete task.
- Snooze task.
- Skip task once.
- Reschedule task.
- Export JSON backup.
- Import valid JSON backup and confirm replacement.
- Reject invalid JSON backup.
- Reset sample data only after confirmation.
- Check mobile bottom nav and FAB at a phone-sized viewport.
- Check desktop sidebar at a desktop viewport.

## GitHub, PR, and Commit Workflow

This repository uses `main` as the default branch.

For small safe docs or static app fixes, direct commits to `main` are acceptable when the user asks for them and write access is available.

For larger or risky changes:

- Create a feature branch.
- Open a pull request.
- Include a concise summary and testing notes.
- Mention any data migration or localStorage compatibility impact.

Commit messages should be clear, for example:

- `Add Codex contributor guide`
- `Fix task snooze scheduling`
- `Update PWA cache assets`
- `Document backup import behavior`

## Things Future Codex Chats Should Never Break

Do not break or remove:

- Local-first storage under `little-reset-data-v1`.
- Versioned state and migration path.
- JSON backup export and validated import.
- Completion history and task-level completion history.
- Skip-once as non-punitive planning behavior.
- Snooze/reschedule behavior.
- Room/task/template management.
- Today, Rooms, Tasks, Review, and Settings tabs.
- Mobile bottom navigation and floating add button.
- GitHub Pages root publishing compatibility.
- Service worker cache alignment with asset URLs.
- Supportive, low-shame language.

## If a Request Is Vague or Risky

If a user request could affect saved data, scheduling, backups, or PWA caching, pause long enough to inspect the relevant code and explain the risk.

Ask a clarifying question when the request could mean multiple incompatible behaviors, such as changing frequency rules, deleting history, syncing data externally, or resetting user data.

When possible, choose the conservative path:

- Keep existing data compatible.
- Add migration instead of replacing state.
- Preserve manual JSON backup/import.
- Keep changes reversible and documented.
