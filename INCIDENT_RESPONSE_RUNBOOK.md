# Incident Response Runbook

Date: 2026-03-25  
Owner: Incident Coordinator (assigned per term)

## Scope

Security incidents affecting authentication, webhooks, data integrity, API abuse, or credential exposure.

## Severity Levels

- Sev 1: Active compromise, credential leak, or widespread unauthorized access.
- Sev 2: Confirmed abuse with contained impact (replay, spam burst, webhook forgery attempts).
- Sev 3: Suspicious activity requiring investigation only.

## Detection Sources

- API audit events (`lib/audit.ts` driven route logs)
- Deployment/platform logs
- Security-gates CI failures
- User reports from grievance/contact channels

## Immediate Actions (First 30 Minutes)

1. Assign incident commander and note start time.
2. Freeze high-risk deployments until triage completes.
3. Capture indicators:
   - Source IPs / request patterns
   - Affected endpoints
   - Relevant audit event types
4. Rotate secrets immediately if compromise suspected:
   - `MAKE_WEBHOOK_SECRET`
   - `AUTH_SECRET`
   - `AUTH_GOOGLE_SECRET`

## Containment Playbooks

## A) Webhook Abuse / Forgery

- Validate signature enforcement is active.
- Temporarily tighten route rate limits.
- Rotate webhook secret and redeploy.

## B) Auth Abuse / Account Policy Drift

- Confirm `@rtu.edu.ph` restriction still enforced.
- Verify OAuth redirect URIs match production domain exactly.
- Revoke compromised OAuth credentials and rotate secrets.

## C) API Abuse / Spam Burst

- Tighten route-specific limits.
- Block obvious malicious IP ranges at edge/WAF where available.
- Verify distributed limiter backend is enabled in production.

## Recovery Checklist

- Confirm exploit path is closed.
- Validate normal operations through smoke tests.
- Re-enable deployment pipeline.
- Document residual risk and follow-up tasks.

## Post-Incident (Within 72 Hours)

- Create incident report containing:
  - Timeline
  - Root cause
  - Controls that failed/missed
  - Permanent fixes with owners and due dates
- Update security checklist and runbooks if process gaps are found.