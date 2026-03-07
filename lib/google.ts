import { google } from 'googleapis';
import { z } from 'zod';

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

export async function getSlidesData(): Promise<SlideData[]> {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
        throw new Error("Missing Server-side Environment Variables");
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/presentations.readonly'],
    });

    const slides = google.slides({ version: 'v1', auth });

    try {
        const res = await slides.presentations.get({
            presentationId: process.env.GOOGLE_SLIDES_ID,
        });

        // Parse and scrub the raw Google payload against our expanded Zod schema
        const parsedSlides = z.array(SlideSchema).parse(res.data.slides || []);
        return parsedSlides;

    } catch (error) {
        console.error("Failed API or Validation parsing", error);
        return [];
    }
}