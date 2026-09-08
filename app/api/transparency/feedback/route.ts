import { NextRequest } from 'next/server';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-responses';
import { ApiError } from '@/lib/api-errors';
import { requireTransparencyStudent, privateFeedbackSelect } from '@/lib/transparency-feedback';
import { transparencyError, transparencyJson, parseTransparencyBody } from '@/lib/transparency-api';
import { feedbackSchema } from '@/schemas/transparency';
export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const actor = await requireTransparencyStudent();
    const limit = await checkRateLimit(`transparency_feedback_${actor.email}`, 5, 10 * 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await parseTransparencyBody(request, feedbackSchema);
    const { prisma } = await import('@/lib/prisma');
    const feedback = await prisma.$transaction(async tx => {
      const report = await tx.transparencyReport.findFirst({ where: { id: body.reportId, status: { in: ['PUBLISHED', 'SUPERSEDED'] } } });
      if (!report) throw new ApiError(404, 'REPORT_UNAVAILABLE', 'This report is unavailable for feedback.');
      if (body.projectId && !await tx.transparencyBudgetLine.findFirst({ where: { id: body.projectId, reportId: report.id } })) throw new ApiError(400, 'INVALID_PROJECT', 'Choose a project from this report.');
      return tx.transparencyFeedback.create({ data: { ...body, submitterEmail: actor.email, submitterName: actor.name }, select: privateFeedbackSelect });
    });
    return transparencyJson({ success: true, feedback }, 201);
  } catch (error) { return transparencyError(error); }
}
