import { z } from 'zod';
import { isSafeNavigationHref } from '@/lib/security';

export const QuickLinkSchema = z.object({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    href: z.string().trim().max(2048).refine(isSafeNavigationHref, {
        message: 'Link must be a safe relative path or HTTPS URL',
    }),
    icon: z.string().optional(), // String name of Lucide icon
});

export type QuickLink = z.infer<typeof QuickLinkSchema>;
