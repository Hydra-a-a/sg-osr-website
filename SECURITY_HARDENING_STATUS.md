# Security Hardening Status (Post-Audit)

Date: 2026-03-13

## ✅ What Was Fixed

### 1) Rate-limit identity hardening
- Replaced direct `x-forwarded-for` usage with centralized client-IP extraction logic.
- Added stricter IP normalization/validation in `lib/security.ts`.
- Updated routes to use `getClientIp(request)`:
  - `app/api/auth/[...nextauth]/route.ts`
  - `app/api/news/route.ts`
  - `app/api/directory/route.ts`
  - `app/api/config/links/route.ts`

### 2) Quick-link URL safety
- Added `isSafeNavigationHref()` in `lib/security.ts`.
- Hardened `QuickLinkSchema` in `schemas/links.ts` to allow only:
  - Safe relative paths (e.g. `/services`)
  - HTTPS absolute URLs
- This closes the gap where arbitrary unvalidated link strings could be rendered.

### 3) CSP / header tightening
- Tightened CSP directives in `next.config.mjs`:
  - Added `frame-ancestors 'self'`
  - Added `script-src-attr 'none'`
  - Normalized explicit HTTPS sources in `img-src`, `form-action`, `frame-src`, `connect-src`
- Removed broad global `/api/*` CORS headers to reduce unnecessary cross-origin attack surface.

### 4) Config hygiene (auth sheet fallback)
- Removed hardcoded spreadsheet fallback ID from `lib/auth.ts`.
- Enforced env-driven auth-sheet config (`GOOGLE_SHEETS_AUTH_ID`) with fail-closed behavior for leader mapping.

### 5) Dependency security
- Upgraded `isomorphic-dompurify` to latest compatible version.
- Re-ran production dependency audit: **0 vulnerabilities**.

## 🧪 Validation Performed

- `npm audit --omit=dev --json` → **clean (0 vulnerabilities)**
- `npm run lint` → **passes for current hardening edits**
- Targeted diagnostics on edited files → **no new errors**

## ⚠️ What Still Needs To Be Fixed

These are not blockers from the hardening patch itself, but remain in the project and should be cleaned up:

### A) Workspace/build configuration inconsistency
- Build showed root/lockfile ambiguity warning (multiple lockfiles detected).
- Action needed:
  1. Keep one canonical lockfile strategy for workspace root vs app folder.
  2. Set `turbopack.root` (or remove extra lockfile) to make build resolution deterministic.

### B) Middleware deprecation warning
- Next.js warns that `middleware` convention is deprecated in favor of `proxy`.
- Action needed: migrate `middleware.ts` to the newer convention when scheduling framework maintenance.

### C) Existing non-security lint debt (pre-existing)
- Prior lint snapshots in repo show existing React hook/style lint issues in UI files unrelated to this security pass.
- Action needed: clean these in a separate UI/lint refactor PR to keep security PR scope isolated.

## 📌 Recommended Next Steps

1. Resolve lockfile/root configuration and rerun `npm run build`.
2. Plan `middleware` → `proxy` migration (small framework maintenance task).
3. Run a focused PR for existing UI lint debt.
4. Proceed to deployment after build passes with the updated config.
