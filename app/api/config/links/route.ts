import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { publicContentHeaders } from '@/lib/public-cache';
import { fetchQuickLinks } from '@/lib/quick-links';
import { resolvePublicContentSource } from '@/lib/public-content-source';

export const revalidate = 3600;

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`links_api_${ip}`, 30, 60_000);
    if (!limit.success) return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));

    try {
        // Resolve at the API boundary so the public route follows the same source contract as its repository.
        resolvePublicContentSource('QUICK_LINKS_SOURCE');
        return NextResponse.json(
            { data: await fetchQuickLinks() },
            { headers: publicContentHeaders(60, 3600) },
        );
    } catch (error) {
        console.error('Quick Links API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
