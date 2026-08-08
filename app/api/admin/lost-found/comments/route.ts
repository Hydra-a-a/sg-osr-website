import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { listLostFoundCommentsForAdmin, moderateLostFoundComment } from '@/lib/lost-found';
import { LostFoundCommentModerationSchema } from '@/schemas/lost-found';

export async function PATCH(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const { email } = await requireActiveDatabaseOfficer();
        const limit = await checkRateLimit(`admin_lost_found_comment_${email}_${ip}`, 60, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const payload = await request.json().catch(() => null);
        const parsed = LostFoundCommentModerationSchema.safeParse(payload);
        if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Invalid comment moderation update.');

        const result = await moderateLostFoundComment({
            commentId: parsed.data.commentId,
            isHidden: parsed.data.isHidden,
            actorEmail: email,
        });

        return withNoStore(NextResponse.json({ success: true, comment: result }));
    } catch (error) {
        console.error('[Admin Lost Found Comments API] PATCH failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function GET(request: NextRequest) {
    const ip = getClientIp(request);

    try {
        const { email } = await requireActiveDatabaseOfficer();
        const itemId = String(new URL(request.url).searchParams.get('itemId') || '').trim();
        if (!itemId) throw new ApiError(400, 'INVALID_ITEM_ID', 'A lost-and-found item is required.');
        const limit = await checkRateLimit(`admin_lost_found_comments_get_${email}_${ip}`, 60, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        return withNoStore(NextResponse.json({
            success: true,
            comments: await listLostFoundCommentsForAdmin(itemId),
        }));
    } catch (error) {
        console.error('[Admin Lost Found Comments API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
