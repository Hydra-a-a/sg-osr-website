# Compliance Closure Tracker (Actionable)

Date: 2026-03-25  
Scope: ASVS L2, NIST CSF 2.0, CIS Level 2 evidence readiness

## Status Key

- Done: Implemented in repository with evidence link
- In Progress: Partially implemented, validation pending
- External: Requires platform/organizational evidence outside repo

## Priority Gaps and Owners

| Gap | Owner | Status | Evidence / Notes |
|---|---|---|---|
| CI security gates (lint, SCA, SAST, secret scan) | API Owner + Platform Owner | In Progress | Added workflow: [.github/workflows/security-gates.yml](.github/workflows/security-gates.yml). Requires successful runs on PRs for evidence. |
| Governance roles and risk policy | Security Lead | Done | [GOVERNANCE_SECURITY_ROLES_AND_RISK_POLICY.md](GOVERNANCE_SECURITY_ROLES_AND_RISK_POLICY.md) |
| Incident response runbook | Incident Coordinator | Done | [INCIDENT_RESPONSE_RUNBOOK.md](INCIDENT_RESPONSE_RUNBOOK.md) |
| Continuity and DR process | Platform Owner | Done | [BUSINESS_CONTINUITY_DR_RUNBOOK.md](BUSINESS_CONTINUITY_DR_RUNBOOK.md) |
| ASVS control-to-evidence completeness | Security Lead + API Owner | In Progress | Starter matrix exists: [ASVS_L2_TRACEABILITY_MATRIX_STARTER.md](ASVS_L2_TRACEABILITY_MATRIX_STARTER.md); fill all remaining Partial rows with test/log evidence. |
| Distributed rate-limit/dedupe attestation in production | Platform Owner | External | Needs runtime evidence (Upstash/edge logs, config screenshots, production test artifacts). |
| CIS benchmark scope + scan results | Platform Owner | External | Requires target platform scope and benchmark scan outputs (outside code repo). |
| Monitoring/alerting evidence (Detect function) | Incident Coordinator + Platform Owner | External | Needs alert rules, escalation policy, and sample alert evidence from monitoring stack. |
| Secret rotation proof by term | Security Lead | In Progress | Process documented in [STUDENT_MAINTAINER_SECURITY_CHECKLIST.md](STUDENT_MAINTAINER_SECURITY_CHECKLIST.md); attach dated completion records each term. |

## Definition of “Audit-Ready” for This Repo

All of the following must be true:

1. Security gates run and pass on recent pull requests.
2. ASVS matrix rows are implemented or have accepted-risk rationale.
3. IR and DR drill records exist with dates and owners.
4. Platform/infrastructure evidence is linked (CIS scans, runtime controls, alerting).

## Next 7-Day Execution Plan

- Day 1-2: Enable workflow and gather first passing CI artifacts.
- Day 3-4: Close ASVS Partial rows with specific tests and logs.
- Day 5: Run incident tabletop and publish report.
- Day 6: Run DR drill and publish report.
- Day 7: Attach external platform evidence links for CIS/runtime controls.