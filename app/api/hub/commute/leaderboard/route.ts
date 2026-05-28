import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { getLeaderboard } from '@/lib/commute-providers';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const limit = await checkRateLimit(`commute_leaderboard_${ip}`, 40, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many leaderboard requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const entries = await getLeaderboard();
        return withNoStore(NextResponse.json({ success: true, entries }));
    } catch (error) {
        console.error('[Commute Leaderboard API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
