import type { NextAuthConfig, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
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

const PREVIEW_AUTH_HOST_PATTERNS = [
    /--[a-z0-9-]+\.netlify\.app$/i,
    /-git-[^.]+\.vercel\.app$/i,
];

function getConfiguredAuthOrigin(): string | undefined {
    const rawUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
    const normalized = rawUrl?.trim();
    return normalized || undefined;
}

function parseAuthOriginFromEnv(): URL | null {
    const rawUrl = getConfiguredAuthOrigin();
    if (!rawUrl) return null;

    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    try {
        return new URL(normalized);
    } catch {
        return null;
    }
}

function parseProductionAuthOrigin(): URL | null {
    const vercelUrl = String(process.env.VERCEL_URL || '').trim();
    if (vercelUrl) {
        const normalized = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;

        try {
            return new URL(normalized);
        } catch {
            // Fall through to the explicit env values below.
        }
    }

    return parseAuthOriginFromEnv();
}

function getAuthSecret(): string | undefined {
    const rawSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const normalized = rawSecret?.trim();
    return normalized || undefined;
}

function getConfiguredAuthOriginValidationError(): string | null {
    if (process.env.NODE_ENV !== 'production') {
        return null;
    }

    const parsedUrl = parseProductionAuthOrigin();
    if (!parsedUrl) {
        return 'NEXTAUTH_URL or AUTH_URL';
    }

    if (parsedUrl.protocol !== 'https:') {
        return 'an HTTPS NEXTAUTH_URL or AUTH_URL';
    }

    const host = parsedUrl.hostname.toLowerCase();
    if (FORBIDDEN_AUTH_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
        return 'a public production NEXTAUTH_URL or AUTH_URL';
    }

    if (PREVIEW_AUTH_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
        return 'a stable production NEXTAUTH_URL or AUTH_URL';
    }

    return null;
}

function getMissingGoogleAuthConfig(): string[] {
    const missing: string[] = [];

    if (!(process.env.AUTH_GOOGLE_ID || '').trim()) {
        missing.push('AUTH_GOOGLE_ID');
    }
    if (!(process.env.AUTH_GOOGLE_SECRET || '').trim()) {
        missing.push('AUTH_GOOGLE_SECRET');
    }
    if (process.env.NODE_ENV === 'production' && !getAuthSecret()) {
        missing.push('AUTH_SECRET');
    }
    const authOriginError = getConfiguredAuthOriginValidationError();
    if (authOriginError) {
        missing.push(authOriginError);
    }

    return missing;
}

function validateAuthUrlSafety() {
    if (process.env.NODE_ENV !== 'production') return;

    // Next.js evaluates route modules during the production build. A hard throw
    // here would break CI/CD builds before the runtime environment is actually
    // available, so keep the strict enforcement for live startup only.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        return;
    }

    const parsedUrl = parseProductionAuthOrigin();
    if (!parsedUrl) {
        console.warn('[Auth] NEXTAUTH_URL/AUTH_URL is not set in production. Falling back to trusted request host resolution.');
        return;
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

    if (PREVIEW_AUTH_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
        console.warn(
            `[Auth] Preview-style canonical auth host detected: ${host}. Set NEXTAUTH_URL or AUTH_URL to the stable production host for this deployment.`,
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

const providers: NextAuthConfig['providers'] = [];

const missingGoogleAuthConfig = getMissingGoogleAuthConfig();
if (missingGoogleAuthConfig.length === 0) {
    providers.push(
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
                        'https://www.googleapis.com/auth/classroom.courses',
                        'https://www.googleapis.com/auth/classroom.courses.readonly',
                        'https://www.googleapis.com/auth/classroom.coursework.me',
                        'https://www.googleapis.com/auth/classroom.coursework.students',
                    ].join(' '),
                },
            },
        })
    );
} else {
    console.error(
        `[Auth] Google sign-in disabled because required configuration is missing: ${missingGoogleAuthConfig.join(', ')}.`,
    );
}

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

                const roleValue = requestedRole === 'officer' ? 'officer' : requestedRole === 'leader' ? 'leader' : 'student';

                logAuditAction('AUTH_SIGN_IN', {
                    domain: ALLOWED_DOMAIN,
                    provider: 'dev-sim',
                });

                const roleLabels: Record<string, string> = {
                    officer: 'Local Officer (Simulated)',
                    leader: 'Local Leader (Simulated)',
                    student: 'Local Student (Simulated)',
                };

                return {
                    id: rawEmail,
                    email: rawEmail,
                    name: roleLabels[roleValue] || 'Local Student (Simulated)',
                    role: roleValue,
                };
            },
        })
    );
}

export const authConfig = {
    providers,
    secret: getAuthSecret(),
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
            return applySessionFields(session, token);
        },
    },
    session: {
        strategy: 'jwt',
        maxAge: 8 * 60 * 60, // 8 hours — a school day
    },
    trustHost: true,
} satisfies NextAuthConfig;

/**
 * Project only non-secret identity fields into a browser-visible session.
 * OAuth access/refresh tokens remain JWT claims for server-side consumers.
 */
export function applySessionFields(session: Session, token: JWT): Session {
    if (session.user) {
        session.user.role = token.role as string;
        session.user.email = token.email as string;
        session.user.isDevSim = token.isDevSim === true;
    }

    return session;
}
