import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { rateLimitResponse, withNoStore } from '@/lib/api-responses';
import { checkRateLimit } from '@/lib/rate-limit';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { createLostFoundComment, listPublicLostFoundComments, isRtuEmail } from '@/lib/lost-found';
import { LostFoundCommentRole } from '@prisma/client';
import { LostFoundCommentSchema } from '@/schemas/lost-found';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> },
) {
    const ip = getClientIp(request);

    try {
        const { itemId } = await params;
        const limit = await checkRateLimit(`lost_found_comments_get_${itemId}_${ip}`, 60, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const comments = await listPublicLostFoundComments(itemId.trim());
        if (!comments) throw new ApiError(404, 'NOT_FOUND', 'Lost-and-found report not found.');

        return withNoStore(NextResponse.json({ success: true, comments }));
    } catch (error) {
        console.error('[Lost Found Comments API] GET failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> },
) {
    const ip = getClientIp(request);

    try {
        requireSameOriginRequest(request);
        const session = await auth();
        const email = String(session?.user?.email || '').trim().toLowerCase();
        if (!email || !isRtuEmail(email)) {
            throw new ApiError(401, 'UNAUTHORIZED', 'An RTU account is required to comment.');
        }

        const { itemId } = await params;
        const limit = await checkRateLimit(`lost_found_comments_post_${itemId}_${email}_${ip}`, 20, 60_000);
        if (!limit.success) return rateLimitResponse(limit);

        const body = await request.json().catch(() => null);
        const parsed = LostFoundCommentSchema.safeParse(body);
        if (!parsed.success) throw new ApiError(400, 'INVALID_PAYLOAD', 'Enter a valid comment.');

        const comment = await createLostFoundComment({
            itemId: itemId.trim(),
            authorEmail: email,
            authorRole: session.user.role === 'officer' ? LostFoundCommentRole.OFFICER : LostFoundCommentRole.STUDENT,
            message: sanitizeText(parsed.data.message),
        });
        if (!comment) throw new ApiError(404, 'NOT_FOUND', 'Lost-and-found report not found.');

        return withNoStore(NextResponse.json({ success: true, comment }, { status: 201 }));
    } catch (error) {
        console.error('[Lost Found Comments API] POST failed:', redactErrorForLog(error));
        return withNoStore(toApiResponse(error));
    }
}
