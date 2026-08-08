import { getDriveMediaStreamById, getLostFoundFolderId } from '@/lib/google-drive';
import { getLostFoundAttachmentForAdmin, lostFoundLimits } from '@/lib/lost-found';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';

function nodeReadableToWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            stream.on('data', (chunk: unknown) => {
                if (typeof chunk === 'string') controller.enqueue(new TextEncoder().encode(chunk));
                else if (chunk instanceof Uint8Array) controller.enqueue(chunk);
                else if (chunk instanceof ArrayBuffer) controller.enqueue(new Uint8Array(chunk));
                else if (ArrayBuffer.isView(chunk)) controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                else controller.enqueue(new Uint8Array(Buffer.from(String(chunk))));
            });
            stream.on('end', () => controller.close());
            stream.on('error', (error: unknown) => controller.error(error));
        },
    });
}

function safeFilename(name: string): string {
    return String(name || 'lost-found-media').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'lost-found-media';
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ attachmentId: string }> },
) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_lost_found_media_${email}_${ip}`, 120, 60_000);
        if (!limit.success) throw new ApiError(429, 'RATE_LIMITED', 'Too many media requests.');

        const { attachmentId } = await params;
        const attachment = await getLostFoundAttachmentForAdmin(attachmentId.trim());
        if (!attachment) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(attachment.mimeType)) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');

        const configuredFolder = getLostFoundFolderId();

        const file = await getDriveMediaStreamById(attachment.driveFileId, attachment.resourceKey || undefined);
        if (!file || file.mimeType !== attachment.mimeType) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');

        if (!file.parents?.includes(configuredFolder) || file.sizeBytes !== attachment.sizeBytes || attachment.sizeBytes > lostFoundLimits.maxImageBytes) throw new ApiError(404, 'NOT_FOUND', 'Attachment unavailable.');

        const response = new Response(nodeReadableToWebStream(file.stream), {
            status: 200,
            headers: {
                'Content-Type': attachment.mimeType,
                'Content-Disposition': `inline; filename="${safeFilename(attachment.fileName)}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
        response.headers.set('Cache-Control', 'no-store');
        return response;
    } catch (error) {
        console.error('[Admin Lost Found Media API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
