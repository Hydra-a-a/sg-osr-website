---
canonical: false
last_verified: 2026-08-11
confidence: medium
source_files:
  - README.md
  - package.json
  - prisma/schema.prisma
  - docs/database/neon-prisma-migration.md
  - app/
  - lib/
  - docs/security/auth-baseline-map.md
  - app/layout.js
  - app/page.tsx
  - app/directory/student-organizations/page.tsx
  - app/directory/university-offices/page.tsx
  - app/api/directory/route.ts
  - app/hub/page.tsx
  - app/hub/layout.tsx
  - app/services/grievance/page.tsx
  - app/services/layout.tsx
  - app/transparency/layout.tsx
  - app/loading.tsx
  - app/hub/loading.tsx
  - app/directory/loading.tsx
  - app/directory/student-organizations/loading.tsx
  - app/directory/university-offices/loading.tsx
  - app/services/loading.tsx
  - app/services/grievance/loading.tsx
  - app/services/admin/loading.tsx
  - app/error.tsx
  - app/global-error.tsx
  - app/globals.css
  - components/PortalLoading.tsx
  - components/Hero.tsx
  - components/NavbarClient.tsx
  - components/Footer.tsx
  - components/PageTransition.tsx
  - components/directory/StudentOrganizationsClient.tsx
  - components/NetworkStatusBanner.tsx
  - components/RouteErrorState.tsx
  - components/directory/
  - components/hub/HubClient.tsx
  - components/hub/HubOverlays.tsx
  - components/DeferredAnnouncementPopup.tsx
  - lib/public-cache.ts
  - lib/client-error.ts
  - lib/draft-storage.ts
  - scripts/audit-performance.mjs
  - scripts/audit-lighthouse.mjs
  - lighthouserc.cjs
  - next.config.mjs
  - public/images/BONI_AVE.jpg
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
  - app/services/admin/grievances/page.tsx
  - app/services/admin/proposals/page.tsx
  - app/services/admin/routes/page.tsx
  - app/services/admin/layout.tsx
  - app/services/admin/loading.tsx
  - app/services/admin/error.tsx
  - app/services/admin/content/page.tsx
  - app/services/admin/classroom/page.tsx
  - app/api/admin/overview/route.ts
  - app/api/admin/content/
  - app/api/admin/news/sync/route.ts
  - app/api/admin/directory/
  - app/api/cron/directory-export/route.ts
  - components/DirectoryCorrectionGuidance.tsx
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
  - lib/admin-overview.ts
  - lib/admin-overview-types.ts
  - lib/admin-content.ts
  - lib/admin-surface-registry.ts
  - lib/public-content-source.ts
  - lib/directory-logo-manager.ts
  - prisma/schema.prisma
  - prisma/migrations/20260809000000_admin_content_workspace/migration.sql
  - scripts/compare-public-content.mjs
  - tests/test-directory-management-contract.js
  - tests/test-admin-overview-contract.js
  - tests/test-admin-content-contract.js
  - tests/test-admin-overlay-contract.js
  - tests/test-admin-hub-backend-only-controls.js
  - tests/test-commute-community-routes.js
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
- The `/services/admin/**` route group uses `AdminWorkspaceShell` plus `RouteAwareSiteChrome` to replace public header, navigation rail, footer, and announcement chrome with a responsive/collapsible officer workspace. Route-level loading and error boundaries and shared `AdminPageShell`, full-width `AdminDataGrid`, and `AdminInspector` primitives keep module pages consistent without changing their data or mutation contracts.
- The operations overview reads the protected `/api/admin/overview` aggregation. It reports queue totals and source health for six modules across current Neon-backed access/directory/lost-and-found data and Sheets-backed grievances/proposals/community routes; provider failures degrade to `unavailable` summaries rather than exposing record content. The route enforces effective officer authorization, rate limiting, `Cache-Control: no-store`, and redacted error handling.
- `adminSurfaceRegistry` is the navigation and ownership map for moderation, access, content, and linked Classroom surfaces. `/services/admin/content` manages the public directory, news, hub-guide, and quick-link collections through one grid with draft, sanitized preview, explicit publish, immutable history, and version-conflict handling; `/services/admin/classroom` links protected Google Classroom controls to the public transparency surface.
- Shared admin controls include focus-managed drawers/modals, keyboard-accessible action menus and tabs, disclosures, toast feedback, and unsaved-change browser-exit guards. Record inspectors in grievances, proposals, community routes, lost-and-found, access management, and directory use `AdminInspector mode="drawer"` with desktop right-side drawers and mobile full-screen sheets; `AdminOverlay` owns focus restoration, Escape handling, and body-scroll locking. Directory logo replacements are staged as private draft assets and become public only when the directory draft is published.
- Grievance, proposal, community-route, lost-and-found, access-management, and directory queues/grids are full-width with bounded inner scrolling, responsive viewport caps, and overscroll containment, so long record lists stay inside the workspace while the active record opens in its inspector drawer.
- Public news, hub-guide, and quick-link APIs use explicit `*_SOURCE` switches (`sheet` by default, with database and database-with-Sheets-fallback modes) through `lib/public-content-source.ts`; DB loaders preserve public-safe URL/guide filtering and existing response shapes during cutover.
- Public routes preserve request-time rendering where CSP nonces require `headers()`, while repository reads use bounded `unstable_cache` windows and explicit public cache tags. Home, directory, Hub, and grievance surfaces now server-render their initial public data where practical; narrow client islands retain filtering, modal, and retry behavior without hydration-time waterfalls.
- The public directory resolver is shared by the directory pages and API: `app/api/directory/route.ts` wraps the Sheets/DB resolution in a one-hour `unstable_cache` entry tagged `PUBLIC_CACHE_TAGS.directory`, reducing repeated provider reads while preserving the organizations/offices response shapes.
- `app/layout.js` resolves site configuration, the Auth.js session, and CSP request headers in parallel. It passes the server session to `NavbarClient`, gives the server-rendered `Footer` only the login boolean it needs, and uses `RouteAwareSiteChrome` to omit public chrome inside `/services/admin/**` without loading a client-side `PageTransition` boundary; public routes retain only the static transition shell class.
- `AuthProvider` is scoped to the `/hub`, `/services`, and `/transparency` layouts where `useSession()` consumers exist, rather than wrapping the entire root. `NavbarClient` receives its approved server session projection and lazy-loads `signOut`, keeping global browser auth payload narrower while preserving server authorization boundaries.
- Public media uses responsive `next/image` elements and same-origin Drive proxies, with immutable caching limited to versioned/static assets and immutable Drive IDs. MapLibre CSS is route-scoped to commute, and navigation/alert/modal motion uses CSS transitions with reduced-motion coverage rather than a global Framer Motion dependency.
- The Hub masthead uses prioritized `next/image` for `/images/BONI_AVE.jpg` at quality 70 with explicit sizing and `object-position: center 46%`; the CSS overlay remains separate from the image, and the former raw CSS JPEG background is removed. Directory student-organization hydration uses server `initialData` with a native fallback fetch instead of SWR.
- The Hub's overlay/lightbox controls are dynamically loaded from `components/hub/HubOverlays.tsx`, keeping that interaction bundle off the initial Hub client path. `DeferredAnnouncementPopup` idle-loads announcements only on eligible routes and skips Home, OSR, and Hub initial paths. The Home hero is an optimized WebP LCP image at quality 70; Hub uses the extracted `BONI_AVE.jpg`, with no remaining SVG references.
- Runtime recovery includes public loading/error boundaries, route-specific directory/Hub/form fallbacks, an online-status island, classified retry messaging, and two-hour tab-scoped draft persistence that excludes identity, tracking, and attachment data. No service worker or offline application shell is part of this boundary.
- `PortalLoading` centralizes route-aware page, Hub, directory/data, services, grievance, and admin skeletons. The loading shell preserves the portal's dark branded geometry and responsive layout while loading; shimmer is disabled for reduced motion/data, and the existing generic `.skeleton` treatment is neutral on light surfaces and navy/gold on dark portal panels to avoid white placeholder flashes.
- `scripts/audit-performance.mjs` exercises representative public routes under slow-mobile emulation and reports the median of three cold runs (with warm TTFB and menu interaction); initial compressed JavaScript/transfer are tracked separately from settled lazy assets so preview gates remain reproducible.
- The performance harness self-starts a direct production server on a free loopback port when no external base URL is supplied, reports `serverMode`, rejects dev-only resources in self-started mode, and cleans up owned child processes. Lighthouse uses explicit mobile screen emulation rather than the unsupported preset form.
- `audit:performance` records `observedLongTaskBlockingMs` over an explicit three-second diagnostic window and does not promote that proxy to the release TBT gate. `audit:lighthouse` owns the direct three-run mobile TBT/LCP/CLS medians, raw long-task URL evidence, dev-resource detection, and advisory-versus-enforced behavior.

## Boundaries To Confirm Per Task

- Authentication and role authorization: canonical docs plus route-level behavior.
- Data source contract: Prisma schema or sheet schema, validation, route mapping, and UI consumer.
- External integration: environment contract, error behavior, retry/queue behavior, and sensitive logging posture.
- Public UI change: `docs/design/design-system-v1.md` before editing.

Backlinks: [[index]] | [[systems/database-map]] | [[security/invariants]] | [[tests/verification-map]]
