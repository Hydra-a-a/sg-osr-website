import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listCourseWork } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { CourseIdSchema } from '@/schemas/classroom';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

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

    const { courseId } = await context.params;
    const validatedCourseId = CourseIdSchema.safeParse(courseId);
    if (!validatedCourseId.success) {
        return NextResponse.json({ error: 'Invalid course ID' }, { status: 400, headers: NO_STORE_HEADERS });
    }

    try {
        const coursework = await listCourseWork(accessToken, validatedCourseId.data);
        return NextResponse.json({ data: coursework }, { headers: NO_STORE_HEADERS });
    } catch (error) {
        console.error('[Classroom API] Failed to fetch coursework:', redactErrorForLog(error));
        return NextResponse.json(
            { error: 'Failed to fetch coursework for this class' },
            { status: 500, headers: NO_STORE_HEADERS }
        );
    }
}
