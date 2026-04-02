import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { submitCourseWorkLink } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ClassroomSubmissionSchema } from '@/schemas/classroom';
import { logAuditAction } from '@/lib/audit';

const DEDUPE_TTL_MS = 90_000;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`classroom_submit_${ip}`, 12, 60_000);

    if (!limit.success) {
        const retryAfter = limit.retryAfter ? Math.ceil(limit.retryAfter) : 60;
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) } }
        );
    }

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    if (session.user.role !== 'leader') {
        return NextResponse.json({ error: 'Student leader access required' }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Google Classroom token missing. Please sign out and sign in again.' },
            { status: 401, headers: NO_STORE_HEADERS }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = ClassroomSubmissionSchema.safeParse(body);
    if (!parsed.success) {
        logAuditAction('SCHEMA_VALIDATION_FAILED', {
            source: 'api/classroom/submissions',
            ip,
            reason: 'classroom_submission_payload',
        });
        return NextResponse.json(
            {
                error: 'Validation failed',
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
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });
        return NextResponse.json(
            { error: 'Duplicate submission detected. Please wait before retrying.', errorCode: 'DUPLICATE_SUBMISSION' },
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
            courseId: parsed.data.courseId,
            courseWorkId: parsed.data.courseWorkId,
            turnIn: parsed.data.turnIn,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json(
            {
                success: true,
                data: result,
            },
            { headers: NO_STORE_HEADERS }
        );
    } catch (error) {
        console.error('[Classroom API] Submission failed:', redactErrorForLog(error));

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const isPermissionIssue = /insufficient|forbidden|permission|scope|accessible/i.test(msg);
        const isNotFoundIssue = /no classroom submission found|not found/i.test(msg);

        logAuditAction('CLASSROOM_SUBMISSION_REJECTED', {
            ip,
            source: 'api/classroom/submissions',
            reason: isPermissionIssue ? 'permission' : isNotFoundIssue ? 'not_found' : 'runtime_error',
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json(
            {
                error: isPermissionIssue
                    ? 'Google Classroom permission issue. Please re-login and verify class membership.'
                    : isNotFoundIssue
                        ? 'No active submission slot found for this coursework.'
                        : 'Failed to submit to Google Classroom',
                errorCode: isPermissionIssue ? 'PERMISSION_DENIED' : isNotFoundIssue ? 'SUBMISSION_NOT_FOUND' : 'SUBMISSION_FAILED',
            },
            { status: isPermissionIssue ? 403 : isNotFoundIssue ? 404 : 500, headers: NO_STORE_HEADERS }
        );
    }
}
