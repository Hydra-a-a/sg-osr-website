import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { PORTAL_MODE_COOKIE, deriveEffectivePortalRole } from '@/lib/portal-mode';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { listModerationRoutes, updateModerationRoute } from '@/lib/commute-providers';
import { RouteModerationActionSchema } from '@/schemas/commute';

const RouteModerationSchema = z.object({
    rowNumber: z.number().int().min(2),
    action: RouteModerationActionSchema,
    reviewNotes: z.string().trim().max(2000).optional().default(''),
});

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

async function requireOfficerSession(request: NextRequest) {
    const session = await auth();
    if (!session?.user?.email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const portalMode = request.cookies.get(PORTAL_MODE_COOKIE)?.value;
    const effectiveRole = deriveEffectivePortalRole(session.user.role, portalMode);
    if (effectiveRole !== 'officer') {
        throw new ApiError(403, 'FORBIDDEN', 'Officer mode is required for route moderation.');
    }

    return session;
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        await requireOfficerSession(request);
        const limit = await checkRateLimit(`admin_routes_get_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const routes = await listModerationRoutes();
        return withNoStore(NextResponse.json({ success: true, routes }));
    } catch (error) {
        console.error('[Admin Routes API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const session = await requireOfficerSession(request);
        const limit = await checkRateLimit(`admin_routes_patch_${session.user.email?.toLowerCase().trim() || ip}_${ip}`, 40, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const rawPayload = await request.json();
        const parsed = RouteModerationSchema.safeParse(rawPayload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid route moderation payload.')));
        }

        const actor = sanitizeText(String(session.user.name || session.user.email || 'OSR Officer'));
        await updateModerationRoute(parsed.data.rowNumber, parsed.data.action, actor, sanitizeText(parsed.data.reviewNotes));

        return withNoStore(NextResponse.json({
            success: true,
            rowNumber: parsed.data.rowNumber,
            action: parsed.data.action,
        }));
    } catch (error) {
        console.error('[Admin Routes API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
