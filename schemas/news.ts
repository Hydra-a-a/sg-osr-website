import { z } from 'zod';
import { isTrustedUrl } from '../lib/security';

export const NewsPostSchema = z.object({
    id: z.string(),
    source: z.string().max(100),
    caption: z.string().max(10000), // Large but bounded
    imageUrl: z.union([
        z.string().url().max(2048).refine(isTrustedUrl, { message: "Untrusted image domain" }),
        z.literal(''),
        z.null()
    ]).optional(),
    publishedAt: z.string(),
    fbLink: z.union([
        z.string()
            .url()
            .refine(url => url.includes('facebook.com') || url.includes('fb.watch'), {
                message: "Only official Facebook links allowed"
            }),
        z.literal(''),
        z.null(),
        z.undefined(),
    ]).optional(),
});

export type NewsPost = z.infer<typeof NewsPostSchema>;
