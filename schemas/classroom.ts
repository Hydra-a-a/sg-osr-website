import { z } from 'zod';

const GOOGLE_CLASSROOM_ID_REGEX = /^\d{5,30}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalTrimmedString = (max: number) =>
    z.string().trim().max(max).optional().transform((value) => value || undefined);

const optionalNumber = (max: number) =>
    z.preprocess(
        (value) => (value === '' || value === null ? undefined : value),
        z.coerce.number().min(0).max(max).optional()
    );

export const CourseIdSchema = z.string().trim().regex(GOOGLE_CLASSROOM_ID_REGEX, 'Invalid classroom course ID format');

export const CourseWorkIdSchema = z.string().trim().regex(GOOGLE_CLASSROOM_ID_REGEX, 'Invalid classroom coursework ID format');

export const ClassroomSubmissionSchema = z.object({
    courseId: CourseIdSchema,
    courseWorkId: CourseWorkIdSchema,
    linkUrl: z.string().trim().url().startsWith('https://', 'Submission link must start with https://'),
    linkTitle: z.string().trim().max(150).optional(),
    turnIn: z.boolean().optional().default(true),
});

export type ClassroomSubmissionInput = z.infer<typeof ClassroomSubmissionSchema>;

export const ClassroomCourseCreateSchema = z.object({
    name: z.string().trim().min(3, 'Course name is required').max(120, 'Course name is too long'),
    section: optionalTrimmedString(120),
    room: optionalTrimmedString(120),
    descriptionHeading: optionalTrimmedString(200),
    description: optionalTrimmedString(3000),
});

export const ClassroomCourseWorkCreateSchema = z.object({
    courseId: CourseIdSchema,
    title: z.string().trim().min(3, 'Coursework title is required').max(180, 'Coursework title is too long'),
    description: optionalTrimmedString(30000),
    maxPoints: optionalNumber(1000),
    dueDate: z.string().trim().regex(ISO_DATE_REGEX, 'Due date must use YYYY-MM-DD').optional().transform((value) => value || undefined),
    dueTime: z.string().trim().regex(CLOCK_TIME_REGEX, 'Due time must use HH:mm').optional().transform((value) => value || undefined),
    state: z.enum(['DRAFT', 'PUBLISHED']).optional().default('DRAFT'),
}).refine((value) => !value.dueTime || Boolean(value.dueDate), {
    path: ['dueTime'],
    message: 'Due time requires a due date',
});

export type ClassroomCourseCreateInput = z.infer<typeof ClassroomCourseCreateSchema>;
export type ClassroomCourseWorkCreateInput = z.infer<typeof ClassroomCourseWorkCreateSchema>;
