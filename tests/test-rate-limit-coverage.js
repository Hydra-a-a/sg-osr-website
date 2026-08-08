const { assert, read } = require('./_security-baseline-helpers');

function assertRateLimited(route, expectedKeyFragment) {
  const source = read(route);

  assert(
    source.includes('checkRateLimit') || source.includes('rateLimit(') || source.includes('checkAuthRateLimit'),
    `${route} should use an application rate limiter.`
  );
  assert(
    source.includes('rateLimitResponse') ||
      source.includes('429') && source.includes('RATE_LIMITED') ||
      source.includes('429') && source.includes('Too many'),
    `${route} should return a throttled response when the limit is exceeded.`
  );
  assert(
    source.includes(expectedKeyFragment),
    `${route} should use a scoped rate-limit key containing ${expectedKeyFragment}.`
  );
}

assertRateLimited('app/api/auth/[...nextauth]/route.ts', 'checkAuthRateLimit');
assertRateLimited('app/api/forms/route.ts', 'forms_api_');
assertRateLimited('app/api/tickets/route.ts', 'tickets_api_');
assertRateLimited('app/api/tickets/[id]/route.ts', 'ticket_lookup_');
assertRateLimited('app/api/proposals/route.ts', 'proposals_');
assertRateLimited('app/api/webhooks/make/route.ts', 'webhook_make_api_');
assertRateLimited('app/api/news/sync/route.ts', 'news_sync_');
assertRateLimited('app/api/admin/access/route.ts', 'admin_access_');
assertRateLimited('app/api/hub/commute/route.ts', 'commute_maps_');
assertRateLimited('app/api/hub/commute/submit/route.ts', 'commute_submit_');
assertRateLimited('app/api/hub/commute/issue/route.ts', 'commute_issue_');
assertRateLimited('app/api/telemetry/route.ts', 'telemetry_');
assertRateLimited('app/api/hub/lost-found/route.ts', 'lost_found_');
assertRateLimited('app/api/hub/lost-found/[itemId]/comments/route.ts', 'lost_found_comments_');
assertRateLimited('app/api/hub/lost-found/media/[attachmentId]/route.ts', 'lost_found_media_');
assertRateLimited('app/api/admin/lost-found/route.ts', 'admin_lost_found_');
assertRateLimited('app/api/admin/lost-found/comments/route.ts', 'admin_lost_found_comment_');
assertRateLimited('app/api/admin/lost-found/media/[attachmentId]/route.ts', 'admin_lost_found_media_');
assertRateLimited('app/api/admin/directory/route.ts', 'admin_directory_');
assertRateLimited('app/api/admin/directory/export/route.ts', 'admin_directory_export_');
assertRateLimited('app/api/cron/directory-export/route.ts', 'directory_export_cron_');

const authRoute = read('app/api/auth/[...nextauth]/route.ts');
assert(
  authRoute.includes("pathname.includes('/api/auth/callback/')"),
  'auth route should only throttle authentication callback POSTs.'
);
assert(
  authRoute.includes('Retry-After'),
  'auth rate-limit response should include Retry-After.'
);

const rateLimit = read('lib/rate-limit.ts');
assert(
  rateLimit.includes('UPSTASH_REDIS_REST_URL') && rateLimit.includes('UPSTASH_REDIS_REST_TOKEN'),
  'rate limiter should use the shared Redis limiter when configured.'
);
assert(
  rateLimit.includes('return rateLimit(identifier, limit, windowMs)'),
  'rate limiter should keep the in-memory fallback for local development.'
);

console.log('test-rate-limit-coverage: PASS');
