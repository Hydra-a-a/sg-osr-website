import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { assertTransparencyOfficer } from '@/lib/transparency';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitResponse } from '@/lib/api-responses';
import { ApiError } from '@/lib/api-errors';
import { transparencyError, transparencyJson } from '@/lib/transparency-api';
import { streamTransparencyPdf, uploadTransparencyPdf } from '@/lib/transparency-pdf';

export async function GET(request: NextRequest) {
  try {
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_admin_pdf_read_${email}`, 30, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    return await streamTransparencyPdf(request.nextUrl.searchParams.get('id') || '', request.nextUrl.searchParams.get('download') === '1', true);
  } catch (error) { return transparencyError(error); }
}
export async function POST(request: NextRequest) {
  try {
    requireSameOriginRequest(request);
    const { email } = await requireActiveDatabaseOfficer();
    await assertTransparencyOfficer(email);
    const limit = await checkRateLimit(`transparency_admin_pdf_write_${email}`, 10, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    const length = Number(request.headers.get('content-length'));
    if (!Number.isFinite(length) || length < 0 || length > 21 * 1024 * 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Upload one PDF of 20 MB or smaller.');
    const form = await request.formData();
    const parsed = z.object({ id: z.string().min(1).max(100), version: z.coerce.number().int().positive() }).safeParse({ id: form.get('id'), version: form.get('version') });
    const file = form.get('file');
    if (!parsed.success || !(file instanceof File)) throw new ApiError(400, 'INVALID_UPLOAD', 'Choose a PDF and reload the current draft.');
    const report = await uploadTransparencyPdf(parsed.data.id, parsed.data.version, file, email);
    return transparencyJson({ success: true, report });
  } catch (error) { return transparencyError(error); }
}
