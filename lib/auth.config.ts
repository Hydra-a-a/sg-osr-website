import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import { logAuditAction } from '@/lib/audit';

const ALLOWED_DOMAIN = 'rtu.edu.ph';

const FORBIDDEN_AUTH_HOST_PATTERNS = [
    /(^|\.)loca\.lt$/i,
    /(^|\.)localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /(^|\.)ngrok(-free)?\.app$/i,
    /(^|\.)trycloudflare\.com$/i,
];

function parseAuthOriginFromEnv(): URL | null {
    const rawUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || process.env.VERCEL_URL;
    if (!rawUrl) return null;

    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    try {
        return new URL(normalized);
    } catch {
        return null;
    }
}

function validateAuthUrlSafety() {
    if (process.env.NODE_ENV !== 'production') return;

    const parsedUrl = parseAuthOriginFromEnv();
    if (!parsedUrl) {
        throw new Error('[Auth] Missing or invalid NEXTAUTH_URL/AUTH_URL/VERCEL_URL in production.');
    }

    if (parsedUrl.protocol !== 'https:') {
        throw new Error('[Auth] OAuth base URL must use HTTPS in production.');
    }

    const host = parsedUrl.hostname.toLowerCase();
    if (FORBIDDEN_AUTH_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
        throw new Error(
            `[Auth] Refusing production startup with tunnel/local OAuth host: ${host}. Set NEXTAUTH_URL to your real domain.`,
        );
    }
}

validateAuthUrlSafety();

export const authConfig = {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
                params: {
                    prompt: 'consent',
                    hd: ALLOWED_DOMAIN,
                },
            },
        }),
    ],
    pages: {
        signIn: '/login',
        error: '/login',
    },
    callbacks: {
        async redirect({ url, baseUrl }) {
            if (url.startsWith('/')) {
                return `${baseUrl}${url}`;
            }

            try {
                const callbackUrl = new URL(url);
                if (callbackUrl.origin === baseUrl) {
                    return url;
                }
            } catch {
            }

            return baseUrl;
        },

        /**
         * signIn callback — gate: only allow @rtu.edu.ph emails
         */
        async signIn({ user, account }) {
            const email = user.email?.toLowerCase() || '';

            if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
                logAuditAction('AUTH_DOMAIN_REJECTED', {
                    attemptedEmail: email.split('@')[1] || 'unknown-domain',
                    provider: account?.provider || 'unknown',
                });
                return false; // Block sign-in
            }

            logAuditAction('AUTH_SIGN_IN', {
                domain: ALLOWED_DOMAIN,
                provider: account?.provider || 'unknown',
            });

            return true;
        },

        /**
         * session callback — expose role and basic profile safely
         */
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role as string;
                session.user.email = token.email as string;
            }
            return session;
        },
    },
    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60, // 8 hours — a school day
    },
    trustHost: true,
} satisfies NextAuthConfig;
