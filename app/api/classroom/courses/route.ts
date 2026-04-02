import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listMyClassroomCourses } from '@/lib/google-classroom';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`classroom_courses_${ip}`, 30, 60_000);

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
