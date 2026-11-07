const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function read(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// 1. Check unfurl route security boundaries
const unfurlRoute = read(path.join('app', 'api', 'admin', 'news', 'unfurl', 'route.ts'));
assert(
    unfurlRoute.includes('requireActiveDatabaseOfficer'),
    'Unfurl endpoint must require active database officer authentication.',
);
assert(
    unfurlRoute.includes('requireSameOriginRequest'),
    'Unfurl endpoint must require same-origin request guard.',
);
assert(
    unfurlRoute.includes('checkRateLimit'),
    'Unfurl endpoint must enforce rate limiting.',
);
assert(
    unfurlRoute.includes('logAuditAction'),
    'Unfurl endpoint must log audit actions.',
);

// 2. Check unfurl utility exports and parsing logic
const unfurlLib = read(path.join('lib', 'unfurl.ts'));
assert(
    unfurlLib.includes('export function extractFacebookPostId'),
    'Unfurl lib must export extractFacebookPostId.',
);
assert(
    unfurlLib.includes('export async function unfurlPostUrl'),
    'Unfurl lib must export unfurlPostUrl.',
);
assert(
    unfurlLib.includes('isTrustedUrl'),
    'Unfurl lib must validate image URLs against trusted domains.',
);

// 3. Check the protected multi-page Graph API sync contract
const syncLib = read(path.join('lib', 'facebook-news-sync.ts'));
assert(syncLib.includes("import 'server-only'"), 'Meta Page tokens must remain inside a server-only module.');
assert(
    syncLib.includes('META_PAGE_TOKEN_'),
    'News Source aliases must resolve only server-side META_PAGE_TOKEN_<PAGE_SLUG> secrets.',
);
assert(
    syncLib.includes("process.env.META_GRAPH_API_VERSION || 'v26.0'"),
    'Facebook sync must default to the pinned Graph API v26.0 contract.',
);
assert(
    syncLib.includes('timeout: 3_000'),
    'Facebook requests must use the three-second provider timeout.',
);
assert(
    syncLib.includes('Authorization: `Bearer ${accessToken}`') && !syncLib.includes("url.searchParams.set('access_token'"),
    'Meta access tokens must travel in authorization headers rather than logged URLs.',
);
assert(
    syncLib.includes('index += 3'),
    'Facebook pages must be fetched in bounded groups of three.',
);
assert(
    syncLib.includes("resolvePublicContentSource('NEWS_SOURCE')"),
    'News sync must choose one write target from NEWS_SOURCE.',
);
assert(
    syncLib.includes('hasEnabledNewsRoutingMatch') && syncLib.includes('summary.filtered += 1'),
    'Previously unseen posts must require an enabled routing hashtag.',
);
assert(
    syncLib.includes('hasSyncedNewsPostChanges') && syncLib.includes('summary.unchanged += 1'),
    'Unchanged posts must not be rewritten.',
);
assert(
    syncLib.includes('sanitizedProviderError') && !syncLib.includes('Unknown feed/Meta sync error'),
    'Provider failures must use sanitized error summaries.',
);
assert(
    !syncLib.includes('fetchPublicFeedPosts') && !syncLib.includes('FEED_URL_SSC'),
    'Production sync must use authorized Meta tokens rather than arbitrary feed URLs.',
);
assert(
    syncLib.includes('if (!dryRun)') && syncLib.includes('revalidatePublicTags([PUBLIC_CACHE_TAGS.news])'),
    'Dry runs must skip persistence and successful changes must invalidate public news caches.',
);
assert(
    syncLib.includes('export async function verifyFacebookNewsTokens') && syncLib.includes("META_APP_ACCESS_TOKEN"),
    'A protected preflight must verify configured Meta Page tokens before scheduling.',
);
assert(
    syncLib.includes('pages_read_engagement') && syncLib.includes("postsUrl.searchParams.set('limit', '1')"),
    'Token preflight must check declared Page-read permission and actual Page-post access.',
);
assert(
    !syncLib.includes('Direct database upsert skipped or failed') && !syncLib.includes('Sheets update failed'),
    'Persistence failures must propagate to the protected route for n8n retries.',
);

const syncRoute = read(path.join('app', 'api', 'news', 'sync', 'route.ts'));
assert(
    syncRoute.includes('timingSafeEqual') && syncRoute.includes("request.headers.get('authorization')"),
    'News sync must authenticate bearer secrets with timing-safe comparison.',
);
assert(
    syncRoute.includes("status: success ? 200 : 502"),
    'Partial provider failures must produce a retryable HTTP response.',
);
assert(
    syncRoute.includes("response.headers.set('Cache-Control', 'no-store')"),
    'News sync responses must never be cached.',
);
assert(
    syncRoute.includes("requestUrl.searchParams.get('verify') === '1'") && syncRoute.includes('verifyFacebookNewsTokens'),
    'The protected sync endpoint must expose verification without enabling writes.',
);
assert(
    syncRoute.includes("requestUrl.searchParams.get('includeUnrouted') === '1'") && syncRoute.includes("process.env.NODE_ENV === 'production'"),
    'The routed-post admission bypass must remain local-development-only.',
);

// 4. Check Admin Content Workspace integration
const adminWorkspace = read(path.join('components', 'admin', 'AdminContentWorkspace.tsx'));
assert(
    adminWorkspace.includes('/api/admin/news/unfurl'),
    'AdminContentWorkspace must call the news unfurl API.',
);
assert(
    adminWorkspace.includes('handleUnfurlNewsPost'),
    'AdminContentWorkspace must have handleUnfurlNewsPost.',
);

async function testNewsPolicy() {
    const news = await import(pathToFileURL(path.join(__dirname, '..', 'lib', 'news.ts')).href);
    const rules = [
        { hashtag: '#sscnews', targetPages: ['/student-government'], enabled: true, priority: 20, newsSection: 'ssc', notes: '' },
        { hashtag: '#campus', targetPages: ['/hub'], enabled: true, priority: 10, newsSection: 'campus', notes: '' },
    ];

    assert(news.hasEnabledNewsRoutingMatch(['#SSCNews'], rules), 'Hashtag matching must be case-insensitive.');
    assert(!news.hasEnabledNewsRoutingMatch(['#unrelated'], rules), 'Unknown hashtags must not pass admission gating.');

    const routed = news.resolveNewsRoutes(['#sscnews', '#campus'], rules, []);
    assert(routed.routeTargets.includes('/news'), 'Every eligible post must remain visible on /news.');
    assert(routed.routeTargets.includes('/student-government') && routed.routeTargets.includes('/hub'), 'Multiple hashtags must merge route targets.');

    const existing = news.normalizeNewsPost({
        id: 'page_123', source: 'SSC', sourcePageId: 'page', sourcePageName: 'SSC', caption: 'Original #sscnews',
        articleTitle: 'Original', articleSlug: 'stable-post-page123', articleBody: 'Original body', manualTitle: 'Officer title',
        manualBody: 'Officer body', imageUrl: '', imageAlt: 'Officer alt', publishedAt: '2026-09-01T00:00:00.000Z',
        fbLink: 'https://www.facebook.com/page/posts/123', routeTargets: ['/news', '/student-government'], section: 'ssc',
        visible: false, featured: true, sortOrder: 1, ingestedAt: '2026-09-01T00:01:00.000Z', updatedAt: '2026-09-01T00:01:00.000Z',
    });
    const incoming = news.normalizeNewsPost({
        ...existing, caption: 'Edited #sscnews', articleTitle: 'Edited', articleSlug: 'edited-post-page123',
        articleBody: 'Edited body', manualTitle: '', manualBody: '', imageAlt: '', visible: true, featured: false, sortOrder: null,
    });
    const merged = news.mergeSyncedNewsPost(existing, incoming);

    assert(merged.caption === 'Edited #sscnews' && merged.articleBody === 'Edited body', 'Facebook edits must update generated content.');
    assert(merged.manualTitle === 'Officer title' && merged.manualBody === 'Officer body', 'Facebook edits must preserve officer copy overrides.');
    assert(merged.articleSlug === 'stable-post-page123', 'Facebook edits must preserve the stable website article slug.');
    assert(merged.visible === false && merged.featured === true && merged.sortOrder === 1, 'Facebook edits must preserve officer publication controls.');
    assert(news.hasSyncedNewsPostChanges(existing, existing) === false, 'Identical posts must be classified as unchanged.');
    assert(news.hasSyncedNewsPostChanges(existing, merged) === true, 'Provider content edits must be classified as updates.');
}

const workflowPath = path.join('ops', 'n8n', 'workflows', 'facebook-news-sync.json');
const workflow = JSON.parse(read(workflowPath));
const scheduleNode = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.scheduleTrigger');
const requestNode = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.httpRequest');
const emailNode = workflow.nodes.find((node) => node.type === 'n8n-nodes-base.emailSend');
assert(scheduleNode?.parameters?.rule?.interval?.[0]?.minutesInterval === 10, 'n8n must schedule the sync every ten minutes.');
assert(requestNode?.parameters?.method === 'POST' && requestNode?.parameters?.url.includes('OSR_NEWS_SYNC_URL'), 'n8n must POST to the configured website sync endpoint.');
assert(requestNode?.retryOnFail === true && requestNode?.maxTries === 3, 'n8n must retry the protected sync three times.');
assert(requestNode?.credentials?.httpHeaderAuth?.id === 'REPLACE_WITH_NEWS_SYNC_CREDENTIAL_ID', 'The committed workflow must contain only an unresolved header credential reference.');
assert(emailNode?.credentials?.smtp?.id === 'REPLACE_WITH_SMTP_CREDENTIAL_ID', 'The committed workflow must contain only an unresolved SMTP credential reference.');

const compose = read(path.join('ops', 'n8n', 'compose.yaml'));
assert(compose.includes('127.0.0.1:5678:5678'), 'Self-hosted n8n must bind only to localhost.');
assert(/image: n8nio\/n8n:\d+\.\d+\.\d+/.test(compose) && !compose.includes('n8nio/n8n:latest'), 'Self-hosted n8n must use a pinned image version.');
assert(compose.includes('EXECUTIONS_DATA_MAX_AGE: 168') && compose.includes('restart: unless-stopped'), 'n8n must prune execution data after seven days and restart automatically.');

testNewsPolicy()
    .then(() => console.log('test-news-unfurl-and-feed-sync: PASS'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
