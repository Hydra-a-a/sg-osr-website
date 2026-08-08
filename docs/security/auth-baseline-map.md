# Auth Baseline Map

Last reviewed: 2026-08-08

## Executive Summary

This baseline map classifies the current auth, role, ownership, cache, and abuse-control surfaces before deeper hardening work. It exists to keep future fixes targeted: the app has a mix of public content APIs, authenticated student actions, role-gated officer/leader controls, token-access tracking endpoints, queue processors, and webhook ingestion.

The plan is worth executing. Confidence is high because `proxy.ts` intentionally lets `/api/**` pass through, which means API route handlers are the real security boundary for data access and mutations.

The app now has a Neon Postgres + Prisma migration foundation. Until individual routes are cut over, Google Sheets remains the active runtime source for existing workflows. During and after cutover, server route handlers remain the primary authorization boundary; database roles, constraints, and sanitized export views are defense in depth.

Auth access now has an opt-in DB repository path. `AUTH_ACCESS_SOURCE=sheets` preserves current behavior; `db-with-sheets-fallback` is the first cutover mode; `db` is for after importer verification.

## Confidence Checklist

| Question | Current read | Confidence | Next action |
| --- | --- | ---: | --- |
| Is a baseline map useful? | Yes. There are many route types and API routes are not protected by proxy-level auth. | 9/10 | Keep this document current as routes change. |
| Is anonymous access blocked everywhere it should be? | Mostly, but this needs route-by-route verification because `/api/**` is handler-owned. | 8/10 | Convert sensitive unauthenticated cases into tests. |
| Can portal mode escalate privilege? | The helper is downgrade-only by design. | 7/10 | Add behavioral tests around student, leader, and officer cookies. |
| Is object ownership enforced? | Ticket and proposal detail/comment routes have owner email or tracking-token logic. | 8/10 | Add runtime-style tests for cross-owner access denial. |
| Is session behavior defined? | JWT-only is accepted for now with documented residual risk; role source is cached for 5 minutes. | 9/10 | See `docs/security/session-policy.md`; add revocation before high-risk admin workflows. |
| Are state-changing cookie-auth routes CSRF/origin protected? | Shared same-origin guard is applied to the main browser-authenticated POST/PATCH routes. | 8/10 | Add behavioral tests and consider token CSRF if cross-origin integrations are introduced. |
| Are sensitive responses cache isolated? | Sensitive APIs are pinned to `Cache-Control: no-store`; public content/asset endpoints keep explicit public cache or ISR policy. | 8/10 | Keep `tests/test-sensitive-api-cache-policy.js` updated as routes are added. |
| Are OAuth tokens isolated from browser sessions? | The browser-visible Auth.js session is token-free. Classroom route handlers use the separate server-only `authWithGoogleToken()` projection, while the JWT retains access/refresh claims for server refresh and Google API calls. | 9/10 | Keep `tests/test-session-token-boundary.js` aligned with any Auth.js or Classroom changes. |
| Are redirects origin-safe? | Login, proxy, and NextAuth callback redirects are constrained to same-site relative paths or same-origin absolute URLs. | 8/10 | Keep `tests/test-auth-redirect-safety.js` updated if auth flow changes. |
| Are abuse-prone endpoints throttled? | Auth callback POSTs, public submissions, lookups, automation endpoints, commute route tools, and telemetry have app-level rate-limit coverage. | 8/10 | Keep `tests/test-rate-limit-coverage.js` aligned with new public write/lookup routes. |
| Are auth failures generic? | Mostly via `ApiError`; debug diagnostics needed gating. | 8/10 | Keep diagnostics dev-only and avoid returning sheet internals. |

## Global Auth Boundary

