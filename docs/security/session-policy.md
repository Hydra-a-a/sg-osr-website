# Session Policy

Last reviewed: 2026-08-08

## Decision

The current session policy is **JWT-only with documented residual risk**.

This is acceptable for the current student services portal because privileged actions are already checked server-side, role data is refreshed through the auth callback path, and the highest-risk write paths are rate-limited and role-gated. The tradeoff is that access removal is not guaranteed to take effect instantly across all already-issued sessions.

Server-side revocation is not required in this phase, but it becomes required before adding higher-risk admin capabilities, financial workflows, destructive bulk actions, or any workflow where immediate access removal is a hard requirement.

## Current Behavior

| Scenario | Current behavior | Risk | Policy |
| --- | --- | --- | --- |
| Normal session lifetime | NextAuth JWT session max age is 8 hours. | A valid browser session may remain usable until expiry. | Accepted for now. |
| Logout in one browser | The browser that signs out clears its local session. | Other browsers/devices can remain signed in until expiry. | Accepted for now; document clearly. |
| Role removal or downgrade | Role source defaults to the auth access sheet; authorized-user rows are cached for 5 minutes. DB-backed access-console changes also carry `revokedAfter` and increment `sessionVersion`. | Sheet-backed changes may wait for callback/cache refresh. DB-backed version bumps downgrade stale JWTs on the callback path; the access console itself checks the current Neon officer row on every request. | Accepted for now with bounded residual risk. |
| Multi-browser use | Each browser has its own session cookie/JWT lifecycle. | Logout is not global. | Accepted for now. |
| Google access token expiry | OAuth access tokens are refreshed when near expiry if a refresh token is available. | Classroom/API access can continue while the app session is valid. | Accepted for current Classroom features. |
| Browser session projection | The public Auth.js session contains role and profile fields only; Google access/refresh tokens remain JWT claims and are projected only by the server-only `authWithGoogleToken()` helper used by Classroom route handlers. | A client-side XSS or bundle dependency compromise cannot read `session.accessToken`; server routes still retain the token needed for Google Classroom calls. | Required invariant. |
| Portal mode changes | Portal mode only changes effective role downward or to the actual role. | Cookie cannot upgrade a student into leader/officer. | Required invariant. |

## Hard Requirements

1. Privileged and object-owned actions must continue to enforce authorization server-side.
2. Portal mode must never grant more privilege than the actual account role.
3. Session max age must remain bounded. The current limit is 8 hours.
4. Role-source caching must remain bounded. The current authorized-user cache is 5 minutes.
5. Debug or diagnostic auth routes must stay disabled by default and disabled in production.
6. If immediate global revocation becomes required, do not rely on JWT-only sessions alone.
7. OAuth access and refresh tokens must never be copied into the browser-visible Session object. Classroom handlers must use `authWithGoogleToken()` for server-side token access.

## Revocation Upgrade Trigger

Move from JWT-only to server-side revocation if any of these become true:

| Trigger | Required change |
| --- | --- |
| Officers need immediate lockout after removal from the access sheet. | Add a server-side `sessionVersion`, `revokedAfter`, or session allowlist checked on every privileged request. |
| A device is lost or a student requests global logout. | Add account-level revocation timestamp and compare it in the auth callback/server auth helper. |
| Admin features gain destructive bulk actions. | Add server-side revocation before launch. |
| The portal begins handling financial, disciplinary, or legally sensitive records. | Add server-side revocation and shorter privileged-session lifetime. |
| Incident response requires instant access termination. | Add revocation before relying on the portal for that workflow. |

## Future Revocation Design

A minimal upgrade path should avoid a separate database unless the app already has one. Since the current role source is Google Sheets, the lowest-friction design is:

1. Add `SessionVersion` and/or `RevokedAfter` columns to the access sheet.
2. Store `sessionVersion` and `issuedAt` in the JWT during sign-in.
3. On sensitive requests, compare token values against the current server-side access record.
4. Reject the request with `401` or `403` if the token is older than `RevokedAfter` or has a stale `sessionVersion`.
5. Keep non-sensitive public routes unaffected.

If the app moves auth data to the Neon Postgres foundation, use a dedicated session table or account security table instead.

The auth access repository now supports an opt-in Neon source through `AUTH_ACCESS_SOURCE`. DB-backed authorized users use `revokedAfter` filtering and `sessionVersion` comparison in the JWT callback to downgrade stale elevated sessions without extending the Google Sheets access table. The protected access console also checks the current Neon officer record directly before listing or mutating role records.

## Regression Expectations

Tests should verify:

1. `auth.config.ts` continues to use bounded JWT sessions.
2. The session max age remains visible and intentional.
3. `auth.ts` continues to bound the authorized-user cache.
4. The JWT callback still refreshes role data from `getAuthorizedUsers`.
5. DB-backed auth sessions downgrade stale elevated roles when `sessionVersion` changes.
6. The session policy document states the residual risk and revocation trigger.
7. `tests/test-session-token-boundary.js` verifies the public projection, JWT claim types, server-only Classroom helper, and absence of client `session.accessToken` reads.

## Link To Baseline

This policy resolves the Phase 2 decision point from `docs/security/auth-baseline-map.md`: JWT-only is acceptable for now, with explicit residual risk and a defined revocation upgrade path.
