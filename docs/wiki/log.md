---
canonical: false
last_verified: 2026-08-05
confidence: high
---

# Wiki Log

## 2026-08-02 - Initial maintainer map

- Created the Obsidian-ready `docs/wiki/` vault and its core navigation pages.
- Added the [[librarian]] retrieval contract and the read-only `osr-librarian` Codex agent.
- Defined the ignored `raw/` inbox and local Obsidian state policy.

## 2026-08-02 - Neon Prisma migration map

- Added [[systems/database-map]] for the Neon Postgres + Prisma migration boundary.
- Recorded the server-only database access invariant and sanitized Sheets export policy.
- Linked `test:db-access-policy`, Prisma validation, and Prisma generation into verification routing.

## 2026-08-02 - Auth access DB cutover scaffold

- Added the source-switchable auth access repository behind `AUTH_ACCESS_SOURCE`.
- Added private-safe auth access Sheet import commands for Neon.
- Added `test:auth-db-cutover` to guard default Sheets behavior and lazy Prisma loading.

## 2026-08-02 - Auth import fixture verification

- Added a fake auth access Sheet fixture for local importer verification.
- Added `test:auth-import-fixture` so parser counts and private-safe output can be checked without live Sheets or DB access.

## 2026-08-02 - Prisma generate guardrail

- Routed `db:generate` through a wrapper that uses a placeholder direct URL only when `DIRECT_URL` is unset.
- Kept `db:migrate:deploy` as the command that requires the real Neon direct connection string.

## 2026-08-03 - Auth import dry-run hardening

- Added shared `.env.local` loading for DB maintainer scripts without printing secret values.
- Expanded auth import dry-run summaries with Sheet rows that contain email plus blank/no-email row counts.
- Verified the live auth Sheet dry-run with aggregate-only output: 999 raw rows, 16 rows with email, 16 valid RTU email rows, 0 invalid emails, 0 unknown access values, 0 unknown roles, 0 duplicate conflicts, 983 blank/no-email rows, 16 unique emails, 11 active leaders, and 5 active officers.
- Recorded that `preflight:db` remains blocked locally until `DATABASE_URL` is provided; no DB write was run.

## 2026-08-03 - Auth migration edge guardrails

- Made auth imports skip and count invalid/non-RTU email rows without logging addresses.
- Made auth DB writes transactional, refused empty parsed writes, and blocked writes with malformed emails, unknown access values, unknown roles, or conflicting duplicate emails.
- Updated fallback mode to merge Sheet-only users while letting any DB-known email, including disabled or revoked DB rows, take precedence.
- Enforced DB-backed `sessionVersion` checks so stale elevated JWTs downgrade on the auth callback path.
- Routed `db:migrate:deploy` through a local wrapper that loads `.env.local` and requires `DIRECT_URL`.
- Tightened `preflight:db` so it fails when core migration tables, sanitized views, migration state, auth email casing, or runtime no-DDL role boundaries are wrong.
- Reflected the auth import write guard, fallback/session invariants, and `DIRECT_URL` blocker in wiki verification and security routing.

## 2026-08-03 - Neon onboarding and auth DB write

- Recorded completed Neon agent-guided onboarding against the existing org/project without documenting connection secrets.
- Updated [[systems/database-map]] and [[security/invariants]] for the active least-privilege URL split, deployed foundation migration, post-migration grants, and no-DDL runtime role boundary.
- Replaced the dry-run-only auth import note with aggregate-only write verification: 16 total authorized users, 16 enabled, 0 disabled, 16 elevated, 11 leaders, and 5 officers.
- Added live Neon database check routing to [[tests/verification-map]].

## 2026-08-02 - Wiki maintainer agent

- Added [[wiki-maintainer]] and the write-scoped `osr-wiki-maintainer` Codex agent.
- Defined a finalization pass that updates the maintainer map only when the completed, scoped change materially affects documented behavior.

## 2026-08-04 - Operational Sheets import dry run

- Recorded the pure operational Sheets import parser and read-only dry-run runner for tickets, ticket comments/appeals, proposals, proposal comments, and unified/legacy notification queues.
- Recorded synthetic parser coverage and the aggregate dry-run blockers: invalid ticket rows, missing tracking-token hashes, invalid timestamps, missing narrative data, a missing proposal hash, and an orphan proposal comment.
- Recorded that no dedicated status-history source was found and that operational DB writes remain disabled pending repair/quarantine policy, comparison tooling, and repository cutover verification.

## 2026-08-04 - Operational Sheets-to-Neon parity closeout

