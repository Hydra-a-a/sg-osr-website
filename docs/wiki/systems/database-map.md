---
canonical: false
last_verified: 2026-08-06
confidence: high
source_files:
  - .neon
  - package.json
  - package-lock.json
  - prisma/schema.prisma
  - prisma.config.ts
  - lib/prisma.ts
  - lib/auth-access.ts
  - lib/db-access-policy.ts
  - docs/database/neon-prisma-migration.md
  - scripts/preflight-db.mjs
  - scripts/prisma-generate.mjs
  - prisma/roles.example.sql
  - tests/test-db-access-policy.js
  - tests/test-auth-db-cutover.js
  - tests/test-auth-import-fixture.js
  - tests/test-auth-import-write-guards.js
  - scripts/import-operational-sheets.mjs
  - scripts/operational-import-parser.mjs
  - scripts/operational-parity.mjs
  - scripts/compare-operational-sheets-db.mjs
  - tests/test-operational-import-parser.js
  - tests/test-operational-parity.js
  - app/api/admin/access/route.ts
  - lib/admin-access.ts
  - lib/auth.ts
  - lib/audit.ts
  - app/services/admin/page.tsx
  - app/services/admin/users/page.tsx
  - docs/database/neon-prisma-migration.md
  - docs/security/session-policy.md
  - tests/test-admin-access-controls.js
  - tests/test-admin-hub-backend-only-controls.js
  - tests/test-sensitive-api-cache-policy.js
  - tests/test-same-origin-write-guards.js
  - tests/test-rate-limit-coverage.js
  - lib/lost-found.ts
  - schemas/lost-found.ts
  - prisma/migrations/20260805000000_lost_found/migration.sql
  - scripts/preflight-db.mjs
  - tests/test-lost-found-boundaries.js
  - lib/directory-repository.ts
  - lib/directory-logo-manager.ts
  - lib/directory-export.ts
  - app/api/admin/directory/route.ts
  - app/api/admin/directory/export/route.ts
  - app/api/cron/directory-export/route.ts
  - scripts/directory-import-parser.mjs
  - scripts/import-directory-to-db.mjs
  - scripts/export-public-sheets.mjs
  - tests/test-directory-import-parser.js
  - tests/test-directory-management-contract.js
  - docs/launch/production-verification-runbook.md
---

# Database Map

The app has a Neon Postgres + Prisma data layer connected to the existing Neon org/project. During the migration window, existing runtime routes can still use Google Sheets until their domain repositories are cut over.

## Current Boundary

- `lib/prisma.ts` is the server-only Prisma entrypoint and uses `DATABASE_URL`.
- `lib/auth-access.ts` is the first source-switchable repository; it defaults to Sheets and supports `db` plus `db-with-sheets-fallback`.
- `prisma.config.ts` uses `DIRECT_URL` for Prisma CLI migration/admin commands.
- `prisma/schema.prisma` models auth users, tickets, proposals, notification jobs, commute routes, and public content/config.
- `lib/db-access-policy.ts` lists DB roles, runtime/migration env vars, sanitized export views, and blocked private export fields.
- `.neon` stores safe Neon org/project context only. DB credentials stay in local/deployment env vars and must not be copied into the wiki or logs.
- `@neondatabase/serverless` is a direct dependency alongside `@prisma/adapter-neon`.
- The least-privilege URL split is active locally: pooled `DATABASE_URL` uses `osr_app_rw`, and direct `DIRECT_URL` uses `osr_migrator`.
- Neon roles are `osr_migrator`, `osr_app_rw`, `osr_export_ro`, and `osr_admin_ro`. Post-migration grants allow runtime CRUD on app tables, sanitized-view reads for export/admin roles, and no schema creation for the runtime role.

## Lost And Found Vertical Slice

