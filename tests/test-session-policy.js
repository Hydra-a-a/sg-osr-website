const { assert, read } = require('./_security-baseline-helpers');

const policy = read('docs/security/session-policy.md');
const baseline = read('docs/security/auth-baseline-map.md');
const authConfig = read('lib/auth.config.ts');
const auth = read('lib/auth.ts');

assert(
  policy.includes('Session Policy'),
  'session policy should have a clear title.'
);

assert(
  policy.includes('JWT-only with documented residual risk'),
  'session policy should explicitly state the current JWT-only decision and residual risk.'
);

assert(
  policy.includes('8 hours'),
  'session policy should document the current session lifetime.'
);

assert(
  policy.includes('5 minutes'),
  'session policy should document the current authorized-user cache lifetime.'
);

assert(
  policy.includes('Server-side revocation is not required in this phase'),
  'session policy should state that server-side revocation is deferred for this phase.'
);

assert(
  policy.includes('Revocation Upgrade Trigger'),
  'session policy should define when server-side revocation becomes required.'
);

assert(
  /strategy:\s*['"]jwt['"]/.test(authConfig),
  'auth config should continue to use JWT sessions for the documented policy.'
);

assert(
  /maxAge:\s*8\s*\*\s*60\s*\*\s*60/.test(authConfig),
  'auth config should keep the documented 8-hour session max age visible.'
);

assert(
  /CACHE_TTL\s*=\s*5\s*\*\s*60\s*\*\s*1000/.test(auth),
  'auth role-source cache should remain bounded at the documented 5-minute TTL.'
);

assert(
  auth.includes('getAuthorizedUsers()') && auth.includes('token.role = userData.role'),
  'JWT callback should continue refreshing role data from the authorized-user source.'
);

assert(
  auth.includes('authAccessSessionVersion') && auth.includes('previousSessionVersion !== userData.sessionVersion'),
  'JWT callback should downgrade stale DB-backed sessions after auth session version changes.'
);

assert(
  baseline.includes('docs/security/session-policy.md'),
  'auth baseline map should link to the session policy decision.'
);

console.log('test-session-policy: PASS');
