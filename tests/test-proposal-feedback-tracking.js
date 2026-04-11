const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const proposalsLibSource = read(path.join('lib', 'proposals.ts'));
assert(proposalsLibSource.includes("export const PROPOSAL_DISCUSSIONS_TAB = 'Project_Proposal_Discussions';"), 'Proposal library should define the discussions tab.');
assert(proposalsLibSource.includes('export const PROPOSAL_NOTIFICATION_QUEUE_TAB'), 'Proposal library should define the proposal notification queue tab.');
assert(proposalsLibSource.includes('export async function enqueueProposalNotificationEvent'), 'Proposal library should expose queue enqueue support.');
assert(proposalsLibSource.includes('export async function processProposalNotificationQueue'), 'Proposal library should expose queue processing support.');
assert(proposalsLibSource.includes('export function formatProposalId'), 'Proposal library should format public proposal IDs.');
assert(proposalsLibSource.includes('export function parseProposalId'), 'Proposal library should parse public proposal IDs.');
assert(proposalsLibSource.includes('export function generateProposalTrackingToken'), 'Proposal library should generate secure proposal tracking tokens.');
assert(proposalsLibSource.includes('export function hashProposalTrackingToken'), 'Proposal library should hash proposal tracking tokens.');
assert(proposalsLibSource.includes('verifyProposalTrackingToken'), 'Proposal library should verify proposal tracking tokens.');

const proposalsRouteSource = read(path.join('app', 'api', 'proposals', 'route.ts'));
assert(proposalsRouteSource.includes('export async function GET'), 'Proposals route should support submitter-scoped listing.');
assert(proposalsRouteSource.includes('extractRowNumberFromUpdatedRange'), 'Proposal submission route should extract the appended row number.');
assert(proposalsRouteSource.includes('proposalId'), 'Proposal submission route should return a proposal tracker ID.');
assert(proposalsRouteSource.includes('trackingAccessToken'), 'Proposal submission route should return the raw proposal access token once.');
assert(proposalsRouteSource.includes('hashProposalTrackingToken(trackingToken)'), 'Proposal submission route should persist only a hashed proposal tracking token.');

const proposalLookupRouteSource = read(path.join('app', 'api', 'proposals', '[id]', 'route.ts'));
assert(proposalLookupRouteSource.includes('lookupProposalByIdForOwner'), 'Proposal lookup route should enforce ownership-aware access.');
assert(proposalLookupRouteSource.includes('parseProposalId'), 'Proposal lookup route should validate proposal IDs.');
assert(proposalLookupRouteSource.includes("searchParams.get('access')"), 'Proposal lookup route should accept an access token query parameter.');

const proposalCommentsRouteSource = read(path.join('app', 'api', 'proposals', '[id]', 'comments', 'route.ts'));
assert(proposalCommentsRouteSource.includes('const ProposalCommentSchema = z.object'), 'Proposal comments route should validate the discussion payload.');
assert(proposalCommentsRouteSource.includes('appendProposalComment'), 'Proposal comments route should persist discussion entries.');
assert(proposalCommentsRouteSource.includes('enqueueProposalNotificationEvent'), 'Proposal comments route should enqueue notification events.');
assert(proposalCommentsRouteSource.includes('lookupProposalByIdForOwner'), 'Proposal comments route should require proposal ownership or officer access.');
assert(proposalCommentsRouteSource.includes('trackingToken'), 'Proposal comments route should accept a proposal tracking token.');

const adminProposalsRouteSource = read(path.join('app', 'api', 'admin', 'proposals', 'route.ts'));
assert(adminProposalsRouteSource.includes('enqueueProposalNotificationEvent'), 'Admin proposal updates should enqueue notifications for submitters.');

const proposalQueueProcessRouteSource = read(path.join('app', 'api', 'proposals', 'queue', 'process', 'route.ts'));
assert(proposalQueueProcessRouteSource.includes('processProposalNotificationQueue'), 'Proposal queue process route should call the proposal queue worker.');
assert(proposalQueueProcessRouteSource.includes('PROPOSAL_STATUS_SYNC_SECRET') || proposalQueueProcessRouteSource.includes('CRON_SECRET'), 'Proposal queue process route should validate a server-side secret.');
assert(proposalQueueProcessRouteSource.includes('timingSafeEqual'), 'Proposal queue process route should compare secrets safely.');

const proposalTrackPageSource = read(path.join('app', 'services', 'proposals', 'track', 'page.tsx'));
assert(proposalTrackPageSource.includes('Proposal Tracking Hub'), 'Proposal tracker page should expose the new tracking hub heading.');
assert(proposalTrackPageSource.includes('Official Action'), 'Proposal tracker page should label verified officer responses.');
assert(proposalTrackPageSource.includes('Send Reply'), 'Proposal tracker page should let submitters continue the thread.');
assert(proposalTrackPageSource.includes('/api/proposals/${encodeURIComponent(selectedId)}/comments'), 'Proposal tracker page should call the proposal comments API.');
assert(proposalTrackPageSource.includes('saveStoredAccessToken'), 'Proposal tracker page should persist proposal access tokens locally.');
assert(proposalTrackPageSource.includes("payload.set('trackingToken'"), 'Proposal tracker page should send the proposal access token with new comments.');

const proposalSubmitPageSource = read(path.join('app', 'services', 'proposals', 'page.tsx'));
assert(proposalSubmitPageSource.includes('Open Proposal Tracker'), 'Proposal submission success state should link into the new tracker.');
assert(proposalSubmitPageSource.includes('submittedProposalId'), 'Proposal submission page should preserve the generated proposal tracker ID.');
assert(proposalSubmitPageSource.includes('submittedAccessToken'), 'Proposal submission page should preserve the generated proposal access token.');

const vercelConfigSource = read('vercel.json');
assert(vercelConfigSource.includes('/api/proposals/queue/process'), 'Vercel cron should invoke the proposal queue processor endpoint.');

console.log('test-proposal-feedback-tracking: PASS');
