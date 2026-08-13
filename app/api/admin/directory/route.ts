import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { logAuditAction } from '@/lib/audit';
import { PUBLIC_CACHE_TAGS, revalidatePublicTags } from '@/lib/public-cache';
import {
    getDirectoryAdminPayload,
    removeDirectoryLogo,
    replaceDirectoryLogo,
} from '@/lib/directory-logo-manager';

const DirectoryKeySchema = z.object({
    directoryKey: z.string().trim().min(3).max(120),
}).strict();

const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;

async function enforceLimit(action: string, email: string, ip: string) {
    const limit = await checkRateLimit(`admin_directory_${action}_${email}_${ip}`, action === 'get' ? 60 : 20, 60_000);
    return limit.success ? null : rateLimitResponse(limit);
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireActiveDatabaseOfficer();
        const limited = await enforceLimit('get', email, ip);
        if (limited) return limited;

        return withNoStore(NextResponse.json({ success: true, ...(await getDirectoryAdminPayload()) }));
    } catch (error) {
        console.error('[Admin Directory API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limited = await enforceLimit('post', email, ip);
        if (limited) return limited;

        const contentLength = Number(request.headers.get('content-length') || 0);
        if (contentLength > MAX_MULTIPART_BYTES) {
            throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The logo upload must be 6 MB or smaller.');
        }

        const form = await request.formData();
        const parsed = DirectoryKeySchema.safeParse({ directoryKey: form.get('directoryKey') });
        if (!parsed.success) {
            throw new ApiError(400, 'INVALID_PAYLOAD', 'A valid directory entry is required.');
        }

        const file = form.get('logo');
        if (typeof File === 'undefined' || !(file instanceof File)) {
            throw new ApiError(400, 'INVALID_LOGO_FILE', 'Choose a logo image to upload.');
        }

        const result = await replaceDirectoryLogo({
            directoryKey: parsed.data.directoryKey,
            file,
            actorEmail: email,
        });
        await revalidatePublicTags([PUBLIC_CACHE_TAGS.directory]);
        logAuditAction('DIRECTORY_LOGO_UPLOADED', {
            source: 'admin_directory_dashboard',
            directoryKey: result.directoryKey,
            mimeType: result.mimeType,
            sizeBytes: result.sizeBytes,
        });

        return withNoStore(NextResponse.json({ success: true, logo: result }));
    } catch (error) {
        console.error('[Admin Directory API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function DELETE(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limited = await enforceLimit('delete', email, ip);
        if (limited) return limited;

        const body = await request.json().catch(() => null);
        const parsed = DirectoryKeySchema.safeParse(body);
        if (!parsed.success) {
            throw new ApiError(400, 'INVALID_PAYLOAD', 'A valid directory entry is required.');
        }

        const result = await removeDirectoryLogo({ directoryKey: parsed.data.directoryKey, actorEmail: email });
        await revalidatePublicTags([PUBLIC_CACHE_TAGS.directory]);
        logAuditAction('DIRECTORY_LOGO_REMOVED', {
            source: 'admin_directory_dashboard',
            directoryKey: result.directoryKey,
        });

        return withNoStore(NextResponse.json({ success: true, logo: result }));
    } catch (error) {
        console.error('[Admin Directory API] DELETE failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
