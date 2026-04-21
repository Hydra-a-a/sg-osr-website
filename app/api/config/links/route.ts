import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { getSpreadsheetSheetTitles } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { QuickLinkSchema } from '@/schemas/links';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';

export const revalidate = 3600; // Hourly ISR

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

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`links_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID;
        const RANGE_CANDIDATES = [
            'QuickLinks!A2:E',
            'Quick Links!A2:E',
            'Quicklinks!A2:E',
            'Links!A2:E',
            'Useful Links!A2:E',
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
                console.warn(`[Quick Links API] Sheet range unavailable: ${range}`, redactErrorForLog(error));
            }
        }

        if (rawData.length === 0) {
            return NextResponse.json({ data: [] });
        }

        const { validData } = parseSheetData({
            rows: rawData,
            schema: QuickLinkSchema,
            mapping: [
                { index: 0, key: 'id' },
                { index: 1, key: 'label' },
                { index: 2, key: 'desc' },
                { index: 3, key: 'href' },
                { index: 4, key: 'icon', defaultValue: 'ExternalLink' }
            ],
            onError: (err, rowNum) => {
                console.warn(`Link Row ${rowNum} skipped:`, err);
            }
        });

        // Generate fallback IDs
        const links = validData.map((link, index) => ({
            ...link,
            id: link.id || `link-${index}`,
            label: link.label || 'Link',
            desc: link.desc || '',
            href: link.href || '#',
        }));

        return NextResponse.json({ data: links });

    } catch (error) {
        console.error('Quick Links API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
