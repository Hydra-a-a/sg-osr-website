---
canonical: false
last_verified: 2026-08-08
confidence: high
source_files:
  - package.json
  - README.md
  - docs/database/neon-prisma-migration.md
  - scripts/preflight-db.mjs
  - scripts/prisma-generate.mjs
  - scripts/import-operational-sheets.mjs
  - scripts/operational-import-parser.mjs
  - tests/test-operational-import-parser.js
  - app/api/admin/access/route.ts
  - lib/admin-access.ts
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
  - tests/test-admin-hub-backend-only-controls.js
  - tests/test-sensitive-api-cache-policy.js
  - tests/test-same-origin-write-guards.js
  - tests/test-rate-limit-coverage.js
  - app/hub/lost-found/page.tsx
  - app/api/hub/lost-found/
  - app/api/admin/lost-found/
  - app/services/admin/lost-found/page.tsx
  - lib/lost-found.ts
  - prisma/migrations/20260805000000_lost_found/migration.sql
  - scripts/preflight-db.mjs
  - tests/test-lost-found-boundaries.js
  - docs/security/dependency-audit.md
  - docs/security/session-policy.md
  - docs/security/auth-baseline-map.md
  - tests/test-session-token-boundary.js
  - tests/test-email-transport-boundary.js
  - .github/workflows/security-gates.yml
  - docs/launch/production-verification-runbook.md
---

# Verification Map

Choose the narrowest scripts that cover the changed behavior. This page is a routing guide; `package.json` is authoritative.

## Common Paths

| Change area | Start with |
| --- | --- |
| Authentication, authorization, sessions, redirects | `test:auth-baseline-map`, `test:session-policy`, `test:session-token-boundary`, `test:auth-redirect-safety`; verify Classroom handlers use the server-only OAuth projection |
| Database boundary, Neon/Prisma access, auth import guardrails, sanitized Sheets export | `test:db-access-policy`, `test:auth-db-cutover`, `test:auth-import-fixture`, `test:auth-import-write-guards`, `test:lost-found-boundaries`, `npx prisma validate`, `npm run db:generate`, plus live `npm run db:migrate:deploy` and `npm run preflight:db` when Neon secrets are available |
| API safety, cache, responses, origins, rate limits | `test:api-error-envelope`, `test:api-response-helpers`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage` |
| Tickets, grievances, comments, updates, notifications | `test:ticket-security-hardening`, `test:ticket-feature-boundaries`, `test:ticket-owner-access`, `test:ticket-comments-appeals`, `test:ticket-update-notification-sync` |
| Email transport and notification delivery | `test:email-transport-boundary`, ticket/proposal notification boundary tests, and `preflight:integrations` when SMTP secrets are available |
| Proposals and administrative controls | `test:proposal-feature-boundaries`, `test:admin-hub-backend-only-controls` |
| Officer access grants and revocations | `test:admin-access-controls`, `test:admin-hub-backend-only-controls`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage`, `test:auth-baseline-map`, `test:session-policy`, `preflight:db` |
| Directory, hub, commute, portal features | use the matching `test:directory-*`, `test:hub-*`, `test:commute-*`, or `test:portal-mode-*` script |
| Lost and found vertical slice | `test:lost-found-boundaries`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage`, live `preflight:db`, and the lost-and-found section of `docs/launch/production-verification-runbook.md` |
| UI and accessibility | relevant Playwright/a11y script, `audit:a11y`, or `audit:quality` after starting the dev server |
| Broad security regression | `npm run test:security` |
| Dependency/security release gate | `npm ci`, `npm audit --omit=dev --audit-level=high`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`; `npm run test:security` covers the session-token and email-transport boundaries |
| Full local release gate | `npm run test:readiness` |

## Operational Import Checks

- Run the operational Sheets dry run before any ticket, proposal, or notification DB write. It must remain read-only and report aggregate counts without printing private rows.
- Run `test:operational-import-parser` for parser changes. Use synthetic fixtures to cover malformed IDs, tracking hashes, timestamps, narratives, orphan comments, and queue rows.
- Run `npm run db:compare:operational` for the live, aggregate-only Sheets-to-Neon parity report. It must not write to Neon or print private rows.
- Run `npm run db:report:operational-blockers` for redacted row-level remediation metadata. The output is limited to sheet names, row numbers, cell letters, and reason codes; it must not include cell contents or private data.
- The current row-level report identifies Tickets rows 2-10: N2,N3 missing tracking hashes; B4/N4, B5/N5, and B6/N6 invalid timestamps plus missing hashes; B7, B9, and B10 invalid timestamps; and A8/B8/K8/N8 missing ID, invalid timestamp, missing narrative, and missing hash. `Project_Proposals` M2 has a missing tracking hash. `Ticket_Notification_Queue` D2:D19 has invalid notification `createdAt` values. Ticket comments, proposal comments, and proposal notification queue rows have no blockers.
- The current comparison records empty operational Neon tables; 8 valid and 9 invalid source tickets, 7 valid ticket comments, 2 valid and 1 blocked proposal, 12 valid proposal comments with no true orphan after parent-ID correction, 18 invalid ticket queue rows due to createdAt parsing, and 16 valid proposal queue rows.
- Treat missing tracking-token hashes, invalid timestamps, missing narratives, missing IDs, missing proposal hashes, and invalid queue timestamps as migration blockers until an explicit repair or quarantine policy is tested. The absence of a dedicated status-history source is also a cutover blocker.
- A passing parser or parity test does not establish cutover readiness. Pair them with the relevant ticket/proposal boundary, object-access, DB-policy, and notification tests, then satisfy the complete ticket vertical-slice gate before enabling writes or switching runtime routes.

## Linting

Run `npm run lint` when TypeScript or JavaScript changes are broad enough to benefit from project-wide static checks. Do not use it as a substitute for the focused behavior test.

## Live Database Checks

For Neon onboarding, role/grant changes, or auth DB writes, use this order when secrets are available: finalize Neon context, deploy migrations, apply post-migration grants, run `npm run preflight:db`, run auth import writes only after preflight passes, verify only aggregate counts, then run the focused DB/auth tests and the broader release checks affected by the change.

## Production-Only Checks

Use `docs/launch/production-verification-runbook.md` for checks that cannot be safely completed locally.

## Lost And Found Closeout

- The 2026-08-05 verification passed `npm run test:security`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:lost-found-boundaries`.
- Live Neon migration/preflight passed with 8 core tables, 5 sanitized views, lost-and-found rows `0/0/0`, and runtime role `osr_app_rw`. The unauthenticated public page rendered `200` with empty public data, and the unauthenticated admin API returned a generic `401`.
- The unrelated `test:navigation-ux-rail` drift remains: it expects an older exact breadcrumb class string in `SectionNavigationRail.tsx`.

Backlinks: [[index]] | [[security/invariants]] | [[systems/portal-map]]
