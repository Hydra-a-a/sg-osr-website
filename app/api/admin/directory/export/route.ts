import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { logAuditAction } from '@/lib/audit';
import { exportDirectoryToSheets } from '@/lib/directory-export';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_directory_export_${email}_${ip}`, 6, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        if (process.env.SHEETS_EXPORT_ENABLED !== 'true') {
            throw new ApiError(503, 'SHEETS_EXPORT_DISABLED', 'Sheets export is not enabled.', undefined, false);
        }

        const result = await exportDirectoryToSheets(email);
        logAuditAction('DIRECTORY_EXPORT_REQUESTED', {
            source: 'admin_directory_dashboard',
            rowCount: result.rowCount,
            tabTitle: result.tabTitle,
        });

        return withNoStore(NextResponse.json({ success: true, export: result }));
    } catch (error) {
        console.error('[Admin Directory Export API] Failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