- Added read-only parity tooling through `scripts/operational-parity.mjs` and `scripts/compare-operational-sheets-db.mjs`, with synthetic coverage in `tests/test-operational-parity.js` and package targets `db:compare:operational` and `test:operational-parity`.
- Corrected operational parser parent-ID collection and source row-number handling.
- Recorded the live aggregate-only comparison: operational Neon tables remain empty; source tickets had 8 valid and 9 invalid rows, ticket comments had 7 valid rows, proposals had 2 valid and 1 blocked row, proposal comments had 12 valid rows with no true orphan after parent-ID correction, ticket notification rows had 18 invalid createdAt values, proposal notification rows had 16 valid rows, and no dedicated status-history source exists.
- Recorded the cutover gate: resolve or quarantine invalid rows, repair ticket queue timestamp parsing, define status-history backfill, compare source and target aggregates, and pass the complete ticket vertical-slice verification before enabling operational writes or switching runtime routes.

## 2026-08-05 - Operational blocker report

- Recorded the redacted row-level blocker command `npm run db:report:operational-blockers` backed by `scripts/report-operational-blockers.mjs`.
- Recorded only sheet names, row numbers, cell letters, and reason codes: Tickets rows 2-10 contain missing tracking hashes, invalid timestamps, one missing ID, and one missing narrative; `Project_Proposals` M2 has a missing tracking hash; and `Ticket_Notification_Queue` D2:D19 has invalid notification `createdAt` values.
- Recorded that ticket comments, proposal comments, and proposal notification queue rows have no blockers in the report.
- Preserved the no-write boundary: the report does not write to Neon, rewrite Sheets rows, or record cell contents, credentials, or private data. Final security and lint verification remains pending for this material change.

## 2026-08-05 - Neon officer access console

- Recorded the `/services/admin/users` console and `/api/admin/access` server boundary for granting, changing, and revoking leader/officer access in Neon.
- Recorded the active-Neon-officer gate, same-origin/Zod/rate-limit/no-store controls, transactional session-version and revocation updates, and self-lockout protection.
- Linked the access-control verification targets and canonical Neon/auth/session documents without recording identities, email addresses, or private records.

## 2026-08-05 - Lost-and-found Neon vertical slice

- Added the Neon-native lost-and-found portal map for `/hub/lost-found`, `/services/admin/lost-found`, the public/student APIs, protected officer moderation and pending-media proxy, and the `LostFoundItem`, `LostFoundAttachment`, and `LostFoundComment` schema boundary.
- Recorded the manual CSO-entry policy pending a stable feed contract, the `PENDING_REVIEW` student workflow, public projection redaction, and item-scoped Drive media access.
- Recorded the completed migration/preflight evidence: 8 core tables, 5 sanitized views, lost-and-found counts `0/0/0`, and runtime role `osr_app_rw`. Security, lint, TypeScript, build, and boundary verification passed; unauthenticated public/admin smoke checks returned the expected empty `200` and generic `401` results.
- Preserved the unrelated `test:navigation-ux-rail` exact-class test drift as residual verification uncertainty; it is outside this feature scope.

## 2026-08-06 - Directory logo management and correction guidance

- Added `DirectoryEntry.directoryKey`, one-to-one `DirectoryLogo` metadata, `DirectoryExportState`, the restricted Drive upload/cleanup path, and the sanitized `Directory Export` view.
- Added aggregate-only directory import tooling with fixture coverage, `DIRECTORY_SOURCE` DB/fallback routing, officer-only logo management at `/services/admin/directory`, manual export, and `CRON_SECRET`-gated Vercel Cron export.
- Added raster MIME/signature, 5 MB, Drive-folder, compensation, same-origin, rate-limit, no-store, audit, and sanitized-export boundaries. Added public correction guidance as a configured plain `mailto:` link with no report backend.
- Verification passed: Prisma validate/generate, TypeScript, lint, `npm run test:security`, directory fixture dry-run, Webpack production build, public directory browser smoke, unauthenticated admin redirect/API `401`, and unauthenticated cron `401`.
- Production-only follow-up remains: apply the directory migration, run approved live import parity, perform one controlled logo lifecycle, verify the `Directory Export` tab, then switch `DIRECTORY_SOURCE` from fallback to `db`. No live directory write or export was run locally.

Backlinks: [[index]] | [[README]]

## 2026-08-08 - OAuth session and dependency security closeout

- Recorded the token-free browser session projection and server-only `authWithGoogleToken()` boundary used by Classroom route handlers, plus the focused session-token test and security-workflow entry.
- Recorded the dependency gate remediation: Next/`eslint-config-next` 16.3.0, `next-auth` beta.32, Gemini and `isomorphic-dompurify` removal, Axios/Nodemailer remediation, and scoped `fast-uri`/`brace-expansion` overrides.
- Linked the email transport boundary test and canonical session/dependency/auth documents in the maintainer verification map.
