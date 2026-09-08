import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { confirmCommuteAlert } from '@/lib/commute-live';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { commuteAlertConfirmationSchema } from '@/schemas/commute-live';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!email || !email.endsWith('@rtu.edu.ph')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Sign in with your RTU account to confirm an update.');
    }

    const limit = await checkRateLimit(`commute_live_confirm_${email}_${getClientIp(request)}`, 30, 10 * 60_000);
    if (!limit.success) return rateLimitResponse(limit, 'Too many confirmations. Please wait a moment.');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
    }
    const parsed = commuteAlertConfirmationSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid commute update.');

    const alert = await confirmCommuteAlert(parsed.data.alertId, email);
    return withNoStore(NextResponse.json({ success: true, alert }));
  } catch (error) {
    console.error('[Commute Live Confirm API] POST failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
