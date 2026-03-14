import { createHmac, timingSafeEqual } from 'crypto';

function isValidIp(value: string): boolean {
    const ipv4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    return ipv4.test(value) || ipv6.test(value);
}

function normalizeIp(raw: string | null | undefined): string | null {
    if (!raw) return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    const first = trimmed.split(',')[0]?.trim();
    if (!first) return null;

    const withoutBrackets = first.replace(/^\[|\]$/g, '');

    const ipv4WithPort = withoutBrackets.match(/^(\d+\.\d+\.\d+\.\d+):(\d{1,5})$/);
    const candidate = ipv4WithPort ? ipv4WithPort[1] : withoutBrackets;

    return isValidIp(candidate) ? candidate : null;
}

/**
 * nukes all html because students will try to XSS us.
 * cleans copy pasted stuff from external APIs/Sheets.
 */
export function sanitizeText(text: string): string {
    if (!text) return '';

    return text
        .replace(/<[^>]+>/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function escapeHtml(text: string): string {
    if (!text) return '';

    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function sanitizeRichText(text: string): string {
    if (!text) return '';

    const normalized = text
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    return escapeHtml(normalized).replace(/\n/g, '<br />');
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

export function isSafeNavigationHref(href: string): boolean {
    if (!href) return false;

    const value = href.trim();
    if (!value) return false;

    if (value.startsWith('/')) {
        return !value.startsWith('//');
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:';
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

/**
 * Pulls best-effort client IP from trusted proxy headers.
 */
export function getClientIp(request: Request): string {
    const vercelForwardedFor = normalizeIp(request.headers.get('x-vercel-forwarded-for'));
    if (vercelForwardedFor) return vercelForwardedFor;

    const realIp = normalizeIp(request.headers.get('x-real-ip'));
    if (realIp) return realIp;

    const cfIp = normalizeIp(request.headers.get('cf-connecting-ip'));
    if (cfIp) return cfIp;

    const xff = normalizeIp(request.headers.get('x-forwarded-for'));
    if (xff) return xff;

    return 'anonymous';
}

/**
 * Validates a timestamp header for replay protection.
 */
export function isRecentWebhookTimestamp(timestampHeader: string | null, maxSkewSeconds = 300): boolean {
    if (!timestampHeader) return false;

    const timestampMs = Number(timestampHeader);
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;

    const now = Date.now();
    const skewMs = Math.abs(now - timestampMs);
    return skewMs <= maxSkewSeconds * 1000;
}

/**
 * Verifies webhook HMAC SHA-256 using raw body + timestamp.
 */
export function verifyWebhookHmac(
    body: string,
    timestamp: string,
    signatureHeader: string | null,
    secret: string,
): boolean {
    if (!signatureHeader) return false;

    const [scheme, providedDigest] = signatureHeader.split('=');
    if (scheme !== 'sha256' || !providedDigest) return false;

    const signedPayload = `${timestamp}.${body}`;
    const expectedDigest = createHmac('sha256', secret).update(signedPayload).digest('hex');

    const expectedBuffer = Buffer.from(expectedDigest, 'hex');
    const providedBuffer = Buffer.from(providedDigest, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
}
