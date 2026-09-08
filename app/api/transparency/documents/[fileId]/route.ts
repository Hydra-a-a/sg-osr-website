import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';
import { rateLimitResponse } from '@/lib/api-responses';
import { streamTransparencyPdf } from '@/lib/transparency-pdf';
import { transparencyError } from '@/lib/transparency-api';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, context: { params: Promise<{ fileId: string }> }) {
  try {
    const limit = await checkRateLimit(`transparency_pdf_${getClientIp(request)}`, 30, 60_000);
    if (!limit.success) return rateLimitResponse(limit);
    return await streamTransparencyPdf((await context.params).fileId, request.nextUrl.searchParams.get('download') === '1');
  } catch (error) { return transparencyError(error); }
}
