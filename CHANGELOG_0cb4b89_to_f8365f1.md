# Changelog: 2026-03-14 to 2026-04-02

Baseline commit (last on 2026-03-14): `0cb4b89`  
Latest commit (2026-04-02): `f8365f1`

## Range Summary
- Commit range: `0cb4b89..f8365f1`
- Commits in range: `1`
- Files changed: `56`
- Insertions: `17,669`
- Deletions: `3,659`

## Included Commit
- `f8365f1` (2026-04-02 13:52:08 +0800) by Hydra-a-a  
  `Production release: runtime hardening and deploy cleanup`

## Highlights

### Security and auth hardening
- Strengthened auth flow and session handling across:
  - `lib/auth.config.ts`
  - `lib/auth.ts`
  - `app/api/auth/[...nextauth]/route.ts`
  - `types/next-auth.d.ts`
- Expanded request safety, logging, and API guard behavior in:
  - `lib/security.ts`
  - `lib/audit.ts`
  - `app/api/forms/route.ts`
  - `app/api/webhooks/make/route.ts`

### Classroom feature rollout
- Added full classroom API surface:
  - `app/api/classroom/courses/route.ts`
  - `app/api/classroom/courses/[courseId]/coursework/route.ts`
  - `app/api/classroom/submissions/route.ts`
- Added new classroom domain/service/schema support:
  - `lib/google-classroom.ts`
  - `schemas/classroom.ts`
  - `components/ClassroomSubmissionForm.tsx`

### Directory and content source updates
- Refined directory ingestion/parsing and UI rendering:
  - `app/api/directory/route.ts`
  - `app/directory/page.tsx`
  - `schemas/directory.ts`
- Updated About page and council presentation:
  - `app/about/page.tsx`

### Frontend and UI updates
- Significant page and layout updates across:
  - `app/page.tsx`, `app/hub/page.tsx`, `app/services/page.tsx`, `app/transparency/page.tsx`, `app/osr/page.tsx`, `app/news/page.tsx`, `app/login/page.tsx`
  - `components/Hero.tsx`, `components/Footer.tsx`, `components/NavbarClient.tsx`, `components/PageTransition.tsx`
  - `app/globals.css`, `app/layout.js`
- Added new council imagery assets in `public/images/`.

### Platform/runtime configuration
- Deployment/build/runtime adjustments in:
  - `next.config.mjs`
  - `proxy.ts`
  - `package.json`
  - `package-lock.json`
  - `tsconfig.json`
  - `sentry.client.config.ts`
  - `sentry.edge.config.ts`
  - `sentry.server.config.ts`
- Repo/deploy hygiene updates:
  - `.gitignore`
  - `.vercelignore`

## Notes
- This range is represented by a single release commit, so all changes above were delivered together in one production push.
