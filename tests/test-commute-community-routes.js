const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const commuteSchema = read(path.join('schemas', 'commute.ts'));
const providerSource = read(path.join('lib', 'commute-providers.ts'));
const commutePageSource = read(path.join('app', 'hub', 'commute', 'page.tsx'));
const contributePageSource = read(path.join('app', 'hub', 'commute', 'contribute', 'page.tsx'));
const adminRoutesSource = read(path.join('app', 'services', 'admin', 'routes', 'page.tsx'));
const voteApiSource = read(path.join('app', 'api', 'hub', 'commute', 'vote', 'route.ts'));
const submitApiSource = read(path.join('app', 'api', 'hub', 'commute', 'submit', 'route.ts'));
const adminRoutesApiSource = read(path.join('app', 'api', 'admin', 'routes', 'route.ts'));
const adminHubSource = read(path.join('app', 'services', 'admin', 'page.tsx'));
const adminNavigationSource = read(path.join('components', 'admin', 'admin-navigation.ts'));

assert(commuteSchema.includes('ContributorSubmissionSchema'), 'Commute schema should define ContributorSubmissionSchema.');
assert(commuteSchema.includes('LeaderboardEntrySchema'), 'Commute schema should define LeaderboardEntrySchema.');
assert(commuteSchema.includes('healthStatus'), 'Commute schema should expose route health status.');
assert(commuteSchema.includes('healthReason'), 'Commute schema should expose route health reason.');
assert(commuteSchema.includes('reviewBadgeLabel'), 'Commute schema should expose a review badge label.');
assert(providerSource.includes("'Commuter Routes'!A2:AA"), 'Commute provider should read the coordinate-ready commuter routes sheet range.');
assert(providerSource.includes('getLeaderboard'), 'Commute provider should export getLeaderboard.');
assert(providerSource.includes('rowNumber'), 'Commute provider should expose rowNumber-backed route identity.');
assert(providerSource.includes('flagged') && providerSource.includes('aging'), 'Commute provider should derive route health states.');
assert(providerSource.includes('duplicate') || providerSource.includes('similar'), 'Commute provider should protect against duplicate-ish submissions.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'api', 'hub', 'commute', 'submit', 'route.ts')), 'Route submission API should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'api', 'hub', 'commute', 'vote', 'route.ts')), 'Route vote API should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'api', 'hub', 'commute', 'leaderboard', 'route.ts')), 'Leaderboard API should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'api', 'hub', 'commute', 'issue', 'route.ts')), 'Route issue API should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'api', 'admin', 'routes', 'route.ts')), 'Admin routes moderation API should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'hub', 'commute', 'contribute', 'page.tsx')), 'Commute contribute page should exist.');
assert(fs.existsSync(path.join(__dirname, '..', 'app', 'hub', 'commute', 'leaderboard', 'page.tsx')), 'Commute leaderboard page should exist.');
assert(commutePageSource.includes('Mapped by'), 'Commute page should show contributor credit.');
assert(commutePageSource.includes('localStorage'), 'Commute page should keep vote state in localStorage.');
assert(commutePageSource.includes('/hub/commute/contribute'), 'Commute page should link to the contribute flow.');
assert(commutePageSource.includes('/hub/commute/leaderboard'), 'Commute page should link to the leaderboard.');
assert(commutePageSource.includes('healthStatus') || commutePageSource.includes('Route status') || commutePageSource.includes('Needs review'), 'Commute page should communicate route health.');
assert(commutePageSource.includes('/api/hub/commute/issue') || commutePageSource.includes('Report an issue'), 'Commute page should allow route issue reporting.');
assert(contributePageSource.includes('review summary') || contributePageSource.includes('Review before submit') || contributePageSource.includes('Sanity-check'), 'Contribute page should include a pre-submit review summary.');
assert(submitApiSource.includes('duplicate') || submitApiSource.includes('similar'), 'Submit API should surface duplicate submission outcomes.');
assert(voteApiSource.includes('INVALID_VOTE_TARGET') || voteApiSource.includes('already voted'), 'Vote API should distinguish invalid targets or repeat votes.');
assert(adminRoutesApiSource.includes('RouteModerationActionSchema') || adminRoutesApiSource.includes('Mark for Review') || adminRoutesApiSource.includes('Approve with Warning') || adminRoutesApiSource.includes('Restore Confidence'), 'Admin routes API should support expanded moderation actions.');
assert(adminRoutesSource.includes('Flagged for Review'), 'Admin routes page should expose flagged review filtering.');
assert(adminRoutesSource.includes('Approve with Warning') || adminRoutesSource.includes('Restore Confidence'), 'Admin routes page should expose expanded moderation actions.');
assert(adminHubSource.includes('adminNavigationItems') && adminNavigationSource.includes('/services/admin/routes'), 'Admin hub should link to route moderation.');

console.log('test-commute-community-routes: PASS');
