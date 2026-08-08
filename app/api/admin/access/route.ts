import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { auth, invalidateAuthorizedUsersCache } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { logAuditAction } from '@/lib/audit';
import { resolveAuthAccessSource } from '@/lib/auth-access';
import {
    findAuthorizedUserByEmail,
    isActiveOfficer,
    listAuthorizedUsersForAdmin,
    upsertAuthorizedUserAccess,
} from '@/lib/admin-access';

const AuthorizedUserAccessSchema = z.object({
    email: z.string().trim().toLowerCase().email().refine(
        (value) => value.endsWith('@rtu.edu.ph'),
        'An RTU institutional email is required.',
    ),
    name: z.string().trim().max(120).optional().default(''),
    council: z.string().trim().max(120).optional().default(''),
    role: z.enum(['student', 'leader', 'officer']),
    accessEnabled: z.boolean(),
}).strict();

function withNoStore(response: NextResponse): NextResponse {
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

async function requireDatabaseOfficer() {
    const session = await auth();
    const email = String(session?.user?.email || '').trim().toLowerCase();
    if (!email) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    const actor = await findAuthorizedUserByEmail(email);
    if (!actor || !isActiveOfficer(actor)) {
        throw new ApiError(403, 'FORBIDDEN', 'Officer access is required.');
    }

    return { actor, email };
}

async function enforceRateLimit(action: string, actorEmail: string, ip: string): Promise<NextResponse | null> {
    const limit = await checkRateLimit(`admin_access_${action}_${actorEmail}_${ip}`, action === 'get' ? 60 : 30, 60_000);
    if (limit.success) return null;

    const response = toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.'));
    if (limit.retryAfter) {
        response.headers.set('Retry-After', String(limit.retryAfter));
    }
    return withNoStore(response);
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireDatabaseOfficer();
        const rateLimitResponse = await enforceRateLimit('get', email, ip);
        if (rateLimitResponse) return rateLimitResponse;

        const users = await listAuthorizedUsersForAdmin();
        return withNoStore(NextResponse.json({
            success: true,
            users,
            authSource: resolveAuthAccessSource(),
        }));
    } catch (error) {
        console.error('[Admin Access API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { actor, email: actorEmail } = await requireDatabaseOfficer();
        const rateLimitResponse = await enforceRateLimit('patch', actorEmail, ip);
        if (rateLimitResponse) return rateLimitResponse;

        let rawPayload: unknown;
        try {
            rawPayload = await request.json();
        } catch {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid access update payload.')));
        }

        const parsed = AuthorizedUserAccessSchema.safeParse(rawPayload);
        if (!parsed.success) {
            return withNoStore(toApiResponse(new ApiError(400, 'INVALID_PAYLOAD', 'Invalid access update payload.')));
        }

        if (parsed.data.email === actor.email && (!parsed.data.accessEnabled || parsed.data.role !== 'officer')) {
            return withNoStore(toApiResponse(new ApiError(409, 'SELF_ACCESS_LOCKOUT', 'You cannot remove your own officer access.')));
        }

        const updated = await upsertAuthorizedUserAccess({
            email: parsed.data.email,
            name: sanitizeText(parsed.data.name),
            council: sanitizeText(parsed.data.council),
            role: parsed.data.role,
            accessEnabled: parsed.data.accessEnabled,
            actorEmail,
        });

        invalidateAuthorizedUsersCache();

        logAuditAction(
            parsed.data.accessEnabled ? 'AUTH_ACCESS_UPDATED' : 'AUTH_ACCESS_REVOKED',
            {
                ip,
                source: 'admin_access_dashboard',
                targetRole: parsed.data.role,
                accessEnabled: parsed.data.accessEnabled,
                created: updated.created,
            },
        );

        return withNoStore(NextResponse.json({
            success: true,
            user: updated.user,
            created: updated.created,
            authSource: resolveAuthAccessSource(),
        }));
    } catch (error) {
        console.error('[Admin Access API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
