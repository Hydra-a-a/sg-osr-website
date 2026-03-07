import { NextResponse } from 'next/server';
import { MakeWebhookPayloadSchema } from '@/schemas/webhooks';
import { appendSheetData, getSheetData } from '@/lib/sheets';
import { timingSafeEqual } from 'crypto';
import { sanitizeText } from '@/lib/security';

export async function POST(request: Request) {
    try {
        // crypto stuff so people don't steal my webhooks idk
        const authHeader = request.headers.get('authorization');
        const expectedToken = process.env.MAKE_WEBHOOK_SECRET || process.env.IFTTT_WEBHOOK_SECRET;

        if (!expectedToken) {
            console.error('Missing MAKE_WEBHOOK_SECRET');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const providedToken = authHeader.slice(7);


        const expectedBuffer = Buffer.from(expectedToken);
        const providedBuffer = Buffer.from(providedToken);

        if (expectedBuffer.length !== providedBuffer.length ||
            !timingSafeEqual(expectedBuffer, providedBuffer)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }


        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const result = MakeWebhookPayloadSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid data', details: result.error.issues }, { status: 400 });
        }

        const data = result.data;


        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DIRECTORY_ID!;
        const existingData = await getSheetData(SPREADSHEET_ID, 'News!A:Z'); // reading the whole damn sheet just in case

        const cleanContent = sanitizeText(data.content || '');

        // trying to stop double posting from make.com trying its best to ruin my day
        const recentCaptions = existingData.slice(-10).map(row => {
            let s = 0;
            while (s < row.length && (!row[s] || row[s].trim() === '')) s++;
            return row[s + 2];
        }).filter(Boolean);

        if (recentCaptions.includes(cleanContent)) {
            return NextResponse.json({ success: true, message: 'Duplicate post ignored', skipped: true });
        }


        const lowContent = cleanContent.toLowerCase();
        const blockKeywords = ['shared a post', 'days to go', 'updated their cover', 'changed their profile'];
        if (blockKeywords.some(kw => lowContent.includes(kw))) {
            return NextResponse.json({ success: true, message: 'Filtered: Non-news content', filtered: true });
        }


        const rowId = data.publishedAt || new Date().toISOString();
        const rowSource = data.sourcePage || 'OSR';
        const rowCaption = cleanContent;
        const rowImageUrl = data.imageUrl || '';
        const rowPublishedAt = data.publishedAt || new Date().toISOString();
        const rowFbLink = '';

        await appendSheetData(
            SPREADSHEET_ID,
            'News!A:F',
            [[rowId, rowSource, rowCaption, rowImageUrl, rowPublishedAt, rowFbLink]]
        );

        return NextResponse.json({
            success: true,
            message: 'News post automated successfully',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Make Webhook Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
