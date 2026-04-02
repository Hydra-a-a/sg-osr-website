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
    const pathname = req.nextUrl.pathname;
    const isCallbackPost = pathname.includes('/api/auth/callback/');
    const isLocalDevSimCallback =
        process.env.NODE_ENV !== 'production'
        && process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true'
        && pathname.endsWith('/api/auth/callback/dev-sim');

    // Avoid rate-limiting non-authentication POST routes (logout/csrf/session etc.).
    if (!isCallbackPost || isLocalDevSimCallback) {
        return nextAuthPOST(req);
    }

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
