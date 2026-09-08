import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-responses';
import { requireTransparencyStudent, privateFeedbackSelect } from '@/lib/transparency-feedback';
import { transparencyError, transparencyJson } from '@/lib/transparency-api';
export async function GET() {
  try {
    const actor = await requireTransparencyStudent();
    const limit = await checkRateLimit(`transparency_feedback_mine_${actor.email}`, 30, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const { prisma } = await import('@/lib/prisma');
    const feedback = await prisma.transparencyFeedback.findMany({ where: { submitterEmail: actor.email }, select: privateFeedbackSelect, orderBy: { createdAt: 'desc' }, take: 200 });
    return transparencyJson({ success: true, feedback });
  } catch (error) { return transparencyError(error); }
}
