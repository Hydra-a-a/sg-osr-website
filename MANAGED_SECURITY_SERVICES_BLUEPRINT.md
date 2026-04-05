# Managed Security Services Blueprint

Date: 2026-03-24  
Audience: Student leaders and future maintainers  
Goal: Keep Make.com and Google APIs active, while reducing risk using managed services instead of heavy custom security code.

## 1) Security Ownership Split

Application code should own:
- Authentication and role checks
- Business validation rules
- Schema validation and sanitization
- Webhook signature and replay validation

Managed services should own:
- Distributed rate limiting and idempotency state
- WAF and bot filtering
- Edge traffic controls and IP reputation handling
- Alerting and centralized incident visibility

## 2) Recommended Service Stack (Minimal)

Primary option
- Edge protection: Cloudflare
- Shared counters/state: Upstash Redis
- Error and alert telemetry: Sentry (or equivalent)

Alternative options
- If Cloudflare is unavailable, use hosting provider edge controls where possible.
- If Redis service is unavailable, keep in-memory fallback but treat as temporary risk.

## 3) Control Mapping (Keep APIs, Add Guardrails)

Make.com webhook
- Keep: HMAC signature verification, timestamp freshness check, replay cache logic
- Add (managed): edge rate limiting and bot controls before requests reach app
- Add (managed): alert on repeated webhook auth failures

Google Classroom + Google APIs
- Keep: role checks, strict schema validation, owner/course checks, URL restrictions
- Add (managed): distributed dedupe and rate limits with Redis backing
- Add (managed): alert on repeated permission-denied patterns and submission anomalies

Forms/news APIs
- Keep: auth gating, payload validation
- Add (managed): edge request shaping and abuse mitigation

## 4) Implementation Phases

Phase A (fast, low-risk)
1. Add Redis-backed key strategy for:
   - Per-route limits
   - Duplicate submission windows
2. Keep in-memory fallback for local development only.
3. Document required env vars in one checklist.

Phase B (edge hardening)
1. Put API routes behind Cloudflare security controls.
2. Add route-level rules:
   - stricter thresholds for webhook paths
   - anomaly blocks for burst traffic
3. Keep allowlist-based behavior for known integrations.

Phase C (observability)
1. Forward structured app audit logs to central monitoring.
2. Add alerts for:
   - webhook signature failures
   - spikes in 401/403/429 on critical routes
   - repeated duplicate-submit blocks
3. Add one-page incident triage guide per term.

## 5) Student-Maintainer Simplicity Rules

- Prefer configuration over code changes.
- Keep one-page runbooks for each service.
- Avoid introducing custom crypto or deep security frameworks.
- Store all security settings in env/platform dashboards and document exact locations.
- Require checklist sign-off before each term handover.

## 6) Minimum Evidence for Audit Improvement

For each term/release, capture:
- Screenshot/export of edge protection rules
- Redis-backed limit/dedupe configuration evidence
- Alert rule list and one incident drill record
- App-side control references (auth, validation, webhook checks)
- Change log showing security config review and secret rotation

## 7) Decision Summary

- Do not remove Make.com and Google APIs.
- Keep app-level control logic for correctness and authorization.
- Offload scalability and abuse-defense controls to managed services.
- Prioritize maintainability so future student officers can operate safely.
