import { NextResponse } from 'next/server';
import { MakeWebhookPayloadSchema } from '@/schemas/webhooks';
import { appendSheetData, getSheetData } from '@/lib/sheets';
import { sanitizeText, getClientIp, isRecentWebhookTimestamp, verifyWebhookHmac, redactErrorForLog } from '@/lib/security';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAuditAction } from '@/lib/audit';
import { ApiError, toApiResponse } from '@/lib/api-errors';

const replayCache = new Map<string, number>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function withNoStore(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

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
        const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
        if (limit.retryAfter) {
            response.headers.set('Retry-After', String(limit.retryAfter));
        }
        return withNoStore(response);
    }

    try {
        const secret = process.env.MAKE_WEBHOOK_SECRET || process.env.IFTTT_WEBHOOK_SECRET;
        const signatureHeader = request.headers.get('x-webhook-signature');
        const timestampHeader = request.headers.get('x-webhook-timestamp');
        const rawBody = await request.text();

        if (!secret) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Webhook secret is not configured' });
            return withNoStore(toApiResponse(new ApiError(500, 'WEBHOOK_NOT_CONFIGURED', 'Internal server error', undefined, false)));
        }

        if (!signatureHeader || !timestampHeader) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Missing webhook signature or timestamp header' });
            return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
        }

        if (!isRecentWebhookTimestamp(timestampHeader)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Invalid or stale webhook timestamp' });
            return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
        }

        const timestamp = String(timestampHeader);

        if (!verifyWebhookHmac(rawBody, timestamp, signatureHeader, secret)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Invalid webhook signature' });
            return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
        }

        if (isReplayRequest(signatureHeader, timestamp)) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Webhook replay detected' });
            return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
        }

        let body: unknown;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_JSON', 'Invalid request payload')));
        }

        const result = MakeWebhookPayloadSchema.safeParse(body);
        if (!result.success) {
            logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Schema validation mismatch on webhook payload' });
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid request payload')));
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
            return withNoStore(NextResponse.json({ success: true, message: 'Duplicate post ignored', skipped: true }));
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
            return withNoStore(NextResponse.json({ success: true, message: 'Filtered: Non-news content', filtered: true }));
        }

        const rowId = data.publishedAt || new Date().toISOString();
        const rowCaption = cleanContent;
        const rowImageUrl = data.imageUrl || '';
        const rowPublishedAt = data.publishedAt || new Date().toISOString();
        const rowFbLink = data.fbLink || '';

        await appendSheetData(
            SPREADSHEET_ID,
            'News!A:I',
            [[rowId, rowSource, rowCaption, rowImageUrl, rowPublishedAt, rowFbLink, 'yes', '', 'legacy']]
        );

        logAuditAction('WEBHOOK_PROCESSED', { ip, sourcePage: rowSource });

        return withNoStore(NextResponse.json({
            success: true,
            message: 'News post automated successfully',
            timestamp: new Date().toISOString(),
        }));

    } catch (error) {
        logAuditAction('WEBHOOK_FAILED_AUTH', { ip, reason: 'Internal exception during processing' });
        console.error('Make Webhook Error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
