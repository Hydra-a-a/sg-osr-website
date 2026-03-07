import { z } from 'zod';

export const QuickLinkSchema = z.object({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    href: z.string(),
    icon: z.string().optional(), // String name of Lucide icon
});

export type QuickLink = z.infer<typeof QuickLinkSchema>;
