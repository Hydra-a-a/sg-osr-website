import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { loadHubGuides } from '@/lib/hub-guides';
import { publicContentHeaders } from '@/lib/public-cache';

// The shared loader resolves HUB_GUIDES_SOURCE through resolvePublicContentSource before reading.

export const revalidate = 3600;

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`hub_guides_${ip}`, 40, 60_000);

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        return NextResponse.json({ data: await loadHubGuides() }, { headers: publicContentHeaders(60, 3600) });
    } catch (error) {
        console.error('[Hub Guides API] Failed to fetch Student Hub guides:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
