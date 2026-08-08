---
last_verified: 2026-08-02
---

# Neon + Prisma Migration

This migration moves OSR private and operational data from Google Sheets to Neon Postgres through Prisma. Google Sheets remains only as a sanitized public mirror/export surface.

## Access Model

Use separate connection strings and database roles:

| Purpose | Env var | Neon connection | Role |
| --- | --- | --- | --- |
| Runtime app queries | `DATABASE_URL` | pooled | `osr_app_rw` |
| Prisma migrations and admin tooling | `DIRECT_URL` | direct | `osr_migrator` |
| Public Sheets export | `DATABASE_URL` or dedicated job secret | pooled/read-only view access | `osr_export_ro` |
| Emergency inspection | local secret only | direct/read-only | `osr_admin_ro` |

Rules:

- Keep `DATABASE_URL` and `DIRECT_URL` server-only. Never add database credentials to `NEXT_PUBLIC_*`.
- Runtime code imports Prisma only through `lib/prisma.ts`.
- Prisma 7 reads the migration/admin connection from `prisma.config.ts`, not from the schema file.
- Server route handlers remain the primary authorization boundary.
- Database grants, constraints, foreign keys, and sanitized views are defense in depth.
- Do not use the migrator role in production route handlers.

## Migration Phases

1. Add schema, migrations, client, preflight, and dry-run importer/exporter scaffolds.
2. Import Sheets into Neon in dry-run mode and compare counts/IDs/statuses without printing private payloads.
3. Move auth roles, tickets, proposals, comments, and notification queues to DB-backed repositories.
4. Move commute community workflows and then public content/config.
5. Enable sanitized Sheets export and retire private Sheets reads/writes.

## Directory Logo Management

The directory cutover uses `DirectoryEntry.directoryKey` as the stable application identifier and `DirectoryLogo` as the one-to-one Neon metadata record for a protected Google Drive logo. Runtime directory reads use `DIRECTORY_SOURCE=sheet`, `db-with-sheets-fallback`, or `db`; production should move to `db` only after the import parity check passes.

- Run `npm run db:import:directory:dry-run` and review only aggregate counts plus blocker reason codes before any write.
- Run `npm run db:import:directory:write` only after duplicate and missing-field blockers are resolved. The importer never prints directory content or credentials.
- Active Neon officers manage assets through `/services/admin/directory`; the browser never receives Drive or Prisma credentials.
- Uploads are PNG, JPEG, or WebP only, capped at 5 MB, signature-checked server-side, and stored in `GOOGLE_DRIVE_ORGANIZATION_LOGOS_FOLDER_ID`. A failed Neon transaction triggers Drive cleanup.
- Logo changes mark `DirectoryExportState` pending. The officer action, `npm run db:export:directory:write`, or `/api/cron/directory-export` writes the sanitized `Directory Export` tab from `public_sheet_directory_entries`, clearing stale rows first.
- The export contains only stable key, type, name, role/office, category/unit, protected proxy logo URL, profile URL, and sort order. Sheets is a transparency mirror, not a private backup.

Public student-organization listings may show correction guidance when `NEXT_PUBLIC_DIRECTORY_CORRECTIONS_EMAIL` is configured. This is a plain `mailto:` link asking students to identify the organization, incorrect field, and corrected information; it does not create a report record or automated email workflow.

## Lost and Found Vertical Slice

Lost and found is Neon-native from its first release. `LostFoundItem`, `LostFoundAttachment`, and `LostFoundComment` are not read from Google Sheets.

- `CSO` records are created by an active Neon officer through `/services/admin/lost-found` and can be published as the weekly or biweekly bulletin.
- `STUDENT` records are created by authenticated RTU users and remain `PENDING_REVIEW` until an officer approves them.
- Public responses project only published/resolved records and never include submitter identity, review notes, or raw Drive URLs.
- Media is stored in the dedicated `GOOGLE_DRIVE_LOST_FOUND_FOLDER_ID` folder and streamed only through `/api/hub/lost-found/media/[attachmentId]` after the item is public.
- For beta, each report accepts up to three raster image attachments (JPG, PNG, or WebP), with server-side extension, declared MIME, byte-count, and magic-signature checks. Video uploads are disabled until a real malware scanner and duration validation service are provisioned; the Prisma enum remains available for a later controlled rollout.
- No automatic CSO import is enabled until the CSO provides a stable CSV, Sheet export, or API contract with an idempotent reference field.

