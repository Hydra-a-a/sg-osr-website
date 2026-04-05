# Governance, Security Roles, and Risk Policy (Student Maintainer Edition)

Date: 2026-03-25  
Owner: Student Government Web Maintainers

## Purpose

Define minimum governance controls to support ASVS L2 and NIST CSF readiness while keeping operations feasible for rotating student leaders.

## Security Roles

- Security Lead (Student Maintainer Lead)
  - Owns security checklist execution each release.
  - Approves security exceptions with rationale and expiry date.
- Platform Owner (Deployment/Admin)
  - Manages deployment settings, secrets, and domain/OAuth configuration.
  - Verifies environment parity before production releases.
- API Owner (Backend Maintainer)
  - Maintains input validation, auth checks, and webhook verification controls.
  - Reviews security-impacting API changes before merge.
- Incident Coordinator (Assigned per term)
  - Leads incident triage, communications, and post-incident report.

## Risk Management Policy

- Risk scoring model
  - Likelihood: 1 (low) to 5 (high)
  - Impact: 1 (low) to 5 (high)
  - Risk score = Likelihood × Impact
- Risk handling thresholds
  - 15-25: Must remediate before production release.
  - 8-14: Time-boxed mitigation plan required.
  - 1-7: Acceptable with documented rationale.
- Required risk metadata
  - Risk ID, description, owner, score, mitigation, target date, status.

## Change Control (Security-Affecting Changes)

Changes to these areas require Security Lead review:

- Auth/session logic (`lib/auth*.ts`, auth API routes)
- Validation schemas (`schemas/*`)
- Webhook verification (`app/api/webhooks/*`, `lib/security.ts`)
- Security headers/CSP (`next.config.mjs`)
- Rate limiting and abuse controls (`lib/rate-limit.ts`, write APIs)
- CI security gates (`.github/workflows/security-gates.yml`)

## Exception Process

- Every exception must include:
  - Business justification
  - Scope and affected controls
  - Compensating controls
  - Expiration date
  - Approver
- Expired exceptions must be renewed or removed before next release.

## Term Turnover Requirement

At each term handover:

- Review and rotate all high-impact secrets.
- Re-validate production auth redirect URIs.
- Re-assign role owners in this document and incident runbook.
- Re-review open risks in the risk register.