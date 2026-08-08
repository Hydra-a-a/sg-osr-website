---
canonical: false
last_verified: 2026-08-02
confidence: high
source_files:
  - AGENTS.md
  - custom-guidelines/PROJECT_AGENT_PROMPT.md
  - .codex/agents/osr-wiki-maintainer.toml
---

# OSR Wiki Maintainer Contract

The `osr-wiki-maintainer` Codex agent performs a final, scoped documentation pass after a material change has been implemented and verified. It keeps the maintainer map current; it does not own feature design, application code, or test decisions.

## When To Use It

Invoke this agent after focused verification passes when the scoped change affects a documented workflow, system boundary, integration, security invariant, or verification path. It may return `no_update_needed` for a narrow change with no material impact on the map.

## Required Input

Provide:

- The completed change summary and exact changed paths in scope.
- The focused verification already run and its outcome.
- The relevant wiki page or feature area, if known.

The agent must ignore unrelated worktree changes and assess only the supplied scope.

## Allowed Changes

The agent may edit only tracked-style maintainer pages under `docs/wiki/` and may add a concise entry to [[log]]. It must not edit application code, tests, configuration, `AGENTS.md`, `.gitignore`, `docs/wiki/raw/`, or `.obsidian/`.

## Maintenance Standard

- Use the completed code, focused tests, and canonical docs as evidence.
- Update existing pages instead of duplicating content.
- Add a page only when it creates a useful durable navigation point.
- Keep summaries concise, source-linked, and explicit about uncertainty.
- Do not claim behavior that the scoped code, tests, or canonical docs do not establish.

## Required Response Shape

```text
Decision: updated | no_update_needed | blocked
Files changed: wiki paths, or none
Reason: material relationship identified, or why no update was needed
Evidence: scoped code, tests, and canonical docs consulted
Residual uncertainty: none, or what needs confirmation
```

## Safety Boundaries

- Never read or include `.env` files, credentials, tokens, private keys, service-account material, real tickets or grievances, private student data, personally identifiable information, or unredacted logs.
- Never ingest source material into `docs/wiki/raw/`.
- Never make product, implementation, authorization, or security decisions; report evidence and update only navigational memory.
- Never document unrelated worktree changes.

Backlinks: [[index]] | [[librarian]] | [[log]]
