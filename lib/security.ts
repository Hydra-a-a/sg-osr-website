import DOMPurify from 'isomorphic-dompurify';

/**
 * nukes all html because students will try to XSS us.
 * cleans copy pasted stuff from external APIs/Sheets.
 */
export function sanitizeText(text: string): string {
    if (!text) return '';

    // kill all tags
    const clean = DOMPurify.sanitize(text, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: []
    });

    return clean.trim();
}

/**
 * makes sure the url isn't sketchy
 */
export function isTrustedUrl(url: string | null | undefined): boolean {
    if (!url) return true; // if it's null whatever, let it through

    try {
        const parsed = new URL(url);
        const trustedDomains = [
            'rtu.edu.ph',
            'facebook.com',
            'fbcdn.net',
            'akamaihd.net',
            'fb.me',
            'googleusercontent.com',
            'drive.google.com'
        ];

        return trustedDomains.some(domain =>
            parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * fetch with a timeout so vercel doesn't bill me for a 10 year request
 */
export async function fetchWithTimeout(resource: RequestInfo | URL, options: RequestInit & { timeout?: number } = {}) {
    const { timeout = 8000, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
    }
}

/**
 * ssrf protection. stops people from pinging our internal IPs because they think they're leet hackers.
 */
export function validateServerFetchUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // has to be a website at least
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }

        // block localhost so i can sleep at night
        const hostname = parsed.hostname;
        const blockedPatterns = [
            /^localhost$/i,
            /^127\.\d+\.\d+\.\d+$/, // 127.0.0.0/8
            /^10\.\d+\.\d+\.\d+$/,   // 10.0.0.0/8
            /^192\.168\.\d+\.\d+$/,  // 192.168.0.0/16
            /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/, // 172.16.0.0/12
            /^169\.254\.\d+\.\d+$/   // link-local
        ];

        if (blockedPatterns.some(pattern => pattern.test(hostname))) {
            return false;
        }

        return true;
    } catch {
        return false;
    }
}
