# Changelog

This changelog covers repository changes after the June release line and the current production-release preparation.

## [Unreleased] — 2026-08-08

### Public release and UI

- Added a global, server-rendered alpha closed-testing notice immediately below the site header. It warns about bugs, unfinished features, and unexpected UI breakage and provides the RTU contact mail link.
- Refined the portal shell, navigation rail, landing page, service pages, directory pages, login, grievance tracking, hub, councils, and commissions for responsive behavior, clearer hierarchy, reduced-motion support, and improved narrow-viewport layout.
- Split directory presentation and API behavior into Student Organizations and University Offices while retaining the merged legacy endpoint for compatibility.
- Added directory correction guidance, placeholder icons, the icon registry, and new campus wayfinding assets.
- Added the Lost and Found public hub surface and officer administration surfaces.

### Authentication and security

- Removed OAuth access tokens from browser-visible NextAuth sessions; server-side Google Classroom consumers retain the token boundary.
- Added source-switchable authorized-user loading for Google Sheets, Neon, and Sheets-fallback modes, plus server-side admin access controls and access audit updates.
- Added/expanded same-origin, redirect-safety, local-login, debug-route, CSP, cache-control, API error-envelope, rate-limit, redacted-logging, object-access, and ticket/proposal ownership protections.
- Restricted Classroom coursework metadata and publishing controls by role, and added the corresponding audit action/state handling.
- Hardened Google Drive media access, directory logo access, and upload validation boundaries.
- Added patched email transport wiring and the email-transport regression boundary.

### Neon and Prisma data layer

- Added the Prisma/Neon runtime foundation with pooled runtime access through `DATABASE_URL` and migration/admin access through `DIRECT_URL`.
- Added the Neon schema, role examples, migration wrappers, preflight checks, and migrations for the foundation, Lost and Found, and directory logo management.
- Added read-only Sheets-to-Neon import/parity tooling for auth, directory, operational tickets, proposals, comments, and notification queues.
- Added sanitized public Sheets export tooling and the scheduled directory export route; private student, grievance, proposal, tracking-token, and notification payload fields remain excluded.
- Added operational blocker reporting and verification documentation; production DB writes remain gated on dry-run, parity, and focused verification.

### Lost and Found and directory administration

- Added Neon-backed Lost and Found records, comments, attachments, moderation states, public projections, media proxies, and officer-only administration routes.
- Added protected Drive attachment handling for Lost and Found and protected directory logo upload/replacement/removal flows.
- Added officer-only directory management, logo metadata, export-state tracking, and directory import/export contracts.

### Integrations and scheduled work

- Added proposal queue processing and updated ticket/proposal sync cron configuration in `vercel.json`.
- Expanded Google Sheets/Drive error handling and redacted integration logging.
- Added the production verification runbook and expanded environment documentation for Neon, exports, queue secrets, directory source selection, and Drive folders.

### Dependencies, build, and tooling

- Upgraded Next.js and `eslint-config-next` to 16.3, NextAuth to beta.32, Sentry to 10.69, and React ecosystem dependencies as reflected in the lockfile.
- Replaced the unpatched Nodemailer dependency with the patched npm alias and updated type support.
- Added Prisma/Neon runtime dependencies and removed the unused Gemini CLI development dependency.
- Added dependency overrides for `fast-uri`, `minimatch`, and brace expansion, and switched production builds to the webpack path.
- Expanded package scripts for database lifecycle operations, readiness checks, accessibility audits, security regression coverage, and import/export verification.
- Generate the Prisma Client automatically before every production build so clean Vercel installs include the Prisma runtime and schema enums.

### CI, tests, and maintainer documentation

- Expanded the security-gates workflow with session-token and email-transport regression checks.
- Added regression coverage for authentication, database cutover/import guards, directory separation and management, Lost and Found, operational parsing/parity, ticket/proposal boundaries, CSP, API envelopes, accessibility, navigation, and layout behavior.
- Added synthetic auth fixtures for import/write-guard tests; no local environment files or production payloads are used by the tests.
- Added the maintainer wiki, database/security/launch/design documentation, and the production verification map.
- Added `.gitignore` protection for local agent configuration, internal planning drafts, wiki raw inbox contents, local integration metadata, generated audit output, and environment files.

## 2026-08-02

- `d56f80e` — Adjusted the home operations-list grid layout and updated slug-creation documentation.

## 2026-06-05 — 2026-06-06

These commits comprise the June release line following the May portal-runtime push:

- `9474e72` — Refreshed hub and services styling/layout, responsiveness, accessibility, and Classroom submission behavior.
- `61d73bf` — Standardized Google Classroom error-reason conversion.
- `8733529` — Removed the default title from submitted coursework links.
- `626dc25` — Added the Classroom setup panel, course/coursework APIs, validation schemas, rate-limit handling, and audit wiring.
- `70e6707` — Added coursework PATCH publishing, draft management, and date/time handling.
- `ec1fb9d` — Added coursework pagination, display improvements, and Classroom test scripts.
- `fc2d22e` — Added coursework state typing and the published-coursework audit action.
- `457f557` — Restricted coursework metadata exposure to non-officer roles.
