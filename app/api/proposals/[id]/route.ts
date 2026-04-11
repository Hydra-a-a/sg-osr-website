import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { deriveEffectivePortalRole, hasOfficerPrivilege } from '@/lib/portal-mode';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { lookupProposalByIdForOwner, parseProposalId } from '@/lib/proposals';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

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
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const portalModeCookie = request.cookies.get('osr_portal_mode')?.value;
        const effectiveRole = session?.user
            ? deriveEffectivePortalRole((session.user as { role?: unknown }).role, portalModeCookie)
            : null;
        const proposal = await lookupProposalByIdForOwner(proposalId, {
            ownerEmail: session?.user?.email,
            trackingToken,
            allowPrivileged: hasOfficerPrivilege((session?.user as { role?: unknown } | undefined)?.role),
            effectiveRole,
        });

        if (!proposal) {
            return withNoStore(toApiResponse(new ApiError(
                session?.user?.email ? 404 : 401,
                session?.user?.email ? 'PROPOSAL_NOT_FOUND' : 'UNAUTHORIZED',
                session?.user?.email ? 'No proposal found with that ID.' : 'Authentication or valid proposal access token required.',
            )));
        }

        return withNoStore(NextResponse.json({ success: true, proposal }));
    } catch (error) {
        console.error('[Proposal Lookup API] Failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
