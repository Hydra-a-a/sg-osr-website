import { z } from 'zod';

const GOOGLE_CLASSROOM_ID_REGEX = /^\d{5,30}$/;

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
