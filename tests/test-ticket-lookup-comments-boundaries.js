const { assert, read } = require('./_security-baseline-helpers');

const ticketLookupRouteSource = read('app/api/tickets/[id]/route.ts');
assert.ok(
  ticketLookupRouteSource.includes("@/features/tickets/server/access"),
  'ticket lookup route should import from features/tickets/server/access.'
);
assert.ok(
  !ticketLookupRouteSource.includes("from '@/lib/tickets'"),
  'ticket lookup route should not import lookupTicketByIdForOwner directly from lib/tickets.'
);

const ticketMineRouteSource = read('app/api/tickets/mine/route.ts');
assert.ok(
  ticketMineRouteSource.includes("@/features/tickets/server/access"),
  'ticket mine route should import from features/tickets/server/access.'
);
assert.ok(
  !ticketMineRouteSource.includes("from '@/lib/tickets'"),
  'ticket mine route should not import listTicketsByOwnerEmail directly from lib/tickets.'
);

const commentsRouteSource = read('app/api/tickets/[id]/comments/route.ts');
assert.ok(
  commentsRouteSource.includes("@/features/tickets/server/comments"),
  'ticket comments route should import from features/tickets/server/comments.'
);
assert.ok(
  !commentsRouteSource.includes('function resolveCommentAccess('),
  'comments route should not define resolveCommentAccess directly.'
);
assert.ok(
  !commentsRouteSource.includes('function transitionTicketToAppealedIfNeeded('),
  'comments route should not define transitionTicketToAppealedIfNeeded directly.'
);
assert.ok(
  !commentsRouteSource.includes('function lookupTicketNotificationRow('),
  'comments route should not define lookupTicketNotificationRow directly.'
);
assert.ok(
  !commentsRouteSource.includes('function buildSyntheticStatusHistoryComment('),
  'comments route should not define buildSyntheticStatusHistoryComment directly.'
);
assert.ok(
  !commentsRouteSource.includes('const TicketCommentSchema = z.object('),
  'comments route should not define TicketCommentSchema directly.'
);

assert.ok(
  commentsRouteSource.includes('requireSameOriginRequest(request)'),
  'comments route should retain requireSameOriginRequest(request).'
);
assert.ok(
  commentsRouteSource.includes('checkRateLimit'),
  'comments route should retain rate limiting checks.'
);
assert.ok(
  commentsRouteSource.includes('auth('),
  'comments route should retain auth/session handling.'
);
assert.ok(
  commentsRouteSource.includes("@/lib/api-responses"),
  'comments route should use shared no-store response helpers.'
);

const commentsModuleSource = read('features/tickets/server/comments.ts');
assert.ok(
  commentsModuleSource.includes('appendGrievanceComment'),
  'comments feature module should include appendGrievanceComment.'
);
assert.ok(
  commentsModuleSource.includes('buildTicketStatusHistoryMessage'),
  'comments feature module should include buildTicketStatusHistoryMessage usage.'
);
assert.ok(
  commentsModuleSource.includes('lookupTicketByIdForOwner'),
  'comments feature module should include lookupTicketByIdForOwner usage.'
);
assert.ok(
  commentsModuleSource.includes('batchUpdateSheetData'),
  'comments feature module should include batchUpdateSheetData usage.'
);
assert.ok(
  commentsModuleSource.includes('getSheetData'),
  'comments feature module should include getSheetData usage.'
);
assert.ok(
  commentsModuleSource.includes('uploadTicketAttachmentToDrive'),
  'comments feature module should include uploadTicketAttachmentToDrive usage.'
);

const accessModuleSource = read('features/tickets/server/access.ts');
assert.ok(
  accessModuleSource.includes('lookupTicketByIdForOwner'),
  'access feature module should include lookupTicketByIdForOwner.'
);
assert.ok(
  accessModuleSource.includes('listTicketsByOwnerEmail'),
  'access feature module should include listTicketsByOwnerEmail.'
);

console.log('test-ticket-lookup-comments-boundaries: PASS');
