# Compliance Readiness Audit (Workspace-Based)

Date: 2026-03-24  
Scope: Code and configuration evidence inside this workspace only (Next.js app, API routes, auth, security utilities, docs).  
Important: This is a readiness/gap assessment, not a certification result.

## Assumptions

- “ISO Certified Audits” interpreted as ISO/IEC 27001-style information security management certification readiness.
- “CIS Benchmarks Level 2” interpreted as infrastructure benchmark hardening expectations (host/container/cloud baseline).

## Operational Constraints (Confirmed)

- Make.com and Google API integrations are required and must remain enabled.
- Security strategy should use compensating controls around these integrations, not feature removal.
- Day-to-day maintenance must stay feasible for rotating student leaders (non-engineer friendly).

## Executive Summary

Current state does not appear audit-pass ready for formal ASVS L2, NIST CSF 2.0, CIS Level 2 benchmark-style checks, or enterprise-grade CWE/SANS Top-25 risk tolerance.  
The app has meaningful technical controls already (auth gating, zod validation, CSP, rate limiting, security utilities, recent Classroom hardening), but major gaps remain in governance/process evidence, secure SDLC controls, and infrastructure baseline attestations.

Readiness estimate (workspace evidence only):

- OWASP ASVS L2: Partial (around 50-65%)
- NIST CSF 2.0: Low-Partial (around 25-40%)
- CIS Benchmarks Level 2: Unknown/Not Evidenced
- CWE/SANS Top 25 posture: Moderate risk remains
- ISO 27001 certification readiness: Not ready

---

## Evidence Snapshot (What Exists)

1. Security headers and CSP configured in next.config.mjs:
   - Content-Security-Policy
   - X-Content-Type-Options
   - X-Frame-Options
   - X-XSS-Protection
   - Referrer-Policy

2. Auth and access controls:
   - Domain-gated Google sign-in (@rtu.edu.ph)
   - Leader role mapping via Google Sheets
   - Role checks in protected endpoints
   - Local simulation restricted to non-production + localhost + token

3. Input validation and sanitation:
   - Zod schemas for API payloads and sheet parsing
   - Sanitization helpers in lib/security.ts
   - Classroom IDs and URLs hardened recently

4. Abuse protections:
   - Rate limiting present for auth/forms/news/classroom APIs
   - Duplicate submission guard added for Classroom submissions

5. Audit logging:
   - Structured audit logger exists (lib/audit.ts)
   - Logging coverage for several security events (expanded for Classroom)

6. Dependency posture:
   - Recent security hardening doc records clean prod dependency audit snapshot

---

## Framework-by-Framework Readiness

## 1) OWASP ASVS Level 2

Status: Not pass-ready yet (good base controls, incomplete breadth/depth)

Likely strengths:
- Authentication and authorization checks exist.
- Server-side validation with schemas is consistent.
- Security headers/CSP implemented.
- Basic anti-automation protections (rate limiting, honeypot timing checks).

Likely blockers:
- Missing formal password/session policy artifacts (where applicable), session revocation strategy evidence, and complete anti-CSRF strategy documentation/testing matrix.
- CSP still allows unsafe-inline script/style, which is typically flagged in stricter reviews.
- No documented secure coding standard mapped to ASVS controls.
- No automated security testing pipeline evidence (SAST/DAST/SCA in CI).
- Limited negative test coverage and no formal verification report per ASVS section.
- Error-handling and logging consistency still uneven across all routes.

Required before likely ASVS L2 pass:
- Control-by-control ASVS traceability matrix with evidence links.
- CI security gates (SAST, dependency checks, secret scanning, policy checks).
- Threat model + abuse cases + test artifacts for auth, APIs, and data flows.
- Remove/justify unsafe-inline in CSP with nonce/hash strategy where possible.

## 2) NIST CSF 2.0

Status: Not pass-ready (framework requires governance/process evidence beyond code)

Likely strengths:
- Protect function has technical controls in application layer.

Major blockers (non-code/process-heavy):
- Govern: no formal policy set, roles/responsibility model, risk register evidence in repo.
- Identify: no asset inventory/classification evidence for systems/data.
- Detect: no monitoring strategy, detection engineering, alert runbooks evidenced.
- Respond: no documented incident response playbooks/workflows.
- Recover: no business continuity/disaster recovery test evidence.

Required before likely CSF readiness:
- Governance docs (risk management policy, security roles, exception process).
- Operational security artifacts (logging/alerting architecture, SIEM integration, IR runbooks, tabletop evidence).
- Recovery/backup procedures with restoration test records.

## 3) CIS Benchmarks Level 2

Status: Cannot be passed from app code alone; currently not evidenced.

Reason:
- CIS Level 2 typically applies to OS/container/cloud runtime hardening (host settings, service configs, IAM/network posture, logging, patching).
- This workspace lacks infrastructure-as-code and host/runtime benchmark reports.

Required evidence:
- Target platform scope (Vercel project config, container/VM baseline, or cloud account baseline).
- Benchmark scan results and remediation proof (e.g., CIS tooling outputs).
- Hardening exceptions register.

