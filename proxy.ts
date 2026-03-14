import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

/**
 * Middleware: runs on every matched request before the page renders.
 * - Redirects unauthenticated users to /login for protected routes.
 * - Blocks non-leaders from leader-only routes with a 403.
 */
export default auth((req) => {
    const { nextUrl, auth: session } = req;
    const isLoggedIn = !!session?.user;
    const pathname = nextUrl.pathname;

    // Define route protection tiers
    const publicRoutes = ['/', '/login', '/news', '/directory', '/services', '/transparency', '/hub', '/osr'];
    const leaderOnlyRoutes: string[] = [];

    // Allow public pages and all API/static/image routes through
    const isPublic = publicRoutes.some((r) => pathname === r || pathname.startsWith('/api/') || pathname.startsWith('/_next'));
    if (isPublic) {
        // If already logged in and visiting /login, redirect to home
        if (pathname === '/login' && isLoggedIn) {
            return NextResponse.redirect(new URL('/', nextUrl));
        }
        return NextResponse.next();
    }

    // Not logged in → redirect to login
    if (!isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Leader-only enforcement
    const isLeaderRoute = leaderOnlyRoutes.some((r) => pathname.startsWith(r));
    if (isLeaderRoute && session.user.role !== 'leader') {
        return NextResponse.redirect(new URL('/?error=unauthorized', nextUrl));
    }

    return NextResponse.next();
});

export const config = {
    // Run middleware on all routes except static files and API auth routes
    matcher: ['/((?!_next/static|_next/image|favicon.ico|images|api/auth).*)'],
};
