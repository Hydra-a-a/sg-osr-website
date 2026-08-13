import { google } from 'googleapis';
import { z } from 'zod';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';
import { redactErrorForLog } from '@/lib/security';
import { unstable_cache } from 'next/cache';
import { PUBLIC_CACHE_TAGS } from '@/lib/public-cache';

// ───── Zod Schemas for Google Slides API ─────
// Now captures text, images, AND videos from slide page elements.

const TextElementSchema = z.object({
    textRun: z.object({
        content: z.string()
    }).optional()
});

const ShapeSchema = z.object({
    text: z.object({
        textElements: z.array(TextElementSchema).optional()
    }).optional()
});

const ImageSchema = z.object({
    contentUrl: z.string().optional(),
    sourceUrl: z.string().optional(),
});

const VideoSchema = z.object({
    source: z.string().optional(),     // e.g. "YOUTUBE"
    url: z.string().optional(),        // direct URL
    id: z.string().optional(),         // YouTube video ID
});

const PageElementSchema = z.object({
    shape: ShapeSchema.optional(),
    image: ImageSchema.optional(),
    video: z.object({
        source: z.string().optional(),
        id: z.string().optional(),
        url: z.string().optional(),
    }).optional(),
});

const SlideSchema = z.object({
    objectId: z.string().optional(),
    pageElements: z.array(PageElementSchema).optional(),
});

export type SlideData = z.infer<typeof SlideSchema>;
export type PageElement = z.infer<typeof PageElementSchema>;

async function fetchSlidesData(): Promise<SlideData[]> {
    const credentials = getGoogleServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/presentations.readonly'],
    });

    const slides = google.slides({ version: 'v1', auth });

    try {
        const res = await slides.presentations.get(
            { presentationId: process.env.GOOGLE_SLIDES_ID },
            { timeout: 3000 },
        );

        // Parse and scrub the raw Google payload against our expanded Zod schema
        const parsedSlides = z.array(SlideSchema).parse(res.data.slides || []);
        return parsedSlides;

    } catch (error: any) {
        if (error?.code !== 'ECONNRESET') {
            console.error("Failed API or Validation parsing", redactErrorForLog(error));
        } else {
            console.warn("Google API connection reset (ECONNRESET). Check your internet connection if slides aren't loading.");
        }
        return [];
    }
}

const getCachedSlidesData = unstable_cache(
    fetchSlidesData,
    ['public-google-slides'],
    { revalidate: 60, tags: [PUBLIC_CACHE_TAGS.siteConfig, PUBLIC_CACHE_TAGS.announcements] },
);

export async function getSlidesData(): Promise<SlideData[]> {
    return getCachedSlidesData();
}
