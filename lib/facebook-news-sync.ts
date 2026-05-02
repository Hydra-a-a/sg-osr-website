import { appendSheetData, batchUpdateSheetData, getSheetData } from '@/lib/sheets';
import { fetchWithTimeout } from '@/lib/security';
import {
    NEWS_POSTS_APPEND_RANGE,
    NEWS_POSTS_RANGE,
    NEWS_ROUTING_RULES_RANGE,
    NEWS_SOURCES_RANGE,
    buildNewsPostRow,
    mergeSyncedNewsPost,
    normalizeNewsPostRow,
    normalizeSyncedFacebookPost,
    parseNewsRoutingRuleRow,
    parseNewsSourceRow,
    type FacebookNewsPostInput,
    type NewsRoutingRule,
    type NewsSourceConfig,
} from '@/lib/news';
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

export interface FacebookNewsSyncOptions {
    dryRun?: boolean;
}

export interface FacebookNewsSyncSummary {
    dryRun: boolean;
    pagesChecked: number;
    postsFetched: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: Array<{ pageId: string; pageName: string; message: string }>;
}

function getSpreadsheetId(): string {
    const spreadsheetId = String(process.env.GOOGLE_SHEETS_INFO_ID || '').trim();
    if (!spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_INFO_ID is not configured.');
    }
    return spreadsheetId;
}

export function resolvePageToken(source: NewsSourceConfig): string {
    const alias = source.tokenAlias.trim();
    if (!alias) return '';
    return String(process.env[alias] || '').trim();
}

function graphApiVersion(): string {
    return String(process.env.META_GRAPH_API_VERSION || 'v20.0').trim().replace(/^\/+|\/+$/g, '');
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
    url.searchParams.set('access_token', accessToken);

    const response = await fetchWithTimeout(url, {
        cache: 'no-store',
        timeout: 10_000,
    });

    if (!response.ok) {
        throw new Error(`Meta Graph API returned HTTP ${response.status}`);
    }

    const payload = await response.json() as { data?: GraphPost[] };
    return (payload.data || [])
        .filter((post) => post.id)
        .map((post) => ({
            id: String(post.id || '').trim(),
            sourcePageId: source.pageId,
            sourcePageName: source.pageName,
            sourcePageSlug: source.pageSlug,
            message: String(post.message || '').trim(),
            imageUrl: firstAttachmentImage(post.attachments?.data || []),
            publishedAt: String(post.created_time || new Date().toISOString()),
            fbLink: String(post.permalink_url || '').trim(),
        }));
}

async function readNewsSources(spreadsheetId: string): Promise<NewsSourceConfig[]> {
    const rows = await getSheetData(spreadsheetId, NEWS_SOURCES_RANGE);
    return rows
        .map(parseNewsSourceRow)
        .filter((source) => source.enabled && source.pageId && source.pageName);
}

async function readNewsRoutingRules(spreadsheetId: string): Promise<NewsRoutingRule[]> {
    const rows = await getSheetData(spreadsheetId, NEWS_ROUTING_RULES_RANGE);
    return rows
        .map(parseNewsRoutingRuleRow)
        .filter((rule) => rule.enabled && rule.hashtag);
}

async function readExistingPosts(spreadsheetId: string): Promise<Array<{ rowNumber: number; post: NewsPost }>> {
    const rows = await getSheetData(spreadsheetId, NEWS_POSTS_RANGE);
    return rows
        .map((row, index) => ({ rowNumber: index + 2, post: normalizeNewsPostRow(row) }))
        .filter((entry) => entry.post.id);
}

export async function syncFacebookNews(options: FacebookNewsSyncOptions = {}): Promise<FacebookNewsSyncSummary> {
    const dryRun = Boolean(options.dryRun);
    const spreadsheetId = getSpreadsheetId();
    const [sources, rules, existingEntries] = await Promise.all([
        readNewsSources(spreadsheetId),
        readNewsRoutingRules(spreadsheetId),
        readExistingPosts(spreadsheetId),
    ]);
    const existingById = new Map(existingEntries.map((entry) => [entry.post.id, entry]));
    const rowsToAppend: string[][] = [];
    const rowsToUpdate: Array<{ range: string; values: string[][] }> = [];
    const summary: FacebookNewsSyncSummary = {
        dryRun,
        pagesChecked: 0,
        postsFetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    };

    for (const source of sources) {
        summary.pagesChecked += 1;
        const token = resolvePageToken(source);

        if (!token) {
            summary.skipped += 1;
            summary.errors.push({
                pageId: source.pageId,
                pageName: source.pageName,
                message: `Missing environment token for alias ${source.tokenAlias || '(blank)'}`,
            });
            continue;
        }

        try {
            const fetchedPosts = await fetchFacebookPagePosts(source, token);
            summary.postsFetched += fetchedPosts.length;

            for (const fetchedPost of fetchedPosts) {
                const normalized = normalizeSyncedFacebookPost(fetchedPost, rules, source.defaultTargetPages);
                const existing = existingById.get(normalized.id);

                if (existing) {
                    const merged = mergeSyncedNewsPost(existing.post, normalized);
                    rowsToUpdate.push({
                        range: `News Posts!A${existing.rowNumber}:X${existing.rowNumber}`,
                        values: [buildNewsPostRow(merged)],
                    });
                    summary.updated += 1;
                    continue;
                }

                rowsToAppend.push(buildNewsPostRow(normalized));
                summary.inserted += 1;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Meta sync error';
            summary.errors.push({
                pageId: source.pageId,
                pageName: source.pageName,
                message,
            });
        }
    }

    if (!dryRun) {
        if (rowsToUpdate.length > 0) {
            await batchUpdateSheetData(spreadsheetId, rowsToUpdate);
        }

        if (rowsToAppend.length > 0) {
            await appendSheetData(spreadsheetId, NEWS_POSTS_APPEND_RANGE, rowsToAppend);
        }
    }

    return summary;
}
