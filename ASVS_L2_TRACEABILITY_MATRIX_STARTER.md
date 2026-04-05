# OWASP ASVS L2 Traceability Matrix (Starter)

Date: 2026-03-24  
Purpose: Practical starter matrix for student-maintained operations while preserving Make.com and Google API integrations.

## How to Use

- Treat this as a living checklist.
- Each row should end with evidence (file, test, screenshot, or log sample).
- Status values:
  - Implemented
  - Partial
  - Gap

## Authentication & Session

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Federated login domain restrictions | Implemented | [lib/auth.config.ts](lib/auth.config.ts) | Keep regression test for non-RTU email rejection |
| Session lifetime and JWT strategy | Implemented | [lib/auth.config.ts](lib/auth.config.ts), [lib/auth.ts](lib/auth.ts) | Add session revocation runbook |
| Login abuse protection | Implemented | [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts), [lib/rate-limit.ts](lib/rate-limit.ts) | Add CI test for rate-limit behavior |

## Access Control

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Role-based access on sensitive APIs | Implemented | [app/api/classroom/courses/route.ts](app/api/classroom/courses/route.ts), [app/api/classroom/submissions/route.ts](app/api/classroom/submissions/route.ts) | Add negative tests per role |
| Course ownership checks for classroom submissions | Implemented | [lib/google-classroom.ts](lib/google-classroom.ts) | Add explicit test case |

## Input Validation / Output Handling

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Schema validation for external payloads | Implemented | [schemas/webhooks.ts](schemas/webhooks.ts), [schemas/classroom.ts](schemas/classroom.ts) | Expand malformed payload test corpus |
| Sanitization of untrusted text | Implemented | [lib/security.ts](lib/security.ts), [lib/google-classroom.ts](lib/google-classroom.ts) | Add consistency checklist across all render paths |
| Error detail minimization | Partial | [app/api/classroom/submissions/route.ts](app/api/classroom/submissions/route.ts) | Normalize on all API routes |

## API & Integration Security (Compensating Controls)

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Make.com webhook signature + replay defense | Implemented | [app/api/webhooks/make/route.ts](app/api/webhooks/make/route.ts), [lib/security.ts](lib/security.ts) | Add automated replay test in CI |
| Google API least-privilege scopes | Partial | [lib/auth.config.ts](lib/auth.config.ts) | Document scope review per term turnover |
| Rate limiting for abuse resistance | Implemented | [lib/rate-limit.ts](lib/rate-limit.ts), multiple API routes | Confirm shared backend in production |
| Duplicate-write prevention on sensitive actions | Implemented | [app/api/classroom/submissions/route.ts](app/api/classroom/submissions/route.ts) | Add centralized utility for future routes |

## Headers / Browser Controls

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Security headers & CSP | Partial | [next.config.mjs](next.config.mjs) | Reduce unsafe-inline usage over time |

## Logging / Auditability

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Structured audit logs for sensitive events | Implemented | [lib/audit.ts](lib/audit.ts), auth/webhook/forms/classroom routes | Add retention + review procedure doc |

## Secure SDLC / Verification

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| CI security gates on pull requests | Partial | [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Capture and retain first successful run artifacts for audit evidence |
| Secret scanning in CI | Partial | [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Add documented response workflow for detected secrets |
| Automated SAST in CI | Partial | [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Tune alert triage and set SLA for remediation |
| Production dependency vulnerability gate | Partial | [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Track accepted-risk exceptions with expiration |

## Student-Maintainer Safeguards

| Control Area | Status | Current Evidence | Gap / Action |
|---|---|---|---|
| Security controls understandable without deep engineering | Partial | Existing inline comments and docs | Add term-turnover security checklist and one-page incident playbook |
| Config-only operation for integrations | Partial | Environment variable-driven behavior | Add validation script for required env values before deployment |

## Minimum “Pass-Readiness” Checklist for This Repo

- ASVS matrix rows all moved to Implemented or accepted-risk with signed rationale.
- Evidence attached for each row (test/log/document).
- CI security checks running on every PR.
- Integration compensating controls tested (webhook replay, invalid signatures, role bypass, duplicate submissions).
- Student turnover docs updated for each academic term.
