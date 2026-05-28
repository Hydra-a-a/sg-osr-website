import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { CommuteVoteSchema } from '@/schemas/commute';
import { castRouteVote } from '@/lib/commute-providers';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const session = await auth();
        if (!session?.user?.email) {
            throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
        }

        const validation = CommuteVoteSchema.safeParse(body);
        if (!validation.success) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid vote payload.', validation.error.flatten().fieldErrors);
        }

        const principal = session.user.email.toLowerCase().trim();
        const limit = await checkRateLimit(`commute_vote_${principal}_${validation.data.rowNumber}_${validation.data.voteType}`, 1, 12 * 60 * 60 * 1000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'ALREADY_VOTED', 'You already voted on this route recently.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        let counts;
        try {
            counts = await castRouteVote(validation.data.rowNumber, validation.data.voteType);
        } catch (voteError: any) {
            if (voteError instanceof Error && voteError.message === 'INVALID_VOTE_TARGET') {
                throw new ApiError(409, 'INVALID_VOTE_TARGET', 'This route is not eligible for voting right now.');
            }
            throw voteError;
        }

        return withNoStore(NextResponse.json({
            success: true,
            rowNumber: validation.data.rowNumber,
            ...counts,
        }));
    } catch (error) {
        console.error('[Commute Vote API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
