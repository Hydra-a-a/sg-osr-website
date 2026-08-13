---
canonical: false
last_verified: 2026-08-11
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
  - app/services/admin/lost-found/page.tsx
  - app/services/admin/directory/page.tsx
  - app/services/admin/grievances/page.tsx
  - app/services/admin/proposals/page.tsx
  - app/services/admin/routes/page.tsx
  - app/services/admin/layout.tsx
  - app/services/admin/loading.tsx
  - app/hub/layout.tsx
  - app/services/layout.tsx
  - app/transparency/layout.tsx
  - components/NavbarClient.tsx
  - components/directory/StudentOrganizationsClient.tsx
  - app/loading.tsx
  - app/hub/loading.tsx
  - app/directory/loading.tsx
  - app/directory/student-organizations/loading.tsx
  - app/directory/university-offices/loading.tsx
  - app/services/loading.tsx
  - app/services/grievance/loading.tsx
  - components/PortalLoading.tsx
  - app/globals.css
  - app/services/admin/error.tsx
  - app/services/admin/content/page.tsx
  - app/services/admin/classroom/page.tsx
  - app/api/admin/overview/route.ts
  - app/api/admin/content/
  - app/api/admin/news/sync/route.ts
  - lib/admin-overview.ts
  - lib/admin-overview-types.ts
  - lib/admin-content.ts
  - lib/admin-surface-registry.ts
  - lib/public-content-source.ts
  - lib/directory-logo-manager.ts
  - components/RouteAwareSiteChrome.tsx
  - components/admin/AdminWorkspaceShell.tsx
  - components/admin/AdminPageShell.tsx
  - components/admin/AdminDataGrid.tsx
  - components/admin/AdminInspector.tsx
  - components/admin/admin-navigation.ts
  - components/admin/admin-query.ts
  - components/admin/admin-types.ts
  - components/admin/AdminOverlay.tsx
  - components/admin/AdminActionMenu.tsx
  - components/admin/AdminTabs.tsx
  - components/admin/AdminDisclosure.tsx
  - components/admin/AdminToast.tsx
  - components/admin/useAdminUnsavedChanges.ts
  - components/admin/AdminContentWorkspace.tsx
  - prisma/schema.prisma
  - prisma/migrations/20260809000000_admin_content_workspace/migration.sql
  - scripts/compare-public-content.mjs
  - tests/test-admin-overview-contract.js
  - tests/test-admin-content-contract.js
  - tests/test-admin-overlay-contract.js
  - tests/test-admin-hub-backend-only-controls.js
  - tests/test-commute-community-routes.js
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
  - tests/test-submission-idempotency-contract.js
  - scripts/audit-performance.mjs
  - scripts/audit-lighthouse.mjs
  - lighthouserc.cjs
  - components/hub/HubClient.tsx
  - components/hub/HubOverlays.tsx
  - components/DeferredAnnouncementPopup.tsx
  - next.config.mjs
  - public/images/BONI_AVE.jpg
  - .github/workflows/accessibility-ux-audits.yml
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
| Authentication, authorization, sessions, redirects | `test:auth-baseline-map`, `test:session-policy`, `test:session-token-boundary`, `test:auth-redirect-safety`; verify the root session projection, route-scoped `AuthProvider` layouts, lazy `signOut`, and server-only Classroom OAuth projection |
| Database boundary, Neon/Prisma access, auth import guardrails, sanitized Sheets export | `test:db-access-policy`, `test:auth-db-cutover`, `test:auth-import-fixture`, `test:auth-import-write-guards`, `test:lost-found-boundaries`, `npx prisma validate`, `npm run db:generate`, plus live `npm run db:migrate:deploy` and `npm run preflight:db` when Neon secrets are available |
| API safety, cache, responses, origins, rate limits | `test:api-error-envelope`, `test:api-response-helpers`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage` |
| Tickets, grievances, comments, updates, notifications | `test:ticket-security-hardening`, `test:ticket-feature-boundaries`, `test:ticket-owner-access`, `test:ticket-comments-appeals`, `test:ticket-update-notification-sync` |
| Email transport and notification delivery | `test:email-transport-boundary`, ticket/proposal notification boundary tests, and `preflight:integrations` when SMTP secrets are available |
| Proposals and administrative controls | `test:proposal-feature-boundaries`, `test:admin-hub-backend-only-controls`, `test:admin-overview-contract` |
| Officer access grants and revocations | `test:admin-access-controls`, `test:admin-hub-backend-only-controls`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage`, `test:auth-baseline-map`, `test:session-policy`, `preflight:db`; confirm `/api/admin/access` delegates to `requireActiveDatabaseOfficer` and that the synthetic officer path is limited to the explicit non-production local-login simulation guard |
| Directory, hub, commute, portal features | use the matching `test:directory-*`, `test:hub-*`, `test:commute-*`, or `test:portal-mode-*` script |
| Public directory caching and hydration | Verify `app/api/directory/route.ts` keeps the one-hour `unstable_cache`/`PUBLIC_CACHE_TAGS.directory` wrapper, directory pages receive server `initialData` with native fallback fetches, and public organizations/offices shapes remain unchanged; the latest controlled audit observed directory warm TTFB around `103 ms`. |
| Lost and found vertical slice | `test:lost-found-boundaries`, `test:sensitive-api-cache-policy`, `test:same-origin-write-guards`, `test:rate-limit-coverage`, live `preflight:db`, and the lost-and-found section of `docs/launch/production-verification-runbook.md` |
| Shared admin workspace and overview | `test:admin-overview-contract`, `test:admin-hub-backend-only-controls`, `test:commute-community-routes`, `test:accessibility-audit-pipeline`, and the affected module boundary scripts; verify unauthenticated `/services/admin` redirects to `/login` and that the public chrome is omitted inside the admin route group |
| Admin content drafting and publication | `test:admin-content-contract`, `test:admin-overlay-contract`, `test:directory-management-contract`, `test:directory-logo-pipeline`, `test:accessibility-audit-pipeline`; add `npx prisma validate` and `npm run db:generate` for schema/migration changes |
| Public content source cutover/parity | `test:admin-content-contract`, `test:news-legacy-boundaries`, `test:package-script-targets`; run `npm run db:compare:public-content` only with approved Sheets/Neon credentials and confirm aggregate-only output |
| Durable ticket/proposal/Lost & Found submission integrity | `test:submission-idempotency-contract`, `test:lost-found-boundaries`, ticket/proposal boundary and security tests; add concurrency/failure-injection coverage for replay, payload reuse, stale attempts, upload compensation, and post-commit notification retry before operational DB cutover |
| Public performance and network resilience | `npm run audit:performance` (slow-mobile, 4x CPU, median three cold runs, three-second long-task diagnostic), `npm run audit:lighthouse` (direct production server, three mobile runs, median TBT/LCP/CLS, long-task URLs/dev-resource checks), and `audit:a11y`; keep both advisory until two stable provider previews before setting `AUDIT_ENFORCE=1` |
| Recovery UX and client boundaries | Relevant route error/loading tests plus targeted mobile Chromium checks for keyboard focus, reduced motion, offline-after-load, draft restore/clear, retry preservation, and duplicate-submit prevention; no service-worker/offline-shell claim is implied |
| Loading-state and route-transition UX | `npm run audit:a11y` across the affected routes and viewports, plus delayed production navigation smoke at desktop/mobile; verify branded dark shells, no light/white placeholder flash, reduced-motion behavior, and clean transition to route content |
| UI and accessibility | relevant Playwright/a11y script, `test:accessibility-audit-pipeline`, `audit:a11y`, or `audit:quality` after starting the dev server; admin-shell changes should also run the affected admin boundary scripts. Admin inspector/grid changes should run `test:admin-overlay-contract` and verify all six admin record surfaces use drawer inspectors, full-width bounded grids/queues, responsive caps, overscroll containment, focus restoration, Escape handling, and body-scroll locking. |
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

