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

## 2026-08-09 - Administrative workspace and overview

- Added the route-scoped `AdminWorkspaceShell` and `RouteAwareSiteChrome`, replacing public chrome inside `/services/admin/**` with responsive/collapsible officer navigation, loading/error boundaries, and shared page, grid, panel, notice, and inspector primitives across all administrative modules.
- Added the protected `/api/admin/overview` aggregate for six module queue/source-health summaries. It preserves current Neon-versus-Sheets boundaries, requires an effective officer role, rate limits and marks responses `no-store`, redacts failures, and degrades individual provider errors to `unavailable` without record content.
- Updated [[systems/portal-map]], [[security/invariants]], and [[tests/verification-map]] with the new workspace and overview boundaries. TypeScript, lint (only the existing `app/hub/page.tsx` navigation warnings), diff checks, security/accessibility, and focused admin/module tests passed; unauthenticated browser redirect passed. The 180-second build attempt timed out while an existing dev process was active, with no build error surfaced.

## 2026-08-09 - Admin content workspace and public-content boundary

- Added the versioned public-content workspace for directory, news, hub-guide, and quick-link records, with additive Neon draft/revision tables, strict payload validation, explicit publish/version-conflict handling, immutable history, and staged directory-logo assets that remain private until publication. Added the linked Classroom surface and centralized `adminSurfaceRegistry`.
- Added protected draft, publish, history, logo-staging, and Facebook news-sync routes with active database-officer, same-origin, rate-limit, no-store, redacted logging, and audit boundaries. Public source switches remain Sheets by default with explicit database/fallback modes; `db:compare:public-content` is aggregate-only and read-only.
- Updated [[systems/portal-map]], [[systems/database-map]], [[security/invariants]], and [[tests/verification-map]]. TypeScript, lint, security, focused admin-content/overlay contracts, accessibility pipeline, and unauthenticated browser redirect passed. The build timed out while existing dev processes were active, with no surfaced build error.

## 2026-08-09 - Moderation queue scroll containment

- Bounded the inner record queues in grievances, proposals, community routes, and lost-and-found with responsive viewport caps and `overscroll-contain`, keeping long lists inside the admin workspace while preserving inspector/mobile detail behavior.
- TypeScript, lint (only the two pre-existing `app/hub/page.tsx` warnings), targeted ESLint, accessibility pipeline, and diff checks passed. The change is presentation-only; data, authorization, and mutation contracts are unchanged.

## 2026-08-09 - Admin inspector drawer migration

- Converted grievances, proposals, community routes, lost-and-found, access management, and directory record inspectors to the shared `AdminInspector mode="drawer"`. Queues and data grids are full-width with bounded inner scrolling; desktop uses right-side drawers and mobile uses full-screen sheets.
- Extended the overlay contract to cover all six surfaces and the shared data-grid viewport cap. `test:admin-overlay-contract`, accessibility, TypeScript, security, lint (only the two pre-existing `app/hub/page.tsx` warnings), and diff checks passed.

## 2026-08-09 - Admin access guard delegation fix

- Routed `/api/admin/access` GET/PATCH through the shared `requireActiveDatabaseOfficer()` guard so explicitly enabled local simulated officers work in development while non-simulated requests still require an active Neon `officer` record. The simulation is gated by non-production `NODE_ENV`, `ENABLE_LOCAL_LOGIN_SIMULATION=true`, `session.user.isDevSim=true`, and `role='officer'`, and returns only a synthetic actor.
- Updated the access-control contract to assert shared-guard delegation and repository-side Neon officer enforcement. Focused access/cache/origin/rate-limit checks, `npm run test:security`, TypeScript, lint (only the two pre-existing `app/hub/page.tsx` warnings), and diff checks passed.

## 2026-08-09 - Performance and resilience remediation

- Added Node 24/npm 11.9 runtime alignment, a slow-mobile performance harness with median-of-three cold runs, mobile Lighthouse routing, and a non-blocking preview audit path until two stable preview runs establish the release gate.
- Reworked public media and browser payloads: responsive optimized LCP/logo assets, immutable/static cache policy, route-scoped MapLibre CSS, CSS navigation/modal transitions, server-rendered initial public data, bounded public repository caches, parallel provider reads with three-second timeouts, session projection reuse, Sentry instrumentation without client tracing/replay, and route/recovery boundaries.
- Added classified retry/offline UX and tab-scoped two-hour form drafts that exclude identity, tracking, and attachment data. Added the `SubmissionAttempt` Prisma ledger, hashed idempotency contract, deterministic recovery-token derivation, and durable Lost & Found replay/in-progress/reuse handling. Ticket/proposal source resolution remains fail-closed for `db` until operational import blockers and the complete vertical-slice cutover are resolved.
- Verification passed `db:generate`, Prisma validation with a placeholder direct URL, TypeScript, lint (only two pre-existing Hub navigation warnings), `npm run test:security`, and production build. Local slow-mobile audit results show initial transfer/JavaScript mostly within working budgets, while Hub LCP/settled transfer and TBT/CLS still miss gates; no live provider/DB preflight, migration, deployment, or preview promotion was performed.

## 2026-08-09 - Public shell and performance checkpoint

- Moved public shell selection into `RouteAwareSiteChrome`: `/services/admin/**` omits public header, rail, footer, announcements, and page transitions while public routes retain the existing transition boundary. `app/layout.js` resolves configuration, session, and CSP headers in parallel; `Footer` is server-rendered and receives only the login boolean needed for its action links.
- The clean production Home slow-mobile median of three cold runs measured CLS `0`, approximately `292.6 KB` transfer, approximately `167.4 KB` initial compressed JavaScript, LCP `3.524 s`, and TBT `1.807 s`. Transfer/CLS/initial-JavaScript pass this sample, but LCP and TBT remain open release gates. Controlled `/hub` browser smoke found no iframe before preview and confirmed mobile-menu `aria-expanded` toggling.
- `npm run build`, `npx tsc --noEmit`, `npm run lint` (only two existing HubClient `window.location` warnings), `npm run test:security`, and submission/admin contracts passed. No live DB/provider/deployment action was performed.

