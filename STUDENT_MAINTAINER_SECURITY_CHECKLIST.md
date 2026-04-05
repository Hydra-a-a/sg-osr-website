# Student Maintainer Security Checklist

This is the "please don't break prod" checklist for whoever is on duty this term.

## At term start

1. Rotate these immediately:
- MAKE_WEBHOOK_SECRET
- AUTH_SECRET
- AUTH_GOOGLE_SECRET

2. Re-check Google OAuth setup:
- Redirect URI must match prod domain exactly.
- Scopes should be minimal, no random extras.

3. Confirm sheet IDs are correct:
- GOOGLE_SHEETS_INFO_ID
- GOOGLE_SHEETS_AUTH_ID

4. Confirm Redis is actually configured in prod:
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN

5. Run local checks:
- npm run lint
- npm run test:security

## Before every release

1. Webhook checks still on:
- signature validation
- timestamp validation
- replay blocking

2. Access checks still on:
- unauthenticated users blocked on protected routes
- leader-only routes still leader-only

3. Error responses still safe:
- no secrets
- no stack traces in API responses

4. Submission protections still active:
- duplicate blocking
- https-only links where required
- distributed limiter/dedupe (not just in-memory fallback)

## If something weird is happening

1. Rotate MAKE_WEBHOOK_SECRET.
2. Rotate AUTH_SECRET + AUTH_GOOGLE_SECRET.
3. Temporarily tighten rate limits.
4. Check audit events for:
- WEBHOOK_FAILED_AUTH
- CLASSROOM_SUBMISSION_REJECTED
- CLASSROOM_DUPLICATE_BLOCKED
5. Write a short incident note so next maintainer is not blind.

## Do not change these casually

- Do not remove webhook HMAC validation.
- Do not relax role checks.
- Do not allow wildcard outbound hosts.
- Do not expose secrets using NEXT_PUBLIC_.

## One-line rule

Keep integrations working, keep guardrails strict, and if unsure pick the safer option.
