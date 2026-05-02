import type { NewsPost } from '@/schemas/news';

export type AnnouncementImportance = 'info' | 'important' | 'critical';

export interface Announcement {
    id: string;
    title: string;
    summary: string;
    body?: string;
    href?: string;
    startAt?: string;
    endAt?: string;
    pinned?: boolean;
    importance?: AnnouncementImportance;
    publishedAt?: string;
}

const importanceRank: Record<AnnouncementImportance, number> = {
    info: 0,
    important: 1,
    critical: 2,
};

function toDateMs(value?: string): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function inferImportance(post: NewsPost): AnnouncementImportance {
    const raw = [post.primaryTag, ...(post.hashtags || [])].join(' ').toLowerCase();
    if (raw.includes('critical') || raw.includes('urgent') || raw.includes('emergency')) return 'critical';
    if (post.featured || raw.includes('important') || raw.includes('advisory')) return 'important';
    return 'info';
}

export function isAnnouncementActive(announcement: Announcement, nowMs = Date.now()): boolean {
    const startMs = announcement.startAt ? toDateMs(announcement.startAt) : 0;
    const endMs = announcement.endAt ? toDateMs(announcement.endAt) : 0;

    if (startMs && nowMs < startMs) return false;
    if (endMs && nowMs > endMs) return false;
    return true;
}

export function toAnnouncement(post: NewsPost): Announcement {
    const title = post.displayTitle || post.manualTitle || post.articleTitle || 'Student government update';
    const body = post.displayBody || post.manualBody || post.articleBody || post.caption || '';
    const summary = body.replace(/\s+/g, ' ').trim().slice(0, 220);

    return {
        id: post.id || post.articleSlug,
        title,
        summary,
        body,
        pinned: Boolean(post.featured),
        importance: inferImportance(post),
        startAt: undefined,
        endAt: undefined,
        publishedAt: post.publishedAt,
    };
}

export function sortAnnouncements(items: Announcement[]): Announcement[] {
    return [...items].sort((a, b) => {
        const aImportance = importanceRank[a.importance || 'info'];
        const bImportance = importanceRank[b.importance || 'info'];
        if (aImportance !== bImportance) return bImportance - aImportance;
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return toDateMs(b.publishedAt) - toDateMs(a.publishedAt);
    });
}

export function getActiveAnnouncements(items: Announcement[]): Announcement[] {
    return sortAnnouncements(items.filter((item) => isAnnouncementActive(item)));
}

export function shouldPopup(item: Announcement): boolean {
    return Boolean(item.pinned) || item.importance === 'important' || item.importance === 'critical';
}
