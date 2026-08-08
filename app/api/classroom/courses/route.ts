import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { authWithGoogleToken } from '@/lib/auth';
import { createClassroomCourse, listMyClassroomCourses } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { cookies } from 'next/headers';
import { deriveEffectivePortalRole, hasLeaderPrivilege, hasOfficerPrivilege, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { ClassroomCourseCreateSchema } from '@/schemas/classroom';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { logAuditAction } from '@/lib/audit';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function createClassroomRequestId(): string {
    return `cls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`classroom_courses_${ip}`, 30, 60_000);

    if (!limit.success) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE_HEADERS });
    }

    const session = await authWithGoogleToken();
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

    try {
        const courses = await listMyClassroomCourses(accessToken);
        return NextResponse.json({ data: courses }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to fetch courses:', redactErrorForLog(error));
        return NextResponse.json(
            { error: 'Failed to fetch Google Classroom courses' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}

export async function POST(request: Request) {
    const ip = getClientIp(request);
    const requestId = createClassroomRequestId();

    try {
        requireSameOriginRequest(request);
    } catch {
        return NextResponse.json({ error: 'Forbidden', errorCode: 'FORBIDDEN', requestId }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const limit = await checkRateLimit(`classroom_course_create_${ip}`, 8, 60_000);
    if (!limit.success) {
        const retryAfter = limit.retryAfter ? Math.ceil(limit.retryAfter) : 60;
        return NextResponse.json(
            { error: 'Too many setup requests. Please try again shortly.', errorCode: 'RATE_LIMITED', requestId },
            { status: 429, headers: { ...NO_STORE_HEADERS, 'Retry-After': String(retryAfter) } }
        );
    }

    const session = await authWithGoogleToken();
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

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload', errorCode: 'INVALID_JSON', requestId }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = ClassroomCourseCreateSchema.safeParse(body);
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
        const course = await createClassroomCourse(accessToken, parsed.data);

        logAuditAction('CLASSROOM_COURSE_CREATED', {
            ip,
            source: 'api/classroom/courses',
            requestId,
            courseId: course.id,
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        return NextResponse.json({ success: true, requestId, data: course }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to create course:', {
            requestId,
            error: redactErrorForLog(error),
        });

        logAuditAction('CLASSROOM_COURSE_CREATE_REJECTED', {
            ip,
            source: 'api/classroom/courses',
            requestId,
            reason: 'runtime_error',
            emailHash: createHash('sha256').update(session.user.email.toLowerCase().trim()).digest('hex').slice(0, 12),
        });

        const msg = error instanceof Error ? error.message : 'Unknown error';
        const isPermissionIssue = /insufficient|forbidden|permission|scope|not permitted/i.test(msg);

        return NextResponse.json(
            {
                error: isPermissionIssue
                    ? 'Google Classroom would not allow this account to create a class. Please re-login and verify Classroom teacher permissions.'
                    : 'Failed to create Google Classroom class',
                errorCode: isPermissionIssue ? 'PERMISSION_DENIED' : 'COURSE_CREATE_FAILED',
                requestId,
            },
            { status: isPermissionIssue ? 403 : 500, headers: NO_STORE_HEADERS }
        );
    }
}
