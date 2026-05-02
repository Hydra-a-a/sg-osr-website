import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';
import { deriveEffectivePortalRole, hasLeaderPrivilege, hasOfficerPrivilege, PORTAL_MODE_COOKIE, LEADER_ATTEMPT_COOKIE, OFFICER_ATTEMPT_COOKIE } from '@/lib/portal-mode';

const { auth } = NextAuth(authConfig);

function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary);
}

function buildCspHeader(nonce: string): string {
    const isProduction = process.env.NODE_ENV === 'production';
    return `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? '' : " 'unsafe-eval'"};
      script-src-attr 'none';
      style-src 'self' 'nonce-${nonce}';
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://*.googleusercontent.com https://www.google.com https://*.fbcdn.net https://*.facebook.com;
      font-src 'self';
      media-src 'self' blob:;
      object-src 'none';
      base-uri 'self';
      form-action 'self' https://accounts.google.com;
      frame-src 'self' https://*.youtube.com https://drive.google.com https://*.drive.google.com https://accounts.google.com;
      frame-ancestors 'self';
      connect-src 'self' https://*.google.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://*.ingest.sentry.io https://ingest.sentry.io;
      worker-src 'self' blob:;
      manifest-src 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();
}

function buildCspReportOnlyHeader(nonce: string): string {
    return `
      default-src 'self';
      script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
      script-src-attr 'none';
      style-src 'self' 'nonce-${nonce}';
      style-src-attr 'unsafe-inline';
      img-src 'self' blob: data: https://*.googleusercontent.com https://www.google.com https://*.fbcdn.net https://*.facebook.com;
      font-src 'self';
      media-src 'self' blob:;
      object-src 'none';
      base-uri 'self';
      form-action 'self' https://accounts.google.com;
      frame-src 'self' https://*.youtube.com https://drive.google.com https://*.drive.google.com https://accounts.google.com;
      frame-ancestors 'self';
      connect-src 'self' https://*.google.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://*.ingest.sentry.io https://ingest.sentry.io;
      worker-src 'self' blob:;
      manifest-src 'self';
      upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim();
}

function applySecurityHeaders(response: NextResponse, nonce: string, cspHeader: string, pathname?: string): NextResponse {
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('x-nonce', nonce);
        response.headers.set('Content-Security-Policy', cspHeader);
        response.headers.set('Content-Security-Policy-Report-Only', buildCspReportOnlyHeader(nonce));
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    if (pathname === '/login') {
        response.headers.set('Cache-Control', 'no-store, max-age=0');
        response.headers.set('Pragma', 'no-cache');
    }

    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
    response.headers.set('Origin-Agent-Cluster', '?1');
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
    response.headers.set(
        'Permissions-Policy',
        'accelerometer=(), autoplay=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
    return response;
}

function nextWithSecurityHeaders(req: Parameters<ReturnType<typeof auth>>[0], nonce: string, cspHeader: string): NextResponse {
    const requestHeaders = new Headers(req.headers);
    if (process.env.NODE_ENV === 'production') {
        requestHeaders.set('x-nonce', nonce);
        requestHeaders.set('Content-Security-Policy', cspHeader);
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    return applySecurityHeaders(response, nonce, cspHeader, req.nextUrl.pathname);
}

/**
 * Middleware: runs on every matched request before the page renders.
 * - Redirects unauthenticated users to /login for protected routes.
 * - Blocks non-leaders from leader-only routes with a 403.
 */
export default auth((req) => {
    const nonce = generateNonce();
    const cspHeader = buildCspHeader(nonce);

    const { nextUrl, auth: session } = req;
    const isLoggedIn = !!session?.user;
    const pathname = nextUrl.pathname;

    // Define route protection tiers
    const publicRoutes = [
        '/',
        '/login',
        '/news',
        '/directory',
        '/services',
        '/services/grievance',
        '/services/track',
        '/transparency',
        '/hub',
        '/hub/commute',
        '/osr',
        '/about',
        '/student-government',
        '/student-government/osr',
        '/student-government/commissions',
        '/student-government/councils',
    ];
    const publicRoutePrefixes = ['/projects'];
    const leaderOnlyRoutes: string[] = ['/services/proposals'];
    const officerOnlyRoutes = ['/services/admin'];

    const normalizedPathname = pathname !== '/' && pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname;

    // Allow public pages and all API/static/image routes through
    const isPublicRoute = publicRoutes.includes(normalizedPathname);
    const isPublicPrefixedRoute = publicRoutePrefixes.some((prefix) => normalizedPathname === prefix || normalizedPathname.startsWith(`${prefix}/`));
    const isFrameworkOrApiRoute = normalizedPathname.startsWith('/api/') || normalizedPathname.startsWith('/_next');
    const isPublic = isPublicRoute || isPublicPrefixedRoute || isFrameworkOrApiRoute;
    if (isPublic) {
        // If already logged in and visiting /login, redirect to home
        if (pathname === '/login' && isLoggedIn) {
            return applySecurityHeaders(NextResponse.redirect(new URL('/', nextUrl)), nonce, cspHeader, '/');
        }
        return nextWithSecurityHeaders(req, nonce, cspHeader);
    }

    // Not logged in → redirect to login
    if (!isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return applySecurityHeaders(NextResponse.redirect(loginUrl), nonce, cspHeader, '/login');
    }

    const effectiveRole = deriveEffectivePortalRole(session?.user?.role, req.cookies.get(PORTAL_MODE_COOKIE)?.value);

    // 1. Officer-only enforcement (must check BEFORE leader routes)
    const isOfficerRoute = officerOnlyRoutes.some((r) => normalizedPathname === r || normalizedPathname.startsWith(`${r}/`));
    if (isOfficerRoute) {
        if (effectiveRole !== 'officer') {
            const isAuthorized = hasOfficerPrivilege(session?.user?.role);
            if (isAuthorized) {
                // Hint for the UI to show a "Switch to Officer Mode" notice
                const response = applySecurityHeaders(NextResponse.redirect(new URL('/', nextUrl)), nonce, cspHeader, '/');
                response.cookies.set(OFFICER_ATTEMPT_COOKIE, '1', { path: '/', maxAge: 300, sameSite: 'lax' });
                return response;
            }
            return applySecurityHeaders(NextResponse.redirect(new URL('/?error=unauthorized', nextUrl)), nonce, cspHeader, '/');
        }
    }

    // 2. Leader-only enforcement (officers also pass since they have leader privilege)
    const isLeaderRoute = leaderOnlyRoutes.some((r) => pathname.startsWith(r));
    if (isLeaderRoute) {
        if (!hasLeaderPrivilege(effectiveRole)) {
            const isAuthorized = hasLeaderPrivilege(session?.user?.role);
            if (isAuthorized) {
                // Hint for the UI to show a "Switch to Leader Mode" notice
                const response = applySecurityHeaders(NextResponse.redirect(new URL('/', nextUrl)), nonce, cspHeader, '/');
                response.cookies.set(LEADER_ATTEMPT_COOKIE, '1', { path: '/', maxAge: 300, sameSite: 'lax' });
                return response;
            }
            return applySecurityHeaders(NextResponse.redirect(new URL('/?error=unauthorized', nextUrl)), nonce, cspHeader, '/');
        }
    }

    return nextWithSecurityHeaders(req, nonce, cspHeader);
});

export const config = {
    matcher: [
        {
            source: '/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
