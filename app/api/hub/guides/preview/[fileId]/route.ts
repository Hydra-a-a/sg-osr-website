import { checkRateLimit } from '@/lib/rate-limit';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { getClientIp } from '@/lib/security';
import { getDrivePdfStreamById } from '@/lib/google-drive';

function nodeReadableToWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            stream.on('data', (chunk: unknown) => {
                if (typeof chunk === 'string') {
                    controller.enqueue(new TextEncoder().encode(chunk));
                    return;
                }

                if (chunk instanceof Uint8Array) {
                    controller.enqueue(chunk);
                    return;
                }

                if (chunk instanceof ArrayBuffer) {
                    controller.enqueue(new Uint8Array(chunk));
                    return;
                }

                if (ArrayBuffer.isView(chunk)) {
                    controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                    return;
                }

                controller.enqueue(new Uint8Array(Buffer.from(String(chunk))));
            });

            stream.on('end', () => controller.close());
            stream.on('error', (error: unknown) => controller.error(error));
        },
    });
}

function sanitizeInlineFilename(name: string): string {
    const fallback = 'guide.pdf';
    const normalized = String(name || fallback)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120);

    if (!normalized) {
        return fallback;
    }

    return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`;
}

export async function GET(
    request: Request,
    context: { params: Promise<{ fileId: string }> }
) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`hub_guide_preview_${ip}`, 60, 60_000);

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    const { fileId } = await context.params;
    const normalizedFileId = decodeURIComponent(fileId || '').trim();

    if (!/^[a-zA-Z0-9_-]{10,}$/.test(normalizedFileId)) {
        return toApiResponse(new ApiError(400, 'INVALID_REQUEST', 'Invalid guide file id'));
    }

    const parsed = new URL(request.url);
    const resourceKey = (parsed.searchParams.get('resourcekey') || '').trim() || undefined;

    const file = await getDrivePdfStreamById(normalizedFileId, resourceKey);
    if (!file) {
        return toApiResponse(new ApiError(404, 'NOT_FOUND', 'Guide preview unavailable'));
    }

    const stream = nodeReadableToWebStream(file.stream);
    const filename = sanitizeInlineFilename(file.fileName || 'guide.pdf');

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
