import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { getSpreadsheetSheetTitles } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { NewsPostSchema } from '@/schemas/news';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';

export const revalidate = 3600; // vercel pls cache this i can't afford more api hits

function normalizeSheetTitle(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCandidateRanges(candidates: readonly string[], availableTitles: readonly string[]): string[] {
    const normalizedTitles = new Map(
        availableTitles
            .filter(Boolean)
            .map((title) => [normalizeSheetTitle(title), title] as const)
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

function isVisible(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    return !['false', '0', 'no', 'n', 'hide', 'hidden'].includes(normalized);
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`news_api_${ip}`, 30, 60000); // 30 reqs/min pls don't ddos me bro i have midterms

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID;
        const RANGE_CANDIDATES = [
            'News Control!A2:H',
            'News Control!A2:Z',
            'News!A2:Z',
            'NEWS!A2:Z',
        ] as const;

        if (!SPREADSHEET_ID) {
            return toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Internal server error', undefined, false));
        }

        const titles = await getSpreadsheetSheetTitles(SPREADSHEET_ID);
        let rawData: string[][] = [];

        for (const range of resolveCandidateRanges(RANGE_CANDIDATES, titles)) {
            try {
                rawData = await getSheetData(SPREADSHEET_ID, range);
                if (rawData.length > 0) {
                    break;
                }
            } catch (error) {
                console.warn(`[News API] Sheet range unavailable: ${range}`, redactErrorForLog(error));
            }
        }

        if (rawData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Pre-process rows to fix shifting columns before feeding to parser
        const normalizedRows = rawData.map(row => {
            let startIdx = 0;
            while (startIdx < row.length && (!row[startIdx] || typeof row[startIdx] === 'string' && row[startIdx].trim() === '')) {
                startIdx++;
            }
            return startIdx >= row.length ? [] : row.slice(startIdx);
        }).filter(row => row.length > 0 && isVisible(row[6]));

        const { validData } = parseSheetData({
            rows: normalizedRows,
            schema: NewsPostSchema,
            mapping: [
                { index: 0, key: 'id' },
                { index: 1, key: 'source', defaultValue: 'OSR' },
                { index: 2, key: 'caption', defaultValue: '' },
                { index: 3, key: 'imageUrl', defaultValue: null },
                { index: 4, key: 'publishedAt', defaultValue: new Date().toISOString() },
                {
                    index: 5,
                    key: 'fbLink',
                    transform: (val) => val && val.includes('facebook.com') ? val : 'https://www.facebook.com/rtu.osr'
                }
            ],
            onError: (err, rowNum) => {
                console.warn(`News Row ${rowNum} skipped:`, err);
            }
        });

        // Generate fallback IDs
        const posts = validData.map((post, index) => ({
            ...post,
            id: post.id || `news-${index}`,
            fbLink: post.fbLink || 'https://www.facebook.com/rtu.osr',
        })).sort((a, b) => {
            const aSort = Number.parseInt(String(normalizedRows.find((row) => row[0] === a.id)?.[7] ?? indexOfPost(a.id, validData)), 10);
            const bSort = Number.parseInt(String(normalizedRows.find((row) => row[0] === b.id)?.[7] ?? indexOfPost(b.id, validData)), 10);
            const aValue = Number.isFinite(aSort) ? aSort : Number.MAX_SAFE_INTEGER;
            const bValue = Number.isFinite(bSort) ? bSort : Number.MAX_SAFE_INTEGER;
            return aValue - bValue;
        });

        return NextResponse.json({ data: posts });

    } catch (error) {
        console.error('News API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}

function indexOfPost(id: string, posts: Array<{ id: string }>): number {
    const idx = posts.findIndex((post) => post.id === id);
    return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}
