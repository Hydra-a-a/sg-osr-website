import { z } from 'zod';
import { isSafeNavigationHref } from '@/lib/security';

export const TransparencyGuideSchema = z.object({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(160),
    description: z.string().max(500).default(''),
    category: z.string().max(100).default('Student Handbook & Guides'),
    source: z.enum(['drive', 'direct']),
    embedUrl: z.string().url().max(2048).refine(isSafeNavigationHref, {
        message: 'Embed URL must be a safe HTTPS URL',
    }),
    viewUrl: z.string().url().max(2048).refine(isSafeNavigationHref, {
        message: 'View URL must be a safe HTTPS URL',
    }),
    downloadUrl: z.string().url().max(2048).refine(isSafeNavigationHref, {
        message: 'Download URL must be a safe HTTPS URL',
    }),
    mimeType: z.literal('application/pdf'),
    sortOrder: z.number().int().min(0),
    updatedAt: z.string(),
});

export type TransparencyGuide = z.infer<typeof TransparencyGuideSchema>;