| Surface | Current behavior | Evidence | Confidence | Follow-up |
| --- | --- | --- | ---: | --- |
| `proxy.ts` protected pages | Public pages are allowlisted; `/services/proposals` requires leader mode; `/services/admin` requires officer mode. | `leaderOnlyRoutes`, `officerOnlyRoutes`, `deriveEffectivePortalRole` | 8/10 | Expand page-route tests for student/leader/officer behavior. |
| `proxy.ts` API handling | `/api/**` routes pass through proxy and must enforce auth internally. | `normalizedPathname.startsWith('/api/')` | 9/10 | Treat every API route as independently security-reviewed. |
| NextAuth callbacks | Sign-in enforces `@rtu.edu.ph`; redirects allow relative or same-origin only; public sessions project role/profile fields without OAuth tokens. | `signIn`, `redirect`, `applySessionFields` callbacks | 9/10 | Keep the token-boundary test aligned if auth flow changes. |
| JWT session | `strategy: 'jwt'`, `maxAge: 8 hours`; role is refreshed by JWT callback and sheet cache. | `auth.config.ts`, `auth.ts`, `docs/security/session-policy.md` | 9/10 | JWT-only accepted for now; server-side revocation required for immediate lockout workflows. |
| Portal mode | Cookie-selected mode can downgrade but not upgrade actual role. | `deriveEffectivePortalRole` | 7/10 | Add behavior-focused tests beyond source checks. |

## API Route Matrix

