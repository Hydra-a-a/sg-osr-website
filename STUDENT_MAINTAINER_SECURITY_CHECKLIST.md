# Student Maintainer Security Checklist

This checklist is designed for regular student leaders to safely operate the website without removing Make.com or Google API integrations.

## Every Term Start (Required)

1. Rotate these secrets in deployment environment:
- MAKE_WEBHOOK_SECRET (or IFTTT_WEBHOOK_SECRET)
- AUTH_SECRET
- AUTH_GOOGLE_SECRET

2. Verify OAuth configuration:
- Confirm redirect URI matches production domain exactly.
- Confirm allowed scopes are only those needed.

3. Verify Google Sheets IDs:
- GOOGLE_SHEETS_INFO_ID
- GOOGLE_SHEETS_AUTH_ID

4. Run local quality checks:
- npm run lint
- test form auth guard script if available

5. Verify Redis protection is active in production:
- UPSTASH_REDIS_REST_URL is set
- UPSTASH_REDIS_REST_TOKEN is set
- Deploy logs do not show missing Redis configuration warnings

## Every Release (Required)

1. Validate webhook protections:
- Signature required
- Timestamp required
- Replay attacks blocked

2. Validate role protections:
- Non-logged in users cannot submit forms/classroom actions
- Non-leaders cannot access leader-only classroom endpoints

3. Validate error safety:
- API errors should not expose secrets or stack traces

4. Validate submission integrity:
- Duplicate submissions are blocked in short window
- HTTPS links only for classroom submissions
- Distributed rate limit/dedupe is active (not local-memory fallback in production)

## Incident Quick Actions

If suspicious activity is detected:

1. Rotate MAKE_WEBHOOK_SECRET immediately.
2. Rotate AUTH_SECRET and OAuth secret.
3. Temporarily lower rate-limit thresholds if abuse spike is ongoing.
4. Check structured audit logs for:
- WEBHOOK_FAILED_AUTH
- CLASSROOM_SUBMISSION_REJECTED
- CLASSROOM_DUPLICATE_BLOCKED
5. Notify next term maintainer and document incident summary.

## What Not To Change Without Review

- Do not remove HMAC verification from webhook route.
- Do not loosen classroom role checks.
- Do not add wildcard external hosts for outbound calls.
- Do not expose secrets with NEXT_PUBLIC_ variables.

## Maintenance Principle

Keep integrations, add guardrails around them.  
When unsure: choose safer defaults and ask for review before relaxing controls.
