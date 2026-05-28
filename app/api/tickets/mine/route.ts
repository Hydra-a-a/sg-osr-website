import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { listTicketsByOwnerEmail } from '@/features/tickets/server/access';

/**
 * GET /api/tickets/mine
 * Authenticated endpoint for students to list their own submitted tickets.
 */
export async function GET(request: Request) {
    const ip = getClientIp(request);

    const session = await auth();
    const ownerEmail = String(session?.user?.email || '').trim().toLowerCase();

    if (!ownerEmail) {
        return withNoStore(toApiResponse(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized')));
    }

    const limit = await checkRateLimit(`ticket_mine_${ownerEmail}_${ip}`, 30, 60_000);
    if (!limit.success) {
        return rateLimitResponse(limit, 'Too many requests. Try again later.');
    }

    try {
        const tickets = await listTicketsByOwnerEmail(ownerEmail);
        return withNoStore(NextResponse.json({
            success: true,
            tickets,
        }));
    } catch (error) {
        console.error('[Ticket Mine] Error:', redactErrorForLog(error));
        return withNoStore(toApiResponse(new ApiError(500, 'INTERNAL_ERROR', 'Failed to load your tickets.')));
    }
}
