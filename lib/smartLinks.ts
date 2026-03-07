// regex hell. parsing garbage urls because people don't know how to copy IDs
export function extractGoogleFormId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;


    const publishedMatch = url.match(/forms\/d\/e\/([\w-]+)/);
    if (publishedMatch) return publishedMatch[1];


    const editMatch = url.match(/forms\/d\/([\w-]+)/);
    if (editMatch) return editMatch[1];


    const shortMatch = url.match(/forms\.gle\/([\w-]+)/);
    if (shortMatch) return shortMatch[1];

    return null;
}


export function extractYouTubeId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;


    const watchMatch = url.match(/[?&]v=([\w-]{11})/);
    if (watchMatch) return watchMatch[1];


    const shortMatch = url.match(/youtu\.be\/([\w-]{11})/);
    if (shortMatch) return shortMatch[1];


    const embedMatch = url.match(/youtube\.com\/(?:embed|shorts)\/([\w-]{11})/);
    if (embedMatch) return embedMatch[1];

    return null;
}


export function extractDriveFileId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    const pathMatch = url.match(/\/file\/d\/([\w-]+)/);
    if (pathMatch) return pathMatch[1];

    const paramMatch = url.match(/[?&]id=([\w-]+)/);
    if (paramMatch) return paramMatch[1];

    return null;
}


export function extractSlidesId(url: string): string | null {
    if (!url || typeof url !== 'string') return null;

    const match = url.match(/presentation\/d\/([\w-]+)/);
    return match ? match[1] : null;
}


export type LinkType = 'youtube' | 'drive' | 'google-form' | 'google-slides' | 'unknown';

export interface ParsedLink {
    type: LinkType;
    id: string | null;
    originalUrl: string;
}

export function parseSmartLink(url: string): ParsedLink {
    const trimmed = (url || '').trim();

    const ytId = extractYouTubeId(trimmed);
    if (ytId) return { type: 'youtube', id: ytId, originalUrl: trimmed };

    const driveId = extractDriveFileId(trimmed);
    if (driveId) return { type: 'drive', id: driveId, originalUrl: trimmed };

    const formId = extractGoogleFormId(trimmed);
    if (formId) return { type: 'google-form', id: formId, originalUrl: trimmed };

    const slidesId = extractSlidesId(trimmed);
    if (slidesId) return { type: 'google-slides', id: slidesId, originalUrl: trimmed };

    return { type: 'unknown', id: null, originalUrl: trimmed };
}
