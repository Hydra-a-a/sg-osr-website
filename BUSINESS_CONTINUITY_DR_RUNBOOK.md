# Business Continuity and Disaster Recovery Runbook

Date: 2026-03-25  
Owner: Platform Owner

## Objectives

- Maintain critical student services during incidents.
- Recover production functionality quickly after outages or misconfiguration.

## Service Priority

1. Authentication (`/login`, auth callbacks)
2. Grievance submission (`/services`, `/api/forms`)
3. Announcements/news endpoints
4. Directory and non-critical pages

## Recovery Targets

- RTO (Recovery Time Objective): 4 hours for priority 1-2 services.
- RPO (Recovery Point Objective): 24 hours for content/config sources.

## Failure Scenarios

## A) Deployment Misconfiguration

- Roll back to last known good deployment.
- Validate env vars against pre-release checklist.
- Re-run smoke tests for auth/forms/news.

## B) Third-Party API Degradation (Google/Make)

- Keep user-facing messaging clear (degraded mode notice).
- Queue/retry where supported; avoid silent data loss.
- Open incident ticket and track duration/impact.

## C) Secret Compromise / Security Event

- Execute secret rotation sequence immediately.
- Revoke stale credentials and regenerate affected tokens.
- Confirm all production instances use new secrets.

## Backup and Restore Practice

- Configuration backup cadence: per release and term turnover.
- Required artifacts:
  - Environment variable inventory (without secret values)
  - OAuth redirect URI configuration snapshot
  - Google Sheet IDs and integration mappings

## Quarterly DR Test

Perform one tabletop or live recovery drill per quarter:

- Simulate one scenario from this runbook.
- Measure detection time, recovery time, and blockers.
- Record findings and remediation owners.