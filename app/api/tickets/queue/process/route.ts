import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { processTicketNotificationQueue } from '@/lib/tickets';

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
    const value = (authorizationHeader || '').trim();
    if (!value.toLowerCase().startsWith('bearer ')) {
        return '';
    }

    return value.slice(7).trim();
}

function resolveSyncSecret(): string {
    return (
        process.env.TICKET_STATUS_SYNC_SECRET
        || process.env.CRON_SECRET
        || ''
    ).trim();
}

async function handleProcess(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`ticket_queue_process_${ip}`, 30, 60_000);

    if (!limit.success) {
        const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
        if (limit.retryAfter) {
            response.headers.set('Retry-After', String(limit.retryAfter));
        }
        return withNoStore(response);
    }

    const expectedSecret = resolveSyncSecret();
    if (!expectedSecret) {
        return withNoStore(
            toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Ticket sync secret is not configured.', undefined, false)),
        );
    }

    const bearerToken = getBearerToken(request.headers.get('authorization'));
    const headerToken = (request.headers.get('x-ticket-sync-secret') || '').trim();
    const providedSecret = bearerToken || headerToken;

    if (!safeEqual(expectedSecret, providedSecret)) {
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    try {
        const requestUrl = new URL(request.url);
        const dryRun = requestUrl.searchParams.get('dryRun') === '1';
        const requestedLimit = Number.parseInt(requestUrl.searchParams.get('limit') || '', 10);
        const limitValue = Number.isFinite(requestedLimit) ? requestedLimit : undefined;

        const summary = await processTicketNotificationQueue({
            dryRun,
            limit: limitValue,
        });

        return withNoStore(NextResponse.json({
            success: true,
            summary,
        }));
    } catch (error) {
        console.error('[Ticket Queue Process] Failed to process notification queue:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

// Vercel Cron Jobs send GET requests to scheduled endpoints.
export async function GET(request: Request) {
    return handleProcess(request);
}

export async function POST(request: Request) {
    return handleProcess(request);
}
