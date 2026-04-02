import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { NewsPostSchema } from '@/schemas/news';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';

export const revalidate = 3600; // vercel pls cache this i can't afford more api hits

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`news_api_${ip}`, 30, 60000); // 30 reqs/min pls don't ddos me bro i have midterms

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID;
        const RANGE = 'News!A2:Z'; // reading a ton of cols because idk who keeps shifting the sheet

        if (!SPREADSHEET_ID) {
            return toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Internal server error', undefined, false));
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

        // Pre-process rows to fix shifting columns before feeding to parser
        const normalizedRows = rawData.map(row => {
            let startIdx = 0;
            while (startIdx < row.length && (!row[startIdx] || typeof row[startIdx] === 'string' && row[startIdx].trim() === '')) {
                startIdx++;
            }
            return startIdx >= row.length ? [] : row.slice(startIdx);
        }).filter(row => row.length > 0);

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
        }));

        return NextResponse.json({ data: posts });

    } catch (error) {
        console.error('News API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
