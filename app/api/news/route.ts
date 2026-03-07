import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { NewsPostSchema } from '@/schemas/news';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 3600; // vercel pls cache this i can't afford more api hits

export async function GET(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 'anon';
    const limit = rateLimit(`news_api_${ip}`, 30, 60000); // 30 reqs/min pls don't ddos me bro i have midterms

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DIRECTORY_ID;
        const RANGE = 'News!A2:Z'; // reading a ton of cols because idk who keeps shifting the sheet

        if (!SPREADSHEET_ID) {
            return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

        const posts = rawData.map((row, index) => {
            // scanning for the actual start because someone keeps messing up the sheet format
            let startIdx = 0;
            while (startIdx < row.length && (!row[startIdx] || row[startIdx].trim() === '')) {
                startIdx++;
            }

            if (startIdx >= row.length) return null;

            const postData = {
                id: row[startIdx] || `news-${index}`,
                source: row[startIdx + 1] || 'OSR',
                caption: row[startIdx + 2] || '',
                imageUrl: row[startIdx + 3] || null,
                publishedAt: row[startIdx + 4] || new Date().toISOString(),
                fbLink: (row[startIdx + 5] && row[startIdx + 5].includes('facebook.com'))
                    ? row[startIdx + 5]
                    : 'https://www.facebook.com/rtu.osr',
            };

            const result = NewsPostSchema.safeParse(postData);
            if (!result.success) {
                return null;
            }
            return result.data;
        }).filter(Boolean);

        return NextResponse.json({ data: posts });

    } catch (error) {
        console.error('News API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
