import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { stageHubGuideFileDraft } from '@/lib/admin-content';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function POST(request: NextRequest) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_hub_guide_upload_${email}_${getClientIp(request)}`, 12, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many upload requests.')));

        const form = await request.formData();
        const file = form.get('file');
        const rawPayload = form.get('payload');
        const recordId = String(form.get('recordId') || '').trim();
        if (typeof File === 'undefined' || !(file instanceof File)) throw new ApiError(400, 'INVALID_HUB_GUIDE_FILE', 'Choose a PDF to upload.');
        if (typeof rawPayload !== 'string') throw new ApiError(400, 'INVALID_REQUEST', 'Guide metadata is required.');
        if (recordId && !/^[a-zA-Z0-9_-]{10,200}$/.test(recordId)) throw new ApiError(400, 'INVALID_REQUEST', 'Invalid guide draft.');

        let payload: unknown;
        try {
            payload = JSON.parse(rawPayload);
        } catch {
            throw new ApiError(400, 'INVALID_REQUEST', 'Guide metadata is invalid.');
        }

        const record = await stageHubGuideFileDraft({ id: recordId || undefined, payload, file, editor: { id: email, label: email } });
        logAuditAction('HUB_GUIDE_PDF_STAGED', { source: 'hub-guide', entityId: record.id, actor: email });
        return noStore(NextResponse.json({ success: true, record }, { status: recordId ? 200 : 201 }));
    } catch (error) {
        console.error('[Admin Hub Guide Upload] stage failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
