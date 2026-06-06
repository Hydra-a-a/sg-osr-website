import { google } from 'googleapis';
import { buildClassroomDueFieldsFromManilaInput } from '@/lib/date-time';
import { sanitizeText } from '@/lib/security';
import type { ClassroomCourseCreateInput, ClassroomCourseWorkCreateInput } from '@/schemas/classroom';

type ClassroomCourse = {
    id: string;
    name: string;
    section?: string;
    room?: string;
    descriptionHeading?: string;
    description?: string;
    alternateLink?: string;
    courseState?: string;
};

type ClassroomCourseWork = {
    id: string;
    title: string;
    description?: string;
    state?: string;
    alternateLink?: string;
    associatedWithDeveloper?: boolean;
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

function sanitizeOptional(value: string | null | undefined): string | undefined {
    if (!value) return undefined;
    return sanitizeText(value) || undefined;
}

function normalizeCourse(course: {
    id?: string | null;
    name?: string | null;
    section?: string | null;
    room?: string | null;
    descriptionHeading?: string | null;
    description?: string | null;
    alternateLink?: string | null;
    courseState?: string | null;
}): ClassroomCourse | null {
    if (!course.id || !course.name) return null;

    const safeName = sanitizeText(course.name);
    if (!safeName) return null;

    return {
        id: course.id,
        name: safeName,
        section: sanitizeOptional(course.section),
        room: sanitizeOptional(course.room),
        descriptionHeading: sanitizeOptional(course.descriptionHeading),
        description: sanitizeOptional(course.description),
        alternateLink: course.alternateLink || undefined,
        courseState: course.courseState || undefined,
    };
}

function normalizeCourseWork(item: {
    id?: string | null;
    title?: string | null;
    description?: string | null;
    state?: string | null;
    alternateLink?: string | null;
    associatedWithDeveloper?: boolean | null;
    dueDate?: ClassroomCourseWork['dueDate'];
    dueTime?: ClassroomCourseWork['dueTime'];
    workType?: string | null;
    maxPoints?: number | null;
}): ClassroomCourseWork | null {
    if (!item.id || !item.title) return null;

    const safeTitle = sanitizeText(item.title);
    if (!safeTitle) return null;

    return {
        id: item.id,
        title: safeTitle,
        description: sanitizeOptional(item.description),
        state: item.state || undefined,
        alternateLink: item.alternateLink || undefined,
        associatedWithDeveloper: typeof item.associatedWithDeveloper === 'boolean' ? item.associatedWithDeveloper : undefined,
        dueDate: item.dueDate || undefined,
        dueTime: item.dueTime || undefined,
        workType: item.workType || undefined,
        maxPoints: typeof item.maxPoints === 'number' ? item.maxPoints : undefined,
    };
}

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
    const merged = new Map<string, ClassroomCourse>();

    async function collectCourses(query: { studentId?: string; teacherId?: string }) {
        let pageToken: string | undefined;

        do {
            const response = await classroom.courses.list({
                ...query,
                courseStates: ['ACTIVE', 'PROVISIONED'],
                pageSize: 100,
                pageToken,
            });

            for (const course of response.data.courses || []) {
                if (!course.id || !course.name) continue;
                const normalizedCourse = normalizeCourse(course);
                if (!normalizedCourse) continue;
                if (!merged.has(normalizedCourse.id)) {
                    merged.set(normalizedCourse.id, normalizedCourse);
                }
            }

            pageToken = response.data.nextPageToken || undefined;
        } while (pageToken);
    }

    await Promise.all([
        collectCourses({ studentId: 'me' }),
        collectCourses({ teacherId: 'me' }),
    ]);

    return Array.from(merged.values());
}

export async function listCourseWork(accessToken: string, courseId: string): Promise<ClassroomCourseWork[]> {
    const classroom = getClassroomClient(accessToken);

    const sanitizedWorkItems: ClassroomCourseWork[] = [];

    let pageToken: string | undefined;
    do {
        const res = await classroom.courses.courseWork.list({
            courseId,
            orderBy: 'updateTime desc',
            pageSize: 100,
            pageToken,
        });

        for (const item of res.data.courseWork || []) {
            const normalizedItem = normalizeCourseWork(item);
            if (normalizedItem) sanitizedWorkItems.push(normalizedItem);
        }

        pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);

    return sanitizedWorkItems;
}

export async function createClassroomCourse(accessToken: string, input: ClassroomCourseCreateInput): Promise<ClassroomCourse> {
    const classroom = getClassroomClient(accessToken);

    const res = await classroom.courses.create({
        requestBody: {
            name: input.name,
            section: input.section,
            room: input.room,
            descriptionHeading: input.descriptionHeading,
            description: input.description,
            ownerId: 'me',
            courseState: 'ACTIVE',
        },
    });

    const course = normalizeCourse(res.data);
    if (!course) {
        throw new Error('Google Classroom did not return a usable course record.');
    }

    return course;
}

export async function createClassroomCourseWork(accessToken: string, input: ClassroomCourseWorkCreateInput): Promise<ClassroomCourseWork> {
    const classroom = getClassroomClient(accessToken);
    const classroomDueFields = buildClassroomDueFieldsFromManilaInput(input.dueDate || '', input.dueTime);

    const res = await classroom.courses.courseWork.create({
        courseId: input.courseId,
        requestBody: {
            title: input.title,
            description: input.description,
            state: input.state,
            workType: 'ASSIGNMENT',
            maxPoints: input.maxPoints,
            dueDate: classroomDueFields?.dueDate,
            dueTime: classroomDueFields?.dueTime,
        },
    });

    const courseWork = normalizeCourseWork(res.data);
    if (!courseWork) {
        throw new Error('Google Classroom did not return a usable coursework record.');
    }

    return courseWork;
}

export async function publishClassroomCourseWork(accessToken: string, courseId: string, courseWorkId: string): Promise<ClassroomCourseWork> {
    const classroom = getClassroomClient(accessToken);

    const res = await classroom.courses.courseWork.patch({
        courseId,
        id: courseWorkId,
        updateMask: 'state',
        requestBody: {
            state: 'PUBLISHED',
        },
    });

    const courseWork = normalizeCourseWork(res.data);
    if (!courseWork) {
        throw new Error('Google Classroom did not return a usable coursework record.');
    }

    return courseWork;
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

    const courseWorkItems = await listCourseWork(accessToken, courseId);
    const courseWork = courseWorkItems.find((item) => item.id === courseWorkId);
    if (courseWork?.associatedWithDeveloper === false) {
        throw new Error('Coursework is not associated with this Developer Console project.');
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