The performance/resilience remediation was verified locally with `npm run db:generate`, Prisma validation using a non-secret placeholder `DIRECT_URL`, `npx tsc --noEmit`, `npm run lint`, `npm run test:security`, and `npm run build`. No live DB/provider preflight, migration deployment, or preview promotion was performed. Local slow-mobile measurements generally kept initial transfer/JavaScript within the working budgets, but Hub LCP/settled transfer and TBT/CLS still missed release gates; preview medians remain required.

Latest clean production Home slow-mobile median (three cold runs) measured CLS `0`, transfer approximately `292.6 KB`, initial compressed JavaScript approximately `167.4 KB`, LCP `3.524 s`, and TBT `1.807 s`. Transfer/CLS/initial-JavaScript budgets pass for this sample; LCP remains just above the `3.5 s` gate and TBT remains above `300 ms`. A controlled `/hub` browser smoke confirmed no iframe before preview and verified the mobile-menu `aria-expanded` toggle.

The latest release-gate run passed TypeScript, lint (only existing HubClient `window.location` warnings), build, security, focused accessibility/Hub/package tests, and the seven-route/two-viewport accessibility audit. A Playwright check confirmed the Hub image completed at quality 70 with the expected crop and the mobile menu rendered. The full-route performance budgets passed for LCP, CLS, transfer, initial JavaScript, and menu interaction, but TBT remained variable and above gate (Home `655 ms`, Hub `515 ms`, directory `584 ms`, grievance `504 ms`); Lighthouse collection still ended with Windows Chrome cleanup `EPERM`/taskkill access denied, so preview/CI evidence remains required.

The hardened four-route audit self-started a production server on free port `61796`, reported an empty dev-resource set, and kept menu interaction under `200 ms`; LCP, CLS, transfer, and initial JavaScript passed, while TBT medians remained above budget (Home `1254 ms`, Hub `757 ms`, directory `1106 ms`, grievance `853 ms`). The corrected Lighthouse mobile configuration collected locally but ended with a Windows Chrome cleanup `EPERM` after collection, so preview/CI Lighthouse evidence remains required.

The corrected direct Lighthouse runner completed three-run mobile medians with empty dev-resource sets: Home TBT `124 ms` / LCP `2.974 s`, Hub `98 ms` / `3.202 s`, directory `101 ms` / `2.986 s`, and grievance `127 ms` / `2.792 s`; CLS was `0` for all routes. The custom audit passed its enforced budgets. `npm run test:readiness`, security, TypeScript, lint (two existing HubClient warnings), build, and accessibility checks passed; production `npm audit` reported no High/Critical findings and nine existing Low/Moderate advisories. Lighthouse/performance enforcement remains advisory pending two stable provider preview runs.

## Production-Only Checks

Use `docs/launch/production-verification-runbook.md` for checks that cannot be safely completed locally.

## Lost And Found Closeout

- The 2026-08-05 verification passed `npm run test:security`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npm run test:lost-found-boundaries`.
- Live Neon migration/preflight passed with 8 core tables, 5 sanitized views, lost-and-found rows `0/0/0`, and runtime role `osr_app_rw`. The unauthenticated public page rendered `200` with empty public data, and the unauthenticated admin API returned a generic `401`.
- The unrelated `test:navigation-ux-rail` drift remains: it expects an older exact breadcrumb class string in `SectionNavigationRail.tsx`.

Backlinks: [[index]] | [[security/invariants]] | [[systems/portal-map]]
