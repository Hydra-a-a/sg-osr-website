import 'server-only';
import { auth } from '@/lib/auth';
import { ApiError } from '@/lib/api-errors';

export async function requireTransparencyStudent() {
  const session = await auth();
  const email = (session?.user?.email || '').trim().toLowerCase();
  if (!email.endsWith('@rtu.edu.ph') || session?.user?.isDevSim) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in with your RTU account.');
  return { email, name: session.user.name || '' };
}
export const privateFeedbackSelect = {
  id: true, reportId: true, projectId: true, category: true, message: true, status: true,
  response: true, createdAt: true, updatedAt: true, report: { select: { title: true, slug: true } },
} as const;