- `LostFoundItem`, `LostFoundAttachment`, and `LostFoundComment` are Neon-native Prisma models deployed by `20260805000000_lost_found`; the runtime repository is `lib/lost-found.ts` and does not read Google Sheets.
- Active Neon officers manually enter `CSO` bulletins through `/services/admin/lost-found` until a stable CSO feed contract with an idempotent reference field exists. Authenticated RTU students submit `STUDENT` reports, which default to `PENDING_REVIEW`.
- Public repository projections include only `PUBLISHED` and `RESOLVED` items. Submitter identity, review notes, and raw Drive URLs remain outside the public response; attachments are addressed by item-scoped public IDs and streamed through the media proxy.
- `preflight:db` verifies the three lost-and-found tables and reports aggregate item, attachment, and comment counts without exposing private rows. The production runbook covers controlled CSO, student, moderation, media, and attachment-limit checks.

## Directory Logo Management

- `DirectoryEntry.directoryKey` is the stable directory identity; `DirectoryLogo` stores one protected Drive asset and sanitized metadata per enabled entry, while `DirectoryExportState` tracks retryable Sheets publication.
- `lib/directory-repository.ts` reads Neon entries for `DIRECTORY_SOURCE=db` and supports the explicit `db-with-sheets-fallback` rollout mode. Public responses retain the existing organizations/offices shapes.
- `/services/admin/directory` and its server routes require an active Neon `officer`. Raster uploads are signature-checked, limited to 5 MB, uploaded to the configured organization-logo folder, and compensated in Drive if the Neon transaction fails.
- `scripts/import-directory-to-db.mjs` is the aggregate-only import boundary. `scripts/export-public-sheets.mjs` writes the sanitized `Directory Export` tab from `public_sheet_directory_entries`, clearing stale rows before deterministic replacement.
- Student-organization correction guidance is a public configured `mailto:` instruction only. There is no correction-report table, queue, or backend email processing.

## Migration Direction

- Private workflows move first: auth roles, tickets, proposals, comments, and notification queues.
- Auth roles can be verified locally with `test:auth-import-fixture`, imported with `db:import:auth:dry-run` and `db:import:auth:write`, then enabled with `AUTH_ACCESS_SOURCE=db-with-sheets-fallback`. The dry-run summary reports valid RTU email rows, invalid email rows, unknown access/role values, duplicate conflicts, and blank/no-email rows so formatted empty Sheet ranges or malformed entries do not hide the real import size.
- Commute community data moves after private workflow tests are stable.
- Public content/config moves last.
- Google Sheets becomes a sanitized mirror written from `public_sheet_*` SQL views only.
- Latest live auth Sheet write was aggregate-only after DB preflight passed: 16 total authorized users, 16 enabled, 0 disabled, 16 elevated, 11 leaders, and 5 officers. No private rows or emails were printed.
- In `db-with-sheets-fallback`, DB-known emails take precedence, including disabled or revoked DB rows, while Sheet-only emails remain available during the first cutover cycle.

## Officer Access Management

- `/services/admin/users` is the dashboard interface for granting, changing, and revoking `leader` and `officer` access. Browser code calls `/api/admin/access`; it does not connect to Neon directly.
- The access API requires an active Neon `officer` record for the caller on every request. This is a separate database-backed gate from the legacy Sheets auth source, so the dashboard warns when `AUTH_ACCESS_SOURCE` is still Sheets.
- Grant, role-change, and enabled-state mutations update `AuthorizedUser` transactionally, increment `sessionVersion`, and set `revokedAfter` for revocations. The current officer cannot remove or downgrade their own access.
- Same-origin checks, Zod validation, rate limiting, no-store responses, and redacted audit behavior are part of the route boundary. Normal access management remains server-authorized; Prisma and Neon credentials stay server-only.

## Operational Import Readiness

