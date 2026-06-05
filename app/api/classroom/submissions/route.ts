import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { submitCourseWorkLink } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ClassroomSubmissionSchema } from '@/schemas/classroom';
import { logAuditAction } from '@/lib/audit';
import { cookies } from 'next/headers';
import { deriveEffectivePortalRole, hasLeaderPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { requireSameOriginRequest } from '@/lib/request-guards';

const DEDUPE_TTL_MS = 90_000;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function createClassroomRequestId(): string {
    return `cls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function getGoogleErrorStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;

    const candidate = error as {
        code?: unknown;
        status?: unknown;
        response?: { status?: unknown };
    };
    const status = candidate.response?.status ?? candidate.status ?? candidate.code;

    return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
}

function getGoogleErrorReason(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined;

    const candidate = error as {
        errors?: Array<{ reason?: unknown }>;
        response?: {
            data?: {
                error?: {
                    status?: unknown;
                    errors?: Array<{ reason?: unknown }>;
                };
            };
        };
    };
    const directReason = candidate.errors?.find((item) => typeof item.reason === 'string')?.reason;
    const responseReason = candidate.response?.data?.error?.errors?.find((item) => typeof item.reason === 'string')?.reason;
    const responseStatus = candidate.response?.data?.error?.status;

    return asString(directReason) || asString(responseReason) || asString(responseStatus);
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    const requestId = createClassroomRequestId();

    try {
        requireSameOriginRequest(request);
    } catch {
        return NextResponse.json({ error: 'Forbidden', errorCode: 'FORBIDDEN', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const limit = await checkRateLimit(`classroom_submit_${ip}`, 12, 60_000);

    if (!limit.success) {
        const retryAfter = limit.retryAfter ? Math.ceil(limit.retryAfter) : 60;
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.', errorCode: 'RATE_LIMITED', requestId },
            { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) } }
        );
    }

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Authentication required', errorCode: 'AUTH_REQUIRED', requestId }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const cookieStore = await cookies();
    const effectiveRole = deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value);

    if (!hasLeaderPrivilege(effectiveRole)) {
        return NextResponse.json({ error: 'Student leader access required', errorCode: 'LEADER_ACCESS_REQUIRED', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Google Classroom token missing. Please sign out and sign in again.', errorCode: 'CLASSROOM_TOKEN_MISSING', requestId },
            { status: 401, headers: NO_STORE_HEADERS }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload', errorCode: 'INVALID_JSON', requestId }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = ClassroomSubmissionSchema.safeParse(body);
    if (!parsed.success) {
        logAuditAction('SCHEMA_VALIDATION_FAILED', {
            source: 'api/classroom/submissions',
            ip,
            requestId,
            reason: 'classroom_submission_payload',
        });
        return NextResponse.json(
            {
                error: 'Validation failed',
                errorCode: 'VALIDATION_FAILED',
                requestId,
                details: parsed.error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                })),
            },
            { status: 400, headers: NO_STORE_HEADERS }
        );
    }

    const dedupeKey = createHash('sha256')
        .update(
            JSON.stringify({
                user: session.user.email.toLowerCase().trim(),
                courseId: parsed.data.courseId,
                courseWorkId: parsed.data.courseWorkId,
                linkUrl: parsed.data.linkUrl,
                linkTitle: parsed.data.linkTitle || '',
                turnIn: parsed.data.turnIn,
            })
        )
        .digest('hex');

    const dedupeLimit = await checkRateLimit(`classroom_submit_dedupe_${dedupeKey}`, 1, DEDUPE_TTL_MS);
    if (!dedupeLimit.success) {
        logAuditAction('CLASSROOM_DUPLICATE_BLOCKED', {
            ip,
            source: 'api/classroom/submissions',
            requestId,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });
        return NextResponse.json(
            { error: 'Duplicate submission detected. Please wait before retrying.', errorCode: 'DUPLICATE_SUBMISSION', requestId },
            { status: 409, headers: NO_STORE_HEADERS }
        );
    }

    try {
        const result = await submitCourseWorkLink({
            accessToken,
            courseId: parsed.data.courseId,
            courseWorkId: parsed.data.courseWorkId,
            linkUrl: parsed.data.linkUrl,
            linkTitle: parsed.data.linkTitle,
            turnIn: parsed.data.turnIn,
        });

        logAuditAction('CLASSROOM_SUBMISSION_SUCCEEDED', {
            ip,
            source: 'api/classroom/submissions',
            requestId,
            courseId: parsed.data.courseId,
            courseWorkId: parsed.data.courseWorkId,
            turnIn: parsed.data.turnIn,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json(
            {
                success: true,
                requestId,
                data: result,
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        const googleStatus = getGoogleErrorStatus(error);
        const googleReason = getGoogleErrorReason(error);

        console.error('[Classroom API] Submission failed:', {
            requestId,
            googleStatus,
            googleReason,
            error: redactErrorForLog(error),
        });

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const isPermissionIssue = /insufficient|forbidden|permission|scope|accessible/i.test(msg) || googleStatus === 401 || googleStatus === 403;
        const isNotFoundIssue = /no classroom submission found|not found/i.test(msg) || googleStatus === 404;
        const isTurnInIssue = /turnIn|turn in|turned in/i.test(msg);
        const errorCode = isPermissionIssue
            ? 'PERMISSION_DENIED'
            : isNotFoundIssue
                ? 'SUBMISSION_NOT_FOUND'
                : isTurnInIssue
                    ? 'TURN_IN_FAILED'
                    : 'SUBMISSION_FAILED';

        logAuditAction('CLASSROOM_SUBMISSION_REJECTED', {
            ip,
            source: 'api/classroom/submissions',
            requestId,
            reason: isPermissionIssue ? 'permission' : isNotFoundIssue ? 'not_found' : isTurnInIssue ? 'turn_in_failed' : 'runtime_error',
            googleStatus,
            googleReason,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json(
            {
                error: isPermissionIssue
                    ? 'Google Classroom permission issue. Please re-login and verify class membership.'
                    : isNotFoundIssue
                        ? 'No active submission slot found for this coursework.'
                        : isTurnInIssue
                            ? 'Attachment may have succeeded, but Google Classroom failed to mark it as turned in.'
                            : 'Failed to submit to Google Classroom',
                errorCode,
                requestId,
            },
            { status: isPermissionIssue ? 403 : isNotFoundIssue ? 404 : 500, headers: NO_STORE_HEADERS }
        );
    }
}
