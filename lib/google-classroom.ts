import { google } from 'googleapis';
import { sanitizeText } from '@/lib/security';

type ClassroomCourse = {
    id: string;
    name: string;
    section?: string;
    room?: string;
    descriptionHeading?: string;
    alternateLink?: string;
    courseState?: string;
};

type ClassroomCourseWork = {
    id: string;
    title: string;
    description?: string;
    state?: string;
    alternateLink?: string;
    dueDate?: {
        year?: number;
        month?: number;
        day?: number;
    };
    dueTime?: {
        hours?: number;
        minutes?: number;
        seconds?: number;
        nanos?: number;
    };
    workType?: string;
    maxPoints?: number;
};

function getClassroomClient(accessToken: string) {
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: accessToken });

    return google.classroom({
        version: 'v1',
        auth: oauth2,
    });
}

export async function listMyClassroomCourses(accessToken: string): Promise<ClassroomCourse[]> {
    const classroom = getClassroomClient(accessToken);

    const [studentRes, teacherRes] = await Promise.allSettled([
        classroom.courses.list({
            studentId: 'me',
            courseStates: ['ACTIVE'],
            pageSize: 100,
        }),
        classroom.courses.list({
            teacherId: 'me',
            courseStates: ['ACTIVE'],
            pageSize: 100,
        }),
    ]);

    const merged = new Map<string, ClassroomCourse>();

    if (studentRes.status === 'fulfilled') {
        const courses = studentRes.value.data.courses || [];
        for (const course of courses) {
            if (!course.id || !course.name) continue;
            const safeName = sanitizeText(course.name);
            if (!safeName) continue;
            merged.set(course.id, {
                id: course.id,
                name: safeName,
                section: course.section ? sanitizeText(course.section) || undefined : undefined,
                room: course.room ? sanitizeText(course.room) || undefined : undefined,
                descriptionHeading: course.descriptionHeading ? sanitizeText(course.descriptionHeading) || undefined : undefined,
                alternateLink: course.alternateLink || undefined,
                courseState: course.courseState || undefined,
            });
        }
    }

    if (teacherRes.status === 'fulfilled') {
        const courses = teacherRes.value.data.courses || [];
        for (const course of courses) {
            if (!course.id || !course.name) continue;
            if (merged.has(course.id)) continue;
            const safeName = sanitizeText(course.name);
            if (!safeName) continue;
            merged.set(course.id, {
                id: course.id,
                name: safeName,
                section: course.section ? sanitizeText(course.section) || undefined : undefined,
                room: course.room ? sanitizeText(course.room) || undefined : undefined,
                descriptionHeading: course.descriptionHeading ? sanitizeText(course.descriptionHeading) || undefined : undefined,
                alternateLink: course.alternateLink || undefined,
                courseState: course.courseState || undefined,
            });
        }
    }

    return Array.from(merged.values());
}

export async function listCourseWork(accessToken: string, courseId: string): Promise<ClassroomCourseWork[]> {
    const classroom = getClassroomClient(accessToken);

    const res = await classroom.courses.courseWork.list({
        courseId,
        orderBy: 'updateTime desc',
        pageSize: 100,
    });

    const workItems = res.data.courseWork || [];

    const sanitizedWorkItems: ClassroomCourseWork[] = [];

    for (const item of workItems) {
        if (!item.id || !item.title) {
            continue;
        }

        const safeTitle = sanitizeText(item.title);
        if (!safeTitle) {
            continue;
        }

        sanitizedWorkItems.push({
            id: item.id,
            title: safeTitle,
            description: item.description ? sanitizeText(item.description) || undefined : undefined,
            state: item.state || undefined,
            alternateLink: item.alternateLink || undefined,
            dueDate: item.dueDate || undefined,
            dueTime: item.dueTime || undefined,
            workType: item.workType || undefined,
            maxPoints: typeof item.maxPoints === 'number' ? item.maxPoints : undefined,
        });
    }

    return sanitizedWorkItems;
}

export async function submitCourseWorkLink(params: {
    accessToken: string;
    courseId: string;
    courseWorkId: string;
    linkUrl: string;
    linkTitle?: string;
    turnIn?: boolean;
}): Promise<{ submissionId: string; state?: string }> {
    const { accessToken, courseId, courseWorkId, linkUrl, linkTitle, turnIn = true } = params;

    const parsedUrl = new URL(linkUrl);
    if (parsedUrl.protocol !== 'https:') {
        throw new Error('Submission link must use HTTPS.');
    }

    const accessibleCourses = await listMyClassroomCourses(accessToken);
    const userCourseIds = new Set(accessibleCourses.map((course) => course.id));
    if (!userCourseIds.has(courseId)) {
        throw new Error('Course is not accessible for the authenticated leader.');
    }

    const classroom = getClassroomClient(accessToken);

    const listRes = await classroom.courses.courseWork.studentSubmissions.list({
        courseId,
        courseWorkId,
        userId: 'me',
        pageSize: 1,
    });

    const submission = listRes.data.studentSubmissions?.[0];

    if (!submission?.id) {
        throw new Error('No classroom submission found for this coursework and user.');
    }

    await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId,
        courseWorkId,
        id: submission.id,
        requestBody: {
            addAttachments: [
                {
                    link: {
                        url: parsedUrl.toString(),
                    },
                },
            ],
        },
    });

    let finalState = submission.state || undefined;

    if (turnIn) {
        await classroom.courses.courseWork.studentSubmissions.turnIn({
            courseId,
            courseWorkId,
            id: submission.id,
        });
        finalState = 'TURNED_IN';
    }

    return {
        submissionId: submission.id,
        state: finalState,
    };
}
