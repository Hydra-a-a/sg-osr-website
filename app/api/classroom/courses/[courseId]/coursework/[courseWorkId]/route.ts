import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { publishClassroomCourseWork } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { cookies } from 'next/headers';
import { deriveEffectivePortalRole, hasOfficerPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { logAuditAction } from '@/lib/audit';
import { CourseIdSchema, CourseWorkIdSchema } from '@/schemas/classroom';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function createClassroomRequestId(): string {
    return `cls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function PATCH(
    request: Request,
    context: { params: Promise<{ courseId: string; courseWorkId: string }> }
) {
    const ip = getClientIp(request);
    const requestId = createClassroomRequestId();

    try {
        requireSameOriginRequest(request);
    } catch {
        return NextResponse.json({ error: 'Forbidden', errorCode: 'FORBIDDEN', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const limit = await checkRateLimit(`classroom_coursework_publish_${ip}`, 10, 60_000);
    if (!limit.success) {
        const retryAfter = limit.retryAfter ? Math.ceil(limit.retryAfter) : 60;
        return NextResponse.json(
            { error: 'Too many setup requests. Please try again shortly.', errorCode: 'RATE_LIMITED', requestId },
            { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) } }
        );
    }

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Authentication required', errorCode: 'AUTH_REQUIRED', requestId }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const cookieStore = await cookies();
    const effectiveRole = deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value);

    if (!hasOfficerPrivilege(effectiveRole)) {
        return NextResponse.json({ error: 'Officer access required', errorCode: 'OFFICER_ACCESS_REQUIRED', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Google Classroom token missing. Please sign out and sign in again.', errorCode: 'CLASSROOM_TOKEN_MISSING', requestId },
            { status: 401, headers: NO_STORE_HEADERS }
        );
    }

    const { courseId, courseWorkId } = await context.params;
    const validatedCourseId = CourseIdSchema.safeParse(courseId);
    const validatedCourseWorkId = CourseWorkIdSchema.safeParse(courseWorkId);
    if (!validatedCourseId.success || !validatedCourseWorkId.success) {
        return NextResponse.json(
            { error: 'Invalid Classroom identifiers', errorCode: 'INVALID_CLASSROOM_IDS', requestId },
            { status: 400, headers: NO_STORE_HEADERS }
        );
    }

    try {
        const courseWork = await publishClassroomCourseWork(accessToken, validatedCourseId.data, validatedCourseWorkId.data);

        logAuditAction('CLASSROOM_COURSEWORK_PUBLISHED', {
            ip,
            source: 'api/classroom/courses/[courseId]/coursework/[courseWorkId]',
            requestId,
            courseId: validatedCourseId.data,
            courseWorkId: validatedCourseWorkId.data,
            state: courseWork.state,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json({ success: true, requestId, data: courseWork }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to publish coursework:', {
            requestId,
            error: redactErrorForLog(error),
        });

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const isPermissionIssue = /insufficient|forbidden|permission|scope|not permitted/i.test(msg);

        return NextResponse.json(
            {
                error: isPermissionIssue
                    ? 'Google Classroom would not allow this account to publish the selected coursework. Please verify teacher access.'
                    : 'Failed to publish Google Classroom coursework',
                errorCode: isPermissionIssue ? 'PERMISSION_DENIED' : 'COURSEWORK_PUBLISH_FAILED',
                requestId,
            },
            { status: isPermissionIssue ? 403 : 500, headers: NO_STORE_HEADERS }
        );
    }
}