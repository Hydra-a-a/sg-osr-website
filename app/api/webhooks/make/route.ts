import { NextResponse } from 'next/server';
import { MakeWebhookPayloadSchema } from '@/schemas/webhooks';
import { appendSheetData, getSheetData } from '@/lib/sheets';
import { sanitizeText, getClientIp, isRecentWebhookTimestamp, verifyWebhookHmac } from '@/lib/security';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuditAction } from '@/lib/audit';

const replayCache = new Map<string, number>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function isReplayRequest(signature: string, timestamp: string): boolean {
    const now = Date.now();

    for (const [key, expiresAt] of replayCache.entries()) {
        if (expiresAt < now) {
            replayCache.delete(key);
        }
    }

    const replayKey = `${signature}:${timestamp}`;
    const existing = replayCache.get(replayKey);
    if (existing && existing > now) {
        return true;
    }

    replayCache.set(replayKey, now + REPLAY_WINDOW_MS);
    return false;
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    // Strict rate limiting for webhooks (e.g. max 10 requests per minute)
    const limit = await checkRateLimit(`webhook_make_api_${ip}`, 10, 60000);

    if (!limit.success) {
        logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Rate limited' });
        const response = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        if (limit.retryAfter) {
            response.headers.set('Retry-After', String(limit.retryAfter));
        }
        return response;
    }

    try {
        const secret = process.env.MAKE_WEBHOOK_SECRET || process.env.IFTTT_WEBHOOK_SECRET;
        const signatureHeader = request.headers.get('x-webhook-signature');
        const timestampHeader = request.headers.get('x-webhook-timestamp');
        const rawBody = await request.text();

        if (!secret) {
            console.error('Missing MAKE_WEBHOOK_SECRET');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        if (!isRecentWebhookTimestamp(timestampHeader)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Invalid or stale webhook timestamp' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const timestamp = String(timestampHeader);

        if (!verifyWebhookHmac(rawBody, timestamp, signatureHeader, secret)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Invalid webhook signature' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (isReplayRequest(signatureHeader || '', timestamp)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Webhook replay detected' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let body: unknown;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
        }

        const result = MakeWebhookPayloadSchema.safeParse(body);
        if (!result.success) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Schema validation mismatch on webhook payload' });
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const data = result.data;
        const rowSource = data.sourcePage || 'OSR';

        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_INFO_ID!;
        const existingData = await getSheetData(SPREADSHEET_ID, 'News!A:Z'); // reading the whole damn sheet just in case

        const cleanContent = sanitizeText(data.content || '');

        // trying to stop double posting from make.com trying its best to ruin my day
        const recentCaptions = existingData.slice(-10).map(row => {
            let s = 0;
            while (s < row.length && (!row[s] || row[s].trim() === '')) s++;
            return row[s + 2];
        }).filter(Boolean);

        if (recentCaptions.includes(cleanContent)) {
            logAuditAction('WEBHOOK_PROCESSED', { ip, sourcePage: rowSource, reason: 'Duplicate post ignored' });
            return NextResponse.json({ success: true, message: 'Duplicate post ignored', skipped: true });
        }

        const lowContent = cleanContent.toLowerCase();
        const blockKeywords = [
            'shared a post',
            'days to go',
            'updated their cover',
            'changed their profile',
            'updated their address',
            'updated their phone number',
            'is now on facebook',
            'was live',
            'added a button',
            'updated their website',
            'changed their business hours'
        ];
        
        if (blockKeywords.some(kw => lowContent.includes(kw))) {
            logAuditAction('WEBHOOK_FILTERED', { ip, sourcePage: rowSource, reason: 'Non-news content matches blocklist' });
            return NextResponse.json({ success: true, message: 'Filtered: Non-news content', filtered: true });
        }

        const rowId = data.publishedAt || new Date().toISOString();
        const rowCaption = cleanContent;
        const rowImageUrl = data.imageUrl || '';
        const rowPublishedAt = data.publishedAt || new Date().toISOString();
        const rowFbLink = data.fbLink || '';

        await appendSheetData(
            SPREADSHEET_ID,
            'News!A:F',
            [[rowId, rowSource, rowCaption, rowImageUrl, rowPublishedAt, rowFbLink]]
        );

        logAuditAction('WEBHOOK_PROCESSED', { ip, sourcePage: rowSource });

        return NextResponse.json({
            success: true,
            message: 'News post automated successfully',
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Internal exception during processing' });
        console.error('Make Webhook Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
