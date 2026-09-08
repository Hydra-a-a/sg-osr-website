import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { authWithGoogleToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';
import { ClassroomSubmissionSchema } from '@/schemas/classroom';
import { logAuditAction } from '@/lib/audit';
import { cookies } from 'next/headers';
import { deriveEffectivePortalRole, hasLeaderPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { normalizeIdempotencyKey } from '@/lib/idempotency-contract';
import { submitTransparencyIntake } from '@/lib/transparency-intake';
import { ApiError } from '@/lib/api-errors';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
    const requestId = randomUUID();
    const respond = (body: object, status = 200, headers = {}) => NextResponse.json({ ...body, requestId }, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
    try {
        try { requireSameOriginRequest(request); } catch { return respond({ error: 'Forbidden', errorCode: 'FORBIDDEN' }, 403); }
        const limit = await checkRateLimit(`classroom_submit_${getClientIp(request)}`, 12, 60_000);
        if (!limit.success) return respond({ error: 'Too many requests. Please try again later.', errorCode: 'RATE_LIMITED' }, 429, { 'Retry-After': String(Math.ceil(limit.retryAfter || 60)) });
        const session = await authWithGoogleToken();
        if (!session?.user?.email) return respond({ error: 'Authentication required', errorCode: 'AUTH_REQUIRED' }, 401);
        const cookieStore = await cookies();
        const effectiveRole = deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value);
        if (!hasLeaderPrivilege(effectiveRole)) return respond({ error: 'Student leader access required', errorCode: 'LEADER_ACCESS_REQUIRED' }, 403);
        if (!session.accessToken) return respond({ error: 'Google Classroom token missing. Please sign out and sign in again.', errorCode: 'CLASSROOM_TOKEN_MISSING' }, 401);
        const key = normalizeIdempotencyKey(request.headers.get('Idempotency-Key'));
        if (!key) return respond({ error: 'A submission reference is required.', errorCode: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
        let body: unknown;
        try { body = await request.json(); } catch { return respond({ error: 'Invalid JSON payload', errorCode: 'INVALID_JSON' }, 400); }
        const parsed = ClassroomSubmissionSchema.safeParse(body);
        if (!parsed.success) return respond({ error: 'Validation failed', errorCode: 'VALIDATION_FAILED', details: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) }, 400);
        const result = await submitTransparencyIntake(parsed.data, { email: session.user.email, name: session.user.name }, session.accessToken, key);
        logAuditAction('CLASSROOM_SUBMISSION_SUCCEEDED', { source: 'api/classroom/submissions', requestId });
        return respond({ success: true, transparencySubmissionId: result.transparencySubmissionId, data: result }, 200, { 'Idempotency-Replayed': String(result.replayed) });
    } catch (error) {
        const known = error instanceof ApiError;
        logAuditAction('CLASSROOM_SUBMISSION_REJECTED', { source: 'api/classroom/submissions', requestId, reason: known ? error.code : 'intake_unavailable' });
        return respond({ error: known && error.exposeMessage ? error.message : 'Private intake is temporarily unavailable. Please retry with the same submission reference.', errorCode: known ? error.code : 'INTAKE_UNAVAILABLE' }, known ? error.statusCode : 503);
    }
}