## Auth Access Cutover

Auth role access is the first implemented repository cutover path.

1. Keep `AUTH_ACCESS_SOURCE=sheets` while importing and comparing.
2. Run `npm run test:auth-import-fixture` to verify parser behavior without reading live Sheets.
3. Run `npm run test:auth-import-write-guards` to verify empty or invalid Sheet writes fail closed.
4. Run `npm run db:import:auth:dry-run`.
5. Review the private-safe counts: Sheet rows with email, valid RTU email rows, invalid email rows, unknown access/role values, duplicate conflicts, blank/no-email rows, parsed unique emails, active leaders, active officers, and disabled/student rows.
6. Run `npm run preflight:db` and confirm the core tables, sanitized views, migration record, lowercase auth-email invariant, and no-DDL runtime role boundary are visible.
7. Run `npm run db:import:auth:write` with production `DATABASE_URL`.
8. Set `AUTH_ACCESS_SOURCE=db-with-sheets-fallback` for one deployment cycle.
9. Watch sign-in logs and controlled leader/officer access checks.
10. Set `AUTH_ACCESS_SOURCE=db` only after DB reads are stable and importer reconciliation is understood.

The auth importer upserts authorized users without logging email addresses. `--disable-missing` is intentionally explicit and should only be used after verifying the Sheet is complete. In `db-with-sheets-fallback`, DB-known emails take precedence, including disabled or revoked DB rows, while Sheet-only emails remain available during the first cutover cycle.

## Officer Access Management

The protected `/services/admin/users` console is the supported interface for granting, changing, and revoking leader/officer access. It writes only to the Neon `AuthorizedUser` table through `/api/admin/access`.

- Only an active `officer` record in Neon can list or mutate access records.
- The mutation requires same-origin validation, rate limiting, an RTU email, and a validated portal role.
- Role or enabled-state changes increment `sessionVersion`; revocations also set `revokedAfter`.
- The current officer cannot revoke or downgrade their own access.
- Set `AUTH_ACCESS_SOURCE=db-with-sheets-fallback` for the first deployment cycle, then `db` after verification. The dashboard reports when the active auth source is still Sheets.
- Do not edit the Neon role records through Prisma Studio in production; use the protected dashboard for normal grants and revocations.

## Sanitized Export Policy

Only export SQL views named `public_sheet_*`. These views must exclude private grievance/proposal fields including:

- student IDs and private student emails
- grievance narratives and private review payloads
- tracking token hashes and session/security metadata
- queue payload JSON and recipient emails
- raw contributor student identifiers

Use Neon backups/PITR and controlled encrypted exports for real backup needs. Sheets is not a private-data backup.

## Operational Commands

```bash
npm run db:generate
npm run db:migrate:deploy
npm run preflight:db
npm run db:import:sheets:dry-run
npm run test:auth-import-fixture
npm run test:auth-import-write-guards
npm run db:import:auth:dry-run
npm run db:import:auth:write
npm run db:export:sheets:dry-run
npm run db:import:directory:dry-run
npm run db:export:directory:dry-run
```

`db:generate` uses a placeholder direct URL when `DIRECT_URL` is unset because Prisma client generation does not need a real database connection. Local maintainer scripts load `.env.local` without printing secrets. `db:migrate:deploy` requires `DIRECT_URL` and fails before running Prisma if it is missing. `preflight:db` requires `DATABASE_URL` and fails if the core migration tables, sanitized export views, clean foundation migration record, lowercase auth-email invariant, or runtime no-DDL role boundary are not visible. Runtime app traffic and DB writes require `DATABASE_URL`.
