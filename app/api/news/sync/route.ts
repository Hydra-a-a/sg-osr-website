import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { syncFacebookNews } from '@/lib/facebook-news-sync';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

function safeEqual(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected || '');
    const providedBuffer = Buffer.from(provided || '');
    if (expectedBuffer.length === 0 || expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function getBearerToken(authorizationHeader: string | null): string {
    const value = String(authorizationHeader || '').trim();
    if (!value.toLowerCase().startsWith('bearer ')) {
        return '';
    }

    return value.slice(7).trim();
}

async function handleSync(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`news_sync_${ip}`, 12, 60_000);

    if (!limit.success) {
        const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
        if (limit.retryAfter) response.headers.set('Retry-After', String(limit.retryAfter));
        return withNoStore(response);
    }

    const expectedSecret = String(process.env.NEWS_SYNC_SECRET || process.env.CRON_SECRET || '').trim();
    if (!expectedSecret) {
        return withNoStore(
            toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'News sync secret is not configured.', undefined, false)),
        );
    }

    const bearerToken = getBearerToken(request.headers.get('authorization'));
    const headerToken = String(request.headers.get('x-news-sync-secret') || '').trim();
    const providedSecret = bearerToken || headerToken;

    if (!safeEqual(expectedSecret, providedSecret)) {
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    try {
        const requestUrl = new URL(request.url);
        const dryRun = requestUrl.searchParams.get('dryRun') === '1';
        const summary = await syncFacebookNews({ dryRun });

        return withNoStore(NextResponse.json({
            success: true,
            dryRun,
            summary,
        }));
    } catch (error) {
        console.error('[News Sync] Failed to sync Facebook news:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function GET(request: Request) {
    return handleSync(request);
}

export async function POST(request: Request) {
    return handleSync(request);
}
