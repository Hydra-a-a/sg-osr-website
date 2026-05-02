import type { NewsPost } from '@/schemas/news';

export const NEWS_SOURCES_RANGE = 'News Sources!A2:I';
export const NEWS_ROUTING_RULES_RANGE = 'News Routing Rules!A2:F';
export const NEWS_POSTS_RANGE = 'News Posts!A2:X';
export const NEWS_POSTS_APPEND_RANGE = 'News Posts!A1';

export const NEWS_POSTS_COLUMNS = [
    'id',
    'source',
    'sourcePageId',
    'sourcePageName',
    'caption',
    'articleTitle',
    'manualTitle',
    'articleSlug',
    'articleBody',
    'manualBody',
    'imageUrl',
    'imageAlt',
    'publishedAt',
    'fbLink',
    'hashtags',
    'routeTargets',
    'primaryTag',
    'visible',
    'featured',
    'sortOrder',
    'ingestedAt',
    'updatedAt',
    'syncStatus',
    'syncNotes',
] as const;

export interface NewsSourceConfig {
    pageId: string;
    pageName: string;
    pageSlug: string;
    enabled: boolean;
    defaultTargetPages: string[];
    tokenAlias: string;
    defaultSection: string;
    syncLimit: number;
    notes: string;
}

export interface NewsRoutingRule {
    hashtag: string;
    targetPages: string[];
    enabled: boolean;
    priority: number;
    newsSection: string;
    notes: string;
}

export interface FacebookNewsPostInput {
    id: string;
    sourcePageId: string;
    sourcePageName: string;
    sourcePageSlug: string;
    message: string;
    imageUrl: string;
    publishedAt: string;
    fbLink: string;
}

function toText(value: unknown): string {
    return String(value ?? '').trim();
}

export function parseBoolean(value: unknown, defaultValue = false): boolean {
    const normalized = toText(value).toLowerCase();
    if (!normalized) return defaultValue;
    return ['1', 'true', 'yes', 'y', 'show', 'visible', 'enabled', 'featured'].includes(normalized);
}

