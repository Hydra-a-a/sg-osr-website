import { getSlidesData, SlideData } from './google';
import { redactErrorForLog } from './security';

export interface SlidePage {
    slug: string;
    title: string;
    prefix: 'NEWS' | 'GALLERY' | 'LINK';
    slideData: SlideData;
}

/**
 * turns long annoying titles into clean urls because spaces in urls are a crime
 */
function createSlug(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // dash everything that isn't a letter or number
        .replace(/(^-|-$)+/g, '');   // chop off edge dashes
}

/**
 * goes through the google slides and turns them into fake dynamic pages
 * somehow this is cleaner than managing a full CMS for a college org
 */
export async function getSlidePages(): Promise<SlidePage[]> {
    try {
        const slides = await getSlidesData();
        const pages: SlidePage[] = [];

        for (const slide of slides) {
            let isDynamicPage = false;
            let pagePrefix: 'NEWS' | 'GALLERY' | 'LINK' | null = null;
            let title = '';

            // praying the first box they put on the slide is the title otherwise this breaks
            // keep looking till we hit text
            for (const element of slide.pageElements || []) {
                const textElements = element.shape?.text?.textElements;
                if (!textElements) continue;

                for (const t of textElements) {
                    const content = t.textRun?.content?.trim();
                    if (!content) continue;

                    // what kind of page is this
                    if (content.startsWith('NEWS:')) {
                        pagePrefix = 'NEWS';
                        title = content.replace('NEWS:', '').trim();
                    } else if (content.startsWith('GALLERY:')) {
                        pagePrefix = 'GALLERY';
                        title = content.replace('GALLERY:', '').trim();
                    } else if (content.startsWith('LINK:')) {
                        pagePrefix = 'LINK';
                        title = content.replace('LINK:', '').trim();
                    }

                    // stop looking, we got the title
                    isDynamicPage = !!pagePrefix;
                    break;
                }
                if (isDynamicPage) break;
            }

            if (isDynamicPage && pagePrefix && title) {
                pages.push({
                    slug: createSlug(title),
                    title: title,
                    prefix: pagePrefix,
                    slideData: slide // passing the whole giant block of data
                });
            }
        }

        return pages;
    } catch (error) {
        console.error("Failed to parse Dynamic Slide Pages", redactErrorForLog(error));
        return [];
    }
}
