import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { getAdminContent, parseAdminContentType, saveAdminContentDraft, discardAdminContentDraft } from '@/lib/admin-content';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function GET(request: NextRequest, context: { params: Promise<{ contentType: string; id: string }> }) {
    try {
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType, id } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_record_${email}_${getClientIp(request)}`, 120, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        return noStore(NextResponse.json({ success: true, contentType: type, record: await getAdminContent(type, id) }));
    } catch (error) {
        console.error('[Admin Content API] record failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ contentType: string; id: string }> }) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType, id } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_write_${email}_${getClientIp(request)}`, 40, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const body = await request.json() as { payload?: unknown };
        if (body.payload === undefined) throw new ApiError(400, 'INVALID_REQUEST', 'A payload is required.');
        const draft = await saveAdminContentDraft(type, id, body.payload, { id: email, label: email });
        logAuditAction('ADMIN_CONTENT_DRAFT_SAVED', { source: type, entityId: id, actor: email });
        return noStore(NextResponse.json({ success: true, draft }));
    } catch (error) {
        console.error('[Admin Content API] draft update failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ contentType: string; id: string }> }) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType, id } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_write_${email}_${getClientIp(request)}`, 40, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        await discardAdminContentDraft(type, id);
        logAuditAction('ADMIN_CONTENT_DRAFT_DISCARDED', { source: type, entityId: id, actor: email });
        return noStore(NextResponse.json({ success: true }));
    } catch (error) {
        console.error('[Admin Content API] draft discard failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
