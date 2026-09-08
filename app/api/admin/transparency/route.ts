import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-responses';
import { assertTransparencyOfficer, listAdminTransparency, createTransparencyDraft, changeTransparencyReport } from '@/lib/transparency';
import { transparencyError, transparencyJson, parseTransparencyBody } from '@/lib/transparency-api';
import { reportActionSchema } from '@/schemas/transparency';

export async function GET() {
  try {
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_admin_read_${email}`, 60, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    return transparencyJson({ success: true, ...await listAdminTransparency() });
  } catch (error) { return transparencyError(error); }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_admin_create_${email}`, 20, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await parseTransparencyBody(request, z.object({ submissionId: z.string().min(1).max(100), predecessorId: z.string().min(1).max(100).optional() }));
    const report = await createTransparencyDraft(body.submissionId, body.predecessorId, email);
    return transparencyJson({ success: true, report }, 201);
  } catch (error) { return transparencyError(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_admin_write_${email}`, 40, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const body = await parseTransparencyBody(request, reportActionSchema);
    const report = await changeTransparencyReport(body, email);
    console.info('[Transparency audit]', { action: body.action, reportId: body.id, version: report.version });
    return transparencyJson({ success: true, report });
  } catch (error) { return transparencyError(error); }
}
