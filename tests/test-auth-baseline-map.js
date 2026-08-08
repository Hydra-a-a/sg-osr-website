const { assert, read } = require('./_security-baseline-helpers');

const map = read('docs/security/auth-baseline-map.md');
const proxy = read('proxy.ts');

assert(
  map.includes('Auth Baseline Map'),
  'auth baseline map should have a clear title.'
);

assert(
  map.includes('| Route | Methods | Classification | Required control | Cache posture | Abuse control | Confidence | Notes |'),
  'auth baseline map should include the route matrix columns.'
);

[
  '/api/admin/tickets',
  '/api/tickets/[id]/comments',
  '/api/proposals/[id]/comments',
  '/api/classroom/submissions',
  '/api/webhooks/make',
  '/api/debug-auth',
].forEach((route) => {
  assert(
    map.includes(route),
    `auth baseline map should classify ${route}.`
  );
});

assert(
  map.includes('CSRF/origin') || map.includes('origin/CSRF'),
  'auth baseline map should track origin/CSRF posture for state-changing routes.'
);

assert(
  map.includes('confidence') || map.includes('Confidence'),
  'auth baseline map should preserve confidence scoring.'
);

assert(
  proxy.includes("normalizedPathname.startsWith('/api/')"),
  'proxy should still make it clear that API route auth is handler-owned.'
);

console.log('test-auth-baseline-map: PASS');
