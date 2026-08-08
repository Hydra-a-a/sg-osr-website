import { getDriveMediaStreamById, getLostFoundFolderId } from '@/lib/google-drive';
import { getLostFoundAttachment, lostFoundLimits } from '@/lib/lost-found';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';

function nodeReadableToWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            stream.on('data', (chunk: unknown) => {
                if (typeof chunk === 'string') {
                    controller.enqueue(new TextEncoder().encode(chunk));
                } else if (chunk instanceof Uint8Array) {
                    controller.enqueue(chunk);
                } else if (chunk instanceof ArrayBuffer) {
                    controller.enqueue(new Uint8Array(chunk));
                } else if (ArrayBuffer.isView(chunk)) {
                    controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                } else {
                    controller.enqueue(new Uint8Array(Buffer.from(String(chunk))));
                }
            });
            stream.on('end', () => controller.close());
            stream.on('error', (error: unknown) => controller.error(error));
        },
    });
}

function safeFilename(name: string, fallback: string): string {
    const normalized = String(name || fallback)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 120);
    return normalized || fallback;
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ attachmentId: string }> },
) {
    const ip = getClientIp(request);

    try {
        const limit = await checkRateLimit(`lost_found_media_${ip}`, 120, 60_000);
        if (!limit.success) return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many media requests.'));

        const { attachmentId } = await params;
        const attachment = await getLostFoundAttachment(attachmentId.trim());
        if (!attachment) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(attachment.mimeType)) {
            throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
        }

        const configuredFolder = getLostFoundFolderId();

        const file = await getDriveMediaStreamById(attachment.driveFileId, attachment.resourceKey || undefined);
        if (!file || file.mimeType !== attachment.mimeType) {
            throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
        }

        if (!file.parents?.includes(configuredFolder) || file.sizeBytes !== attachment.sizeBytes || attachment.sizeBytes > lostFoundLimits.maxImageBytes) {
            throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
        }

        return new Response(nodeReadableToWebStream(file.stream), {
            status: 200,
            headers: {
                'Content-Type': attachment.mimeType,
                'Content-Disposition': `inline; filename="${safeFilename(attachment.fileName, 'lost-found-media')}"`,
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('[Lost Found Media API] GET failed:', redactErrorForLog(error));
        const response = toApiResponse(error);
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}
