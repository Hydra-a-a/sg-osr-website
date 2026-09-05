import 'server-only';

import { isSafeNavigationHref, isTrustedUrl } from '@/lib/security';
import { normalizeNewsPost } from '@/lib/news';
import type { NewsPost } from '@/schemas/news';
import { unstable_cache } from 'next/cache';
import { PUBLIC_CACHE_TAGS } from '@/lib/public-cache';

export type PublicContentSource = 'sheet' | 'db-with-sheets-fallback' | 'db';

export function resolvePublicContentSource(name: 'NEWS_SOURCE' | 'HUB_GUIDES_SOURCE' | 'QUICK_LINKS_SOURCE'): PublicContentSource {
    const value = String(process.env[name] || '').trim().toLowerCase();
    if (value === 'db' || value === 'database') return 'db';
    if (value === 'db-with-sheets-fallback' || value === 'database-with-sheets-fallback' || value === 'db_fallback') return 'db-with-sheets-fallback';
    return 'sheet';
}

async function getPrisma() {
    const { prisma } = await import('@/lib/prisma');
    return prisma as any;
}

async function queryNewsPostsFromDb(limit = 100): Promise<NewsPost[]> {
    const prisma = await getPrisma();
    const rows = await prisma.newsPost.findMany({ where: { enabled: true }, orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }], take: Math.min(limit, 200) });
    return rows.map((row: any) => normalizeNewsPost({
        id: row.id,
        source: row.sourcePageName,
        sourcePageId: row.sourcePageId,
        sourcePageName: row.sourcePageName,
        caption: row.message,
        articleTitle: row.articleTitle || '',
        manualTitle: row.manualTitle || '',
        articleBody: row.articleBody || row.message,
        manualBody: row.manualBody || '',
        imageUrl: isTrustedUrl(row.imageUrl) ? row.imageUrl || '' : '',
        imageAlt: row.imageAlt || '',
        publishedAt: new Date(row.publishedAt).toISOString(),
        fbLink: /https:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\//i.test(String(row.fbLink || '')) ? row.fbLink : '',
        routeTargets: Array.isArray(row.targetPagesJson) ? row.targetPagesJson : ['/news'],
        section: row.section || row.sourcePageSlug,
        visible: row.enabled,
        featured: row.featured,
        sortOrder: row.sortOrder ?? null,
        updatedAt: new Date(row.updatedAt).toISOString(),
        syncStatus: 'db',
    }));
}

async function queryQuickLinksFromDb() {
    const prisma = await getPrisma();
    const rows = await prisma.quickLink.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] });
    return rows.filter((row: any) => isSafeNavigationHref(row.href)).map((row: any) => ({
        id: row.id,
        label: row.label,
        desc: row.description || '',
        href: row.href,
        icon: row.icon || 'ExternalLink',
    }));
}

async function queryHubGuidesFromDb() {
    const prisma = await getPrisma();
    const rows = await prisma.hubGuide.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] });
    return rows.flatMap((row: any) => {
        const data = row.publicDataJson && typeof row.publicDataJson === 'object' ? row.publicDataJson as Record<string, unknown> : {};
        const driveFileId = String(row.driveFileId || '').trim();
        if (/^[a-zA-Z0-9_-]{10,}$/.test(driveFileId)) {
            const resourceKey = String(row.resourceKey || '').trim();
            const previewParams = new URLSearchParams();
            if (/^[a-zA-Z0-9_-]{4,200}$/.test(resourceKey)) previewParams.set('resourcekey', resourceKey);
            const previewUrl = `/api/hub/guides/preview/${encodeURIComponent(driveFileId)}${previewParams.size ? `?${previewParams}` : ''}`;
            const downloadParams = new URLSearchParams(previewParams);
            downloadParams.set('download', '1');
            return [{
                id: row.id,
                title: row.title,
                description: row.description || '',
                category: row.category || 'Student Handbook & Guides',
                source: 'drive',
                embedUrl: previewUrl,
                viewUrl: previewUrl,
                downloadUrl: `${previewUrl.split('?')[0]}?${downloadParams}`,
                canEmbed: true,
                mimeType: 'application/pdf',
                sortOrder: row.sortOrder,
            }];
        }
        const viewUrl = String(data.viewUrl || row.fileUrl || '');
        const embedUrl = String(data.embedUrl || viewUrl);
        const downloadUrl = String(data.downloadUrl || viewUrl);
        if (!/^https:\/\//i.test(viewUrl) || !/^https:\/\//i.test(embedUrl) || !/^https:\/\//i.test(downloadUrl)) return [];
        if (!/\.pdf(?:$|[?#])/i.test(viewUrl) && !/drive\.google\.com|docs\.google\.com/i.test(viewUrl)) return [];
        return [{
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || 'Student Handbook & Guides',
            source: 'direct',
            embedUrl,
            viewUrl,
            downloadUrl,
            canEmbed: data.canEmbed !== false,
            mimeType: 'application/pdf',
            sortOrder: row.sortOrder,
        }];
    });
}

const cachedNewsPostsFromDb = unstable_cache(queryNewsPostsFromDb, ['public-news-db'], {
    revalidate: 300,
    tags: [PUBLIC_CACHE_TAGS.news],
});
const cachedQuickLinksFromDb = unstable_cache(queryQuickLinksFromDb, ['public-quick-links-db'], {
    revalidate: 3600,
    tags: [PUBLIC_CACHE_TAGS.quickLinks],
});
const cachedHubGuidesFromDb = unstable_cache(queryHubGuidesFromDb, ['public-hub-guides-db'], {
    revalidate: 3600,
    tags: [PUBLIC_CACHE_TAGS.hubGuides],
});

export function loadNewsPostsFromDb(limit = 100): Promise<NewsPost[]> {
    return cachedNewsPostsFromDb(limit);
}

export function loadQuickLinksFromDb() {
    return cachedQuickLinksFromDb();
}

export function loadHubGuidesFromDb() {
    return cachedHubGuidesFromDb();
}
