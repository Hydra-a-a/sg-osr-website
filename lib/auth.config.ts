import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
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

function assertLocalLoginSimulationDisabledInProduction() {
    if (process.env.NODE_ENV !== 'production') return;

    if (
        process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true'
        || process.env.NEXT_PUBLIC_ENABLE_LOCAL_LOGIN_SIMULATION === 'true'
    ) {
        console.warn('[Auth] Ignoring local login simulation flags in production.');
    }
}

assertLocalLoginSimulationDisabledInProduction();

function isLocalDevLoginEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    if (process.env.ENABLE_LOCAL_LOGIN_SIMULATION !== 'true') return false;

    const simulationToken = process.env.LOCAL_LOGIN_SIMULATION_TOKEN;
    if (!simulationToken || simulationToken.trim().length < 12) return false;

    return true;
}

function isLocalHost(hostname: string): boolean {
    const normalized = hostname.toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

const providers: NextAuthConfig['providers'] = [
    Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
        authorization: {
            params: {
                prompt: 'consent',
                hd: ALLOWED_DOMAIN,
                access_type: 'offline',
                include_granted_scopes: 'true',
                scope: [
                    'openid',
                    'email',
                    'profile',
                    'https://www.googleapis.com/auth/classroom.courses.readonly',
                    'https://www.googleapis.com/auth/classroom.coursework.me',
                    'https://www.googleapis.com/auth/classroom.coursework.students',
                ].join(' '),
            },
        },
    }),
];

if (isLocalDevLoginEnabled()) {
    providers.push(
        Credentials({
            id: 'dev-sim',
            name: 'Local Dev Simulation',
            credentials: {
                email: { label: 'Email', type: 'email' },
                role: { label: 'Role', type: 'text' },
                devToken: { label: 'Dev Token', type: 'password' },
            },
            async authorize(credentials, request) {
                const rawEmail = credentials?.email?.toString().trim().toLowerCase() || '';
                const requestedRole = credentials?.role?.toString().trim().toLowerCase() || 'student';
                const requiredToken = process.env.LOCAL_LOGIN_SIMULATION_TOKEN;
                const providedToken = credentials?.devToken?.toString().trim();

                if (!requiredToken || !providedToken || providedToken !== requiredToken) {
                    logAuditAction('AUTH_DOMAIN_REJECTED', {
                        attemptedEmail: 'dev-sim-token-mismatch',
                        provider: 'dev-sim',
                    });
                    return null;
                }

                const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
                const hostname = hostHeader.split(',')[0].trim().split(':')[0];
                if (!hostname || !isLocalHost(hostname)) {
                    logAuditAction('AUTH_DOMAIN_REJECTED', {
                        attemptedEmail: `dev-sim-host:${hostname || 'unknown'}`,
                        provider: 'dev-sim',
                    });
                    return null;
                }

                if (!rawEmail || !rawEmail.includes('@') || !rawEmail.endsWith(`@${ALLOWED_DOMAIN}`)) {
                    logAuditAction('AUTH_DOMAIN_REJECTED', {
                        attemptedEmail: rawEmail.split('@')[1] || 'unknown-domain',
                        provider: 'dev-sim',
                    });
                    return null;
                }

                const roleValue = requestedRole === 'leader' ? 'leader' : 'student';

                logAuditAction('AUTH_SIGN_IN', {
                    domain: ALLOWED_DOMAIN,
                    provider: 'dev-sim',
                });

                return {
                    id: rawEmail,
                    email: rawEmail,
                    name: roleValue === 'leader' ? 'Local Leader (Simulated)' : 'Local Student (Simulated)',
                    role: roleValue,
                };
            },
        })
    );
}

export const authConfig = {
    providers,
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
            session.accessToken = token.accessToken as string | undefined;
            return session;
        },
    },
    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60, // 8 hours — a school day
    },
    trustHost: true,
} satisfies NextAuthConfig;
