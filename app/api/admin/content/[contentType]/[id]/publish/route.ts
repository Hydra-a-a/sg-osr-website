import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { PUBLIC_CACHE_TAGS, revalidatePublicTags } from '@/lib/public-cache';
import { requireActiveDatabaseOfficer } from '@/lib/admin-access';
import { requireSameOriginRequest } from '@/lib/request-guards';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { parseAdminContentType, publishAdminContent } from '@/lib/admin-content';
import { logAuditAction } from '@/lib/audit';

function noStore(response: NextResponse) { response.headers.set('Cache-Control', 'no-store'); return response; }

export async function POST(request: NextRequest, context: { params: Promise<{ contentType: string; id: string }> }) {
    try {
        requireSameOriginRequest(request);
        const { email, actor } = await requireActiveDatabaseOfficer();
        const { contentType, id } = await context.params;
        const type = parseAdminContentType(contentType);
        const limit = await checkRateLimit(`admin_content_publish_${email}_${getClientIp(request)}`, 20, 60_000);
        if (!limit.success) return noStore(toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests.')));
        const result = await publishAdminContent(type, id, { id: email, label: actor.name || email });
        const tag = type === 'directory'
            ? PUBLIC_CACHE_TAGS.directory
            : type === 'news'
                ? PUBLIC_CACHE_TAGS.news
                : type === 'hub-guide'
                    ? PUBLIC_CACHE_TAGS.hubGuides
                    : PUBLIC_CACHE_TAGS.quickLinks;
        await revalidatePublicTags([tag, PUBLIC_CACHE_TAGS.announcements]);
        revalidatePath('/', 'layout');
        logAuditAction('ADMIN_CONTENT_PUBLISHED', { source: type, reason: 'Published validated public content', entityId: id, actor: email });
        return noStore(NextResponse.json({ success: true, ...result }));
    } catch (error) {
        console.error('[Admin Content API] publish failed:', redactErrorForLog(error));
        return noStore(toApiResponse(error));
    }
}
