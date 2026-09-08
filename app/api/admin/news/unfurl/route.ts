import { NextRequest, NextResponse } from 'next/server';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { logAuditAction } from '@/lib/audit';
import { unfurlPostUrl } from '@/lib/unfurl';

function noStore(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export async function POST(request: NextRequest) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();

        const ip = getClientIp(request);
        const limit = await checkRateLimit(`admin_news_unfurl_${email}_${ip}`, 20, 60_000);
        if (!limit.success) {
            return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many link unfurl requests.')));
        }

        const body = await request.json().catch(() => ({})) as { url?: string };
        const targetUrl = String(body.url || '').trim();

        if (!targetUrl) {
            throw new ApiError(422, 'INVALID_REQUEST', 'Please provide a valid URL to import.');
        }

        const draft = await unfurlPostUrl(targetUrl);

        logAuditAction('ADMIN_NEWS_UNFURL_REQUESTED', {
            actor: email,
            url: targetUrl,
            postId: draft.id,
            source: draft.sourcePageName,
        });

        return noStore(NextResponse.json({ success: true, draft }));
    } catch (error) {
        console.error('[Admin News Unfurl API] failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
