# OSR Website (yes, this one)

This is the RTU OSR website repo.

If you are here during finals week and your brain is lagging, same. This README is the "just tell me what to run" version.

## What this app does

- Public pages (home, services, news, transparency, directory, etc.)
- Login + role-based access for Student Leader features
- Google Sheets-powered content
- Google Classroom integration for leader report workflows
- Ticket/forms/webhook API routes with security checks

## Stack (quick)

- Next.js (App Router)
- React + TypeScript
- SWR
- Zod
- Google APIs
- Sentry (optional)

## Run local

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required env vars (minimum useful set)

These are the ones people usually forget first:

```env
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
GOOGLE_SHEETS_INFO_ID=
GOOGLE_SHEETS_AUTH_ID=
GOOGLE_SHEETS_DIRECTORY_ID=
GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID=
TICKET_STATUS_SYNC_SECRET=
TICKET_UPDATE_CONTROL_MODE=
TICKET_NOTIFICATION_QUEUE_SHEET_TAB=
MAKE_WEBHOOK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

Service account keys are also required for Google integrations. Keep them server-side only.

## Security rules we are not negotiating with

- Never put secrets in `NEXT_PUBLIC_*`.
- Do not remove webhook signature checks.
- Do not weaken leader-only route guards.
- Keep HTTPS-only link validation where already enforced.
- Keep rate limiting and duplicate-submission checks on write routes.

## Tests you should actually run

```bash
npm run test:security
```

This runs the key regression checks we care about before deploy.

## Notes for content/admin sheets

- News and hub content are sheet-driven.
- Keep column contracts stable when editing admin sheets.
- If you change sheet structure, update schema + route mapping together.

## Ticket update notifications

- A cron job calls `/api/tickets/sync-updates` every 5 minutes (see `vercel.json`).
- A queue processor cron calls `/api/tickets/queue/process` every 2 minutes for event-driven ticket update dispatch.
- The sync detects changes in ticket `Status` or `Resolution Notes` and emails students when updates occur.
- Anonymous submissions without a deliverable email are skipped safely (no email is sent).
- Optional anonymous update contacts can be stored separately in sheet columns `Y:AF`; sync uses them only when `Verified` and the primary email is missing.
- Apps Script can enqueue publish events via `/api/tickets/queue/enqueue`; queue rows are processed from `Ticket_Notification_Queue` (or `TICKET_NOTIFICATION_QUEUE_SHEET_TAB`).
- The endpoint requires `Authorization: Bearer <TICKET_STATUS_SYNC_SECRET>` (or `CRON_SECRET` fallback).
- `TICKET_UPDATE_CONTROL_MODE` supports three modes:
	- `auto`: current behavior, any C/M change can trigger notification logic.
	- `officer`: requires officer publish markers (S/W/X workflow columns) before notifications are eligible.
	- `hybrid` (default): uses officer-gated behavior when officer control metadata is present, otherwise falls back to `auto`.

## Release sanity routine (2-minute version)

1. `npm run lint`
2. `npm run test:security`
3. Spot-check login, forms, news, hub guides
4. Deploy
5. Confirm runtime logs are not screaming

If something is broken after deploy, check env vars first before touching code. It is usually env.
