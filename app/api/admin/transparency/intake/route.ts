import { NextResponse } from 'next/server';
import { reconciliationSchema } from '@/schemas/classroom';
import { ApiError } from '@/lib/api-errors';
import { withNoStore, rateLimitResponse } from '@/lib/api-responses';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { assertTransparencyOfficer } from '@/lib/transparency';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';
import { logAuditAction } from '@/lib/audit';

export async function PATCH(request: Request) {
    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_transparency_intake_${email}_${getClientIp(request)}`, 20, 60_000);
        if (!limit.success) return rateLimitResponse(limit);
        const parsed = reconciliationSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Provide a verified outcome, review note, current record timestamp, and Classroom ID for accepted submissions.');
        const { prisma } = await import('@/lib/prisma');
        await prisma.$transaction(async tx => {
            await assertTransparencyOfficer(email, tx);
            const result = await tx.transparencySubmission.updateMany({
                where: { id: parsed.data.id, status: 'RECONCILIATION', updatedAt: { equals: new Date(parsed.data.expectedUpdatedAt), lte: new Date(Date.now() - 5 * 60_000) } },
                data: { status: parsed.data.status, reviewNote: parsed.data.reviewNote, classroomSubmissionId: parsed.data.classroomSubmissionId ?? null },
            });
            if (result.count !== 1) throw new ApiError(409, 'INTAKE_CONFLICT', 'Reload the intake. Only unchanged reconciliation records older than five minutes can be resolved.');
        });
        logAuditAction('ADMIN_TRANSPARENCY_INTAKE_RECONCILED', { source: 'api/admin/transparency/intake', reason: parsed.data.status });
        return withNoStore(NextResponse.json({ success: true }));
    } catch (error) {
        const known = error instanceof ApiError;
        return withNoStore(NextResponse.json({ error: { code: known ? error.code : 'INTAKE_UNAVAILABLE', message: known && error.exposeMessage ? error.message : 'Intake reconciliation is temporarily unavailable.' } }, { status: known ? error.statusCode : 503 }));
    }
}
