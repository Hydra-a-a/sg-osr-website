---
canonical: false
last_verified: 2026-08-10
confidence: high
source_files:
  - README.md
  - docs/security/auth-baseline-map.md
  - docs/security/session-policy.md
  - package.json
  - prisma/schema.prisma
  - lib/prisma.ts
  - lib/db-access-policy.ts
  - scripts/preflight-db.mjs
  - scripts/import-sheets-to-db.mjs
  - prisma/roles.example.sql
  - tests/test-auth-baseline-map.js
  - tests/test-session-policy.js
  - tests/test-db-access-policy.js
  - tests/test-auth-db-cutover.js
  - tests/test-auth-import-fixture.js
  - tests/test-auth-import-write-guards.js
  - tests/test-ticket-security-hardening.js
  - tests/test-redacted-logging.js
  - app/api/admin/access/route.ts
  - app/api/admin/overview/route.ts
  - app/api/admin/content/
  - app/api/admin/news/sync/route.ts
  - lib/admin-access.ts
  - lib/admin-overview.ts
  - lib/admin-content.ts
  - lib/public-content-source.ts
  - lib/directory-logo-manager.ts
  - lib/auth.ts
  - lib/auth.config.ts
  - types/next-auth.d.ts
  - app/api/classroom/courses/route.ts
  - app/api/classroom/courses/[courseId]/coursework/route.ts
  - app/api/classroom/courses/[courseId]/coursework/[courseWorkId]/route.ts
  - app/api/classroom/submissions/route.ts
  - lib/email.ts
  - scripts/preflight-integrations.mjs
  - lib/audit.ts
  - app/services/admin/page.tsx
  - app/services/admin/users/page.tsx
  - docs/database/neon-prisma-migration.md
  - docs/security/auth-baseline-map.md
  - docs/security/session-policy.md
  - tests/test-admin-access-controls.js
  - tests/test-admin-overview-contract.js
  - tests/test-admin-content-contract.js
  - tests/test-admin-overlay-contract.js
  - tests/test-admin-hub-backend-only-controls.js
  - tests/test-sensitive-api-cache-policy.js
  - tests/test-same-origin-write-guards.js
  - tests/test-rate-limit-coverage.js
  - tests/test-email-transport-boundary.js
  - package-lock.json
  - .github/workflows/security-gates.yml
  - app/api/hub/lost-found/
  - app/api/admin/lost-found/
  - lib/lost-found.ts
  - schemas/lost-found.ts
  - tests/test-lost-found-boundaries.js
  - lib/idempotency.ts
  - lib/idempotency-contract.ts
  - lib/client-error.ts
  - instrumentation.ts
  - instrumentation-client.ts
  - app/global-error.tsx
  - app/api/tickets/route.ts
  - app/api/proposals/route.ts
  - app/api/hub/lost-found/route.ts
  - app/layout.js
  - app/hub/layout.tsx
  - app/services/layout.tsx
  - app/transparency/layout.tsx
  - components/NavbarClient.tsx
  - components/directory/StudentOrganizationsClient.tsx
---

# Security Invariants

Use this page as an orientation checklist. Verify each task against the implementation, security docs, and focused tests.

## Request and Access Controls

- Validate untrusted input with Zod at the server boundary.
- Enforce authorization server-side for protected pages, route handlers, and actions.
- Preserve existing same-origin, redirect-safety, rate-limit, duplicate-submission, and webhook-signature protections.
- Keep cache headers and error envelopes safe for sensitive API responses.
- First-party ticket, proposal, and Lost & Found submissions accept a bounded `Idempotency-Key`; durable attempts hash the key, actor, and canonical payload, reject payload reuse, return `409` for in-progress attempts, and replay the same entity plus any deterministic tracking credential required by that operation after completion. Raw keys, submissions, tokens, and response bodies remain out of persistence and logs.
- Public shared-cache headers are limited to explicitly public projections and immutable/versioned assets; admin, session, mutation, and other sensitive endpoints remain `no-store`. CSP nonce handling remains authoritative for request-time routes.

## Data Privacy

