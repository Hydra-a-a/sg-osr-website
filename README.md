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
- Neon Postgres + Prisma migration foundation
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
AUTH_ACCESS_SOURCE=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
GOOGLE_SHEETS_INFO_ID=
GOOGLE_SHEETS_AUTH_ID=
GOOGLE_SHEETS_DIRECTORY_ID=
GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID=
GOOGLE_DRIVE_LOST_FOUND_FOLDER_ID=
DATABASE_URL=
DIRECT_URL=
SHEETS_EXPORT_ENABLED=
SHEETS_EXPORT_SECRET=
TICKET_STATUS_SYNC_SECRET=
PROPOSAL_STATUS_SYNC_SECRET=
CRON_SECRET=
TICKET_UPDATE_CONTROL_MODE=
TICKET_NOTIFICATION_QUEUE_SHEET_TAB=
PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB=
MAKE_WEBHOOK_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

Service account keys are also required for Google integrations. Keep them server-side only.

`DATABASE_URL` is the Neon pooled runtime connection string. `DIRECT_URL` is for Prisma migrations/admin tooling only.
`npm run db:generate` uses a placeholder direct URL when `DIRECT_URL` is unset because Prisma client generation does not need a real database connection.
`AUTH_ACCESS_SOURCE` defaults to `sheets`; use `db-with-sheets-fallback` during the first auth cutover, then `db` after import verification.

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

## Local quality audit

Start the dev server first:

```bash
npm run dev
```

Then run the developer-first accessibility and reliability audit:

```bash
npm run audit:quality
```

The audit scans the core public routes across desktop and mobile viewports, writes reports to `artifacts/a11y/`, and only fails by default when a page cannot load. Use `AUDIT_ROUTE_GROUP=services`, `hub`, `government`, or `all` to scan a route group; use `AUDIT_ROUTES=/,/hub` for a custom list. Use `AUDIT_STRICT=1` when you want serious accessibility findings to fail locally.

## Notes for content/admin sheets

- News and hub content are sheet-driven.
- Keep column contracts stable when editing admin sheets.
- If you change sheet structure, update schema + route mapping together.
- Private and operational data is being migrated to Neon Postgres through Prisma. Google Sheets should become a sanitized public mirror only; do not mirror private grievance/proposal payloads, tracking hashes, notification payloads, or private student identifiers.
- See `docs/database/neon-prisma-migration.md` for database roles, migration phases, and export policy.
- Auth role access can now be imported with `npm run db:import:auth:dry-run`, written with `npm run db:import:auth:write`, and activated by setting `AUTH_ACCESS_SOURCE=db-with-sheets-fallback` first.

## Directory API separation

- `/api/directory/student-organizations` returns only student organization leaders (`leaders` + `meta`).
- `/api/directory/offices` returns only university offices (`offices` + `meta`).
- `/api/directory` is kept for backward compatibility and returns merged data for legacy consumers.
- The directory UI now uses a top-level section split (`Student Organizations` vs `University Offices`) so office records are not shown inside organization sections.

## Ticket update notifications

- Scheduled cron jobs call `/api/tickets/sync-updates`, `/api/tickets/queue/process`, and `/api/proposals/queue/process` (see `vercel.json` for the deployed cadence).
- The sync detects changes in ticket `Status` or `Resolution Notes` and emails students when updates occur.
- Anonymous submissions without a deliverable email are skipped safely (no email is sent).
- Optional anonymous update contacts can be stored separately in sheet columns `Y:AF`; sync uses them only when `Verified` and the primary email is missing.
- Apps Script can enqueue publish events via `/api/tickets/queue/enqueue`; queue rows are processed from `Ticket_Notification_Queue` (or `TICKET_NOTIFICATION_QUEUE_SHEET_TAB`).
- Ticket automation requires `Authorization: Bearer <TICKET_STATUS_SYNC_SECRET>` (or `CRON_SECRET` fallback).
- Proposal queue automation requires `Authorization: Bearer <PROPOSAL_STATUS_SYNC_SECRET>` (or `CRON_SECRET` fallback).
- `TICKET_UPDATE_CONTROL_MODE` supports three modes:
	- `auto`: current behavior, any C/M change can trigger notification logic.
	- `officer`: requires officer publish markers (S/W/X workflow columns) before notifications are eligible.
	- `hybrid` (default): uses officer-gated behavior when officer control metadata is present, otherwise falls back to `auto`.

## Release sanity routine (2-minute version)

1. `npm run lint`
2. `npm run test:security`
3. `npm run db:generate`
4. If a Prisma migration changed, run `npm run db:migrate:deploy` with production `DIRECT_URL`
5. Spot-check login, forms, news, hub guides
6. Deploy
7. Confirm runtime logs are not screaming

If something is broken after deploy, check env vars first before touching code. It is usually env.

For the production-only notification checks that cannot be completed locally, use `docs/launch/production-verification-runbook.md`.

For the fuller local release gate, run `npm run test:readiness`.
