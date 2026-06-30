# Little Reset

Little Reset is a mobile-friendly cleaning tracker/PWA for keeping a home maintained through small recurring tasks. It is built as a static web app with no backend and no build step.

## What it does

- Tracks rooms, recurring tasks, task types, effort, priority, tags, due dates, snoozes, skips, and completions.
- Shows Today, Rooms, Tasks, Review, and Settings tabs.
- Recommends tiny reset tasks, quick wins, overdue tasks, and one realistic next action.
- Treats skipped tasks as planning, not failure.
- Saves data locally in the browser using localStorage.
- Supports JSON export and validated JSON import.
- Includes sample rooms and editable starter task templates.
- Includes a manifest and small service worker for installable/offline-friendly behavior when hosted over HTTP or HTTPS.

## Files

- index.html: App shell.
- styles.css: Responsive mobile-first interface styles.
- app.js: App state, scheduling logic, rendering, forms, import/export, and interactions.
- manifest.webmanifest: PWA metadata.
- icon.svg: App icon.
- sw.js: Lightweight service worker cache.
- README.md: This guide.

## How data is saved

Little Reset stores a versioned object under localStorage key little-reset-data-v1. The object includes:

- version
- meta
- rooms
- tasks
- history
- settings
- templates

The import path runs basic validation and migration before replacing current data. Export creates a JSON backup file you can keep wherever you like.

## Run locally

Open index.html directly in a browser for basic use. For the service worker and PWA behavior, serve the folder through a local web server, for example:

    python -m http.server 8080

Then open:

    http://localhost:8080

## Host on GitHub Pages

1. Put the files in a GitHub repository.
2. In repository settings, enable Pages for the branch and folder that contain index.html.
3. Visit the published Pages URL.
4. On iPhone, open the site in Safari and use Add to Home Screen.

## Backup and import

Use Settings, then Export JSON Backup to download the current app data. Use Import JSON Backup to restore a compatible backup. Importing replaces the current local data after confirmation.

## Version notes

Current app data version: 1. Future data migrations can be added in app.js inside migrateState.

## Known limitations

- Data is local to each browser/device unless you export and import it yourself.
- Browser support for SVG PWA icons can vary. The app still works if the icon is ignored.
- This app has no account sync or shared household collaboration.
