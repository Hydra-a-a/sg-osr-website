import { getSheetData } from '@/lib/sheets';
import { normalizeNewsPostRow } from '@/lib/news';
import { NEWS_POSTS_RANGE } from '@/lib/news';
import { NewsPostSchema, type NewsPost } from '@/schemas/news';
import { getActiveAnnouncements, toAnnouncement, type Announcement } from '@/lib/announcements';
import { getOSRAnnouncementSlides, mapOSRSlidesToAnnouncements } from '@/lib/osr-announcements';
import { unstable_cache } from 'next/cache';
import { PUBLIC_CACHE_TAGS } from '@/lib/public-cache';

async function queryNewsPosts(limit = 50): Promise<NewsPost[]> {
    const spreadsheetId = process.env.GOOGLE_SHEETS_INFO_ID;
    if (!spreadsheetId) return [];

    const rows = await getSheetData(spreadsheetId, NEWS_POSTS_RANGE);
    const posts = rows
        .filter((row) => row.some((cell) => String(cell || '').trim()))
        .map(normalizeNewsPostRow)
        .filter((post) => NewsPostSchema.safeParse(post).success)
        .filter((post) => post.visible);

    posts.sort((a, b) => Date.parse(b.publishedAt || '') - Date.parse(a.publishedAt || ''));
    return posts.slice(0, limit);
}

const cachedNewsPosts = unstable_cache(queryNewsPosts, ['public-news-sheet-posts'], {
    revalidate: 300,
    tags: [PUBLIC_CACHE_TAGS.news],
});

export function fetchNewsPosts(limit = 50): Promise<NewsPost[]> {
    return cachedNewsPosts(limit);
}

async function queryActiveAnnouncements(limit = 10): Promise<Announcement[]> {
    const [posts, osrSlides] = await Promise.all([
        fetchNewsPosts(80),
        getOSRAnnouncementSlides(20).catch(() => []),
    ]);
    const newsAnnouncements = posts.map(toAnnouncement).map((item) => ({ ...item, href: '/#announcements' }));
    const osrAnnouncements = mapOSRSlidesToAnnouncements(osrSlides);
    const announcements = getActiveAnnouncements([...newsAnnouncements, ...osrAnnouncements]);
    return announcements.slice(0, limit);
}

const cachedActiveAnnouncements = unstable_cache(queryActiveAnnouncements, ['public-active-announcements'], {
    revalidate: 300,
    tags: [PUBLIC_CACHE_TAGS.announcements, PUBLIC_CACHE_TAGS.news],
});

export function fetchActiveAnnouncements(limit = 10): Promise<Announcement[]> {
    return cachedActiveAnnouncements(limit);
}
