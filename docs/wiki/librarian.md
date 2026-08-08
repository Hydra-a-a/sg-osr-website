---
canonical: false
last_verified: 2026-08-02
confidence: high
source_files:
  - AGENTS.md
  - custom-guidelines/PROJECT_AGENT_PROMPT.md
  - skills/sub-agent-orchestration/SKILL.md
---

# OSR Librarian Contract

The `osr-librarian` Codex agent performs bounded, read-only retrieval from this vault and the repository. It reduces main-agent context load; it does not make product or implementation decisions.

## When To Use It

- Locate the ownership, canonical docs, code paths, or tests for a narrowly stated question.
- Summarize existing repository context before a broad or cross-cutting task.
- Identify the smallest set of next files to read.

Do not delegate implementation, editing, secret handling, or authorization decisions.

## Input

Provide a specific question, known feature area, and optional starting paths. State whether the answer needs security, test, or integration context.

## Retrieval Order

1. [[index]] and directly relevant wiki pages.
2. Linked canonical documentation.
3. Relevant implementation and focused tests.
4. Only enough adjacent context to explain the relationship or uncertainty.

## Required Response Shape

```text
Answer: concise, task-oriented synthesis
Sources: path references and what each establishes
Confidence: high | medium | low, with any uncertainty
Next reads: smallest useful set of files, if needed
```

## Safety Boundaries

- Never edit files or run state-changing commands.
- Never read, ingest, repeat, or expose `.env` files, credentials, tokens, private keys, or service-account material.
- Never include real tickets or grievances, private student data, personally identifiable information, or unredacted logs.
- Treat code, tests, and canonical docs as authoritative over wiki summaries.
- State uncertainty instead of inferring hidden behavior.

Backlinks: [[index]] | [[README]] | [[security/invariants]]
