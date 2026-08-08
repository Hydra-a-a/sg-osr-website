# Dependency Security Gate

Last reviewed: 2026-08-08

## Release gate

The production dependency gate is:

```text
npm ci
npm audit --omit=dev --audit-level=high
```

The current lockfile passes the gate with zero High or Critical production vulnerabilities. Low `@babel/core` and Moderate `qs` findings remain in the production graph and are tracked for a later dependency cycle; the gate intentionally fails only at High/Critical severity.

An unfiltered `npm audit` still reports High findings in development-only tooling (notably Lighthouse and its transitive utilities). Those packages are omitted from the production gate and do not ship in the server dependency closure; revisit them in a separate tooling-upgrade cycle.

## Remediated paths

- Next and `eslint-config-next` are aligned on the patched 16.3.0 release.
- `next-auth` is pinned to the beta.32 release line.
- The unused `@google/gemini-cli` dependency and its legacy Google transport subtree are removed.
- Axios resolves to 1.19.0 through the existing Google Maps/wait-on ranges.
- Nodemailer 9.0.5 is installed as the `nodemailer-patched` npm alias. Auth.js beta.32 declares `nodemailer` 7/8 as an optional peer, so the alias keeps the patched transport while leaving that unused optional peer absent and keeping `npm ci`/`npm ls` valid. Runtime email and SMTP preflight imports both use the alias; `@types/nodemailer` is development-only.
- The unused `isomorphic-dompurify` wrapper was removed. The production `brace-expansion` and `fast-uri` paths are pinned through narrowly scoped npm overrides to patched versions compatible with their current parents.

## Verification

Run the focused auth/Classroom/commute/email checks through `npm run test:security`, which includes `test:session-token-boundary` and `test:email-transport-boundary`. Then run `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Prisma projects must run `npm run db:generate` after an install performed with `--ignore-scripts` before typechecking or building.

SMTP authentication remains a production-only check when local credentials are unavailable; `npm run preflight:integrations` is read-only and must not be used as a mail-send test.

Related maintainer pages: `docs/wiki/index.md`, `docs/wiki/security/invariants.md`, and `docs/wiki/tests/verification-map.md`.
