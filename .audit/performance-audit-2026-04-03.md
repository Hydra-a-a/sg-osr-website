# Performance Audit - 2026-04-03

## Scope
- App routes audited: `/`, `/directory`, `/services`, `/login`
- Metrics requested: Lighthouse Performance, CWV (LCP, CLS, INP), TTFB, page weight, budget compliance

## Test Method
- Build mode: production (`npm run build`)
- Server mode: production (`npm run start -- -p 3001`)
- Tool: Lighthouse CLI mobile profile
- Command profile: `--preset=perf --only-categories=performance --form-factor=mobile --throttling-method=simulate`

## Important Note About INP
- Lighthouse navigation runs did not produce a usable INP value for these local tests (`null` in all reports).
- This is expected when there is no real interaction stream in a navigation-only audit.
- INP should be validated with field telemetry (real-user monitoring) or Lighthouse User Flows timespan interactions.

## Budget Targets
- Total page weight: <= 1200 KB
- JavaScript: <= 350 KB (compressed transfer target)
- Images: <= 500 KB
- Requests: <= 80
- LCP: <= 2500 ms
- CLS: <= 0.10
- INP: <= 200 ms
- TTFB: <= 800 ms

## Route Results (Production)

| Route | Perf | FCP | LCP | CLS | INP | TBT | TTFB | Requests | Lighthouse Total | JS Bundle (raw) | JS Bundle (gzip est.) | Adjusted Total* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| / | 98 | 886 ms | 2045 ms | 0.000 | N/A | 0 ms | 134 ms | 17 | 139.1 KB | 716.3 KB | 215.7 KB | 354.8 KB |
| /directory | 100 | 771 ms | 1671 ms | 0.000 | N/A | 7 ms | 17 ms | 17 | 109.4 KB | 1162.1 KB | 342.1 KB | 451.5 KB |
| /services | 99 | 810 ms | 1816 ms | 0.000 | N/A | 113 ms | 24 ms | 16 | 110.0 KB | 710.1 KB | 211.2 KB | 321.1 KB |
| /login | 100 | 761 ms | 1811 ms | 0.000 | N/A | 0 ms | 15 ms | 16 | 108.1 KB | 689.8 KB | 206.1 KB | 314.2 KB |

`* Adjusted Total = Lighthouse Total + estimated compressed JS bundle size.`

## Budget Compliance Summary
- LCP: PASS on all audited routes
- CLS: PASS on all audited routes
- TTFB: PASS on all audited routes
- Requests: PASS on all audited routes
- Total page weight: PASS on all audited routes
- JavaScript budget (<=350 KB compressed target):
  - PASS: `/`, `/services`, `/login`
  - BORDERLINE: `/directory` at 342.1 KB gzip-estimated
- INP: NOT DETERMINED in navigation-only local audit

## Key Findings
1. Production performance is strong and within CWV-like thresholds for LCP/CLS/TTFB on all tested routes.
2. `/directory` is the heaviest JavaScript route and is close to the 350 KB compressed JS budget.
3. Earlier poor results (LCP ~7-8s and large unused JS findings) were from development mode and should not be used for release decisions.

## Priority Recommendations
1. Protect the JS budget on `/directory` by code-splitting heavy client features and reducing route-level client dependencies.
2. Add field RUM for INP measurement (web-vitals collection to analytics) so interaction quality is continuously tracked.
3. Add CI performance gates using Lighthouse CI with budget assertions to prevent regressions.

## Artifacts
- `.audit/lh-prod-home-mobile.json`
- `.audit/lh-prod-directory-mobile.json`
- `.audit/lh-prod-services-mobile.json`
- `.audit/lh-prod-login-mobile.json`
- `.audit/performance-audit-2026-04-03.md`
