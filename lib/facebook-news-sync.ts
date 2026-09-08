import 'server-only';

import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { fetchWithTimeout, isTrustedUrl } from '@/lib/security';
import {
    NEWS_POSTS_APPEND_RANGE,
    NEWS_POSTS_RANGE,
    NEWS_ROUTING_RULES_RANGE,
    NEWS_SOURCES_RANGE,
    buildNewsPostRow,
    extractHashtags,
    hasEnabledNewsRoutingMatch,
    hasSyncedNewsPostChanges,
    mergeSyncedNewsPost,
    normalizeNewsPost,
    normalizeNewsPostRow,
    normalizeSyncedFacebookPost,
    parseNewsRoutingRuleRow,
    parseNewsSourceRow,
    type FacebookNewsPostInput,
    type NewsRoutingRule,
    type NewsSourceConfig,
} from '@/lib/news';
import { PUBLIC_CACHE_TAGS, revalidatePublicTags } from '@/lib/public-cache';
import { resolvePublicContentSource } from '@/lib/public-content-source';
import type { NewsPost } from '@/schemas/news';

interface GraphAttachment {
    media?: {
        image?: { src?: string };
        source?: string;
    };
    subattachments?: { data?: GraphAttachment[] };
    url?: string;
}

interface GraphPost {
    id?: string;
    message?: string;
    created_time?: string;
    permalink_url?: string;
    attachments?: { data?: GraphAttachment[] };
}

interface GraphTokenDebug {
    data?: {
        app_id?: string | number;
        expires_at?: number;
        granular_scopes?: Array<{ permission?: string }>;
        is_valid?: boolean;
        scopes?: string[];
        type?: string;
    };
}

interface GraphPageIdentity {
    id?: string | number;
}

export interface FacebookNewsSyncOptions {
    allowUnroutedPosts?: boolean;
    dryRun?: boolean;
}

export interface FacebookNewsSyncSummary {
    dryRun: boolean;
    writeTarget: 'sheet' | 'db';
    pagesChecked: number;
    postsFetched: number;
    inserted: number;
    updated: number;
    unchanged: number;
    filtered: number;
    skipped: number;
    errors: Array<{ pageId: string; pageName: string; message: string }>;
}

export interface FacebookNewsTokenVerificationSummary {
    pagesChecked: number;
    verified: number;
    skipped: number;
    errors: Array<{ pageId: string; pageName: string; message: string }>;
}

const REQUIRED_PAGE_READ_SCOPE = 'pages_read_engagement';
const MIN_TOKEN_VALIDITY_MS = 7 * 24 * 60 * 60 * 1_000;

function getSpreadsheetId(): string | null {
    const spreadsheetId = String(process.env.GOOGLE_SHEETS_INFO_ID || '').trim();
    return spreadsheetId || null;
}

export function resolvePageToken(source: NewsSourceConfig): string {
    const alias = source.tokenAlias.trim();
    if (!/^META_PAGE_TOKEN_[A-Z0-9][A-Z0-9_]{0,111}$/.test(alias)) return '';
    return String(process.env[alias] || '').trim();
}

function graphApiVersion(): string {
    const configured = String(process.env.META_GRAPH_API_VERSION || 'v26.0').trim().replace(/^\/+|\/+$/g, '');
    return /^v\d+\.\d+$/.test(configured) ? configured : 'v26.0';
}

function graphUrl(path: string): URL {
    return new URL(`https://graph.facebook.com/${graphApiVersion()}/${path.replace(/^\/+/, '')}`);
}

