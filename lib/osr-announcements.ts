import { getSlidesData, type SlideData } from '@/lib/google';
import type { Announcement } from '@/lib/announcements';

function isStructuralSlide(slide: SlideData): boolean {
    let isStructural = false;
    slide.pageElements?.forEach((element) => {
        element.shape?.text?.textElements?.forEach((textElement) => {
            const content = textElement.textRun?.content?.trim() || '';
            if (
                content.startsWith('CONFIG:') ||
                content.startsWith('NEWS:') ||
                content.startsWith('GALLERY:') ||
                content.startsWith('LINK:')
            ) {
                isStructural = true;
            }
        });
    });
    return isStructural;
}

export async function getOSRAnnouncementSlides(limit?: number): Promise<SlideData[]> {
    const allSlides = await getSlidesData();
    const contentSlides = allSlides.filter((slide) => !isStructuralSlide(slide));
    const newestFirst = [...contentSlides].reverse();
    return typeof limit === 'number' ? newestFirst.slice(0, limit) : newestFirst;
}

function slideText(slide: SlideData): string[] {
    const lines: string[] = [];
    slide.pageElements?.forEach((element) => {
        element.shape?.text?.textElements?.forEach((textElement) => {
            const content = (textElement.textRun?.content || '').trim();
            if (!content) return;
            if (
                content.startsWith('CONFIG:') ||
                content.startsWith('NEWS:') ||
                content.startsWith('GALLERY:') ||
                content.startsWith('LINK:') ||
                content.startsWith('YOUTUBE:') ||
                content.startsWith('DRIVE_VIDEO:') ||
                content.startsWith('MUSIC:')
            ) {
                return;
            }
            lines.push(content);
        });
    });
    return lines;
}

function inferOSRImportance(text: string): 'info' | 'important' | 'critical' {
    const value = text.toLowerCase();
    if (value.includes('critical') || value.includes('urgent') || value.includes('emergency')) return 'critical';
    if (value.includes('important') || value.includes('advisory') || value.includes('notice')) return 'important';
    return 'info';
}

export function mapOSRSlidesToAnnouncements(slides: SlideData[]): Announcement[] {
    return slides
        .map((slide, index) => {
            const lines = slideText(slide);
            if (!lines.length) return null;

            const title = lines[0].slice(0, 140);
            const summary = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim().slice(0, 220) || title;
            const merged = lines.join(' ');

            return {
                id: `osr-slide-${slide.objectId || index}`,
                title,
                summary,
                body: merged,
                href: '/student-government/osr#osr-announcements',
                pinned: true,
                importance: inferOSRImportance(merged),
                publishedAt: new Date().toISOString(),
            } as Announcement;
        })
        .filter((item): item is Announcement => Boolean(item));
}