| Route | Methods | Classification | Required control | Cache posture | Abuse control | Confidence | Notes |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| `/api/auth/[...nextauth]` | GET, POST | Auth platform | NextAuth; callback POST rate limit | Framework-owned | IP rate limit on callback | 7/10 | Keep callback-url same-origin behavior. |
| `/api/debug-auth` | GET | Dev diagnostics | Disabled unless explicit dev flag | no-store | none | 9/10 | Must never expose sheet diagnostics publicly. |
| `/api/admin/tickets` | GET, PATCH | Officer-gated | Auth + officer portal mode + same-origin PATCH | no-store | rate limit | 9/10 | PATCH also validates attachment type/size. |
| `/api/admin/proposals` | GET, PATCH | Leader/officer-gated | Auth + leader/officer portal mode + same-origin PATCH | no-store | rate limit | 9/10 | PATCH uses row number; keep role gate and validation tight. |
| `/api/admin/routes` | GET, PATCH | Officer-gated | Auth + officer portal mode + same-origin PATCH | no-store | rate limit | 9/10 | PATCH mutates commute moderation. |
| `/api/admin/access` | GET, PATCH | Neon officer-gated | Auth + active Neon officer record + same-origin PATCH + Zod | no-store | rate limit | 9/10 | Access grants/revocations update `AuthorizedUser` transactionally and increment `sessionVersion`. |
| `/api/admin/directory` | GET, POST, DELETE | Neon officer-gated | Auth + active Neon officer record + same-origin mutations + Zod | no-store | rate limit | 9/10 | Raster logo uploads are signature-checked, folder-scoped, and compensated if the Neon transaction fails. |
| `/api/admin/directory/export` | POST | Neon officer-gated | Auth + active Neon officer record + same-origin + sanitized view exporter | no-store | rate limit | 9/10 | Publishes only the normalized `Directory Export` tab. |
| `/api/tickets` | POST | Authenticated student action | Auth + RTU email + same-origin POST | no-store | rate limit + validation | 9/10 | Grievance creation. |
| `/api/tickets/mine` | GET | Object-owned | Auth + owner email | no-store | rate limit | 8/10 | User-specific list. |
| `/api/tickets/[id]` | GET | Owner or tracking-token detail | Owner email or access token; redacted fallback | no-store | rate limit | 8/10 | Public route by design for anonymous tracking. |
| `/api/tickets/[id]/comments` | GET, POST | Owner/tracking-token or leader/officer | Owner token/email or privileged portal mode + same-origin POST | no-store | rate limit + validation | 9/10 | POST mutates discussion and uploads attachments. |
| `/api/tickets/queue/enqueue` | POST | Secret-gated automation | Shared secret or bearer token | no-store | rate limit | 8/10 | Intended for Apps Script/automation. |
| `/api/tickets/queue/process` | GET, POST | Secret-gated automation | Shared secret or bearer token | no-store | rate limit | 8/10 | Cron-compatible GET is intentional. |
| `/api/tickets/sync-updates` | GET, POST | Secret-gated automation | Shared secret or bearer token | no-store | rate limit | 8/10 | Verify secret coverage stays aligned with queue processors. |
| `/api/proposals` | GET, POST | Leader/officer-owned | Auth + leader/officer portal mode + same-origin POST | no-store | rate limit + validation | 9/10 | Lists/creates submitter proposals. |
| `/api/proposals/[id]` | GET | Owner/tracking-token or officer | Owner email, access token, or privileged role | no-store | rate limit | 8/10 | Object lookup looks intentionally scoped. |
| `/api/proposals/[id]/comments` | GET, POST | Owner/tracking-token or officer | Owner email, access token, privileged role, same-origin POST | no-store | rate limit + validation | 9/10 | POST mutates discussion. |
| `/api/proposals/queue/process` | GET, POST | Secret-gated automation | Shared secret or bearer token | no-store | rate limit | 8/10 | Cron-compatible GET is intentional. |
| `/api/forms` | POST | Authenticated student action | Auth + RTU email + origin check | no-store | rate limit + bot checks | 9/10 | Good model for origin checking other cookie-auth mutations. |
| `/api/classroom/courses` | GET | Leader-gated Google data | Auth + leader portal mode + server-only `authWithGoogleToken()` Google token | no-store | rate limit | 9/10 | Browser sessions do not receive the OAuth token. |
| `/api/classroom/courses/[courseId]/coursework` | GET | Leader-gated Google data | Auth + leader portal mode + server-only `authWithGoogleToken()` Google token | no-store | rate limit | 9/10 | Course ID should remain validated/controlled by Classroom API use. |
| `/api/classroom/submissions` | POST | Leader-gated Google data | Auth + leader portal mode + server-only `authWithGoogleToken()` Google token + same-origin POST | no-store | rate limit + validation | 9/10 | Classroom mutation guarded; token never enters the client session. |
| `/api/hub/commute` | POST | Public utility lookup | Public input validation | dynamic | rate limit | 7/10 | Does not mutate user-owned data. |
| `/api/hub/commute/submit` | POST | Authenticated contribution | Auth + validation + same-origin POST | no-store | rate limit | 9/10 | Browser-authenticated contribution guarded. |
| `/api/hub/commute/issue` | POST | Authenticated report | Auth + validation + same-origin POST | no-store | rate limit | 9/10 | Browser-authenticated issue report guarded. |
| `/api/hub/commute/vote` | POST | Authenticated vote | Auth + validation + same-origin POST | no-store | rate limit | 9/10 | Browser-authenticated vote guarded. |
| `/api/hub/commute/leaderboard` | GET | Public aggregate | Public | no-store | rate limit | 7/10 | Public aggregate; no user-specific cache expected. |
| `/api/hub/guides` | GET | Public curated data | Public PDF/link validation | dynamic | rate limit | 7/10 | Public. Debug mode should remain dev-only. |
| `/api/hub/guides/preview/[fileId]` | GET | Public file preview | File ID/resource key validation | public short cache | rate limit | 7/10 | Confirm only intended PDF previews are served. |
| `/api/webhooks/make` | POST | External webhook | HMAC + timestamp + replay cache | no-store | rate limit + validation | 9/10 | Signed automation endpoint with explicit response cache isolation. |
| `/api/news/sync` | GET, POST | Secret-gated automation | Shared secret or bearer token | no-store | rate limit | 8/10 | Syncs public news content. |
| `/api/cron/directory-export` | GET, POST | Secret-gated automation | `CRON_SECRET` bearer/header + `SHEETS_EXPORT_ENABLED` | no-store | rate limit | 9/10 | Retry-safe sanitized directory export scheduled by Vercel Cron. |
| `/api/news` | GET | Public content | Public | public cache | rate limit | 8/10 | Public data cache is appropriate. |
| `/api/announcements` | GET | Public content | Public | public cache | none | 7/10 | Public announcement feed. |
| `/api/directory` | GET | Public directory | Public | ISR/public-ish | rate limit | 7/10 | Public data. |
| `/api/directory/offices` | GET | Public directory | Public | ISR | none | 6/10 | Public data; add rate limiting if abused. |
| `/api/directory/student-organizations` | GET | Public directory | Public | ISR | none | 6/10 | Public data; add rate limiting if abused. |
| `/api/directory/logos/[fileId]` | GET | Public image proxy | File ID/resource key validation | public CDN cache | rate limit | 7/10 | Public asset cache is intended. |
| `/api/config/links` | GET | Public configuration | Public sanitized links | ISR | rate limit | 7/10 | Ensure values remain non-secret. |
| `/api/telemetry` | POST | Public low-sensitivity telemetry | Public | no-store | IP rate limit | 7/10 | Stays non-sensitive; throttled to limit noisy clients. |