## 2026-08-09 - Directory public-read cache

- Wrapped the shared public directory resolver in `app/api/directory/route.ts` with a one-hour `unstable_cache` entry tagged `PUBLIC_CACHE_TAGS.directory`, so server-rendered directory pages and the API reuse one bounded provider read while retaining existing organizations/offices response shapes.
- Verification after the patch passed TypeScript, lint (the same two existing HubClient `window.location` warnings), `npm run test:security`, and production build. A controlled four-route audit observed directory warm TTFB around `103 ms`; no live DB/provider/deployment action was performed.

## 2026-08-10 - Branded loading-state remediation

- Added the shared `PortalLoading` variant surface and route loading boundaries for page, Hub, directory/data, services, grievance, and admin routes. The dark branded skeleton geometry matches each route's expected layout, remains responsive, and disables shimmer for reduced motion/data preferences.
- Updated existing `.skeleton` styling so light surfaces use neutral placeholders while dark portal surfaces use navy/gold tones, preventing white flashes during News/About and route-panel loading. Delayed production navigation smoke showed the branded dark Hub shell at desktop and mobile with a clean transition.
- Verification passed `npx tsc --noEmit`, `npm run lint` (only the two existing HubClient warnings), `npm run audit:a11y` across seven routes and two viewports, and production build before the final CSS-only shimmer rerun. No external/live actions were performed; the final post-adjustment build remains the only pending confirmation.

## 2026-08-10 - Release-gate audit hardening and Hub payload split

- Hardened `scripts/audit-performance.mjs` to self-start a direct production server on a free loopback port, report `serverMode`, reject development resources, and clean up owned child processes. Updated Lighthouse CI to explicit mobile screen emulation. The local four-route audit used port `61796`, found no dev resources, and kept menu interaction under `200 ms`.
- Deferred Hub overlay/lightbox controls and announcement popup code from the initial client path. `RouteAwareSiteChrome` now avoids the client `PageTransition` boundary, while preserving the static transition shell for public routes. The Home hero uses the optimized image at quality 70; Hub uses `BONI_AVE.jpg`, and the obsolete SVG has no references.
- Verification passed TypeScript, lint (only two existing HubClient `window.location.href` warnings), production build, `npm run audit:a11y` (seven routes x two viewports), `test-accessibility-audit-pipeline`, `test-hub-guides-pdf-gating`, and `test-package-script-targets`. Audit LCP/CLS/transfer/initial-JavaScript budgets passed, but TBT medians remained high (Home `1254 ms`, Hub `757 ms`, directory `1106 ms`, grievance `853 ms`). Lighthouse collection reached Chrome cleanup but ended with Windows `EPERM`; no live DB/provider/deployment actions were performed.

## 2026-08-10 - Session narrowing, Hub masthead, and directory hydration

- Narrowed the root auth/session boundary: `app/layout.js` resolves config, session, and CSP headers in parallel, passes the approved session projection to `NavbarClient`, and leaves `AuthProvider` to the `/hub`, `/services`, and `/transparency` layouts that actually use `useSession()`. `NavbarClient` lazy-loads `signOut`; server authorization and CSP nonce boundaries remain unchanged.
- Converted the Hub masthead to prioritized `next/image` for `BONI_AVE.jpg` at quality 70 with explicit `sizes` and `center 46%` crop positioning while retaining the CSS overlay. Student-organization pages now consume server `initialData` and use a native fallback fetch instead of SWR.
- Verification passed build, TypeScript, lint (only existing HubClient `window.location` warnings), security, focused accessibility/Hub/package tests, seven-route/two-viewport `audit:a11y`, and Playwright image/menu checks. Full-route performance budgets passed for LCP, CLS, transfer, initial JavaScript, and menu interaction; TBT remained above gate at Home `655 ms`, Hub `515 ms`, directory `584 ms`, and grievance `504 ms`. Lighthouse still ends with Windows Chrome cleanup `EPERM`/taskkill access denied; no live DB/provider/deployment actions were performed.

## 2026-08-11 - Direct Lighthouse release-gate closeout

- Refined `audit:performance` to report `observedLongTaskBlockingMs` over a three-second diagnostic window without treating the browser-side proxy as release TBT. Added `audit:lighthouse`, which self-starts a production server on a free loopback port, runs three mobile Lighthouse samples per route with median TBT/LCP/CLS aggregation, records long-task URLs and dev-resource detections, and uses Windows-safe temporary Chrome profiles/cleanup. `AUDIT_ENFORCE=0` remains advisory in CI until preview stability is established.
- Corrected four-route Lighthouse medians passed the numeric gates with empty dev-resource sets: Home `124 ms` TBT / `2.974 s` LCP, Hub `98 ms` / `3.202 s`, directory `101 ms` / `2.986 s`, grievance `127 ms` / `2.792 s`; CLS was `0` across routes. The custom audit passed its budgets.
- `node --check` for audit scripts/config, `npm run test:readiness`, security, TypeScript, lint (two existing HubClient warnings), build, and seven-route/two-viewport accessibility checks passed. Production `npm audit` found no High/Critical vulnerabilities and nine existing Low/Moderate advisories. Two provider preview runs remain required before flipping `AUDIT_ENFORCE=1`; no live DB/provider/deployment actions were performed.
