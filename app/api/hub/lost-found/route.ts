import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import {
    createLostFoundItem,
    isRtuEmail,
    listPublicLostFoundItems,
    validateLostFoundAttachments,
} from '@/lib/lost-found';
import { LostFoundPublicFilterSchema, LostFoundReportSchema } from '@/schemas/lost-found';
import { LostFoundReportType, LostFoundSource } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
    hashSubmissionPayload,
    markSubmissionFailed,
    markSubmissionSucceeded,
    reserveSubmissionAttempt,
} from '@/lib/idempotency';
import { normalizeIdempotencyKey, submissionResponseHeaders } from '@/lib/idempotency-contract';

export const dynamic = 'force-dynamic';

function parseEventDate(value: string): Date | null {
    if (!value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, 'INVALID_EVENT_DATE', 'Enter a valid date for when the item was lost or found.');
    }
    return date;
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const limit = await checkRateLimit(`lost_found_get_${ip}`, 60, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const url = new URL(request.url);
        const parsed = LostFoundPublicFilterSchema.safeParse({
            source: url.searchParams.get('source') || undefined,
            reportType: url.searchParams.get('reportType') || undefined,
            query: url.searchParams.get('query') || undefined,
        });
        if (!parsed.success) {
            throw new ApiError(400, 'INVALID_FILTER', 'Invalid lost-and-found filter.');
        }

        const items = await listPublicLostFoundItems({
            source: parsed.data.source,
            reportType: parsed.data.reportType,
            query: parsed.data.query,
        });

        return withNoStore(NextResponse.json({ success: true, items }));
    } catch (error) {
        console.error('[Lost Found API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const session = await auth();
        const email = String(session?.user?.email || '').trim().toLowerCase();
        if (!email || !isRtuEmail(email)) {
            throw new ApiError(401, 'UNAUTHORIZED', 'An RTU account is required to submit a report.');
        }

        const limit = await checkRateLimit(`lost_found_submit_${email}_${ip}`, 5, 10 * 60_000);
        if (!limit.success) return rateLimitResponse(limit, 'Too many lost-and-found submissions.');

        const contentLengthHeader = request.headers.get('content-length');
        const contentLength = Number(contentLengthHeader || 0);
        if ((contentLengthHeader && (!Number.isFinite(contentLength) || contentLength < 0)) || contentLength > 16 * 1024 * 1024) {
            throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The total image upload must be 15MB or smaller.');
        }

        const form = await request.formData();
        const files = await validateLostFoundAttachments(
            form.getAll('attachments').filter((value): value is File => value instanceof File),
        );
        const parsed = LostFoundReportSchema.safeParse({
            reportType: String(form.get('reportType') || ''),
            title: String(form.get('title') || ''),
            description: String(form.get('description') || ''),
            location: String(form.get('location') || ''),
            eventDate: String(form.get('eventDate') || ''),
        });
        if (!parsed.success) {
            throw new ApiError(400, 'INVALID_PAYLOAD', 'Complete the report details before submitting.');
        }

        const idempotencyKey = normalizeIdempotencyKey(request.headers.get('Idempotency-Key'));
        const payloadHash = idempotencyKey
            ? hashSubmissionPayload('LOST_FOUND', {
                ...parsed.data,
                attachments: files.map((file) => ({
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    sizeBytes: file.sizeBytes,
                    contentHash: createHash('sha256').update(file.buffer).digest('hex'),
                })),
            })
            : null;
        const reservation = idempotencyKey && payloadHash
            ? await reserveSubmissionAttempt({ operation: 'LOST_FOUND', idempotencyKey, actor: email, payloadHash })
            : null;

        if (reservation?.kind === 'replayed') {
            return withNoStore(NextResponse.json({
                success: true,
                itemId: reservation.entityId,
                status: 'PENDING_REVIEW',
                replayed: true,
            }, { headers: submissionResponseHeaders(true) }));
        }
        if (reservation?.kind === 'in_progress') {
            const response = toApiResponse(new ApiError(409, 'SUBMISSION_IN_PROGRESS', 'This report is already being submitted.'));
            response.headers.set('Retry-After', String(reservation.retryAfterSeconds));
            response.headers.set('Idempotency-Replayed', 'false');
            return withNoStore(response);
        }
        if (reservation?.kind === 'reused') {
            const response = toApiResponse(new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for different report data.'));
            response.headers.set('Idempotency-Replayed', 'false');
            return withNoStore(response);
        }

        let itemId: string;
        try {
            itemId = await createLostFoundItem({
                source: LostFoundSource.STUDENT,
                reportType: parsed.data.reportType as LostFoundReportType,
                title: sanitizeText(parsed.data.title),
                description: sanitizeText(parsed.data.description),
                location: sanitizeText(parsed.data.location),
                eventDate: parseEventDate(parsed.data.eventDate),
                submitterEmail: email,
                submitterName: sanitizeText(session.user.name || 'RTU Student'),
            }, files, reservation?.kind === 'reserved' ? reservation.attemptId : undefined);
            if (reservation?.kind === 'reserved') {
                await markSubmissionSucceeded({ attemptId: reservation.attemptId, entityId: itemId });
            }
        } catch (error) {
            if (reservation?.kind === 'reserved') {
                await markSubmissionFailed(reservation.attemptId, error instanceof ApiError ? error.code : 'SUBMISSION_FAILED').catch(() => undefined);
            }
            throw error;
        }

        return withNoStore(NextResponse.json({
            success: true,
            itemId,
            status: 'PENDING_REVIEW',
            replayed: false,
        }, { status: 201, headers: submissionResponseHeaders(false) }));
    } catch (error) {
        console.error('[Lost Found API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
