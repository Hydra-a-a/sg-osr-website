import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { RouteIssueSchema } from '@/schemas/commute';
import { submitRouteIssue } from '@/lib/commute-providers';

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

        const principal = session.user.email.toLowerCase().trim();
        const limit = await checkRateLimit(`commute_issue_${principal}_${ip}`, 8, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many route feedback reports. Please wait a moment.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            throw new ApiError(400, 'INVALID_JSON', 'Invalid request body format.');
        }

        const validation = RouteIssueSchema.safeParse(body);
        if (!validation.success) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid route issue payload.', validation.error.flatten().fieldErrors);
        }

        try {
            await submitRouteIssue(validation.data, sanitizeText(String(session.user.name || session.user.email || 'Student')));
        } catch (routeError: any) {
            if (routeError instanceof Error && routeError.message === 'ROUTE_NOT_FOUND') {
                throw new ApiError(404, 'ROUTE_NOT_FOUND', 'That route could not be found.');
            }
            if (routeError instanceof Error && routeError.message === 'INVALID_ISSUE_TARGET') {
                throw new ApiError(409, 'INVALID_ISSUE_TARGET', 'That route is not accepting issue reports right now.');
            }
            throw routeError;
        }

        return withNoStore(NextResponse.json({ success: true }));
    } catch (error) {
        console.error('[Commute Issue API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
