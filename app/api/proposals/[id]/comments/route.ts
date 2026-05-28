import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { ProposalCommentSchema } from '@/features/proposals/schema';
import {
  appendProposalCommentOrchestration,
  parseProposalIdOrNull,
  listProposalCommentsForResponse,
} from '@/features/proposals/server/comments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);

  try {
    const session = await auth();
    const { id } = await params;
    const proposalId = parseProposalIdOrNull(id);
    if (!proposalId) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PROPOSAL_ID', 'Invalid proposal ID format.')));
    }

    const trackingToken = String(new URL(request.url).searchParams.get('access') || '').trim();
    const principal = session?.user?.email?.toLowerCase().trim() || ip;
    const limit = await checkRateLimit(`proposal_comments_get_${proposalId}_${principal}_${ip}`, 60, 60_000);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const { access, comments } = await listProposalCommentsForResponse({
      proposalId,
      trackingToken,
      session,
      portalModeCookie: request.cookies.get('osr_portal_mode')?.value,
    });

    if (!access.proposal) {
      throw new ApiError(
        session?.user?.email ? 404 : 401,
        session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
        session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
      );
    }

    return withNoStore(NextResponse.json({ success: true, comments }));
  } catch (error) {
    console.error('[Proposal Comments API] GET failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);

  try {
    requireSameOriginRequest(request);
    const session = await auth();
    const { id } = await params;
    const proposalId = parseProposalIdOrNull(id);
    if (!proposalId) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PROPOSAL_ID', 'Invalid proposal ID format.')));
    }

    const contentType = request.headers.get('content-type') || '';
    let attachmentFile: File | undefined;
    let payload: { message: string; trackingToken: string };

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const candidateFile = form.get('attachment');
      attachmentFile = candidateFile instanceof File && candidateFile.size > 0 ? candidateFile : undefined;
      payload = {
        message: sanitizeText(String(form.get('message') || '')),
        trackingToken: String(form.get('trackingToken') || '').trim(),
      };
    } else {
      const body = await request.json();
      payload = {
        message: sanitizeText(String((body as { message?: unknown }).message || '')),
        trackingToken: String((body as { trackingToken?: unknown }).trackingToken || '').trim(),
      };
    }

    const parsed = ProposalCommentSchema.safeParse(payload);
    if (!parsed.success) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid comment payload.')));
    }

    const principal = session?.user?.email?.toLowerCase().trim() || ip;
    const limit = await checkRateLimit(`proposal_comments_post_${proposalId}_${principal}_${ip}`, 30, 60_000);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const result = await appendProposalCommentOrchestration({
      proposalId,
      message: parsed.data.message,
      trackingToken: parsed.data.trackingToken,
      attachmentFile,
      session,
      portalModeCookie: request.cookies.get('osr_portal_mode')?.value,
    });

    if (!result.access.proposal) {
      throw new ApiError(
        session?.user?.email ? 404 : 401,
        session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
        session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
      );
    }

    return withNoStore(NextResponse.json({
      success: true,
      comment: {
        commentId: result.comment.commentId,
        proposalId: result.comment.proposalId,
        timestamp: result.comment.timestamp,
        authorEmail: result.comment.authorEmail,
        authorRole: result.comment.authorRole,
        authorName: result.authorName,
        message: result.comment.message,
        attachmentUrl: result.comment.attachmentUrl,
      },
    }));
  } catch (error) {
    console.error('[Proposal Comments API] POST failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
