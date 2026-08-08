---
canonical: false
last_verified: 2026-08-06
confidence: medium
source_files:
  - README.md
  - package.json
  - prisma/schema.prisma
  - docs/database/neon-prisma-migration.md
  - app/
  - lib/
  - docs/security/auth-baseline-map.md
  - app/services/admin/page.tsx
  - app/services/admin/users/page.tsx
  - app/api/admin/access/route.ts
  - lib/admin-access.ts
  - lib/auth.ts
  - lib/audit.ts
  - docs/database/neon-prisma-migration.md
  - docs/security/session-policy.md
  - tests/test-admin-access-controls.js
  - tests/test-admin-hub-backend-only-controls.js
  - docs/launch/production-verification-runbook.md
  - app/hub/lost-found/page.tsx
  - app/api/hub/lost-found/
  - app/api/admin/lost-found/
  - app/services/admin/lost-found/page.tsx
  - lib/lost-found.ts
  - tests/test-lost-found-boundaries.js
  - app/services/admin/directory/page.tsx
  - app/api/admin/directory/
  - app/api/cron/directory-export/route.ts
  - components/DirectoryCorrectionGuidance.tsx
  - tests/test-directory-management-contract.js
---

# Portal Map

The RTU OSR portal is a Next.js App Router application for student-facing information, services, leadership workflows, and selected administrative operations.

## Product Areas

- Public information: home, services, news, transparency, directories, hubs, and related public content.
- Lost and found: public CSO and student-report lanes at `/hub/lost-found`, with student submissions held for review and officer moderation at `/services/admin/lost-found`.
- Student leader access: login and role-based features for student-leader workflows.
- Forms and tickets: student submissions, grievance-related flows, status updates, comments, appeals, notifications, and privacy boundaries.
- Content and integrations: Google Sheets-backed content during migration, Neon Postgres-backed operational data target, Google Classroom leader-report workflows, Google Drive-related flows, email, Sentry, and maps.
- Administration: protected administrative routes, the Neon-backed officer access and directory-logo consoles, and queue-driven notification processing.

## Working Locations

- `app/`: App Router pages, route handlers, and server-side route behavior.
- `lib/`: integrations, policy helpers, validation, data transformations, and shared behavior.
- `prisma/`: Neon Postgres schema, migrations, and database role examples.
- `components/`: reusable UI and feature surfaces.
- `tests/`: focused regression scripts. Start from [[tests/verification-map]].
- `docs/`: canonical project documentation; begin from [[index]].

## Architecture Notes

- The application uses Next.js 16, React 19, Tailwind 4, and TypeScript.
- Content is often sheet-driven today. New operational data work should target Neon Postgres + Prisma and preserve route response compatibility during cutover.
- Google Sheets exports must use sanitized `public_sheet_*` views and must not mirror private grievance/proposal payloads.
- Directory APIs are intentionally separated for student organizations and university offices; the legacy merged route remains for backwards compatibility.
- Ticket and proposal notification automation uses protected routes and scheduled processing. Consult [[security/invariants]] and the source route/tests before changing it.
- Officer access management is exposed at `/services/admin/users` and enforced by `/api/admin/access`; only an active Neon officer can grant, change, or revoke leader/officer records.
- Lost and found is a Neon-native vertical slice. CSO bulletins are manually entered by active Neon officers until a stable CSO feed contract exists; student reports remain pending until moderated. Public data and media are exposed through item-scoped projections and proxies.
- Directory logos are managed at `/services/admin/directory` by active Neon officers, stored in the restricted organization-logo Drive folder, and mirrored through the sanitized `Directory Export` Sheet tab. Public student-organization correction guidance is a configured informational `mailto:` link with no report workflow.

## Boundaries To Confirm Per Task

- Authentication and role authorization: canonical docs plus route-level behavior.
- Data source contract: Prisma schema or sheet schema, validation, route mapping, and UI consumer.
- External integration: environment contract, error behavior, retry/queue behavior, and sensitive logging posture.
- Public UI change: `docs/design/design-system-v1.md` before editing.

Backlinks: [[index]] | [[systems/database-map]] | [[security/invariants]] | [[tests/verification-map]]
