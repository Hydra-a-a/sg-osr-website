import { revalidateTag } from 'next/cache';

export const PUBLIC_CACHE_TAGS = {
    siteConfig: 'public:site-config',
    announcements: 'public:announcements',
    news: 'public:news',
    directory: 'public:directory',
    quickLinks: 'public:quick-links',
    hubGuides: 'public:hub-guides',
} as const;

export const PUBLIC_CONTENT_CACHE_CONTROL = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';

export function publicContentHeaders(maxAge = 60, sharedMaxAge = 3600): HeadersInit {
    return {
        'Cache-Control': `public, max-age=${maxAge}, s-maxage=${sharedMaxAge}, stale-while-revalidate=86400`,
        'CDN-Cache-Control': `public, max-age=${sharedMaxAge}, stale-while-revalidate=86400`,
        'Vercel-CDN-Cache-Control': `public, max-age=${sharedMaxAge}, stale-while-revalidate=86400`,
    };
}

export async function revalidatePublicTags(tags: readonly string[]): Promise<void> {
    await Promise.all(tags.map((tag) => Promise.resolve(revalidateTag(tag, 'max'))));
}
