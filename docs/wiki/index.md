---
canonical: false
last_verified: 2026-08-08
confidence: high
source_files:
  - README.md
  - package.json
  - AGENTS.md
  - custom-guidelines/PROJECT_AGENT_PROMPT.md
---

# OSR Maintainer Map

This is the entry point for the repository knowledge base. Follow links for orientation, then verify the task-specific details in code, tests, and canonical docs.

## Core Map

- [[systems/portal-map]]: product scope, major capabilities, and source-of-truth locations.
- [[systems/database-map]]: Neon Postgres + Prisma migration boundary and verification path.
- [[security/invariants]]: boundaries that must survive changes to auth, APIs, tickets, and integrations.
- [[tests/verification-map]]: focused script selection and release checks.
- [[librarian]]: read-only retrieval contract for the `osr-librarian` Codex agent.
- [[wiki-maintainer]]: scoped wiki-refresh contract for the `osr-wiki-maintainer` Codex agent.
- [[log]]: material changes to this maintainer map.

## Canonical Documentation

- `README.md`: project setup, operational notes, and release routine.
- `docs/security/auth-baseline-map.md`: authentication and authorization reference.
- `docs/security/session-policy.md`: session behavior and policy.
- `docs/security/dependency-audit.md`: dependency remediation and the production High/Critical gate.
- `docs/launch/production-verification-runbook.md`: production-only verification.
- `docs/design/design-system-v1.md`: required visual-system reference before UI/layout work.

Auth and dependency hardening should be checked against [[security/invariants]], the canonical session/dependency policies, and the focused token/email boundary tests before release.

## Retrieval Order

1. Read this page and the directly relevant wiki page.
2. Read the linked canonical docs, code, and tests.
3. Use `osr-librarian` for bounded read-only discovery when it reduces main-agent context load.
4. Treat the confirmed implementation and tests as authority.