- `scripts/import-operational-sheets.mjs` is a read-only operational dry-run runner for tickets, ticket comments/appeals, proposals, proposal comments, and unified/legacy notification queues. `scripts/operational-import-parser.mjs` is the pure parsing boundary; synthetic fixtures cover it without live Sheets or DB writes.
- The first complete cutover candidate remains the ticket vertical slice: creation, access, admin updates, comments/appeals, status history, and ticket notifications must move together to avoid split-brain persistence.
- The latest read-only parity report confirms that operational Neon tables remain empty. Source tickets had 8 valid and 9 invalid rows, including 6 missing tracking-token hashes, 7 invalid submitted timestamps, 1 missing ID, and 1 missing narrative. Ticket comments had 7 valid rows; proposals had 2 valid rows and 1 missing tracking-token hash; proposal comments had 12 valid rows with no true orphan after parent-ID correction. The ticket notification queue had 18 invalid rows due to createdAt parsing; the proposal queue had 16 valid rows.
- No dedicated status-history source was found in the operational Sheets data. Status history must be derived or backfilled explicitly before the ticket/proposal cutover contract is finalized.
- Run `npm run db:compare:operational` for the aggregate, read-only Sheets-to-Neon comparison. It must not print private rows or write to Neon.
- Run `npm run db:report:operational-blockers` for the redacted row-level report. It may report sheet names, row numbers, cell letters, and reason codes only; it must not print cell contents, private data, credentials, or write to Neon.
- The latest blocker report identifies Tickets rows 2-10: N2,N3 missing tracking hashes; B4/N4, B5/N5, and B6/N6 invalid timestamps plus missing hashes; B7, B9, and B10 invalid timestamps; and A8/B8/K8/N8 missing ID, invalid timestamp, missing narrative, and missing hash. `Project_Proposals` M2 is blocked by a missing tracking hash. `Ticket_Notification_Queue` D2:D19 is blocked by invalid notification `createdAt` values. Ticket comments, proposal comments, and proposal notification queue rows have no reported blockers.
- Use the row-level report to direct source-owner remediation. Do not recreate missing tracking hashes, infer ambiguous timestamps, or rewrite source rows automatically.
- Do not enable operational DB writes based on the comparison alone. Resolve or quarantine invalid source rows, repair the ticket notification timestamp parsing, define the status-history backfill policy, and verify repository behavior against existing route contracts first.
- Ticket cutover gate: source and target aggregate counts must be compared, all invalid/quarantined rows must be accounted for, status history must have an explicit policy, and the complete ticket vertical slice (creation, access, admin updates, comments/appeals, status history, and notifications) must pass focused tests before any runtime route switches from Sheets.

## Verification

- Start with `test:db-access-policy`, `test:auth-db-cutover`, `test:auth-import-fixture`, and `test:auth-import-write-guards` for database boundary regressions.
- Use `npx prisma validate` with a placeholder `DIRECT_URL` to validate schema/config locally.
- Use `npm run db:generate` after schema changes; it injects a placeholder direct URL only when `DIRECT_URL` is unset.
- Use `npm run preflight:db` after adding local `DATABASE_URL`; the script loads `.env.local` without printing connection details.
- `preflight:db` must see the core tables, sanitized export views, clean foundation migration record, no case-colliding auth emails, and a runtime role that cannot create schema objects before auth writes proceed; connection alone is not enough. The script casts Postgres catalog/name fields to text for Prisma raw-query compatibility.
- Use `npm run db:migrate:deploy` only when `DIRECT_URL` is available; the wrapper loads `.env.local` and fails closed without the direct migration connection string.
- The 2026-08-03 live Neon closeout passed `db:migrate:deploy`, post-migration grants, `preflight:db` with runtime role `osr_app_rw`, auth import write, aggregate DB count verification, focused DB/auth tests, `test:security`, `lint`, `db:generate`, and `build`.
- The 2026-08-04 operational parity closeout passed `test:operational-import-parser`, `test:operational-parity`, `test:package-script-targets`, `lint`, and the live read-only comparison. No operational DB writes were performed.
- The 2026-08-05 lost-and-found closeout passed the additive migration and Neon preflight: 8 core tables, 5 sanitized views, lost-and-found counts `0/0/0`, and runtime role `osr_app_rw`. The boundary, security, lint, TypeScript, and build checks also passed.
- Run impacted domain tests when a route moves from Sheets to DB.

Backlinks: [[index]] | [[systems/portal-map]] | [[security/invariants]] | [[tests/verification-map]]
