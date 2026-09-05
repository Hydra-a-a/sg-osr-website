import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { createAdminContentDraft, listAdminContent, parseAdminContentType } from '@/lib/admin-content';
import { resolveDirectorySource } from '@/lib/directory-repository';
import { resolvePublicContentSource } from '@/lib/public-content-source';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

function publicSourceFor(type: ReturnType<typeof parseAdminContentType>) {
    if (type === 'directory') return resolveDirectorySource();
    if (type === 'news') return resolvePublicContentSource('NEWS_SOURCE');
    if (type === 'hub-guide') return resolvePublicContentSource('HUB_GUIDES_SOURCE');
    return resolvePublicContentSource('QUICK_LINKS_SOURCE');
}

export async function GET(request: NextRequest, context: { params: Promise<{ contentType: string }> }) {
    try {
        const { email } = await requireActiveDatabaseOfficer();
        const { contentType } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_list_${email}_${getClientIp(request)}`, 60, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const records = await listAdminContent(type);
        return noStore(NextResponse.json({ success: true, contentType: type, records, publicSource: publicSourceFor(type) }));
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
        const body = await request.json() as { payload?: unknown };
        if (body.payload === undefined) throw new ApiError(400, 'INVALID_REQUEST', 'A payload is required.');
        const record = await createAdminContentDraft(type, body.payload, { id: email, label: email });
        logAuditAction('ADMIN_CONTENT_DRAFT_CREATED', { source: type, entityId: record.id, actor: email });
        return noStore(NextResponse.json({ success: true, record }, { status: 201 }));
    } catch (error) {
        console.error('[Admin Content API] draft save failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