- Preserve redaction and ownership boundaries for grievance and ticket data.
- Do not log sensitive student or ticket content.
- Do not expose server secrets through `NEXT_PUBLIC_*` variables or client bundles.
- Keep OAuth access and refresh tokens in JWT/server-only claims. The browser-visible Auth.js Session must contain only non-secret identity fields; every Classroom handler uses the server-only `authWithGoogleToken()` projection. `tests/test-session-token-boundary.js` must continue to reject client-side token reads and direct public-session imports.
- Resolve the root server session once for the public shell and pass only the approved projection to browser-facing navigation; scope `AuthProvider` to layouts that actually contain `useSession()` consumers. Lazy-loading `signOut` must not move credentials or authorization decisions into the client.
- Treat database credentials, Google credentials, service-account material, webhook secrets, and scheduler secrets as server-only.
- Runtime database access must use the pooled `DATABASE_URL` with the least-privilege `osr_app_rw` role; Prisma migration/admin tooling uses the direct `DIRECT_URL` with `osr_migrator`.
- Runtime DB roles must not be able to create schema objects. Schema DDL stays migrator-only, while export/admin read paths use sanitized `public_sheet_*` views for Sheets-facing data.
- Auth role lookup must default to Sheets until `AUTH_ACCESS_SOURCE` is explicitly set to `db-with-sheets-fallback` or `db`.
- In DB fallback mode, DB-known auth emails must take precedence over Sheets rows and DB-backed `sessionVersion` changes must downgrade stale elevated JWTs.
- The access-management API must require an active Neon `officer` record for the caller, independently of any client-selected portal mode or Sheets role. The only exception is the explicit local development simulation in `requireActiveDatabaseOfficer`: `NODE_ENV !== 'production'`, `ENABLE_LOCAL_LOGIN_SIMULATION=true`, `session.user.isDevSim=true`, and `session.user.role='officer'`; that path returns a synthetic actor and is never a production DB bypass.
- Access-management writes must require same-origin validation, Zod input validation, rate limiting, and `Cache-Control: no-store`; they must update role state transactionally and protect the current officer from self-lockout.
- Access-management role changes must increment `sessionVersion`, set `revokedAfter` on revocation, and keep audit output redacted and aggregate-safe.
- The admin overview GET must require an effective `officer` role, apply rate limiting, return `Cache-Control: no-store`, and use redacted logs and safe error envelopes. Its provider summaries remain aggregate-only and degrade failed sources to `unavailable` without exposing record content.
- Admin public-content draft, publish, history, and staged-logo routes must require an active database officer. Mutations require same-origin validation, rate limiting, `Cache-Control: no-store`, redacted logging, and audit events; strict payload schemas enforce trusted links, publication uses optimistic version checks and immutable revisions, and staged Drive assets stay private until publish.
- Admin news synchronization must require same-origin validation and an active database officer, rate-limit dry-run/sync requests, validate the requested mode, return `no-store` responses, and keep audit/log output aggregate and redacted.
- Lost-and-found student submissions require an authenticated RTU session, same-origin validation, Zod validation, rate limiting, and server-side attachment count/type/size checks; public comment writes use the same boundary.
- Lost-and-found officer listing, CSO entry, moderation, comment moderation, and pending-media inspection require an active Neon `officer` record. Mutations use same-origin validation, rate limiting, Zod validation, and `Cache-Control: no-store` responses.
- Auth import, preflight, and DB verification output must remain aggregate-only and must not print private rows or email addresses.
- Public Sheets exports must read only sanitized `public_sheet_*` views and exclude private student, grievance, proposal, tracking-token, and notification payload fields.
- Public lost-and-found projections expose only published/resolved items and public-safe fields; they exclude submitter identity, review notes, raw Drive URLs, and author email addresses. Hidden comments are excluded from public comment reads.
- Lost-and-found media is attachment-scoped. The public proxy requires the linked item to be published or resolved, while the officer proxy is protected, no-store, MIME-checked, and constrained to the configured restricted Drive folder.
- Directory logo mutations require an active Neon `officer`, same-origin validation, Zod keys, rate limiting, no-store responses, raster MIME/signature checks, a 5 MB limit, and Drive-folder compensation when the Neon transaction fails. The public logo proxy allows only raster files from the configured folder.
- Directory export jobs must authenticate with `CRON_SECRET` or the officer route, read only `public_sheet_directory_entries`, clear stale rows, and keep raw Drive URLs and private fields out of Sheets.
- Public content source switches default to Sheets and may explicitly select database or database-with-Sheets-fallback loaders; public projections must preserve safe URL/guide filtering and response shapes. `db:compare:public-content` remains read-only and aggregate-only.
- External public reads use short bounded timeouts and sanitized fallback projections; error classification must distinguish offline, timeout, rate-limit, provider failure, validation, and not-found states so ticket lookup never labels a network failure as an invalid ticket ID. Sentry captures errors without client tracing/replay sampling and validates the public DSN without exposing it.

## Content and External Boundaries

- Sanitize user-provided HTML before rendering with the established DOM sanitization path.
- Keep externally supplied links and fetches within the repository's existing safe-validation patterns.
- Preserve CSP behavior when changing scripts, integrations, or rendered content.
- Keep `npm audit --omit=dev --audit-level=high` at zero High/Critical production findings before release. The documented remediation keeps Next and `eslint-config-next` on 16.3.0, `next-auth` on beta.32, uses the patched `nodemailer-patched` alias, removes unused Gemini and `isomorphic-dompurify` paths, and scopes `fast-uri`/`brace-expansion` overrides.

## Focused References

- `docs/security/auth-baseline-map.md`
- `docs/security/session-policy.md`
- `docs/security/dependency-audit.md`
- `tests/test-auth-baseline-map.js`
- `tests/test-session-policy.js`
- `tests/test-session-token-boundary.js`
- `tests/test-email-transport-boundary.js`
- `.github/workflows/security-gates.yml`
- `tests/test-auth-import-fixture.js`
- `tests/test-auth-import-write-guards.js`
- `tests/test-ticket-security-hardening.js`
- `tests/test-redacted-logging.js`
- `tests/test-db-access-policy.js`
- `tests/test-auth-db-cutover.js`
- `tests/test-lost-found-boundaries.js`
- `docs/database/neon-prisma-migration.md`
- `docs/launch/production-verification-runbook.md`

Backlinks: [[index]] | [[systems/portal-map]] | [[systems/database-map]] | [[tests/verification-map]]
