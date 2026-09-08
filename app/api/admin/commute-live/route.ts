import { NextRequest, NextResponse } from 'next/server';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import {
  createOfficialCommuteAlert,
  getCommuteLiveAdminSnapshot,
  moderateCommuteAlert,
} from '@/lib/commute-live';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { moderateCommuteAlertSchema, officialCommuteAlertSchema } from '@/schemas/commute-live';

export const dynamic = 'force-dynamic';

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
  }
}

export async function GET(request: NextRequest) {
  try {
    const { email } = await requireActiveDatabaseOfficer();
    const limit = await checkRateLimit(`admin_commute_live_read_${email}_${getClientIp(request)}`, 60, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    return withNoStore(NextResponse.json({ success: true, ...(await getCommuteLiveAdminSnapshot()) }));
  } catch (error) {
    console.error('[Admin Commute Live API] GET failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}

export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    const limit = await checkRateLimit(`admin_commute_live_post_${email}_${getClientIp(request)}`, 10, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const parsed = officialCommuteAlertSchema.safeParse(await readBody(request));
    if (!parsed.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Check the official update fields.', parsed.error.flatten().fieldErrors);
    }
    const alert = await createOfficialCommuteAlert(parsed.data, email);
    return withNoStore(NextResponse.json({ success: true, alert }, { status: 201 }));
  } catch (error) {
    console.error('[Admin Commute Live API] POST failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    const limit = await checkRateLimit(`admin_commute_live_moderate_${email}_${getClientIp(request)}`, 30, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const parsed = moderateCommuteAlertSchema.safeParse(await readBody(request));
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid moderation action.');
    await moderateCommuteAlert(parsed.data, email);
    return withNoStore(NextResponse.json({ success: true }));
  } catch (error) {
    console.error('[Admin Commute Live API] PATCH failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
