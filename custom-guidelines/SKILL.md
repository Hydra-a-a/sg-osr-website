---
name: custom-guidelines
description: Loads project-specific coding rules, required skill routing, and verification standards for OSR website development.
---

# custom-guidelines

This skill applies the workspace baseline guidance for coding decisions, tool selection, and verification.

## When to use

- Use for every coding task in this repository before implementation.
- Use whenever work touches UI, API routes, auth, security-sensitive logic, or test workflows.
- Use when starting a new session to align behavior with project standards.

## Instructions

1. Read `custom-guidelines/PROJECT_AGENT_PROMPT.md` fully and treat it as mandatory context.
2. Follow `AGENTS.md` and `docs/design/design-system-v1.md` requirements when relevant.
3. Route work through installed skills when task domains match (frontend, security, Playwright, GitHub, Sentry, OpenAI docs).
4. Keep edits scoped; do not perform unrelated refactors.
5. Run targeted verification commands from `package.json` matching the touched feature area.
6. In final responses, report files changed, tests run, outcomes, and any residual risk.
