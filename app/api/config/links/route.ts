import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/sheets';
import { QuickLinkSchema } from '@/schemas/links';
import { rateLimit } from '@/lib/rate-limit';

export const revalidate = 3600; // Hourly ISR

export async function GET(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const limit = rateLimit(`links_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DIRECTORY_ID;
        const RANGE = 'QuickLinks!A2:E';

        if (!SPREADSHEET_ID) {
            return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
        }

        const rawData = await getSheetData(SPREADSHEET_ID, RANGE);

        const links = rawData.map((row, index) => {
            const linkData = {
                id: row[0] || `link-${index}`,
                label: row[1] || 'Link',
                desc: row[2] || '',
                href: row[3] || '#',
                icon: row[4] || 'ExternalLink',
            };

            const result = QuickLinkSchema.safeParse(linkData);
            return result.success ? result.data : null;
        }).filter(Boolean);

        return NextResponse.json({ data: links });

    } catch (error) {
        console.error('Quick Links API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 });
    }
}
