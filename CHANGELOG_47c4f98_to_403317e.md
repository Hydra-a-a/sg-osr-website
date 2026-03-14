# Changelog (47c4f98 → 403317e)

Date: March 14, 2026  
Scope: Changes from commit `47c4f989b4a2e15ca68fd35f654e93e4da20d28c` to `403317e75dc31be2da1effd4b74125c9970e6d8e`

## At a glance

This update made the portal **more secure**, added **clearer public-facing sections** (OSR, Student Hub, Transparency), improved the **homepage experience**, and strengthened how forms and social media news are processed.

---

## What students and visitors will notice

- **New OSR page** (`/osr`) explaining mission, role, team, and announcements.
- **New Student Hub** (`/hub`) with campus-life resource cards and an interactive academic calendar viewer.
- **New Transparency page** (`/transparency`) prepared for future publication of financials/resolutions/minutes.
- **New Login page** (`/login`) with clearer sign-in UX and friendly error handling.
- **Updated homepage hero** with interactive council logo carousel and improved calls-to-action.
- **Navigation updates** so OSR, Hub, and Transparency are easier to reach.

---

## Security and access improvements

- Added stronger **authentication foundation** using NextAuth route handlers and app-wide session provider.
- Protected routes now redirect unauthenticated users to login, while public pages remain accessible.
- Form submissions now require an authenticated **@rtu.edu.ph** account.
- Added stricter request protection on APIs (rate limiting, client IP normalization, safer origin checks).
- Hardened webhook security with signed request verification, timestamp freshness checks, and replay protection.
- Tightened browser security headers/CSP to reduce attack surface.
- Removed fallback auth-sheet behavior and moved to safer env-driven configuration.

---

## Forms, news, and integrations

- Added Google Forms submission pipeline for grievance/feedback/contact flows.
- Improved form rules (including controlled anonymous grievance handling).
- Upgraded Make.com news webhook pipeline with:
  - duplicate post prevention,
  - non-news content filtering,
  - stronger validation and audit logging.
- Added integration artifact for Facebook webhook mapping (`integrations/make-com/facebook-webhook.json`).

---

## Content, assets, and project maintenance

- Added council image assets used in the new carousel/branding experience.
- Added security hardening status documentation.
- Added/updated utility and test scripts for sheets, forms guard behavior, and webhook verification.
- Added `.vercelignore` and updated repo/build hygiene files.
- Dependency/security maintenance performed (including audit-focused updates).

---

## Operational note (for maintainers)

This range introduces or relies on security-related environment configuration (for auth sheet, webhook signing, and Google Forms routing). Confirm environment variables are set correctly before deployment.
