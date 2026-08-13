import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { listAdminContent, parseAdminContentType } from '@/lib/admin-content';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function GET(request: NextRequest, context: { params: Promise<{ contentType: string }> }) {
    try {
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_list_${email}_${getClientIp(request)}`, 60, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const records = await listAdminContent(type);
        return noStore(NextResponse.json({ success: true, contentType: type, records }));
    } catch (error) {
        console.error('[Admin Content API] list failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest, context: { params: Promise<{ contentType: string }> }) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_write_${email}_${getClientIp(request)}`, 40, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const body = await request.json() as { entityId?: string; payload?: unknown };
        if (!body.entityId || body.payload === undefined) throw new ApiError(400, 'INVALID_REQUEST', 'A record and payload are required.');
        const { saveAdminContentDraft } = await import('@/lib/admin-content');
        const draft = await saveAdminContentDraft(type, body.entityId, body.payload, { id: email, label: email });
        logAuditAction('ADMIN_CONTENT_DRAFT_SAVED', { source: type, entityId: body.entityId, actor: email });
        return noStore(NextResponse.json({ success: true, draft }, { status: 201 }));
    } catch (error) {
        console.error('[Admin Content API] draft save failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
