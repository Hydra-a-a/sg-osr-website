import { handlers } from '@/lib/auth';
import { checkAuthRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/security';
import { NextRequest, NextResponse } from 'next/server';

const { GET, POST: nextAuthPOST } = handlers;

export { GET };

/**
 * Wrap the NextAuth POST handler with IP-based rate limiting.
 * Allows 5 sign-in attempts per IP per 15-minute window.
 */
export async function POST(req: NextRequest) {
    const ip = getClientIp(req);
    const result = await checkAuthRateLimit(ip);

    if (!result.success) {
        return NextResponse.json(
            { error: 'Too many login attempts. Please try again in 15 minutes.' },
            {
                status: 429,
                headers: { 'Retry-After': String(result.retryAfter ?? 900) },
            }
        );
    }

    return nextAuthPOST(req);
}
