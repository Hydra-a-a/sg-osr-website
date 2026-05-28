import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { parseProposalId } from '@/lib/proposals';
import { resolveProposalAccess } from '@/features/proposals/server/access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(request);

  try {
    const session = await auth();
    const { id } = await params;
    const proposalId = String(id || '').trim().toUpperCase();
    if (!parseProposalId(proposalId)) {
      return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PROPOSAL_ID', 'Invalid proposal ID format.')));
    }

    const trackingToken = new URL(request.url).searchParams.get('access');
    const principal = session?.user?.email?.toLowerCase().trim() || ip;
    const limit = await checkRateLimit(`proposal_lookup_${proposalId}_${principal}_${ip}`, 40, 60_000);
    if (!limit.success) {
      return rateLimitResponse(limit);
    }

    const access = await resolveProposalAccess({
      proposalId,
      trackingToken: trackingToken || '',
      session,
      portalModeCookie: request.cookies.get('osr_portal_mode')?.value,
    });

    if (!access.proposal) {
      return withNoStore(toApiResponse(new ApiError(
        session?.user?.email ? 404 : 401,
        session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
        session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
      )));
    }

    return withNoStore(NextResponse.json({ success: true, proposal: access.proposal }));
  } catch (error) {
    console.error('[Proposal Lookup API] Failed:', redactErrorForLog(error));
    return withNoStore(toApiResponse(error));
  }
}
