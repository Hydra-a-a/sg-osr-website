const { assert, read } = require('./_security-baseline-helpers');

const source = read('app/api/debug-auth/route.ts');

assert(
  source.includes('ENABLE_AUTH_DEBUG_ROUTE'),
  'debug auth diagnostics should require an explicit development flag.'
);

assert(
  /process\.env\.NODE_ENV\s*!==\s*['"]production['"]/.test(source),
  'debug auth diagnostics should be disabled in production.'
);

assert(
  /status:\s*404/.test(source),
  'disabled debug auth diagnostics should return a not-found response.'
);

assert(
  source.includes("Cache-Control', 'no-store"),
  'debug auth diagnostics should set no-store on responses.'
);

const guardIndex = source.indexOf('if (!isDebugAuthRouteEnabled())');
const usersIndex = source.indexOf('getAuthorizedUsers()');
assert(
  guardIndex >= 0 && usersIndex > guardIndex,
  'debug auth diagnostics should check the gate before loading auth sheet data.'
);

assert(
  !source.includes('error instanceof Error ? error.message : String(error)'),
  'debug auth diagnostics should not return raw exception messages.'
);

console.log('test-debug-auth-route-gating: PASS');
