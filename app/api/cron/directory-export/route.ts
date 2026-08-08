import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { exportDirectoryToSheets } from '@/lib/directory-export';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';

function safeEqual(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length > 0
        && expectedBuffer.length === providedBuffer.length
        && timingSafeEqual(expectedBuffer, providedBuffer);
}

function getBearerToken(value: string | null): string {
    const header = String(value || '').trim();
    return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

async function handle(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`directory_export_cron_${ip}`, 12, 60_000);
    if (!limit.success) return rateLimitResponse(limit);

    const expectedSecret = String(process.env.CRON_SECRET || '').trim();
    const providedSecret = getBearerToken(request.headers.get('authorization'))
        || String(request.headers.get('x-cron-secret') || '').trim();
    if (!safeEqual(expectedSecret, providedSecret)) {
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    if (process.env.SHEETS_EXPORT_ENABLED !== 'true') {
        return withNoStore(toApiResponse(new ApiError(503, 'SHEETS_EXPORT_DISABLED', 'Sheets export is not enabled.', undefined, false)));
    }

    try {
        const result = await exportDirectoryToSheets('vercel-cron');
        return withNoStore(NextResponse.json({ success: true, export: result }));
    } catch (error) {
        console.error('[Directory Export Cron] Failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function GET(request: Request) {
    return handle(request);
}

export async function POST(request: Request) {
    return handle(request);
}
