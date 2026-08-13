import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { ProposalSubmissionSchema } from '@/features/proposals/schema';
import { requireLeaderOrOfficerSession, listProposalsBySubmitterEmail } from '@/features/proposals/server/access';
import { validateAttachment } from '@/features/proposals/server/attachments';
import { createProposalSubmission } from '@/features/proposals/server/create-proposal';
import { normalizeIdempotencyKey, submissionResponseHeaders } from '@/lib/idempotency-contract';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const session = await requireLeaderOrOfficerSession(request.cookies.get('osr_portal_mode')?.value);
    const principal = session.user.email?.toLowerCase().trim() || ip;
    const limit = await checkRateLimit(`proposals_get_${principal}_${ip}`, 60, 60_000);

    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const proposals = await listProposalsBySubmitterEmail(session.user.email || '');
    return withNoStore(NextResponse.json({ success: true, proposals }));
  } catch (error) {
    console.error('[Proposals API] GET failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    requireSameOriginRequest(request);
    // Legacy Sheets consumers may omit this header; durable replay guarantees begin with the DB source cutover.
    normalizeIdempotencyKey(request.headers.get('Idempotency-Key'));
    const session = await requireLeaderOrOfficerSession(request.cookies.get('osr_portal_mode')?.value);
    const principal = session.user.email?.toLowerCase().trim() || ip;
    const limit = await checkRateLimit(`proposals_post_${principal}_${ip}`, 25, 60_000);

    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_CONTENT_TYPE', 'Invalid content type.')));
    }

    const formData = await request.formData();
    const title = sanitizeText(String(formData.get('title') || ''));
    const category = sanitizeText(String(formData.get('category') || ''));
    const projectType = sanitizeText(String(formData.get('projectType') || ''));
    const description = sanitizeText(String(formData.get('description') || ''));
    const attachment = formData.get('attachment') as File | null;

    if (!title || !category || !projectType || !description || !attachment) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Missing required fields or attachment.')));
    }

    const parsed = ProposalSubmissionSchema.safeParse({ title, category, projectType, description });
    if (!parsed.success) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Missing required fields or attachment.')));
    }

    validateAttachment(attachment);

    const submitterEmail = session.user.email || '';
    const submitterName = sanitizeText(session.user.name || 'Unknown User');

    const result = await createProposalSubmission({
      data: parsed.data,
      attachment,
      submitterEmail,
      submitterName,
    });

    return withNoStore(NextResponse.json({ ...result, replayed: false }, { headers: submissionResponseHeaders(false) }));
  } catch (error) {
    console.error('[Proposals API] Failed to process proposal submission:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
