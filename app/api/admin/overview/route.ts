import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getAdminOverview, getAdminSurfaceOverview } from '@/lib/admin-overview';
import { checkRateLimit } from '@/lib/rate-limit';
import { PORTAL_MODE_COOKIE, deriveEffectivePortalRole } from '@/lib/portal-mode';
import { getClientIp, redactErrorForLog } from '@/lib/security';

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

async function requireOfficerSession(request: NextRequest): Promise<{ email: string }> {
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const effectiveRole = deriveEffectivePortalRole(
        session?.user?.role,
        request.cookies.get(PORTAL_MODE_COOKIE)?.value,
    );
    if (effectiveRole !== 'officer') {
        throw new ApiError(403, 'FORBIDDEN', 'Officer access is required.');
    }

    return { email };
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireOfficerSession(request);
        const limit = await checkRateLimit(`admin_overview_get_${email}_${ip}`, 60, 60_000);
        if (!limit.success) {
            const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
            if (limit.retryAfter) {
                response.headers.set('Retry-After', String(limit.retryAfter));
            }
            return withNoStore(response);
        }

        const [modules, surfaces] = await Promise.all([getAdminOverview(), getAdminSurfaceOverview()]);
        const allProvidersUnavailable = modules.every((module) => module.health === 'unavailable');

        return withNoStore(NextResponse.json({
            success: !allProvidersUnavailable,
            modules,
            surfaces,
            checkedAt: new Date().toISOString(),
        }, { status: allProvidersUnavailable ? 503 : 200 }));
    } catch (error) {
        console.error('[Admin Overview API] GET failed:', redactErrorForLog(error));
        const safeError = error instanceof ApiError
            ? error
            : new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Internal server error.', undefined, false);
        return withNoStore(toApiResponse(safeError));
    }
}