function parseDelimited(value: unknown): string[] {
    return toText(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseNullableNumber(value: unknown): number | null {
    const parsed = Number.parseInt(toText(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHashtag(value: string): string {
    const tag = toText(value).replace(/^#+/, '').toLowerCase();
    return tag ? `#${tag}` : '';
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

export function extractHashtags(text: string): string[] {
    const tags: string[] = [];
    const pattern = /(^|[\s([{])#([A-Za-z0-9_-]{1,79})/g;
    let match = pattern.exec(text || '');

    while (match) {
        const normalized = normalizeHashtag(match[2]);
        if (normalized) tags.push(normalized);
        match = pattern.exec(text || '');
    }

    return unique(tags);
}

function stripHashtagsFromLine(line: string): string {
    return line.replace(/(^|[\s([{])#[A-Za-z0-9_-]{1,79}/g, ' ').replace(/\s+/g, ' ').trim();
}

function isRoutingOnlyHashtagLine(line: string): boolean {
    const trimmed = line.trim();
    return Boolean(trimmed) && stripHashtagsFromLine(trimmed).length === 0 && extractHashtags(trimmed).length > 0;
}

function cleanTitle(value: string): string {
    return stripHashtagsFromLine(value)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180);
}

export function generateArticleTitle(caption: string, sourcePageName: string): string {
    const titleMarker = String(caption || '').match(/^\s*\[title\]\s*(.+)$/im);
    if (titleMarker?.[1]) {
        const markerTitle = cleanTitle(titleMarker[1]);
        if (markerTitle) return markerTitle;
    }

    const meaningfulLine = String(caption || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !isRoutingOnlyHashtagLine(line));

    if (meaningfulLine) {
        const firstSentence = meaningfulLine.match(/^(.+?[.!?])(\s|$)/)?.[1] || meaningfulLine;
        const title = cleanTitle(firstSentence);
        if (title) return title;
    }

    return `Update from ${sourcePageName || 'Student Government'}`;
}

export function generateArticleBody(caption: string): string {
    return String(caption || '')
        .split(/\r?\n/)
        .filter((line) => !/^\s*\[title\]\s*/i.test(line))
        .filter((line) => !isRoutingOnlyHashtagLine(line))
        .join('\n')
        .trim();
}

export function generateArticleSlug(title: string, facebookPostId: string): string {
    const suffix = toText(facebookPostId).replace(/[^A-Za-z0-9]/g, '').slice(-10).toLowerCase() || 'post';
    const slugBase = toText(title)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return `${slugBase || 'news-update'}-${suffix}`;
}

export function parseNewsSourceRow(row: string[]): NewsSourceConfig {
    const syncLimit = Number.parseInt(toText(row[7]), 10);
    return {
        pageId: toText(row[0]),
        pageName: toText(row[1]),
        pageSlug: toText(row[2]).toLowerCase(),
        enabled: parseBoolean(row[3], true),
        defaultTargetPages: parseDelimited(row[4]),
        tokenAlias: toText(row[5]),
        defaultSection: toText(row[6]).toLowerCase(),
        syncLimit: Number.isFinite(syncLimit) ? Math.max(1, Math.min(50, syncLimit)) : 10,
        notes: toText(row[8]),
    };
}

export function parseNewsRoutingRuleRow(row: string[]): NewsRoutingRule {
    const priority = Number.parseInt(toText(row[3]), 10);
    return {
        hashtag: normalizeHashtag(row[0]),
        targetPages: parseDelimited(row[1]),
        enabled: parseBoolean(row[2], true),
        priority: Number.isFinite(priority) ? priority : 0,
        newsSection: toText(row[4]).toLowerCase(),
        notes: toText(row[5]),
    };
}

export function resolveNewsRoutes(
    hashtags: string[],
    rules: NewsRoutingRule[],
    defaultTargetPages: string[] = [],
): { routeTargets: string[]; primaryTag: string; section: string } {
    const normalizedTags = unique(hashtags.map(normalizeHashtag));
    const enabledRules = rules
        .filter((rule) => rule.enabled && normalizedTags.includes(rule.hashtag))
        .sort((a, b) => b.priority - a.priority);

    const routeTargets = unique([
        ...defaultTargetPages,
        ...enabledRules.flatMap((rule) => rule.targetPages),
        '/news',
    ]);
    const primaryRule = enabledRules[0];

    return {
        routeTargets,
        primaryTag: primaryRule?.hashtag || normalizedTags[0] || '',
        section: primaryRule?.newsSection || '',
    };
}

export function normalizeSyncedFacebookPost(
    input: FacebookNewsPostInput,
    rules: NewsRoutingRule[],
    defaultTargetPages: string[] = [],
): NewsPost {
    const caption = toText(input.message);
    const articleTitle = generateArticleTitle(caption, input.sourcePageName);
    const articleBody = generateArticleBody(caption);
    const hashtags = extractHashtags(caption);
    const routeInfo = resolveNewsRoutes(hashtags, rules, defaultTargetPages);
    const nowIso = new Date().toISOString();

    return normalizeNewsPost({
        id: input.id,
        source: input.sourcePageName,
        sourcePageId: input.sourcePageId,
        sourcePageName: input.sourcePageName,
        caption,
        articleTitle,
        manualTitle: '',
        articleSlug: generateArticleSlug(articleTitle, input.id),
        articleBody,
        manualBody: '',
        imageUrl: input.imageUrl || '',
        imageAlt: articleTitle ? `${articleTitle} - ${input.sourcePageName}` : '',
        publishedAt: input.publishedAt,
        fbLink: input.fbLink,
        hashtags,
        routeTargets: routeInfo.routeTargets,
        primaryTag: routeInfo.primaryTag,
        section: routeInfo.section || input.sourcePageSlug,
        visible: true,
        featured: false,
        sortOrder: null,
        ingestedAt: nowIso,
        updatedAt: nowIso,
        syncStatus: 'synced',
        syncNotes: '',
    });
}

export function normalizeNewsPost(post: Partial<NewsPost>): NewsPost {
    const articleTitle = toText(post.articleTitle);
    const articleBody = toText(post.articleBody || post.caption);
    const manualTitle = toText(post.manualTitle);
    const manualBody = toText(post.manualBody);

    return {
        id: toText(post.id),
        source: toText(post.source || post.sourcePageName || 'OSR'),
        sourcePageId: toText(post.sourcePageId),
        sourcePageName: toText(post.sourcePageName || post.source || 'OSR'),
        caption: toText(post.caption),
        imageUrl: post.imageUrl || '',
        publishedAt: toText(post.publishedAt || new Date().toISOString()),
        fbLink: post.fbLink || '',
        articleTitle,
        manualTitle,
        articleSlug: toText(post.articleSlug || generateArticleSlug(manualTitle || articleTitle || 'News update', post.id || 'post')),
        articleBody,
        manualBody,
        displayTitle: manualTitle || articleTitle,
        displayBody: manualBody || articleBody,
        imageAlt: toText(post.imageAlt),
        hashtags: Array.isArray(post.hashtags) ? post.hashtags.map(normalizeHashtag).filter(Boolean) : [],
        routeTargets: Array.isArray(post.routeTargets) ? unique(post.routeTargets.map(toText)) : ['/news'],
        primaryTag: normalizeHashtag(post.primaryTag || ''),
        section: toText(post.section).toLowerCase(),
        visible: post.visible !== false,
        featured: post.featured === true,
        sortOrder: typeof post.sortOrder === 'number' ? post.sortOrder : null,
        ingestedAt: toText(post.ingestedAt),
        updatedAt: toText(post.updatedAt),
        syncStatus: toText(post.syncStatus),
        syncNotes: toText(post.syncNotes),
    };
}

export function normalizeNewsPostRow(row: string[]): NewsPost {
    return normalizeNewsPost({
        id: row[0],
        source: row[1],
        sourcePageId: row[2],
        sourcePageName: row[3],
        caption: row[4],
        articleTitle: row[5],
        manualTitle: row[6],
        articleSlug: row[7],
        articleBody: row[8],
        manualBody: row[9],
        imageUrl: row[10] || '',
        imageAlt: row[11],
        publishedAt: row[12],
        fbLink: row[13] || '',
        hashtags: parseDelimited(row[14]).map(normalizeHashtag),
        routeTargets: parseDelimited(row[15]),
        primaryTag: row[16],
        visible: parseBoolean(row[17], true),
        featured: parseBoolean(row[18], false),
        sortOrder: parseNullableNumber(row[19]),
        ingestedAt: row[20],
        updatedAt: row[21],
        syncStatus: row[22],
        syncNotes: row[23],
    });
}

export function normalizeLegacyNewsPostRow(row: string[], index: number): NewsPost {
    const id = toText(row[0]) || `legacy-news-${index}`;
    const source = toText(row[1]) || 'OSR';
    const caption = toText(row[2]);
    const articleTitle = generateArticleTitle(caption, source);
    const articleBody = generateArticleBody(caption);

    return normalizeNewsPost({
        id,
        source,
        sourcePageName: source,
        caption,
        articleTitle,
        articleSlug: generateArticleSlug(articleTitle, id),
        articleBody,
        imageUrl: row[3] || '',
        publishedAt: row[4] || new Date().toISOString(),
        fbLink: row[5] || 'https://www.facebook.com/rtu.osr',
        hashtags: extractHashtags(caption),
        routeTargets: ['/news'],
        visible: parseBoolean(row[6], true),
        sortOrder: parseNullableNumber(row[7]),
        syncStatus: 'legacy',
    });
}

export function buildNewsPostRow(post: NewsPost): string[] {
    return [
        post.id,
        post.source,
        post.sourcePageId,
        post.sourcePageName,
        post.caption,
        post.articleTitle,
        post.manualTitle,
        post.articleSlug,
        post.articleBody,
        post.manualBody,
        String(post.imageUrl || ''),
        post.imageAlt,
        post.publishedAt,
        String(post.fbLink || ''),
        post.hashtags.join(','),
        post.routeTargets.join(','),
        post.primaryTag,
        post.visible ? 'yes' : 'no',
        post.featured ? 'yes' : 'no',
        post.sortOrder === null || post.sortOrder === undefined ? '' : String(post.sortOrder),
        post.ingestedAt,
        post.updatedAt,
        post.syncStatus,
        post.syncNotes,
    ];
}

export function mergeSyncedNewsPost(existing: NewsPost, incoming: NewsPost): NewsPost {
    return normalizeNewsPost({
        ...incoming,
        manualTitle: existing.manualTitle,
        manualBody: existing.manualBody,
        imageAlt: existing.imageAlt || incoming.imageAlt,
        visible: existing.visible,
        featured: existing.featured,
        sortOrder: existing.sortOrder,
        ingestedAt: existing.ingestedAt || incoming.ingestedAt,
        syncStatus: 'updated',
    });
}
