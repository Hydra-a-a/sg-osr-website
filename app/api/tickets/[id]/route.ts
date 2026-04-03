import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { lookupTicketById } from '@/lib/tickets';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

/**
 * GET /api/tickets/[id]
 * Public endpoint — no auth required so students can track anonymous tickets.
 * Returns only safe, non-PII fields.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const ip = getClientIp(request);
    const url = new URL(request.url);
    const trackingToken = url.searchParams.get('access');
    const { id: rawId } = await params;

    // Rate limit: 20 lookups per minute per IP to prevent enumeration attacks
    const limit = await checkRateLimit(`ticket_lookup_${ip}`, 20, 60000);
    if (!limit.success) {
        const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'));
        if (limit.retryAfter) response.headers.set('Retry-After', String(limit.retryAfter));
        return withNoStore(response);
    }

    // Basic format validation to avoid needlessly querying Sheets.
    // Supports legacy 4-char suffixes and newer high-entropy suffixes.
    if (!rawId || !/^TKT-\d{4}-[A-Z0-9]{4,16}$/i.test(rawId.trim())) {
        return withNoStore(
            toApiResponse(new ApiError(400, 'INVALID_TICKET_ID', 'Invalid ticket ID format. Expected: TKT-YYMM-XXXX...'))
        );
    }

    try {
        const ticket = await lookupTicketById(rawId, trackingToken);

        if (!ticket) {
            return withNoStore(
                toApiResponse(new ApiError(404, 'TICKET_NOT_FOUND', 'No ticket found with that ID.'))
            );
        }

        return withNoStore(NextResponse.json({ success: true, ticket }));

    } catch (error) {
        console.error('[Ticket Lookup] Error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(new ApiError(500, 'INTERNAL_ERROR', 'Failed to look up ticket.')));
    }
}
