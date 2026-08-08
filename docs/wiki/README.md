---
canonical: false
last_verified: 2026-08-02
confidence: high
source_files:
  - AGENTS.md
  - custom-guidelines/PROJECT_AGENT_PROMPT.md
---

# OSR Maintainer Wiki

This folder is the long-lived, Markdown-based maintainer map for the RTU OSR portal. It is designed for humans in Obsidian and for coding agents working in the repository.

Open `docs/wiki/` directly as an Obsidian vault. The wiki uses standard Markdown and `[[wikilinks]]`; local Obsidian workspace settings are intentionally ignored by Git.

Start with [[index]]. Use the wiki to locate the right code, tests, and canonical documentation quickly. Do not treat a wiki summary as authoritative when it conflicts with the implementation, tests, or canonical project docs.

## Safety

Do not add source material containing any of the following:

- `.env` files or values from them
- credentials, tokens, private keys, or service-account material
- real tickets, grievances, private student data, or personally identifiable information
- unredacted logs, production payloads, or support exports

The `raw/` folder is a local, ignored inbox for safe, non-sensitive source material. Only [[raw/README]] is tracked.

## Maintenance

- Keep pages concise, source-linked, and useful for navigation.
- Add or update wikilinks as relationships become clear.
- Use [[log]] to record material documentation changes.
- When a change affects a workflow, system boundary, security invariant, or verification path, update its wiki page in the same change when practical.
- Mark uncertainty and link to the code, test, or canonical doc that needs confirmation.

For bounded read-only retrieval, use the [[librarian]] contract and the `osr-librarian` Codex agent.
