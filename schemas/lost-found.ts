import { z } from 'zod';

export const LostFoundReportSchema = z.object({
    reportType: z.enum(['LOST', 'FOUND']),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(4000),
    location: z.string().trim().min(2).max(240),
    eventDate: z.string().trim().max(40).optional().default(''),
}).strict();

export const LostFoundPublicFilterSchema = z.object({
    source: z.enum(['CSO', 'STUDENT']).optional(),
    reportType: z.enum(['LOST', 'FOUND']).optional(),
    query: z.string().trim().max(120).optional(),
}).strict();

export const LostFoundModerationSchema = z.object({
    itemId: z.string().trim().min(8).max(80),
    status: z.enum(['PENDING_REVIEW', 'PUBLISHED', 'RESOLVED', 'REJECTED', 'ARCHIVED']),
    reviewNotes: z.string().trim().max(2000).default(''),
}).strict();

export const LostFoundCsoSchema = LostFoundReportSchema.extend({
    csoReference: z.string().trim().max(160).default(''),
    status: z.enum(['PUBLISHED', 'PENDING_REVIEW']).default('PUBLISHED'),
}).strict();

export const LostFoundCommentSchema = z.object({
    message: z.string().trim().min(2).max(2000),
}).strict();

export const LostFoundCommentModerationSchema = z.object({
    commentId: z.string().trim().min(8).max(80),
    isHidden: z.boolean(),
}).strict();
