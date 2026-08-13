import { NextRequest, NextResponse } from 'next/server';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function POST(request: NextRequest) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_news_sync_${email}_${getClientIp(request)}`, 6, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many sync requests.')));
        const body = await request.json().catch(() => ({})) as { mode?: 'dry-run' | 'sync' };
        const mode = body.mode || 'dry-run';
        if (mode !== 'dry-run' && mode !== 'sync') throw new ApiError(422, 'INVALID_REQUEST', 'Sync mode must be dry-run or sync.');
        const { syncFacebookNews } = await import('@/lib/facebook-news-sync');
        const summary = await syncFacebookNews({ dryRun: mode === 'dry-run' });
        logAuditAction('ADMIN_NEWS_SYNC_REQUESTED', { source: 'facebook', reason: mode, actor: email, pagesChecked: summary.pagesChecked, postsFetched: summary.postsFetched });
        return noStore(NextResponse.json({ success: true, mode, summary }));
    } catch (error) {
        console.error('[Admin News Sync API] failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
