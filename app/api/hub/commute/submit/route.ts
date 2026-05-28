import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { ContributorSubmissionSchema } from '@/schemas/commute';
import { submitCommunityRoute } from '@/lib/commute-providers';

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
        const limit = await checkRateLimit(`commute_submit_${principal}_${ip}`, 6, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many route submissions. Please wait a moment.'));
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

        const validation = ContributorSubmissionSchema.safeParse(body);
        if (!validation.success) {
            throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid route submission.', validation.error.flatten().fieldErrors);
        }

        const payload = {
            ...validation.data,
            contributorName: sanitizeText(validation.data.contributorName || session.user.name || 'Student'),
            contributorPublicLabel: sanitizeText(validation.data.contributorPublicLabel || ''),
        };

        const result = await submitCommunityRoute(payload);
        if (result.kind === 'duplicate') {
            throw new ApiError(
                409,
                'DUPLICATE_SUBMISSION',
                result.similarityReason || 'This looks similar to a route you already submitted recently.',
                { duplicateOfRowNumber: result.duplicateOfRowNumber },
            );
        }

        return withNoStore(NextResponse.json({
            success: true,
            rowNumber: result.rowNumber,
            publicLabel: result.publicLabel,
        }));
    } catch (error) {
        console.error('[Commute Submit API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
