import { fetchWithTimeout, isOfficialFacebookUrl, isTrustedUrl } from '@/lib/security';
import {
    extractHashtags,
    generateArticleBody,
    generateArticleSlug,
    generateArticleTitle,
} from '@/lib/news';

export interface UnfurlNewsResult {
    id: string;
    sourcePageId: string;
    sourcePageName: string;
    sourcePageSlug: string;
    message: string;
    articleTitle: string;
    manualTitle: string;
    articleSlug: string;
    articleBody: string;
    manualBody: string;
    imageUrl: string;
    imageAlt: string;
    publishedAt: string;
    fbLink: string;
    hashtags: string[];
    targetPagesJson: string[];
    section: string;
    enabled: boolean;
    featured: boolean;
}

const HTML_ENTITIES: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
    '#039': "'",
    '#39': "'",
};

function decodeHtmlEntities(raw: string): string {
    let output = '';

    for (let index = 0; index < raw.length; index += 1) {
        if (raw[index] !== '&') {
            output += raw[index];
            continue;
        }

        const candidate = raw.slice(index + 1, index + 12);
        const end = candidate.indexOf(';');
        if (end < 0) {
            output += '&';
            continue;
        }

        const entity = candidate.slice(0, end).toLowerCase();
        const namedValue = HTML_ENTITIES[entity];
        const codePoint = entity.startsWith('#x')
            ? Number.parseInt(entity.slice(2), 16)
            : entity.startsWith('#')
                ? Number.parseInt(entity.slice(1), 10)
                : Number.NaN;
        const decoded = namedValue || (
            Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : ''
        );

        if (!decoded) {
            output += '&';
            continue;
        }

        output += decoded;
        index += end + 1;
    }

    return output;
}

function extractMetaContent(html: string, propertyOrName: string): string {
    const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex1 = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i');
    const match1 = html.match(regex1);
    if (match1?.[1]) return decodeHtmlEntities(match1[1].trim());

    const regex2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i');
    const match2 = html.match(regex2);
    if (match2?.[1]) return decodeHtmlEntities(match2[1].trim());

    return '';
}

function extractTitleTag(html: string): string {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match?.[1] ? decodeHtmlEntities(match[1].trim()) : '';
}

export function extractFacebookPostId(urlStr: string): string {
    try {
        const url = new URL(urlStr);
        // e.g. /permalink.php?story_fbid=...&id=...
        const storyFbid = url.searchParams.get('story_fbid');
        if (storyFbid) return storyFbid;

        const fbid = url.searchParams.get('fbid') || url.searchParams.get('id');
        if (fbid && /^\d+$/.test(fbid)) return fbid;

        // e.g. /posts/123456789 or /photos/123456789 or /videos/123456789
        const pathParts = url.pathname.split('/').filter(Boolean);
        for (let i = 0; i < pathParts.length; i++) {
            if (['posts', 'photos', 'videos', 'p', 'story.php'].includes(pathParts[i])) {
                const candidate = pathParts[i + 1];
                if (candidate && /^[a-zA-Z0-9_-]+$/.test(candidate)) {
                    return candidate;
                }
            }
        }

        // Fallback hash from url pathname
        return pathParts[pathParts.length - 1] || `post-${Date.now()}`;
    } catch {
        return `post-${Date.now()}`;
    }
}

function detectSourcePageName(metaSiteName: string, metaTitle: string, caption: string): { name: string; slug: string } {
    const combined = `${metaSiteName} ${metaTitle} ${caption}`.toLowerCase();

    if (combined.includes('supreme student council') || combined.includes('ssc')) {
        return { name: 'Supreme Student Council', slug: 'ssc' };
    }
    if (combined.includes('office of the student regent') || combined.includes('student regent') || combined.includes('osr')) {
        return { name: 'Office of the Student Regent', slug: 'osr' };
    }
    if (combined.includes('central student council') || combined.includes('csc')) {
        return { name: 'Central Student Council', slug: 'csc' };
    }

    return { name: metaSiteName || 'Supreme Student Council', slug: 'ssc' };
}

export async function unfurlPostUrl(targetUrl: string): Promise<UnfurlNewsResult> {
    const cleanUrl = String(targetUrl || '').trim();
    if (!cleanUrl) {
        throw new Error('URL is required');
    }

    if (!isOfficialFacebookUrl(cleanUrl)) {
        throw new Error('Only HTTPS Facebook post URLs can be imported.');
    }

    let nextUrl = cleanUrl;
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
        // Use browser-like User Agent to fetch rich OpenGraph metadata.
        response = await fetchWithTimeout(nextUrl, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            cache: 'no-store',
            redirect: 'manual',
            timeout: 3_000,
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) {
            break;
        }

        const location = response.headers.get('location');
        const redirectedUrl = location ? new URL(location, nextUrl).href : '';
        if (!isOfficialFacebookUrl(redirectedUrl)) {
            throw new Error('Facebook redirected to an untrusted URL.');
        }
        nextUrl = redirectedUrl;
        response = undefined;
    }

    if (!response) {
        throw new Error('Too many Facebook redirects.');
    }

    if (!response.ok) {
        throw new Error(`Failed to fetch URL preview (HTTP ${response.status})`);
    }

    const html = await response.text();

    const ogTitle = extractMetaContent(html, 'og:title');
    const ogDesc = extractMetaContent(html, 'og:description');
    const metaDesc = extractMetaContent(html, 'description');
    const ogImage = extractMetaContent(html, 'og:image') || extractMetaContent(html, 'og:image:url');
    const ogSiteName = extractMetaContent(html, 'og:site_name');
    const ogPublished = extractMetaContent(html, 'article:published_time');
    const titleTag = extractTitleTag(html);

    const postId = extractFacebookPostId(cleanUrl);
    const rawCaption = ogDesc || metaDesc || ogTitle || titleTag || '';
    const { name: sourcePageName, slug: sourcePageSlug } = detectSourcePageName(ogSiteName, ogTitle, rawCaption);

    const articleTitle = generateArticleTitle(rawCaption, sourcePageName) || ogTitle || `Update from ${sourcePageName}`;
    const articleBody = generateArticleBody(rawCaption) || rawCaption;
    const hashtags = extractHashtags(rawCaption);
    const articleSlug = generateArticleSlug(articleTitle, postId);

    const imageUrl = isTrustedUrl(ogImage) ? ogImage : '';
    const publishedAt = ogPublished && !Number.isNaN(Date.parse(ogPublished))
        ? new Date(ogPublished).toISOString()
        : new Date().toISOString();

    const targetPagesJson = ['/news'];
    if (sourcePageSlug === 'ssc') targetPagesJson.push('/student-government');
    if (sourcePageSlug === 'osr') targetPagesJson.push('/osr');

    return {
        id: postId,
        sourcePageId: sourcePageSlug,
        sourcePageName,
        sourcePageSlug,
        message: rawCaption,
        articleTitle,
        manualTitle: '',
        articleSlug,
        articleBody,
        manualBody: '',
        imageUrl,
        imageAlt: articleTitle ? `${articleTitle} - ${sourcePageName}` : '',
        publishedAt,
        fbLink: cleanUrl,
        hashtags,
        targetPagesJson,
        section: sourcePageSlug,
        enabled: true,
        featured: false,
    };
}
