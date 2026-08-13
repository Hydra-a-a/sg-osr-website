import { NextResponse } from 'next/server';
import { getSheetData, getSpreadsheetSheetTitles } from '@/lib/sheets';
import { LegacyNewsPostSchema, NewsPostSchema, type NewsPost } from '@/schemas/news';
import {
    normalizeLegacyNewsPostRow,
    normalizeNewsPostRow,
    parseBoolean,
} from '@/lib/news';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { loadNewsPostsFromDb, resolvePublicContentSource } from '@/lib/public-content-source';

export const revalidate = 300;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const RICH_RANGE = 'News Posts!A2:X';
const LEGACY_RANGE_CANDIDATES = [
    'News Control!A2:H',
    'News Control!A2:Z',
    'News!A2:Z',
    'NEWS!A2:Z',
] as const;

function normalizeSheetTitle(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCandidateRanges(candidates: readonly string[], availableTitles: readonly string[]): string[] {
    const normalizedTitles = new Map(
        availableTitles
            .filter(Boolean)
            .map((title) => [normalizeSheetTitle(title), title] as const),
    );

    const resolved = new Set<string>();
    for (const candidate of candidates) {
        const bangIndex = candidate.indexOf('!');
        if (bangIndex <= 0) {
            resolved.add(candidate);
            continue;
        }

        const configuredTitle = candidate.slice(0, bangIndex);
        const suffix = candidate.slice(bangIndex);
        const matchedTitle = normalizedTitles.get(normalizeSheetTitle(configuredTitle));

        if (matchedTitle) {
            resolved.add(`${matchedTitle}${suffix}`);
        }

        resolved.add(candidate);
    }

    return [...resolved];
}

function parseLimit(value: string | null): number {
    const parsed = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
    return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function parsePage(value: string | null): number {
    const parsed = Number.parseInt(String(value || ''), 10);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
}

function normalizeFilter(value: string | null): string {
    return String(value || '').trim().toLowerCase();
}

function dateValue(value: string): number {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function sortPosts(posts: NewsPost[]): NewsPost[] {
    return [...posts].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;

        const aSort = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
        const bSort = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
        if (aSort !== bSort) return aSort - bSort;

        return dateValue(b.publishedAt) - dateValue(a.publishedAt);
    });
}

function applyFilters(
    posts: NewsPost[],
    filters: {
        route: string;
        section: string;
        source: string;
        featured: string;
    },
): NewsPost[] {
    return posts
        .filter((post) => post.visible)
        .filter((post) => !filters.route || post.routeTargets.map((target) => target.toLowerCase()).includes(filters.route))
        .filter((post) => !filters.section || post.section.toLowerCase() === filters.section || post.primaryTag.replace(/^#/, '') === filters.section)
        .filter((post) => {
            if (!filters.source) return true;
            return [
                post.source,
                post.sourcePageName,
                post.sourcePageId,
                post.section,
            ].some((value) => String(value || '').trim().toLowerCase() === filters.source);
        })
        .filter((post) => !filters.featured || post.featured === parseBoolean(filters.featured, false));
}

async function readRichPosts(spreadsheetId: string): Promise<NewsPost[]> {
    try {
        const rows = await getSheetData(spreadsheetId, RICH_RANGE);
        return rows
            .filter((row) => row.some((cell) => String(cell || '').trim()))
            .map(normalizeNewsPostRow)
            .filter((post) => NewsPostSchema.safeParse(post).success);
    } catch (error) {
        console.warn('[News API] Rich News Posts range unavailable:', redactErrorForLog(error));
        return [];
    }
}

async function readLegacyPosts(spreadsheetId: string, titles: string[]): Promise<NewsPost[]> {
    for (const range of resolveCandidateRanges(LEGACY_RANGE_CANDIDATES, titles)) {
        try {
            const rows = await getSheetData(spreadsheetId, range);
            if (rows.length === 0) continue;

            return rows
                .map((row) => {
                    let startIdx = 0;
                    while (startIdx < row.length && !String(row[startIdx] || '').trim()) {
                        startIdx += 1;
                    }
                    return startIdx >= row.length ? [] : row.slice(startIdx);
                })
                .filter((row) => row.length > 0)
                .filter((row) => [0, 1, 2, 4].every((index) => String(row[index] || '').trim()))
                .filter((row) => LegacyNewsPostSchema.safeParse({
                    id: String(row[0] || ''),
                    source: String(row[1] || ''),
                    caption: String(row[2] || ''),
                    imageUrl: row[3] || '',
                    publishedAt: String(row[4] || ''),
                    fbLink: row[5] || 'https://www.facebook.com/rtu.osr',
                }).success)
                .map((row, index) => normalizeLegacyNewsPostRow(row, index));
        } catch (error) {
            console.warn(`[News API] Legacy sheet range unavailable: ${range}`, redactErrorForLog(error));
        }
    }

    return [];
}

function jsonResponse(body: unknown): NextResponse {
    return NextResponse.json(body, {
        headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
        },
    });
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limitResult = rateLimit(`news_api_${ip}`, 60, 60000);

    if (!limitResult.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const contentSource = resolvePublicContentSource('NEWS_SOURCE');
        const spreadsheetId = process.env.GOOGLE_SHEETS_INFO_ID;
        if (contentSource !== 'sheet') {
            try {
                const posts = await loadNewsPostsFromDb(200);
                const requestUrl = new URL(request.url);
                const searchParams = requestUrl.searchParams;
                const limit = parseLimit(searchParams.get('limit'));
                const page = parsePage(searchParams.get('page'));
                const filteredPosts = sortPosts(applyFilters(posts, {
                    route: normalizeFilter(searchParams.get('route')),
                    section: normalizeFilter(searchParams.get('section')),
                    source: normalizeFilter(searchParams.get('source')),
                    featured: normalizeFilter(searchParams.get('featured')),
                }));
                const start = (page - 1) * limit;
                return jsonResponse({ data: filteredPosts.slice(start, start + limit), pagination: { page, limit, total: filteredPosts.length, hasMore: start + limit < filteredPosts.length } });
            } catch (error) {
                if (contentSource === 'db') throw error;
                console.warn('[News API] Neon source unavailable; falling back to Sheets:', redactErrorForLog(error));
            }
        }
        if (!spreadsheetId) {
            return toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Internal server error', undefined, false));
        }

        const requestUrl = new URL(request.url);
        const searchParams = requestUrl.searchParams;
        const route = normalizeFilter(searchParams.get('route'));
        const section = normalizeFilter(searchParams.get('section'));
        const source = normalizeFilter(searchParams.get('source'));
        const featured = normalizeFilter(searchParams.get('featured'));
        const limit = parseLimit(searchParams.get('limit'));
        const page = parsePage(searchParams.get('page'));
        const titles = await getSpreadsheetSheetTitles(spreadsheetId);
        const richPosts = await readRichPosts(spreadsheetId);
        const posts = richPosts.length > 0 ? richPosts : await readLegacyPosts(spreadsheetId, titles);
        const filteredPosts = sortPosts(applyFilters(posts, { route, section, source, featured }));
        const start = (page - 1) * limit;
        const data = filteredPosts.slice(start, start + limit);

        return jsonResponse({
            data,
            pagination: {
                page,
                limit,
                total: filteredPosts.length,
                hasMore: start + limit < filteredPosts.length,
            },
        });
    } catch (error) {
        console.error('News API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
