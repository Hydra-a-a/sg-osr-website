import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { QuickLinkSchema } from '@/schemas/links';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';

export const revalidate = 3600; // Hourly ISR

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`links_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID;
        const RANGE = 'QuickLinks!A2:E';

        if (!SPREADSHEET_ID) {
            return toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Internal server error', undefined, false));
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

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
