import { createHash } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getClientIp } from '@/lib/security';
import { getDriveImageStreamById, getOrganizationLogosFolderId } from '@/lib/google-drive';

const LOGO_MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
const LOGO_MEMORY_CACHE_MAX_ITEMS = 120;

type CachedLogoResponse = {
    body: ArrayBuffer;
    contentLength: number;
    mimeType: string;
    contentDisposition: string;
    etag: string;
    expiresAt: number;
};

const logoResponseCache = new Map<string, CachedLogoResponse>();

function getCacheKey(fileId: string, resourceKey?: string): string {
    return `${fileId}:${resourceKey || ''}`;
}

function getCachedLogoResponse(cacheKey: string): CachedLogoResponse | null {
    const cached = logoResponseCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if (Date.now() > cached.expiresAt) {
        logoResponseCache.delete(cacheKey);
        return null;
    }

    // Refresh recency for simple LRU behavior.
    logoResponseCache.delete(cacheKey);
    logoResponseCache.set(cacheKey, cached);
    return cached;
}

function setCachedLogoResponse(cacheKey: string, value: CachedLogoResponse): void {
    if (logoResponseCache.has(cacheKey)) {
        logoResponseCache.delete(cacheKey);
    }

    while (logoResponseCache.size >= LOGO_MEMORY_CACHE_MAX_ITEMS) {
        const firstKey = logoResponseCache.keys().next().value;
        if (!firstKey) {
            break;
        }
        logoResponseCache.delete(firstKey);
    }

    logoResponseCache.set(cacheKey, value);
}

function nodeReadableToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];

        stream.on('data', (chunk: unknown) => {
            if (Buffer.isBuffer(chunk)) {
                chunks.push(chunk);
                return;
            }

            if (chunk instanceof Uint8Array) {
                chunks.push(Buffer.from(chunk));
                return;
            }

            if (chunk instanceof ArrayBuffer) {
                chunks.push(Buffer.from(chunk));
                return;
            }

            if (ArrayBuffer.isView(chunk)) {
                chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                return;
            }

            chunks.push(Buffer.from(String(chunk)));
        });

        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (error: unknown) => reject(error));
    });
}

function cloneBufferToArrayBuffer(buffer: Uint8Array): ArrayBuffer {
    const body = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(body).set(buffer);
    return body;
}

function sanitizeInlineFilename(name: string, mimeType: string): string {
    const fallback = 'organization-logo';
    const normalized = String(name || fallback)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100);

    const hasExtension = /\.[a-z0-9]{2,6}$/i.test(normalized);
    if (hasExtension) {
        return normalized;
    }

    const extensionMap: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
    };

    return `${normalized || fallback}${extensionMap[mimeType] || ''}`;
}

function buildCacheHeaders(contentType: string, contentDisposition: string, etag: string, contentLength: number): HeadersInit {
    return {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Content-Length': String(contentLength),
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Vercel-CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
    };
}

export async function GET(
    request: Request,
    context: { params: Promise<{ fileId: string }> }
) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`directory_logo_preview_${ip}`, 240, 60_000);

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    const { fileId } = await context.params;
    const normalizedFileId = decodeURIComponent(fileId || '').trim();

    if (!/^[a-zA-Z0-9_-]{10,}$/.test(normalizedFileId)) {
        return toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Invalid logo file id'));
    }

    const parsed = new URL(request.url);
    const resourceKey = (parsed.searchParams.get('resourcekey') || '').trim() || undefined;

    const cacheKey = getCacheKey(normalizedFileId, resourceKey);
    const cached = getCachedLogoResponse(cacheKey);
    if (cached) {
        const requestEtag = request.headers.get('if-none-match');
        if (requestEtag && requestEtag === cached.etag) {
            return new Response(null, {
                status: 304,
                headers: buildCacheHeaders(cached.mimeType, cached.contentDisposition, cached.etag, cached.contentLength),
            });
        }

        return new Response(cached.body, {
            status: 200,
            headers: buildCacheHeaders(cached.mimeType, cached.contentDisposition, cached.etag, cached.contentLength),
        });
    }

    const file = await getDriveImageStreamById(normalizedFileId, resourceKey);
    if (!file) {
        return toApiResponse(new ApiError(404, 'NOT_FOUND', 'Logo unavailable'));
    }

    const expectedFolderId = getOrganizationLogosFolderId().trim();
    if (expectedFolderId && !file.parents?.includes(expectedFolderId)) {
        return toApiResponse(new ApiError(404, 'NOT_FOUND', 'Logo unavailable'));
    }

    const buffer = await nodeReadableToBuffer(file.stream);
    const filename = sanitizeInlineFilename(file.fileName || 'organization-logo', file.mimeType || 'image/png');
    const mimeType = file.mimeType || 'image/png';
    const contentDisposition = `inline; filename="${filename}"`;
    const etag = `"logo-${createHash('sha1').update(buffer).digest('hex')}"`;

    const cachedResponse: CachedLogoResponse = {
        body: cloneBufferToArrayBuffer(buffer),
        contentLength: buffer.byteLength,
        mimeType,
        contentDisposition,
        etag,
        expiresAt: Date.now() + LOGO_MEMORY_CACHE_TTL_MS,
    };
    setCachedLogoResponse(cacheKey, cachedResponse);

    return new Response(cachedResponse.body, {
        status: 200,
        headers: buildCacheHeaders(mimeType, contentDisposition, etag, cachedResponse.contentLength),
    });
}