## 4) CWE/SANS Top 25

Status: Improved, but not low-risk enough for strong assurance.

Mitigations in place:
- Input validation (CWE-20)
- Some XSS controls via sanitization/CSP (CWE-79)
- Access control checks (CWE-862/863)
- Rate limiting/abuse resistance

Residual concerns:
- CSP includes unsafe-inline (XSS risk surface remains).
- In-memory controls (dedupe/rate limiting) are weaker in distributed deployments unless shared backing store is guaranteed.
- No CI-integrated static analysis/security regression gates.
- No formal secure code review checklist mapped to Top 25 categories.

---

## Critical Cross-Cutting Gaps (Would Block Most Audits)

1. No auditable governance and operational security documentation set.
2. No CI/CD security control evidence (SAST/DAST/secret scanning/signoff gates).
3. No infrastructure compliance evidence for CIS L2-like benchmarks.
4. Incomplete control traceability (requirements-to-evidence mapping).
5. Limited formal testing artifacts for abuse cases and negative security tests.

---

## Compensating Controls Strategy (Keep APIs, Reduce Risk)

This project can still improve audit posture while keeping Make.com and Google APIs by layering simple controls around integration points.

1. Keep integration surfaces narrow and explicit
- Maintain fixed endpoint allowlists and fixed OAuth scopes (already partially present).
- Avoid dynamic outbound hosts in app logic.

2. Validate and authenticate every inbound automation payload
- Keep HMAC signature verification and replay checks for Make webhook.
- Keep strict schema validation and payload sanitation before persistence.

3. Minimize data exposure and blast radius
- Continue role-gated endpoints for Classroom actions.
- Keep redacted error responses and structured audit logs.
- Use least-privilege Google scopes only.

4. Use low-complexity abuse controls
- Keep per-route rate limits.
- Keep duplicate-submission dedupe window on critical write routes.
- Prefer short, documented defaults over complex tuning.

5. Optimize for student-maintainer continuity
- Centralize security knobs in env/config docs.
- Use checklist-driven maintenance and release verification.
- Avoid introducing heavy custom cryptography or complex policy engines.

---

## Managed Services Strategy (Recommended)

For this project, security posture improves faster and remains maintainable if core integrations stay in app code, while abuse defense and infrastructure controls are moved to managed platforms.

Keep in code (application logic)
- Domain and role-based authorization checks
- Payload schema validation and sanitization
- Webhook signature verification and replay checks
- Business workflow rules (Classroom submission ownership, moderation filters)

Move to managed services (operational controls)
- Shared rate limiting and distributed dedupe/idempotency store (e.g., Upstash Redis)
- WAF/bot management/IP reputation and edge rate limiting (e.g., Cloudflare)
- Centralized logging, error tracking, and alerting (e.g., Sentry + platform logs)
- Secret lifecycle and rotation process via deployment platform controls

Why this is better for student maintainers
- Less custom security code to maintain each term
- Stronger production behavior in distributed/serverless environments
- Better audit artifacts through service logs, dashboards, and policy settings

Practical migration order
1. Add shared Redis-backed rate limit + dedupe for critical write routes.
2. Add Cloudflare edge protections for API routes (without changing app workflows).
3. Add alerting on suspicious events (webhook auth failures, repeated 403/429 spikes).
4. Keep app logic minimal and documented with checklist-based operations.

---

## Recommended Remediation Plan (Prioritized)

Phase 0 (Immediate, 1-2 weeks)
- Build a compliance evidence matrix: requirement → control → artifact.
- Add CI security checks:
  - Dependency scanning
  - Secret scanning
  - SAST for TS/JS
  - Build-breaking policy thresholds
- Standardize error and audit event taxonomy across all API routes.

Phase 1 (2-4 weeks)
- Harden CSP away from unsafe-inline where feasible.
- Move dedupe/rate-limit critical paths to shared backing store in production.
- Create security test suite for abuse cases (auth bypass, CSRF-like attempts, injection, replay/double submit).

Phase 2 (4-8 weeks)
- Produce NIST CSF-aligned governance package (policies, IR, BCP/DR, risk register).
- Define platform scope and run CIS benchmark scans with remediation cycle.
- Conduct formal ASVS L2 control assessment with test evidence output.

---

## Practical Pass/Fail Verdict Today

- ASVS L2: Likely fail today due to missing formal verification artifacts and control completeness.
- NIST CSF 2.0: Likely fail today due to governance/operations evidence gaps.
- CIS Benchmarks L2: Not assessable/passable from workspace alone; currently fail for evidence.
- CWE/SANS Top 25: Partial mitigation only; likely fail strict enterprise threshold.
- ISO certification readiness: Not ready; substantial ISMS/process evidence is missing.

---

## Notes on Scope Limits

This assessment is intentionally conservative and based only on repository/workspace evidence.  
A true certification readiness decision requires:
- Runtime/infrastructure inspection
- Cloud/IAM/network configuration evidence
- Organizational policy/process evidence
- Independent audit sampling procedures
