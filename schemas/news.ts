import { z } from 'zod';
import { isTrustedUrl } from '../lib/security';

const nullableTrustedUrl = z.union([
    z.string().url().max(2048).refine(isTrustedUrl, { message: 'Untrusted image domain' }),
    z.literal(''),
    z.null(),
    z.undefined(),
]);

const nullableFacebookUrl = z.union([
    z.string()
        .url()
        .refine((url) => url.includes('facebook.com') || url.includes('fb.watch'), {
            message: 'Only official Facebook links allowed',
        }),
    z.literal(''),
    z.null(),
    z.undefined(),
]);

export const LegacyNewsPostSchema = z.object({
    id: z.string(),
    source: z.string().max(100),
    caption: z.string().max(10000),
    imageUrl: nullableTrustedUrl.optional(),
    publishedAt: z.string(),
    fbLink: nullableFacebookUrl.optional(),
});

export const NewsPostSchema = LegacyNewsPostSchema.extend({
    sourcePageId: z.string().max(120).optional().default(''),
    sourcePageName: z.string().max(160).optional().default(''),
    articleTitle: z.string().max(220).optional().default(''),
    manualTitle: z.string().max(220).optional().default(''),
    articleSlug: z.string().max(260).optional().default(''),
    articleBody: z.string().max(20000).optional().default(''),
    manualBody: z.string().max(20000).optional().default(''),
    displayTitle: z.string().max(220).optional().default(''),
    displayBody: z.string().max(20000).optional().default(''),
    imageAlt: z.string().max(300).optional().default(''),
    hashtags: z.array(z.string().max(80)).optional().default([]),
    routeTargets: z.array(z.string().max(240)).optional().default([]),
    primaryTag: z.string().max(80).optional().default(''),
    section: z.string().max(80).optional().default(''),
    visible: z.boolean().optional().default(true),
    featured: z.boolean().optional().default(false),
    sortOrder: z.number().nullable().optional().default(null),
    ingestedAt: z.string().optional().default(''),
    updatedAt: z.string().optional().default(''),
    syncStatus: z.string().max(80).optional().default(''),
    syncNotes: z.string().max(1000).optional().default(''),
});

export type NewsPost = z.infer<typeof NewsPostSchema>;
export type LegacyNewsPost = z.infer<typeof LegacyNewsPostSchema>;
