import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { createClassroomCourseWork, listCourseWork } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ClassroomCourseWorkCreateSchema, CourseIdSchema } from '@/schemas/classroom';
import { cookies } from 'next/headers';
import { deriveEffectivePortalRole, hasLeaderPrivilege, hasOfficerPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { logAuditAction } from '@/lib/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function createClassroomRequestId(): string {
    return `cls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ courseId: string }> }
) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`classroom_coursework_${ip}`, 40, 60_000);

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS });
    }

    const session = await auth();
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const cookieStore = await cookies();
    const effectiveRole = deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value);

    if (!hasLeaderPrivilege(effectiveRole)) {
        return NextResponse.json({ error: 'Student leader access required' }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const accessToken = session.accessToken;
    if (!accessToken) {
        return NextResponse.json(
            { error: 'Google Classroom token missing. Please sign out and sign in again.' },
            { status: 401, headers: NO_STORE_HEADERS }
        );
    }

    const { courseId } = await context.params;
    const validatedCourseId = CourseIdSchema.safeParse(courseId);
    if (!validatedCourseId.success) {
        return NextResponse.json({ error: 'Invalid course ID' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    try {
        let coursework = await listCourseWork(accessToken, validatedCourseId.data);

        // Do not expose publish/state information to non-officer roles.
        // Leaders only need to attach/submit their own work; publishing metadata
        // is considered an officer-level detail.
        if (!hasOfficerPrivilege(effectiveRole)) {
            coursework = coursework.map((item) => {
                const { state, ...rest } = item as any;
                return rest as typeof item;
            });
        }

        return NextResponse.json({ data: coursework }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to fetch coursework:', redactErrorForLog(error));
        return NextResponse.json(
            { error: 'Failed to fetch coursework for this class' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}

export async function POST(
    request: Request,
    context: { params: Promise<{ courseId: string }> }
) {
    const ip = getClientIp(request);
    const requestId = createClassroomRequestId();

    try {
        requireSameOriginRequest(request);
    } catch {
        return NextResponse.json({ error: 'Forbidden', errorCode: 'FORBIDDEN', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const limit = await checkRateLimit(`classroom_coursework_create_${ip}`, 12, 60_000);
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

    const { courseId } = await context.params;
    const validatedCourseId = CourseIdSchema.safeParse(courseId);
    if (!validatedCourseId.success) {
        return NextResponse.json({ error: 'Invalid course ID', errorCode: 'INVALID_COURSE_ID', requestId }, { status: 400, headers: NO_STORE_HEADERS });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload', errorCode: 'INVALID_JSON', requestId }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = ClassroomCourseWorkCreateSchema.safeParse({
        ...(body && typeof body === 'object' ? body : {}),
        courseId: validatedCourseId.data,
    });

    if (!parsed.success) {
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

    try {
        const courseWork = await createClassroomCourseWork(accessToken, parsed.data);

        logAuditAction('CLASSROOM_COURSEWORK_CREATED', {
            ip,
            source: 'api/classroom/courses/[courseId]/coursework',
            requestId,
            courseId: parsed.data.courseId,
            courseWorkId: courseWork.id,
            state: courseWork.state,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json({ success: true, requestId, data: courseWork }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to create coursework:', {
            requestId,
            error: redactErrorForLog(error),
        });

        logAuditAction('CLASSROOM_COURSEWORK_CREATE_REJECTED', {
            ip,
            source: 'api/classroom/courses/[courseId]/coursework',
            requestId,
            courseId: validatedCourseId.data,
            reason: 'runtime_error',
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const isPermissionIssue = /insufficient|forbidden|permission|scope|not permitted/i.test(msg);

        return NextResponse.json(
            {
                error: isPermissionIssue
                    ? 'Google Classroom would not allow this account to create coursework in the selected class. Please verify teacher access.'
                    : 'Failed to create Google Classroom coursework',
                errorCode: isPermissionIssue ? 'PERMISSION_DENIED' : 'COURSEWORK_CREATE_FAILED',
                requestId,
            },
            { status: isPermissionIssue ? 403 : 500, headers: NO_STORE_HEADERS }
        );
    }
}
