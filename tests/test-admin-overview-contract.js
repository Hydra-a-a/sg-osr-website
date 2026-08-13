const { assert, read } = require('./_security-baseline-helpers');

const provider = read('lib/admin-overview.ts');
const route = read('app/api/admin/overview/route.ts');

for (const key of ['grievances', 'proposals', 'routes', 'lost-found', 'users', 'directory']) {
  assert(provider.includes(`'${key}'`), `Admin overview should define the ${key} module.`);
}

for (const field of ['source', 'health', 'total', 'queued', 'attention', 'checkedAt']) {
  assert(provider.includes(`${field}:`), `Admin overview summaries should expose ${field}.`);
}

assert(provider.includes('Promise.allSettled'), 'Admin overview providers should degrade independently when one source fails.');
assert(provider.includes("health: 'unavailable'"), 'Failed overview providers should return unavailable summaries.');
assert(provider.includes("source: 'neon'") && provider.includes("source: 'sheets'"), 'Overview providers should declare their source boundary.');
assert(!/\n\s+(email|name|title):/.test(provider), 'Overview summaries must not expose PII or record content.');

assert(route.includes('deriveEffectivePortalRole'), 'Admin overview should use the effective officer mode for authorization.');
assert(route.includes("effectiveRole !== 'officer'"), 'Admin overview should be officer-only.');
assert(route.includes('checkRateLimit'), 'Admin overview should be rate limited.');
assert(route.includes('Cache-Control'), 'Admin overview responses should be marked no-store.');
assert(route.includes('redactErrorForLog'), 'Admin overview failures should use redacted logging.');
assert(route.includes("new ApiError(500, 'INTERNAL_SERVER_ERROR'"), 'Unexpected overview failures should use a redacted error envelope.');
assert(route.includes('allProvidersUnavailable') && route.includes('status: allProvidersUnavailable ? 503 : 200'), 'The overview should return 503 only when every provider is unavailable.');
assert(!route.includes('request.json'), 'Admin overview GET should not parse an untrusted request body.');

console.log('test-admin-overview-contract: PASS');
