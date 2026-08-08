const { assert, read } = require('./_security-baseline-helpers');

const proposalsRouteSource = read('app/api/proposals/route.ts');
const proposalLookupRouteSource = read('app/api/proposals/[id]/route.ts');
const proposalCommentsRouteSource = read('app/api/proposals/[id]/comments/route.ts');

assert.ok(
  proposalsRouteSource.includes("@/features/proposals/server/create-proposal"),
  'proposals route should import create-proposal feature module.'
);
assert.ok(
  proposalsRouteSource.includes("@/features/proposals/server/access"),
  'proposals route should import proposal access feature module.'
);
assert.ok(
  proposalsRouteSource.includes("@/features/proposals/server/attachments"),
  'proposals route should import proposal attachments feature module.'
);
assert.ok(
  proposalsRouteSource.includes("@/features/proposals/schema"),
  'proposals route should import proposal schema module.'
);
assert.ok(
  !proposalsRouteSource.includes('function validateAttachment('),
  'proposals route should not define attachment validation inline.'
);
assert.ok(
  !proposalsRouteSource.includes('uploadProposalAttachmentToDrive'),
  'proposals route should not upload attachments directly.'
);
assert.ok(
  proposalsRouteSource.includes('requireSameOriginRequest(request)'),
  'proposals route should retain same-origin guard.'
);
assert.ok(
  proposalsRouteSource.includes('checkRateLimit'),
  'proposals route should retain rate limiting checks.'
);
assert.ok(
  proposalsRouteSource.includes("@/lib/api-responses"),
  'proposals route should use shared no-store response helpers.'
);

assert.ok(
  proposalLookupRouteSource.includes("@/features/proposals/server/access"),
  'proposal lookup route should use proposal access feature module.'
);
assert.ok(
  proposalLookupRouteSource.includes('resolveProposalAccess'),
  'proposal lookup route should delegate proposal access resolution.'
);
assert.ok(
  proposalLookupRouteSource.includes('checkRateLimit'),
  'proposal lookup route should retain rate limiting checks.'
);
assert.ok(
  proposalLookupRouteSource.includes("@/lib/api-responses"),
  'proposal lookup route should use shared no-store response helpers.'
);

assert.ok(
  proposalCommentsRouteSource.includes("@/features/proposals/server/comments"),
  'proposal comments route should import proposal comments feature module.'
);
assert.ok(
  proposalCommentsRouteSource.includes("@/features/proposals/schema"),
  'proposal comments route should import proposal schema module.'
);
assert.ok(
  !proposalCommentsRouteSource.includes('function validateAttachment('),
  'proposal comments route should not define attachment validation inline.'
);
assert.ok(
  !proposalCommentsRouteSource.includes('uploadProposalAttachmentToDrive'),
  'proposal comments route should not upload attachments directly.'
);
assert.ok(
  proposalCommentsRouteSource.includes('requireSameOriginRequest(request)'),
  'proposal comments route should retain same-origin guard.'
);
assert.ok(
  proposalCommentsRouteSource.includes('checkRateLimit'),
  'proposal comments route should retain rate limiting checks.'
);
assert.ok(
  proposalCommentsRouteSource.includes("@/lib/api-responses"),
  'proposal comments route should use shared no-store response helpers.'
);

const createProposalSource = read('features/proposals/server/create-proposal.ts');
assert.ok(
  createProposalSource.includes('uploadProposalAttachmentToDrive'),
  'create-proposal module should own attachment upload.'
);
assert.ok(
  createProposalSource.includes('appendSheetData'),
  'create-proposal module should own proposal sheet writes.'
);
assert.ok(
  createProposalSource.includes('emitProposalSubmissionNotifications'),
  'create-proposal module should own submission notification emission.'
);
assert.ok(
  createProposalSource.includes('safeProcessImmediateNotifications'),
  'create-proposal module should own immediate queue processing fallback.'
);

const commentsModuleSource = read('features/proposals/server/comments.ts');
const accessModuleSource = read('features/proposals/server/access.ts');
const appendProposalCommentOrchestrationSource = commentsModuleSource.slice(
  commentsModuleSource.indexOf('export async function appendProposalCommentOrchestration')
);
assert.ok(
  accessModuleSource.includes("throw new ApiError(403, 'FORBIDDEN', 'Leader or officer mode is required.')"),
  'proposal access module should preserve forbidden response for authenticated users outside leader/officer mode.'
);
assert.ok(
  commentsModuleSource.includes('appendProposalComment'),
  'proposal comments module should own comment persistence.'
);
assert.ok(
  /assertProposalAccess\(access\);\s+let attachmentUrl/.test(appendProposalCommentOrchestrationSource) &&
    appendProposalCommentOrchestrationSource.indexOf('assertProposalAccess(access);') <
      appendProposalCommentOrchestrationSource.indexOf('await appendProposalComment'),
  'proposal comments module should verify proposal access before upload or comment persistence side effects.'
);
assert.ok(
  commentsModuleSource.includes('emitProposalCommentNotifications'),
  'proposal comments module should own comment notification emission.'
);
assert.ok(
  commentsModuleSource.includes('safeProcessImmediateNotifications'),
  'proposal comments module should own immediate queue processing fallback.'
);

console.log('test-proposal-feature-boundaries: PASS');
