const { assert, read } = require('./_security-baseline-helpers');

const helperSource = read('lib/api-responses.ts');

assert.ok(
  helperSource.includes("response.headers.set('Cache-Control', 'no-store')"),
  'api response helpers should own the shared no-store header.'
);

assert.ok(
  helperSource.includes("new ApiError(429, 'RATE_LIMITED', message)") &&
    helperSource.includes("response.headers.set('Retry-After', String(limit.retryAfter))"),
  'api response helpers should build rate-limit responses with Retry-After when available.'
);

console.log('test-api-response-helpers: PASS');
