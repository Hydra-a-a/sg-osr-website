# Security Benchmark Matrix (Formal)

Date: 2026-04-02
Scope: Repository controls and CI/CD evidence in this workspace.
Constraint: Keep existing website functionality and performance stable.

## Status Scale

- Implemented: Control is present and evidenced in code/workflow.
- Partial: Control exists but not yet comprehensive for audit-grade closure.
- Gap: Missing or not yet evidenced.

## Benchmark Matrix

| Benchmark | Current Status | Evidence in Repo | Main Residual Gaps | Priority Next Step |
|---|---|---|---|---|
| OWASP API Security Top 10 (2023) | Partial | Ticket object access hardening in [app/api/tickets/[id]/route.ts](app/api/tickets/[id]/route.ts) and [lib/tickets.ts](lib/tickets.ts); route-level rate limits in [lib/rate-limit.ts](lib/rate-limit.ts); webhook signature/replay checks in [app/api/webhooks/make/route.ts](app/api/webhooks/make/route.ts) and [lib/security.ts](lib/security.ts) | API inventory and explicit authorization test coverage are incomplete | Add API-by-API negative test set and ownership register |
| OWASP ASVS (L2, full) | Partial | Security headers/CSP in [proxy.ts](proxy.ts); standardized API errors in [lib/api-errors.ts](lib/api-errors.ts); auth and domain controls in [lib/auth.config.ts](lib/auth.config.ts); starter matrix in [ASVS_L2_TRACEABILITY_MATRIX_STARTER.md](ASVS_L2_TRACEABILITY_MATRIX_STARTER.md) | Full control-level traceability and closure evidence are not complete | Expand ASVS matrix to all required controls with pass/fail evidence links |
| OWASP Top 10 (2021) | Partial | Injection/XSS hardening in [lib/security.ts](lib/security.ts) and [lib/email-templates.ts](lib/email-templates.ts); broken access control mitigations in ticket/classroom APIs | No formal top-10 threat-to-control mapping document yet | Add top-10 mapping appendix with test cases and residual risk acceptance |
| OWASP SAMM | Partial | Governance and runbook docs in [GOVERNANCE_SECURITY_ROLES_AND_RISK_POLICY.md](GOVERNANCE_SECURITY_ROLES_AND_RISK_POLICY.md), [INCIDENT_RESPONSE_RUNBOOK.md](INCIDENT_RESPONSE_RUNBOOK.md), [BUSINESS_CONTINUITY_DR_RUNBOOK.md](BUSINESS_CONTINUITY_DR_RUNBOOK.md) | Maturity scoring and quarterly measurement cycle are not formalized | Add SAMM function-by-function maturity scores and quarterly targets |
| OpenSSF Scorecard | Implemented (pipeline), Partial (program) | Scorecard SARIF job in [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Some scorecard checks depend on org/repo settings outside code (branch protection, reviews, token permissions) | Export first scorecard run and track control owners for non-code findings |
| SBOM + Provenance / Signing | Implemented (pipeline), Partial (release governance) | CycloneDX SBOM + provenance attestation in [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Artifact verification policy and release-signing governance are not yet documented | Add release verification runbook and attestation verification step in release process |
| Secrets Exposure + History Audit | Partial | Gitleaks action in [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml); redacted logging checks in [tests/test-redacted-logging.js](tests/test-redacted-logging.js) | Historical secret review workflow and incident response SLA for leaks are not explicit | Add history scan cadence and leak response playbook with owner/SLA |
| Threat Modeling (Auth, Webhook, Sheets, Classroom, Email) | Gap | Controls exist in code paths: [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts), [app/api/webhooks/make/route.ts](app/api/webhooks/make/route.ts), [app/api/tickets/route.ts](app/api/tickets/route.ts), [lib/google-classroom.ts](lib/google-classroom.ts) | No formal DFD/STRIDE model and abuse-case register in repo | Add one threat-model document with DFD, trust boundaries, and abuse scenarios |
| SSDF / SLSA 3 (practical trajectory) | Partial | Pinned actions and expanded security gates in [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) | Reproducibility, policy-as-code attest verification, and full dependency provenance are incomplete | Establish release policy checks and signed release artifact verification |

## High-Risk Findings Closure Status (From 2026-04-02 Review)

| Finding | Status | Evidence |
|---|---|---|
| Predictable ticket tracking identifier and metadata exposure | Closed | [lib/tickets.ts](lib/tickets.ts), [app/api/tickets/[id]/route.ts](app/api/tickets/[id]/route.ts), [tests/test-ticket-security-hardening.js](tests/test-ticket-security-hardening.js) |
| HTML email relay/injection risk in grievance email flow | Closed | [app/api/tickets/route.ts](app/api/tickets/route.ts), [lib/email-templates.ts](lib/email-templates.ts), [tests/test-ticket-security-hardening.js](tests/test-ticket-security-hardening.js) |
| CSP regression (unsafe-inline, missing nonce strict-dynamic) | Closed | [proxy.ts](proxy.ts), [tests/test-csp-policy.js](tests/test-csp-policy.js) |
| Missing DAST/SBOM/provenance/scorecard and pinned actions in CI | Improved to Partial | [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml) |

## Item 3 Execution Note (DAST without Performance/Functionality Risk)

DAST is now configured to run only on schedule or manual dispatch, not on routine pull request and push events, in [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml).

- Scheduled mode: uses repository variable DAST_TARGET_URL.
- Manual mode: accepts workflow input dast_target_url that overrides the repo variable.
- Runtime app performance is unaffected because this is CI-only.