## Data Surface Map

| Data surface | Owner/sensitivity | Primary routes | Current control | Confidence | Follow-up |
| --- | --- | --- | --- | ---: | --- |
| Auth access source | Privileged role source | Auth callbacks, access console, debug diagnostics | Server-only source access; Sheets default; DB opt-in with 5-minute cache | 9/10 | Access grants use Neon directly; set `AUTH_ACCESS_SOURCE` before relying on new grants. |
| Neon Postgres | Target private/operational system of record | Future auth roles, tickets, proposals, queues, commute, public content | Server-only Prisma access; pooled runtime URL; direct migration URL | 8/10 | Cut over by domain behind existing route-level auth and ownership tests. |
| Tickets sheet | Student-owned grievances | `/api/tickets/**`, `/api/admin/tickets` | Owner email/tracking token/officer role | 8/10 | Add runtime ownership denial tests. |
| Ticket comments/appeals sheet | Student-owned discussion | `/api/tickets/[id]/comments` | Owner token/email, privileged role, same-origin POST | 9/10 | Add runtime ownership denial tests. |
| Proposal sheet | Leader-owned proposals | `/api/proposals/**`, `/api/admin/proposals` | Submitter email/tracking token/officer role | 8/10 | Add runtime ownership denial tests. |
| Proposal comments sheet | Leader-owned discussion | `/api/proposals/[id]/comments` | Submitter/tracking token/officer role, same-origin POST | 9/10 | Add runtime ownership denial tests. |
| Classroom API | Google user-scoped education data | `/api/classroom/**` | Auth + leader mode + OAuth access token | 8/10 | Confirm least-privilege OAuth scopes remain necessary. |
| Commute contribution sheets | Public-reviewed community data | `/api/hub/commute/**`, `/api/admin/routes` | Auth for mutations, same-origin POST/PATCH, officer moderation | 8/10 | Add behavior tests for moderation access. |
| News/announcement sheets | Public content | `/api/news`, `/api/announcements`, webhook/sync | Public reads, signed automation writes | 8/10 | Ensure webhook/sync secrets remain required. |
| Google Drive attachments/previews | Potentially sensitive files | Ticket/proposal uploads, guide/logo previews | Upload type/size checks, public previews by ID | 7/10 | Verify preview endpoints cannot serve unintended files. |

## Phase 2 Session Policy

Phase 2 is documented in `docs/security/session-policy.md`.

1. JWT-only with an 8-hour max age is accepted for the current portal.
2. The residual risk is explicit: logout is local to the current browser, multi-browser sessions remain valid until expiry, and immediate role removal is not guaranteed without server-side revocation.
3. Server-side revocation or token-version checks are required before high-risk admin workflows, destructive bulk actions, global logout requirements, or incident-response lockout requirements.

## Phase 3 Hardening Candidates

1. Shared same-origin protection has been added for cookie-authenticated browser mutations.
2. Add behavior tests for portal mode downgrade-only enforcement.
3. Add ownership tests that simulate cross-user ticket/proposal access denial.
4. No-store header assertions have been added for sensitive APIs.
5. Redirect safety and rate-limit coverage assertions have been added for auth and abuse-prone public routes.
6. Keep dev diagnostics behind explicit non-production flags.
7. Cut over Google Sheets-backed private workflows to Neon Postgres through server-only repositories, while exporting only sanitized `public_sheet_*` views to Sheets.