export function validateFacebookPageTokenDebug(
    token: GraphTokenDebug['data'],
    expectedAppId: string,
    now = Date.now(),
): string {
    if (!token?.is_valid) return 'Meta token is invalid';
    if (String(token.app_id || '') !== expectedAppId) return 'Meta token belongs to a different app';
    if (String(token.type || '').toUpperCase() !== 'PAGE') return 'Meta token is not page-scoped';

    const expiresAt = Number(token.expires_at || 0);
    if (expiresAt > 0 && expiresAt * 1_000 - now < MIN_TOKEN_VALIDITY_MS) {
        return 'Meta token expires too soon';
    }

    const scopes = new Set([
        ...(token.scopes || []),
        ...(token.granular_scopes || []).map((scope) => String(scope.permission || '')),
    ]);
    if (scopes.size > 0 && !scopes.has(REQUIRED_PAGE_READ_SCOPE)) {
        return `Meta token lacks ${REQUIRED_PAGE_READ_SCOPE}`;
    }

    return '';
}

async function verifyFacebookPageToken(source: NewsSourceConfig, accessToken: string): Promise<string> {
    const appId = String(process.env.META_APP_ID || '').trim();
    const appAccessToken = String(process.env.META_APP_ACCESS_TOKEN || '').trim();
    if (!appId || !appAccessToken) return 'Meta token verification is not configured';

    const debugUrl = graphUrl('debug_token');
    // Meta requires input_token as a query parameter for this endpoint. Never log this URL.
    debugUrl.searchParams.set('input_token', accessToken);
    const debugResponse = await fetchWithTimeout(debugUrl, {
        cache: 'no-store',
        timeout: 3_000,
        headers: { Authorization: `Bearer ${appAccessToken}` },
    });
    if (!debugResponse.ok) throw new Error(`Meta Graph API returned HTTP ${debugResponse.status}`);

    const validationError = validateFacebookPageTokenDebug(
        (await debugResponse.json() as GraphTokenDebug).data,
        appId,
    );
    if (validationError) return validationError;

    const pageUrl = graphUrl(encodeURIComponent(source.pageId));
    pageUrl.searchParams.set('fields', 'id');
    const pageResponse = await fetchWithTimeout(pageUrl, {
        cache: 'no-store',
        timeout: 3_000,
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!pageResponse.ok) throw new Error(`Meta Graph API returned HTTP ${pageResponse.status}`);
    const page = await pageResponse.json() as GraphPageIdentity;
    if (String(page.id || '') !== source.pageId) return 'Meta Page identity does not match the configured Page';

    const postsUrl = graphUrl(`${encodeURIComponent(source.pageId)}/posts`);
    postsUrl.searchParams.set('fields', 'id');
    postsUrl.searchParams.set('limit', '1');
    const postsResponse = await fetchWithTimeout(postsUrl, {
        cache: 'no-store',
        timeout: 3_000,
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!postsResponse.ok) throw new Error(`Meta Graph API returned HTTP ${postsResponse.status}`);

    return '';
}

function firstAttachmentImage(attachments: GraphAttachment[] = []): string {
    for (const attachment of attachments) {
        const imageUrl = attachment.media?.image?.src || attachment.media?.source || '';
        if (imageUrl) return imageUrl;

        const nested = firstAttachmentImage(attachment.subattachments?.data || []);
        if (nested) return nested;
    }

    return '';
}

export async function fetchFacebookPagePosts(source: NewsSourceConfig, accessToken: string): Promise<FacebookNewsPostInput[]> {
    const limit = Math.max(1, Math.min(50, source.syncLimit || 10));
    const fields = [
        'id',
        'message',
        'created_time',
        'permalink_url',
        'attachments{media,type,url,subattachments{media,type,url}}',
    ].join(',');
    const url = new URL(`https://graph.facebook.com/${graphApiVersion()}/${encodeURIComponent(source.pageId)}/posts`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('limit', String(limit));

    const response = await fetchWithTimeout(url, {
        cache: 'no-store',
        timeout: 3_000,
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        throw new Error(`Meta Graph API returned HTTP ${response.status}`);
    }

    const payload = await response.json() as { data?: GraphPost[] };
    return (payload.data || [])
        .filter((post) => post.id)
        .map((post) => {
            const imageUrl = firstAttachmentImage(post.attachments?.data || []);
            return {
                id: String(post.id || '').trim(),
                sourcePageId: source.pageId,
                sourcePageName: source.pageName,
                sourcePageSlug: source.pageSlug,
                message: String(post.message || '').trim(),
                imageUrl: isTrustedUrl(imageUrl) ? imageUrl : '',
                publishedAt: String(post.created_time || new Date().toISOString()),
                fbLink: String(post.permalink_url || '').trim(),
            };
        });
}

async function readNewsSources(spreadsheetId: string | null): Promise<NewsSourceConfig[]> {
    if (spreadsheetId) {
        try {
            const rows = await getSheetData(spreadsheetId, NEWS_SOURCES_RANGE);
            const parsed = rows
                .map(parseNewsSourceRow)
                .filter((source) => source.enabled && source.pageId && source.pageName);
            if (parsed.length > 0) return parsed;
        } catch {
            // fallback to DB
        }
    }

    try {
        const { prisma } = await import('@/lib/prisma');
        const dbSources = await prisma.newsSource.findMany({ where: { enabled: true } });
        return dbSources.map((source: any) => ({
            pageId: source.pageId,
            pageName: source.pageName,
            pageSlug: source.pageSlug,
            enabled: source.enabled,
            defaultTargetPages: Array.isArray(source.defaultTargetsJson) ? source.defaultTargetsJson : ['/news', '/student-government'],
            tokenAlias: source.tokenAlias,
            defaultSection: source.pageSlug,
            syncLimit: source.syncLimit || 15,
            notes: '',
        }));
    } catch {
        return [];
    }
}

async function readNewsRoutingRules(spreadsheetId: string | null): Promise<NewsRoutingRule[]> {
    if (spreadsheetId) {
        try {
            const rows = await getSheetData(spreadsheetId, NEWS_ROUTING_RULES_RANGE);
            const parsed = rows
                .map(parseNewsRoutingRuleRow)
                .filter((rule) => rule.enabled && rule.hashtag);
            if (parsed.length > 0) return parsed;
        } catch {
            // fallback to DB
        }
    }

    try {
        const { prisma } = await import('@/lib/prisma');
        const dbRules = await prisma.newsRoutingRule.findMany({ where: { enabled: true } });
        return dbRules.map((rule: any) => ({
            hashtag: rule.hashtag,
            targetPages: Array.isArray(rule.targetPagesJson) ? rule.targetPagesJson : ['/news'],
            enabled: rule.enabled,
            priority: 10,
            newsSection: 'ssc',
            notes: '',
        }));
    } catch {
        return [];
    }
}

interface ExistingNewsEntry {
    rowNumber?: number;
    post: NewsPost;
}

function databaseRowToNewsPost(row: any): NewsPost {
    return normalizeNewsPost({
        id: row.id,
        source: row.sourcePageName,
        sourcePageId: row.sourcePageId,
        sourcePageName: row.sourcePageName,
        caption: row.message,
        articleTitle: row.articleTitle,
        manualTitle: row.manualTitle,
        articleBody: row.articleBody,
        manualBody: row.manualBody,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        publishedAt: new Date(row.publishedAt).toISOString(),
        fbLink: row.fbLink,
        routeTargets: Array.isArray(row.targetPagesJson) ? row.targetPagesJson : ['/news'],
        section: row.section || row.sourcePageSlug,
        visible: row.enabled,
        featured: row.featured,
        sortOrder: row.sortOrder,
        ingestedAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        syncStatus: 'db',
    });
}

async function readExistingPosts(
    writeTarget: 'sheet' | 'db',
    spreadsheetId: string | null,
): Promise<ExistingNewsEntry[]> {
    if (writeTarget === 'sheet') {
        if (!spreadsheetId) throw new Error('News sync is configured for Sheets, but GOOGLE_SHEETS_INFO_ID is missing.');
        const rows = await getSheetData(spreadsheetId, NEWS_POSTS_RANGE);
        return rows
            .map((row, index) => ({ rowNumber: index + 2, post: normalizeNewsPostRow(row) }))
            .filter((entry) => entry.post.id);
    }

    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.newsPost.findMany();
    return rows.map((row: any) => ({ post: databaseRowToNewsPost(row) }));
}

async function syncPostsToDatabase(posts: NewsPost[]): Promise<void> {
    if (posts.length === 0) return;
    const { prisma } = await import('@/lib/prisma');
    await prisma.$transaction(posts.map((post) => prisma.newsPost.upsert({
        where: { id: post.id },
        create: {
            id: post.id,
            sourcePageId: post.sourcePageId || post.source,
            sourcePageName: post.sourcePageName || post.source,
            sourcePageSlug: post.section || 'ssc',
            message: post.caption,
            imageUrl: post.imageUrl || '',
            publishedAt: new Date(post.publishedAt),
            fbLink: post.fbLink || '',
            targetPagesJson: post.routeTargets || ['/news'],
            enabled: post.visible,
            featured: post.featured,
            manualTitle: post.manualTitle || '',
            manualBody: post.manualBody || '',
            articleTitle: post.articleTitle || '',
            articleBody: post.articleBody || '',
            imageAlt: post.imageAlt || '',
            section: post.section || '',
            sortOrder: post.sortOrder,
        },
        update: {
            sourcePageName: post.sourcePageName || post.source,
            message: post.caption,
            imageUrl: post.imageUrl || '',
            publishedAt: new Date(post.publishedAt),
            fbLink: post.fbLink || '',
            targetPagesJson: post.routeTargets || ['/news'],
            articleTitle: post.articleTitle || '',
            articleBody: post.articleBody || '',
            section: post.section || '',
        },
    })));
}

function sanitizedProviderError(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    const status = message.match(/HTTP (\d{3})/)?.[1];
    if (status) return `Meta Graph API returned HTTP ${status}`;
    if (/timed out|abort/i.test(message)) return 'Meta Graph API request timed out';
    return 'Meta Graph API request failed';
}

/** Protected preflight for enabling a configured Page source. It never writes website content. */
export async function verifyFacebookNewsTokens(): Promise<FacebookNewsTokenVerificationSummary> {
    const sources = await readNewsSources(getSpreadsheetId());
    if (sources.length === 0) throw new Error('No enabled news sources are configured.');

    const summary: FacebookNewsTokenVerificationSummary = {
        pagesChecked: 0,
        verified: 0,
        skipped: 0,
        errors: [],
    };

    for (let index = 0; index < sources.length; index += 3) {
        const pageResults = await Promise.all(sources.slice(index, index + 3).map(async (source) => {
            const token = resolvePageToken(source);
            if (!token) return { source, error: 'Missing or invalid token alias' };

            try {
                return { source, error: await verifyFacebookPageToken(source, token) };
            } catch (error) {
                return { source, error: sanitizedProviderError(error) };
            }
        }));

        for (const { source, error } of pageResults) {
            summary.pagesChecked += 1;
            if (error) {
                summary.skipped += 1;
                summary.errors.push({ pageId: source.pageId, pageName: source.pageName, message: error });
            } else {
                summary.verified += 1;
            }
        }
    }

    return summary;
}

export async function syncFacebookNews(options: FacebookNewsSyncOptions = {}): Promise<FacebookNewsSyncSummary> {
    const allowUnroutedPosts = Boolean(options.allowUnroutedPosts);
    const dryRun = Boolean(options.dryRun);
    const spreadsheetId = getSpreadsheetId();
    const writeTarget = resolvePublicContentSource('NEWS_SOURCE') === 'sheet' ? 'sheet' : 'db';
    const [sources, rules, existingEntries] = await Promise.all([
        readNewsSources(spreadsheetId),
        readNewsRoutingRules(spreadsheetId),
        readExistingPosts(writeTarget, spreadsheetId),
    ]);

    if (sources.length === 0) throw new Error('No enabled news sources are configured.');
    if (rules.length === 0) throw new Error('No enabled news routing rules are configured.');

    const existingById = new Map(existingEntries.map((entry) => [entry.post.id, entry]));
    const rowsToAppend: string[][] = [];
    const rowsToUpdate: Array<{ range: string; values: string[][] }> = [];
    const postsToWrite: NewsPost[] = [];
    const summary: FacebookNewsSyncSummary = {
        dryRun,
        writeTarget,
        pagesChecked: 0,
        postsFetched: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        filtered: 0,
        skipped: 0,
        errors: [],
    };

    for (let index = 0; index < sources.length; index += 3) {
        const pageResults = await Promise.all(sources.slice(index, index + 3).map(async (source) => {
            const token = resolvePageToken(source);
            if (!token) return { source, posts: null, error: 'Missing or invalid token alias' };

            try {
                return { source, posts: await fetchFacebookPagePosts(source, token), error: '' };
            } catch (error) {
                return { source, posts: null, error: sanitizedProviderError(error) };
            }
        }));

        for (const { source, posts, error } of pageResults) {
            summary.pagesChecked += 1;
            if (!posts) {
                summary.skipped += 1;
                summary.errors.push({ pageId: source.pageId, pageName: source.pageName, message: error });
                continue;
            }

            summary.postsFetched += posts.length;
            for (const fetchedPost of posts) {
                const normalized = normalizeSyncedFacebookPost(fetchedPost, rules, []);
                const existing = existingById.get(normalized.id);
                const hasRoutingMatch = hasEnabledNewsRoutingMatch(extractHashtags(fetchedPost.message), rules);

                if (!existing && !hasRoutingMatch && !allowUnroutedPosts) {
                    summary.filtered += 1;
                    continue;
                }

                if (!existing) {
                    rowsToAppend.push(buildNewsPostRow(normalized));
                    postsToWrite.push(normalized);
                    existingById.set(normalized.id, { post: normalized });
                    summary.inserted += 1;
                    continue;
                }

                const incoming = hasRoutingMatch || allowUnroutedPosts
                    ? normalized
                    : normalizeNewsPost({
                        ...normalized,
                        routeTargets: existing.post.routeTargets,
                        primaryTag: existing.post.primaryTag,
                        section: existing.post.section,
                    });
                const merged = mergeSyncedNewsPost(existing.post, incoming);
                if (!hasSyncedNewsPostChanges(existing.post, merged)) {
                    summary.unchanged += 1;
                    continue;
                }

                if (writeTarget === 'sheet' && existing.rowNumber) {
                    rowsToUpdate.push({
                        range: `News Posts!A${existing.rowNumber}:X${existing.rowNumber}`,
                        values: [buildNewsPostRow(merged)],
                    });
                }
                postsToWrite.push(merged);
                existingById.set(merged.id, { ...existing, post: merged });
                summary.updated += 1;
            }
        }
    }

    if (!dryRun) {
        if (writeTarget === 'sheet') {
            if (!spreadsheetId) throw new Error('News sync is configured for Sheets, but GOOGLE_SHEETS_INFO_ID is missing.');
            if (rowsToUpdate.length > 0) await batchUpdateSheetData(spreadsheetId, rowsToUpdate);
            if (rowsToAppend.length > 0) await appendSheetData(spreadsheetId, NEWS_POSTS_APPEND_RANGE, rowsToAppend);
        } else {
            await syncPostsToDatabase(postsToWrite);
        }

        if (summary.inserted > 0 || summary.updated > 0) {
            await revalidatePublicTags([PUBLIC_CACHE_TAGS.news]);
        }
    }

    return summary;
}
