import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import {
    createLostFoundItem,
    listLostFoundItemsForAdmin,
    updateLostFoundItem,
    validateLostFoundAttachments,
} from '@/lib/lost-found';
import type { PreparedLostFoundAttachment } from '@/lib/lost-found';
import { LostFoundCsoSchema, LostFoundModerationSchema } from '@/schemas/lost-found';
import { LostFoundReportType, LostFoundSource, LostFoundStatus } from '@prisma/client';

function parseEventDate(value: string): Date | null {
    if (!value.trim()) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, 'INVALID_EVENT_DATE', 'Enter a valid event date.');
    }
    return date;
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_lost_found_get_${email}_${ip}`, 60, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        return withNoStore(NextResponse.json({
            success: true,
            items: await listLostFoundItemsForAdmin(),
        }));
    } catch (error) {
        console.error('[Admin Lost Found API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_lost_found_patch_${email}_${ip}`, 40, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const payload = await request.json().catch(() => null);
        const parsed = LostFoundModerationSchema.safeParse(payload);
        if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Invalid moderation update.');

        const result = await updateLostFoundItem({
            itemId: parsed.data.itemId,
            status: parsed.data.status as LostFoundStatus,
            reviewNotes: sanitizeText(parsed.data.reviewNotes),
            actorEmail: email,
        });

        return withNoStore(NextResponse.json({ success: true, item: result }));
    } catch (error) {
        console.error('[Admin Lost Found API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_lost_found_post_${email}_${ip}`, 20, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const contentLengthHeader = request.headers.get('content-length');
        const contentLength = Number(contentLengthHeader || 0);
        if ((contentLengthHeader && (!Number.isFinite(contentLength) || contentLength < 0)) || contentLength > 16 * 1024 * 1024) {
            throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The total image upload must be 15MB or smaller.');
        }

        const contentType = request.headers.get('content-type') || '';
        let fields: Record<string, string>;
        let files: PreparedLostFoundAttachment[] = [];
        if (contentType.includes('multipart/form-data')) {
            const form = await request.formData();
            fields = {
                reportType: String(form.get('reportType') || ''),
                title: String(form.get('title') || ''),
                description: String(form.get('description') || ''),
                location: String(form.get('location') || ''),
                eventDate: String(form.get('eventDate') || ''),
                csoReference: String(form.get('csoReference') || ''),
                status: String(form.get('status') || 'PUBLISHED'),
            };
            files = await validateLostFoundAttachments(
                form.getAll('attachments').filter((value): value is File => value instanceof File),
            );
        } else {
            const body = await request.json().catch(() => null);
            fields = Object.fromEntries(Object.entries(body || {}).map(([key, value]) => [key, String(value ?? '')]));
        }

        const parsed = LostFoundCsoSchema.safeParse(fields);
        if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Complete the CSO bulletin details before saving.');

        const itemId = await createLostFoundItem({
            source: LostFoundSource.CSO,
            reportType: parsed.data.reportType as LostFoundReportType,
            title: sanitizeText(parsed.data.title),
            description: sanitizeText(parsed.data.description),
            location: sanitizeText(parsed.data.location),
            eventDate: parseEventDate(parsed.data.eventDate),
            submitterEmail: '',
            submitterName: 'Civil Security Office',
            csoReference: sanitizeText(parsed.data.csoReference),
            status: parsed.data.status as LostFoundStatus,
            reviewedBy: email,
        }, files);

        return withNoStore(NextResponse.json({ success: true, itemId }, { status: 201 }));
    } catch (error) {
        console.error('[Admin Lost Found API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
