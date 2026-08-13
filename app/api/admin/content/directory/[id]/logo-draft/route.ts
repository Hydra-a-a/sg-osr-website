import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { stageDirectoryLogo } from '@/lib/directory-logo-manager';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_directory_logo_stage_${email}_${getClientIp(request)}`, 20, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many upload requests.')));
        const { id } = await context.params;
        const form = await request.formData();
        const file = form.get('logo');
        if (typeof File === 'undefined' || !(file instanceof File)) throw new ApiError(400, 'INVALID_LOGO_FILE', 'Choose a logo image to stage.');
        const result = await stageDirectoryLogo({ directoryKey: id, file, actorEmail: email });
        logAuditAction('DIRECTORY_LOGO_STAGED', { source: 'admin_content_draft', directoryKey: id, actor: email });
        return noStore(NextResponse.json({ success: true, logo: result }));
    } catch (error) {
        console.error('[Admin Content Directory Logo] stage failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
