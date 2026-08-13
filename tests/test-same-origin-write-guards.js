const { assert, read } = require('./_security-baseline-helpers');

const guard = read('lib/request-guards.ts');

assert(
  guard.includes('requireSameOriginRequest'),
  'same-origin guard should expose a reusable request guard.'
);

assert(
  guard.includes("request.headers.get('origin')"),
  'same-origin guard should validate the browser Origin header.'
);

assert(
  guard.includes('AUTH_URL') && guard.includes('NEXTAUTH_URL'),
  'same-origin guard should honor the configured production auth origin.'
);

assert(
  guard.includes("new ApiError(403, 'FORBIDDEN', 'Forbidden')"),
  'same-origin guard should fail with a generic forbidden error.'
);

const guardedMutationRoutes = [
  'app/api/admin/routes/route.ts',
  'app/api/admin/access/route.ts',
  'app/api/admin/tickets/route.ts',
  'app/api/admin/proposals/route.ts',
  'app/api/admin/lost-found/route.ts',
  'app/api/admin/lost-found/comments/route.ts',
  'app/api/forms/route.ts',
  'app/api/tickets/route.ts',
  'app/api/tickets/[id]/comments/route.ts',
  'app/api/proposals/route.ts',
  'app/api/proposals/[id]/comments/route.ts',
  'app/api/classroom/submissions/route.ts',
  'app/api/hub/commute/submit/route.ts',
  'app/api/hub/commute/issue/route.ts',
  'app/api/hub/commute/vote/route.ts',
  'app/api/hub/lost-found/route.ts',
  'app/api/hub/lost-found/[itemId]/comments/route.ts',
  'app/api/admin/directory/route.ts',
  'app/api/admin/directory/export/route.ts',
  'app/api/admin/content/[contentType]/route.ts',
  'app/api/admin/content/[contentType]/[id]/route.ts',
  'app/api/admin/content/[contentType]/[id]/publish/route.ts',
  'app/api/admin/content/directory/[id]/logo-draft/route.ts',
  'app/api/admin/news/sync/route.ts',
];

guardedMutationRoutes.forEach((route) => {
  const source = read(route);
  assert(
    source.includes("import { requireSameOriginRequest } from '@/lib/request-guards'"),
    `${route} should import the shared same-origin guard.`
  );
  assert(
    source.includes('requireSameOriginRequest(request)'),
    `${route} should call the shared same-origin guard before mutation work.`
  );
});

const secretOrPublicMutationRoutes = [
  'app/api/webhooks/make/route.ts',
  'app/api/news/sync/route.ts',
  'app/api/tickets/queue/enqueue/route.ts',
  'app/api/tickets/queue/process/route.ts',
  'app/api/tickets/sync-updates/route.ts',
  'app/api/proposals/queue/process/route.ts',
  'app/api/hub/commute/route.ts',
  'app/api/telemetry/route.ts',
];

secretOrPublicMutationRoutes.forEach((route) => {
  const source = read(route);
  assert(
    !source.includes('requireSameOriginRequest'),
    `${route} should not use the browser same-origin guard; it should remain public or secret/HMAC guarded.`
  );
});

console.log('test-same-origin-write-guards: PASS');
