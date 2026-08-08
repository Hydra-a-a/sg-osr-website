const { assert, read } = require('./_security-baseline-helpers');

function assertNoStore(route) {
  const source = read(route);
  assert(
    (source.includes('Cache-Control') && /no-store/i.test(source)) ||
      source.includes("@/lib/api-responses"),
    `${route} should mark sensitive responses as Cache-Control: no-store.`
  );
}

function assertPublicCache(route) {
  const source = read(route);
  assert(
    source.includes('Cache-Control') && /public/i.test(source),
    `${route} should keep an explicit public cache policy.`
  );
}

const sensitiveApiRoutes = [
  'app/api/debug-auth/route.ts',
  'app/api/admin/routes/route.ts',
  'app/api/admin/access/route.ts',
  'app/api/admin/tickets/route.ts',
  'app/api/admin/proposals/route.ts',
  'app/api/admin/lost-found/route.ts',
  'app/api/admin/lost-found/comments/route.ts',
  'app/api/admin/lost-found/media/[attachmentId]/route.ts',
  'app/api/tickets/route.ts',
  'app/api/tickets/mine/route.ts',
  'app/api/tickets/[id]/route.ts',
  'app/api/tickets/[id]/comments/route.ts',
  'app/api/tickets/queue/enqueue/route.ts',
  'app/api/tickets/queue/process/route.ts',
  'app/api/tickets/sync-updates/route.ts',
  'app/api/proposals/route.ts',
  'app/api/proposals/[id]/route.ts',
  'app/api/proposals/[id]/comments/route.ts',
  'app/api/proposals/queue/process/route.ts',
  'app/api/forms/route.ts',
  'app/api/classroom/courses/route.ts',
  'app/api/classroom/courses/[courseId]/coursework/route.ts',
  'app/api/classroom/submissions/route.ts',
  'app/api/hub/commute/leaderboard/route.ts',
  'app/api/hub/commute/submit/route.ts',
  'app/api/hub/commute/issue/route.ts',
  'app/api/hub/commute/vote/route.ts',
  'app/api/hub/lost-found/route.ts',
  'app/api/hub/lost-found/[itemId]/comments/route.ts',
  'app/api/webhooks/make/route.ts',
  'app/api/news/sync/route.ts',
  'app/api/admin/directory/route.ts',
  'app/api/admin/directory/export/route.ts',
  'app/api/cron/directory-export/route.ts',
];

sensitiveApiRoutes.forEach(assertNoStore);

const intentionallyPublicCachedRoutes = [
  'app/api/announcements/route.ts',
  'app/api/news/route.ts',
  'app/api/directory/logos/[fileId]/route.ts',
  'app/api/hub/guides/preview/[fileId]/route.ts',
  'app/api/hub/lost-found/media/[attachmentId]/route.ts',
];

intentionallyPublicCachedRoutes.forEach(assertPublicCache);

const publicIsrRoutes = [
  'app/api/config/links/route.ts',
  'app/api/directory/route.ts',
  'app/api/directory/offices/route.ts',
  'app/api/directory/student-organizations/route.ts',
];

publicIsrRoutes.forEach((route) => {
  const source = read(route);
  assert(
    source.includes('export const revalidate = 3600'),
    `${route} should remain an ISR-backed public data endpoint.`
  );
});

console.log('test-sensitive-api-cache-policy: PASS');
