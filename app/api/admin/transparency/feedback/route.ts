import { NextRequest } from 'next/server';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { assertTransparencyOfficer } from '@/lib/transparency';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-responses';
import { transparencyError, transparencyJson, parseTransparencyBody } from '@/lib/transparency-api';
import { feedbackUpdateSchema } from '@/schemas/transparency';
export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_feedback_admin_${email}`, 40, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await parseTransparencyBody(request, feedbackUpdateSchema);
    const { prisma } = await import('@/lib/prisma');
    const feedback = await prisma.$transaction(async tx => {
      await assertTransparencyOfficer(email, tx);
      return tx.transparencyFeedback.update({ where: { id: body.id }, data: { status: body.status, response: body.response, respondedBy: email, respondedAt: new Date() } });
    });
    return transparencyJson({ success: true, feedback });
  } catch (error) { return transparencyError(error); }
}
