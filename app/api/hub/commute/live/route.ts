import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { createStudentCommuteAlert, listPublicCommuteAlerts } from '@/lib/commute-live';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { COMMUTE_LIVE_CORRIDORS, studentCommuteAlertSchema } from '@/schemas/commute-live';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await listPublicCommuteAlerts();
    return NextResponse.json(
      { success: true, alerts, corridors: COMMUTE_LIVE_CORRIDORS, updatedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (error) {
    console.error('[Commute Live API] GET failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!email || !email.endsWith('@rtu.edu.ph')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Sign in with your RTU account to report an update.');
    }

    const limit = await checkRateLimit(`commute_live_report_${email}_${getClientIp(request)}`, 6, 10 * 60_000);
    if (!limit.success) return rateLimitResponse(limit, 'Too many commute updates. Please wait before reporting again.');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
    }
    const parsed = studentCommuteAlertSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Check the commute update fields.', parsed.error.flatten().fieldErrors);
    }

    const alert = await createStudentCommuteAlert(parsed.data, email);
    return withNoStore(NextResponse.json({ success: true, alert }, { status: 201 }));
  } catch (error) {
    console.error('[Commute Live API] POST failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
