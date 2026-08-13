import { NextRequest, NextResponse } from 'next/server';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { listAdminContentHistory, parseAdminContentType } from '@/lib/admin-content';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function GET(request: NextRequest, context: { params: Promise<{ contentType: string; id: string }> }) {
    try {
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType, id } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_history_${email}_${getClientIp(request)}`, 60, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const history = await listAdminContentHistory(type, id);
        logAuditAction('ADMIN_CONTENT_HISTORY_READ', { source: type, entityId: id, actor: email });
        return noStore(NextResponse.json({ success: true, history }));
    } catch (error) {
        console.error('[Admin Content API] history failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
